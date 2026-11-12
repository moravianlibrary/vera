package cz.mzk.vera.validations;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_VALUES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_STATES;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_DEFECTS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_STATES;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.countDistinct;
import static org.jooq.impl.DSL.exists;
import static org.jooq.impl.DSL.inline;
import static org.jooq.impl.DSL.selectOne;

import cz.mzk.vera.documents.Audience;
import cz.mzk.vera.documents.DocumentCodes;
import cz.mzk.vera.documents.DocumentHistory;
import cz.mzk.vera.documents.DocumentQueries;
import cz.mzk.vera.documents.DocumentRecords;
import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.listing.Listing;
import cz.mzk.vera.domain.valuerange.Range;
import cz.mzk.vera.domain.valuerange.ValueRange;
import cz.mzk.vera.listing.FacetSource;
import cz.mzk.vera.listing.Facets;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import cz.mzk.vera.web.Instants;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record3;
import org.jooq.Row3;
import org.jooq.Select;
import org.jooq.SortField;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

// VIEW-validations; STAT-validation; SCOPE-custody-category: filter and order stored review rows in SQL.
@Repository
public class ValidationQueries {
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final DocumentRecords records;
    private final DocumentHistory history;
    private final Facets facets;
    private final DocumentQueries documents;
    private final Clock clock;

    ValidationQueries(DSLContext dsl, HeldAccessQueries access, DocumentRecords records,
            DocumentHistory history, Facets facets, DocumentQueries documents, Clock clock) {
        this.dsl = dsl;
        this.access = access;
        this.records = records;
        this.history = history;
        this.facets = facets;
        this.documents = documents;
        this.clock = clock;
    }

    boolean canReview(String userId) {
        HeldScopes held = access.scopesHeldBy(userId);
        return held.hasPermission(ValidationCodes.APPROVE) || held.hasPermission(ValidationCodes.DENY)
                || held.hasPermission(ValidationCodes.REVOKE);
    }

    public Map<String, Object> page(Map<String, String> parameters, String callerId) {
        HeldScopes held = access.scopesHeldBy(callerId);
        ValidationSearch search = ValidationSearch.parse(parameters, documents.validationPropertyKeys(held));
        Condition reach = reachCondition(held);
        Condition filters = filters(search, null, held);
        Field<String> id = ITERATIONS.ID;
        Field<String> group = groupingField(search.grouping());
        List<SortField<?>> order = order(search, group);
        List<String> ids = dsl.select(id).from(ITERATIONS
                .join(DOCUMENTS).on(DOCUMENTS.ID.eq(ITERATIONS.DOCUMENT_ID))
                .join(DOCUMENT_STATES).on(DOCUMENT_STATES.CURRENT_ITERATION_ID.eq(ITERATIONS.ID))
                .join(ITERATION_STATES).on(ITERATION_STATES.ITERATION_ID.eq(ITERATIONS.ID)))
                .where(reach.and(filters)).orderBy(order).fetch(id);
        Listing.Slice slice = Listing.sliceOf(ids, search.cursor(), search.limit());
        List<Map<String, Object>> items = rowsOf(slice.items());
        Map<String, Object> result = new LinkedHashMap<>();
        int outstanding = outstandingTotal(reach.and(filters));
        result.put("items", items);
        result.put("total", ids.size());
        result.put("outstandingTotal", outstanding);
        result.put("nextCursor", slice.nextCursor());
        result.put("groups", headers(search, slice.items(), reach.and(filters)));
        result.put("facets", facets(search, reach, held));
        result.put("propertyFacets", propertyFacets(search, reach, held));
        return result;
    }

    public boolean matches(Map<String, String> parameters, String callerId, String iterationId) {
        HeldScopes held = access.scopesHeldBy(callerId);
        ValidationSearch search = ValidationSearch.parse(parameters, documents.validationPropertyKeys(held));
        Condition reach = reachCondition(held);
        Condition filters = filters(search, null, held);
        return dsl.fetchExists(dsl.selectOne().from(base())
                .where(ITERATIONS.ID.eq(iterationId).and(reach).and(filters)));
    }

    Map<String, Object> detail(String iterationId, String callerId) {
        HeldScopes held = access.scopesHeldBy(callerId);
        Condition reachable = reachCondition(held).and(ITERATIONS.ID.eq(iterationId));
        if (dsl.selectOne().from(base()).where(reachable).fetchOne() == null) {
            return null;
        }
        List<Map<String, Object>> rows = rowsOf(List.of(iterationId));
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> row = rows.getFirst();
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("row", row);
        String catalogId = (String) ((Map<?, ?>) row.get("document")).get("catalogId");
        detail.put("catalogLink", "https://vufind.mzk.cz/Record/"
                + URLEncoder.encode(catalogId, StandardCharsets.UTF_8).replace("+", "%20"));
        detail.put("log", history.logOf(Set.of(iterationId), held,
                Audience.STAFF, false));
        return detail;
    }

