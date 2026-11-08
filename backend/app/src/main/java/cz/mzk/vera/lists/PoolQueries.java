package cz.mzk.vera.lists;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.DIGITIZATION_LISTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_VALUES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_STATES;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.ITERATION_STATES;
import static cz.mzk.vera.db.tables.Tables.PROJECTS;
import static cz.mzk.vera.db.tables.Tables.PROPERTY_DEFINITIONS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static org.jooq.impl.DSL.countDistinct;
import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.sum;

import cz.mzk.vera.documents.DocumentHistory;
import cz.mzk.vera.documents.DocumentQueries;
import cz.mzk.vera.documents.DocumentRecords;
import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.entities.DigitizationList;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.intentions.Intentions;
import cz.mzk.vera.domain.lists.Lists;
import cz.mzk.vera.domain.listing.Listing;
import cz.mzk.vera.domain.properties.Properties;
import cz.mzk.vera.domain.valuerange.DayRange;
import cz.mzk.vera.domain.valuerange.Range;
import cz.mzk.vera.domain.valuerange.ValueRange;
import cz.mzk.vera.intentions.CountingReads;
import cz.mzk.vera.intentions.CountingReads.CountingSnapshot;
import cz.mzk.vera.intentions.CountingReads.StoredIntention;
import cz.mzk.vera.listing.FacetSource;
import cz.mzk.vera.listing.Facets;
import cz.mzk.vera.db.tables.tables.records.DigitizationListsRecord;
import cz.mzk.vera.db.tables.tables.records.IterationsRecord;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import cz.mzk.vera.web.Instants;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.JSONB;
import org.jooq.Record3;
import org.jooq.Select;
import org.jooq.SortField;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

// VIEW-lists; SCOPE-list; LC-LIST-state; LC-LIST-pool; PLAN-counting.
@Repository
class PoolQueries {
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final DocumentRecords records;
    private final DocumentHistory history;
    private final CountingReads counting;
    private final JsonMapper mapper;
    private final Clock clock;
    private final DocumentQueries documents;
    private final Facets facets;
    private final ListDetailQueries detail;
    PoolQueries(DSLContext dsl, HeldAccessQueries access, DocumentRecords records,
            DocumentHistory history, CountingReads counting, JsonMapper mapper, Clock clock,
            DocumentQueries documents, Facets facets, ListDetailQueries detail) {
        this.dsl = dsl;
        this.access = access;
        this.records = records;
        this.history = history;
        this.counting = counting;
        this.mapper = mapper;
        this.clock = clock;
        this.documents = documents;
        this.facets = facets;
        this.detail = detail;
    }

    Map<String, Object> pool(Map<String, String> parameters, String userId) {
        LocalDate today = LocalDate.now(clock);
        HeldScopes held = access.scopesHeldBy(userId);
        List<Category> categories = categories();
        Condition base = poolCondition();
        Condition search = poolSearch(ListQuerySupport.trim(parameters.get("q")));
        Condition category = poolCategory(ListQuerySupport.trim(parameters.get("category")), categories);
        Condition property = documents.listPoolPropertyCondition(parameters, today, null);
        Condition matching = base.and(search).and(category).and(property);
        Field<Integer> rank = poolPriorityRank();
        Field<OffsetDateTime> askedAt = REQUESTS.AT;
        List<SortField<?>> order = List.of(rank.desc(), askedAt.asc(), ITERATIONS.ID.asc());
        int limit = poolLimit(parameters.get("limit"));
        String cursor = ListQuerySupport.trim(parameters.get("cursor"));
        Condition after = poolCursor(cursor, matching, rank);
        List<String> ids = dsl.select(ITERATIONS.ID).from(poolFrom())
                .where(matching.and(after)).orderBy(order).limit(limit + 1).fetch(ITERATIONS.ID);
        boolean hasMore = ids.size() > limit;
        List<String> slice = hasMore ? ids.subList(0, limit) : ids;
        String nextCursor = hasMore && !slice.isEmpty() ? slice.getLast() : null;
        int total = dsl.selectCount().from(poolFrom()).where(matching).fetchOne(0, int.class);
        int pages = dsl.select(DSL.coalesce(sum(DOCUMENT_STATES.PAGE_COUNT), 0)).from(poolFrom())
                .where(matching).fetchOne(0, int.class);
        Map<String, Map<String, Object>> loaded = new LinkedHashMap<>();
        detail.itemsOf(slice).forEach(item -> loaded.put((String) item.get("iterationId"), item));
        List<Map<String, Object>> pageItems = slice.stream().map(loaded::get)
                .filter(java.util.Objects::nonNull).map(detail::wireItem).toList();
        List<Map<String, Object>> review = reviewRows(categories);
        int undecided = dsl.select(countDistinct(REQUESTS.DOCUMENT_ID)).from(REQUESTS)
                .where(REQUESTS.DECISION.eq("Pending")).fetchOne(0, int.class);
        int cancelled = dsl.fetchCount(ITERATIONS, ITERATIONS.PROGRESS.eq("Ready")
                .and(ITERATIONS.LIST_ID.isNull()).and(ITERATIONS.CANCELLATION_CAUSE.isNotNull()));
        return ListQuerySupport.map("items", pageItems, "total", total, "pages", pages,
                "nextCursor", nextCursor,
                "inReview", review, "undecidedCount", undecided, "cancelledCount", cancelled,
                "propertyFacets", poolPropertyFacets(
                        parameters, held, categories, today, base, search, category));
    }

