package cz.mzk.vera.hooks;

import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.max;
import static cz.mzk.vera.db.tables.Tables.HOOK_DELIVERIES;
import static cz.mzk.vera.db.tables.Tables.HOOK_EVENTS;
import static cz.mzk.vera.db.tables.Tables.HOOKS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;

import cz.mzk.vera.jobs.Job;
import cz.mzk.vera.jobs.JobKind;
import cz.mzk.vera.jobs.Jobs;
import cz.mzk.vera.watchlists.WatchlistQueries;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.Record;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// HOOK-events; HOOK-condition; HOOK-batch. Match work is queued by EventRecorder in its transaction.
@Component
public class HookMatchJob implements JobKind<JsonNode> {
    private final DSLContext dsl;
    private final JsonMapper json;
    private final Jobs jobs;
    private final Clock clock;
    private final WatchlistQueries watchlists;

    public HookMatchJob(DSLContext dsl, JsonMapper json, Jobs jobs, Clock clock,
            WatchlistQueries watchlists) {
        this.dsl = dsl;
        this.json = json;
        this.jobs = jobs;
        this.clock = clock;
        this.watchlists = watchlists;
    }

    @Override
    public String name() {
        return "hook.match";
    }

    @Override
    public JsonNode call(Job job) {
        return job.payload();
    }

    @Override
    public void apply(DSLContext tx, Job job, JsonNode found) {
        String eventId = found.path("eventId").asString();
        var event = tx.selectFrom(HOOK_EVENTS).where(HOOK_EVENTS.ID.eq(eventId))
                .and(HOOK_EVENTS.MATCHED_AT.isNull()).fetchOne();
        if (event == null) {
            return;
        }
        List<DeliveryDue> deliveries = new ArrayList<>();
        tx.selectFrom(HOOKS).where(HOOKS.STATE.eq("active")).orderBy(HOOKS.POSITION)
                .fetch().forEach(hook -> {
                    JsonNode events = json.readTree(hook.getEvents().data());
                    boolean takesEvent = false;
                    for (JsonNode code : events) {
                        if (event.getCode().equals(code.asString())) {
                            takesEvent = true;
                        }
                    }
                    if (!takesEvent || !conditionTakes(hook.getConditions(), event.getCode(),
                            event.getSubjectKind(), event.getSubjectId())) {
                        return;
                    }
                    Instant at = event.getOccurredAt().toInstant();
                    String recipient = hook.getRecipient();
                    if (hook.getRecipientPreference() != null) {
                        if (!"request".equals(event.getSubjectKind())) {
                            return;
                        }
                        Record requester = tx.select(USERS.EMAIL).from(REQUESTS)
                                .join(USERS).on(USERS.ID.eq(REQUESTS.REQUESTER_ID))
                                .where(REQUESTS.ID.eq(event.getSubjectId())).fetchOne();
                        if (requester == null || requester.get(USERS.EMAIL) == null) {
                            return;
                        }
                        recipient = requester.get(USERS.EMAIL);
                    }
                    JsonNode eventCodes = json.valueToTree(List.of(event.getCode()));
                    JsonNode eventIds = json.valueToTree(List.of(eventId));
                    JsonNode subjects = json.valueToTree(List.of(event.getSubjectId()));
                    String publicText = event.getCode() + ": " + event.getSubjectId();
                    JsonNode batch = hook.getBatch() == null ? null : json.readTree(hook.getBatch().data());
                    Record pending = batch == null ? null : pendingDelivery(tx, hook.getId(), recipient, batch, at);
                    String id;
                    Instant sendAt;
                    Instant firstAt;
                    if (pending != null) {
                        id = pending.get(HOOK_DELIVERIES.ID);
                        firstAt = pending.get(HOOK_DELIVERIES.FIRST_AT).toInstant();
                        JsonNode priorEvents = json.readTree(pending.get(HOOK_DELIVERIES.EVENTS).data());
                        JsonNode priorEventIds = json.readTree(pending.get(HOOK_DELIVERIES.EVENT_IDS).data());
                        JsonNode priorSubjects = json.readTree(pending.get(HOOK_DELIVERIES.SUBJECTS).data());
                        List<JsonNode> eventsInBatch = concatenate(priorEvents, eventCodes);
                        List<JsonNode> idsInBatch = concatenate(priorEventIds, eventIds);
                        List<JsonNode> subjectsInBatch = concatenate(priorSubjects, subjects);
                        Instant quietGap = at.plusSeconds(batch.path("waitMinutes").asLong() * 60);
                        Instant maximum = firstAt.plusSeconds(batch.path("maxMinutes").asLong() * 60);
                        sendAt = quietGap.isBefore(maximum) ? quietGap : maximum;
                        tx.update(HOOK_DELIVERIES).set(HOOK_DELIVERIES.EVENTS,
                                        JSONB.valueOf(json.writeValueAsString(eventsInBatch)))
                                .set(HOOK_DELIVERIES.EVENT_IDS,
                                        JSONB.valueOf(json.writeValueAsString(idsInBatch)))
                                .set(HOOK_DELIVERIES.SUBJECTS,
                                        JSONB.valueOf(json.writeValueAsString(subjectsInBatch)))
                                .set(HOOK_DELIVERIES.PUBLIC_TEXT, pending.get(HOOK_DELIVERIES.PUBLIC_TEXT)
                                        + "\n" + publicText)
                                .set(HOOK_DELIVERIES.LAST_AT, at.atOffset(ZoneOffset.UTC))
                                .set(HOOK_DELIVERIES.SEND_AT, sendAt.atOffset(ZoneOffset.UTC))
                                .where(HOOK_DELIVERIES.ID.eq(id)).execute();
                    } else {
                        id = "HD-" + UUID.randomUUID();
                        firstAt = at;
                        sendAt = batch == null ? at
                                : at.plusSeconds(Math.min(batch.path("waitMinutes").asLong(),
                                        batch.path("maxMinutes").asLong()) * 60);
                    tx.insertInto(HOOK_DELIVERIES)
                            .set(HOOK_DELIVERIES.ID, id)
                            .set(HOOK_DELIVERIES.HOOK_ID, hook.getId())
                            .set(HOOK_DELIVERIES.RECIPIENT, recipient)
                            .set(HOOK_DELIVERIES.SUBJECTS, JSONB.valueOf(json.writeValueAsString(subjects)))
                            .set(HOOK_DELIVERIES.EVENTS, JSONB.valueOf(json.writeValueAsString(eventCodes)))
                            .set(HOOK_DELIVERIES.EVENT_IDS, JSONB.valueOf(json.writeValueAsString(eventIds)))
                            .set(HOOK_DELIVERIES.PUBLIC_TEXT, publicText)
                            .set(HOOK_DELIVERIES.STATE, "waiting")
                            .set(HOOK_DELIVERIES.FIRST_AT, firstAt.atOffset(ZoneOffset.UTC))
                            .set(HOOK_DELIVERIES.LAST_AT, at.atOffset(ZoneOffset.UTC))
                            .set(HOOK_DELIVERIES.SEND_AT, sendAt.atOffset(ZoneOffset.UTC))
                            .set(HOOK_DELIVERIES.ATTEMPTS, 0)
                            .set(HOOK_DELIVERIES.LAST_ERROR, (String) null)
                            .set(HOOK_DELIVERIES.POSITION, tx.select(coalesce(max(HOOK_DELIVERIES.POSITION), -1).add(1))
                                    .from(HOOK_DELIVERIES).fetchOne(0, Integer.class))
                            .execute();
                    }
                    deliveries.add(new DeliveryDue(id, sendAt));
                });
        tx.update(HOOK_EVENTS).set(HOOK_EVENTS.MATCHED_AT, clock.instant().atOffset(ZoneOffset.UTC))
                .where(HOOK_EVENTS.ID.eq(eventId)).execute();
        for (DeliveryDue delivery : deliveries) {
            jobs.enqueue(tx, "hook.deliver", delivery.at(), Map.of("deliveryId", delivery.id()));
        }
    }

