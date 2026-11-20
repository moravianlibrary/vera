package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_VALUES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_STATES;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_STATES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_STATES;
import static org.jooq.impl.DSL.exists;
import static org.jooq.impl.DSL.inline;
import static org.jooq.impl.DSL.notExists;
import static org.jooq.impl.DSL.selectOne;

import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.valuerange.DayRange;
import cz.mzk.vera.domain.valuerange.Range;
import cz.mzk.vera.domain.valuerange.ValueRange;
import cz.mzk.vera.listing.FacetSource;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record3;
import org.jooq.Row3;
import org.jooq.Select;
import org.jooq.Table;
import org.jooq.impl.DSL;

// FILTER-documents; UI-facets: define each query field, its audience, conditions and facet source.
enum DocumentField {
    STATUSES("status", "statuses", Set.of(Audience.PUBLIC)),
    DECISIONS("decision", "decisions", Set.of(Audience.STAFF)),
    PROGRESS("progress", "progress", Set.of(Audience.STAFF)),
    VALIDATIONS("validation", "validations", Set.of(Audience.STAFF)),
    FORBIDDEN("forbidden", "forbidden", Set.of(Audience.STAFF)),
    CANCELLED("cancelled", "cancelled", Set.of(Audience.STAFF)),
    CATEGORY_IDS("category", "categoryIds", Set.of(Audience.STAFF)),
    PROJECT_IDS("project", "projectIds", Set.of(Audience.STAFF)),
    PRIORITIES("priority", "priorities", Set.of(Audience.STAFF)),
    EXISTING_COPIES("copy", "existingCopies", Set.of(Audience.STAFF)),
    ASKER_IDS("asker", "askerIds", Set.of(Audience.STAFF)),
    SEARCH("q", null, Set.of(Audience.STAFF, Audience.PUBLIC)),
    MINE("mine", null, Set.of(Audience.STAFF)),
    PAGES("pages", null, Set.of(Audience.STAFF)),
    ASKED("asked", null, Set.of(Audience.STAFF)),
    PROPERTIES("p.", null, Set.of(Audience.STAFF, Audience.PUBLIC));

    private final String queryName;
    private final String facetName;
    private final Set<Audience> audiences;
    DocumentField(String queryName, String facetName, Set<Audience> audiences) {
        this.queryName = queryName;
        this.facetName = facetName;
        this.audiences = Set.copyOf(audiences);
    }

    String queryName() {
        return queryName;
    }

    String facetName() {
        return facetName;
    }

    boolean isAvailableTo(Audience audience) {
        return audiences.contains(audience);
    }

    boolean hasFacet() {
        return facetName != null;
    }

    Condition filterCondition(DSLContext dsl, DocumentSearch search, String callerId,
            List<Category> categories, LocalDate today, String except, HeldScopes held) {
        if (facetName != null && facetName.equals(except)) {
            return DSL.noCondition();
        }
        return switch (this) {
            case STATUSES -> publicStatusCondition(dsl, search.statuses(), callerId, held);
            case DECISIONS -> currentRequestValue(search.decisions(), REQUESTS.DECISION);
            case PROGRESS -> currentIterationValue(search.progress(), ITERATIONS.PROGRESS);
            case VALIDATIONS -> currentIterationValue(search.validations(), ITERATION_STATES.VALIDATION);
            case FORBIDDEN -> currentBoolean(search.forbidden(), ITERATION_STATES.IS_RESTRICTED, true);
            case CANCELLED -> currentBoolean(search.cancelled(), ITERATIONS.CANCELLATION_CAUSE, false);
            case CATEGORY_IDS -> categoryCondition(dsl, search.categoryIds(), categories);
            case PROJECT_IDS -> currentDocumentValue(search.projectIds(), DOCUMENT_STATES.PROJECT_ID);
            case PRIORITIES -> currentIterationValue(search.priorities(), ITERATIONS.PRIORITY);
            case EXISTING_COPIES -> currentDocumentValue(search.existingCopies(),
                DOCUMENT_STATES.EXISTING_COPY_STATE);
            case ASKER_IDS -> currentRequestValue(search.askerIds(), REQUESTS.REQUESTER_ID);
            case SEARCH -> searchCondition(search.search());
            case MINE -> mineCondition(search.isMine(), callerId);
            case PAGES -> pageCondition(search.pages());
            case ASKED -> askedCondition(search.asked(), today);
            case PROPERTIES -> propertyConditions(search.properties(), today, except);
        };
    }

