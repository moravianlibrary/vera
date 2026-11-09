package cz.mzk.vera.intentions;

import cz.mzk.vera.jobs.Jobs;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;

// LC-INT-repeat; B5: queue a repeat at midnight on its stored next_on date.
@Component
public class RepeatQueue {
    private final Jobs jobs;
    private final Clock clock;

    public RepeatQueue(Jobs jobs, Clock clock) {
        this.jobs = jobs;
        this.clock = clock;
    }

    public long queue(DSLContext dsl, String id, LocalDate nextOn) {
        return jobs.enqueue(dsl, "intention.repeat", nextOn.atStartOfDay(clock.getZone()).toInstant(),
                Map.of("repeatId", id, "nextOn", nextOn.toString()));
    }
}
