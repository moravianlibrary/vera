package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;

import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

// VIEW-documents-audience: read one detail through the shared reach and record projections.
@Repository
public class DocumentQueries {
    private final DSLContext dsl;
    private final HeldAccessQueries heldAccess;
    private final DocumentReach reach;
    private final DocumentRecords records;
    private final DocumentRedaction redaction;
    private final DocumentHistory history;

    public DocumentQueries(DSLContext dsl, HeldAccessQueries heldAccess, DocumentReach reach,
            DocumentRecords records, DocumentRedaction redaction, DocumentHistory history) {
        this.dsl = dsl;
        this.heldAccess = heldAccess;
        this.reach = reach;
        this.records = records;
        this.redaction = redaction;
        this.history = history;
    }

    public Map<String, Object> detail(String documentId, String callerId, boolean mine) {
        HeldScopes held = heldAccess.scopesHeldBy(callerId);
        Audience audience = mine || !held.hasPermission("iteration.read") ? Audience.PUBLIC : Audience.STAFF;
        if (dsl.select(DOCUMENTS.ID).from(DOCUMENTS).where(DOCUMENTS.ID.eq(documentId)
                .and(reach.condition(held, callerId, audience))).fetchOne() == null) {
            return null;
        }
        Map<String, Object> record = records.recordsOf(List.of(documentId)).get(documentId);
        redaction.redact(record, held, callerId, documentId, audience);
        Set<String> subjects = new LinkedHashSet<>();
        subjects.add(documentId);
        addSubjects(subjects, record, "iterations");
        addSubjects(subjects, record, "requests");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("audience", audience.wireName());
        result.put("record", record);
        result.put("log", history.logOf(subjects, held, audience));
        return result;
    }

    public boolean canOpenMyDocuments(String callerId) {
        return heldAccess.scopesHeldBy(callerId).hasPermission("request.read_mine");
    }

    @SuppressWarnings("unchecked")
    private void addSubjects(Set<String> subjects, Map<String, Object> record, String key) {
        ((List<Map<String, Object>>) record.get(key)).forEach(row -> subjects.add((String) row.get("id")));
    }
}
