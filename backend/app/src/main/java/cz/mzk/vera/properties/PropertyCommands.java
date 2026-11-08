package cz.mzk.vera.properties;

import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.INTENTIONS;
import static cz.mzk.vera.db.tables.Tables.PROPERTY_DEFINITIONS;
import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.DELETED_PROPERTY_KEYS;
import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.max;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.documents.PropertyDefinitionCatalog;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.events.EventChanges;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// ACT-property-create; ACT-property-save; ACT-property-delete; DOC-property-fixed; DOC-property-delete.
@Service
class PropertyCommands {
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final PropertyDefinitionCatalog definitions;
    private final EventRecorder events;
    private final JsonMapper json;

    PropertyCommands(DSLContext dsl, HeldAccessQueries access, PropertyDefinitionCatalog definitions,
            EventRecorder events, JsonMapper json) {
        this.dsl = dsl;
        this.access = access;
        this.definitions = definitions;
        this.events = events;
        this.json = json;
    }

    @Transactional
    ActResult create(Caller caller, String key, JsonNode draft) {
        if (!mayDefine(caller)) {
            return noPermission();
        }
        if (dsl.fetchExists(dsl.selectOne().from(PROPERTY_DEFINITIONS)
                .where(PROPERTY_DEFINITIONS.KEY.eq(key)))
                || dsl.fetchExists(dsl.selectOne().from(DELETED_PROPERTY_KEYS)
                        .where(DELETED_PROPERTY_KEYS.KEY.eq(key)))) {
            return ActResult.refused(409, "That key is or was in use; a key is never used twice",
                    "property.key_taken");
        }
        ActResult invalid = draftRefusal(key, draft);
        if (invalid != null) {
            return invalid;
        }
        int position = dsl.select(coalesce(max(PROPERTY_DEFINITIONS.POSITION), -1).add(1))
                .from(PROPERTY_DEFINITIONS).fetchOne(0, int.class);
        insert(key, draft, false, position);
        events.recordAct(EventCode.PROPERTY_DEFINED, "property", key, caller,
                List.of(EventChanges.change("definition", null, draft)));
        return ActResult.ok(definition(key));
    }

    @Transactional
    ActResult save(Caller caller, String key, JsonNode draft) {
        if (!mayDefine(caller)) {
            return noPermission();
        }
        var stored = dsl.selectFrom(PROPERTY_DEFINITIONS)
                .where(PROPERTY_DEFINITIONS.KEY.eq(key)).fetchOne();
        if (stored == null) {
            return ActResult.unknown("property");
        }
        ActResult invalid = draftRefusal(key, draft);
        if (invalid != null) {
            return invalid;
        }
        boolean valuesExist = valueCount(key) > 0;
        JsonNode oldType = json.readTree(stored.getType().data());
        JsonNode nextType = draft.path("type");
        boolean changedType = !oldType.path("kind").asString().equals(nextType.path("kind").asString())
                || stored.getIsList() != draft.path("isList").asBoolean()
                || !stored.getAbout().equals(draft.path("about").asString())
                || !oldType.path("unit").asString("").equals(nextType.path("unit").asString(""));
        if (changedType && (stored.getIsPredefined() || valuesExist)) {
            return ActResult.refused(409,
                    "Records hold values of it; its type and what it is about stay", "property.in_use");
        }
        if (oldType.path("kind").asString().equals("enum")
                && nextType.path("kind").asString().equals("enum")
                && removesUsedValue(key, oldType, nextType)) {
            return ActResult.refused(409, "A value records hold cannot be taken out",
                    "property.value_in_use");
        }
        update(key, draft, stored.getPosition());
        events.recordAct(EventCode.PROPERTY_CHANGED, "property", key, caller,
                List.of(EventChanges.change("definition", oldType, draft)));
        return ActResult.ok(definition(key));
    }

    @Transactional
    ActResult delete(Caller caller, String key) {
        if (!mayDefine(caller)) {
            return noPermission();
        }
        var stored = dsl.selectFrom(PROPERTY_DEFINITIONS)
                .where(PROPERTY_DEFINITIONS.KEY.eq(key)).fetchOne();
        if (stored == null) {
            return ActResult.unknown("property");
        }
        if (stored.getIsPredefined()) {
            return ActResult.refused(409, "A predefined property is edited, never deleted",
                    "property.predefined");
        }
        dsl.insertInto(DELETED_PROPERTY_KEYS).set(DELETED_PROPERTY_KEYS.KEY, key).execute();
        dsl.deleteFrom(DOCUMENT_PROPERTY_SOURCES).where(DOCUMENT_PROPERTY_SOURCES.KEY.eq(key)).execute();
        dsl.deleteFrom(ITERATION_PROPERTY_SOURCES).where(ITERATION_PROPERTY_SOURCES.KEY.eq(key)).execute();
        dsl.deleteFrom(ROLE_GRANTS).where(ROLE_GRANTS.PERMISSION.eq("property." + key + ".edit")).execute();
        dsl.select(INTENTIONS.ID, INTENTIONS.SCOPE_CONDITIONS).from(INTENTIONS)
                .where(INTENTIONS.SCOPE_CONDITIONS.isNotNull()).fetch().forEach(row -> {
                    JsonNode conditions = json.readTree(row.get(INTENTIONS.SCOPE_CONDITIONS).data());
                    List<JsonNode> kept = new ArrayList<>();
                    conditions.forEach(condition -> {
                        if (!condition.path("key").asString().equals(key)) {
                            kept.add(condition);
                        }
                    });
                    if (kept.size() != conditions.size()) {
                        dsl.update(INTENTIONS).set(INTENTIONS.SCOPE_CONDITIONS,
                                JSONB.valueOf(json.writeValueAsString(kept)))
                                .where(INTENTIONS.ID.eq(row.get(INTENTIONS.ID))).execute();
                    }
                });
        dsl.deleteFrom(PROPERTY_DEFINITIONS).where(PROPERTY_DEFINITIONS.KEY.eq(key)).execute();
        events.recordAct(EventCode.PROPERTY_DELETED, "property", key, caller,
                List.of(EventChanges.change("definition", stored.getType(), null)));
        return ActResult.noContent();
    }

