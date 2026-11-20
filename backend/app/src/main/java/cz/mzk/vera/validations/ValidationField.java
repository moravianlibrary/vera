package cz.mzk.vera.validations;

import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_DEFECTS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_STATES;
import static cz.mzk.vera.db.tables.Tables.ITERATION_VERDICTS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static org.jooq.impl.DSL.exists;
import static org.jooq.impl.DSL.inline;

import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.listing.FacetSource;
import java.util.ArrayList;
import java.util.List;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record3;
import org.jooq.Row3;
import org.jooq.Select;
import org.jooq.Table;
import org.jooq.impl.DSL;

// FILTER-validations; STAT-validation: each field ports its mock predicate and facet values.
enum ValidationField {
    REVIEWS("review", "reviews"), // fieldValues.reviews
    FORBIDDEN("forbidden", "forbidden"), // fieldValues.forbidden
    CATEGORIES("category", "categoryIds"), // fieldValues.categoryIds
    INSTANCES("defect", "instances"), // fieldValues.instances
    PRIORITIES("priority", "priorities"), // fieldValues.priorities
    PROJECTS("project", "projectIds"); // fieldValues.projectIds

    private final String parameter;
    private final String facet;

    ValidationField(String parameter, String facet) {
        this.parameter = parameter;
        this.facet = facet;
    }

    String parameter() {
        return parameter;
    }

    String facet() {
        return facet;
    }

    Condition filterCondition(DSLContext dsl, List<String> wanted, List<Category> categories) {
        return switch (this) {
            case REVIEWS -> ITERATION_STATES.REVIEW_STATE.in(wanted);
            case FORBIDDEN -> {
                Condition answer = DSL.falseCondition();
                if (wanted.contains("Yes")) {
                    answer = answer.or(ITERATION_STATES.REVIEW_STATE.eq("Forbidden"));
                }
                if (wanted.contains("No")) {
                    answer = answer.or(ITERATION_STATES.REVIEW_STATE.ne("Forbidden"));
                }
                yield answer;
            }
            case CATEGORIES -> categoryCondition(categories, wanted);
            case INSTANCES -> instanceCondition(dsl, wanted);
            case PRIORITIES -> ITERATIONS.PRIORITY.in(wanted);
            case PROJECTS -> ITERATIONS.PROJECT_ID.in(wanted);
        };
    }

    FacetSource facetSource(DSLContext dsl, List<Category> categories) {
        Select<Record3<String, String, Integer>> values = switch (this) {
            case REVIEWS -> dsl.select(ITERATIONS.ID, ITERATION_STATES.REVIEW_STATE, inline(0))
                    .from(ITERATIONS.join(ITERATION_STATES)
                            .on(ITERATION_STATES.ITERATION_ID.eq(ITERATIONS.ID)))
                    .where(ITERATION_STATES.REVIEW_STATE.ne("Forbidden"));
            case FORBIDDEN -> dsl.select(ITERATIONS.ID,
                    DSL.when(ITERATION_STATES.REVIEW_STATE.eq("Forbidden"), "Yes")
                            .otherwise("No"), inline(0))
                    .from(ITERATIONS.join(ITERATION_STATES)
                            .on(ITERATION_STATES.ITERATION_ID.eq(ITERATIONS.ID)));
            case CATEGORIES -> categoryFacetValues(dsl, categories);
            case INSTANCES -> dsl.select(ITERATION_DEFECTS.ITERATION_ID,
                            ITERATION_DEFECTS.INSTANCE_ID,
                            DSL.min(ITERATION_DEFECTS.POSITION).cast(Integer.class))
                    .from(ITERATION_DEFECTS.join(ITERATION_STATES)
                            .on(ITERATION_STATES.ITERATION_ID.eq(ITERATION_DEFECTS.ITERATION_ID)))
                    .where(DSL.or(ITERATION_STATES.REVIEW_STATE.ne("Needed"),
                            notAccepted(ITERATION_DEFECTS.KEY)))
                    .groupBy(ITERATION_DEFECTS.ITERATION_ID, ITERATION_DEFECTS.INSTANCE_ID);
            case PRIORITIES -> dsl.select(ITERATIONS.ID, ITERATIONS.PRIORITY, inline(0))
                    .from(ITERATIONS);
            case PROJECTS -> dsl.select(ITERATIONS.ID, ITERATIONS.PROJECT_ID, inline(0))
                    .from(ITERATIONS).where(ITERATIONS.PROJECT_ID.isNotNull());
        };
        return new FacetSource(facet, values, null);
    }

