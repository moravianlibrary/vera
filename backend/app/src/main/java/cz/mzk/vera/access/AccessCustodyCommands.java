package cz.mzk.vera.access;

import static cz.mzk.vera.db.tables.Tables.GROUPS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODIES;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODY_GROUPS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_CUSTODY_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_PLACEMENTS;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.max;

import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.domain.Names;
import cz.mzk.vera.events.EventChanges;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.RecordIds;
import cz.mzk.vera.web.RequestLanguage;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Service;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

// ACCESS-custody-delete; L8: deletion starts a placing run after removing the custody.
@Service
class AccessCustodyCommands {
    private final DSLContext dsl;
    private final EventRecorder events;
    private final AccessQueries queries;
    private final ApplicationEventPublisher eventPublisher;
    private final JsonMapper json;

    AccessCustodyCommands(DSLContext dsl, EventRecorder events, AccessQueries queries,
            ApplicationEventPublisher eventPublisher, JsonMapper json) {
        this.dsl = dsl;
        this.events = events;
        this.queries = queries;
        this.eventPublisher = eventPublisher;
        this.json = json;
    }

    @Transactional
    ActResult create(Caller caller, Draft body) {
        if (taken(body.names(), null)) {
            return ActResult.nameTaken(legacyName(body.names()));
        }
        List<String> ids = dsl.select(REQUEST_CUSTODIES.ID).from(REQUEST_CUSTODIES)
                .fetch(REQUEST_CUSTODIES.ID);
        String id = RecordIds.next("pc", ids);
        int position = dsl.select(coalesce(max(REQUEST_CUSTODIES.POSITION), -1).add(1))
                .from(REQUEST_CUSTODIES).fetchOne(0, int.class);
        dsl.insertInto(REQUEST_CUSTODIES).set(REQUEST_CUSTODIES.ID, id)
                .set(REQUEST_CUSTODIES.NAME, legacyName(body.names()))
                .set(REQUEST_CUSTODIES.NAMES, JSONB.valueOf(json.valueToTree(body.names()).toString()))
                .set(REQUEST_CUSTODIES.DESCRIPTION, body.description())
                .set(REQUEST_CUSTODIES.IS_FALLBACK, false)
                .set(REQUEST_CUSTODIES.POSITION, position).execute();
        events.recordAct(EventCode.CUSTODY_CREATED, "custody", id, caller, List.of(
                EventChanges.change("name", null, legacyName(body.names())),
                EventChanges.change("description", null, body.description())));
        return ActResult.ok(queries.custody(id));
    }

    @Transactional
    ActResult save(Caller caller, String id, Draft body) {
        Map<String, Object> before = queries.custody(id);
        if (before == null) {
            return ActResult.unknown("custody");
        }
        String name = legacyName(body.names());
        if (Boolean.TRUE.equals(before.get("isFallback"))
                && !json.valueToTree(body.names()).equals(before.get("names"))) {
            return ActResult.refused(422, "The fallback keeps its name", "access.fallback");
        }
        if (taken(body.names(), id)) {
            return ActResult.nameTaken(name);
        }
        List<Map<String, Object>> changes = new ArrayList<>();
        if (!json.valueToTree(body.names()).equals(before.get("names"))) {
            changes.add(EventChanges.change("name", before.get("name"),
                    Names.nameIn(body.names(), RequestLanguage.current())));
        }
        if (!before.get("description").equals(body.description())) {
            changes.add(EventChanges.change("description", before.get("description"), body.description()));
        }
        dsl.update(REQUEST_CUSTODIES).set(REQUEST_CUSTODIES.NAME, name)
                .set(REQUEST_CUSTODIES.NAMES, JSONB.valueOf(json.valueToTree(body.names()).toString()))
                .set(REQUEST_CUSTODIES.DESCRIPTION, body.description())
                .where(REQUEST_CUSTODIES.ID.eq(id)).execute();
        if (!changes.isEmpty()) {
            events.recordAct(EventCode.CUSTODY_CHANGED, "custody", id, caller, changes);
        }
        return ActResult.ok(queries.custody(id));
    }

