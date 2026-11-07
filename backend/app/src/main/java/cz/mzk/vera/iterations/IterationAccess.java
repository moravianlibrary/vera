package cz.mzk.vera.iterations;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.iterations.Iterations;
import cz.mzk.vera.db.tables.tables.records.IterationsRecord;
import cz.mzk.vera.documents.Audience;
import cz.mzk.vera.documents.DocumentQueries;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import java.util.List;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;

// ACT-current-attempt; SCOPE-custody-category: the shared current iteration and category reach check.
@Component
public class IterationAccess {
    private final DSLContext dsl;
    private final HeldAccessQueries heldAccess;
    private final DocumentQueries documents;

    public IterationAccess(DSLContext dsl, HeldAccessQueries heldAccess, DocumentQueries documents) {
        this.dsl = dsl;
        this.heldAccess = heldAccess;
        this.documents = documents;
    }

    public Result actionableIteration(Caller caller, String iterationId, String permission) {
        if (documents.audienceOf(caller.userId()) != Audience.STAFF) {
            return Result.refused(ActResult.refused(404, "No such iteration", null));
        }
        var iteration = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq(iterationId)).fetchOne();
        if (iteration == null) {
            return Result.refused(ActResult.refused(404, "No such iteration", null));
        }
        List<Category> categories = dsl.select(CATEGORIES.ID, CATEGORIES.PARENT_ID).from(CATEGORIES)
                .fetch(row -> new Category(row.get(CATEGORIES.ID), row.get(CATEGORIES.PARENT_ID)));
        var scope = Iterations.scopeOfIteration(categories, iteration.getCategoryId());
        var held = heldAccess.scopesHeldBy(caller.userId());
        boolean current = !dsl.fetchExists(dsl.selectOne().from(ITERATIONS)
                .where(ITERATIONS.DOCUMENT_ID.eq(iteration.getDocumentId())
                        .and(ITERATIONS.ATTEMPT.gt(iteration.getAttempt()))));
        if (!current) {
            return Result.refused(ActResult.refused(409,
                    "A later attempt has replaced this one", IterationCodes.NOT_CURRENT));
        }
        boolean inCustody = scope.categoryPathIds().stream().anyMatch(held.custodyCategoryIds()::contains);
        if (!held.scopesOf(permission).contains("any")
                && (!held.scopesOf(permission).contains("custody") || !inCustody)) {
            return Result.refused(ActResult.refused(403,
                    "This is outside what you may change", IterationCodes.OUTSIDE_CUSTODY));
        }
        return Result.found(new Actionable(iteration, categories));
    }

    public record Actionable(IterationsRecord iteration, List<Category> categories) {}

    public record Result(Actionable value, ActResult refusal) {
        static Result found(Actionable value) {
            return new Result(value, null);
        }

        static Result refused(ActResult refusal) {
            return new Result(null, refusal);
        }
    }
}
