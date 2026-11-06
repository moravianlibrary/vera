package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_STATES;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.PROJECTS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static org.jooq.impl.DSL.exists;
import static org.jooq.impl.DSL.selectOne;

import cz.mzk.vera.db.tables.tables.records.CategoriesRecord;
import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Component;

// VIEW-documents-audience; SCOPE-custody-category; SCOPE-project: the document's one reach rule.
@Component
public class DocumentReach {
    private final DSLContext dsl;

    public DocumentReach(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Condition condition(HeldScopes held, String callerId, Audience audience) {
        if (audience == Audience.PUBLIC) {
            return exists(selectOne().from(REQUESTS).where(REQUESTS.DOCUMENT_ID.eq(DOCUMENTS.ID)
                .and(requestCondition(held, callerId))));
        }
        if (!held.hasPermission(DocumentCodes.ITERATION_READ)) {
            return DSL.falseCondition();
        }
        Condition reached = held.scopesOf(DocumentCodes.ITERATION_READ).contains("any")
            ? DSL.trueCondition() : DSL.falseCondition();
        reached = reached.or(exists(selectOne().from(REQUESTS)
            .where(REQUESTS.DOCUMENT_ID.eq(DOCUMENTS.ID).and(REQUESTS.REQUESTER_ID.eq(callerId)))));
        if (held.scopesOf(DocumentCodes.ITERATION_READ).contains("custody")) {
            List<Category> allCategories = dsl.selectFrom(CATEGORIES).fetch(this::category);
            Set<String> categories = allCategories.stream()
                .filter(category -> Categories.lineageOf(
                    allCategories, category.id()).stream()
                    .anyMatch(held.custodyCategoryIds()::contains))
                .map(Category::id).collect(Collectors.toSet());
            if (!categories.isEmpty()) {
                reached = reached.or(exists(selectOne().from(DOCUMENT_STATES)
                    .join(ITERATIONS).on(ITERATIONS.ID.eq(DOCUMENT_STATES.CURRENT_ITERATION_ID))
                    .where(DOCUMENT_STATES.DOCUMENT_ID.eq(DOCUMENTS.ID)
                        .and(ITERATIONS.CATEGORY_ID.in(categories)))));
            }
        }
        if (held.scopesOf(DocumentCodes.ITERATION_READ).contains("project") && !held.projectIds().isEmpty()) {
            reached = reached.or(exists(selectOne().from(REQUESTS).where(
                    REQUESTS.DOCUMENT_ID.eq(DOCUMENTS.ID)
                        .and(REQUESTS.PROJECT_ID.in(held.projectIds())))))
                .or(exists(selectOne().from(ITERATIONS).where(
                    ITERATIONS.DOCUMENT_ID.eq(DOCUMENTS.ID)
                        .and(ITERATIONS.PROJECT_ID.in(held.projectIds())))));
        }
        return exists(selectOne().from(DOCUMENT_STATES).where(
            DOCUMENT_STATES.DOCUMENT_ID.eq(DOCUMENTS.ID)
                .and(DOCUMENT_STATES.CURRENT_ITERATION_ID.isNotNull()))).and(reached);
    }

    public static Condition requestCondition(HeldScopes held, String callerId) {
        Condition own = REQUESTS.REQUESTER_ID.eq(callerId);
        if (held.scopesOf(DocumentCodes.REQUEST_READ_MINE).contains("project")
                && !held.projectIds().isEmpty()) {
            own = own.or(REQUESTS.PROJECT_ID.in(held.projectIds()));
        }
        return own;
    }

    private Category category(CategoriesRecord row) {
        return new Category(row.getId(), row.getParentId());
    }
}
