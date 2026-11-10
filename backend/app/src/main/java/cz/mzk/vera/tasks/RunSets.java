package cz.mzk.vera.tasks;

import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;

import cz.mzk.vera.db.tables.tables.Iterations;
import java.util.Map;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.Record2;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// PLG-run-items: a run fixes the documents still in play when it starts.
@Repository
public class RunSets {
    private final JsonMapper json;

    public RunSets(JsonMapper json) {
        this.json = json;
    }

    public List<Target> documentsStillInPlay(DSLContext dsl) {
        Iterations newer = ITERATIONS.as("newer_iteration");
        List<Target> rows = dsl.select(DOCUMENTS.ID, ITERATIONS.ID)
                .from(DOCUMENTS)
                .leftJoin(ITERATIONS).on(ITERATIONS.DOCUMENT_ID.eq(DOCUMENTS.ID)
                        .and(ITERATIONS.PROGRESS.notIn("Published", "Cancelled"))
                        .and(DSL.notExists(dsl.selectOne().from(newer)
                                .where(newer.DOCUMENT_ID.eq(DOCUMENTS.ID))
                                .and(newer.PROGRESS.notIn("Published", "Cancelled"))
                                .and(newer.ATTEMPT.gt(ITERATIONS.ATTEMPT)))))
                .where(ITERATIONS.ID.isNotNull().or(DSL.exists(dsl.selectOne().from(REQUESTS)
                        .where(REQUESTS.DOCUMENT_ID.eq(DOCUMENTS.ID))
                        .and(REQUESTS.DECISION.eq("Pending")))))
                .orderBy(DOCUMENTS.ID)
                .fetch(row -> new Target(row.get(DOCUMENTS.ID), row.get(ITERATIONS.ID)));
        return rows;
    }

    public List<Target> forInstance(DSLContext dsl, String instanceId) {
        Record2<String, JSONB> plugin = dsl.select(PLUGIN_IMPLEMENTATIONS.KIND, PLUGIN_IMPLEMENTATIONS.VERSIONS)
                .from(PLUGIN_INSTANCES).join(PLUGIN_IMPLEMENTATIONS)
                .on(PLUGIN_IMPLEMENTATIONS.ID.eq(PLUGIN_INSTANCES.IMPLEMENTATION_ID))
                .where(PLUGIN_INSTANCES.ID.eq(instanceId)).fetchOne();
        if (plugin == null) {
            return List.of();
        }
        String kind = plugin.get(PLUGIN_IMPLEMENTATIONS.KIND);
        if ("CatalogAdapter".equals(kind) || "Harvester".equals(kind)) {
            return List.of();
        }
        List<Target> inPlay = documentsStillInPlay(dsl);
        if (!"PropertySource".equals(kind)) {
            return inPlay;
        }
        JsonNode versions = json.readTree(plugin.get(PLUGIN_IMPLEMENTATIONS.VERSIONS).data());
        Set<String> properties = new HashSet<>();
        if (!versions.isEmpty()) {
            for (JsonNode property : versions.get(0).path("declares").path("properties")) {
                properties.add(property.path("key").asString());
            }
        }
        if (properties.isEmpty()) {
            return List.of();
        }
        List<String> documents = inPlay.stream().map(Target::documentId).toList();
        Map<String, Integer> present = dsl.select(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID,
                        DSL.countDistinct(DOCUMENT_PROPERTY_SOURCES.KEY).as("property_count"))
                .from(DOCUMENT_PROPERTY_SOURCES).where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.in(documents))
                .and(DOCUMENT_PROPERTY_SOURCES.KEY.in(properties)).groupBy(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID)
                .fetchMap(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID,
                        DSL.field("property_count", Integer.class));
        List<Target> missing = new ArrayList<>();
        for (Target target : inPlay) {
            if (present.getOrDefault(target.documentId(), 0) < properties.size()) {
                missing.add(target);
            }
        }
        return missing;
    }

    public record Target(String documentId, String iterationId) { }
}
