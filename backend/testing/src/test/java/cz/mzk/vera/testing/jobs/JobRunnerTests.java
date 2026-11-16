package cz.mzk.vera.testing.jobs;

import static cz.mzk.vera.db.tables.Tables.JOBS;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.jobs.Job;
import cz.mzk.vera.jobs.JobKind;
import cz.mzk.vera.jobs.JobRunner;
import cz.mzk.vera.jobs.Jobs;
import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.control.StoredClock;
import java.time.Duration;
import java.time.ZoneOffset;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

// B5. Claims are leased and isolated; call is outside the apply transaction.
@SpringBootTest(classes = VeraTestingApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
@Import(JobRunnerTests.ProbeConfiguration.class)
class JobRunnerTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    @Autowired
    private DSLContext dsl;
    @Autowired
    private StoredClock clock;
    @Autowired
    private Jobs jobs;
    @Autowired
    private JobRunner runner;
    @Autowired
    private ProbeKind probe;

    @BeforeEach
    void reset() {
        client.post().uri("/_engine/reset").contentType(MediaType.APPLICATION_JSON)
                .body("{\"seed\":\"base\",\"frozen\":true}").exchange().expectStatus().isOk();
        probe.reset();
    }

    @Test
    void laterJobsWaitUntilTheClockControlMovesPastThem() {
        jobs.enqueue(dsl, "probe", clock.instant().plus(Duration.ofDays(1)), null);
        assertThat(runner.runDue().ran()).isZero();
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                .body("{\"advance\":{\"days\":1}}").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.ran").isEqualTo(1).jsonPath("$.failed").isEqualTo(0);
        assertThat(probe.applied.get()).isEqualTo(1);
    }

    @Test
    void concurrentRunnersClaimDifferentJobs() throws Exception {
        probe.awaitTwoCalls = true;
        jobs.enqueue(dsl, "probe", clock.instant(), null);
        jobs.enqueue(dsl, "probe", clock.instant(), null);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(runner::runDue);
            var second = executor.submit(runner::runDue);
            assertThat(probe.twoCalls.await(10, TimeUnit.SECONDS)).isTrue();
            probe.releaseCalls.countDown();
            assertThat(first.get(10, TimeUnit.SECONDS).ran() + second.get(10, TimeUnit.SECONDS).ran())
                    .isEqualTo(2);
        }
        assertThat(probe.claimedIds).hasSize(2);
        assertThat(probe.applied.get()).isEqualTo(2);
    }

    @Test
    void reclaimsAnExpiredLeaseAndLeavesAnActiveLeaseAlone() {
        long expired = jobs.enqueue(dsl, "probe", clock.instant(), null);
        long active = jobs.enqueue(dsl, "probe", clock.instant(), null);
        dsl.update(JOBS).set(JOBS.STATE, "running")
                .set(JOBS.LEASE_UNTIL, clock.instant().minusSeconds(1).atOffset(ZoneOffset.UTC))
                .where(JOBS.ID.eq(expired)).execute();
        dsl.update(JOBS).set(JOBS.STATE, "running")
                .set(JOBS.LEASE_UNTIL, clock.instant().plusSeconds(60).atOffset(ZoneOffset.UTC))
                .where(JOBS.ID.eq(active)).execute();
        assertThat(runner.runDue().ran()).isEqualTo(1);
        assertThat(dsl.select(JOBS.STATE).from(JOBS).where(JOBS.ID.eq(expired)).fetchOne(JOBS.STATE))
                .isEqualTo("done");
        assertThat(dsl.select(JOBS.STATE).from(JOBS).where(JOBS.ID.eq(active)).fetchOne(JOBS.STATE))
                .isEqualTo("running");
    }

    @Test
    void callFailureMarksTheJobFailed() {
        probe.failCall = true;
        long id = jobs.enqueue(dsl, "probe", clock.instant(), null);
        assertThat(runner.runDue().failed()).isEqualTo(1);
        assertThat(dsl.select(JOBS.STATE, JOBS.ERROR).from(JOBS).where(JOBS.ID.eq(id)).fetchOne())
                .extracting(record -> record.get(JOBS.STATE), record -> record.get(JOBS.ERROR))
                .containsExactly("failed", "call broke");
        assertThat(probe.applied.get()).isZero();
    }

    @Test
    void applyFailureRollsBackItsWritesAndMarksTheJobFailed() {
        probe.failApply = true;
        long id = jobs.enqueue(dsl, "probe", clock.instant(), null);
        String name = dsl.select(USERS.NAME).from(USERS).where(USERS.ID.eq("u1")).fetchOne(USERS.NAME);
        assertThat(runner.runDue().failed()).isEqualTo(1);
        assertThat(dsl.select(USERS.NAME).from(USERS).where(USERS.ID.eq("u1")).fetchOne(USERS.NAME))
                .isEqualTo(name);
        assertThat(dsl.select(JOBS.ERROR).from(JOBS).where(JOBS.ID.eq(id)).fetchOne(JOBS.ERROR))
                .isEqualTo("apply broke");
    }

    @Test
    void unknownKindUsesTheBackendFailureMessage() {
        long id = jobs.enqueue(dsl, "missing", clock.instant(), null);
        assertThat(runner.runDue().failed()).isEqualTo(1);
        assertThat(dsl.select(JOBS.ERROR).from(JOBS).where(JOBS.ID.eq(id)).fetchOne(JOBS.ERROR))
                .isEqualTo("No handler for jobs of kind missing");
    }

    @Test
    void jobRunControlAnswersTheRunReport() {
        jobs.enqueue(dsl, "probe", clock.instant(), null);
        client.post().uri("/_engine/jobs/run").exchange().expectStatus().isOk()
                .expectBody().json("{\"ran\":1,\"failed\":0}");
    }

    @TestConfiguration
    static class ProbeConfiguration {
        @Bean
        ProbeKind probeKind() {
            return new ProbeKind();
        }
    }

    static final class ProbeKind implements JobKind<Void> {
        final AtomicInteger applied = new AtomicInteger();
        final Set<Long> claimedIds = ConcurrentHashMap.newKeySet();
        volatile boolean failCall;
        volatile boolean failApply;
        volatile boolean awaitTwoCalls;
        volatile CountDownLatch twoCalls = new CountDownLatch(2);
        volatile CountDownLatch releaseCalls = new CountDownLatch(1);

        @Override
        public String name() {
            return "probe";
        }

        @Override
        public Void call(Job job) throws Exception {
            claimedIds.add(job.id());
            if (awaitTwoCalls) {
                twoCalls.countDown();
                if (!releaseCalls.await(10, TimeUnit.SECONDS)) {
                    throw new IllegalStateException("Timed out waiting for the second runner");
                }
            }
            if (failCall) {
                throw new IllegalStateException("call broke");
            }
            return null;
        }

        @Override
        public void apply(DSLContext tx, Job job, Void found) {
            tx.update(USERS).set(USERS.NAME, "changed").where(USERS.ID.eq("u1")).execute();
            applied.incrementAndGet();
            if (failApply) {
                throw new IllegalStateException("apply broke");
            }
        }

        void reset() {
            applied.set(0);
            claimedIds.clear();
            failCall = false;
            failApply = false;
            awaitTwoCalls = false;
            twoCalls = new CountDownLatch(2);
            releaseCalls = new CountDownLatch(1);
        }
    }
}
