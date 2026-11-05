package cz.mzk.vera.testing.seeds;

import static cz.mzk.vera.db.tables.Tables.BATCHES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_STATES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PAGE_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_REGISTRY_RECORDS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_STATES;
import static cz.mzk.vera.db.tables.Tables.ITERATION_DEFECTS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_LINKS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.ITERATION_VERDICTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.PROJECTS;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBER_GROUPS;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.PROPERTY_DEFINITIONS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODIES;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODY_GROUPS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODY_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES;
import static cz.mzk.vera.db.tables.Tables.REQUEST_PLACEMENTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_STATES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cz.mzk.vera.documents.DocumentStates;
import cz.mzk.vera.testing.VeraTestingApplication;
import org.jooq.DSLContext;
import org.jooq.Table;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

// BK3c. Seed rows and their stored list states.
@SpringBootTest(classes = VeraTestingApplication.class)
@ActiveProfiles("test")
@Testcontainers
class RecordSeedTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private DSLContext dsl;
    @Autowired
    private TemplateResetService reset;
    @Autowired
    private DocumentStates states;

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void loadsTheExpectedRecordTableCountsAndNoPlacements() {
        assertCount(PROJECTS, 9);
        assertCount(PROPERTY_DEFINITIONS, 6);
        assertCount(REQUEST_CUSTODIES, 4);
        assertCount(BATCHES, 50);
        assertCount(DOCUMENTS, 54);
        assertCount(ITERATIONS, 41);
        assertCount(REQUESTS, 61);
        assertCount(EVENTS, 107);
        assertCount(PROJECT_MEMBERS, 15);
        assertCount(PROJECT_MEMBER_GROUPS, 2);
        assertCount(DOCUMENT_PAGE_SOURCES, 51);
        assertCount(DOCUMENT_REGISTRY_RECORDS, 51);
        assertCount(DOCUMENT_PROPERTY_SOURCES, 172);
        assertCount(ITERATION_DEFECTS, 14);
        assertCount(ITERATION_VERDICTS, 3);
        assertCount(ITERATION_LINKS, 12);
        assertCount(ITERATION_PROPERTY_SOURCES, 5);
        assertCount(REQUEST_CUSTODY_MEMBERS, 4);
        assertCount(REQUEST_CUSTODY_GROUPS, 2);
        assertCount(REQUEST_EXISTING_COPIES, 7);
        assertCount(DOCUMENT_STATES, 54);
        assertCount(ITERATION_STATES, 41);
        assertCount(REQUEST_STATES, 61);
        assertCount(REQUEST_PLACEMENTS, 0);
    }

    @Test
    void storesD1DocumentState() {
        var document = dsl.selectFrom(DOCUMENT_STATES)
                .where(DOCUMENT_STATES.DOCUMENT_ID.eq("D1"))
                .fetchOne();
        assertThat(document.getCurrentIterationId()).isEqualTo("IT1");
        assertThat(document.getProjectId()).isEqualTo("p1");
        assertThat(document.getPageCount()).isEqualTo(2847);
        assertThat(document.getExistingCopyState()).isEqualTo("Published");
    }

    @Test
    void storesNeededValidationForIT1() {
        var needed = dsl.selectFrom(ITERATION_STATES)
                .where(ITERATION_STATES.ITERATION_ID.eq("IT1"))
                .fetchOne();
        assertThat(needed.getValidation()).isEqualTo("Needed");
    }

    @Test
    void storesRestrictionForIT6() {
        var restricted = dsl.selectFrom(ITERATION_STATES)
                .where(ITERATION_STATES.ITERATION_ID.eq("IT6"))
                .fetchOne();
        assertThat(restricted.getIsRestricted()).isTrue();
    }

    @Test
    void storesR1PublicStatus() {
        var request = dsl.selectFrom(REQUEST_STATES)
                .where(REQUEST_STATES.REQUEST_ID.eq("R1"))
                .fetchOne();
        assertThat(request.getPublicStatus()).isEqualTo("Available");
    }

    @Test
    void earlierAttemptR0IsNotAnAsker() {
        var priorAttempt = dsl.selectFrom(REQUEST_STATES)
                .where(REQUEST_STATES.REQUEST_ID.eq("R0"))
                .fetchOne();
        assertThat(priorAttempt.getIsAsker()).isFalse();
    }

    @Test
    void recomputingTwiceLeavesTheSameStoredRows() {
        var documentBefore = dsl.selectFrom(DOCUMENT_STATES)
                .where(DOCUMENT_STATES.DOCUMENT_ID.eq("D1")).fetchOne();
        var iterationsBefore = dsl.selectFrom(ITERATION_STATES)
                .where(ITERATION_STATES.DOCUMENT_ID.eq("D1")).fetch();
        var requestsBefore = dsl.selectFrom(REQUEST_STATES)
                .where(REQUEST_STATES.DOCUMENT_ID.eq("D1")).fetch();

        states.recompute(dsl, "D1");
        states.recompute(dsl, "D1");

        assertThat(dsl.selectFrom(DOCUMENT_STATES)
                .where(DOCUMENT_STATES.DOCUMENT_ID.eq("D1")).fetchOne()).isEqualTo(documentBefore);
        assertThat(dsl.selectFrom(ITERATION_STATES)
                .where(ITERATION_STATES.DOCUMENT_ID.eq("D1")).fetch()).containsExactlyElementsOf(iterationsBefore);
        assertThat(dsl.selectFrom(REQUEST_STATES)
                .where(REQUEST_STATES.DOCUMENT_ID.eq("D1")).fetch()).containsExactlyElementsOf(requestsBefore);
    }

    @Test
    void approvedRequestCannotHaveOnlyAnIterationId() {
        assertThatThrownBy(() -> dsl.insertInto(REQUESTS)
                .set(REQUESTS.ID, "constraint-check")
                .set(REQUESTS.DOCUMENT_ID, "D1")
                .set(REQUESTS.REQUESTER_ID, "u1")
                .set(REQUESTS.AT, dsl.select(REQUESTS.AT).from(REQUESTS).where(REQUESTS.ID.eq("R1"))
                        .fetchOne(REQUESTS.AT))
                .set(REQUESTS.BATCH_ID, "B-0009")
                .set(REQUESTS.DECISION, "Approved")
                .set(REQUESTS.ITERATION_ID, "IT1")
                .execute())
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private void assertCount(Table<?> table, int expected) {
        assertThat(dsl.selectCount().from(table).fetchOne(0, int.class)).isEqualTo(expected);
    }
}
