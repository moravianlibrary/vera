package cz.mzk.vera.login;

import static cz.mzk.vera.db.tables.Tables.CATEGORY_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.GROUP_CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.GROUP_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.USERS;

import cz.mzk.vera.domain.access.Grant;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

// B9. The session read model keeps its established answer.
@Repository
public class SessionQueries {
    private final DSLContext dsl;
    private final HeldAccessQueries heldAccess;

    public SessionQueries(DSLContext dsl, HeldAccessQueries heldAccess) {
        this.dsl = dsl;
        this.heldAccess = heldAccess;
    }

    SessionView session(Caller caller) {
        var user = dsl.selectFrom(USERS).where(USERS.ID.eq(caller.userId())).fetchOne();
        if (user == null) {
            return null;
        }
        HeldAccessQueries.HeldAccess held = heldAccess.heldBy(caller.userId());
        List<String> groupIds = dsl.select(GROUP_MEMBERS.GROUP_ID).from(GROUP_MEMBERS)
            .where(GROUP_MEMBERS.USER_ID.eq(caller.userId()))
            .orderBy(GROUP_MEMBERS.POSITION)
            .fetch(GROUP_MEMBERS.GROUP_ID);
        Set<String> custody = new LinkedHashSet<>();
        dsl.select(GROUP_CATEGORIES.CATEGORY_ID).from(GROUP_MEMBERS)
            .join(GROUP_CATEGORIES).on(GROUP_CATEGORIES.GROUP_ID.eq(GROUP_MEMBERS.GROUP_ID))
            .where(GROUP_MEMBERS.USER_ID.eq(caller.userId()))
            .orderBy(GROUP_MEMBERS.POSITION, GROUP_CATEGORIES.POSITION)
            .fetch(GROUP_CATEGORIES.CATEGORY_ID)
            .forEach(custody::add);
        dsl.select(CATEGORY_MEMBERS.CATEGORY_ID).from(CATEGORY_MEMBERS)
            .where(CATEGORY_MEMBERS.USER_ID.eq(caller.userId()))
            .orderBy(CATEGORY_MEMBERS.POSITION)
            .fetch(CATEGORY_MEMBERS.CATEGORY_ID)
            .forEach(custody::add);
        return new SessionView(
            new UserView(user.getId(), user.getName(), user.getKind(), user.getEmail()),
            held.roleIds(), held.grants(), List.copyOf(custody), groupIds);
    }

    record UserView(String id, String name, String kind, String email) {}

    record SessionView(UserView user, List<String> roleIds, List<Grant> grants,
        List<String> custodyCategoryIds, List<String> groupIds) {}
}