    private org.jooq.Table<?> poolFrom() {
        return ITERATIONS.join(DOCUMENT_STATES).on(DOCUMENT_STATES.CURRENT_ITERATION_ID.eq(ITERATIONS.ID))
                .join(ITERATION_STATES).on(ITERATION_STATES.ITERATION_ID.eq(ITERATIONS.ID))
                .join(DOCUMENTS).on(DOCUMENTS.ID.eq(ITERATIONS.DOCUMENT_ID))
                .join(REQUESTS).on(REQUESTS.ID.eq(ITERATIONS.REQUEST_ID));
    }

    private Condition poolCondition() {
        return ITERATIONS.PROGRESS.eq("Ready").and(ITERATIONS.LIST_ID.isNull())
                .and(ITERATION_STATES.IS_RESTRICTED.isFalse())
                .and(ITERATION_STATES.REVIEW_STATE.isNull().or(ITERATION_STATES.REVIEW_STATE.eq("Approved")))
                .and(ITERATIONS.CANCELLATION_CAUSE.isNull())
                .and(DSL.notExists(dsl.selectOne().from(ITERATIONS.as("later_pool"))
                        .where(DSL.field("later_pool.document_id", String.class).eq(ITERATIONS.DOCUMENT_ID)
                                .and(DSL.field("later_pool.attempt", Integer.class)
                                        .gt(ITERATIONS.ATTEMPT)))));
    }

    private Condition poolSearch(String raw) {
        if (raw == null) {
            return DSL.noCondition();
        }
        return DOCUMENTS.TITLE.containsIgnoreCase(raw).or(DOCUMENTS.CATALOG_ID.containsIgnoreCase(raw))
                .or(DOCUMENTS.UNIT_VALUE.containsIgnoreCase(raw))
                .or(DOCUMENTS.SHELF_MARK.containsIgnoreCase(raw))
                .or(DOCUMENTS.ID.eq(raw)).or(ITERATIONS.ID.eq(raw));
    }

    private Condition poolCategory(String raw, List<Category> categories) {
        if (raw == null) {
            return DSL.noCondition();
        }
        List<String> categoryIds = categories.stream()
                .filter(value -> Categories.lineageOf(categories, value.id()).contains(raw))
                .map(Category::id).toList();
        return ITERATIONS.CATEGORY_ID.in(categoryIds);
    }

    private Field<Integer> poolPriorityRank() {
        return DSL.when(ITERATIONS.PRIORITY.eq("Low"), 0)
                .when(ITERATIONS.PRIORITY.eq("Normal"), 1)
                .when(ITERATIONS.PRIORITY.eq("High"), 2).otherwise(3);
    }

    private Condition poolCursor(String cursor, Condition matching, Field<Integer> rank) {
        if (cursor == null) {
            return DSL.noCondition();
        }
        var found = dsl.select(rank, REQUESTS.AT).from(poolFrom())
                .where(ITERATIONS.ID.eq(cursor).and(matching)).fetchOne();
        if (found == null) {
            return DSL.falseCondition();
        }
        int cursorRank = found.get(rank);
        OffsetDateTime cursorAt = found.get(REQUESTS.AT);
        return rank.lt(cursorRank).or(rank.eq(cursorRank).and(REQUESTS.AT.gt(cursorAt)))
                .or(rank.eq(cursorRank).and(REQUESTS.AT.eq(cursorAt)).and(ITERATIONS.ID.gt(cursor)));
    }

