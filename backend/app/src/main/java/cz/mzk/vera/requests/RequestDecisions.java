package cz.mzk.vera.requests;

import static cz.mzk.vera.db.tables.Tables.BATCHES;
import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES;
import static cz.mzk.vera.db.tables.Tables.REQUEST_SUGGESTIONS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.documents.DocumentCodes.REQUEST_DECIDE;
import static cz.mzk.vera.documents.DocumentCodes.REQUEST_READ;
import static cz.mzk.vera.documents.DocumentCodes.REQUEST_WITHDRAW_OWN;
import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.exists;
import static org.jooq.impl.DSL.max;
import static org.jooq.impl.DSL.selectOne;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.documents.DocumentStates;
import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.events.Correlation;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

// ACT-request-decide; VIEW-requests; LOG-one-act-one-story: port decisions.ts in one transaction.
@Component
public class RequestDecisions {
    private static final String PENDING = "Pending";
    private static final String APPROVED = "Approved";
    private static final String DENIED = "Denied";
    private static final String WITHDRAWN = "Withdrawn";
    private static final String CATEGORY_NOT_LEAF = "category.not_leaf";

    private final DSLContext dsl;
    private final RequestRows rows;
    private final RequestReach reach;
    private final HeldAccessQueries heldAccess;
    private final DocumentStates states;
    private final EventRecorder events;
    private final Clock clock;
    private final JsonMapper json;

    public RequestDecisions(DSLContext dsl, RequestRows rows, RequestReach reach,
            HeldAccessQueries heldAccess, DocumentStates states, EventRecorder events, Clock clock,
            JsonMapper json) {
        this.dsl = dsl;
        this.rows = rows;
        this.reach = reach;
        this.heldAccess = heldAccess;
        this.states = states;
        this.events = events;
        this.clock = clock;
        this.json = json;
    }

    @Transactional
    public ActResult approve(Caller caller, String documentId, Approval approval) {
        RowResult found = openRowFor(caller, documentId);
        if (found.refusal() != null) {
            return found.refusal();
        }
        ActResult categoryRefusal = leafCategoryRefusal(approval.categoryId());
        if (categoryRefusal != null) {
            return categoryRefusal;
        }
        DecisionRow row = found.row();
        if (isBeingChecked(row)) {
            return ActResult.refused(409, "The checks have not answered yet", "proposal.checks_pending");
        }
        if (isRescan(row) && approval.rescanNote() == null) {
            return ActResult.refused(422, "Say why it is scanned again", "proposal.rescan_reason_missing");
        }
        return approveRow(caller.userId(), row, approval, clock.instant());
    }

    // BK3g2 calls this after its own proposal checks, using the same row-based approval write.
    @Transactional
    public ActResult approveRow(String actorId, DecisionRow row, Approval approval, Instant at) {
        List<Ask> asks = row.asks();
        Ask oldest = asks.getFirst();
        String iterationId = "IT-" + UUID.randomUUID();
        String correlationId = "C-" + UUID.randomUUID();
        int nextAttempt = dsl.select(coalesce(max(ITERATIONS.ATTEMPT), 0).add(1))
                .from(ITERATIONS).where(ITERATIONS.DOCUMENT_ID.eq(row.documentId()))
                .fetchOne(0, Integer.class);
        OffsetDateTime writtenAt = at.atOffset(ZoneOffset.UTC);
        dsl.insertInto(ITERATIONS)
                .set(ITERATIONS.ID, iterationId)
                .set(ITERATIONS.DOCUMENT_ID, row.documentId())
                .set(ITERATIONS.ATTEMPT, nextAttempt)
                .set(ITERATIONS.REQUEST_ID, oldest.id())
                .set(ITERATIONS.CATEGORY_ID, approval.categoryId())
                .set(ITERATIONS.PRIORITY, approval.priority())
                .set(ITERATIONS.PROJECT_ID, oldest.projectId())
                .set(ITERATIONS.PROGRESS, "Enqueued")
                .execute();
        for (Ask ask : asks) {
            boolean originating = ask.id().equals(oldest.id());
            dsl.update(REQUESTS)
                    .set(REQUESTS.DECISION, APPROVED)
                    .set(REQUESTS.IS_AFTER_PROJECT_APPROVAL, (Boolean) null)
                    .set(REQUESTS.ITERATION_RELATION, originating ? "Originates" : "Tracks")
                    .set(REQUESTS.ITERATION_ID, iterationId)
                    .set(REQUESTS.RESCAN_ACTOR_ID,
                            originating && approval.rescanNote() != null ? actorId : null)
                    .set(REQUESTS.RESCAN_AT, originating && approval.rescanNote() != null ? writtenAt : null)
                    .set(REQUESTS.RESCAN_NOTE, originating ? approval.rescanNote() : null)
                    .where(REQUESTS.ID.eq(ask.id()))
                    .execute();
            recordApproved(actorId, ask.id(), row, approval, iterationId, correlationId, asks.size(),
                    originating, writtenAt);
        }
        states.recompute(dsl, row.documentId());
        return ActResult.ok(Map.of("documentId", row.documentId(), "decision", APPROVED,
                "askCount", asks.size()));
    }

