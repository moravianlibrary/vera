package cz.mzk.vera.testing.events;

import static cz.mzk.vera.db.tables.Tables.AUDIT_OUTBOX;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.HOOK_EVENTS;
import static cz.mzk.vera.db.tables.Tables.OUTBOX;
import static cz.mzk.vera.db.tables.Tables.RUNS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.db.tables.tables.records.EventsRecord;
import cz.mzk.vera.db.tables.tables.records.HookEventsRecord;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.events.HookPayloads;
import cz.mzk.vera.events.Outbox;
import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.time.Clock;
import java.time.Instant;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

// EVENT-shape; EVENT-destinations; EVENT-derived; OBS-audit-delivery; LOG-one-act-one-story.
@SpringBootTest(classes = VeraTestingApplication.class)
@ActiveProfiles("test")
@Testcontainers
class EventRecorderTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private TemplateResetService resetService;

    @Autowired
    private EventRecorder recorder;

    @Autowired
    private HookPayloads payloads;

    @Autowired
    private Outbox outbox;

    @Autowired
    private DSLContext dsl;

    @Autowired
    private Clock clock;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private final JsonMapper json = JsonMapper.builder().build();

    @BeforeEach
    void resetToBase() {
        resetService.reset("base", true);
        dsl.deleteFrom(EVENTS).execute();
        dsl.deleteFrom(HOOK_EVENTS).execute();
        dsl.deleteFrom(AUDIT_OUTBOX).execute();
        dsl.deleteFrom(OUTBOX).execute();
    }

    @Test
    void recordsHookableHistoryWithTheSameEventId() {
        recorder.record(new EventInput(EventCode.ITERATION_INGESTED, "iteration", "IT-test", null,
                new EventInput.System(), "correlation-hook", clock.instant(), json.createObjectNode(), null));

        EventsRecord history = dsl.selectFrom(EVENTS).fetchOne();
        HookEventsRecord hook = dsl.selectFrom(HOOK_EVENTS).fetchOne();
        assertThat(hook.getId()).isEqualTo(history.getId());
        assertThat(hook.getCode()).isEqualTo("iteration.ingested");
        assertThat(hook.getCorrelationId()).isEqualTo("correlation-hook");
        assertThat(hook.getMatchedAt()).isNull();
    }

    @Test
    void firesDerivedHookEventWithoutHistory() {
        recorder.fire(new EventInput(EventCode.LIST_STARTED, "list", "L-test", null,
                new EventInput.System(), "correlation-derived", clock.instant(), json.createObjectNode(), null));

        assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isZero();
        assertThat(dsl.selectCount().from(HOOK_EVENTS).fetchOne(0, int.class)).isEqualTo(1);
        assertThat(dsl.selectFrom(HOOK_EVENTS).fetchOne().getCode()).isEqualTo("list.started");
    }

    @Test
    void buildsAndValidatesIterationListAndRunPayloadsWithBothPrivacySettings() {
        recorder.record(new EventInput(EventCode.ITERATION_INGESTED, "iteration", "IT1", null,
                new EventInput.System(), "C-hook-iteration", clock.instant(), json.createObjectNode(),
                new EventInput.Reason(null, "private note")));
        recorder.fire(new EventInput(EventCode.LIST_STARTED, "list", "L-2026-015", null,
                new EventInput.System(), "C-hook-list", clock.instant(), json.createObjectNode(), null));
        dsl.insertInto(RUNS).set(RUNS.ID, "T-hook-payload").set(RUNS.WHAT, "Catalog sync")
                .set(RUNS.CORE_NAME, "Catalog sync").set(RUNS.TRIGGER, JSONB.valueOf("{\"kind\":\"manual\"}"))
                .set(RUNS.STARTED_BY, "u3").set(RUNS.STATE, "Done")
                .set(RUNS.STARTED_AT, clock.instant().atOffset(java.time.ZoneOffset.UTC))
                .set(RUNS.FINISHED_AT, clock.instant().atOffset(java.time.ZoneOffset.UTC))
                .set(RUNS.ITEM_COUNT, 1).set(RUNS.DONE_COUNT, 1).execute();
        recorder.fire(new EventInput(EventCode.RUN_FINISHED, "run", "T-hook-payload", null,
                new EventInput.System(), "C-hook-run", clock.instant(), json.createObjectNode(), null));

        String iterationId = dsl.select(HOOK_EVENTS.ID).from(HOOK_EVENTS)
                .where(HOOK_EVENTS.CODE.eq("iteration.ingested")).fetchOne(HOOK_EVENTS.ID);
        String listId = dsl.select(HOOK_EVENTS.ID).from(HOOK_EVENTS)
                .where(HOOK_EVENTS.CODE.eq("list.started")).fetchOne(HOOK_EVENTS.ID);
        String runId = dsl.select(HOOK_EVENTS.ID).from(HOOK_EVENTS)
                .where(HOOK_EVENTS.CODE.eq("run.finished")).fetchOne(HOOK_EVENTS.ID);
        ObjectNode publicPayload = payloads.build("H-test", "Test", "D-public", 1,
                java.util.List.of(iterationId, listId, runId), false);
        payloads.validate(publicPayload);
        JsonNode iterationEvent = null;
        JsonNode listEvent = null;
        JsonNode runEvent = null;
        for (JsonNode event : publicPayload.path("events")) {
            switch (event.path("type").asString()) {
                case "iteration.ingested" -> iterationEvent = event;
                case "list.started" -> listEvent = event;
                case "run.finished" -> runEvent = event;
                default -> throw new IllegalStateException("Unexpected hook event");
            }
        }
        assertThat(iterationEvent.path("document").path("iteration").isObject()).isTrue();
        assertThat(listEvent.path("documents").size()).isPositive();
        assertThat(runEvent.path("run").path("instance").isObject()).isTrue();
        assertThat(iterationEvent.path("cause").path("reason").has("internal")).isFalse();

        ObjectNode privatePayload = payloads.build("H-test", "Test", "D-private", 1,
                java.util.List.of(iterationId), true);
        payloads.validate(privatePayload);
        assertThat(privatePayload.path("events").get(0).path("cause").path("reason")
                .path("internal").asString()).isEqualTo("private note");
    }

    @Test
    void recordsHistoryWithTheGivenActorCorrelationAndClockTime() {
        Instant at = clock.instant();
        recorder.record(new EventInput(
                EventCode.REQUEST_WITHDRAWN,
                "request",
                "request-test",
                null,
                new EventInput.User("u3"),
                "correlation-history",
                null,
                json.createObjectNode(),
                null));

        var row = dsl.selectFrom(EVENTS).fetchOne();
        assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isEqualTo(1);
        assertThat(row.getCorrelationId()).isEqualTo("correlation-history");
        assertThat(row.getAt().toInstant()).isEqualTo(at);
        assertThat(read(row.getActor().data())).isEqualTo(json.createObjectNode()
                .put("kind", "user")
                .put("userId", "u3"));
    }

    @Test
    void rejectsInvalidHistoryPayloadWithoutWriting() {
        assertThatThrownBy(() -> recorder.record(new EventInput(
                EventCode.REQUEST_CREATED,
                "request",
                "request-test",
                null,
                new EventInput.System(),
                "correlation-invalid",
                null,
                json.createObjectNode(),
                null)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isZero();
        assertThat(dsl.selectCount().from(AUDIT_OUTBOX).fetchOne(0, int.class)).isZero();
    }

    @Test
    void recordsAdminAuditActorAndSubjectNamesWithoutHistory() {
        recorder.record(userSuspended("u3", new EventInput.User("u3"), "correlation-admin"));

        assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isZero();
        assertThat(dsl.selectCount().from(AUDIT_OUTBOX).fetchOne(0, int.class)).isEqualTo(1);
        JsonNode record = read(dsl.selectFrom(AUDIT_OUTBOX).fetchOne().getRecord().data());
        assertThat(record.path("actor")).isEqualTo(json.createObjectNode()
                .put("kind", "user")
                .put("userId", "u3")
                .put("name", "Petr Dvořák"));
        assertThat(record.path("subject").path("name").asString()).isEqualTo("Petr Dvořák");
    }

    @Test
    void recordsReaderActorAndOmitsReaderSubjectName() {
        recorder.record(userSuspended("u6", new EventInput.User("u6"), "correlation-reader"));

        JsonNode record = read(dsl.selectFrom(AUDIT_OUTBOX).fetchOne().getRecord().data());
        assertThat(record.path("actor")).isEqualTo(json.createObjectNode().put("kind", "reader"));
        assertThat(record.path("subject").path("name").isNull()).isTrue();
    }

    @Test
    void recordsUndisclosedAndSystemAuditActors() {
        recorder.record(userSuspended("u3", new EventInput.Undisclosed(), "correlation-undisclosed"));
        recorder.record(userSuspended("u3", new EventInput.System(), "correlation-system"));

        var records = dsl.selectFrom(AUDIT_OUTBOX).orderBy(AUDIT_OUTBOX.ID).fetch();
        assertThat(read(records.get(0).getRecord().data()).path("actor"))
                .isEqualTo(json.createObjectNode().put("kind", "reader"));
        assertThat(read(records.get(1).getRecord().data()).path("actor"))
                .isEqualTo(json.createObjectNode().put("kind", "system"));
    }

    @Test
    void rejectsAnAuditActorWhoseUserDoesNotExist() {
        assertThatThrownBy(() -> recorder.record(userSuspended(
                "u3", new EventInput.User("missing-user"), "correlation-missing")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Cannot record audit actor: no user missing-user");
        assertThat(dsl.selectCount().from(AUDIT_OUTBOX).fetchOne(0, int.class)).isZero();
    }

    @Test
    void rejectsDerivedUnrecordableAndMismatchedSubjectCodes() {
        assertRejected(EventCode.LIST_STARTED, "list");
        assertRejected(EventCode.RUN_FINISHED, "run");
        assertRejected(EventCode.REQUEST_WITHDRAWN, "list");
    }

    @Test
    void rollsBackHistoryAuditAndOutboxWithTheActTransaction() {
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);
        assertThatThrownBy(() -> transaction.executeWithoutResult(status -> {
            recorder.record(new EventInput(
                    EventCode.REQUEST_WITHDRAWN,
                    "request",
                    "request-test",
                    null,
                    new EventInput.System(),
                    "correlation-rollback-history",
                    null,
                    json.createObjectNode(),
                    null));
            recorder.record(userSuspended("u3", new EventInput.System(), "correlation-rollback-audit"));
            outbox.send("mail", "u3@example.test", json.createObjectNode().put("subject", "Reset"));
            throw new IllegalStateException("rollback");
        })).isInstanceOf(IllegalStateException.class).hasMessage("rollback");

        assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isZero();
        assertThat(dsl.selectCount().from(AUDIT_OUTBOX).fetchOne(0, int.class)).isZero();
        assertThat(dsl.selectCount().from(OUTBOX).fetchOne(0, int.class)).isZero();
    }

    private void assertRejected(EventCode code, String subjectKind) {
        assertThatThrownBy(() -> recorder.record(new EventInput(
                code,
                subjectKind,
                "subject-test",
                null,
                new EventInput.System(),
                "correlation-refused",
                null,
                json.createObjectNode(),
                null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private EventInput userSuspended(String userId, EventInput.Actor actor, String correlationId) {
        ObjectNode data = json.createObjectNode();
        data.putArray("changes");
        return new EventInput(
                EventCode.USER_SUSPENDED,
                "user",
                userId,
                null,
                actor,
                correlationId,
                null,
                data,
                null);
    }

    private JsonNode read(String value) {
        return json.readTree(value);
    }
}
