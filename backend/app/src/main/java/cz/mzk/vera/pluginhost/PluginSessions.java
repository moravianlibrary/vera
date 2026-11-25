package cz.mzk.vera.pluginhost;

import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.PluginUnavailable;
import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

// PLG-api-session. Each instance talks to the outside world as one session, whichever call or run
// is speaking: its cookies, its connections, its request limit and its back-off.
@Component
public class PluginSessions {
    private final PluginTransports transports;
    private final SessionTime time;
    private final ConcurrentMap<String, Session> sessions = new ConcurrentHashMap<>();

    @Autowired
    public PluginSessions(PluginTransports transports) {
        this(transports, SessionTime.SYSTEM);
    }

    PluginSessions(PluginTransports transports, SessionTime time) {
        this.transports = transports;
        this.time = time;
    }

    // The client one call gets. What it waits for room is added to `waited`, so the call's own
    // timeout does not count it.
    public PluginHttp http(String instanceId, RequestLimit limit, Duration timeout, AtomicLong waited) {
        Session session = sessions.computeIfAbsent(instanceId, id -> new Session(transports.open(), time));
        return request -> session.send(request, limit, timeout, waited);
    }

    static final class Session {
        // 429 or 503 three times in a row, or a wait longer than a minute, ends the call.
        private static final int ATTEMPTS = 3;
        private static final Duration FIRST_BACK_OFF = Duration.ofSeconds(1);
        private static final Duration LONGEST_WAIT = Duration.ofMinutes(1);

        private final PluginTransport transport;
        private final SessionTime time;
        private final CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        private final ArrayDeque<Long> sent = new ArrayDeque<>();
        private Long pausedUntil;

        Session(PluginTransport transport, SessionTime time) {
            this.transport = transport;
            this.time = time;
        }

        PluginHttp.Response send(PluginHttp.Request request, RequestLimit limit, Duration timeout,
                AtomicLong waited) {
            for (int attempt = 1; ; attempt++) {
                acquire(limit, waited);
                PluginHttp.Response response = transport.send(withCookies(request), timeout);
                remember(request.uri(), response);
                if (response.status() != 429 && response.status() != 503) return response;
                Duration wait = retryAfter(response).orElse(FIRST_BACK_OFF.multipliedBy(1L << (attempt - 1)));
                pause(wait);
                if (attempt == ATTEMPTS || wait.compareTo(LONGEST_WAIT) > 0) {
                    throw new PluginUnavailable("The outside system kept refusing: HTTP " + response.status() + ".");
                }
            }
        }

        // Waits while the session is paused or its window is full, then counts the request.
        private void acquire(RequestLimit limit, AtomicLong waited) {
            while (true) {
                long wait;
                synchronized (this) {
                    long now = time.nanos();
                    long window = limit.window().toNanos();
                    while (!sent.isEmpty() && now - sent.peekFirst() >= window) sent.pollFirst();
                    if (pausedUntil != null && now - pausedUntil < 0) {
                        wait = pausedUntil - now;
                    } else if (sent.size() < limit.requests()) {
                        sent.addLast(now);
                        return;
                    } else {
                        wait = sent.peekFirst() + window - now;
                    }
                }
                // Counted before the sleep, so a call timing out meanwhile already knows it.
                waited.addAndGet(wait);
                try {
                    time.sleep(Duration.ofNanos(wait));
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new PluginUnavailable("Plugin HTTP call interrupted.", interrupted);
                }
            }
        }

        private synchronized void pause(Duration wait) {
            long until = time.nanos() + wait.toNanos();
            if (pausedUntil == null || until - pausedUntil > 0) pausedUntil = until;
        }

        private PluginHttp.Request withCookies(PluginHttp.Request request) {
            List<String> stored;
            try {
                stored = cookies.get(request.uri(), Map.of()).getOrDefault("Cookie", List.of());
            } catch (IOException | IllegalArgumentException unreadable) {
                return request;
            }
            if (stored.isEmpty()) return request;
            Map<String, List<String>> headers = new LinkedHashMap<>();
            List<String> values = new ArrayList<>();
            if (request.headers() != null) {
                request.headers().forEach((key, value) -> {
                    if ("Cookie".equalsIgnoreCase(key)) values.addAll(value);
                    else headers.put(key, value);
                });
            }
            // A cookie the plugin sets itself comes first.
            values.addAll(stored);
            headers.put("Cookie", List.of(String.join("; ", values)));
            return new PluginHttp.Request(request.method(), request.uri(), headers, request.body());
        }

        private void remember(URI uri, PluginHttp.Response response) {
            if (response.headers() == null) return;
            try {
                cookies.put(uri, response.headers());
            } catch (IOException | IllegalArgumentException unreadable) {
                // A cookie VERA cannot read is not kept.
            }
        }

        private Optional<Duration> retryAfter(PluginHttp.Response response) {
            if (response.headers() == null) return Optional.empty();
            String value = response.headers().entrySet().stream()
                    .filter(entry -> "Retry-After".equalsIgnoreCase(entry.getKey()) && !entry.getValue().isEmpty())
                    .map(entry -> entry.getValue().get(0).trim()).findFirst().orElse(null);
            if (value == null) return Optional.empty();
            if (value.matches("\\d+")) return Optional.of(Duration.ofSeconds(Long.parseLong(value)));
            try {
                Instant at = ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
                Duration until = Duration.between(time.now(), at);
                return Optional.of(until.isNegative() ? Duration.ZERO : until);
            } catch (DateTimeParseException unreadable) {
                return Optional.empty();
            }
        }
    }
}
