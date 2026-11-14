package cz.mzk.vera.plugins.entry_link;

import static org.junit.jupiter.api.Assertions.assertEquals;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.input.EntryLinkInput.CatalogId;
import cz.mzk.vera.plugin.input.EntryLinkInput.EntryAnswer;
import cz.mzk.vera.plugin.input.EntryLinkInput.EntryInput;
import cz.mzk.vera.plugin.input.EntryLinkInput.Identifier;
import java.time.Clock;
import java.util.Map;
import org.junit.jupiter.api.Test;

class EntryLinkTests {
    @Test
    void readsVeraParametersAndTheConfiguredRecordParameter() {
        EntryLink plugin = new EntryLink();
        TestContext context = new TestContext(Map.of("record_parameter", "sysno"));

        EntryAnswer custom = plugin.entry(context,
                new EntryInput(Map.of("sysno", "MZK-123", "unit", "volume 2", "reason", "Research"),
                        "https://portal.example/path"));
        EntryAnswer vera = plugin.entry(new TestContext(Map.of()),
                new EntryInput(Map.of("record", "MZK-456", "unit", "volume 3"), null));

        assertEquals(new CatalogId("MZK-123"), custom.item());
        assertEquals("volume 2", custom.unit());
        assertEquals("Research", custom.reason());
        assertEquals("https://portal.example", custom.origin());
        assertEquals(new CatalogId("MZK-456"), vera.item());
    }

    @Test
    void readsVeraIdentifiersAndReturnsNoOriginForAnInvalidPage() {
        EntryAnswer answer = new EntryLink().entry(new TestContext(Map.of()),
                new EntryInput(Map.of("identifier", "12345", "type", "sysno", "reason", "r".repeat(501)),
                        "not a uri"));

        assertEquals(new Identifier("sysno", "12345"), answer.item());
        assertEquals(null, answer.origin());
        assertEquals(500, answer.reason().length());
    }

    private record TestContext(Map<String, String> configuration) implements PluginContext {
        @Override
        public String instanceId() {
            return "pi43";
        }

        @Override
        public Map<String, String> secrets() {
            return Map.of();
        }

        @Override
        public cz.mzk.vera.plugin.PluginHttp http() {
            throw new AssertionError("EntryLink must not make HTTP calls");
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
            throw new AssertionError("EntryLink must not check local passwords");
        }
    }
}
