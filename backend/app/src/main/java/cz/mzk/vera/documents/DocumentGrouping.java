package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.DOCUMENT_STATES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static org.jooq.impl.DSL.count;

import cz.mzk.vera.domain.documents.Documents.AdditionState;
import cz.mzk.vera.domain.listing.Listing;
import cz.mzk.vera.projects.ProjectQueries;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.CaseConditionStep;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Component;

// VIEW-documents-audience; ENT-batch; PROJECT-review: order groups and serve slice headers.
@Component
public class DocumentGrouping {
    private final DSLContext dsl;
    private final BatchQueries batches;
    private final ProjectQueries projects;

    public DocumentGrouping(DSLContext dsl, BatchQueries batches, ProjectQueries projects) {
        this.dsl = dsl;
        this.batches = batches;
        this.projects = projects;
    }

    public DocumentSearch.Grouping effective(DocumentSearch search, Audience audience, HeldScopes held) {
        if (search.grouping() == null || audience != Audience.STAFF
                || (search.grouping() == DocumentSearch.Grouping.BATCH
                    && !held.hasPermission(DocumentCodes.REQUEST_READ_INGEST))) {
            return null;
        }
        return search.grouping();
    }

    public Arrangement arrange(DocumentSearch.Grouping effective, Condition reach) {
        List<Map<String, Object>> servedRows = effective == DocumentSearch.Grouping.BATCH
            ? batches.served() : List.of();
        Map<String, Map<String, Object>> served = new LinkedHashMap<>();
        servedRows.forEach(batch -> served.put((String) batch.get("id"), batch));
        Map<String, Integer> counts = effective == DocumentSearch.Grouping.BATCH
            ? requestCounts() : Map.of();
        Field<Integer> rank = rank(effective, reach, served, counts);
        return new Arrangement(effective, reach, rank, servedRows, counts);
    }

    private Field<Integer> rank(DocumentSearch.Grouping effective, Condition reach,
            Map<String, Map<String, Object>> served, Map<String, Integer> requestCounts) {
        if (effective == null) {
            return DSL.inline(0);
        }
        List<String> keys = effective == DocumentSearch.Grouping.BATCH
            ? batchOrder(reach, served, requestCounts) : projects.idsByName();
        Field<String> key = effective == DocumentSearch.Grouping.BATCH
            ? DOCUMENT_STATES.BATCH_ID : DOCUMENT_STATES.PROJECT_ID;
        if (keys.isEmpty()) {
            return DSL.inline(0);
        }
        CaseConditionStep<Integer> rank = DSL.case_().when(key.eq(keys.getFirst()), 0);
        for (int index = 1; index < keys.size(); index++) {
            rank = rank.when(key.eq(keys.get(index)), index);
        }
        return rank.otherwise(keys.size()).cast(Integer.class);
    }

    private List<Map<String, Object>> headers(DocumentSearch.Grouping effective,
            List<String> sliceIds, List<String> allIds, Condition reach,
            List<Map<String, Object>> servedRows, Map<String, Integer> requestCounts) {
        if (effective == null) {
            return List.of();
        }
        Map<String, String> keysByDocument = dsl.select(DOCUMENT_STATES.DOCUMENT_ID,
                effective == DocumentSearch.Grouping.BATCH
                    ? DOCUMENT_STATES.BATCH_ID : DOCUMENT_STATES.PROJECT_ID)
            .from(DOCUMENT_STATES).where(DOCUMENT_STATES.DOCUMENT_ID.in(allIds)).fetchMap(
                row -> row.get(DOCUMENT_STATES.DOCUMENT_ID), row -> row.get(
                    effective == DocumentSearch.Grouping.BATCH
                        ? DOCUMENT_STATES.BATCH_ID : DOCUMENT_STATES.PROJECT_ID));
        if (effective == DocumentSearch.Grouping.BATCH) {
            return batchHeaders(sliceIds, allIds, keysByDocument, reach, servedRows, requestCounts);
        }
        return projectHeaders(sliceIds, allIds, keysByDocument);
    }

    public final class Arrangement {
        private final DocumentSearch.Grouping effective;
        private final Condition reach;
        private final Field<Integer> rank;
        private final List<Map<String, Object>> servedRows;
        private final Map<String, Integer> requestCounts;

        private Arrangement(DocumentSearch.Grouping effective, Condition reach, Field<Integer> rank,
                List<Map<String, Object>> servedRows, Map<String, Integer> requestCounts) {
            this.effective = effective;
            this.reach = reach;
            this.rank = rank;
            this.servedRows = servedRows;
            this.requestCounts = requestCounts;
        }

        public Field<Integer> rank() {
            return effective == null ? null : rank;
        }

        public List<Map<String, Object>> headersOf(List<String> sliceIds, List<String> allIds) {
            return headers(effective, sliceIds, allIds, reach, servedRows, requestCounts);
        }
    }

    private Map<String, Integer> requestCounts() {
        return dsl.select(REQUESTS.BATCH_ID, count().as("size")).from(REQUESTS)
            .where(REQUESTS.BATCH_ID.isNotNull()).groupBy(REQUESTS.BATCH_ID)
            .fetchMap(REQUESTS.BATCH_ID, row -> row.get("size", Integer.class));
    }