    @Transactional
    ActResult members(Caller caller, String id, List<String> userIds, List<String> groupIds) {
        Map<String, Object> before = queries.custody(id);
        if (before == null) {
            return ActResult.unknown("custody");
        }
        List<String> people = List.copyOf(new LinkedHashSet<>(userIds));
        List<String> groups = List.copyOf(new LinkedHashSet<>(groupIds));
        if (people.stream().anyMatch(userId -> !dsl.fetchExists(dsl.selectOne().from(USERS)
                .where(USERS.ID.eq(userId)).and(USERS.KIND.eq("person"))))) {
            return ActResult.unknown("person");
        }
        if (groups.stream().anyMatch(groupId -> !dsl.fetchExists(dsl.selectOne().from(GROUPS)
                .where(GROUPS.ID.eq(groupId))))) {
            return ActResult.unknown("group");
        }
        @SuppressWarnings("unchecked")
        List<String> oldPeople = (List<String>) before.get("memberIds");
        @SuppressWarnings("unchecked")
        List<String> oldGroups = (List<String>) before.get("groupIds");
        dsl.deleteFrom(REQUEST_CUSTODY_MEMBERS).where(REQUEST_CUSTODY_MEMBERS.CUSTODY_ID.eq(id)).execute();
        dsl.deleteFrom(REQUEST_CUSTODY_GROUPS).where(REQUEST_CUSTODY_GROUPS.CUSTODY_ID.eq(id)).execute();
        for (int i = 0; i < people.size(); i++) {
            dsl.insertInto(REQUEST_CUSTODY_MEMBERS).set(REQUEST_CUSTODY_MEMBERS.CUSTODY_ID, id)
                    .set(REQUEST_CUSTODY_MEMBERS.USER_ID, people.get(i))
                    .set(REQUEST_CUSTODY_MEMBERS.POSITION, i).execute();
        }
        for (int i = 0; i < groups.size(); i++) {
            dsl.insertInto(REQUEST_CUSTODY_GROUPS).set(REQUEST_CUSTODY_GROUPS.CUSTODY_ID, id)
                    .set(REQUEST_CUSTODY_GROUPS.GROUP_ID, groups.get(i))
                    .set(REQUEST_CUSTODY_GROUPS.POSITION, i).execute();
        }
        if (!oldPeople.equals(people) || !oldGroups.equals(groups)) {
            events.recordAct(EventCode.CUSTODY_MEMBERS_CHANGED, "custody", id, caller, List.of(
                    EventChanges.change("memberIds", oldPeople, people),
                    EventChanges.change("groupIds", oldGroups, groups)));
        }
        return ActResult.ok(queries.custody(id));
    }

    @Transactional
    ActResult delete(Caller caller, String id) {
        Map<String, Object> before = queries.custody(id);
        if (before == null) {
            return ActResult.unknown("custody");
        }
        if (Boolean.TRUE.equals(before.get("isFallback"))) {
            return ActResult.refused(422, "The fallback cannot be deleted", "access.fallback");
        }
        dsl.deleteFrom(REQUEST_PLACEMENTS).where(REQUEST_PLACEMENTS.CUSTODY_ID.eq(id)).execute();
        dsl.deleteFrom(REQUEST_CUSTODY_MEMBERS).where(REQUEST_CUSTODY_MEMBERS.CUSTODY_ID.eq(id)).execute();
        dsl.deleteFrom(REQUEST_CUSTODY_GROUPS).where(REQUEST_CUSTODY_GROUPS.CUSTODY_ID.eq(id)).execute();
        dsl.deleteFrom(REQUEST_CUSTODIES).where(REQUEST_CUSTODIES.ID.eq(id)).execute();
        events.recordAct(EventCode.CUSTODY_DELETED, "custody", id, caller, List.of());
        eventPublisher.publishEvent(new CustodyDeleted(id, caller.userId()));
        return ActResult.noContent();
    }

    private boolean taken(Map<String, String> names, String exceptId) {
        return dsl.selectFrom(REQUEST_CUSTODIES)
                .where(exceptId == null ? org.jooq.impl.DSL.trueCondition() : REQUEST_CUSTODIES.ID.ne(exceptId))
                .fetch().stream().anyMatch(row -> {
                    var existing = json.readTree(row.getNames().data());
                    return names.entrySet().stream().anyMatch(entry -> existing.has(entry.getKey())
                            && entry.getValue().equals(existing.path(entry.getKey()).asString()));
                });
    }

    private String legacyName(Map<String, String> names) {
        return names.getOrDefault("en", names.get("cs"));
    }

    record Draft(Map<String, String> names, String description) {}
}
