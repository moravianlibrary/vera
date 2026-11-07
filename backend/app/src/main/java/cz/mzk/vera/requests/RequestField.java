package cz.mzk.vera.requests;

import static cz.mzk.vera.db.tables.Tables.BATCHES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODIES;
import static cz.mzk.vera.db.tables.Tables.REQUEST_PLACEMENTS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES;

import cz.mzk.vera.listing.FacetSource;
import org.jooq.DSLContext;
import org.jooq.Record3;
import org.jooq.Select;
import org.jooq.Table;
import org.jooq.impl.DSL;

// FILTER-requests: identify each query field and the stored values its facet counts.
enum RequestField {
    DECISIONS("decision", "decisions", "decisions"),
    CUSTODIES("custody", "custodyIds", "custodyIds"),
    TYPES("type", "documentTypes", "documentTypes"),
    PROJECTS("project", "projectIds", "projectIds"),
    COPIES("copy", "existingCopies", "existingCopies"),
    ASKERS("asker", "askerIds", "askerIds"),
    BATCH_IDS("batch", "batchIds", "batchIds"),
    SOURCES("source", "sources", "sources"),
    ASKER_COUNTS("askers", "askerCounts", "askerCounts"),
    AFTER_APPROVAL("after", "afterProjectApproval", "afterProjectApproval");

    private final String queryName;
    private final String facetName;
    private final String listName;

    RequestField(String queryName, String facetName, String listName) {
        this.queryName = queryName;
        this.facetName = facetName;
        this.listName = listName;
    }

    String queryName() {
        return queryName;
    }

    String facetName() {
        return facetName;
    }

    String listName() {
        return listName;
    }