    FacetSource facetSource(DSLContext dsl, String callerId, List<Category> categories, HeldScopes held) {
        Select<Record3<String, String, Integer>> values = switch (this) {
            case STATUSES -> {
                yield dsl.select(REQUEST_STATES.DOCUMENT_ID, REQUEST_STATES.PUBLIC_STATUS, inline(0))
                    .from(REQUESTS.join(REQUEST_STATES)
                        .on(REQUEST_STATES.REQUEST_ID.eq(REQUESTS.ID)))
                    .where(REQUESTS.ID.eq(DocumentOrder.publicRequestId(callerId, held,
                        REQUEST_STATES.DOCUMENT_ID)));
            }
            case DECISIONS -> dsl.selectDistinct(REQUESTS.DOCUMENT_ID, REQUESTS.DECISION, inline(0))
                .from(REQUESTS.join(REQUEST_STATES).on(REQUEST_STATES.REQUEST_ID.eq(REQUESTS.ID)))
                .where(REQUEST_STATES.IS_ASKER.isTrue()
                    .and(REQUESTS.DECISION.in(DocumentSearch.ASK_DECISIONS)));
            case PROGRESS -> dsl.select(DOCUMENT_STATES.DOCUMENT_ID, ITERATIONS.PROGRESS, inline(0))
                .from(DOCUMENT_STATES.join(ITERATIONS)
                    .on(ITERATIONS.ID.eq(DOCUMENT_STATES.CURRENT_ITERATION_ID)));
            case VALIDATIONS -> dsl.select(ITERATION_STATES.DOCUMENT_ID,
                    ITERATION_STATES.VALIDATION, inline(0))
                .from(ITERATION_STATES.join(DOCUMENT_STATES)
                    .on(DOCUMENT_STATES.CURRENT_ITERATION_ID.eq(ITERATION_STATES.ITERATION_ID)));
            case FORBIDDEN -> dsl.select(ITERATION_STATES.DOCUMENT_ID,
                    DSL.when(ITERATION_STATES.IS_RESTRICTED.isTrue(), "Yes").otherwise("No"), inline(0))
                .from(ITERATION_STATES.join(DOCUMENT_STATES)
                    .on(DOCUMENT_STATES.CURRENT_ITERATION_ID.eq(ITERATION_STATES.ITERATION_ID)));
            case CANCELLED -> dsl.select(DOCUMENT_STATES.DOCUMENT_ID,
                    DSL.when(ITERATIONS.CANCELLATION_CAUSE.isNotNull(), "Yes").otherwise("No"), inline(0))
                .from(DOCUMENT_STATES.join(ITERATIONS)
                    .on(ITERATIONS.ID.eq(DOCUMENT_STATES.CURRENT_ITERATION_ID)));
            case CATEGORY_IDS -> categoryValues(dsl, categories);
            case PROJECT_IDS -> dsl.select(DOCUMENT_STATES.DOCUMENT_ID, DOCUMENT_STATES.PROJECT_ID, inline(0))
                .from(DOCUMENT_STATES).where(DOCUMENT_STATES.PROJECT_ID.isNotNull());
            case PRIORITIES -> dsl.select(DOCUMENT_STATES.DOCUMENT_ID, ITERATIONS.PRIORITY, inline(0))
                .from(DOCUMENT_STATES.join(ITERATIONS)
                    .on(ITERATIONS.ID.eq(DOCUMENT_STATES.CURRENT_ITERATION_ID)));
            case EXISTING_COPIES -> dsl.select(DOCUMENT_STATES.DOCUMENT_ID,
                    DOCUMENT_STATES.EXISTING_COPY_STATE, inline(0)).from(DOCUMENT_STATES);
            case ASKER_IDS -> dsl.select(REQUESTS.DOCUMENT_ID, REQUESTS.REQUESTER_ID,
                    DSL.rowNumber().over(DSL.partitionBy(REQUESTS.DOCUMENT_ID)
                        .orderBy(DSL.min(REQUESTS.AT))).cast(Integer.class))
                .from(REQUESTS.join(REQUEST_STATES).on(REQUEST_STATES.REQUEST_ID.eq(REQUESTS.ID)))
                .where(REQUEST_STATES.IS_ASKER.isTrue())
                .groupBy(REQUESTS.DOCUMENT_ID, REQUESTS.REQUESTER_ID);
            case SEARCH, MINE, PAGES, ASKED, PROPERTIES -> null;
        };
        return values == null ? null : new FacetSource(facetName, values, null);
    }

