package cz.mzk.vera.plugins.jq_custody;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import cz.mzk.vera.plugin.LocalPasswords;
import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.custody.PlaceAnswer;
import cz.mzk.vera.plugin.custody.PlaceInput;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.records.Request;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;

class JqCustodyTests {
    private static final Request REQUEST = new Request("r1", "d1", "u1", Instant.parse("2026-01-01T00:00:00Z"),
            "reason", "b1", "p3", "Moravica", null, "Pending");
    private static final Document DOCUMENT = new Document("d1", "MZK01-001", null,
            "A title", "Periodical", null);

    @Test
    void trueConditionAnswersThePickedCustody() {
        PlaceAnswer answer = evaluate(".document.type == \"Periodical\"", "pc1");

        assertEquals(java.util.List.of("pc1"), answer.custodies());
    }

    @Test
    void falseConditionAnswersNoCustody() {
        PlaceAnswer answer = evaluate(".document.type == \"Map\"", "pc1");

        assertEquals(java.util.List.of(), answer.custodies());
    }

    @Test
    void projectNameIsAvailableAsProjectAndRecordIsNull() {
        PlaceAnswer project = evaluate(".request.project == \"Moravica\"", "pc3");
        PlaceAnswer record = evaluate(".record == null", "pc1");

        assertEquals(java.util.List.of("pc3"), project.custodies());
        assertEquals(java.util.List.of("pc1"), record.custodies());
    }

    @Test
    void missingPickedCustodyNeverPlaces() {
        PlaceAnswer answer = evaluate("true", null);

        assertEquals(java.util.List.of(), answer.custodies());
    }

    @Test
    void invalidExpressionFailsTheCall() {
        assertThrows(IllegalArgumentException.class, () ->
                evaluate(".document.type ==", "pc1"));
    }

    private PlaceAnswer evaluate(String expression, String custodyId) {
        return new JqCustody().place(new TestContext(Map.of("expr", expression)),
                new PlaceInput(REQUEST, DOCUMENT, custodyId));
    }

    private record TestContext(Map<String, String> configuration) implements PluginContext {
        @Override
        public String instanceId() { return "pi25"; }
        @Override
        public Map<String, String> secrets() { return Map.of(); }
        @Override
        public PluginHttp http() { throw new AssertionError("JqCustody must not make HTTP calls"); }
        @Override
        public System.Logger logger() { return System.getLogger("test"); }
        @Override
        public Clock clock() { return Clock.systemUTC(); }
        @Override
        public LocalPasswords localPasswords() { throw new AssertionError("JqCustody must not check passwords"); }
    }
}