    @Transactional
    public ActResult decline(Caller caller, String documentId, Decline decline) {
        RowResult found = openRowFor(caller, documentId);
        if (found.refusal() != null) {
            return found.refusal();
        }
        List<Ask> asks = found.row().asks();
        OffsetDateTime at = clock.instant().atOffset(ZoneOffset.UTC);
        String correlationId = Correlation.newId();
        for (Ask ask : asks) {
            dsl.update(REQUESTS)
                    .set(REQUESTS.DECISION, DENIED)
                    .set(REQUESTS.IS_AFTER_PROJECT_APPROVAL, (Boolean) null)
                    .set(REQUESTS.DECLINE_ACTOR_ID, caller.userId())
                    .set(REQUESTS.DECLINE_AT, at)
                    .set(REQUESTS.DECLINE_PUBLIC_TEXT, decline.publicText())
                    .set(REQUESTS.DECLINE_INTERNAL_TEXT, decline.internalText())
                    .where(REQUESTS.ID.eq(ask.id()))
                    .execute();
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("batchSize", nullableBatchSize(asks.size()));
            record(EventCode.REQUEST_DECLINED, ask.id(), caller.userId(), correlationId, at, data,
                    decline.publicText(), decline.internalText());
        }
        states.recompute(dsl, documentId);
        return ActResult.ok(Map.of("documentId", documentId, "decision", DENIED, "askCount", asks.size()));
    }

    @Transactional
    public ActResult withdraw(Caller caller, String documentId) {
        if (!hasPermission(caller.userId(), REQUEST_WITHDRAW_OWN)) {
            return ActResult.refused(403, "You may not withdraw asks", null);
        }
        var own = dsl.select(REQUESTS.ID, REQUESTS.DECISION).from(REQUESTS)
                .where(REQUESTS.DOCUMENT_ID.eq(documentId).and(REQUESTS.REQUESTER_ID.eq(caller.userId())))
                .orderBy(REQUESTS.AT, REQUESTS.ID).fetch();
        if (own.isEmpty()) {
            return ActResult.refused(404, "You have not asked for this document", "request.not_asked");
        }
        var ask = own.stream()
                .filter(item -> PENDING.equals(item.get(REQUESTS.DECISION)))
                .findFirst()
                .orElse(null);
        if (ask == null) {
            return ActResult.refused(409, "It has been decided meanwhile", "proposal.decided");
        }
        OffsetDateTime at = clock.instant().atOffset(ZoneOffset.UTC);
        dsl.update(REQUESTS).set(REQUESTS.DECISION, WITHDRAWN)
                .set(REQUESTS.IS_AFTER_PROJECT_APPROVAL, (Boolean) null)
                .set(REQUESTS.WITHDRAWN_AT, at).where(REQUESTS.ID.eq(ask.get(REQUESTS.ID))).execute();
        record(EventCode.REQUEST_WITHDRAWN, ask.get(REQUESTS.ID), caller.userId(), Correlation.newId(), at,
                Map.of(), null, null);
        states.recompute(dsl, documentId);
        return ActResult.ok(Map.of("documentId", documentId, "requestId", ask.get(REQUESTS.ID)));
    }