    private int poolLimit(String raw) {
        try {
            int limit = Integer.parseInt(raw);
            return limit > 0 && limit <= 200 ? limit : 50;
        } catch (NumberFormatException | NullPointerException ignored) {
            return 50;
        }
    }

    private List<Map<String, Object>> reviewRows(List<Category> categories) {
        Map<String, String> topByCategory = new LinkedHashMap<>();
        for (Category category : categories) {
            List<String> path = Categories.lineageOf(categories, category.id());
            topByCategory.put(category.id(), path.isEmpty() ? category.id() : path.getFirst());
        }
        Map<String, ReviewCount> counts = new LinkedHashMap<>();
        dsl.select(ITERATIONS.CATEGORY_ID, DSL.count(), sum(DOCUMENT_STATES.PAGE_COUNT))
                .from(ITERATIONS.join(ITERATION_STATES)
                        .on(ITERATION_STATES.ITERATION_ID.eq(ITERATIONS.ID))
                        .join(DOCUMENT_STATES).on(DOCUMENT_STATES.CURRENT_ITERATION_ID.eq(ITERATIONS.ID)))
                .where(ITERATIONS.PROGRESS.eq("Enqueued").and(ITERATIONS.LIST_ID.isNull())
                        .and(ITERATIONS.CANCELLATION_CAUSE.isNull())
                        .and(ITERATION_STATES.IS_RESTRICTED.isFalse())
                        .and(ITERATION_STATES.VALIDATION.in("Needed", "Denied")))
                .groupBy(ITERATIONS.CATEGORY_ID).fetch().forEach(row -> {
                    String top = topByCategory.get(row.get(ITERATIONS.CATEGORY_ID));
                    ReviewCount current = counts.getOrDefault(top, new ReviewCount(0, 0));
                    counts.put(top, new ReviewCount(current.items() + row.get(1, Integer.class),
                            current.pages() + zero(row.get(2, Integer.class))));
                });
        List<Map<String, Object>> result = new ArrayList<>();
        for (Category category : categories) {
            ReviewCount value = counts.get(category.id());
            if (value != null) {
                result.add(ListQuerySupport.map("categoryId", category.id(), "itemCount", value.items(),
                        "pages", value.pages()));
            }
        }
        return result;
    }

    private Map<String, Object> poolPropertyFacets(Map<String, String> parameters, HeldScopes held,
            List<Category> categories, LocalDate today, Condition base,
            Condition search, Condition category) {
        Map<String, Object> result = new LinkedHashMap<>();
        documents.listPoolPropertyFacetSources().forEach((key, source) -> {
            Condition otherProperties = documents.listPoolPropertyCondition(parameters, today, "p." + key);
            Select<org.jooq.Record2<String, Long>> subjects = dsl.select(ITERATIONS.ID, DOCUMENTS.POSITION)
                    .from(poolFrom()).where(base.and(search).and(category).and(otherProperties));
            Table<?> propertyValues = source.values().asTable("pool_property_values");
            Field<String> documentId = propertyValues.field(0, String.class);
            Field<String> value = propertyValues.field(1, String.class);
            Field<Integer> ordinal = propertyValues.field(2, Integer.class);
            Select<Record3<String, String, Integer>> iterationValues = dsl
                    .select(DOCUMENT_STATES.CURRENT_ITERATION_ID, value, ordinal)
                    .from(propertyValues.join(DOCUMENT_STATES).on(DOCUMENT_STATES.DOCUMENT_ID.eq(documentId)))
                    .where(DOCUMENT_STATES.CURRENT_ITERATION_ID.isNotNull());
            Facets.Count count = facets.count(
                    new FacetSource("p." + key, iterationValues, key), subjects, true);
            result.put(key, ListQuerySupport.map("values", count.values(), "noValue", count.noValue()));
        });
        return result;
    }

