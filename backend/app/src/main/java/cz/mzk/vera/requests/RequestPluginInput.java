package cz.mzk.vera.requests;

import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;

import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.records.Request;
import org.jooq.DSLContext;
import org.jooq.Record;

// PLG-api-kinds; ACCESS-custody-by-plugins: share the request and document plugin projection.
record RequestPluginInput(Request request, Document document) {
    static RequestPluginInput read(DSLContext dsl, String requestId) {
        Record row = dsl.select(REQUESTS.ID, REQUESTS.DOCUMENT_ID, REQUESTS.REQUESTER_ID,
                        REQUESTS.AT, REQUESTS.REASON, REQUESTS.BATCH_ID, REQUESTS.PROJECT_ID,
                        REQUESTS.CHECKED_AT, REQUESTS.DECISION,
                        DOCUMENTS.ID, DOCUMENTS.CATALOG_ID, DOCUMENTS.UNIT_TYPE,
                        DOCUMENTS.UNIT_VALUE, DOCUMENTS.TITLE, DOCUMENTS.TYPE, DOCUMENTS.SHELF_MARK)
                .from(REQUESTS.join(DOCUMENTS).on(REQUESTS.DOCUMENT_ID.eq(DOCUMENTS.ID)))
                .where(REQUESTS.ID.eq(requestId))
                .fetchOne();
        if (row == null) {
            throw new IllegalArgumentException("Unknown request " + requestId);
        }
        Document.Unit unit = row.get(DOCUMENTS.UNIT_TYPE) == null ? null
                : new Document.Unit(row.get(DOCUMENTS.UNIT_TYPE), row.get(DOCUMENTS.UNIT_VALUE));
        Document document = new Document(row.get(DOCUMENTS.ID), row.get(DOCUMENTS.CATALOG_ID), unit,
                row.get(DOCUMENTS.TITLE), row.get(DOCUMENTS.TYPE), row.get(DOCUMENTS.SHELF_MARK));
        Request request = new Request(row.get(REQUESTS.ID), row.get(REQUESTS.DOCUMENT_ID),
                row.get(REQUESTS.REQUESTER_ID), row.get(REQUESTS.AT).toInstant(),
                row.get(REQUESTS.REASON),
                row.get(REQUESTS.BATCH_ID), row.get(REQUESTS.PROJECT_ID),
                row.get(REQUESTS.CHECKED_AT) == null ? null : row.get(REQUESTS.CHECKED_AT).toInstant(),
                row.get(REQUESTS.DECISION));
        return new RequestPluginInput(request, document);
    }
}
