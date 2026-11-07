package cz.mzk.vera.requests;

import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODIES;
import static cz.mzk.vera.db.tables.Tables.REQUEST_PLACEMENTS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static org.jooq.impl.DSL.exists;
import static org.jooq.impl.DSL.selectOne;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record2;
import org.jooq.Select;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Component;

// VIEW-requests: define a row, its asks, and the distinct non-fallback custodies in SQL.
@Component
public class RequestRows {
    private final DSLContext dsl;

    public RequestRows(DSLContext dsl) {
        this.dsl = dsl;
    }

    // VIEW-requests: the first available decision is Pending, then Denied, then Withdrawn.
    public Table<?> rows() {
        Field<Integer> rank = DSL.min(rankOf(REQUESTS.DECISION)).as("decision_rank");
        Table<?> ranked = dsl.select(REQUESTS.DOCUMENT_ID.as("document_id"), rank)
                .from(REQUESTS)
                .where(REQUESTS.DECISION.in("Pending", "Denied", "Withdrawn"))
                .groupBy(REQUESTS.DOCUMENT_ID)
                .asTable("ranked_request_rows");
        Field<String> decision = DSL.when(ranked.field("decision_rank", Integer.class).eq(1), "Pending")
                .when(ranked.field("decision_rank", Integer.class).eq(2), "Denied")
                .otherwise("Withdrawn").as("decision");
        return dsl.select(ranked.field("document_id", String.class), decision)
                .from(ranked).asTable("request_rows");
    }

    // VIEW-requests: only asks with the derived decision belong to a document's row.
    public Condition asksCondition(Table<?> rows) {
        Field<String> documentId = rows.field("document_id", String.class);
        Field<String> decision = rows.field("decision", String.class);
        return exists(selectOne().from(rows).where(documentId.eq(REQUESTS.DOCUMENT_ID)
                .and(decision.eq(REQUESTS.DECISION))));
    }

    public Condition documentHasRow(Field<String> documentId) {
        Table<?> rows = rows();
        return exists(selectOne().from(rows).where(rows.field("document_id", String.class).eq(documentId)));
    }

    // VIEW-requests; ACCESS-custody-request: use placed asks' distinct custodies, then fallback if empty.
    public Map<String, List<String>> custodyIdsOf(Collection<String> documentIds) {
        if (documentIds.isEmpty()) {
            return Map.of();
        }
        Table<?> allRows = rows();
        Field<String> allDocumentId = allRows.field("document_id", String.class);
        Table<?> rows = dsl.select(allDocumentId.as("document_id"),
                        allRows.field("decision", String.class).as("decision"))
                .from(allRows).where(allDocumentId.in(documentIds)).asTable("request_rows");
        Table<?> rowCustodies = custodiesFor(rows);
        Field<String> rowDocumentId = rowCustodies.field("document_id", String.class);
        Field<String> custodyId = rowCustodies.field("custody_id", String.class);
        Map<String, List<String>> result = new LinkedHashMap<>();
        dsl.select(rowDocumentId, custodyId).from(rowCustodies)
                .join(REQUEST_CUSTODIES).on(REQUEST_CUSTODIES.ID.eq(custodyId))
                .where(rowDocumentId.in(documentIds))
                .orderBy(rowDocumentId, REQUEST_CUSTODIES.POSITION)
                .fetch().forEach(row -> result.computeIfAbsent(row.get(rowDocumentId), ignored ->
                        new ArrayList<>()).add(row.get(custodyId)));
        for (String requestedDocumentId : documentIds) {
            if (!result.containsKey(requestedDocumentId)) {
                result.put(requestedDocumentId, List.of());
            }
        }
        return result;
    }

    public Table<?> custodies() {
        return custodiesFor(rows());
    }

    private Table<?> custodiesFor(Table<?> rows) {
        Field<String> documentId = rows.field("document_id", String.class);
        Field<String> decision = rows.field("decision", String.class);
        Select<Record2<String, String>> placed = placedCustodies(rows, documentId, decision);
        Table<?> fallbackRows = REQUEST_CUSTODIES.as("fallback_custody");
        Field<String> fallbackId = fallbackRows.field("id", String.class);
        Field<Boolean> isFallback = fallbackRows.field("is_fallback", Boolean.class);
        var placedForRow = REQUESTS.join(REQUEST_PLACEMENTS)
                .on(REQUEST_PLACEMENTS.REQUEST_ID.eq(REQUESTS.ID))
                .join(REQUEST_CUSTODIES).on(REQUEST_CUSTODIES.ID.eq(REQUEST_PLACEMENTS.CUSTODY_ID));
        Condition hasPlacedCustody = exists(dsl.selectOne().from(placedForRow)
                .where(REQUESTS.DOCUMENT_ID.eq(documentId).and(REQUESTS.DECISION.eq(decision))
                        .and(REQUEST_CUSTODIES.IS_FALLBACK.isFalse())));
        Condition fallbackCondition = isFallback.isTrue().and(DSL.not(hasPlacedCustody));
        Select<Record2<String, String>> fallback = dsl.select(documentId.as("document_id"),
                        fallbackId.as("custody_id"))
                .from(rows.crossJoin(fallbackRows)).where(fallbackCondition);
        return placed.unionAll(fallback).asTable("request_row_custodies");
    }

    private Select<Record2<String, String>> placedCustodies(
            Table<?> rows, Field<String> documentId, Field<String> decision) {
        return dsl.selectDistinct(documentId.as("document_id"), REQUEST_CUSTODIES.ID.as("custody_id"))
                .from(rows.join(REQUESTS).on(REQUESTS.DOCUMENT_ID.eq(documentId)
                                .and(REQUESTS.DECISION.eq(decision)))
                        .join(REQUEST_PLACEMENTS).on(REQUEST_PLACEMENTS.REQUEST_ID.eq(REQUESTS.ID))
                        .join(REQUEST_CUSTODIES).on(REQUEST_CUSTODIES.ID.eq(REQUEST_PLACEMENTS.CUSTODY_ID)))
                .where(REQUEST_CUSTODIES.IS_FALLBACK.isFalse());
    }

    private Field<Integer> rankOf(Field<String> decision) {
        return DSL.when(decision.eq("Pending"), 1).when(decision.eq("Denied"), 2).otherwise(3);
    }
}
