package cz.mzk.vera.clock;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;

// An auto-configuration, so its condition runs after the scanned beans: under the test profile
// the testing module's stored clock is the one Clock (Spring Boot leaves it out of the scan).
@AutoConfiguration
public class SystemClockConfiguration {
    @Bean
    @ConditionalOnMissingBean(Clock.class)
    Clock veraClock() {
        return Clock.system(ZoneId.of("Europe/Prague"));
    }
}
