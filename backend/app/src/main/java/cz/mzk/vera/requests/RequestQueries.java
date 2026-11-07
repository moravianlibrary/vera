package cz.mzk.vera.requests;

import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODIES;
import static cz.mzk.vera.db.tables.Tables.BATCHES;
import static cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static org.jooq.impl.DSL.count;

import cz.mzk.vera.documents.DocumentCodes;
import cz.mzk.vera.documents.DocumentQueries;
import cz.mzk.vera.domain.listing.Listing;
import cz.mzk.vera.listing.Facets;
import cz.mzk.vera.listing.ListQuery;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import java.time.Clock;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.Condition;
import org.jooq.Field;
import org.jooq.Record1;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

// VIEW-requests; ACCESS-membership-not-capability: read a reachable Requests row and its custody list.
@Repository
public class RequestQueries {
    private final DSLContext dsl;
    private final HeldAccessQueries heldAccess;
    private final RequestReach reach;
    private final RequestRowReader reader;
    private final Facets facets;
    private final ListQuery listQuery;
    private final RequestGrouping grouping;
    private final Clock clock;
    private final DocumentQueries documentQueries;

    public RequestQueries(DSLContext dsl, HeldAccessQueries heldAccess, RequestReach reach,
            RequestRowReader reader, Facets facets, ListQuery listQuery, RequestGrouping grouping,
            Clock clock, DocumentQueries documentQueries) {
        this.dsl = dsl;
        this.heldAccess = heldAccess;
        this.reach = reach;
        this.reader = reader;
        this.facets = facets;
        this.listQuery = listQuery;
        this.grouping = grouping;
        this.clock = clock;
        this.documentQueries = documentQueries;
    }

    public Map<String, Object> page(Map<String, String> parameters, String callerId) {
        HeldScopes held = heldAccess.scopesHeldBy(callerId);
        RequestSearch search = RequestSearch.parse(parameters, documentQueries.requestPropertyKeys(held));
        Condition reachCondition = reach.condition(held, callerId, DocumentCodes.REQUEST_READ, DOCUMENTS.ID);
        Condition filters = filters(search, null, held);
        var rows = this.readerRows();
        Field<String> rowId = rows.field("document_id", String.class);
        Field<String> rowDecision = rows.field("decision", String.class);
        Condition matching = reachCondition.and(filters);
        RequestGrouping.Arrangement arrangement = grouping.arrange(search.grouping(),
                search.grouping() == null ? List.of() : listQuery.ids(orderedQuery(rowId, rowDecision, matching)),
                rows, matching, reach.condition(held, callerId, DocumentCodes.REQUEST_DECIDE, DOCUMENTS.ID));
        List<String> ids = listQuery.ids(orderedQuery(rowId, rowDecision, matching, arrangement.rank()));
        Listing.Slice slice = Listing.sliceOf(ids, search.cursor(), search.limit());
        Map<String, Map<String, Object>> rowsForSlice = reader.rowsOf(slice.items(), held);
        List<Map<String, Object>> items = slice.items().stream().map(rowsForSlice::get).toList();
        Map<String, Object> facetResult = facets(search, reachCondition, held);
        Map<String, Object> propertyFacetResult = propertyFacets(search, reachCondition, held);
        int askTotal = ids.isEmpty() ? 0 : dsl.select(count()).from(REQUESTS)
                .where(REQUESTS.DOCUMENT_ID.in(ids).and(this.readerRowsCondition())).fetchOne(0, int.class);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("total", ids.size());
        result.put("askTotal", askTotal);
        result.put("nextCursor", slice.nextCursor());
        result.put("groups", arrangement.headersOf(slice.items(), ids));
        result.put("facets", facetResult);
        result.put("propertyFacets", propertyFacetResult);
        return result;
    }

    private org.jooq.Select<Record1<String>> orderedQuery(Field<String> rowId, Field<String> rowDecision,
            Condition matching) {
        return orderedQuery(rowId, rowDecision, matching, null);
    }

    private org.jooq.Select<Record1<String>> orderedQuery(Field<String> rowId, Field<String> rowDecision,
            Condition matching, Field<Integer> rank) {
        var query = dsl.select(rowId).from(readerRows().join(DOCUMENTS).on(DOCUMENTS.ID.eq(rowId)))
                .where(matching);
        if (rank == null) {
            return query.orderBy(order(rowId, rowDecision));
        }
        List<org.jooq.SortField<?>> order = new java.util.ArrayList<>();
        order.add(rank.asc());
        order.addAll(order(rowId, rowDecision));
        return query.orderBy(order);
    }

    private org.jooq.Table<?> readerRows() {
        return new RequestRows(dsl).rows();
    }

    private Condition readerRowsCondition() {
        return new RequestRows(dsl).asksCondition(readerRows());
    }