    private Record pendingDelivery(DSLContext tx, String hookId, String recipient, JsonNode batch, Instant at) {
        var query = tx.selectFrom(HOOK_DELIVERIES).where(HOOK_DELIVERIES.HOOK_ID.eq(hookId))
                .and(HOOK_DELIVERIES.STATE.eq("waiting")).and(HOOK_DELIVERIES.ATTEMPTS.eq(0));
        if (!"all".equals(batch.path("by").asString())) {
            query = query.and(HOOK_DELIVERIES.RECIPIENT.eq(recipient));
        }
        return query.orderBy(HOOK_DELIVERIES.POSITION.desc()).fetch().stream()
                .filter(row -> row.get(HOOK_DELIVERIES.SEND_AT) != null
                        && at.isBefore(row.get(HOOK_DELIVERIES.FIRST_AT).toInstant()
                                .plusSeconds(batch.path("maxMinutes").asLong() * 60)))
                .findFirst().orElse(null);
    }

    private List<JsonNode> concatenate(JsonNode left, JsonNode right) {
        List<JsonNode> result = new ArrayList<>();
        left.forEach(value -> result.add(value.deepCopy()));
        right.forEach(value -> result.add(value.deepCopy()));
        return result;
    }

    private boolean conditionTakes(JSONB conditionsValue, String code, String storedKind, String subjectId) {
        String kind = subjectKindOfEvent(code);
        JsonNode conditions = json.readTree(conditionsValue.data());
        JsonNode condition = conditions.get(kind);
        if (condition == null || condition.isEmpty()) {
            return true;
        }
        // Record events name the document itself; iteration events name one of its iterations.
        String recordId = subjectId;
        if ("iteration".equals(storedKind)) {
            recordId = dsl.select(ITERATIONS.DOCUMENT_ID).from(ITERATIONS)
                    .where(ITERATIONS.ID.eq(subjectId)).fetchOne(ITERATIONS.DOCUMENT_ID);
        }
        if (recordId == null || !List.of("request", "iteration", "document", "list", "run").contains(storedKind)) {
            return false;
        }
        return watchlists.matchesRecordForHook(kind, condition, recordId);
    }

    // HOOK-events; HOOK-condition: this is the subject-page mapping in contract/src/hooks.ts.
    static String subjectKindOfEvent(String event) {
        if (event.startsWith("request.")) {
            return "requests";
        }
        if (event.startsWith("list.")) {
            return "lists";
        }
        if (event.startsWith("run.")) {
            return "tasks";
        }
        return "documents";
    }

    private record DeliveryDue(String id, Instant at) { }
}