    private Table<?> base() {
        return ITERATIONS.join(DOCUMENTS).on(DOCUMENTS.ID.eq(ITERATIONS.DOCUMENT_ID))
                .join(DOCUMENT_STATES).on(DOCUMENT_STATES.CURRENT_ITERATION_ID.eq(ITERATIONS.ID))
                .join(ITERATION_STATES).on(ITERATION_STATES.ITERATION_ID.eq(ITERATIONS.ID));
    }

    private Condition reachCondition(HeldScopes held) {
        Condition reached = DSL.falseCondition();
        List<Category> categories = dsl.selectFrom(CATEGORIES)
                .fetch(row -> new Category(row.getId(), row.getParentId()));
        for (String permission : List.of(ValidationCodes.APPROVE, ValidationCodes.DENY,
                ValidationCodes.REVOKE)) {
            List<String> scopes = held.scopesOf(permission);
            if (scopes.contains("any")) {
                return ITERATION_STATES.REVIEW_STATE.isNotNull();
            }
            if (scopes.contains("custody")) {
                for (Category category : categories) {
                    List<String> categoryPath = Categories.lineageOf(categories, category.id());
                    if (held.reachesIteration(permission, categoryPath)) {
                        reached = reached.or(ITERATIONS.CATEGORY_ID.eq(category.id()));
                    }
                }
            }
        }
        return ITERATION_STATES.REVIEW_STATE.isNotNull().and(reached);
    }

    private Condition filters(ValidationSearch search, String omit, HeldScopes held) {
        Condition result = DSL.noCondition();
        List<Category> categories = dsl.selectFrom(CATEGORIES)
                .fetch(row -> new Category(row.getId(), row.getParentId()));
        for (Map.Entry<String, List<String>> entry : search.lists().entrySet()) {
            if (entry.getValue().isEmpty() || entry.getKey().equals(omit)) {
                continue;
            }
            List<String> wanted = entry.getValue();
            ValidationField validationField = ValidationField.ofFacet(entry.getKey());
            result = result.and(validationField.filterCondition(dsl, wanted, categories));
        }
        if (search.search() != null) {
            result = result.and(searchCondition(search.search()));
        }
        if (search.waiting() != null) {
            Range<String> range = ValueRange.resolveDayRange(search.waiting(), LocalDate.now(clock));
            if (range.from() != null) {
                result = result.and(ITERATION_STATES.WAITING_SINCE.ge(
                        OffsetDateTime.parse(range.from() + "T00:00:00Z")));
            }
            if (range.to() != null) {
                result = result.and(ITERATION_STATES.WAITING_SINCE.lt(
                        OffsetDateTime.parse(LocalDate.parse(range.to()).plusDays(1) + "T00:00:00Z")));
            }
        }
        if (!search.properties().isEmpty()) {
            result = result.and(documents.validationPropertyCondition(search.properties(), held,
                    omit != null && omit.startsWith("p.") ? omit : null, LocalDate.now(clock)));
        }
        return result;
    }

    private Condition searchCondition(String value) {
        String needle = value.toLowerCase();
        return DOCUMENTS.TITLE.containsIgnoreCase(value)
                .or(DOCUMENTS.CATALOG_ID.containsIgnoreCase(value))
                .or(DOCUMENTS.UNIT_VALUE.containsIgnoreCase(value))
                .or(DOCUMENTS.SHELF_MARK.containsIgnoreCase(value))
                .or(ITERATIONS.ID.equalIgnoreCase(value))
                .or(DOCUMENTS.ID.equalIgnoreCase(value))
                .or(exists(dsl.selectOne().from(ITERATION_DEFECTS.leftJoin(PLUGIN_INSTANCES)
                        .on(PLUGIN_INSTANCES.ID.eq(ITERATION_DEFECTS.INSTANCE_ID)))
                        .where(ITERATION_DEFECTS.ITERATION_ID.eq(ITERATIONS.ID)
                                .and(DSL.lower(ITERATION_DEFECTS.SUBJECT).contains(needle)
                                        .or(DSL.lower(ITERATION_DEFECTS.INSTANCE_ID.concat(" ")
                                                .concat(ITERATION_DEFECTS.RULE_CODE)).contains(needle))
                                        .or(DSL.lower(PLUGIN_INSTANCES.NAME).contains(needle))))));
    }