    private Condition filters(RequestSearch search, String omitFacet, HeldScopes held) {
        Condition result = DSL.noCondition();
        for (Map.Entry<String, List<String>> field : search.lists().entrySet()) {
            RequestField requestField = java.util.Arrays.stream(RequestField.values())
                    .filter(candidate -> candidate.listName().equals(field.getKey())).findFirst().orElseThrow();
            if (field.getValue().isEmpty() || requestField.facetName().equals(omitFacet)) {
                continue;
            }
            result = result.and(listCondition(field.getKey(), field.getValue()));
        }
        if (search.search() != null) {
            String value = search.search();
            result = result.and(DOCUMENTS.TITLE.containsIgnoreCase(value)
                    .or(DOCUMENTS.CATALOG_ID.containsIgnoreCase(value))
                    .or(DOCUMENTS.UNIT_VALUE.containsIgnoreCase(value))
                    .or(DOCUMENTS.SHELF_MARK.containsIgnoreCase(value))
                    .or(askExists(REQUESTS.ID.equalIgnoreCase(value)
                            .or(DSL.exists(DSL.selectOne().from(USERS)
                                    .where(USERS.ID.eq(REQUESTS.REQUESTER_ID)
                                            .and(USERS.NAME.containsIgnoreCase(value)))))
                            .or(DSL.exists(DSL.selectOne().from(BATCHES)
                                    .where(BATCHES.ID.eq(REQUESTS.BATCH_ID)
                                            .and(BATCHES.ID.containsIgnoreCase(value))))))));
        }
        if (!search.properties().isEmpty()) {
            String omittedProperty = omitFacet != null && omitFacet.startsWith("p.") ? omitFacet : null;
            result = result.and(documentQueries.requestPropertyCondition(search.properties(), held,
                    omittedProperty, LocalDate.now(clock)));
        }
        if (search.asked() != null) {
            var range = cz.mzk.vera.domain.valuerange.ValueRange.resolveDayRange(search.asked(),
                    LocalDate.now(clock));
            Condition date = DSL.trueCondition();
            if (range.from() != null) {
                date = date.and(DSL.field("{0} at time zone 'UTC'", java.time.LocalDateTime.class,
                        REQUESTS.AT).cast(LocalDate.class).ge(LocalDate.parse(range.from())));
            }
            if (range.to() != null) {
                date = date.and(DSL.field("{0} at time zone 'UTC'", java.time.LocalDateTime.class,
                        REQUESTS.AT).cast(LocalDate.class).le(LocalDate.parse(range.to())));
            }
            result = result.and(askExists(date));
        }
        return result;
    }

    private Condition listCondition(String field, List<String> values) {
        return switch (field) {
            case "decisions" -> DSL.exists(DSL.selectOne().from(readerRows())
                    .where(readerRows().field("document_id", String.class).eq(DOCUMENTS.ID)
                            .and(readerRows().field("decision", String.class).in(values))));
            case "custodyIds" -> DSL.exists(DSL.selectOne().from(new RequestRows(dsl).custodies())
                    .where(DSL.field("document_id", String.class).eq(DOCUMENTS.ID)
                            .and(DSL.field("custody_id", String.class).in(values))));
            case "documentTypes" -> DOCUMENTS.TYPE.in(values);
            case "projectIds" -> askExists(REQUESTS.PROJECT_ID.in(values));
            case "askerIds" -> askExists(REQUESTS.REQUESTER_ID.in(values));
            case "batchIds" -> askExists(REQUESTS.BATCH_ID.in(values).and(DSL.selectCount()
                    .from(REQUESTS.as("batch_size")).where(DSL.field("batch_size.batch_id", String.class)
                            .eq(REQUESTS.BATCH_ID)).asField().ge(2)));
            case "existingCopies" -> {
                Condition matchingCopy = askExists(DSL.exists(DSL.selectOne().from(REQUEST_EXISTING_COPIES)
                        .where(REQUEST_EXISTING_COPIES.REQUEST_ID.eq(REQUESTS.ID)
                                .and(REQUEST_EXISTING_COPIES.STATE.in(values)))));
                if (values.contains("None")) {
                    Condition noCopies = DSL.notExists(DSL.selectOne().from(readerRows()
                            .join(REQUESTS).on(REQUESTS.DOCUMENT_ID.eq(readerRows().field("document_id", String.class))
                                    .and(REQUESTS.DECISION.eq(readerRows().field("decision", String.class)))))
                            .join(REQUEST_EXISTING_COPIES)
                            .on(REQUEST_EXISTING_COPIES.REQUEST_ID.eq(REQUESTS.ID))
                            .where(readerRows().field("document_id", String.class).eq(DOCUMENTS.ID)));
                    yield matchingCopy.or(noCopies);
                }
                yield matchingCopy;
            }
            case "sources" -> askExists(DSL.exists(DSL.selectOne().from(BATCHES)
                    .where(BATCHES.ID.eq(REQUESTS.BATCH_ID)
                            .and(BATCHES.SOURCE_INSTANCE_ID.in(values)))));
            case "askerCounts" -> values.contains("Several")
                    ? askExists(DSL.select(DSL.countDistinct(DSL.field("asker_count.requester_id", String.class)))
                            .from(REQUESTS.as("asker_count"))
                            .where(DSL.field("asker_count.document_id", String.class).eq(REQUESTS.DOCUMENT_ID)
                                    .and(DSL.field("asker_count.decision", String.class).eq(REQUESTS.DECISION)))
                            .asField().ge(2))
                    : askExists(DSL.select(DSL.countDistinct(DSL.field("asker_count.requester_id", String.class)))
                            .from(REQUESTS.as("asker_count"))
                            .where(DSL.field("asker_count.document_id", String.class).eq(REQUESTS.DOCUMENT_ID)
                                    .and(DSL.field("asker_count.decision", String.class).eq(REQUESTS.DECISION)))
                            .asField().eq(1));
            case "afterProjectApproval" -> afterApprovalCondition(values);
            default -> DSL.noCondition();
        };
    }

