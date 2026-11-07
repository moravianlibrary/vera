package cz.mzk.vera.requests;

import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES;
import static cz.mzk.vera.db.tables.Tables.REQUEST_SUGGESTIONS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.countDistinct;

import cz.mzk.vera.documents.BatchQueries;
import cz.mzk.vera.domain.listing.Listing;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.Condition;
import org.jooq.CaseConditionStep;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Component;

// VIEW-requests; ENT-batch: arrange request rows and count their headers in SQL.
@Component
public class RequestGrouping {
    private final DSLContext dsl;
    private final BatchQueries batches;

    public RequestGrouping(DSLContext dsl, BatchQueries batches) {
        this.dsl = dsl;
        this.batches = batches;
    }

    public Arrangement arrange(String grouping, List<String> orderedIds, Table<?> rows,
            Condition matching, Condition decideReach) {
        if (grouping == null) {
            return new Arrangement(null, DSL.inline(0), Map.of(), Map.of(), Map.of(), Map.of());
        }
        if ("batch".equals(grouping)) {
            return batchArrangement(orderedIds, rows, matching, decideReach);
        }
        return requesterArrangement(orderedIds, rows, matching);
    }

    private Arrangement batchArrangement(List<String> orderedIds, Table<?> rows,
            Condition matching, Condition decideReach) {
        Field<String> documentId = rows.field("document_id", String.class);
        Field<String> decision = rows.field("decision", String.class);
        Field<String> firstBatch = firstAskBatch(documentId, decision);
        Map<String, String> homeByDocument = dsl.select(documentId, shown(firstBatch).as("home"))
            .from(rows.join(DOCUMENTS).on(DOCUMENTS.ID.eq(documentId)))
            .where(matching).fetchMap(documentId, row -> row.get("home", String.class));
        List<String> homeOrder = orderedIds.stream().map(homeByDocument::get)
            .filter(key -> key != null).distinct().toList();
        Field<Integer> rank = rankOf(shown(firstBatch), homeOrder);
        Map<String, Map<String, Object>> batchRows = new LinkedHashMap<>();
        batches.served().forEach(batch -> batchRows.put((String) batch.get("id"), batch));
        Map<String, Map<String, Object>> metrics = batchMetrics(rows, matching, decideReach);
        return new Arrangement("batch", rank, homeByDocument, batchRows, metrics, Map.of());
    }

    private Arrangement requesterArrangement(List<String> orderedIds, Table<?> rows, Condition matching) {
        Field<String> documentId = rows.field("document_id", String.class);
        Field<String> decision = rows.field("decision", String.class);
        Table<?> firstAsks = firstAsks();
        Field<String> firstDocument = firstAsks.field("document_id", String.class);
        Field<String> firstDecision = firstAsks.field("decision", String.class);
        Field<String> firstRequester = firstAsks.field("requester_id", String.class);
        Condition firstAsk = firstAsks.field("ask_rank", Integer.class).eq(1);
        Map<String, String> homeByDocument = dsl.select(documentId, firstRequester.as("home"))
            .from(rows.join(DOCUMENTS).on(DOCUMENTS.ID.eq(documentId))
                .join(firstAsks).on(firstDocument.eq(documentId).and(firstDecision.eq(decision)).and(firstAsk)))
            .where(matching)
            .fetchMap(documentId, row -> row.get("home", String.class));
        Field<String> name = DSL.field("{0} collate \"und-x-icu\"", String.class, USERS.NAME);
        List<String> order = dsl.select(firstRequester.as("home"))
            .from(rows.join(DOCUMENTS).on(DOCUMENTS.ID.eq(documentId))
                .join(firstAsks).on(firstDocument.eq(documentId).and(firstDecision.eq(decision)).and(firstAsk))
                .join(USERS).on(USERS.ID.eq(firstRequester)))
            .where(matching).groupBy(firstRequester, name)
            .orderBy(countDistinct(documentId).desc(), name.asc())
            .fetch(row -> row.get("home", String.class));
        Field<Integer> rank = rankOf(firstAskRequester(documentId, decision), order);
        Map<String, Map<String, Object>> metrics = requesterMetrics(rows, matching, firstAsks);
        return new Arrangement("requester", rank, homeByDocument, Map.of(), metrics, Map.of());
    }

