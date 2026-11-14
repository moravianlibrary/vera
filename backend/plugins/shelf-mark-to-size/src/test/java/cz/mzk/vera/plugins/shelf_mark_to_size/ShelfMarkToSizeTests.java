package cz.mzk.vera.plugins.shelf_mark_to_size;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.propertysource.ValuesAnswer;
import cz.mzk.vera.plugin.propertysource.ValuesInput;
import cz.mzk.vera.plugin.records.Document;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ShelfMarkToSizeTests {
    @Test
    void longestMatchingPrefixAnswersSizeAtTheConfiguredTier() {
        PluginContext context = new TestContext(Map.of("table", "S→A5, ST -> A4", "tier", "73"));
        ValuesAnswer answer = new ShelfMarkToSize().values(context,
                new ValuesInput(new Document("d1", null, null, "Title", "Book", "ST1-0032"), null));

        assertEquals(List.of(new ValuesAnswer.PropertyValue("size", "A4", 73)), answer.values());
    }

    @Test
    void defaultsTierAndReturnsNothingWithoutAMatchingPrefix() {
        ShelfMarkToSize plugin = new ShelfMarkToSize();
        ValuesAnswer matched = plugin.values(new TestContext(Map.of("table", "ST→A4")),
                new ValuesInput(new Document("d1", null, null, "Title", "Book", "ST1-0032"), null));
        ValuesAnswer unmatched = plugin.values(new TestContext(Map.of("table", "MAP→A3")),
                new ValuesInput(new Document("d1", null, null, "Title", "Book", "ST1-0032"), null));

        assertEquals(50, matched.values().getFirst().tier());
        assertTrue(unmatched.values().isEmpty());
    }

    private record TestContext(Map<String, String> configuration) implements PluginContext {
        @Override
        public String instanceId() {
            return "pi48";
        }

        @Override
        public Map<String, String> secrets() {
            return Map.of();
        }

        @Override
        public cz.mzk.vera.plugin.PluginHttp http() {
            throw new AssertionError("ShelfMarkToSize must not make HTTP calls");
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
            throw new AssertionError("ShelfMarkToSize must not check local passwords");
        }
    }
}