    private Condition askExists(Condition askCondition) {
        var requestRows = readerRows();
        return DSL.exists(DSL.selectOne().from(requestRows.join(REQUESTS)
                .on(REQUESTS.DOCUMENT_ID.eq(requestRows.field("document_id", String.class))
                        .and(REQUESTS.DECISION.eq(requestRows.field("decision", String.class)))))
                .where(requestRows.field("document_id", String.class).eq(DOCUMENTS.ID)
                        .and(askCondition)));
    }

    private Condition afterApprovalCondition(List<String> values) {
        Table<?> rows = readerRows();
        Field<String> rowDocument = rows.field("document_id", String.class);
        Field<String> rowDecision = rows.field("decision", String.class);
        Condition hasAfterApproval = DSL.exists(DSL.selectOne().from(REQUESTS)
                .where(REQUESTS.DOCUMENT_ID.eq(rowDocument)
                        .and(REQUESTS.DECISION.eq(rowDecision))
                        .and(REQUESTS.DECISION.eq("Pending"))
                        .and(REQUESTS.IS_AFTER_PROJECT_APPROVAL.isTrue())));
        Condition wanted = DSL.falseCondition();
        if (values.contains("Yes")) {
            wanted = wanted.or(hasAfterApproval);
        }
        if (values.contains("No")) {
            wanted = wanted.or(hasAfterApproval.not());
        }
        return DSL.exists(DSL.selectOne().from(rows)
                .where(rowDocument.eq(DOCUMENTS.ID).and(wanted)));
    }

    private List<org.jooq.SortField<?>> order(Field<String> rowId, Field<String> rowDecision) {
        Field<?> firstAsk = DSL.select(DSL.min(REQUESTS.AT)).from(REQUESTS)
                .where(REQUESTS.DOCUMENT_ID.eq(rowId).and(REQUESTS.DECISION.eq(rowDecision))).asField();
        Field<String> title = DSL.field("{0} collate \"und-x-icu\"", String.class, DOCUMENTS.TITLE);
        return List.of(DSL.when(rowDecision.eq("Pending"), 0).otherwise(1).asc(), firstAsk.asc(),
                title.asc(), DOCUMENTS.POSITION.asc());
    }

    private Map<String, Object> facets(RequestSearch search, Condition reachCondition, HeldScopes held) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (RequestField field : RequestField.values()) {
            var matching = dsl.select(DOCUMENTS.ID, DOCUMENTS.POSITION).from(readerRows()
                    .join(DOCUMENTS).on(DOCUMENTS.ID.eq(readerRows().field("document_id", String.class))))
                    .where(reachCondition.and(filters(search, field.facetName(), held)));
            result.put(field.facetName(), facets.count(field.facetSource(dsl, readerRows()),
                    matching, false).values());
        }
        return result;
    }

    private Map<String, Object> propertyFacets(RequestSearch search, Condition reachCondition,
            HeldScopes held) {
        Map<String, Object> result = new LinkedHashMap<>();
        documentQueries.requestPropertyFacetSources(held).forEach((key, source) -> {
            var matching = dsl.select(DOCUMENTS.ID, DOCUMENTS.POSITION).from(readerRows()
                    .join(DOCUMENTS).on(DOCUMENTS.ID.eq(readerRows().field("document_id", String.class))))
                    .where(reachCondition.and(filters(search, "p." + key, held)));
            Facets.Count count = facets.count(source, matching, true);
            Map<String, Object> facet = new LinkedHashMap<>();
            facet.put("values", count.values());
            facet.put("noValue", count.noValue());
            result.put(key, facet);
        });
        return result;
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
