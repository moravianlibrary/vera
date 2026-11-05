package cz.mzk.vera.access;

import static cz.mzk.vera.db.tables.Tables.GROUP_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.GROUPS;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.max;

import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.events.EventChanges;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.RecordIds;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// ACT-group-save; ACCESS-group.
@Service
class AccessGroupCommands {
    private final DSLContext dsl;
    private final EventRecorder events;
    private final AccessQueries queries;

    AccessGroupCommands(DSLContext dsl, EventRecorder events, AccessQueries queries) {
        this.dsl = dsl;
        this.events = events;
        this.queries = queries;
    }

    @Transactional
    ActResult create(Caller caller, Draft body) {
        if (dsl.fetchExists(dsl.selectOne().from(GROUPS).where(GROUPS.NAME.eq(body.name())))) {
            return ActResult.nameTaken(body.name());
        }
        List<String> ids = dsl.select(GROUPS.ID).from(GROUPS).fetch(GROUPS.ID);
        String id = RecordIds.next("g", ids);
        int position = dsl.select(coalesce(max(GROUPS.POSITION), -1).add(1))
                .from(GROUPS).fetchOne(0, int.class);
        dsl.insertInto(GROUPS)
                .set(GROUPS.ID, id)
                .set(GROUPS.NAME, body.name())
                .set(GROUPS.DESCRIPTION, body.description())
                .set(GROUPS.POSITION, position)
                .execute();
        events.recordAct(EventCode.GROUP_CREATED, "group", id, caller, List.of(
                EventChanges.change("name", null, body.name()),
                EventChanges.change("description", null, body.description())));
        return ActResult.ok(queries.group(id));
    }

    @Transactional
    ActResult save(Caller caller, String id, Draft body) {
        Map<String, Object> old = queries.group(id);
        if (old == null) {
            return ActResult.unknown("group");
        }
        if (dsl.fetchExists(dsl.selectOne().from(GROUPS)
                .where(GROUPS.NAME.eq(body.name()))
                .and(GROUPS.ID.ne(id)))) {
            return ActResult.nameTaken(body.name());
        }
        List<Map<String, Object>> changes = new ArrayList<>();
        if (!old.get("name").equals(body.name())) {
            changes.add(EventChanges.change("name", old.get("name"), body.name()));
        }
        if (!old.get("description").equals(body.description())) {
            changes.add(EventChanges.change("description", old.get("description"), body.description()));
        }
        dsl.update(GROUPS)
                .set(GROUPS.NAME, body.name())
                .set(GROUPS.DESCRIPTION, body.description())
                .where(GROUPS.ID.eq(id))
                .execute();
        if (!changes.isEmpty()) {
            events.recordAct(EventCode.GROUP_CHANGED, "group", id, caller, changes);
        }
        return ActResult.ok(queries.group(id));
    }

    @Transactional
    ActResult members(Caller caller, String id, List<String> requested) {
        Map<String, Object> old = queries.group(id);
        if (old == null) {
            return ActResult.unknown("group");
        }
        List<String> members = List.copyOf(new LinkedHashSet<>(requested));
        boolean hasUnknownUser = members.stream().anyMatch(userId ->
                !dsl.fetchExists(dsl.selectOne().from(USERS).where(USERS.ID.eq(userId))));
        if (hasUnknownUser) {
            return ActResult.unknown("user");
        }
        @SuppressWarnings("unchecked")
        List<String> before = (List<String>) old.get("memberIds");
        dsl.deleteFrom(GROUP_MEMBERS).where(GROUP_MEMBERS.GROUP_ID.eq(id)).execute();
        for (int i = 0; i < members.size(); i++) {
            dsl.insertInto(GROUP_MEMBERS)
                    .set(GROUP_MEMBERS.GROUP_ID, id)
                    .set(GROUP_MEMBERS.USER_ID, members.get(i))
                    .set(GROUP_MEMBERS.POSITION, i)
                    .execute();
        }
        if (!new LinkedHashSet<>(before).equals(new LinkedHashSet<>(members))) {
            events.recordAct(EventCode.GROUP_MEMBERS_CHANGED, "group", id, caller,
                    List.of(EventChanges.change("memberIds", before, members)));
        }
        return ActResult.ok(queries.group(id));
    }

    record Draft(String name, String description) {}
}
