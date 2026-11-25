package cz.mzk.vera.pluginhost;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.PluginUnavailable;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

// PLG-api-session.
class PluginSessionsTests {
    private static final URI CATALOG = URI.create("https://aleph.example/OAI?verb=Identify");
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final FakeTime time = new FakeTime();
    private final List<Opened> opened = new ArrayList<>();
    private final PluginSessions sessions = new PluginSessions(() -> {
        Opened transport = new Opened();
        opened.add(transport);
        return transport;
    }, time);

    @Test
    void anInstanceKeepsOneSessionAndItsCookies() {
        Opened first = sessionOf("pi1");
        first.answers.add(answer(200, Map.of("set-cookie", List.of("ALEPH_SESSION_ID=abc; Path=/"))));
        first.answers.add(answer(200, Map.of()));

        send("pi1", RequestLimit.DEFAULT);
        send("pi1", RequestLimit.DEFAULT);

        assertThat(opened).hasSize(1);
        assertThat(first.requests.get(0).headers()).doesNotContainKey("Cookie");
        assertThat(first.requests.get(1).headers()).containsEntry("Cookie", List.of("ALEPH_SESSION_ID=abc"));

        sessionOf("pi2");
        assertThat(opened).hasSize(2);
    }

    @Test
    void aCookieThePluginSetsComesFirst() {
        Opened transport = sessionOf("pi1");
        transport.answers.add(answer(200, Map.of("Set-Cookie", List.of("session=s1"))));
        transport.answers.add(answer(200, Map.of()));
        send("pi1", RequestLimit.DEFAULT);

        sessions.http("pi1", RequestLimit.DEFAULT, TIMEOUT, new AtomicLong()).send(
                new PluginHttp.Request("GET", CATALOG, Map.of("cookie", List.of("own=1")), null));

        assertThat(transport.requests.get(1).headers()).containsEntry("Cookie", List.of("own=1; session=s1"));
    }

    @Test
    void aFullWindowWaitsForRoomAndTheWaitIsCounted() {
        Opened transport = sessionOf("pi1");
        RequestLimit twoAMinute = new RequestLimit(2, Duration.ofMinutes(1));
        AtomicLong waited = new AtomicLong();
        PluginHttp http = sessions.http("pi1", twoAMinute, TIMEOUT, waited);

        http.send(get());
        time.advance(Duration.ofSeconds(10));
        http.send(get());
        http.send(get());

        assertThat(transport.requests).hasSize(3);
        assertThat(time.slept).containsExactly(Duration.ofSeconds(50));
        assertThat(Duration.ofNanos(waited.get())).isEqualTo(Duration.ofSeconds(50));
    }

    @Test
    void aStoredLimitIsReadAndAMissingOneIsTheDefault() {
        JsonMapper json = JsonMapper.builder().build();
        assertThat(RequestLimit.of(json.readTree("{\"requests\":20,\"minutes\":5}")))
                .isEqualTo(new RequestLimit(20, Duration.ofMinutes(5)));
        assertThat(RequestLimit.of(null)).isEqualTo(RequestLimit.DEFAULT);
        assertThat(RequestLimit.of(json.readTree("null"))).isEqualTo(RequestLimit.DEFAULT);
        assertThat(RequestLimit.of(json.readTree("{\"requests\":0,\"minutes\":5}"))).isEqualTo(RequestLimit.DEFAULT);
    }

    @Test
    void a503WaitsAsRetryAfterSaysAndTriesAgain() {
        Opened transport = sessionOf("pi1");
        transport.answers.add(answer(503, Map.of("Retry-After", List.of("7"))));
        transport.answers.add(answer(200, Map.of()));

        assertThat(send("pi1", RequestLimit.DEFAULT).status()).isEqualTo(200);
        assertThat(time.slept).containsExactly(Duration.ofSeconds(7));
    }

    @Test
    void aRetryAfterDateIsReadAgainstTheMachinesTime() {
        Opened transport = sessionOf("pi1");
        transport.answers.add(answer(429, Map.of("retry-after", List.of("Wed, 25 Nov 2026 10:00:30 GMT"))));
        transport.answers.add(answer(200, Map.of()));

        send("pi1", RequestLimit.DEFAULT);

        assertThat(time.slept).containsExactly(Duration.ofSeconds(30));
    }