    private Condition publicStatusCondition(DSLContext dsl, List<String> wanted, String callerId,
            HeldScopes held) {
        if (wanted.isEmpty()) {
            return DSL.noCondition();
        }
        return exists(dsl.selectOne().from(REQUESTS.join(REQUEST_STATES)
            .on(REQUEST_STATES.REQUEST_ID.eq(REQUESTS.ID)))
            .where(REQUESTS.ID.eq(DocumentOrder.publicRequestId(callerId, held, DOCUMENTS.ID))
                .and(REQUEST_STATES.PUBLIC_STATUS.in(wanted))));
    }

    private Condition currentRequestValue(List<String> wanted, Field<String> field) {
        if (wanted.isEmpty()) {
            return DSL.noCondition();
        }
        return exists(selectOne().from(REQUESTS.join(REQUEST_STATES)
            .on(REQUEST_STATES.REQUEST_ID.eq(REQUESTS.ID)))
            .where(REQUESTS.DOCUMENT_ID.eq(DOCUMENTS.ID)
                .and(REQUEST_STATES.IS_ASKER.isTrue()).and(field.in(wanted))));
    }

    private Condition currentIterationValue(List<String> wanted, Field<String> field) {
        if (wanted.isEmpty()) {
            return DSL.noCondition();
        }
        return exists(selectOne().from(DOCUMENT_STATES.join(ITERATIONS)
            .on(ITERATIONS.ID.eq(DOCUMENT_STATES.CURRENT_ITERATION_ID))
            .leftJoin(ITERATION_STATES).on(ITERATION_STATES.ITERATION_ID.eq(ITERATIONS.ID)))
            .where(DOCUMENT_STATES.DOCUMENT_ID.eq(DOCUMENTS.ID).and(field.in(wanted))));
    }

    private Condition currentDocumentValue(List<String> wanted, Field<String> field) {
        if (wanted.isEmpty()) {
            return DSL.noCondition();
        }
        return exists(selectOne().from(DOCUMENT_STATES)
            .where(DOCUMENT_STATES.DOCUMENT_ID.eq(DOCUMENTS.ID).and(field.in(wanted))));
    }

    private Condition currentBoolean(List<String> wanted, Field<?> field, boolean booleanField) {
        if (wanted.isEmpty()) {
            return DSL.noCondition();
        }
        Condition yes = booleanField ? ITERATION_STATES.IS_RESTRICTED.isTrue() : field.isNotNull();
        Condition no = booleanField ? ITERATION_STATES.IS_RESTRICTED.isFalse() : field.isNull();
        Condition condition = DSL.falseCondition();
        if (wanted.contains("Yes")) {
            condition = condition.or(yes);
        }
        if (wanted.contains("No")) {
            condition = condition.or(no);
        }
        return exists(selectOne().from(DOCUMENT_STATES.join(ITERATIONS)
            .on(ITERATIONS.ID.eq(DOCUMENT_STATES.CURRENT_ITERATION_ID))
            .leftJoin(ITERATION_STATES).on(ITERATION_STATES.ITERATION_ID.eq(ITERATIONS.ID)))
            .where(DOCUMENT_STATES.DOCUMENT_ID.eq(DOCUMENTS.ID).and(condition)));
    }

    private Condition categoryCondition(DSLContext dsl, List<String> wanted, List<Category> categories) {
        if (wanted.isEmpty()) {
            return DSL.noCondition();
        }
        Table<?> pairs = categoryLineagePairs(dsl, categories);
        var categoryId = DSL.field(DSL.name("category_lineage", "category_id"), String.class);
        var ancestorId = DSL.field(DSL.name("category_lineage", "ancestor_id"), String.class);
        return exists(selectOne().from(DOCUMENT_STATES.join(ITERATIONS)
            .on(ITERATIONS.ID.eq(DOCUMENT_STATES.CURRENT_ITERATION_ID)))
            .join(pairs).on(categoryId.eq(ITERATIONS.CATEGORY_ID))
            .where(DOCUMENT_STATES.DOCUMENT_ID.eq(DOCUMENTS.ID).and(ancestorId.in(wanted))));
    }

