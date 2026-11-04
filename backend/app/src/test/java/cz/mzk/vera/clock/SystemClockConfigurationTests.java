package cz.mzk.vera.clock;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class SystemClockConfigurationTests {
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(SystemClockConfiguration.class));

    @Test
    void providesOneSystemClockInTheLibraryZoneWithoutTesting() {
        contextRunner.run(context -> {
            assertThat(context.getBeansOfType(Clock.class)).hasSize(1);
            Clock clock = context.getBeansOfType(Clock.class).values().iterator().next();
            Instant before = Instant.now();
            Instant now = clock.instant();
            Instant after = Instant.now();

            assertThat(clock.getZone()).isEqualTo(ZoneId.of("Europe/Prague"));
            assertThat(now).isBetween(before, after);
        });
    }
}