    @Test
    void refusalsThatGoOnEndTheCallAsUnavailableAndTheNextCallStillWaits() {
        Opened transport = sessionOf("pi1");
        for (int i = 0; i < 3; i++) transport.answers.add(answer(429, Map.of()));

        assertThatThrownBy(() -> send("pi1", RequestLimit.DEFAULT)).isInstanceOf(PluginUnavailable.class);
        // Doubling from a second: it waited one and two, and the third pause holds for the next call.
        assertThat(time.slept).containsExactly(Duration.ofSeconds(1), Duration.ofSeconds(2));

        transport.answers.add(answer(200, Map.of()));
        send("pi1", RequestLimit.DEFAULT);
        assertThat(time.slept).containsExactly(Duration.ofSeconds(1), Duration.ofSeconds(2), Duration.ofSeconds(4));
    }

    @Test
    void aRetryAfterLongerThanAMinuteEndsTheCallAtOnce() {
        Opened transport = sessionOf("pi1");
        transport.answers.add(answer(503, Map.of("Retry-After", List.of("600"))));

        assertThatThrownBy(() -> send("pi1", RequestLimit.DEFAULT)).isInstanceOf(PluginUnavailable.class);
        assertThat(transport.requests).hasSize(1);
        assertThat(time.slept).isEmpty();
    }

    @Test
    void theInstanceTimeoutReachesTheTransport() {
        Opened transport = sessionOf("pi1");
        sessions.http("pi1", RequestLimit.DEFAULT, Duration.ofSeconds(45), new AtomicLong()).send(get());

        assertThat(transport.timeouts).containsExactly(Duration.ofSeconds(45));
    }

    @Test
    void whatACallWaitedForRoomIsAddedToItsTimeout() throws Exception {
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            AtomicLong waited = new AtomicLong();
            var paced = executor.submit(() -> {
                waited.addAndGet(Duration.ofMillis(600).toNanos());
                Thread.sleep(700);
                return "paced";
            });
            assertThat(PluginCalls.await(paced, Duration.ofMillis(300), waited)).isEqualTo("paced");

            var slow = executor.submit(() -> {
                Thread.sleep(2_000);
                return "late";
            });
            assertThatThrownBy(() -> PluginCalls.await(slow, Duration.ofMillis(300), new AtomicLong()))
                    .isInstanceOf(TimeoutException.class);
        }
    }

    private Opened sessionOf(String instanceId) {
        int before = opened.size();
        sessions.http(instanceId, RequestLimit.DEFAULT, TIMEOUT, new AtomicLong());
        return opened.size() > before ? opened.get(opened.size() - 1) : opened.get(0);
    }

    private PluginHttp.Response send(String instanceId, RequestLimit limit) {
        return sessions.http(instanceId, limit, TIMEOUT, new AtomicLong()).send(get());
    }

    private static PluginHttp.Request get() {
        return new PluginHttp.Request("GET", CATALOG, Map.of(), null);
    }

    private static PluginHttp.Response answer(int status, Map<String, List<String>> headers) {
        return new PluginHttp.Response(status, headers, new byte[0]);
    }

    private static final class Opened implements PluginTransport {
        final Deque<PluginHttp.Response> answers = new ArrayDeque<>();
        final List<PluginHttp.Request> requests = new ArrayList<>();
        final List<Duration> timeouts = new ArrayList<>();

        @Override
        public PluginHttp.Response send(PluginHttp.Request request, Duration timeout) {
            requests.add(request);
            timeouts.add(timeout);
            return answers.isEmpty() ? answer(200, Map.of()) : answers.poll();
        }
    }

    private static final class FakeTime implements SessionTime {
        private long nanos = 1_000_000_000L;
        private Instant now = Instant.parse("2026-11-25T10:00:00Z");
        final List<Duration> slept = new ArrayList<>();

        void advance(Duration duration) {
            nanos += duration.toNanos();
            now = now.plus(duration);
        }

        @Override
        public long nanos() {
            return nanos;
        }

        @Override
        public Instant now() {
            return now;
        }

        @Override
        public void sleep(Duration duration) {
            slept.add(duration);
            advance(duration);
        }
    }
}
