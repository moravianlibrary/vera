package cz.mzk.vera.plugins.material_type;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.classifier.SuggestInput;
import cz.mzk.vera.plugin.classifier.Suggestion;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.records.Request;
import java.time.Clock;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class MaterialTypeTests {
    @Test
    void mapsCaseInsensitiveTypesWithEitherArrowAndProvidesAReason() {
        PluginContext context = new TestContext(Map.of("table", "periodical→c22, map -> c4"));
        Optional<Suggestion> answer = new MaterialType().suggest(context,
                new SuggestInput(new Request("r1", "d1", null, null, null, null, null, null, null),
                        new Document("d1", null, null, "Title", "PERIODICAL", null)));

        assertTrue(answer.isPresent());
        assertEquals("c22", answer.get().category().id());
        assertEquals("Document type: PERIODICAL", answer.get().why());
    }

    @Test
    void returnsNoSuggestionForAnUnmappedType() {
        Optional<Suggestion> answer = new MaterialType().suggest(new TestContext(Map.of("table", "map→c4")),
                new SuggestInput(new Request("r1", "d1", null, null, null, null, null, null, null),
                        new Document("d1", null, null, "Title", "Periodical", null)));

        assertTrue(answer.isEmpty());
    }

    private record TestContext(Map<String, String> configuration) implements PluginContext {
        @Override
        public String instanceId() {
            return "pi31";
        }

        @Override
        public Map<String, String> secrets() {
            return Map.of();
        }

        @Override
        public cz.mzk.vera.plugin.PluginHttp http() {
            throw new AssertionError("MaterialType must not make HTTP calls");
        }

        @Override
        public System.Logger logger() {
            return System.getLogger("test");
        }

        @Override
        public Clock clock() {
            return Clock.systemUTC();
        }

        @Override
        public cz.mzk.vera.plugin.LocalPasswords localPasswords() {
            throw new AssertionError("MaterialType must not check local passwords");
        }
    }
}