    static ValidationField ofFacet(String facet) {
        for (ValidationField field : values()) {
            if (field.facet.equals(facet)) {
                return field;
            }
        }
        throw new IllegalArgumentException("Unknown validation field " + facet);
    }

    static Condition notAccepted(Field<String> key) {
        var verdict = ITERATION_VERDICTS.as("validation_verdict");
        var later = ITERATION_VERDICTS.as("later_validation_verdict");
        return DSL.notExists(DSL.selectOne().from(verdict)
                .where(verdict.ITERATION_ID.eq(ITERATION_DEFECTS.ITERATION_ID)
                        .and(verdict.VERDICT.eq("Approved"))
                        .and(DSL.condition("{0} = any({1})", key, verdict.DEFECT_KEYS))
                        .and(DSL.notExists(DSL.selectOne().from(later)
                                .where(later.ITERATION_ID.eq(verdict.ITERATION_ID)
                                        .and(later.POSITION.gt(verdict.POSITION))
                                        .and(DSL.condition("{0} = any({1})", key,
                                                later.DEFECT_KEYS)))))));
    }

    private Condition instanceCondition(DSLContext dsl, List<String> wanted) {
        return exists(dsl.selectOne().from(ITERATION_DEFECTS)
                .where(ITERATION_DEFECTS.ITERATION_ID.eq(ITERATIONS.ID)
                        .and(ITERATION_DEFECTS.INSTANCE_ID.in(wanted))
                        .and(DSL.or(ITERATION_STATES.REVIEW_STATE.ne("Needed"),
                                notAccepted(ITERATION_DEFECTS.KEY)))));
    }

    private Condition categoryCondition(List<Category> categories, List<String> wanted) {
        List<String> reached = categories.stream()
                .filter(category -> Categories.lineageOf(categories, category.id()).stream()
                        .anyMatch(wanted::contains))
                .map(Category::id)
                .toList();
        return reached.isEmpty() ? DSL.falseCondition() : ITERATIONS.CATEGORY_ID.in(reached);
    }

    @SuppressWarnings("unchecked")
    private Select<Record3<String, String, Integer>> categoryFacetValues(
            DSLContext dsl, List<Category> categories) {
        List<Row3<String, String, Integer>> pairs = new ArrayList<>();
        for (Category category : categories) {
            int ordinal = 0;
            for (String ancestor : Categories.lineageOf(categories, category.id())) {
                pairs.add(DSL.row(inline(category.id()), inline(ancestor), inline(ordinal++)));
            }
        }
        Table<?> lineage = pairs.isEmpty()
                ? dsl.select(inline("", String.class), inline("", String.class), inline(0))
                        .where(DSL.falseCondition())
                        .asTable("validation_category_lineage", "category_id", "ancestor_id", "ordinal")
                : DSL.values(pairs.toArray(Row3[]::new))
                        .asTable("validation_category_lineage", "category_id", "ancestor_id", "ordinal");
        Field<String> categoryId = lineage.field("category_id", String.class);
        Field<String> ancestorId = lineage.field("ancestor_id", String.class);
        Field<Integer> ordinal = lineage.field("ordinal", Integer.class);
        return dsl.select(ITERATIONS.ID, ancestorId, ordinal).from(ITERATIONS)
                .join(lineage).on(categoryId.eq(ITERATIONS.CATEGORY_ID));
    }
}
