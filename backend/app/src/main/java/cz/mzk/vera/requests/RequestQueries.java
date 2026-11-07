package cz.mzk.vera.requests;

import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODIES;

import cz.mzk.vera.documents.DocumentCodes;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

// VIEW-requests; ACCESS-membership-not-capability: read a reachable Requests row and its custody list.
@Repository
public class RequestQueries {
    private final DSLContext dsl;
    private final HeldAccessQueries heldAccess;
    private final RequestReach reach;
    private final RequestRowReader reader;

    public RequestQueries(DSLContext dsl, HeldAccessQueries heldAccess, RequestReach reach,
            RequestRowReader reader) {
        this.dsl = dsl;
        this.heldAccess = heldAccess;
        this.reach = reach;
        this.reader = reader;
    }

    public boolean canReadRequests(String callerId) {
        return reach.canReadRequests(heldAccess.scopesHeldBy(callerId));
    }

    public Map<String, Object> detail(String documentId, String callerId) {
        HeldScopes held = heldAccess.scopesHeldBy(callerId);
        if (dsl.select(DOCUMENTS.ID).from(DOCUMENTS)
                .where(DOCUMENTS.ID.eq(documentId)
                        .and(reach.condition(held, callerId, DocumentCodes.REQUEST_READ, DOCUMENTS.ID)))
                .fetchOne() == null) {
            return null;
        }
        Map<String, Object> row = reader.rowsOf(List.of(documentId), held).get(documentId);
        if (row == null) {
            return null;
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("row", row);
        @SuppressWarnings("unchecked")
        Map<String, Object> record = (Map<String, Object>) row.get("record");
        result.put("log", reader.logOf(record, held));
        result.put("canDecide", "Pending".equals(row.get("decision"))
                && dsl.select(DOCUMENTS.ID).from(DOCUMENTS)
                        .where(DOCUMENTS.ID.eq(documentId)
                                .and(reach.condition(held, callerId, DocumentCodes.REQUEST_DECIDE, DOCUMENTS.ID)))
                        .fetchOne() != null);
        return result;
    }

    public List<Map<String, Object>> custodies() {
        return dsl.selectFrom(REQUEST_CUSTODIES)
                .orderBy(REQUEST_CUSTODIES.IS_FALLBACK.desc(), REQUEST_CUSTODIES.POSITION)
                .fetch(row -> {
                    Map<String, Object> custody = new LinkedHashMap<>();
                    custody.put("id", row.getId());
                    custody.put("name", row.getName());
                    custody.put("description", row.getDescription());
                    custody.put("isFallback", row.getIsFallback());
                    return custody;
                });
    }
}
