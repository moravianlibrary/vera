package cz.mzk.vera.plugins.marc_comparator;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import cz.mzk.vera.plugin.LocalPasswords;
import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.PluginUnavailable;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.validation.ValidationCheckAnswer;
import cz.mzk.vera.plugin.validation.ValidationCheckInput;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MarcComparatorTests {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Test void goodComparisonAndValidationsReturnNoDefects() {
        FakeHttp http = new FakeHttp("good.json", "validations-valid.json");
        assertTrue(check(http, "1m").defects().isEmpty());
        assertEquals(3, http.fetchPolls);
    }

    @Test void poorComparisonReportsLowestScoringFields() {
        var defects = check(new FakeHttp("poor.json", "empty.json"), "1m").defects();
        assertEquals(1, defects.size());
        assertEquals("match-poor", defects.getFirst().rule());
        assertEquals("SKC", defects.getFirst().field());
        assertTrue(defects.getFirst().detail().contains("245"));
        assertTrue(defects.getFirst().detail().contains("100"));
        assertTrue(defects.getFirst().detail().contains("260"));
    }

    @Test void invalidValidatorResultBecomesDefectAndValidOneDoesNot() {
        var invalid = check(new FakeHttp("empty.json", "validations-failed.json"), "1m").defects();
        assertEquals("validator:kramerius_links", invalid.getFirst().rule());
        assertEquals("856$u", invalid.getFirst().field());
        assertTrue(invalid.getFirst().detail().contains("link_missing"));
        assertTrue(check(new FakeHttp("empty.json", "validations-valid.json"), "1m").defects().isEmpty());
    }

    @Test void failedFetchTaskIsUnavailable() {
        assertThrows(PluginUnavailable.class, () -> check(new FakeHttp("empty.json", "empty.json", true), "1m"));
    }

    @Test void taskStillRunningWhenWaitPassesIsUnavailable() {
        assertThrows(PluginUnavailable.class,
                () -> check(new FakeHttp("empty.json", "empty.json", false, false, true), "2s"));
    }

    @Test void refusedLoginIsUnavailable() {
        assertThrows(PluginUnavailable.class, () -> check(new FakeHttp("empty.json", "empty.json", false, true), "1m"));
    }

    @Test void noComparisonIsNotADefect() {
        assertTrue(check(new FakeHttp("empty.json", "empty.json"), "1m").defects().isEmpty());
    }

    private ValidationCheckAnswer check(FakeHttp http, String wait) {
        Map<String, String> config = Map.of("api_url", "https://comparator.example", "email", "service@example.org",
                "wait", wait, "poll", "1ms");
        Clock clock = new AdvancingClock();
        PluginContext context = new PluginContext() {
            public String instanceId() { return "marc-check"; }
            public Map<String, String> configuration() { return config; }
            public Map<String, String> secrets() { return Map.of("password", "secret"); }
            public PluginHttp http() { return http; }
            public System.Logger logger() { return System.getLogger("test"); }
            public Clock clock() { return clock; }
            public LocalPasswords localPasswords() { return null; }
        };
        Document record = new Document("record", "MZK01-000067431", null, "title", null, null);
        return new MarcComparator().check(context, new ValidationCheckInput(record, List.of()));
    }

    private static final class FakeHttp implements PluginHttp {
        private final String comparisonFixture;
        private final String validationFixture;
        private final boolean failFetch;
        private final boolean refuseLogin;
        private final boolean stayRunning;
        private int searchPolls;
        private int fetchPolls;
        private int taskCount;
        private boolean processing;

        FakeHttp(String comparison, String validation) { this(comparison, validation, false, false, false); }
        FakeHttp(String comparison, String validation, boolean failFetch) { this(comparison, validation, failFetch, false, false); }
        FakeHttp(String comparison, String validation, boolean failFetch, boolean refuseLogin) {
            this(comparison, validation, failFetch, refuseLogin, false);
        }
        FakeHttp(String comparison, String validation, boolean failFetch, boolean refuseLogin, boolean stayRunning) {
            comparisonFixture = comparison; validationFixture = validation; this.failFetch = failFetch;
            this.refuseLogin = refuseLogin; this.stayRunning = stayRunning;
        }

        public Response send(Request request) {
            String path = request.uri().getPath();
            if (path.equals("/auth/login")) return new Response(refuseLogin ? 401 : 200,
                    refuseLogin ? Map.of() : Map.of("set-cookie", List.of("access_token=test-token; HttpOnly")), fixture("login.json"));
            if (path.equals("/catalog-records/fetch")) return new Response(200, Map.of(), fixture("task.json"));
            if (path.equals("/catalog-records/process")) { processing = true; return new Response(200, Map.of(), fixture("task.json")); }
            if (path.equals("/tasks/search-own")) {
                searchPolls++;
                if (!processing) fetchPolls++;
                String status = failFetch && !processing ? "failed.json"
                        : stayRunning && !processing ? "running.json"
                        : (!processing && fetchPolls <= 2) ? (fetchPolls == 1 ? "queued.json" : "running.json") : "finished.json";
                assertEquals("test-token", request.headers().get("Cookie").getFirst().split("=", 2)[1]);
                return new Response(200, Map.of(), fixture(status));
            }
            if (path.endsWith("/comparisons")) return new Response(200, Map.of(), fixture(comparisonFixture));
            if (path.endsWith("/validations")) return new Response(200, Map.of(), fixture(validationFixture));
            return new Response(404, Map.of(), new byte[0]);
        }

        private byte[] fixture(String name) {
            try (var stream = getClass().getResourceAsStream("/marc-comparator/" + name)) {
                if (stream == null) throw new IllegalStateException("Missing fixture " + name);
                return stream.readAllBytes();
            } catch (IOException error) { throw new IllegalStateException(error); }
        }
    }
    private static final class AdvancingClock extends Clock {
        private long tick;
        public ZoneId getZone() { return ZoneId.of("UTC"); }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return Instant.parse("2026-01-01T00:00:00Z").plusSeconds(tick++); }
    }
}