    private Table<?> firstAsks() {
        Field<Integer> rank = DSL.rowNumber().over(DSL.partitionBy(REQUESTS.DOCUMENT_ID,
            REQUESTS.DECISION).orderBy(REQUESTS.AT, REQUESTS.ID)).cast(Integer.class).as("ask_rank");
        return dsl.select(REQUESTS.DOCUMENT_ID.as("document_id"),
                REQUESTS.DECISION.as("decision"), REQUESTS.REQUESTER_ID.as("requester_id"), rank)
            .from(REQUESTS).where(REQUESTS.DECISION.in("Pending", "Denied", "Withdrawn"))
            .asTable("request_first_asks");
    }

    private Field<String> firstAskBatch(Field<String> documentId, Field<String> decision) {
        Field<String> askBatch = DSL.select(REQUESTS.BATCH_ID).from(REQUESTS)
            .where(REQUESTS.DOCUMENT_ID.eq(documentId).and(REQUESTS.DECISION.eq(decision)))
            .orderBy(REQUESTS.AT, REQUESTS.ID).limit(1).asField();
        return askBatch;
    }

    private Field<String> firstAskRequester(Field<String> documentId, Field<String> decision) {
        return DSL.select(REQUESTS.REQUESTER_ID).from(REQUESTS)
            .where(REQUESTS.DOCUMENT_ID.eq(documentId).and(REQUESTS.DECISION.eq(decision)))
            .orderBy(REQUESTS.AT, REQUESTS.ID).limit(1).asField();
    }

    private Field<String> shown(Field<String> batchId) {
        return DSL.when(DSL.selectCount().from(REQUESTS).where(REQUESTS.BATCH_ID.eq(batchId))
            .asField().ge(2), batchId);
    }

    private Field<Integer> rankOf(Field<String> key, List<String> order) {
        if (order.isEmpty()) {
            return DSL.inline(0);
        }
        CaseConditionStep<Integer> rank = order.getFirst() == null
            ? DSL.case_().when(key.isNull(), 0) : DSL.case_().when(key.eq(order.getFirst()), 0);
        for (int index = 1; index < order.size(); index++) {
            String groupKey = order.get(index);
            rank = groupKey == null ? rank.when(key.isNull(), index) : rank.when(key.eq(groupKey), index);
        }
        return rank.otherwise(order.size()).cast(Integer.class);
    }

    private Map<String, Integer> batchTotals(Table<?> rows, Condition matching) {
        Field<String> documentId = rows.field("document_id", String.class);
        Field<String> decision = rows.field("decision", String.class);
        Field<String> batchId = REQUESTS.BATCH_ID;
        return dsl.select(batchId, countDistinct(documentId).as("total"))
            .from(rows.join(DOCUMENTS).on(DOCUMENTS.ID.eq(documentId))
                .join(REQUESTS).on(REQUESTS.DOCUMENT_ID.eq(documentId).and(REQUESTS.DECISION.eq(decision))))
            .where(matching).groupBy(batchId).fetchMap(batchId, row -> row.get("total", Integer.class));
    }

