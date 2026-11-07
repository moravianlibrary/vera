package cz.mzk.vera.requests;

import static cz.mzk.vera.db.tables.Tables.BATCHES;
import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static org.jooq.impl.DSL.notExists;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.documents.DocumentCodes;
import cz.mzk.vera.documents.DocumentStates;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.domain.iterations.Iterations;
import cz.mzk.vera.events.Correlation;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.ingest.IngestQueue;
import cz.mzk.vera.session.HeldAccessQueries;
import java.time.Clock;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

// ACT-retry-batch; LC-ITER-ingest: retry each reachable failed current attempt in one transaction.
@Component
class BatchRetry {
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final EventRecorder events;
    private final DocumentStates states;
    private final IngestQueue queue;
    private final Clock clock;
    private final JsonMapper json;

    BatchRetry(DSLContext dsl, HeldAccessQueries access, EventRecorder events, DocumentStates states,
            IngestQueue queue, Clock clock, JsonMapper json) {
        this.dsl = dsl;
        this.access = access;
        this.events = events;
        this.states = states;
        this.queue = queue;
        this.clock = clock;
        this.json = json;
    }

    @Transactional
    ActResult retry(Caller caller, String batchId) {
        var held = access.scopesHeldBy(caller.userId());
        if (!held.hasPermission(DocumentCodes.REQUEST_RETRY)) {
            return ActResult.refused(403, "You may not retry additions", null);
        }
        if (!dsl.fetchExists(dsl.selectOne().from(BATCHES).where(BATCHES.ID.eq(batchId)))) {
            return ActResult.refused(404, "No such batch", null);
        }
        var laterAttempt = ITERATIONS.as("later_attempt");
        List<Failed> failed = dsl.select(ITERATIONS.ID, ITERATIONS.DOCUMENT_ID, ITERATIONS.CATEGORY_ID,
                        ITERATIONS.INGEST_FAILURE_ATTEMPTS, ITERATIONS.INGEST_FAILURE_ERROR,
                        REQUESTS.ID.as("request_id"))
                .from(ITERATIONS.join(REQUESTS).on(REQUESTS.ID.eq(ITERATIONS.REQUEST_ID)))
                .where(REQUESTS.BATCH_ID.eq(batchId)
                        .and(ITERATIONS.PROGRESS.eq("IngestFailed"))
                        .and(notExists(dsl.selectOne().from(laterAttempt)
                                .where(laterAttempt.DOCUMENT_ID.eq(ITERATIONS.DOCUMENT_ID)
                                        .and(laterAttempt.ATTEMPT.gt(ITERATIONS.ATTEMPT))))))
                .fetch(row -> new Failed(row.get(ITERATIONS.ID), row.get(ITERATIONS.DOCUMENT_ID),
                        row.get(ITERATIONS.CATEGORY_ID),
                        row.get(ITERATIONS.INGEST_FAILURE_ATTEMPTS), row.get(ITERATIONS.INGEST_FAILURE_ERROR),
                        row.get("request_id", String.class)));
        if (failed.isEmpty()) {
            return ActResult.refused(409, "Nothing in this batch failed to be added",
                    "batch.no_failed_items");
        }
        List<Category> categories = dsl.select(CATEGORIES.ID, CATEGORIES.PARENT_ID).from(CATEGORIES)
                .fetch(row -> new Category(row.value1(), row.value2()));
        List<Failed> retried = failed.stream().filter(item -> {
            var scope = Iterations.scopeOfIteration(categories, item.categoryId());
            return held.reachesIteration(DocumentCodes.REQUEST_RETRY, scope.categoryPathIds());
        }).toList();
        if (retried.isEmpty()) {
            return ActResult.refused(403, "What failed is outside your custody", "batch.outside_custody");
        }
        var at = clock.instant();
        String correlationId = Correlation.newId();
        List<String> ids = new ArrayList<>();
        for (Failed item : retried) {
            int attempt = (item.attempts() == null ? 0 : item.attempts()) + 1;
            dsl.update(ITERATIONS).set(ITERATIONS.PROGRESS, "Enqueued")
                    .set(ITERATIONS.INGEST_FAILURE_ATTEMPTS, attempt)
                    .set(ITERATIONS.INGEST_FAILURE_ERROR, item.error())
                    .where(ITERATIONS.ID.eq(item.iterationId())).execute();
            events.record(new EventInput(EventCode.REQUEST_INGEST_RETRIED, "request", item.requestId(), null,
                    new EventInput.User(caller.userId()), correlationId, at,
                    json.valueToTree(Map.of("attempt", attempt)),
                    new EventInput.Reason(null, null)));
            states.recompute(dsl, item.documentId());
            queue.queue(dsl, item.iterationId());
            ids.add(item.iterationId());
        }
        Map<String, Object> answer = new LinkedHashMap<>();
        answer.put("batchId", batchId);
        answer.put("retriedIds", ids);
        return ActResult.ok(answer);
    }

    private record Failed(
            String iterationId,
            String documentId,
            String categoryId,
            Integer attempts,
            String error,
            String requestId) {}
}
