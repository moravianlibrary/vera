package cz.mzk.vera.jobs;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class VeraRoleTests {
    @Test
    void migrationRoleIsRecognized() {
        assertThat(new VeraRole("migrate").value()).isEqualTo("migrate");
    }
}
