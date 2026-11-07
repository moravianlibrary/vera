package cz.mzk.vera.iterations;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;

// BK4 IterationChecks: fail clearly until the ingest checks are installed.
@AutoConfiguration
public class IterationChecksConfiguration {
    @Bean
    @ConditionalOnMissingBean(IterationChecks.class)
    IterationChecks noIterationChecks() {
        return (iteration, document, run) -> {
            throw new IllegalStateException("No checks are configured");
        };
    }

    @Bean
    @ConditionalOnMissingBean(IterationListNames.class)
    IterationListNames iterationListNames() {
        return listId -> listId;
    }
}
