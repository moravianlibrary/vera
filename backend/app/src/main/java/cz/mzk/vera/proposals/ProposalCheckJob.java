package cz.mzk.vera.proposals;

import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR_KEYS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.max;

import cz.mzk.vera.documents.PluginAnswerWrites;
import cz.mzk.vera.documents.DocumentStates;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.events.Correlation;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.jobs.Job;
import cz.mzk.vera.jobs.JobKind;
import cz.mzk.vera.jobs.Jobs;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.requests.RequestDecisions;
import cz.mzk.vera.requests.RequestSuggestions;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

// LC-REQ-checks-job; LC-REQ-approve-now; DOC-existing-copy: check each ask after its submit.
@Component
public class ProposalCheckJob implements JobKind<ProposalCheckJob.Result> {
    public static final String KIND = "proposal.check";
    private final DSLContext dsl;
    private final ProposalPluginRuns plugins;
    private final ProposalSubmit submit;
    private final PluginAnswerWrites writes;
    private final RequestDecisions decisions;
    private final RequestSuggestions suggestions;
    private final Jobs jobs;
    private final EventRecorder events;
    private final DocumentStates states;
    private final Clock clock;
    private final JsonMapper json;

    public ProposalCheckJob(DSLContext dsl, ProposalPluginRuns plugins, ProposalSubmit submit,
            PluginAnswerWrites writes, RequestDecisions decisions, Jobs jobs, EventRecorder events,
            RequestSuggestions suggestions, DocumentStates states, Clock clock, JsonMapper json) {
        this.dsl = dsl;
        this.plugins = plugins;
        this.submit = submit;
        this.writes = writes;
        this.decisions = decisions;
        this.suggestions = suggestions;
        this.jobs = jobs;
        this.events = events;
        this.states = states;
        this.clock = clock;
        this.json = json;
    }

    @Override
    public String name() {
        return KIND;
    }

    @Override
    public Result call(Job job) {
        String requestId = job.payload().path("requestId").asString();
        Record row = dsl.select(REQUESTS.DOCUMENT_ID, REQUESTS.DECISION, REQUESTS.CHECKED_AT,
                        DOCUMENTS.CATALOG_ID, DOCUMENTS.UNIT_TYPE, DOCUMENTS.UNIT_VALUE,
                        DOCUMENTS.TITLE, DOCUMENTS.TYPE, DOCUMENTS.SHELF_MARK)
                .from(REQUESTS.join(DOCUMENTS).on(REQUESTS.DOCUMENT_ID.eq(DOCUMENTS.ID)))
                .where(REQUESTS.ID.eq(requestId)).fetchOne();
        if (row == null || row.get(REQUESTS.CHECKED_AT) != null
                || !List.of("Pending", "Duplicate").contains(row.get(REQUESTS.DECISION))) {
            return Result.stale(requestId);
        }
        Document.Unit unit = row.get(DOCUMENTS.UNIT_TYPE) == null ? null
                : new Document.Unit(row.get(DOCUMENTS.UNIT_TYPE), row.get(DOCUMENTS.UNIT_VALUE));
        Document document = new Document(row.get(REQUESTS.DOCUMENT_ID), row.get(DOCUMENTS.CATALOG_ID), unit,
                row.get(DOCUMENTS.TITLE), row.get(DOCUMENTS.TYPE), row.get(DOCUMENTS.SHELF_MARK));
        try {
            List<String> identifiers = dsl.select(CATALOG_MIRROR_KEYS.VALUE).from(CATALOG_MIRROR_KEYS)
                    .where(CATALOG_MIRROR_KEYS.CATALOG_ID.eq(row.get(DOCUMENTS.CATALOG_ID)))
                    .and(CATALOG_MIRROR_KEYS.KIND.eq("identifier"))
                    .orderBy(CATALOG_MIRROR_KEYS.POSITION).fetch(CATALOG_MIRROR_KEYS.VALUE);
            return new Result(requestId, row.get(REQUESTS.DOCUMENT_ID),
                    plugins.lookup(document, identifiers, null), plugins.restrictions(document, null), null, false);
        } catch (ProposalPluginRuns.ProposalPluginFailure failure) {
            return new Result(requestId, row.get(REQUESTS.DOCUMENT_ID), List.of(), List.of(),
                    failure.getMessage(), false);
        }
    }

