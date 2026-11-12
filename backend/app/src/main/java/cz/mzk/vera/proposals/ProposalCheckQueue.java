package cz.mzk.vera.proposals;

import cz.mzk.vera.jobs.Jobs;
import java.time.Clock;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;

// LC-REQ-checks-job: queue proposal checks with the creating request transaction.
@Component
public class ProposalCheckQueue {
    private final Jobs jobs;
    private final Clock clock;

    public ProposalCheckQueue(Jobs jobs, Clock clock) {
        this.jobs = jobs;
        this.clock = clock;
    }

    public long queue(DSLContext dsl, String requestId) {
        return jobs.enqueue(dsl, ProposalCheckJob.KIND, clock.instant(), new Payload(requestId));
    }

    public record Payload(String requestId) {}
}