    private boolean mayDefine(Caller caller) {
        return Permissions.hasPermission(access.heldBy(caller.userId()).grants(), "property.define");
    }

    private ActResult noPermission() {
        return ActResult.refused(403, "You may not define properties", null);
    }

    private ActResult draftRefusal(String key, JsonNode draft) {
        JsonNode values = draft.path("type").path("values");
        Set<String> distinct = new HashSet<>();
        for (JsonNode value : values) {
            if (!distinct.add(value.path("value").asString())) {
                return ActResult.refused(422, "Each value is listed once", "property.duplicate_value");
            }
        }
        if (!draft.path("handTier").isNull() && definitions.catalogPropertyKeys(dsl).contains(key)
                && !key.equals("page_count")) {
            return ActResult.refused(422,
                    "The catalog holds it; it is repaired there, never entered by hand",
                    "property.catalog_fact");
        }
        return null;
    }

    private boolean removesUsedValue(String key, JsonNode oldType, JsonNode nextType) {
        Set<String> retained = new HashSet<>();
        nextType.path("values").forEach(value -> retained.add(value.path("value").asString()));
        Set<String> used = new HashSet<>();
        dsl.select(DOCUMENT_PROPERTY_SOURCES.VALUE).from(DOCUMENT_PROPERTY_SOURCES)
                .where(DOCUMENT_PROPERTY_SOURCES.KEY.eq(key)).fetch().forEach(row -> {
                    JsonNode value = json.readTree(row.value1().data());
                    if (value.isArray()) {
                        value.forEach(item -> used.add(item.asString()));
                    } else {
                        used.add(value.asString());
                    }
                });
        dsl.select(ITERATION_PROPERTY_SOURCES.VALUE).from(ITERATION_PROPERTY_SOURCES)
                .where(ITERATION_PROPERTY_SOURCES.KEY.eq(key)).fetch().forEach(row -> {
                    JsonNode value = json.readTree(row.value1().data());
                    if (value.isArray()) {
                        value.forEach(item -> used.add(item.asString()));
                    } else {
                        used.add(value.asString());
                    }
                });
        used.removeAll(retained);
        return !used.isEmpty();
    }

    private void insert(String key, JsonNode draft, boolean predefined, int position) {
        dsl.insertInto(PROPERTY_DEFINITIONS)
                .set(PROPERTY_DEFINITIONS.KEY, key)
                .set(PROPERTY_DEFINITIONS.NAMES, JSONB.valueOf(draft.path("names").toString()))
                .set(PROPERTY_DEFINITIONS.VISIBILITY, draft.path("visibility").asString())
                .set(PROPERTY_DEFINITIONS.TYPE, JSONB.valueOf(draft.path("type").toString()))
                .set(PROPERTY_DEFINITIONS.IS_LIST, draft.path("isList").asBoolean())
                .set(PROPERTY_DEFINITIONS.ABOUT, draft.path("about").asString())
                .set(PROPERTY_DEFINITIONS.HAND_TIER, draft.path("handTier").isNull()
                        ? null : draft.path("handTier").asInt())
                .set(PROPERTY_DEFINITIONS.IS_PREDEFINED, predefined)
                .set(PROPERTY_DEFINITIONS.POSITION, position)
                .execute();
    }

    private void update(String key, JsonNode draft, int position) {
        dsl.update(PROPERTY_DEFINITIONS)
                .set(PROPERTY_DEFINITIONS.NAMES, JSONB.valueOf(draft.path("names").toString()))
                .set(PROPERTY_DEFINITIONS.VISIBILITY, draft.path("visibility").asString())
                .set(PROPERTY_DEFINITIONS.TYPE, JSONB.valueOf(draft.path("type").toString()))
                .set(PROPERTY_DEFINITIONS.IS_LIST, draft.path("isList").asBoolean())
                .set(PROPERTY_DEFINITIONS.ABOUT, draft.path("about").asString())
                .set(PROPERTY_DEFINITIONS.HAND_TIER, draft.path("handTier").isNull()
                        ? null : draft.path("handTier").asInt())
                .where(PROPERTY_DEFINITIONS.KEY.eq(key)).execute();
    }

    private Map<String, Object> definition(String key) {
        var row = dsl.selectFrom(PROPERTY_DEFINITIONS).where(PROPERTY_DEFINITIONS.KEY.eq(key)).fetchOne();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("key", key);
        result.put("names", json.readTree(row.getNames().data()));
        result.put("visibility", row.getVisibility());
        result.put("type", json.readTree(row.getType().data()));
        result.put("isList", row.getIsList());
        result.put("about", row.getAbout());
        result.put("handTier", row.getHandTier());
        result.put("isPredefined", row.getIsPredefined());
        result.put("isCatalogFact", definitions.catalogPropertyKeys(dsl).contains(key));
        return result;
    }

    private int valueCount(String key) {
        return dsl.fetchCount(dsl.selectDistinct(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID)
                .from(DOCUMENT_PROPERTY_SOURCES).where(DOCUMENT_PROPERTY_SOURCES.KEY.eq(key)))
                + dsl.fetchCount(dsl.selectDistinct(ITERATION_PROPERTY_SOURCES.ITERATION_ID)
                        .from(ITERATION_PROPERTY_SOURCES).where(ITERATION_PROPERTY_SOURCES.KEY.eq(key)));
    }
}