    private Map<String, Map<String, Object>> batchMetrics(Table<?> rows, Condition matching,
            Condition decideReach) {
        Map<String, Map<String, Object>> result = new LinkedHashMap<>();
        Field<String> documentId = rows.field("document_id", String.class);
        Field<String> decision = rows.field("decision", String.class);
        Field<String> batchId = REQUESTS.BATCH_ID;
        dsl.select(batchId, count().as("askCount"))
            .from(rows.join(DOCUMENTS).on(DOCUMENTS.ID.eq(documentId))
                .join(REQUESTS).on(REQUESTS.DOCUMENT_ID.eq(documentId).and(REQUESTS.DECISION.eq(decision))))
            .where(matching).groupBy(batchId).fetch().forEach(row -> result
                .computeIfAbsent(row.get(batchId), ignored -> emptyBatchMetrics())
                .put("askCount", row.get("askCount", Integer.class)));
        Field<String> home = shown(firstAskBatch(documentId, decision));
        dsl.select(batchId, countDistinct(documentId).as("elsewhereCount"))
            .from(rows.join(DOCUMENTS).on(DOCUMENTS.ID.eq(documentId))
                .join(REQUESTS).on(REQUESTS.DOCUMENT_ID.eq(documentId).and(REQUESTS.DECISION.eq(decision))))
            .where(matching.and(home.ne(batchId).or(home.isNull())))
            .groupBy(batchId).fetch().forEach(row -> result
                .computeIfAbsent(row.get(batchId), ignored -> emptyBatchMetrics())
                .put("elsewhereCount", row.get("elsewhereCount", Integer.class)));
        Field<String> decideDocument = rows.field("document_id", String.class);
        Field<String> decideDecision = rows.field("decision", String.class);
        Condition openReach = decideReach.and(decideDecision.eq("Pending"));
        Condition noCopies = DSL.notExists(DSL.selectOne().from(REQUESTS.join(REQUEST_EXISTING_COPIES)
            .on(REQUEST_EXISTING_COPIES.REQUEST_ID.eq(REQUESTS.ID)))
            .where(REQUESTS.DOCUMENT_ID.eq(decideDocument).and(REQUESTS.DECISION.eq("Pending"))));
        Condition checked = DSL.notExists(DSL.selectOne().from(REQUESTS)
            .where(REQUESTS.DOCUMENT_ID.eq(decideDocument).and(REQUESTS.DECISION.eq("Pending"))
                .and(REQUESTS.CHECKED_AT.isNull())));
        Condition approvable = openReach.and(noCopies).and(checked);
        Condition rescan = openReach.and(DSL.exists(DSL.selectOne().from(REQUESTS.join(REQUEST_EXISTING_COPIES)
            .on(REQUEST_EXISTING_COPIES.REQUEST_ID.eq(REQUESTS.ID)))
            .where(REQUESTS.DOCUMENT_ID.eq(decideDocument).and(REQUESTS.DECISION.eq("Pending")))));
        Condition checking = openReach.and(DSL.exists(DSL.selectOne().from(REQUESTS)
            .where(REQUESTS.DOCUMENT_ID.eq(decideDocument).and(REQUESTS.DECISION.eq("Pending"))
                .and(REQUESTS.CHECKED_AT.isNull()))));
        dsl.select(batchId, countDistinct(DSL.when(approvable, decideDocument)).as("approvable"),
                countDistinct(DSL.when(rescan, decideDocument)).as("rescan"),
                countDistinct(DSL.when(checking.and(DSL.not(rescan)), decideDocument)).as("checking"))
            .from(rows.join(DOCUMENTS).on(DOCUMENTS.ID.eq(decideDocument))
                .join(REQUESTS).on(REQUESTS.DOCUMENT_ID.eq(decideDocument)
                    .and(REQUESTS.DECISION.eq(decideDecision))))
            .where(openReach).groupBy(batchId).fetch().forEach(row -> {
                Map<String, Object> metrics = result.computeIfAbsent(row.get(batchId),
                    ignored -> emptyBatchMetrics());
                metrics.put("approvableCount", row.get("approvable", Integer.class));
                metrics.put("rescanCount", row.get("rescan", Integer.class));
                metrics.put("checkingCount", row.get("checking", Integer.class));
            });
        Field<String> firstAsk = DSL.select(REQUESTS.ID).from(REQUESTS)
            .where(REQUESTS.DOCUMENT_ID.eq(documentId).and(REQUESTS.DECISION.eq(decision)))
            .orderBy(REQUESTS.AT, REQUESTS.ID).limit(1).asField();
        Field<Long> firstPosition = DSL.min(DOCUMENTS.POSITION);
        dsl.select(REQUESTS.BATCH_ID, REQUEST_SUGGESTIONS.CATEGORY_ID,
                countDistinct(documentId).as("count"), firstPosition.as("firstPosition"))
            .from(rows.join(DOCUMENTS).on(DOCUMENTS.ID.eq(documentId))
                .join(REQUESTS).on(REQUESTS.DOCUMENT_ID.eq(documentId).and(REQUESTS.DECISION.eq(decision)))
                .join(REQUEST_SUGGESTIONS).on(REQUEST_SUGGESTIONS.REQUEST_ID.eq(firstAsk)))
            .where(decideReach.and(approvable).and(decision.eq("Pending")))
            .groupBy(REQUESTS.BATCH_ID, REQUEST_SUGGESTIONS.CATEGORY_ID)
            .orderBy(firstPosition).fetch().forEach(row -> {
                Map<String, Object> metrics = result.computeIfAbsent(row.get(REQUESTS.BATCH_ID),
                    ignored -> emptyBatchMetrics());
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> counts = (List<Map<String, Object>>) metrics.get("suggestedCounts");
                Map<String, Object> countValue = new LinkedHashMap<>();
                countValue.put("value", row.get(REQUEST_SUGGESTIONS.CATEGORY_ID));
                countValue.put("count", row.get("count", Integer.class));
                counts.add(countValue);
            });
        return result;
    }

