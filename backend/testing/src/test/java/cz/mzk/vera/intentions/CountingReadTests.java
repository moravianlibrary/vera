package cz.mzk.vera.intentions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static cz.mzk.vera.db.tables.Tables.INTENTIONS;

import cz.mzk.vera.domain.intentions.Intentions;
import cz.mzk.vera.intentions.CountingReads.CountingSnapshot;
import cz.mzk.vera.intentions.CountingReads.StoredDistribution;
import cz.mzk.vera.intentions.CountingReads.StoredIntention;
import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.jooq.DSLContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

// PLAN-counting; PLAN-target; PLAN-mix-revision.
@SpringBootTest(classes = VeraTestingApplication.class)
@ActiveProfiles("test")
@Testcontainers
class CountingReadTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private CountingReads reads;
    @Autowired
    private DSLContext dsl;
    @Autowired
    private TemplateResetService reset;

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void readsTheSeedCountingCollectionsAndCountsTheProjectAndTargetIntentions() {
        CountingSnapshot data = reads.countingData();

        assertThat(data.intentions()).hasSize(19);
        assertThat(data.mixes()).hasSize(2);
        assertThat(data.rules().categories()).hasSize(11);
        assertThat(data.rules().lists()).hasSize(4);
        assertThat(data.rules().iterations()).hasSize(41);
        assertThat(data.pagesOf().apply(data.rules().iterations().stream()
                .filter(item -> item.id().equals("IT1")).findFirst().orElseThrow())).isEqualTo(2847);

        Intentions.IntentionCount projectCount = Intentions.countIntention(
                reads.intentionOf(data, "p2").rule(), data.rules());
        Intentions.IntentionCount targetCount = Intentions.countIntention(
                data.intentions().stream().filter(item -> item.rule().id().equals("i3"))
                        .findFirst().orElseThrow().rule(), data.rules());
        // These are countIntention's answers over the base mock seed, read from TypeScript for BK5c2.
        assertThat(projectCount.plannedPages()).isZero();
        assertThat(projectCount.deliveredPages()).isZero();
        assertThat(targetCount.plannedPages()).isEqualTo(4280);
        assertThat(targetCount.deliveredPages()).isZero();
        assertThat(targetCount.planned()).containsExactly("IT2", "IT5", "IT22", "IT24", "IT25");
    }

    @Test
    void readsTheOverallIntentionAndThePinnedMixRevision() {
        reset.reset("bk5c-mix-revisions", true);
        // The seed has no pinned intention; pin the seeded i6 row to d1's earlier stored revision.
        dsl.update(INTENTIONS).set(INTENTIONS.MIX_REVISION, 4).where(INTENTIONS.ID.eq("i6")).execute();
        CountingSnapshot data = reads.countingData();

        assertThat(reads.overallIntention(data).rule().id()).isEqualTo("i4");
        StoredIntention pinned = data.intentions().stream()
                .filter(item -> item.rule().id().equals("i6")).findFirst().orElseThrow();
        assertThat(pinned.mixRevision()).isEqualTo(4);
        StoredDistribution distribution = reads.distributionOf(data, pinned);

        assertThat(distribution.id()).isEqualTo("d1");
        assertThat(distribution.revision()).isEqualTo(4);
        assertThat(distribution.countingShares().shares())
                .containsEntry("c1", 30.0).containsEntry("c2", 45.0);
    }

    @Test
    void refusesAProjectWithoutAnIntention() {
        CountingSnapshot data = reads.countingData();

        assertThatThrownBy(() -> reads.intentionOf(data, "missing"))
                .isInstanceOf(IllegalStateException.class).hasMessage("Project missing has no intention");
    }

    @Test
    void countsOnlyIterationsMeetingStoredAttemptPropertyConditions() {
        reset.reset("bk5c2-scope-condition", true);
        CountingSnapshot data = reads.countingData();
        StoredIntention intention = data.intentions().stream()
                .filter(item -> item.rule().id().equals("i-scope-test")).findFirst().orElseThrow();

        Intentions.IntentionCount counted = Intentions.countIntention(intention.rule(), data.rules());

        assertThat(counted.planned()).containsExactly("IT5");
        assertThat(counted.plannedPages()).isEqualTo(780);
    }

}
