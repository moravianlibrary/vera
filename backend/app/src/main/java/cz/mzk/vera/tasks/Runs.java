package cz.mzk.vera.tasks;

import static cz.mzk.vera.db.tables.Tables.RUNS;

import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

// PLG-run-items; a cancelled row is observed by its worker before it handles another item.
@Repository
public class Runs {
    private final DSLContext dsl;

    public Runs(DSLContext dsl) {
        this.dsl = dsl;
    }

    public boolean isCancelled(String runId) {
        return dsl.fetchExists(dsl.selectFrom(RUNS)
                .where(RUNS.ID.eq(runId))
                .and(RUNS.STATE.eq("Cancelled")));
    }
}