    FacetSource facetSource(DSLContext dsl, Table<?> rows) {
        var documentId = rows.field("document_id", String.class);
        var decision = rows.field("decision", String.class);
        Select<Record3<String, String, Integer>> values = switch (this) {
            case DECISIONS -> dsl.select(documentId, decision, DSL.inline(0)).from(rows);
            case CUSTODIES -> {
                Table<?> custodies = new RequestRows(dsl).custodies();
                yield dsl.select(custodies.field("document_id", String.class),
                        custodies.field("custody_id", String.class),
                        REQUEST_CUSTODIES.POSITION.cast(Integer.class))
                        .from(custodies.join(REQUEST_CUSTODIES)
                                .on(REQUEST_CUSTODIES.ID.eq(
                                        custodies.field("custody_id", String.class))));
            }
            case TYPES -> dsl.select(DOCUMENTS.ID, DOCUMENTS.TYPE, DSL.inline(0))
                    .from(rows.join(DOCUMENTS).on(DOCUMENTS.ID.eq(documentId)));
            case PROJECTS -> dsl.selectDistinct(REQUESTS.DOCUMENT_ID, REQUESTS.PROJECT_ID,
                            DSL.rowNumber().over(DSL.partitionBy(REQUESTS.DOCUMENT_ID)
                                    .orderBy(DSL.min(REQUESTS.AT))).cast(Integer.class))
                    .from(rows.join(REQUESTS).on(REQUESTS.DOCUMENT_ID.eq(documentId)
                            .and(REQUESTS.DECISION.eq(decision))))
                    .where(REQUESTS.PROJECT_ID.isNotNull())
                    .groupBy(REQUESTS.DOCUMENT_ID, REQUESTS.PROJECT_ID);
            case COPIES -> dsl.select(DSL.field("copy_values.document_id", String.class),
                            DSL.field("copy_values.state", String.class), DSL.field("copy_values.ordinal", Integer.class))
                    .from(DSL.selectDistinct(REQUESTS.DOCUMENT_ID.as("document_id"),
                                    REQUEST_EXISTING_COPIES.STATE.as("state"), DSL.inline(0).as("ordinal"))
                            .from(rows.join(REQUESTS).on(REQUESTS.DOCUMENT_ID.eq(documentId)
                                            .and(REQUESTS.DECISION.eq(decision)))
                                    .join(REQUEST_EXISTING_COPIES)
                                    .on(REQUEST_EXISTING_COPIES.REQUEST_ID.eq(REQUESTS.ID)))
                            .unionAll(dsl.select(documentId, DSL.inline("None"), DSL.inline(0))
                                    .from(rows).where(DSL.notExists(dsl.selectOne()
                                            .from(REQUESTS.join(REQUEST_EXISTING_COPIES)
                                                    .on(REQUEST_EXISTING_COPIES.REQUEST_ID.eq(REQUESTS.ID)))
                                            .where(REQUESTS.DOCUMENT_ID.eq(documentId)
                                                    .and(REQUESTS.DECISION.eq(decision))))))
                            .asTable("copy_values"));
            case ASKERS -> dsl.select(REQUESTS.DOCUMENT_ID, REQUESTS.REQUESTER_ID,
                            DSL.rowNumber().over(DSL.partitionBy(REQUESTS.DOCUMENT_ID)
                                    .orderBy(DSL.min(REQUESTS.AT), DSL.min(REQUESTS.ID))).cast(Integer.class))
                    .from(rows.join(REQUESTS).on(REQUESTS.DOCUMENT_ID.eq(documentId)
                            .and(REQUESTS.DECISION.eq(decision))))
                    .groupBy(REQUESTS.DOCUMENT_ID, REQUESTS.REQUESTER_ID);
            case BATCH_IDS -> dsl.selectDistinct(REQUESTS.DOCUMENT_ID, REQUESTS.BATCH_ID,
                            DSL.rowNumber().over(DSL.partitionBy(REQUESTS.DOCUMENT_ID)
                                    .orderBy(DSL.min(REQUESTS.AT))).cast(Integer.class))
                    .from(rows.join(REQUESTS).on(REQUESTS.DOCUMENT_ID.eq(documentId)
                            .and(REQUESTS.DECISION.eq(decision))))
                    .where(DSL.selectCount().from(REQUESTS.as("batch_request"))
                            .where(DSL.field("batch_request.batch_id", String.class).eq(REQUESTS.BATCH_ID))
                            .asField().ge(2))
                    .groupBy(REQUESTS.DOCUMENT_ID, REQUESTS.BATCH_ID);
            case SOURCES -> dsl.selectDistinct(REQUESTS.DOCUMENT_ID, BATCHES.SOURCE_INSTANCE_ID,
                            DSL.rowNumber().over(DSL.partitionBy(REQUESTS.DOCUMENT_ID)
                                    .orderBy(DSL.min(REQUESTS.AT))).cast(Integer.class))
                    .from(rows.join(REQUESTS).on(REQUESTS.DOCUMENT_ID.eq(documentId)
                                    .and(REQUESTS.DECISION.eq(decision)))
                            .join(BATCHES).on(BATCHES.ID.eq(REQUESTS.BATCH_ID)))
                    .where(BATCHES.SOURCE_INSTANCE_ID.isNotNull())
                    .groupBy(REQUESTS.DOCUMENT_ID, BATCHES.SOURCE_INSTANCE_ID);
            case ASKER_COUNTS -> dsl.select(documentId,
                            DSL.when(DSL.countDistinct(REQUESTS.REQUESTER_ID).gt(1), "Several")
                                    .otherwise("One"), DSL.inline(0))
                    .from(rows.join(REQUESTS).on(REQUESTS.DOCUMENT_ID.eq(documentId)
                            .and(REQUESTS.DECISION.eq(decision))))
                    .groupBy(documentId);
            case AFTER_APPROVAL -> dsl.select(documentId,
                            DSL.when(DSL.boolOr(DSL.and(REQUESTS.IS_AFTER_PROJECT_APPROVAL.isTrue(),
                                    REQUESTS.DECISION.eq("Pending"))).isTrue(), "Yes")
                                    .otherwise("No"), DSL.inline(0))
                    .from(rows.join(REQUESTS).on(REQUESTS.DOCUMENT_ID.eq(documentId)
                            .and(REQUESTS.DECISION.eq(decision))))
                    .groupBy(documentId);
        };
        return new FacetSource(facetName, values, null);
    }
}
