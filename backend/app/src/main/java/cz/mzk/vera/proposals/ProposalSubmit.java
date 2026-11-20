package cz.mzk.vera.proposals;

import static cz.mzk.vera.db.tables.Tables.BATCHES;
import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_REGISTRY_RECORDS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.PROJECTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;

import cz.mzk.vera.documents.BatchQueries;
import cz.mzk.vera.documents.DocumentStates;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.iterations.Iterations;
import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.domain.proposals.Proposals;
import cz.mzk.vera.domain.status.Status;
import cz.mzk.vera.events.Correlation;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.documents.ProjectQueries;
import cz.mzk.vera.requests.RequestDecisions;
import cz.mzk.vera.requests.RequestPlacements;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// ACT-propose; ENT-batch; LC-REQ-join; LC-REQ-approve-now: port planSubmission as one act.
@Component
public class ProposalSubmit {
    private static final int CATALOG_TIER = 50; // The backend's catalog fake uses tier 50.
    private final DSLContext dsl;
    private final ProposalCheck check;
    private final ProposalSettings settings;
    private final HeldAccessQueries access;
    private final ProjectQueries projects;
    private final RequestDecisions decisions;
    private final RequestPlacements placements;
    private final DocumentStates states;
    private final BatchQueries batches;
    private final EventRecorder events;
    private final Clock clock;
    private final JsonMapper json;
    private final ProposalCheckQueue checkQueue;

    public ProposalSubmit(DSLContext dsl, ProposalCheck check, ProposalSettings settings,
            HeldAccessQueries access, ProjectQueries projects, RequestDecisions decisions,
            RequestPlacements placements, DocumentStates states,
            BatchQueries batches, EventRecorder events, Clock clock, JsonMapper json,
            ProposalCheckQueue checkQueue) {
        this.dsl = dsl;
        this.check = check;
        this.settings = settings;
        this.access = access;
        this.projects = projects;
        this.decisions = decisions;
        this.placements = placements;
        this.states = states;
        this.batches = batches;
        this.events = events;
        this.clock = clock;
        this.json = json;
        this.checkQueue = checkQueue;
    }

    @Transactional
    public Outcome submit(Caller caller, Map<String, Object> draft) {
        return submitForActor(caller.userId(), draft, false);
    }

    @Transactional
    public Outcome submitAsAgent(String agentId, Map<String, Object> draft) {
        return submitForActor(agentId, draft, true);
    }

