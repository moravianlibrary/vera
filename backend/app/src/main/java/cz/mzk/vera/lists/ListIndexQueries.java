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
class ListIndexQueries {
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
    ListIndexQueries(DSLContext dsl, HeldAccessQueries access, DocumentRecords records,
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

    Map<String, Object> index(Map<String, String> parameters, String userId) {
        HeldScopes held = access.scopesHeldBy(userId);
        List<Category> categories = categories();
        LocalDate today = LocalDate.now(clock);
        Condition base = reachCondition(held, categories).and(searchCondition(parameters.get("q")))
                .and(runsCondition(parameters.get("runs"), today));
        List<String> states = allowedValues(parameters.get("state"),
                List.of("Planned", "InProgress", "Done"));
        List<String> attentions = allowedValues(parameters.get("attention"),
                List.of("Overdue", "Blocked", "ReviewNeeded", "LateCopy", "Empty"));
        Condition stateFilter = stateCondition(states, today);
        Condition attentionFilter = attentionCondition(attentions, today);
        Condition matching = base.and(stateFilter).and(attentionFilter);
        List<String> matchingIds = listIds(matching, today);
        Slice slice = slice(parameters, matchingIds);
        List<Map<String, Object>> loaded = detail.rowsFor(slice.ids(), today);
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        loaded.forEach(row -> byId.put((String) row.get("listId"), row));
        List<Map<String, Object>> items = slice.ids().stream().map(byId::get)
                .filter(java.util.Objects::nonNull)
                .map(detail::wireRow).toList();
        List<Map<String, Object>> stateFacets = stateFacets(base.and(attentionFilter), today);
        List<Map<String, Object>> attentionFacets = attentionFacets(base.and(stateFilter), today);
        return ListQuerySupport.map("items", items, "total", matchingIds.size(),
                "nextCursor", slice.nextCursor(),
                "facets", ListQuerySupport.map("states", stateFacets, "attention", attentionFacets));
    }

    boolean matchesForHook(Map<String, String> parameters, String listId) {
        List<Category> categories = categories();
        LocalDate today = LocalDate.now(clock);
        Condition matching = searchCondition(parameters.get("q"))
                .and(runsCondition(parameters.get("runs"), today))
                .and(stateCondition(allowedValues(parameters.get("state"),
                        List.of("Planned", "InProgress", "Done")), today))
                .and(attentionCondition(allowedValues(parameters.get("attention"),
                        List.of("Overdue", "Blocked", "ReviewNeeded", "LateCopy", "Empty")), today));
        return dsl.fetchExists(dsl.selectOne().from(DIGITIZATION_LISTS)
                .where(DIGITIZATION_LISTS.ID.eq(listId).and(matching)));
    }

    private Condition reachCondition(HeldScopes held, List<Category> categories) {
        List<String> scopes = held.scopesOf("list.read");
        if (scopes.contains("any")) {
            return DSL.noCondition();
        }
        Condition member = DSL.falseCondition();
        if (scopes.contains("custody")) {
            for (Category category : categories) {
                if (held.reachesIteration("list.read", Categories.lineageOf(categories, category.id()))) {
                    member = member.or(ITERATIONS.CATEGORY_ID.eq(category.id()));
                }
            }
        }
        if (scopes.contains("project")) {
            member = member.or(ITERATIONS.PROJECT_ID.in(held.projectIds()));
        }
        return DSL.exists(dsl.selectOne().from(ITERATIONS)
                .where(ITERATIONS.LIST_ID.eq(DIGITIZATION_LISTS.ID).and(member)));
    }

    private Condition searchCondition(String raw) {
        String search = ListQuerySupport.trim(raw);
        if (search == null) {
            return DSL.noCondition();
        }
        return DIGITIZATION_LISTS.ID.containsIgnoreCase(search)
                .or(DIGITIZATION_LISTS.NAME.containsIgnoreCase(search));
    }

    private Condition runsCondition(String raw, LocalDate today) {
        DayRange range = ValueRange.parseDayRange(ListQuerySupport.trim(raw));
        if (range == null) {
            return DSL.noCondition();
        }
        Range<String> days = ValueRange.resolveDayRange(range, today);
        Condition result = DSL.trueCondition();
        if (days.from() != null) {
            result = result.and(DIGITIZATION_LISTS.ENDS_ON.ge(LocalDate.parse(days.from())));
        }
        if (days.to() != null) {
            result = result.and(DIGITIZATION_LISTS.STARTS_ON.le(LocalDate.parse(days.to())));
        }
        if (ValueRange.isReversedRange(days)) {
            return DSL.falseCondition();
        }
        return result;
    }

    private Condition stateCondition(List<String> states, LocalDate today) {
        return states.isEmpty() ? DSL.noCondition() : stateField(today).in(states);
    }

    private Condition attentionCondition(String attention, LocalDate today) {
        return switch (attention) {
            case "Overdue" -> DIGITIZATION_LISTS.DONE_AT.isNull()
                    .and(DIGITIZATION_LISTS.ENDS_ON.lt(today));
            case "Blocked" -> DSL.exists(dsl.selectOne().from(ITERATIONS.join(ITERATION_STATES)
                    .on(ITERATION_STATES.ITERATION_ID.eq(ITERATIONS.ID)))
                    .where(ITERATIONS.LIST_ID.eq(DIGITIZATION_LISTS.ID)
                            .and(ITERATION_STATES.STATUS.in(
                                    "Forbidden", "ReviewNeeded", "ValidationDenied"))));
            case "ReviewNeeded" -> DSL.exists(dsl.selectOne().from(ITERATIONS.join(ITERATION_STATES)
                    .on(ITERATION_STATES.ITERATION_ID.eq(ITERATIONS.ID)))
                    .where(ITERATIONS.LIST_ID.eq(DIGITIZATION_LISTS.ID)
                            .and(ITERATIONS.PROGRESS.in("Digitized", "Published"))
                            .and(ITERATION_STATES.VALIDATION.in("Needed", "Denied"))));
            case "LateCopy" -> DSL.exists(dsl.selectOne().from(ITERATIONS.join(REQUEST_EXISTING_COPIES)
                    .on(REQUEST_EXISTING_COPIES.REQUEST_ID.eq(ITERATIONS.REQUEST_ID)))
                    .where(ITERATIONS.LIST_ID.eq(DIGITIZATION_LISTS.ID)
                            .and(REQUEST_EXISTING_COPIES.FOUND_AFTER_APPROVAL.isTrue())));
            case "Empty" -> DSL.notExists(dsl.selectOne().from(ITERATIONS)
                    .where(ITERATIONS.LIST_ID.eq(DIGITIZATION_LISTS.ID)));
            default -> DSL.falseCondition();
        };
    }

    private Field<String> stateField(LocalDate today) {
        return DSL.when(DIGITIZATION_LISTS.DONE_AT.isNotNull(), "Done")
                .when(DIGITIZATION_LISTS.STARTS_ON.gt(today), "Planned")
                .otherwise("InProgress");
    }

    private List<String> listIds(Condition condition, LocalDate today) {
        Field<String> state = stateField(today);
        Field<Integer> rank = DSL.when(state.eq("InProgress"), 0)
                .when(state.eq("Planned"), 1).otherwise(2);
        return dsl.select(DIGITIZATION_LISTS.ID).from(DIGITIZATION_LISTS).where(condition)
                .orderBy(rank.asc(), DSL.when(state.eq("Done"), DIGITIZATION_LISTS.ENDS_ON).desc(),
                        DSL.when(state.ne("Done"), DIGITIZATION_LISTS.STARTS_ON).asc(),
                        DIGITIZATION_LISTS.POSITION.asc())
                .fetch(DIGITIZATION_LISTS.ID);
    }

    private List<Map<String, Object>> stateFacets(Condition condition, LocalDate today) {
        Field<String> state = stateField(today);
        Map<String, Integer> counts = new LinkedHashMap<>();
        dsl.select(state, count()).from(DIGITIZATION_LISTS).where(condition).groupBy(DSL.inline(1))
                .fetch().forEach(row -> counts.put(row.get(state), row.get(count(), Integer.class)));
        return List.of("Planned", "InProgress", "Done").stream().filter(counts::containsKey)
                .map(value -> ListQuerySupport.map("value", value, "count", counts.get(value))).toList();
    }

    private List<String> allowedValues(String raw, List<String> allowed) {
        String value = ListQuerySupport.trim(raw);
        if (value == null) {
            return List.of();
        }
        return java.util.Arrays.stream(value.split(",")).map(String::trim).filter(allowed::contains)
                .distinct().toList();
    }

    private Slice slice(Map<String, String> parameters, List<String> ids) {
        int limit = 50;
        try {
            int requested = Integer.parseInt(parameters.get("limit"));
            if (requested > 0 && requested <= 200) {
                limit = requested;
            }
        } catch (NumberFormatException | NullPointerException ignored) {
            // Invalid slice values use the contract default.
        }
        return new Slice(Listing.sliceOf(ids, ListQuerySupport.trim(parameters.get("cursor")), limit).items(),
                Listing.sliceOf(ids, ListQuerySupport.trim(parameters.get("cursor")), limit).nextCursor());
    }

    private List<Category> categories() {
        return dsl.select(CATEGORIES.ID, CATEGORIES.PARENT_ID).from(CATEGORIES)
                .fetch(row -> new Category(row.get(CATEGORIES.ID), row.get(CATEGORIES.PARENT_ID)));
    }



    private List<Map<String, Object>> attentionFacets(Condition condition, LocalDate today) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (String reason : List.of("Overdue", "Blocked", "ReviewNeeded", "LateCopy", "Empty")) {
            int found = dsl.fetchCount(DIGITIZATION_LISTS,
                    condition.and(attentionCondition(reason, today)));
            if (found > 0) {
                result.add(ListQuerySupport.map("value", reason, "count", found));
            }
        }
        return result;
    }

    private Condition attentionCondition(List<String> attentions, LocalDate today) {
        if (attentions.isEmpty()) {
            return DSL.noCondition();
        }
        Condition result = DSL.falseCondition();
        for (String attention : attentions) {
            result = result.or(attentionCondition(attention, today));
        }
        return result;
    }

    private record Slice(List<String> ids, String nextCursor) {}
}
