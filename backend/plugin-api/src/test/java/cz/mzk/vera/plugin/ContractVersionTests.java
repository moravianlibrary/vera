package cz.mzk.vera.plugin;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

class ContractVersionTests {
    @Test void acceptsCompatibleContractVersions() {
        assertTrue(ContractVersion.accepts("1.0"));
        assertTrue(ContractVersion.accepts("1.0.3"));
        assertFalse(ContractVersion.accepts("1.1"));
        assertFalse(ContractVersion.accepts("2.0"));
    }
}