    @Transactional
    public ActResult approveBatch(Caller caller, String batchId, BulkApproval bulk) {
        if (!dsl.fetchExists(dsl.selectOne().from(BATCHES).where(BATCHES.ID.eq(batchId)))) {
            return ActResult.refused(404, "No such batch", null);
        }
        ActResult categoryRefusal = leafCategoryRefusal(bulk.categoryId());
        if (categoryRefusal != null) {
            return categoryRefusal;
        }
        var scopes = heldAccess.scopesHeldBy(caller.userId());
        var rowTable = rows.rows();
        List<String> openIds = dsl.select(DOCUMENTS.ID).from(DOCUMENTS)
                .join(rowTable).on(rowTable.field("document_id", String.class).eq(DOCUMENTS.ID))
                .where(rowTable.field("decision", String.class).eq(PENDING)
                        .and(reach.condition(scopes, caller.userId(), REQUEST_DECIDE, DOCUMENTS.ID))
                        .and(reach.condition(scopes, caller.userId(), REQUEST_READ, DOCUMENTS.ID))
                        .and(exists(selectOne().from(REQUESTS).where(REQUESTS.DOCUMENT_ID.eq(DOCUMENTS.ID)
                                .and(REQUESTS.DECISION.eq(PENDING)).and(REQUESTS.BATCH_ID.eq(batchId))))))
                .orderBy(DOCUMENTS.POSITION).fetch(DOCUMENTS.ID);
        List<DecisionRow> openRows = new ArrayList<>();
        for (String id : openIds) {
            DecisionRow row = rowFor(id);
            if (row != null) {
                openRows.add(row);
            }
        }
        List<DecisionRow> taken = openRows.stream().filter(this::bulkApprovable)
                .filter(row -> !bulk.excludedIds().contains(row.documentId())).toList();
        if (taken.isEmpty()) {
            return ActResult.refused(409, "Nothing in this batch is left to approve",
                    "batch.nothing_to_approve");
        }
        for (DecisionRow row : taken) {
            approveRow(caller.userId(), row, new Approval(bulk.categoryId(), bulk.priority(), null),
                    clock.instant());
        }
        int rescans = (int) openRows.stream().filter(this::isRescan).count();
        int checking = (int) openRows.stream().filter(row -> !isRescan(row) && isBeingChecked(row)).count();
        return ActResult.ok(Map.of("approvedCount", taken.size(), "rescanCount", rescans,
                "checkingCount", checking));
    }

    private RowResult openRowFor(Caller caller, String documentId) {
        DecisionRow row = rowFor(documentId);
        if (row == null) {
            return RowResult.refused(ActResult.refused(404, "No proposal for this document", null));
        }
        var scopes = heldAccess.scopesHeldBy(caller.userId());
        if (!dsl.fetchExists(dsl.selectOne().from(DOCUMENTS).where(DOCUMENTS.ID.eq(documentId)
                .and(reach.condition(scopes, caller.userId(), REQUEST_DECIDE, DOCUMENTS.ID))))) {
            return RowResult.refused(ActResult.refused(403,
                    "This proposal is outside your request custody", "proposal.outside_request_custody"));
        }
        if (!PENDING.equals(row.decision())) {
            return RowResult.refused(ActResult.refused(409,
                    "This proposal has already been decided", "proposal.decided"));
        }
        return RowResult.found(row);
    }

    private DecisionRow rowFor(String documentId) {
        var rowTable = rows.rows();
        String decision = dsl.select(rowTable.field("decision", String.class)).from(rowTable)
                .where(rowTable.field("document_id", String.class).eq(documentId)).fetchOne(0, String.class);
        if (decision == null) {
            return null;
        }
        List<Ask> asks = dsl.selectFrom(REQUESTS).where(REQUESTS.DOCUMENT_ID.eq(documentId)
                .and(REQUESTS.DECISION.eq(decision))).orderBy(REQUESTS.AT, REQUESTS.ID)
                .fetch(row -> new Ask(row.getId(), row.getProjectId(), row.getCheckedAt() != null));
        Map<String, Object> suggestion = asks.isEmpty() ? null : suggestionOf(asks.getFirst().id());
        return new DecisionRow(documentId, decision, asks, suggestion,
                dsl.fetchExists(dsl.selectOne().from(REQUEST_EXISTING_COPIES)
                        .where(REQUEST_EXISTING_COPIES.REQUEST_ID.in(asks.stream().map(Ask::id).toList()))));
    }

    private boolean isBeingChecked(DecisionRow row) {
        return PENDING.equals(row.decision()) && row.asks().stream().anyMatch(ask -> !ask.checked());
    }

    private boolean isRescan(DecisionRow row) {
        return row.hasCopies();
    }

    private boolean bulkApprovable(DecisionRow row) {
        return PENDING.equals(row.decision()) && !isRescan(row) && !isBeingChecked(row);
    }