    private List<Map<String, Object>> facetOrder(List<Map<String, Object>> items) {
        Map<String, Long> positions = new LinkedHashMap<>();
        List<String> documentIds = items.stream()
                .map(item -> (String) ((Map<?, ?>) item.get("document")).get("id")).toList();
        dsl.select(DOCUMENTS.ID, DOCUMENTS.POSITION).from(DOCUMENTS)
                .where(DOCUMENTS.ID.in(documentIds))
                .fetch().forEach(row -> positions.put(row.get(DOCUMENTS.ID), row.get(DOCUMENTS.POSITION)));
        return items.stream().sorted(Comparator.comparingLong(item -> positions.getOrDefault(
                (String) ((Map<?, ?>) item.get("document")).get("id"), Long.MAX_VALUE))).toList();
    }

    private Map<String, List<String>> propertyValues(String key, String about) {
        Map<String, List<String>> result = new LinkedHashMap<>();
        if ("document".equals(about)) {
            dsl.select(DOCUMENT_PROPERTY_VALUES.DOCUMENT_ID, DOCUMENT_PROPERTY_VALUES.TEXT_VALUE)
                    .from(DOCUMENT_PROPERTY_VALUES).where(DOCUMENT_PROPERTY_VALUES.KEY.eq(key))
                    .orderBy(DOCUMENT_PROPERTY_VALUES.DOCUMENT_ID, DOCUMENT_PROPERTY_VALUES.ORDINAL)
                    .fetch().forEach(row -> result.computeIfAbsent(
                            row.get(DOCUMENT_PROPERTY_VALUES.DOCUMENT_ID), ignored -> new ArrayList<>())
                                    .add(row.get(DOCUMENT_PROPERTY_VALUES.TEXT_VALUE)));
            return result;
        }
        Map<String, Integer> tiers = new LinkedHashMap<>();
        Map<String, Object> values = new LinkedHashMap<>();
        dsl.select(ITERATION_PROPERTY_SOURCES.ITERATION_ID, ITERATION_PROPERTY_SOURCES.TIER,
                ITERATION_PROPERTY_SOURCES.VALUE)
                .from(ITERATION_PROPERTY_SOURCES).where(ITERATION_PROPERTY_SOURCES.KEY.eq(key))
                .orderBy(ITERATION_PROPERTY_SOURCES.ITERATION_ID, ITERATION_PROPERTY_SOURCES.POSITION)
                .fetch().forEach(row -> {
                    String owner = row.get(ITERATION_PROPERTY_SOURCES.ITERATION_ID);
                    if (!tiers.containsKey(owner)
                            || row.get(ITERATION_PROPERTY_SOURCES.TIER) > tiers.get(owner)) {
                        tiers.put(owner, row.get(ITERATION_PROPERTY_SOURCES.TIER));
                        values.put(owner, readJson(row.get(ITERATION_PROPERTY_SOURCES.VALUE)));
                    }
                });
        values.forEach((owner, value) -> {
            List<String> unpacked = value instanceof List<?> list
                    ? list.stream().map(Object::toString).toList() : List.of(value.toString());
            result.put(owner, unpacked);
        });
        return result;
    }

    private int zero(Integer value) {
        return value == null ? 0 : value;
    }

    private Map<String, Object> wireItem(Map<String, Object> row) {
        return ListQuerySupport.map("iteration", row.get("iteration"), "document", row.get("document"),
                "pages", row.get("pages"), "askedAt", row.get("askedAt"), "blocker", row.get("blocker"),
                "lateCopy", row.get("lateCopy"));
    }

    private List<Category> categories() {
        return dsl.select(CATEGORIES.ID, CATEGORIES.PARENT_ID).from(CATEGORIES)
                .fetch(row -> new Category(row.get(CATEGORIES.ID), row.get(CATEGORIES.PARENT_ID)));
    }


    private String instant(OffsetDateTime value) {
        return value == null ? null : Instants.format(value.toInstant());
    }

    private JSONBHolder generated(JSONB value) {
        if (value == null) {
            return new JSONBHolder(null, null);
        }
        try {
            Map<String, Object> data = mapper.readValue(value.data(),
                    new tools.jackson.core.type.TypeReference<>() {});
            String intentionId = (String) data.get("intentionId");
            @SuppressWarnings("unchecked")
            Map<String, Integer> allocation = (Map<String, Integer>) data.get("allocation");
            return new JSONBHolder(intentionId, allocation);
        } catch (JacksonException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private Object readJson(JSONB value) {
        if (value == null) {
            return null;
        }
        try {
            return mapper.readValue(value.data(), Object.class);
        } catch (JacksonException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private record ReviewCount(int items, int pages) {}
    private record JSONBHolder(String intentionId, Map<String, Integer> allocation) {}
}