    private Map<String, Map<String, Object>> requesterMetrics(Table<?> rows, Condition matching,
            Table<?> firstAsks) {
        Map<String, Map<String, Object>> result = new LinkedHashMap<>();
        Field<String> documentId = rows.field("document_id", String.class);
        Field<String> decision = rows.field("decision", String.class);
        Field<String> firstDocument = firstAsks.field("document_id", String.class);
        Field<String> firstDecision = firstAsks.field("decision", String.class);
        Field<String> home = firstAsks.field("requester_id", String.class);
        Field<Integer> askRank = firstAsks.field("ask_rank", Integer.class);
        Table<?> perRow = dsl.select(documentId.as("document_id"), home.as("home"),
                countDistinct(REQUESTS.REQUESTER_ID).as("asker_count"))
            .from(rows.join(DOCUMENTS).on(DOCUMENTS.ID.eq(documentId))
                .join(REQUESTS).on(REQUESTS.DOCUMENT_ID.eq(documentId).and(REQUESTS.DECISION.eq(decision)))
                .join(firstAsks).on(firstDocument.eq(documentId).and(firstDecision.eq(decision)).and(askRank.eq(1))))
            .where(matching).groupBy(documentId, home).asTable("requester_rows");
        Field<String> rowDocument = perRow.field("document_id", String.class);
        Field<String> rowHome = perRow.field("home", String.class);
        Field<Integer> askerCount = perRow.field("asker_count", Integer.class);
        dsl.select(rowHome.as("home"), countDistinct(rowDocument).as("total"),
                countDistinct(DSL.when(askerCount.gt(1), rowDocument)).as("shared"))
            .from(perRow).groupBy(rowHome)
            .fetch().forEach(row -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("total", row.get("total", Integer.class));
                item.put("sharedCount", row.get("shared", Integer.class));
                result.put(row.get("home", String.class), item);
            });
        return result;
    }

    private Map<String, Object> emptyBatchMetrics() {
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("askCount", 0);
        metrics.put("elsewhereCount", 0);
        metrics.put("approvableCount", 0);
        metrics.put("suggestedCounts", new ArrayList<Map<String, Object>>());
        metrics.put("rescanCount", 0);
        metrics.put("checkingCount", 0);
        return metrics;
    }

    public final class Arrangement {
        private final String grouping;
        private final Field<Integer> rank;
        private final Map<String, String> homes;
        private final Map<String, Map<String, Object>> batchRows;
        private final Map<String, Map<String, Object>> metrics;
        private final Map<String, Integer> totals;

        private Arrangement(String grouping, Field<Integer> rank, Map<String, String> homes,
                Map<String, Map<String, Object>> batchRows, Map<String, Map<String, Object>> metrics,
                Map<String, Integer> totals) {
            this.grouping = grouping;
            this.rank = rank;
            this.homes = homes;
            this.batchRows = batchRows;
            this.metrics = metrics;
            this.totals = totals;
        }

        public Field<Integer> rank() {
            return grouping == null ? null : rank;
        }

        public List<Map<String, Object>> headersOf(List<String> sliceIds, List<String> allIds) {
            if (grouping == null) {
                return List.of();
            }
            List<String> allKeys = allIds.stream().map(homes::get).toList();
            List<String> sliceKeys = sliceIds.stream().map(homes::get).toList();
            List<Map<String, Object>> result = new ArrayList<>();
            for (Listing.Header header : Listing.headersOf(sliceKeys, allKeys)) {
                Map<String, Object> item = new LinkedHashMap<>();
                if ("batch".equals(grouping)) {
                    item.put("kind", "batch");
                    item.put("batch", header.key() == null ? null : batchRows.get(header.key()));
                    Map<String, Object> count = metrics.getOrDefault(header.key(), emptyBatchMetrics());
                    item.putAll(count);
                } else {
                    item.put("kind", "requester");
                    item.put("userId", header.key() == null ? "" : header.key());
                    item.put("sharedCount", metrics.getOrDefault(header.key(), Map.of())
                        .getOrDefault("sharedCount", 0));
                }
                item.put("total", header.total());
                item.put("rowCount", header.rowCount());
                result.add(item);
            }
            return List.copyOf(result);
        }
    }
}
