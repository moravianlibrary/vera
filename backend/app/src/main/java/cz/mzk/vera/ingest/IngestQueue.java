package cz.mzk.vera.ingest;

import cz.mzk.vera.jobs.Jobs;
import java.time.Clock;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;

// B5; LC-ITER-ingest: queue the current attempt in its creating transaction.
@Component
public class IngestQueue {
    private final Jobs jobs;
    private final Clock clock;

    public IngestQueue(Jobs jobs, Clock clock) {
        this.jobs = jobs;
        this.clock = clock;
    }

    public long queue(DSLContext dsl, String iterationId) {
        return jobs.enqueue(dsl, "ingest", clock.instant(), new Payload(iterationId));
    }

    public record Payload(String iterationId) {}
}
