package cz.mzk.vera;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class VeraApplication {
    private static final Logger LOGGER = LoggerFactory.getLogger(VeraApplication.class);

    public static void main(String[] args) {
        SpringApplication.run(VeraApplication.class, args);
    }

    // One image runs as api, worker or all; the role is only read and logged for now.
    @Bean
    ApplicationRunner logRole() {
        return args -> LOGGER.info("VERA role: {}", System.getenv().getOrDefault("VERA_ROLE", "all"));
    }
}
