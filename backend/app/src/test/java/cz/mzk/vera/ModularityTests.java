package cz.mzk.vera;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ModularityTests {
    // Guards feature boundaries, calls through feature commands or queries, and the absence of cycles.
    @Test
    void verifiesModuleBoundaries() {
        ApplicationModules.of(VeraApplication.class).verify();
    }
}
