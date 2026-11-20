package cz.mzk.vera;

import cz.mzk.vera.jobs.VeraRole;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class VeraApplication {
    private static final Logger LOGGER = LoggerFactory.getLogger(VeraApplication.class);

    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(VeraApplication.class);
        boolean migrate = "migrate".equals(System.getenv().getOrDefault("VERA_ROLE", "all"));
        // The web layer's beans are part of the context, so migrate starts it whole, on any free port.
        if (migrate) System.setProperty("server.port", "0");
        ConfigurableApplicationContext context = application.run(args);
        if (migrate) {
            // VERA_ROLE=migrate: Liquibase ran while the context started; exit without serving.
            System.exit(SpringApplication.exit(context));
        }
    }

    // One image runs as api, worker or all; workers run due jobs on the configured interval.
    @Bean
    ApplicationRunner logRole(VeraRole role) {
        return args -> LOGGER.info("VERA role: {}", role.value());
    }
}
