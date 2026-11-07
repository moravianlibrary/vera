package cz.mzk.vera.iterations;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

// ACT-recheck: the app without a configured check implementation fails with a useful message.
class IterationChecksConfigurationTests {
    @Test
    void defaultExplainsThatChecksAreNotConfigured() {
        IterationChecks checks = new IterationChecksConfiguration().noIterationChecks();
        assertThatThrownBy(() -> checks.run(null, null, IterationChecks.Run.RECHECK))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("No checks are configured");
    }
}