    private List<Map<String, Object>> batchHeaders(List<String> sliceIds, List<String> allIds,
            Map<String, String> keysByDocument, Condition reach, List<Map<String, Object>> servedRows,
            Map<String, Integer> requestCounts) {
        List<String> allKeys = keysFor(allIds, keysByDocument, requestCounts);
        List<String> sliceKeys = keysFor(sliceIds, keysByDocument, requestCounts);
        Map<String, Map<String, Object>> served = new LinkedHashMap<>();
        servedRows.forEach(batch -> served.put((String) batch.get("id"), batch));
        Map<String, Map<String, Integer>> additions = additionsByBatch(reach);
        List<Map<String, Object>> headers = new ArrayList<>();
        for (Listing.Header header : Listing.headersOf(sliceKeys, allKeys)) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("kind", "batch");
            item.put("batch", header.key() == null ? null : served.get(header.key()));
            item.put("size", header.key() == null ? header.total()
                : additions.getOrDefault(header.key(), zeroAdditions()).values().stream()
                    .mapToInt(Integer::intValue).sum());
            item.put("additions", header.key() == null ? zeroAdditions()
                : additions.getOrDefault(header.key(), zeroAdditions()));
            item.put("total", header.total());
            item.put("rowCount", header.rowCount());
            headers.add(item);
        }
        return List.copyOf(headers);
    }

    private List<Map<String, Object>> projectHeaders(List<String> sliceIds, List<String> allIds,
            Map<String, String> keysByDocument) {
        List<String> allKeys = projectKeysFor(allIds, keysByDocument);
        List<String> sliceKeys = projectKeysFor(sliceIds, keysByDocument);
        List<String> ids = allKeys.stream().filter(key -> key != null).distinct().toList();
        Map<String, Map<String, Object>> projectRows = projects.projectsOf(ids);
        List<Map<String, Object>> headers = new ArrayList<>();
        for (Listing.Header header : Listing.headersOf(sliceKeys, allKeys)) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("kind", "project");
            item.put("project", header.key() == null ? null : projectRows.get(header.key()));
            item.put("total", header.total());
            item.put("rowCount", header.rowCount());
            headers.add(item);
        }
        return List.copyOf(headers);
    }

    private List<String> batchOrder(Condition reach, Map<String, Map<String, Object>> served,
            Map<String, Integer> requestsPerBatch) {
        Map<String, Integer> failed = dsl.select(DOCUMENT_STATES.BATCH_ID, count().as("failed"))
            .from(DOCUMENT_STATES).join(DOCUMENTS).on(DOCUMENTS.ID.eq(DOCUMENT_STATES.DOCUMENT_ID))
            .where(DOCUMENT_STATES.ADDITION_STATE.eq(AdditionState.Failed.wireName()).and(reach))
            .groupBy(DOCUMENT_STATES.BATCH_ID)
            .fetchMap(DOCUMENT_STATES.BATCH_ID, row -> row.get("failed", Integer.class));
        return served.values().stream().map(batch -> (String) batch.get("id"))
            .filter(id -> requestsPerBatch.getOrDefault(id, 0) >= 2)
            .sorted(Comparator.<String>comparingInt(id -> failed.getOrDefault(id, 0)).reversed()
                .thenComparing(id -> (String) served.get(id).get("submittedAt"), Comparator.reverseOrder()))
            .toList();
    }

    private Map<String, Map<String, Integer>> additionsByBatch(Condition reach) {
        Map<String, Map<String, Integer>> result = new LinkedHashMap<>();
        dsl.select(DOCUMENT_STATES.BATCH_ID, DOCUMENT_STATES.ADDITION_STATE, count().as("size"))
            .from(DOCUMENT_STATES).join(DOCUMENTS).on(DOCUMENTS.ID.eq(DOCUMENT_STATES.DOCUMENT_ID))
            .where(DOCUMENT_STATES.BATCH_ID.isNotNull().and(reach))
            .groupBy(DOCUMENT_STATES.BATCH_ID, DOCUMENT_STATES.ADDITION_STATE).fetch().forEach(row -> {
                result.computeIfAbsent(row.get(DOCUMENT_STATES.BATCH_ID), ignored -> zeroAdditions())
                    .put(row.get(DOCUMENT_STATES.ADDITION_STATE), row.get("size", Integer.class));
            });
        return result;
    }

    private List<String> keysFor(List<String> ids, Map<String, String> keysByDocument,
            Map<String, Integer> requestCounts) {
        List<String> keys = new ArrayList<>();
        for (String id : ids) {
            String key = keysByDocument.get(id);
            if (key != null && requestCounts.getOrDefault(key, 0) < 2) {
                key = null;
            }
            keys.add(key);
        }
        return keys;
    }

    private List<String> projectKeysFor(List<String> ids, Map<String, String> keysByDocument) {
        List<String> keys = new ArrayList<>();
        for (String id : ids) {
            keys.add(keysByDocument.get(id));
        }
        return keys;
    }

    private Map<String, Integer> zeroAdditions() {
        Map<String, Integer> values = new LinkedHashMap<>();
        for (AdditionState state : AdditionState.values()) {
            values.put(state.wireName(), 0);
        }
        return values;
    }
}
