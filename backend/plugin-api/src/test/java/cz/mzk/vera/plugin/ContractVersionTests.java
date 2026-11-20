package cz.mzk.vera.plugin;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import cz.mzk.vera.plugin.catalog.ChangesAnswer;
import cz.mzk.vera.plugin.catalog.SyncAnswer;
import java.util.List;
import org.junit.jupiter.api.Test;

class ContractVersionTests {
    @Test void version10CatalogAnswersStillConstruct() {
        ChangesAnswer changes = new ChangesAnswer(List.of("catalog-1"), null);
        SyncAnswer sync = new SyncAnswer(List.of(), List.of(), null, false);
        assertEquals(List.of(), changes.replaced());
        assertEquals(List.of(), sync.replaced());
    }

    @Test void acceptsCompatibleContractVersions() {
        assertTrue(ContractVersion.accepts("1.0"));
        assertTrue(ContractVersion.accepts("1.1"));
        assertTrue(ContractVersion.accepts("1.2"));
        assertTrue(ContractVersion.accepts("1.0.3"));
        assertTrue(ContractVersion.accepts("1.3"));
        assertFalse(ContractVersion.accepts("1.4"));
        assertFalse(ContractVersion.accepts("2.0"));
    }
}
