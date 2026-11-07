package cz.mzk.vera.jobs;

import static cz.mzk.vera.db.tables.Tables.JOBS;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

// B5. A lease makes abandoned work claimable; plugin calls never hold a database transaction.
@Service
public class JobRunner {
    private static final int MAX_RUNS_AT_ONCE = 10_000;
    private static final Duration LEASE = Duration.ofMinutes(5);

    private final DSLContext dsl;
    private final Clock clock;
    private final JsonMapper json;
    private final Map<String, JobKind<?>> kinds;
    private final String claimedBy = UUID.randomUUID().toString();

    public JobRunner(DSLContext dsl, Clock clock, JsonMapper json, List<JobKind<?>> kinds) {
        this.dsl = dsl;
        this.clock = clock;
        this.json = json;
        this.kinds = new HashMap<>();
        for (JobKind<?> kind : kinds) {
            this.kinds.put(kind.name(), kind);
        }
    }

    public RunReport runDue() {
        int ran = 0;
        int failed = 0;
        for (int count = 0; count < MAX_RUNS_AT_ONCE; count++) {
            Job job = claim();
            if (job == null) {
                return new RunReport(ran, failed);
            }
            try {
                JobKind<?> kind = kinds.get(job.kind());
                if (kind == null) {
                    throw new IllegalStateException("No handler for jobs of kind " + job.kind());
                }
                runOne(kind, job);
                ran++;
            } catch (Exception exception) {
                markFailed(job.id(), messageOf(exception));
                failed++;
            }
        }
        throw new IllegalStateException("More than " + MAX_RUNS_AT_ONCE + " jobs were due at once");
    }

    private <T> void runOne(JobKind<T> kind, Job job) throws Exception {
        T found = kind.call(job);
        dsl.transaction(configuration -> {
            kind.apply(DSL.using(configuration), job, found);
            DSL.using(configuration).update(JOBS)
                    .set(JOBS.STATE, "done")
                    .set(JOBS.RAN_AT, clock.instant().atOffset(ZoneOffset.UTC))
                    .set(JOBS.LEASE_UNTIL, (OffsetDateTime) null)
                    .set(JOBS.CLAIMED_BY, (String) null)
                    .set(JOBS.ERROR, (String) null)
                    .where(JOBS.ID.eq(job.id()))
                    .execute();
        });
    }

    private Job claim() {
        Instant now = clock.instant();
        return dsl.transactionResult(configuration -> {
            DSLContext tx = DSL.using(configuration);
            var row = tx.selectFrom(JOBS)
                    .where(JOBS.DUE_AT.le(now.atOffset(ZoneOffset.UTC)))
                    .and(JOBS.STATE.eq("due").or(JOBS.STATE.eq("running")
                            .and(JOBS.LEASE_UNTIL.le(now.atOffset(ZoneOffset.UTC)))))
                    .orderBy(JOBS.DUE_AT, JOBS.ID)
                    .limit(1)
                    .forUpdate()
                    .skipLocked()
                    .fetchOne();
            if (row == null) {
                return null;
            }
            tx.update(JOBS)
                    .set(JOBS.STATE, "running")
                    .set(JOBS.ATTEMPT, row.getAttempt() + 1)
                    .set(JOBS.LEASE_UNTIL, now.plus(LEASE).atOffset(ZoneOffset.UTC))
                    .set(JOBS.CLAIMED_BY, claimedBy)
                    .where(JOBS.ID.eq(row.getId()))
                    .execute();
            return new Job(row.getId(), row.getKind(), row.getDueAt().toInstant(),
                    json.readTree(row.getPayload().data()), row.getAttempt() + 1, row.getTraceParent());
        });
    }

    private void markFailed(long id, String error) {
        dsl.update(JOBS)
                .set(JOBS.STATE, "failed")
                .set(JOBS.RAN_AT, clock.instant().atOffset(ZoneOffset.UTC))
                .set(JOBS.LEASE_UNTIL, (OffsetDateTime) null)
                .set(JOBS.CLAIMED_BY, (String) null)
                .set(JOBS.ERROR, error)
                .where(JOBS.ID.eq(id))
                .execute();
    }

    private String messageOf(Exception exception) {
        return exception.getMessage() == null ? exception.toString() : exception.getMessage();
    }

    public record RunReport(int ran, int failed) { }
}
