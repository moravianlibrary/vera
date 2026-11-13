package cz.mzk.vera.mixes;

import static cz.mzk.vera.db.tables.Tables.DIGITIZATION_LISTS;
import static cz.mzk.vera.db.tables.Tables.INTENTIONS;
import static cz.mzk.vera.db.tables.Tables.INTENTION_TEMPLATES;
import static cz.mzk.vera.db.tables.Tables.MIXES;
import static cz.mzk.vera.db.tables.Tables.MIX_REVISIONS;

import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.domain.Names;
import cz.mzk.vera.web.RequestLanguage;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.JsonNode;

// PLAN-mix; PLAN-mix-remove. SQL reads in catalogue order.
@Repository
public class MixQueries {
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final JsonMapper json;

    MixQueries(DSLContext dsl, HeldAccessQueries access, JsonMapper json) {
        this.dsl = dsl;
        this.access = access;
        this.json = json;
    }

    public List<Map<String, Object>> list(Caller caller) {
        return list(caller.userId());
    }

    public List<Map<String, Object>> list(String userId) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (!mayRead(userId)) {
            return result;
        }
        dsl.selectFrom(MIXES).orderBy(MIXES.POSITION).fetch()
                .forEach(row -> result.add(record(row.getId(), userId)));
        return result;
    }

    Map<String, Object> get(Caller caller, String id) {
        return mayRead(caller) && dsl.fetchExists(dsl.selectOne().from(MIXES).where(MIXES.ID.eq(id)))
                ? record(id, caller.userId()) : null;
    }

    boolean mayRead(Caller caller) {
        return mayRead(caller.userId());
    }

    private boolean mayRead(String userId) {
        return Permissions.hasPermission(access.heldBy(userId).grants(), "mix.read");
    }

    Map<String, Object> record(String id, Caller caller) {
        return record(id, caller.userId());
    }

    Map<String, Object> record(String id, String userId) {
        var mix = dsl.selectFrom(MIXES).where(MIXES.ID.eq(id)).fetchOne();
        List<Map<String, Object>> revisions = dsl.selectFrom(MIX_REVISIONS)
                .where(MIX_REVISIONS.MIX_ID.eq(id)).orderBy(MIX_REVISIONS.POSITION).fetch(row -> {
                    Map<String, Object> revision = new LinkedHashMap<>();
                    revision.put("revision", row.getRevision());
                    revision.put("shares", json.readTree(row.getShares().data()));
                    revision.put("at", row.getAt().toInstant().toString());
                    revision.put("label", row.getLabel());
                    return revision;
                });
        List<Map<String, Object>> followers = dsl.select(INTENTIONS.ID, INTENTIONS.NAME,
                INTENTIONS.ARCHIVED_AT).from(INTENTIONS).where(INTENTIONS.DISTRIBUTION_ID.eq(id))
                .orderBy(INTENTIONS.POSITION).fetch(row -> {
                    Map<String, Object> follower = new LinkedHashMap<>();
                    follower.put("id", row.get(INTENTIONS.ID));
                    follower.put("name", row.get(INTENTIONS.NAME));
                    follower.put("isArchived", row.get(INTENTIONS.ARCHIVED_AT) != null);
                    return follower;
                });
        boolean used = !followers.isEmpty()
                || dsl.fetchExists(dsl.selectOne().from(INTENTION_TEMPLATES)
                        .where(INTENTION_TEMPLATES.DISTRIBUTION_ID.eq(id)))
                || dsl.selectFrom(DIGITIZATION_LISTS).where(DIGITIZATION_LISTS.GENERATED.isNotNull())
                        .fetch().stream().map(row -> json.readTree(row.getGenerated().data()))
                        .anyMatch(generated -> generated.path("mixId").asString().equals(id));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", mix.getId());
        JsonNode names = json.readTree(mix.getNames().data());
        Map<String, String> nameValues = new LinkedHashMap<>();
        names.properties().forEach(property -> nameValues.put(property.getKey(), property.getValue().asString()));
        result.put("name", Names.nameIn(nameValues, RequestLanguage.current()));
        result.put("names", names);
        result.put("isPrimary", mix.getIsPrimary());
        result.put("archivedAt", mix.getArchivedAt() == null ? null : mix.getArchivedAt().toInstant().toString());
        result.put("shares", json.readTree(mix.getShares().data()));
        result.put("revision", mix.getRevision());
        result.put("revisions", revisions);
        result.put("everUsed", used);
        result.put("usageCount", followers.size());
        result.put("followers", followers);
        return result;
    }
}