    private Condition searchCondition(String search) {
        if (search == null) {
            return DSL.noCondition();
        }
        return DOCUMENTS.TITLE.containsIgnoreCase(search)
            .or(DOCUMENTS.CATALOG_ID.containsIgnoreCase(search))
            .or(DOCUMENTS.UNIT_VALUE.containsIgnoreCase(search))
            .or(DOCUMENTS.SHELF_MARK.containsIgnoreCase(search))
            .or(exists(selectOne().from(ITERATIONS).where(ITERATIONS.DOCUMENT_ID.eq(DOCUMENTS.ID)
                .and(ITERATIONS.ID.equalIgnoreCase(search)))))
            .or(exists(selectOne().from(REQUESTS).where(REQUESTS.DOCUMENT_ID.eq(DOCUMENTS.ID)
                .and(REQUESTS.ID.equalIgnoreCase(search)))));
    }

    private Condition mineCondition(boolean mine, String callerId) {
        if (!mine) {
            return DSL.noCondition();
        }
        return exists(selectOne().from(REQUESTS)
            .where(REQUESTS.DOCUMENT_ID.eq(DOCUMENTS.ID).and(REQUESTS.REQUESTER_ID.eq(callerId))));
    }

    private Condition pageCondition(Range<Long> pages) {
        if (pages == null) {
            return DSL.noCondition();
        }
        Condition range = DSL.trueCondition();
        if (pages.from() != null) {
            range = range.and(DOCUMENT_STATES.PAGE_COUNT.ge(pages.from().intValue()));
        }
        if (pages.to() != null) {
            range = range.and(DOCUMENT_STATES.PAGE_COUNT.le(pages.to().intValue()));
        }
        return exists(selectOne().from(DOCUMENT_STATES)
            .where(DOCUMENT_STATES.DOCUMENT_ID.eq(DOCUMENTS.ID).and(range)));
    }

    private Condition askedCondition(DayRange asked, LocalDate today) {
        if (asked == null) {
            return DSL.noCondition();
        }
        Range<String> days = ValueRange.resolveDayRange(asked, today);
        Condition range = DSL.trueCondition();
        if (days.from() != null) {
            range = range.and(REQUESTS.AT.cast(LocalDate.class).ge(LocalDate.parse(days.from())));
        }
        if (days.to() != null) {
            range = range.and(REQUESTS.AT.cast(LocalDate.class).le(LocalDate.parse(days.to())));
        }
        return exists(selectOne().from(REQUESTS.join(REQUEST_STATES)
            .on(REQUEST_STATES.REQUEST_ID.eq(REQUESTS.ID)))
            .where(REQUESTS.DOCUMENT_ID.eq(DOCUMENTS.ID)
                .and(REQUEST_STATES.IS_ASKER.isTrue()).and(range)));
    }

    Condition propertyConditions(Map<String, DocumentSearch.PropertyCondition> properties,
            LocalDate today, String except) {
        Condition result = DSL.noCondition();
        for (Map.Entry<String, DocumentSearch.PropertyCondition> entry : properties.entrySet()) {
            if (!(queryName + entry.getKey()).equals(except)) {
                result = result.and(propertyCondition(entry.getKey(), entry.getValue(), today));
            }
        }
        return result;
    }

