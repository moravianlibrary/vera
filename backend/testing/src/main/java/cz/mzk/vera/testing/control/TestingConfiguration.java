package cz.mzk.vera.testing.control;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@Profile("test")
public class TestingConfiguration {
    @Bean
    StoredClock testClock(JdbcTemplate jdbc) {
        return new StoredClock(jdbc);
    }
}
