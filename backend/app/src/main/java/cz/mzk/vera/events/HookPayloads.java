package cz.mzk.vera.events;

import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR_KEYS;
import static cz.mzk.vera.db.tables.Tables.DIGITIZATION_LISTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PAGE_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.HOOK_EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_LINKS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.RUNS;
import static cz.mzk.vera.db.tables.Tables.USERS;

import com.networknt.schema.InputFormat;
import com.networknt.schema.Schema;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import cz.mzk.vera.db.tables.tables.records.DigitizationListsRecord;
import cz.mzk.vera.db.tables.tables.records.DocumentsRecord;
import cz.mzk.vera.db.tables.tables.records.IterationsRecord;
import cz.mzk.vera.web.Instants;
import cz.mzk.vera.web.PublicUrl;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.Record4;
import org.jooq.Result;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

// HOOK-payload through HOOK-schema; construct the stable envelope from unmatched hook events.
@Component
public class HookPayloads {
    private final DSLContext dsl;
    private final JsonMapper json;
    private final PublicUrl publicUrl;
    private final Schema schema;

    public HookPayloads(DSLContext dsl, JsonMapper json, PublicUrl publicUrl,
            @Value("${VERA_CONTRACT_DIR}") String contractDir) throws IOException {
        this.dsl = dsl;
        this.json = json;
        this.publicUrl = publicUrl;
        Path schemaPath = Path.of(contractDir).resolve("events/hook-payload.schema.json");
        this.schema = SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12)
                .getSchema(Files.readString(schemaPath), InputFormat.JSON);
    }

    public ObjectNode build(String hookId, String hookName, String deliveryId, int attempt,
            List<String> eventIds, boolean includePrivate) {
        ObjectNode payload = json.createObjectNode().put("schema", "vera.hook/1");
        payload.putObject("hook").put("id", hookId).put("name", hookName);
        payload.putObject("delivery").put("id", deliveryId).put("attempt", attempt);
        ArrayNode events = payload.putArray("events");
        dsl.selectFrom(HOOK_EVENTS).where(HOOK_EVENTS.ID.in(eventIds))
                .orderBy(HOOK_EVENTS.OCCURRED_AT, HOOK_EVENTS.ID).fetch()
                .forEach(row -> events.add(event(row, includePrivate)));
        if (events.size() != eventIds.size()) {
            throw new IllegalArgumentException("A hook event for this delivery no longer exists");
        }
        return payload;
    }

    public void validate(ObjectNode payload) {
        List<com.networknt.schema.Error> errors = schema.validate(payload);
        if (!errors.isEmpty()) {
            throw new IllegalArgumentException("Invalid vera.hook/1 payload: " + errors);
        }
    }

    private ObjectNode event(Record row, boolean includePrivate) {
        String kind = row.get(HOOK_EVENTS.SUBJECT_KIND);
        String id = row.get(HOOK_EVENTS.SUBJECT_ID);
        ObjectNode event = json.createObjectNode().put("id", row.get(HOOK_EVENTS.ID))
                .put("type", row.get(HOOK_EVENTS.CODE))
                .put("occurredAt", Instants.format(row.get(HOOK_EVENTS.OCCURRED_AT).toInstant()))
                .put("correlationId", row.get(HOOK_EVENTS.CORRELATION_ID));
        event.putObject("subject").put("kind", kind).put("id", id)
                .put("url", publicUrl.value().replaceAll("/$", "") + path(kind, id));
        event.set("changes", json.readTree(row.get(HOOK_EVENTS.CHANGES).data()));
        ObjectNode cause = (ObjectNode) json.readTree(row.get(HOOK_EVENTS.CAUSE).data());
        ObjectNode actor = (ObjectNode) json.readTree(row.get(HOOK_EVENTS.ACTOR).data());
        String actorId = actor.path("id").asString(null);
        if (actorId != null) {
            Record person = dsl.select(USERS.NAME, USERS.KIND).from(USERS).where(USERS.ID.eq(actorId)).fetchOne();
            if (person != null) {
                actor.put("kind", "agent".equals(person.get(USERS.KIND)) ? "agent" : "person");
                actor.put("name", person.get(USERS.NAME));
            }
        }
        cause.set("actor", actor);
        ObjectNode reason = cause.putObject("reason");
        String publicReason = row.get(HOOK_EVENTS.REASON_PUBLIC);
        reason.put("public", publicReason);
        String internalReason = row.get(HOOK_EVENTS.REASON_INTERNAL);
        if (includePrivate && internalReason != null) {
            reason.put("internal", internalReason);
        }
        event.set("cause", cause);
        if (includePrivate && "iteration.ingest_failed".equals(row.get(HOOK_EVENTS.CODE))) {
            Record history = dsl.select(EVENTS.DATA).from(EVENTS).where(EVENTS.ID.eq(row.get(HOOK_EVENTS.ID)))
                    .fetchOne();
            if (history != null) {
                JsonNode data = json.readTree(history.get(EVENTS.DATA).data());
                if (data.has("error")) {
                    event.set("error", data.get("error"));
                }
            }
        }
        if (includePrivate && "request".equals(row.get(HOOK_EVENTS.SUBJECT_KIND))) {
            Record request = dsl.select(REQUESTS.REQUESTER_ID, USERS.NAME).from(REQUESTS)
                    .join(USERS).on(USERS.ID.eq(REQUESTS.REQUESTER_ID))
                    .where(REQUESTS.ID.eq(row.get(HOOK_EVENTS.SUBJECT_ID))).fetchOne();
            if (request != null) {
                event.putArray("askers").addObject().put("id", request.get(REQUESTS.REQUESTER_ID))
                        .put("name", request.get(USERS.NAME));
            }
        }
        subjectData(event, row, kind, id);
        return event;
    }

    private void subjectData(ObjectNode event, Record row, String kind, String id) {
        if ("run".equals(kind)) {
            Record run = dsl.select(RUNS.ID, RUNS.INSTANCE_ID, RUNS.CORE_NAME, RUNS.TRIGGER,
                            RUNS.STATE, RUNS.FAILURE, RUNS.ITEM_COUNT, RUNS.DONE_COUNT, PLUGIN_INSTANCES.NAME)
                    .from(RUNS).leftJoin(PLUGIN_INSTANCES).on(PLUGIN_INSTANCES.ID.eq(RUNS.INSTANCE_ID))
                    .where(RUNS.ID.eq(id)).fetchOne();
            if (run != null) {
                ObjectNode result = event.putObject("run").put("id", id)
                        .put("state", machine(run.get(RUNS.STATE)))
                        .put("error", run.get(RUNS.FAILURE))
                        .put("items", run.get(RUNS.ITEM_COUNT)).put("done", run.get(RUNS.DONE_COUNT));
                result.set("trigger", json.readTree(run.get(RUNS.TRIGGER).data()));
                result.putObject("instance").put("id", run.get(RUNS.INSTANCE_ID) == null
                        ? run.get(RUNS.CORE_NAME) : run.get(RUNS.INSTANCE_ID))
                        .put("name", run.get(PLUGIN_INSTANCES.NAME) == null
                                ? run.get(RUNS.CORE_NAME) : run.get(PLUGIN_INSTANCES.NAME));
            }
            return;
        }
        if ("list".equals(kind)) {
            DigitizationListsRecord list = dsl.selectFrom(DIGITIZATION_LISTS)
                    .where(DIGITIZATION_LISTS.ID.eq(id)).fetchOne();
            if (list != null) {
                event.putObject("list").put("id", id).put("name", list.getName())
                        .put("starts", list.getStartsOn().toString()).put("ends", list.getEndsOn().toString())
                        .put("pages", list.getTargetPages());
                ArrayNode documents = event.putArray("documents");
                dsl.select(ITERATIONS.DOCUMENT_ID, ITERATIONS.ID).from(ITERATIONS)
                        .where(ITERATIONS.LIST_ID.eq(id)).orderBy(ITERATIONS.ID).fetch()
                        .forEach(member -> documents.add(documentPayload(member.get(ITERATIONS.DOCUMENT_ID),
                                member.get(ITERATIONS.ID))));
            }
            return;
        }
        String iterationId = "iteration".equals(kind) ? id : null;
        String documentId = "document".equals(kind) ? id : "request".equals(kind)
                ? dsl.select(REQUESTS.DOCUMENT_ID).from(REQUESTS).where(REQUESTS.ID.eq(id))
                        .fetchOne(REQUESTS.DOCUMENT_ID)
                : dsl.select(ITERATIONS.DOCUMENT_ID).from(ITERATIONS)
                        .where(ITERATIONS.ID.eq(id)).fetchOne(ITERATIONS.DOCUMENT_ID);
        if (documentId == null) {
            return;
        }
        if (iterationId == null) {
            iterationId = dsl.select(ITERATIONS.ID).from(ITERATIONS)
                    .where(ITERATIONS.DOCUMENT_ID.eq(documentId))
                    .orderBy(ITERATIONS.ATTEMPT.desc()).limit(1).fetchOne(ITERATIONS.ID);
        }
        event.set("document", documentPayload(documentId, iterationId));
    }

    private ObjectNode documentPayload(String documentId, String iterationId) {
        DocumentsRecord document = dsl.selectFrom(DOCUMENTS).where(DOCUMENTS.ID.eq(documentId)).fetchOne();
        ObjectNode data = json.createObjectNode().put("catalogId", document.getCatalogId())
                .put("unit", document.getUnitValue()).put("title", document.getTitle())
                .put("type", machine(document.getType())).put("shelfMark", document.getShelfMark());
        ArrayNode identifiers = data.putArray("identifiers");
        dsl.select(CATALOG_MIRROR_KEYS.KIND, CATALOG_MIRROR_KEYS.VALUE).from(CATALOG_MIRROR_KEYS)
                .where(CATALOG_MIRROR_KEYS.CATALOG_ID.eq(document.getCatalogId()))
                .and(CATALOG_MIRROR_KEYS.KIND.eq("identifier"))
                .orderBy(CATALOG_MIRROR_KEYS.POSITION).fetch().forEach(row ->
                        identifiers.addObject().put("type", machine(row.get(CATALOG_MIRROR_KEYS.KIND))
                                ).put("value", row.get(CATALOG_MIRROR_KEYS.VALUE)));
        Integer pages = dsl.select(DOCUMENT_PAGE_SOURCES.VALUE).from(DOCUMENT_PAGE_SOURCES)
                .where(DOCUMENT_PAGE_SOURCES.DOCUMENT_ID.eq(documentId))
                .orderBy(DOCUMENT_PAGE_SOURCES.TIER.desc(), DOCUMENT_PAGE_SOURCES.POSITION.desc())
                .limit(1).fetchOne(DOCUMENT_PAGE_SOURCES.VALUE);
        data.put("pages", pages);
        ObjectNode properties = data.putObject("properties");
        dsl.select(DOCUMENT_PROPERTY_SOURCES.KEY, DOCUMENT_PROPERTY_SOURCES.VALUE)
                .from(DOCUMENT_PROPERTY_SOURCES).where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq(documentId))
                .orderBy(DOCUMENT_PROPERTY_SOURCES.KEY_POSITION, DOCUMENT_PROPERTY_SOURCES.TIER.desc(),
                        DOCUMENT_PROPERTY_SOURCES.POSITION.desc()).fetch().forEach(property -> {
                    String key = property.get(DOCUMENT_PROPERTY_SOURCES.KEY);
                    if (!properties.has(key)) {
                        properties.set(key, json.readTree(property.get(DOCUMENT_PROPERTY_SOURCES.VALUE).data()));
                    }
                });
        if (iterationId != null) {
            IterationsRecord iteration = dsl.selectFrom(ITERATIONS)
                    .where(ITERATIONS.ID.eq(iterationId)).fetchOne();
            ObjectNode iterationData = data.putObject("iteration").put("id", iterationId)
                    .put("progress", machine(iteration.getProgress()))
                    .put("category", iteration.getCategoryId()).put("priority", machine(iteration.getPriority()))
                    .put("project", iteration.getProjectId()).put("list", iteration.getListId());
            dsl.select(ITERATION_PROPERTY_SOURCES.KEY, ITERATION_PROPERTY_SOURCES.VALUE)
                    .from(ITERATION_PROPERTY_SOURCES)
                    .where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq(iterationId))
                    .orderBy(ITERATION_PROPERTY_SOURCES.KEY_POSITION, ITERATION_PROPERTY_SOURCES.TIER.desc(),
                            ITERATION_PROPERTY_SOURCES.POSITION.desc()).fetch().forEach(property -> {
                        String key = property.get(ITERATION_PROPERTY_SOURCES.KEY);
                        if (!properties.has(key)) {
                            properties.set(key, json.readTree(property.get(ITERATION_PROPERTY_SOURCES.VALUE).data()));
                        }
                    });
            Result<Record4<String, String, Boolean, String>> links = dsl.select(ITERATION_LINKS.URL,
                            ITERATION_LINKS.INSTANCE_ID,
                            ITERATION_LINKS.IS_PRIMARY, PLUGIN_INSTANCES.NAME)
                    .from(ITERATION_LINKS).leftJoin(PLUGIN_INSTANCES)
                    .on(PLUGIN_INSTANCES.ID.eq(ITERATION_LINKS.INSTANCE_ID))
                    .where(ITERATION_LINKS.ITERATION_ID.eq(iterationId))
                    .orderBy(ITERATION_LINKS.POSITION).fetch();
            ArrayNode linkData = iterationData.putArray("links");
            String primary = null;
            for (Record link : links) {
                ObjectNode value = linkData.addObject().put("url", link.get(ITERATION_LINKS.URL))
                        .put("where", link.get(PLUGIN_INSTANCES.NAME) == null
                                ? "web address" : link.get(PLUGIN_INSTANCES.NAME))
                        .put("primary", link.get(ITERATION_LINKS.IS_PRIMARY));
                if (link.get(ITERATION_LINKS.IS_PRIMARY)) {
                    primary = link.get(ITERATION_LINKS.URL);
                }
            }
            if (primary == null) {
                iterationData.putNull("link");
            } else {
                iterationData.put("link", primary);
            }
        }
        return data;
    }

    private String path(String kind, String id) {
        return switch (kind) {
            case "document" -> "/documents/" + id;
            case "iteration" -> "/documents/" + dsl.select(ITERATIONS.DOCUMENT_ID)
                    .from(ITERATIONS).where(ITERATIONS.ID.eq(id)).fetchOne(ITERATIONS.DOCUMENT_ID);
            case "request" -> "/requests/" + id;
            case "list" -> "/lists/" + id;
            case "run" -> "/tasks/" + id;
            default -> "/" + kind + "/" + id;
        };
    }

    private String machine(String value) {
        return value == null ? null : value.replaceAll("([a-z])([A-Z])", "$1_$2")
                .replaceAll("[^A-Za-z0-9]+", "_").toLowerCase(Locale.ROOT);
    }
}
