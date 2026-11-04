package cz.mzk.vera.testing.control;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import cz.mzk.vera.clock.SystemClockConfiguration;
import java.time.Clock;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;

class TestingClockConfigurationTests {
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(TestingConfiguration.class)
            .withBean(JdbcTemplate.class, () -> mock(JdbcTemplate.class))
            .withConfiguration(AutoConfigurations.of(SystemClockConfiguration.class))
            .withPropertyValues("spring.profiles.active=test");

    @Test
    void storedClockReplacesTheSystemClockUnderTestProfile() {
        contextRunner.run(context -> {
            assertThat(context.getBeansOfType(Clock.class)).hasSize(1);
            assertThat(context.getBeansOfType(Clock.class).values().iterator().next())
                    .isInstanceOf(StoredClock.class);
        });
    }
}
