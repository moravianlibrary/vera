package cz.mzk.vera.requests;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_SUGGESTIONS;

import cz.mzk.vera.documents.Audience;
import cz.mzk.vera.documents.DocumentCodes;
import cz.mzk.vera.documents.DocumentHistory;
import cz.mzk.vera.documents.DocumentRecords;
import cz.mzk.vera.documents.DocumentRedaction;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jooq.DSLContext;
import org.jooq.Table;
import org.springframework.stereotype.Repository;

// VIEW-requests; DOC-property-visibility; LOG-where-read: batch-read rows, their asks and history.
@Repository
public class RequestRowReader {
    private final DSLContext dsl;
    private final RequestRows rows;
    private final DocumentRecords records;
    private final DocumentRedaction redaction;
    private final DocumentHistory history;

    public RequestRowReader(DSLContext dsl, RequestRows rows, DocumentRecords records,
            DocumentRedaction redaction, DocumentHistory history) {
        this.dsl = dsl;
        this.rows = rows;
        this.records = records;
        this.redaction = redaction;
        this.history = history;
    }

    public Map<String, Map<String, Object>> rowsOf(Collection<String> documentIds, HeldScopes held) {
        if (documentIds.isEmpty()) {
            return Map.of();
        }
        Table<?> rowTable = rows.rows();
        Map<String, String> decisions = new LinkedHashMap<>();
        dsl.select(rowTable.field("document_id", String.class), rowTable.field("decision", String.class))
                .from(rowTable).where(rowTable.field("document_id", String.class).in(documentIds))
                .fetch().forEach(row -> decisions.put(row.value1(), row.value2()));
        if (decisions.isEmpty()) {
            return Map.of();
        }
        List<String> askIds = dsl.select(REQUESTS.ID).from(REQUESTS)
                .where(REQUESTS.DOCUMENT_ID.in(decisions.keySet()).and(rows.asksCondition(rowTable)))
                .orderBy(REQUESTS.DOCUMENT_ID, REQUESTS.AT, REQUESTS.ID)
                .fetch(REQUESTS.ID);
        Map<String, Map<String, Object>> recordsById = records.recordsOf(decisions.keySet(), askIds);
        Map<String, List<String>> custodyIds = rows.custodyIdsOf(decisions.keySet());
        Map<String, List<String>> requestsByDocument = new LinkedHashMap<>();
        recordsById.forEach((documentId, record) -> requestsByDocument.put(documentId, requestIdsOf(record)));
        List<String> firstAskIds = requestsByDocument.values().stream()
                .filter(askIdsForDocument -> !askIdsForDocument.isEmpty())
                .map(List::getFirst).toList();
        Map<String, Map<String, Object>> suggestions = suggestionsOf(firstAskIds);
        Map<String, Map<String, Object>> result = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : decisions.entrySet()) {
            String documentId = entry.getKey();
            Map<String, Object> record = recordsById.get(documentId);
            if (!held.hasPermission(DocumentCodes.ITERATION_READ)) {
                redaction.publicPropertiesOnly(record);
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("record", record);
            row.put("decision", entry.getValue());
            row.put("custodyIds", custodyIds.getOrDefault(documentId, List.of()));
            List<String> asks = requestsByDocument.getOrDefault(documentId, List.of());
            row.put("suggestion", asks.isEmpty() ? null : suggestions.get(asks.getFirst()));
            result.put(documentId, row);
        }
        return result;
    }

    public List<Map<String, Object>> logOf(Map<String, Object> record, HeldScopes held) {
        Set<String> subjects = new LinkedHashSet<>();
        addSubjects(subjects, record, "requests");
        addSubjects(subjects, record, "iterations");
        return history.logOf(subjects, held, Audience.STAFF, false);
    }

    private Map<String, Map<String, Object>> suggestionsOf(List<String> askIds) {
        if (askIds.isEmpty()) {
            return Map.of();
        }
        Map<String, Map<String, Object>> result = new LinkedHashMap<>();
        dsl.select(REQUEST_SUGGESTIONS.REQUEST_ID, REQUEST_SUGGESTIONS.CATEGORY_ID,
                        REQUEST_SUGGESTIONS.REASON, REQUEST_SUGGESTIONS.CLASSIFIER_ID,
                        PLUGIN_INSTANCES.NAME)
                .from(REQUEST_SUGGESTIONS.join(PLUGIN_INSTANCES)
                        .on(PLUGIN_INSTANCES.ID.eq(REQUEST_SUGGESTIONS.CLASSIFIER_ID)))
                .where(REQUEST_SUGGESTIONS.REQUEST_ID.in(askIds))
                .fetch().forEach(row -> {
                    Map<String, Object> classifier = new LinkedHashMap<>();
                    classifier.put("id", row.get(REQUEST_SUGGESTIONS.CLASSIFIER_ID));
                    classifier.put("name", row.get(PLUGIN_INSTANCES.NAME));
                    Map<String, Object> suggestion = new LinkedHashMap<>();
                    suggestion.put("categoryId", row.get(REQUEST_SUGGESTIONS.CATEGORY_ID));
                    suggestion.put("reason", row.get(REQUEST_SUGGESTIONS.REASON));
                    suggestion.put("classifier", classifier);
                    result.put(row.get(REQUEST_SUGGESTIONS.REQUEST_ID), suggestion);
                });
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<String> requestIdsOf(Map<String, Object> record) {
        return ((List<Map<String, Object>>) record.get("requests")).stream()
                .map(request -> (String) request.get("id")).toList();
    }

    @SuppressWarnings("unchecked")
    private void addSubjects(Set<String> subjects, Map<String, Object> record, String key) {
        ((List<Map<String, Object>>) record.get(key)).forEach(row -> subjects.add((String) row.get("id")));
    }
}