    private ActResult leafCategoryRefusal(String categoryId) {
        List<Category> categories = dsl.select(CATEGORIES.ID, CATEGORIES.PARENT_ID).from(CATEGORIES)
                .fetch(row -> new Category(row.get(CATEGORIES.ID), row.get(CATEGORIES.PARENT_ID)));
        boolean known = !Categories.lineageOf(categories, categoryId).isEmpty();
        boolean leaf = Categories.leavesOf(categories).stream()
                .anyMatch(category -> category.id().equals(categoryId));
        return known && leaf ? null : ActResult.refused(422,
                "Choose a category with no subcategories", CATEGORY_NOT_LEAF);
    }

    private boolean hasPermission(String userId, String permission) {
        return heldAccess.scopesHeldBy(userId).hasPermission(permission);
    }

    private Map<String, Object> suggestionOf(String askId) {
        var suggestion = dsl.select(REQUEST_SUGGESTIONS.CATEGORY_ID, REQUEST_SUGGESTIONS.REASON,
                        REQUEST_SUGGESTIONS.CLASSIFIER_ID, PLUGIN_INSTANCES.NAME)
                .from(REQUEST_SUGGESTIONS.join(PLUGIN_INSTANCES)
                        .on(PLUGIN_INSTANCES.ID.eq(REQUEST_SUGGESTIONS.CLASSIFIER_ID)))
                .where(REQUEST_SUGGESTIONS.REQUEST_ID.eq(askId)).fetchOne();
        if (suggestion == null) {
            return null;
        }
        List<Category> categories = new ArrayList<>();
        Map<String, String> namesById = new LinkedHashMap<>();
        dsl.select(CATEGORIES.ID, CATEGORIES.PARENT_ID, CATEGORIES.NAME).from(CATEGORIES)
                .fetch().forEach(row -> {
                    categories.add(new Category(row.get(CATEGORIES.ID), row.get(CATEGORIES.PARENT_ID)));
                    namesById.put(row.get(CATEGORIES.ID), row.get(CATEGORIES.NAME));
                });
        List<String> names = Categories.lineageOf(categories,
                suggestion.get(REQUEST_SUGGESTIONS.CATEGORY_ID)).stream().map(namesById::get).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("categoryId", suggestion.get(REQUEST_SUGGESTIONS.CATEGORY_ID));
        result.put("category", Map.of("id", suggestion.get(REQUEST_SUGGESTIONS.CATEGORY_ID),
                "name", String.join(" / ", names)));
        result.put("reason", suggestion.get(REQUEST_SUGGESTIONS.REASON));
        result.put("classifier", Map.of("id", suggestion.get(REQUEST_SUGGESTIONS.CLASSIFIER_ID),
                "name", suggestion.get(PLUGIN_INSTANCES.NAME)));
        return result;
    }

    private void recordApproved(String actorId, String askId, DecisionRow row, Approval approval,
            String iterationId, String correlationId, int askCount, boolean originating, OffsetDateTime at) {
        Map<String, Object> suggestion = null;
        if (row.suggestion() != null) {
            suggestion = new LinkedHashMap<>();
            suggestion.put("category", row.suggestion().get("category"));
            suggestion.put("classifier", row.suggestion().get("classifier"));
            suggestion.put("kept", approval.categoryId().equals(row.suggestion().get("categoryId")));
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("iterationId", iterationId);
        data.put("isRescan", approval.rescanNote() != null);
        data.put("batchSize", nullableBatchSize(askCount));
        data.put("suggestion", suggestion);
        record(EventCode.REQUEST_APPROVED, askId, actorId, correlationId, at, data, null,
                originating ? approval.rescanNote() : null);
    }

    private Integer nullableBatchSize(int askCount) {
        return askCount > 1 ? askCount : null;
    }

    private void record(EventCode code, String askId, String actorId, String correlationId,
            OffsetDateTime at, Map<String, Object> data, String publicReason, String internalReason) {
        events.record(new EventInput(code, "request", askId, null, new EventInput.User(actorId),
                correlationId, at.toInstant(), json.valueToTree(data),
                new EventInput.Reason(publicReason, internalReason)));
    }

    public record Approval(String categoryId, String priority, String rescanNote) {}
    public record Decline(String publicText, String internalText) {}
    public record BulkApproval(String categoryId, String priority, List<String> excludedIds) {}
    public record DecisionRow(String documentId, String decision, List<Ask> asks,
            Map<String, Object> suggestion, boolean hasCopies) {}
    public record Ask(String id, String projectId, boolean checked) {}
    private record RowResult(DecisionRow row, ActResult refusal) {
        static RowResult found(DecisionRow row) { return new RowResult(row, null); }
        static RowResult refused(ActResult refusal) { return new RowResult(null, refusal); }
    }
}