    private List<SortField<?>> order(ValidationSearch search, Field<String> group) {
        List<SortField<?>> order = new ArrayList<>();
        if ("category".equals(search.grouping())) {
            order.add(DSL.select(CATEGORIES.POSITION).from(CATEGORIES)
                    .where(CATEGORIES.ID.eq(ITERATIONS.CATEGORY_ID)).asField().asc());
        } else if ("defect".equals(search.grouping())) {
            order.add(DSL.when(group.eq("several"), 1).when(group.isNull(), 2).otherwise(0).asc());
            order.add(group.asc());
        }
        order.add(DSL.when(ITERATION_STATES.REVIEW_STATE.eq("Needed"), 0).otherwise(1).asc());
        order.add(DSL.field(
                "case {0} when 'Urgent' then 4 when 'High' then 3 when 'Normal' then 2 else 1 end",
                Integer.class, ITERATIONS.PRIORITY).desc());
        order.add(ITERATION_STATES.WAITING_SINCE.asc());
        order.add(DSL.field("{0} collate \"und-x-icu\"", String.class, DOCUMENTS.TITLE).asc());
        order.add(DOCUMENTS.POSITION.asc());
        return order;
    }

    private Field<String> groupingField(String grouping) {
        if ("category".equals(grouping)) {
            return ITERATIONS.CATEGORY_ID;
        }
        if ("defect".equals(grouping)) {
            return defectGroup();
        }
        return inline("");
    }

    private Field<String> defectGroup() {
        Condition currentDefect = DSL.or(ITERATION_STATES.REVIEW_STATE.ne("Needed"),
                ValidationField.notAccepted(ITERATION_DEFECTS.KEY));
        Field<Integer> countInstances = DSL.select(countDistinct(ITERATION_DEFECTS.INSTANCE_ID))
                .from(ITERATION_DEFECTS).where(ITERATION_DEFECTS.ITERATION_ID.eq(ITERATIONS.ID)
                        .and(currentDefect)).asField();
        Field<String> instance = DSL.select(DSL.min(ITERATION_DEFECTS.INSTANCE_ID))
                .from(ITERATION_DEFECTS).where(ITERATION_DEFECTS.ITERATION_ID.eq(ITERATIONS.ID)
                        .and(DSL.or(ITERATION_STATES.REVIEW_STATE.ne("Needed"),
                                ValidationField.notAccepted(ITERATION_DEFECTS.KEY))))
                .asField();
        return DSL.when(ITERATION_STATES.REVIEW_STATE.in("Forbidden", "Approved"), (String) null)
                .when(countInstances.eq(0), (String) null).when(countInstances.gt(1), "several")
                .otherwise(instance);
    }

    private int outstandingTotal(Condition matching) {
        Integer result = dsl.select(DSL.coalesce(DSL.sum(DSL.select(count())
                .from(ITERATION_DEFECTS).where(ITERATION_DEFECTS.ITERATION_ID.eq(ITERATIONS.ID)
                        .and(ValidationField.notAccepted(ITERATION_DEFECTS.KEY))).asField()), 0))
                .from(base()).where(matching.and(ITERATION_STATES.REVIEW_STATE.eq("Needed")))
                .fetchOne(0, Integer.class);
        return result == null ? 0 : result;
    }

