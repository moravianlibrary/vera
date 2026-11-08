package cz.mzk.vera.properties;

import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.INTENTIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.PROPERTY_DEFINITIONS;
import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.DELETED_PROPERTY_KEYS;
import static org.jooq.impl.DSL.countDistinct;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.documents.PropertyDefinitionCatalog;
import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// DOC-property-visibility; DOC-property-delete: SQL read models for property definitions and impact.
@Repository
class PropertyQueries {
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final PropertyDefinitionCatalog catalog;
    private final JsonMapper json;

    PropertyQueries(DSLContext dsl, HeldAccessQueries access, PropertyDefinitionCatalog catalog,
            JsonMapper json) {
        this.dsl = dsl;
        this.access = access;
        this.catalog = catalog;
        this.json = json;
    }

    Map<String, Object> index(Caller caller) {
        var held = access.heldBy(caller.userId());
        boolean readsStaff = Permissions.hasPermission(held.grants(), "iteration.read")
                || Permissions.hasPermission(held.grants(), "property.define")
                || Permissions.hasPermission(held.grants(), "access.manage");
        List<Map<String, Object>> definitions = dsl.selectFrom(PROPERTY_DEFINITIONS)
                .orderBy(PROPERTY_DEFINITIONS.POSITION)
                .fetch(row -> {
                    if (!readsStaff && !row.getVisibility().equals("public")) {
                        return null;
                    }
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("key", row.getKey());
                    item.put("names", json.readTree(row.getNames().data()));
                    item.put("visibility", row.getVisibility());
                    item.put("type", json.readTree(row.getType().data()));
                    item.put("isList", row.getIsList());
                    item.put("about", row.getAbout());
                    item.put("handTier", row.getHandTier());
                    item.put("isPredefined", row.getIsPredefined());
                    item.put("isCatalogFact", catalog.catalogPropertyKeys(dsl).contains(row.getKey()));
                    return item;
                }).stream().filter(item -> item != null).toList();
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (var definition : dsl.select(PROPERTY_DEFINITIONS.KEY).from(PROPERTY_DEFINITIONS)
                .orderBy(PROPERTY_DEFINITIONS.POSITION).fetch()) {
            String key = definition.value1();
            counts.put(key, valueCount(key));
        }
        List<String> deleted = Permissions.hasPermission(held.grants(), "property.define")
                ? dsl.select(DELETED_PROPERTY_KEYS.KEY).from(DELETED_PROPERTY_KEYS)
                        .orderBy(DELETED_PROPERTY_KEYS.KEY).fetch(DELETED_PROPERTY_KEYS.KEY)
                : List.of();
        return Map.of("definitions", definitions, "deletedKeys", deleted, "valueCounts", counts);
    }

    ActResult impact(Caller caller, String key) {
        if (!Permissions.hasPermission(access.heldBy(caller.userId()).grants(), "property.define")) {
            return ActResult.refused(403, "You may not define properties", null);
        }
        if (!dsl.fetchExists(dsl.selectOne().from(PROPERTY_DEFINITIONS)
                .where(PROPERTY_DEFINITIONS.KEY.eq(key)))) {
            return ActResult.unknown("property");
        }
        List<String> roleNames = dsl.selectDistinct(ROLES.NAME).from(ROLES)
                .join(ROLE_GRANTS).on(ROLE_GRANTS.ROLE_ID.eq(ROLES.ID))
                .where(ROLE_GRANTS.PERMISSION.eq("property." + key + ".edit"))
                .orderBy(ROLES.NAME).fetch(ROLES.NAME);
        List<String> intentionNames = new ArrayList<>();
        dsl.select(INTENTIONS.NAME, INTENTIONS.SCOPE_CONDITIONS).from(INTENTIONS)
                .orderBy(INTENTIONS.POSITION).fetch().forEach(row -> {
                    JsonNode conditions = row.get(INTENTIONS.SCOPE_CONDITIONS) == null ? null
                            : json.readTree(row.get(INTENTIONS.SCOPE_CONDITIONS).data());
                    if (conditions != null && conditions.isArray()) {
                        for (JsonNode condition : conditions) {
                            if (condition.path("key").asString().equals(key)) {
                                intentionNames.add(row.get(INTENTIONS.NAME));
                                break;
                            }
                        }
                    }
                });
        // Watchlists are empty until step 7 adds their storage.
        return ActResult.ok(Map.of("valueCount", valueCount(key), "roleNames", roleNames,
                "watchlists", List.of(), "intentionNames", intentionNames));
    }

    private int valueCount(String key) {
        int documents = dsl.select(countDistinct(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID))
                .from(DOCUMENT_PROPERTY_SOURCES).where(DOCUMENT_PROPERTY_SOURCES.KEY.eq(key))
                .fetchOne(0, int.class);
        int iterations = dsl.select(countDistinct(ITERATION_PROPERTY_SOURCES.ITERATION_ID))
                .from(ITERATION_PROPERTY_SOURCES).where(ITERATION_PROPERTY_SOURCES.KEY.eq(key))
                .fetchOne(0, int.class);
        return documents + iterations;
    }
}
