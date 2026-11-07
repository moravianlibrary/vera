package cz.mzk.vera.testing.seeds;

import static cz.mzk.vera.db.tables.Tables.DIGITIZATION_LISTS;
import static cz.mzk.vera.db.tables.Tables.INTENTIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.MIXES;
import static cz.mzk.vera.db.tables.Tables.MIX_REVISIONS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cz.mzk.vera.testing.VeraTestingApplication;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.ObjectMapper;

// LC-LIST-state; PLAN-intention; PLAN-mix-revision; B8.
@SpringBootTest(classes = VeraTestingApplication.class)
@ActiveProfiles("test")
@Testcontainers
class PlanningSeedTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private DSLContext dsl;
    @Autowired
    private TemplateResetService reset;
    @Autowired
    private ObjectMapper mapper;

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void loadsBasePlanningRowsInSeedOrderAndReadsTheirFields() throws Exception {
        assertThat(dsl.selectCount().from(DIGITIZATION_LISTS).fetchOne(0, int.class)).isEqualTo(4);
        assertThat(dsl.selectCount().from(INTENTIONS).fetchOne(0, int.class)).isEqualTo(19);
        assertThat(dsl.selectCount().from(MIXES).fetchOne(0, int.class)).isEqualTo(2);

        var list = dsl.selectFrom(DIGITIZATION_LISTS)
                .where(DIGITIZATION_LISTS.ID.eq("L-2026-015")).fetchOne();
        assertThat(list.getName()).isEqualTo("Regional weeklies");
        assertThat(list.getStartsOn().toString()).isEqualTo("2026-10-05");
        assertThat(list.getEndsOn().toString()).isEqualTo("2026-10-23");
        assertThat(list.getTargetPages()).isEqualTo(4000);
        assertThat(mapper.readTree(list.getGenerated().data())).isEqualTo(mapper.readTree(
                "{\"intentionId\":\"i3\",\"mixRevision\":2,\"pages\":4000," +
                        "\"allocation\":null,\"generator\":\"PriorityThenMix 1.2.0\"," +
                        "\"at\":\"2026-06-22T09:00:00Z\"}"));
        assertThat(list.getCreatedBy()).isEqualTo("u2");
        assertThat(list.getCreatedAt().toInstant().toString()).isEqualTo("2026-06-22T09:00:00Z");
        assertThat(list.getDoneActorId()).isNull();
        assertThat(list.getDoneAt()).isNull();
        assertThat(list.getPosition()).isEqualTo(1);

        var intention = dsl.selectFrom(INTENTIONS).where(INTENTIONS.ID.eq("i2")).fetchOne();
        assertThat(intention.getName()).isEqualTo("VISK 7 / 2026");
        assertThat(intention.getDescription()).isEqualTo("Clearing the approved backlog the VISK 7 grant pays for.");
        assertThat(intention.getFundingKind()).isEqualTo("project");
        assertThat(intention.getFundingProjectId()).isEqualTo("p2");
        assertThat(intention.getProjectId()).isEqualTo("p2");
        assertThat(intention.getScopeCategoryId()).isNull();
        assertThat(intention.getScopeConditions()).isNull();
        assertThat(intention.getDistributionId()).isNull();
        assertThat(intention.getMixRevision()).isNull();
        assertThat(intention.getTargetPages()).isEqualTo(3000);
        assertThat(intention.getCountsFrom().toString()).isEqualTo("2026-01-01");
        assertThat(intention.getEndsOn().toString()).isEqualTo("2026-12-31");
        assertThat(intention.getIsOverall()).isFalse();
        assertThat(intention.getTemplateId()).isNull();
        assertThat(intention.getArchivedAt()).isNull();
        assertThat(intention.getArchivedActorKind()).isNull();
        assertThat(intention.getArchivedActorUserId()).isNull();
        assertThat(intention.getPosition()).isEqualTo(10);

        var mix = dsl.selectFrom(MIXES).where(MIXES.ID.eq("d1")).fetchOne();
        assertThat(mix.getName()).isEqualTo("House mix");
        assertThat(mix.getIsPrimary()).isTrue();
        assertThat(mix.getArchivedAt()).isNull();
        assertThat(mapper.readTree(mix.getShares().data())).isEqualTo(mapper.readTree(
                "{\"c1\":35,\"c2\":45,\"c3\":15,\"c4\":5,\"c11\":40,\"c12\":60," +
                        "\"c21\":30,\"c22\":50,\"c23\":20,\"c31\":60,\"c32\":40}"));
        assertThat(mix.getRevision()).isEqualTo(4);
        assertThat(mix.getPosition()).isEqualTo(0);

        var revision = dsl.selectFrom(MIX_REVISIONS)
                .where(MIX_REVISIONS.MIX_ID.eq("d1").and(MIX_REVISIONS.REVISION.eq(4))).fetchOne();
        assertThat(mapper.readTree(revision.getShares().data())).isEqualTo(mapper.readTree(
                "{\"c1\":35,\"c2\":45,\"c3\":15,\"c4\":5,\"c11\":40,\"c12\":60," +
                        "\"c21\":30,\"c22\":50,\"c23\":20,\"c31\":60,\"c32\":40}"));
        assertThat(revision.getAt().toInstant().toString()).isEqualTo("2026-06-25T10:40:00Z");
        assertThat(revision.getLabel()).isNull();
        assertThat(revision.getPosition()).isZero();
        assertThat(dsl.select(ITERATIONS.LIST_ID).from(ITERATIONS)
                .where(ITERATIONS.ID.eq("IT1")).fetchOne(0, String.class)).isEqualTo("L-2026-012");
    }

    @Test
    void loadsBothRevisionsFromThePlanningSeedPatch() throws Exception {
        reset.reset("bk5c-mix-revisions", true);

        var revisions = dsl.selectFrom(MIX_REVISIONS).where(MIX_REVISIONS.MIX_ID.eq("d1"))
                .orderBy(MIX_REVISIONS.POSITION).fetch();
        assertThat(revisions).hasSize(2);
        assertThat(revisions.get(0).getRevision()).isEqualTo(4);
        assertThat(mapper.readTree(revisions.get(0).getShares().data())).isEqualTo(mapper.readTree(
                "{\"c1\":30,\"c2\":45,\"c3\":20,\"c4\":5}"));
        assertThat(revisions.get(0).getAt().toInstant().toString()).isEqualTo("2026-05-25T10:40:00Z");
        assertThat(revisions.get(0).getLabel()).isEqualTo("Earlier balance");
        assertThat(revisions.get(0).getPosition()).isZero();
        assertThat(revisions.get(1).getRevision()).isEqualTo(5);
        assertThat(mapper.readTree(revisions.get(1).getShares().data())).isEqualTo(mapper.readTree(
                "{\"c1\":35,\"c2\":45,\"c3\":15,\"c4\":5}"));
        assertThat(revisions.get(1).getAt().toInstant().toString()).isEqualTo("2026-06-25T10:40:00Z");
        assertThat(revisions.get(1).getLabel()).isNull();
        assertThat(revisions.get(1).getPosition()).isEqualTo(1);
    }

    @Test
    void refusesAnIterationWhoseSeededListIsMissing() {
        assertThatThrownBy(() -> reset.reset("bk5c-missing-list", true))
                .satisfies(exception -> assertThat(exception).hasStackTraceContaining("iterations_list_fk"));
    }
}