    private Condition propertyCondition(String key,
            DocumentSearch.PropertyCondition property, LocalDate today) {
        var existsValue = exists(selectOne().from(DOCUMENT_PROPERTY_VALUES)
            .where(DOCUMENT_PROPERTY_VALUES.DOCUMENT_ID.eq(DOCUMENTS.ID)
                .and(DOCUMENT_PROPERTY_VALUES.KEY.eq(key))));
        Condition matching = DSL.trueCondition();
        boolean hasValueCondition = false;
        if (property.contains() != null) {
            hasValueCondition = true;
            matching = matching.and(exists(selectOne().from(DOCUMENT_PROPERTY_VALUES)
                .where(DOCUMENT_PROPERTY_VALUES.DOCUMENT_ID.eq(DOCUMENTS.ID)
                    .and(DOCUMENT_PROPERTY_VALUES.KEY.eq(key))
                    .and(DOCUMENT_PROPERTY_VALUES.TEXT_VALUE.containsIgnoreCase(property.contains())))));
        }
        if (property.starts() != null) {
            hasValueCondition = true;
            matching = matching.and(exists(selectOne().from(DOCUMENT_PROPERTY_VALUES)
                .where(DOCUMENT_PROPERTY_VALUES.DOCUMENT_ID.eq(DOCUMENTS.ID)
                    .and(DOCUMENT_PROPERTY_VALUES.KEY.eq(key))
                    .and(DOCUMENT_PROPERTY_VALUES.TEXT_VALUE.startsWithIgnoreCase(property.starts())))));
        }
        if (property.ends() != null) {
            hasValueCondition = true;
            matching = matching.and(exists(selectOne().from(DOCUMENT_PROPERTY_VALUES)
                .where(DOCUMENT_PROPERTY_VALUES.DOCUMENT_ID.eq(DOCUMENTS.ID)
                    .and(DOCUMENT_PROPERTY_VALUES.KEY.eq(key))
                    .and(DOCUMENT_PROPERTY_VALUES.TEXT_VALUE.endsWithIgnoreCase(property.ends())))));
        }
        if (property.numbers() != null) {
            hasValueCondition = true;
            Condition range = DSL.trueCondition();
            if (property.numbers().from() != null) {
                range = range.and(DOCUMENT_PROPERTY_VALUES.NUMBER_VALUE.ge(property.numbers().from()));
            }
            if (property.numbers().to() != null) {
                range = range.and(DOCUMENT_PROPERTY_VALUES.NUMBER_VALUE.le(property.numbers().to()));
            }
            matching = matching.and(exists(selectOne().from(DOCUMENT_PROPERTY_VALUES)
                .where(DOCUMENT_PROPERTY_VALUES.DOCUMENT_ID.eq(DOCUMENTS.ID)
                    .and(DOCUMENT_PROPERTY_VALUES.KEY.eq(key)).and(range))));
        }
        if (property.days() != null) {
            hasValueCondition = true;
            Range<String> days = ValueRange.resolveDayRange(property.days(), today);
            Condition range = DSL.trueCondition();
            if (days.from() != null) {
                range = range.and(DOCUMENT_PROPERTY_VALUES.TEXT_VALUE.ge(days.from()));
            }
            if (days.to() != null) {
                range = range.and(DOCUMENT_PROPERTY_VALUES.TEXT_VALUE.le(days.to()));
            }
            matching = matching.and(exists(selectOne().from(DOCUMENT_PROPERTY_VALUES)
                .where(DOCUMENT_PROPERTY_VALUES.DOCUMENT_ID.eq(DOCUMENTS.ID)
                    .and(DOCUMENT_PROPERTY_VALUES.KEY.eq(key)).and(range))));
        }
        if (!property.values().isEmpty()) {
            hasValueCondition = true;
            matching = matching.and(exists(selectOne().from(DOCUMENT_PROPERTY_VALUES)
                .where(DOCUMENT_PROPERTY_VALUES.DOCUMENT_ID.eq(DOCUMENTS.ID)
                    .and(DOCUMENT_PROPERTY_VALUES.KEY.eq(key))
                    .and(DOCUMENT_PROPERTY_VALUES.TEXT_VALUE.in(property.values())))));
        }
        if (property.noValue()) {
            Condition missing = existsValue.not();
            return hasValueCondition ? matching.or(missing) : missing;
        }
        return matching;
    }

    private Select<Record3<String, String, Integer>> categoryValues(DSLContext dsl,
            List<Category> categories) {
        Table<?> pairs = categoryLineagePairs(dsl, categories);
        var categoryId = DSL.field(DSL.name("category_lineage", "category_id"), String.class);
        var ancestorId = DSL.field(DSL.name("category_lineage", "ancestor_id"), String.class);
        var ordinal = DSL.field(DSL.name("category_lineage", "ordinal"), Integer.class);
        return dsl.select(DOCUMENT_STATES.DOCUMENT_ID, ancestorId, ordinal)
            .from(DOCUMENT_STATES.join(ITERATIONS)
                .on(ITERATIONS.ID.eq(DOCUMENT_STATES.CURRENT_ITERATION_ID)))
            .join(pairs).on(categoryId.eq(ITERATIONS.CATEGORY_ID));
    }

    @SuppressWarnings("unchecked")
    private Table<?> categoryLineagePairs(DSLContext dsl, List<Category> categories) {
        List<Row3<String, String, Integer>> lineageRows = new ArrayList<>();
        for (Category category : categories) {
            int ordinal = 0;
            for (String ancestor : Categories.lineageOf(categories, category.id())) {
                lineageRows.add(DSL.row(inline(category.id()), inline(ancestor), inline(ordinal++)));
            }
        }
        if (lineageRows.isEmpty()) {
            return dsl.select(inline("", String.class), inline("", String.class), inline(0))
                .where(DSL.falseCondition())
                .asTable("category_lineage", "category_id", "ancestor_id", "ordinal");
        }
        return DSL.values(lineageRows.toArray(Row3[]::new))
            .asTable("category_lineage", "category_id", "ancestor_id", "ordinal");
    }
}