    private List<Map<String, Object>> rowsOf(List<String> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<String, String> documentIds = new LinkedHashMap<>();
        dsl.select(ITERATIONS.ID, ITERATIONS.DOCUMENT_ID).from(ITERATIONS)
                .where(ITERATIONS.ID.in(ids)).fetch()
                .forEach(row -> documentIds.put(row.value1(), row.value2()));
        Map<String, Map<String, Object>> source = records.recordsOf(
                new LinkedHashSet<>(documentIds.values()));
        Map<String, String> reviews = new HashMap<>();
        Map<String, OffsetDateTime> waitingSince = new HashMap<>();
        dsl.select(ITERATION_STATES.ITERATION_ID, ITERATION_STATES.REVIEW_STATE,
                        ITERATION_STATES.WAITING_SINCE)
                .from(ITERATION_STATES).where(ITERATION_STATES.ITERATION_ID.in(ids)).fetch()
                .forEach(row -> {
                    reviews.put(row.value1(), row.value2());
                    waitingSince.put(row.value1(), row.value3());
                });
        Map<String, LinkedHashSet<String>> requesters = new HashMap<>();
        ids.forEach(id -> requesters.put(id, new LinkedHashSet<>()));
        dsl.select(REQUESTS.ITERATION_ID, REQUESTS.TRACKS_ITERATION_ID, REQUESTS.REQUESTER_ID)
                .from(REQUESTS)
                .where(REQUESTS.ITERATION_ID.in(ids).or(REQUESTS.TRACKS_ITERATION_ID.in(ids)))
                .orderBy(REQUESTS.AT, REQUESTS.ID).fetch()
                .forEach(row -> {
                    String direct = row.value1();
                    String tracked = row.value2();
                    if (requesters.containsKey(direct)) {
                        requesters.get(direct).add(row.value3());
                    }
                    if (requesters.containsKey(tracked)) {
                        requesters.get(tracked).add(row.value3());
                    }
                });
        List<Map<String, Object>> result = new ArrayList<>();
        for (String id : ids) {
            String documentId = documentIds.get(id);
            Map<String, Object> record = source.get(documentId);
            if (record == null) {
                continue;
            }
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> iterations = (List<Map<String, Object>>) record.get("iterations");
            Map<String, Object> iteration = iterations.stream()
                    .filter(candidate -> id.equals(candidate.get("id"))).findFirst().orElse(null);
            if (iteration == null) {
                continue;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> document = (Map<String, Object>) record.get("document");
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("iteration", iteration);
            row.put("document", document);
            row.put("review", reviews.get(id));
            row.put("waitingSince", Instants.format(waitingSince.get(id).toInstant()));
            row.put("askerIds", List.copyOf(requesters.get(id)));
            result.add(row);
        }
        return result;
    }

    private Map<String, Object> facets(ValidationSearch search, Condition reach, HeldScopes held) {
        Map<String, Object> result = new LinkedHashMap<>();
        List<Category> categories = dsl.selectFrom(CATEGORIES)
                .fetch(row -> new Category(row.getId(), row.getParentId()));
        for (ValidationField field : ValidationField.values()) {
            var matching = dsl.select(ITERATIONS.ID, DOCUMENTS.POSITION).from(base())
                    .where(reach.and(filters(search, field.facet(), held)));
            result.put(field.facet(),
                    facets.count(field.facetSource(dsl, categories), matching, false).values());
        }
        return result;
    }

    private Map<String, Object> propertyFacets(ValidationSearch search, Condition reach, HeldScopes held) {
        Map<String, Object> result = new LinkedHashMap<>();
        documents.validationPropertyFacetSources(held).forEach((key, source) -> {
            var matching = dsl.select(ITERATIONS.ID, DOCUMENTS.POSITION).from(base())
                    .where(reach.and(filters(search, "p." + key, held)));
            Table<?> propertyValues = source.values().asTable("validation_property_values");
            Field<String> documentId = propertyValues.field(0, String.class);
            Field<String> value = propertyValues.field(1, String.class);
            Field<Integer> ordinal = propertyValues.field(2, Integer.class);
            Select<Record3<String, String, Integer>> iterationValues = dsl
                    .select(DOCUMENT_STATES.CURRENT_ITERATION_ID, value, ordinal)
                    .from(propertyValues.join(DOCUMENT_STATES)
                            .on(DOCUMENT_STATES.DOCUMENT_ID.eq(documentId)))
                    .where(DOCUMENT_STATES.CURRENT_ITERATION_ID.isNotNull());
            Facets.Count count = facets.count(
                    new FacetSource("p." + key, iterationValues, key), matching, true);
            result.put(key, Map.of("values", count.values(), "noValue", count.noValue()));
        });
        return result;
    }

    private List<Map<String, Object>> headers(
            ValidationSearch search, List<String> slice, Condition matching) {
        if (search.grouping() == null || slice.isEmpty()) {
            return List.of();
        }
        Field<String> group = groupingField(search.grouping());
        Table<?> groupedRows = dsl.select(group.as("group_key")).from(base()).where(matching)
                .asTable("grouped_rows");
        Field<String> groupKey = groupedRows.field("group_key", String.class);
        Map<String, Integer> totals = new LinkedHashMap<>();
        dsl.select(groupKey, count()).from(groupedRows).groupBy(groupKey).fetch()
                .forEach(row -> totals.put(row.get(groupKey), row.get(count()).intValue()));
        List<String> sliceGroups = dsl.select(ITERATIONS.ID, group).from(base())
                .where(ITERATIONS.ID.in(slice)).fetch().intoMap(ITERATIONS.ID, group)
                .entrySet().stream().sorted((first, second) -> Integer.compare(
                        slice.indexOf(first.getKey()), slice.indexOf(second.getKey())))
                .map(Map.Entry::getValue).toList();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Listing.Header header : Listing.headersOf(sliceGroups, sliceGroupsFromAll(matching, group))) {
            Map<String, Object> item = new LinkedHashMap<>();
            if ("category".equals(search.grouping())) {
                item.put("kind", "category");
                item.put("categoryId", header.key());
            } else {
                item.put("kind", "defect");
                item.put("instanceId", header.key());
            }
            item.put("total", totals.getOrDefault(header.key(), 0));
            item.put("rowCount", header.rowCount());
            result.add(item);
        }
        return result;
    }

    private List<String> sliceGroupsFromAll(Condition matching, Field<String> group) {
        return dsl.select(group).from(base()).where(matching).orderBy(order(
                new ValidationSearch(null, 50, "category", null, Map.of(), null, Map.of()), group))
                .fetch(group);
    }
}
