package cz.mzk.vera.intentions;

import static cz.mzk.vera.db.tables.Tables.INTENTIONS;
import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.max;

import cz.mzk.vera.session.RecordIds;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;

// PLAN-no-mix; PLAN-intention: project acts own the project's intention writes.
@Service
public class ProjectIntentionWrites {
    private final DSLContext dsl;

    public ProjectIntentionWrites(DSLContext dsl) {
        this.dsl = dsl;
    }

    public String create(String projectId, String name, String startsOn, String endsOn, Integer targetPages) {
        List<String> ids = dsl.select(INTENTIONS.ID).from(INTENTIONS).fetch(INTENTIONS.ID);
        String id = RecordIds.next("i", ids);
        int position = dsl.select(coalesce(max(INTENTIONS.POSITION), -1).add(1))
                .from(INTENTIONS).fetchOne(0, int.class);
        dsl.insertInto(INTENTIONS)
                .set(INTENTIONS.ID, id)
                .set(INTENTIONS.NAME, name)
                .set(INTENTIONS.DESCRIPTION, "")
                .set(INTENTIONS.FUNDING_KIND, "project")
                .set(INTENTIONS.FUNDING_PROJECT_ID, projectId)
                .set(INTENTIONS.PROJECT_ID, projectId)
                .set(INTENTIONS.TARGET_PAGES, targetPages)
                .set(INTENTIONS.COUNTS_FROM, LocalDate.parse(startsOn))
                .set(INTENTIONS.ENDS_ON, LocalDate.parse(endsOn))
                .set(INTENTIONS.IS_OVERALL, false)
                .set(INTENTIONS.POSITION, position)
                .execute();
        return id;
    }

    public void follow(String id, String projectId, String name, String startsOn, String endsOn,
            Integer targetPages) {
        dsl.update(INTENTIONS)
                .set(INTENTIONS.NAME, name)
                .set(INTENTIONS.FUNDING_PROJECT_ID, projectId)
                .set(INTENTIONS.COUNTS_FROM, LocalDate.parse(startsOn))
                .set(INTENTIONS.ENDS_ON, LocalDate.parse(endsOn))
                .set(INTENTIONS.TARGET_PAGES, targetPages)
                .where(INTENTIONS.ID.eq(id))
                .execute();
    }

    public void archive(String projectId, String actorId, OffsetDateTime at) {
        dsl.update(INTENTIONS)
                .set(INTENTIONS.ARCHIVED_ACTOR_KIND, "user")
                .set(INTENTIONS.ARCHIVED_ACTOR_USER_ID, actorId)
                .set(INTENTIONS.ARCHIVED_AT, at)
                .where(INTENTIONS.PROJECT_ID.eq(projectId))
                .execute();
    }

    public void delete(String projectId) {
        dsl.deleteFrom(INTENTIONS).where(INTENTIONS.PROJECT_ID.eq(projectId)).execute();
    }
}
