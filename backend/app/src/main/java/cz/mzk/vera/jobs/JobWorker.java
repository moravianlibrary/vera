package cz.mzk.vera.jobs;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// B5. Only worker and all roles poll; api processes never execute jobs.
@Component
@ConditionalOnProperty(name = "vera.jobs.poll", havingValue = "true", matchIfMissing = true)
public class JobWorker {
    private final JobRunner runner;
    private final VeraRole role;

    public JobWorker(JobRunner runner, VeraRole role) {
        this.runner = runner;
        this.role = role;
    }

    @Scheduled(fixedDelayString = "${vera.jobs.delay:1000}")
    public void runDue() {
        if ("worker".equals(role.value()) || "all".equals(role.value())) {
            runner.runDue();
        }
    }
}