    @Override
    public void apply(DSLContext tx, Job job, Result result) {
        if (result.stale()) {
            return;
        }
        Record request = tx.select(REQUESTS.DOCUMENT_ID, REQUESTS.REQUESTER_ID, REQUESTS.DECISION,
                        REQUESTS.CHECKED_AT, REQUESTS.APPROVAL_AFTER_CHECK_CATEGORY_ID,
                        REQUESTS.APPROVAL_AFTER_CHECK_PRIORITY)
                .from(REQUESTS).where(REQUESTS.ID.eq(result.requestId())).fetchOne();
        if (request == null || request.get(REQUESTS.CHECKED_AT) != null
                || !List.of("Pending", "Duplicate").contains(request.get(REQUESTS.DECISION))) {
            return;
        }
        if (result.error() != null) {
            long seconds = Math.min(300, 1L << Math.min(job.attempt(), 8));
            jobs.enqueue(tx, KIND, clock.instant().plusSeconds(seconds),
                    Map.of("requestId", result.requestId()));
            return;
        }
        for (ProposalPluginRuns.RegistryAnswer answer : result.registries()) {
            writes.registry(tx, result.documentId(), answer.registry(), answer.answer());
        }
        Instant now = clock.instant();
        List<ProposalSubmit.Copy> copies = submit.existingCopies(result.documentId(), now);
        tx.update(REQUESTS).set(REQUESTS.CHECKED_AT, now.atOffset(ZoneOffset.UTC))
                .where(REQUESTS.ID.eq(result.requestId())).execute();
        suggestions.suggest(tx, result.requestId());
        int position = 0;
        for (ProposalSubmit.Copy copy : copies) {
            tx.insertInto(REQUEST_EXISTING_COPIES).set(REQUEST_EXISTING_COPIES.REQUEST_ID, result.requestId())
                    .set(REQUEST_EXISTING_COPIES.POSITION, position++).set(REQUEST_EXISTING_COPIES.SOURCE, copy.source())
                    .set(REQUEST_EXISTING_COPIES.STATE, copy.state()).set(REQUEST_EXISTING_COPIES.LINK, copy.link())
                    .set(REQUEST_EXISTING_COPIES.ITERATION_ID, copy.iterationId())
                    .set(REQUEST_EXISTING_COPIES.SEEN_AT, now.atOffset(ZoneOffset.UTC))
                    .set(REQUEST_EXISTING_COPIES.FOUND_AFTER_APPROVAL, false).execute();
        }
        String categoryId = request.get(REQUESTS.APPROVAL_AFTER_CHECK_CATEGORY_ID);
        String priority = request.get(REQUESTS.APPROVAL_AFTER_CHECK_PRIORITY);
        if (categoryId != null && copies.isEmpty()) {
            approve(tx, result.requestId(), result.documentId(), request.get(REQUESTS.REQUESTER_ID),
                    categoryId, priority, now);
        }
        states.recompute(tx, result.documentId());
    }

    private void approve(DSLContext tx, String requestId, String documentId, String requesterId,
            String categoryId, String priority, Instant at) {
        int attempt = tx.select(coalesce(max(ITERATIONS.ATTEMPT), 0).add(1))
                .from(ITERATIONS)
                .where(ITERATIONS.DOCUMENT_ID.eq(documentId))
                .fetchOne(0, Integer.class);
        String iterationId = "IT-" + UUID.randomUUID();
        decisions.insertIteration(tx, documentId, iterationId, attempt, requestId, categoryId, priority,
                tx.select(REQUESTS.PROJECT_ID).from(REQUESTS).where(REQUESTS.ID.eq(requestId))
                        .fetchOne(REQUESTS.PROJECT_ID));
        tx.update(REQUESTS).set(REQUESTS.DECISION, "Approved")
                .set(REQUESTS.IS_AFTER_PROJECT_APPROVAL, (Boolean) null)
                .set(REQUESTS.ITERATION_RELATION, "Originates").set(REQUESTS.ITERATION_ID, iterationId)
                .where(REQUESTS.ID.eq(requestId)).execute();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("iterationId", iterationId);
        data.put("isRescan", false);
        data.put("batchSize", null);
        data.put("suggestion", null);
        events.record(new EventInput(EventCode.REQUEST_APPROVED, "request", requestId, null,
                new EventInput.User(requesterId), Correlation.newId(), at, json.valueToTree(data), null));
    }

    public record Result(String requestId, String documentId,
            List<ProposalPluginRuns.RegistryAnswer> registries,
            List<ProposalPluginRuns.RestrictionAnswer> restrictions, String error, boolean stale) {
        static Result stale(String requestId) {
            return new Result(requestId, null, List.of(), List.of(), null, true);
        }
    }
}