    private Outcome submitForActor(String userId, Map<String, Object> draft, boolean agent) {
        List<Map<String, Object>> items = itemList(draft);
        boolean approve = draft.get("approval") != null;
        var held = access.heldBy(userId);
        if ((!agent && !Permissions.hasPermission(held.grants(), ProposalCodes.REQUEST_CREATE))
                || (approve && !Permissions.hasPermission(held.grants(), ProposalCodes.REQUEST_DECIDE))) {
            return Outcome.refused(403, "You may not propose this", null);
        }
        Integer max = settings.proposalLimitOf(userId);
        if (max != null && items.size() > max) {
            return Outcome.refused(422, "At most " + max + " items at once", ProposalCodes.TOO_MANY_ITEMS);
        }
        Instant now = clock.instant();
        List<CheckedItem> checked = new ArrayList<>();
        Set<ItemIdentity> seen = new HashSet<>();
        for (Map<String, Object> item : items) {
            Map<String, Object> result = check.checkItem(item, userId, false);
            if (accepted(result)) {
                ItemIdentity identity = new ItemIdentity((String) result.get("catalogId"),
                        (String) result.get("unit"));
                if (!seen.add(identity)) {
                    result = new LinkedHashMap<>(result);
                    result.put("kind", "mine");
                }
            }
            checked.add(new CheckedItem(item, result));
        }
        int count = (int) checked.stream().filter(value -> accepted(value.check())).count();
        if (!settings.canSubmitRateLimited(userId, count)) {
            return Outcome.refused(429, "Today's proposal limit has been reached", ProposalCodes.DAILY_LIMIT);
        }
        String projectId = (String) draft.get("projectId");
        if (projectId != null && !projects.isProposableTo(projectId, userId,
                access.scopesHeldBy(userId).groupIds())) {
            return Outcome.refused(422,
                    "Only a member proposes into a project, and not into a rejected one",
                    ProposalCodes.PROJECT_NOT_PROPOSABLE);
        }
        List<CheckedItem> accepted = checked.stream()
                .filter(value -> accepted(value.check())).toList();
        List<Map<String, Object>> skipped = checked.stream().filter(value -> !accepted(value.check()))
                .map(value -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("type", value.item().get("type"));
                    item.put("value", value.item().get("value"));
                    item.put("unit", value.item().get("unit"));
                    return item;
                }).toList();
        if (accepted.isEmpty()) {
            Map<String, Object> report = new LinkedHashMap<>();
            report.put("batch", null);
            report.put("proposed", 0);
            report.put("approved", 0);
            report.put("joined", 0);
            report.put("skipped", skipped);
            return Outcome.ok(report);
        }
        String batchId = nextBatchId();
        String batchName = (String) draft.get("batchName");
        if (batchName == null) {
            batchName = Proposals.defaultBatchNameOf(now);
        }
        Map<String, Object> source = entrySource(userId, (String) draft.get("entrySourceId"));
        OffsetDateTime at = now.atOffset(ZoneOffset.UTC);
        dsl.insertInto(BATCHES).set(BATCHES.ID, batchId).set(BATCHES.NAME, batchName)
                .set(BATCHES.SUBMITTED_BY, userId).set(BATCHES.SUBMITTED_AT, at)
                .set(BATCHES.SOURCE_INSTANCE_ID, source == null ? null : (String) source.get("id"))
                .set(BATCHES.SOURCE_NAME, source == null ? null : (String) source.get("name")).execute();
        String correlation = Correlation.newId();
        int proposed = 0;
        int approved = 0;
        int joined = 0;
        List<String> touched = new ArrayList<>();
        for (CheckedItem value : accepted) {
            String catalogId = (String) value.check().get("catalogId");
            String unit = (String) value.check().get("unit");
            String documentId = findDocument(catalogId, unit);
            boolean isNew = "new".equals(value.check().get("kind"));
            if (documentId == null && isNew) {
                documentId = createDocument(catalogId, unit, now);
            }
            if (documentId == null) {
                continue;
            }
            List<Copy> copies = List.of();
            String requestId = "R-" + UUID.randomUUID();
            String reason = (String) value.item().get("reason");
            if (reason == null) {
                reason = (String) draft.get("reason");
            }
            var current = dsl.select(ITERATIONS.ID, ITERATIONS.PROGRESS, ITERATIONS.CANCELLATION_CAUSE)
                    .from(ITERATIONS).where(ITERATIONS.DOCUMENT_ID.eq(documentId))
                    .orderBy(ITERATIONS.ATTEMPT.desc()).limit(1).fetchOne();
            boolean moving = current != null && !"Published".equals(current.get(ITERATIONS.PROGRESS))
                    && current.get(ITERATIONS.CANCELLATION_CAUSE) == null;
            String decision = "Pending";
            String relation = null;
            String iterationId = null;
            String tracks = null;
            Boolean afterApproval = false;
            Map<String, Object> approval = draft.get("approval") instanceof Map<?, ?> map
                    ? stringMap(map) : null;
            if (!isNew) {
                joined++;
                if (moving) {
                    decision = "Duplicate";
                    tracks = current.get(ITERATIONS.ID);
                    afterApproval = null;
                }
            } else {
                proposed++;
                var project = projectState(projectId);
                afterApproval = "Approved".equals(project);
            }
            dsl.insertInto(REQUESTS).set(REQUESTS.ID, requestId).set(REQUESTS.DOCUMENT_ID, documentId)
                    .set(REQUESTS.REQUESTER_ID, userId).set(REQUESTS.AT, at).set(REQUESTS.REASON, reason)
                    .set(REQUESTS.BATCH_ID, batchId).set(REQUESTS.PROJECT_ID, projectId)
                    .set(REQUESTS.CHECKED_AT, (OffsetDateTime) null).set(REQUESTS.DECISION, decision)
                    .set(REQUESTS.IS_AFTER_PROJECT_APPROVAL, afterApproval)
                    .set(REQUESTS.APPROVAL_AFTER_CHECK_CATEGORY_ID,
                            isNew && approval != null ? (String) approval.get("categoryId") : null)
                    .set(REQUESTS.APPROVAL_AFTER_CHECK_PRIORITY,
                            isNew && approval != null ? (String) approval.get("priority") : null)
                    .set(REQUESTS.ITERATION_RELATION, relation).set(REQUESTS.ITERATION_ID, iterationId)
                    .set(REQUESTS.TRACKS_ITERATION_ID, tracks).execute();
            int position = 0;
            for (Copy copy : copies) {
                dsl.insertInto(REQUEST_EXISTING_COPIES).set(REQUEST_EXISTING_COPIES.REQUEST_ID, requestId)
                        .set(REQUEST_EXISTING_COPIES.POSITION, position++).set(REQUEST_EXISTING_COPIES.SOURCE,
                                copy.source()).set(REQUEST_EXISTING_COPIES.STATE, copy.state())
                        .set(REQUEST_EXISTING_COPIES.LINK, copy.link())
                        .set(REQUEST_EXISTING_COPIES.ITERATION_ID, copy.iterationId())
                        .set(REQUEST_EXISTING_COPIES.SEEN_AT, at)
                        .set(REQUEST_EXISTING_COPIES.FOUND_AFTER_APPROVAL, false).execute();
            }
            placements.place(dsl, requestId);
            touched.add(documentId);
            Map<String, Object> eventData = new LinkedHashMap<>();
            eventData.put("batch", Map.of("id", batchId, "name", batchName));
            eventData.put("source", source == null ? null : Map.of("id", source.get("id"),
                    "name", source.get("name")));
            events.record(new EventInput(EventCode.REQUEST_CREATED, "request", requestId, null,
                    new EventInput.User(userId), correlation, now, json.valueToTree(eventData),
                    new EventInput.Reason(reason, null)));
            checkQueue.queue(dsl, requestId);
            if (isNew && approval != null) {
                events.record(new EventInput(EventCode.REQUEST_HELD, "request", requestId, null,
                        new EventInput.User(userId), correlation, now,
                        json.valueToTree(Map.of("why", "checking")), new EventInput.Reason(null, null)));
            }
        }
        touched.stream().distinct().forEach(id -> states.recompute(dsl, id));
        Map<String, Object> batch = batches.served().stream().filter(row -> batchId.equals(row.get("id")))
                .findFirst().orElseThrow();
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("batch", batch);
        report.put("proposed", proposed);
        report.put("approved", approved);
        report.put("joined", joined);
        report.put("skipped", skipped);
        return Outcome.ok(report);
    }

    private boolean accepted(Map<String, Object> value) {
        return "new".equals(value.get("kind")) || "inVera".equals(value.get("kind"));
    }

    private List<Map<String, Object>> itemList(Map<String, Object> draft) {
        return ((List<?>) draft.get("items")).stream().map(ProposalSubmit::stringMap).toList();
    }

    private static Map<String, Object> stringMap(Object value) {
        Map<?, ?> raw = (Map<?, ?>) value;
        Map<String, Object> result = new LinkedHashMap<>();
        raw.forEach((key, item) -> result.put((String) key, item));
        return result;
    }

    private String nextBatchId() {
        // contract/src/queries/proposals.ts: planSubmission's next batch id.
        var ids = dsl.select(BATCHES.ID).from(BATCHES).fetch(BATCHES.ID);
        int highest = ids.stream().mapToInt(id -> {
            try {
                return Integer.parseInt(id.substring(2));
            } catch (NumberFormatException exception) {
                return 0;
            }
        }).max().orElse(0);
        return "B-%04d".formatted(highest + 1);
    }

    private Map<String, Object> entrySource(String userId, String sourceId) {
        // contract/src/queries/proposals.ts: select the named configured entry source.
        if (sourceId == null) {
            return null;
        }
        return settings.settings(userId).get("entrySources") instanceof List<?> entries
                ? entries.stream().map(ProposalSubmit::stringMap)
                        .filter(value -> sourceId.equals(value.get("id"))).findFirst().orElse(null)
                : null;
    }

    private String projectState(String projectId) {
        if (projectId == null) {
            return null;
        }
        return dsl.select(PROJECTS.STATE).from(PROJECTS)
                .where(PROJECTS.ID.eq(projectId)).fetchOne(PROJECTS.STATE);
    }

    private String findDocument(String catalogId, String unit) {
        return dsl.select(DOCUMENTS.ID).from(DOCUMENTS).where(DOCUMENTS.CATALOG_ID.eq(catalogId))
                .and(unit == null ? DOCUMENTS.UNIT_VALUE.isNull() : DOCUMENTS.UNIT_VALUE.eq(unit))
                .fetchOne(DOCUMENTS.ID);
    }

    private String createDocument(String catalogId, String unit, Instant now) {
        // contract/src/queries/proposals.ts: planSubmission's catalog-backed document insert.
        var mirror = dsl.select(CATALOG_MIRROR.INSTANCE_ID, CATALOG_MIRROR.TITLE, CATALOG_MIRROR.TYPE,
                        CATALOG_MIRROR.RECORD)
                .from(CATALOG_MIRROR).where(CATALOG_MIRROR.CATALOG_ID.eq(catalogId))
                .orderBy(CATALOG_MIRROR.POSITION).limit(1).fetchOne();
        if (mirror == null) {
            throw new IllegalStateException("Accepted catalog record disappeared: " + catalogId);
        }
        String documentId = "D-" + UUID.randomUUID();
        String unitType = unit == null ? null : unitType(unit);
        String title = mirror.get(CATALOG_MIRROR.TITLE);
        String type = mirror.get(CATALOG_MIRROR.TYPE);
        dsl.insertInto(DOCUMENTS).set(DOCUMENTS.ID, documentId).set(DOCUMENTS.CATALOG_ID, catalogId)
                .set(DOCUMENTS.UNIT_TYPE, unitType).set(DOCUMENTS.UNIT_VALUE, unit)
                .set(DOCUMENTS.TITLE, title).set(DOCUMENTS.TYPE, type).set(DOCUMENTS.SHELF_MARK, (String) null)
                .execute();
        String instanceId = mirror.get(CATALOG_MIRROR.INSTANCE_ID);
        var instance = dsl.select(PLUGIN_INSTANCES.NAME).from(PLUGIN_INSTANCES)
                .where(PLUGIN_INSTANCES.ID.eq(instanceId)).fetchOne();
        String instanceName = instance == null ? instanceId : instance.get(0, String.class);
        JsonNode source = json.valueToTree(Map.of("kind", "plugin", "instanceId", instanceId,
                "instanceName", instanceName));
        addProperty(documentId, "title", source, title, 0, now);
        addProperty(documentId, "material_type", source, type, 1, now);
        return documentId;
    }

    private void addProperty(
            String documentId, String key, JsonNode source, String value, int keyPosition, Instant now) {
        dsl.insertInto(DOCUMENT_PROPERTY_SOURCES).set(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID, documentId)
                .set(DOCUMENT_PROPERTY_SOURCES.KEY, key)
                .set(DOCUMENT_PROPERTY_SOURCES.KEY_POSITION, keyPosition)
                .set(DOCUMENT_PROPERTY_SOURCES.POSITION, 0)
                .set(DOCUMENT_PROPERTY_SOURCES.SOURCE, JSONB.valueOf(json.writeValueAsString(source)))
                .set(DOCUMENT_PROPERTY_SOURCES.TIER, CATALOG_TIER)
                .set(DOCUMENT_PROPERTY_SOURCES.VALUE, JSONB.valueOf(json.writeValueAsString(value)))
                .set(DOCUMENT_PROPERTY_SOURCES.OBSERVED_AT, now.atOffset(ZoneOffset.UTC))
                .execute();
    }

    private String unitType(String value) {
        // contract/src/queries/proposals.ts: unitTypeOf.
        if (value.matches("MZK-\\d{4}-\\d{6}")) {
            return "barcode";
        }
        return value.matches("(roč\\.|sv\\.|vol\\.)\\s*\\d+.*") ? "volume-number" : "volume-name";
    }

    public List<Copy> existingCopies(String documentId, Instant now) {
        // contract/src/queries/proposals.ts: existingCopiesFor.
        List<Copy> copies = new ArrayList<>();
        dsl.selectFrom(DOCUMENT_REGISTRY_RECORDS)
                .where(DOCUMENT_REGISTRY_RECORDS.DOCUMENT_ID.eq(documentId))
                .orderBy(DOCUMENT_REGISTRY_RECORDS.POSITION)
                .fetch().stream().filter(row -> List.of("Digitized", "Published").contains(row.getState()))
                .forEach(row -> copies.add(new Copy(row.getRegistry(), row.getState(), row.getUrl(), null)));
        var record = states.recordOf(dsl, documentId);
        var rows = dsl.selectFrom(ITERATIONS).where(ITERATIONS.DOCUMENT_ID.eq(documentId))
                .orderBy(ITERATIONS.ATTEMPT).fetch();
        for (var row : rows) {
            if (Status.isProgressAtLeast(Progress.valueOf(row.getProgress()), Progress.Digitized)) {
                var iteration = record.iterations().stream()
                        .filter(item -> item.id().equals(row.getId())).findFirst().orElseThrow();
                var primary = Iterations.primaryLinkOf(iteration);
                copies.add(new Copy("VERA", "Published".equals(row.getProgress()) ? "Published" : "Digitized",
                        primary == null ? null : primary.url(), row.getId()));
            }
        }
        return copies;
    }

    private record CheckedItem(Map<String, Object> item, Map<String, Object> check) {}
    private record ItemIdentity(String catalogId, String unit) {}
    public record Copy(String source, String state, String link, String iterationId) {}
    public record Outcome(int status, String detail, String code, Map<String, Object> body) {
        static Outcome refused(int status, String detail, String code) {
            return new Outcome(status, detail, code, null);
        }
        static Outcome ok(Map<String, Object> body) {
            return new Outcome(201, null, null, body);
        }
    }
}
