package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PAGE_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_REGISTRY_RECORDS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_DEFECTS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;

import cz.mzk.vera.events.Correlation;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.plugin.propertysource.ValuesAnswer;
import cz.mzk.vera.plugin.registry.LookupAnswer;
import cz.mzk.vera.plugin.restriction.RestrictionCheckAnswer;
import cz.mzk.vera.plugin.validation.ValidationCheckAnswer;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// PLG-run-items; LC-ITER-ingest; STAT-defect-key; DOC-page-count; REG-records.
@Component
public class PluginAnswerWrites {
    private final Clock clock;
    private final JsonMapper json;
    private final EventRecorder events;

    public PluginAnswerWrites(Clock clock, JsonMapper json, EventRecorder events) {
        this.clock = clock;
        this.json = json;
        this.events = events;
    }

    public int registry(DSLContext tx, String documentId, String registry, LookupAnswer answer) {
        String oldState = tx.select(DOCUMENT_REGISTRY_RECORDS.STATE).from(DOCUMENT_REGISTRY_RECORDS)
                .where(DOCUMENT_REGISTRY_RECORDS.DOCUMENT_ID.eq(documentId))
                .and(DOCUMENT_REGISTRY_RECORDS.REGISTRY.eq(registry))
                .orderBy(DOCUMENT_REGISTRY_RECORDS.POSITION).limit(1)
                .fetchOne(DOCUMENT_REGISTRY_RECORDS.STATE);
        tx.deleteFrom(DOCUMENT_REGISTRY_RECORDS).where(DOCUMENT_REGISTRY_RECORDS.DOCUMENT_ID.eq(documentId))
                .and(DOCUMENT_REGISTRY_RECORDS.REGISTRY.eq(registry)).execute();
        int position = tx.selectCount().from(DOCUMENT_REGISTRY_RECORDS)
                .where(DOCUMENT_REGISTRY_RECORDS.DOCUMENT_ID.eq(documentId)).fetchOne(0, int.class);
        String newState = null;
        OffsetDateTime now = now();
        for (LookupAnswer.RegistryRecord record : answer.records()) {
            String state = registryState(record.rawState());
            if (newState == null) {
                newState = state;
            }
            tx.insertInto(DOCUMENT_REGISTRY_RECORDS).set(DOCUMENT_REGISTRY_RECORDS.DOCUMENT_ID, documentId)
                    .set(DOCUMENT_REGISTRY_RECORDS.POSITION, position++)
                    .set(DOCUMENT_REGISTRY_RECORDS.REGISTRY, registry)
                    .set(DOCUMENT_REGISTRY_RECORDS.STATE, state)
                    .set(DOCUMENT_REGISTRY_RECORDS.RAW_STATE, record.rawState())
                    .set(DOCUMENT_REGISTRY_RECORDS.URL, record.link())
                    .set(DOCUMENT_REGISTRY_RECORDS.OBSERVED_AT, now)
                    .set(DOCUMENT_REGISTRY_RECORDS.CHECKED_AT, now).execute();
        }
        if (newState != null && !newState.equals(oldState)) {
            Map<String, Object> state = new LinkedHashMap<>();
            state.put("from", oldState);
            state.put("to", newState);
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("registry", registry);
            data.put("state", state);
            events.record(new EventInput(EventCode.DOCUMENT_REGISTRY_CHANGED, "document", documentId,
                    null, new EventInput.System(), Correlation.newId(), clock.instant(), json.valueToTree(data), null));
        }
        return answer.records().size();
    }

    public int properties(DSLContext tx, String documentId, String iterationId, String instanceId,
            String instanceName, ValuesAnswer answer) {
        tx.select(ITERATION_PROPERTY_SOURCES.KEY, ITERATION_PROPERTY_SOURCES.POSITION,
                ITERATION_PROPERTY_SOURCES.SOURCE)
                .from(ITERATION_PROPERTY_SOURCES).where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq(iterationId))
                .fetch().forEach(row -> {
                    JsonNode source = json.readTree(row.get(ITERATION_PROPERTY_SOURCES.SOURCE).data());
                    if ("plugin".equals(source.path("kind").asString())
                            && instanceId.equals(source.path("instanceId").asString())) {
                        tx.deleteFrom(ITERATION_PROPERTY_SOURCES)
                                .where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq(iterationId))
                                .and(ITERATION_PROPERTY_SOURCES.POSITION.eq(row.get(ITERATION_PROPERTY_SOURCES.POSITION)))
                                .execute();
                    }
                });
        boolean pageCountAnswered = answer.values().stream().anyMatch(value -> "page_count".equals(value.key()));
        if (pageCountAnswered) {
            tx.deleteFrom(DOCUMENT_PAGE_SOURCES).where(DOCUMENT_PAGE_SOURCES.DOCUMENT_ID.eq(documentId))
                    .and(DOCUMENT_PAGE_SOURCES.SOURCE.eq("catalog")).execute();
        }
        int position = tx.selectCount().from(ITERATION_PROPERTY_SOURCES)
                .where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq(iterationId)).fetchOne(0, int.class);
        int pagePosition = tx.selectCount().from(DOCUMENT_PAGE_SOURCES)
                .where(DOCUMENT_PAGE_SOURCES.DOCUMENT_ID.eq(documentId)).fetchOne(0, int.class);
        OffsetDateTime now = now();
        for (ValuesAnswer.PropertyValue property : answer.values()) {
            Map<String, Object> source = new LinkedHashMap<>();
            source.put("kind", "plugin");
            source.put("instanceId", instanceId);
            source.put("instanceName", instanceName);
            tx.insertInto(ITERATION_PROPERTY_SOURCES).set(ITERATION_PROPERTY_SOURCES.ITERATION_ID, iterationId)
                    .set(ITERATION_PROPERTY_SOURCES.KEY, property.key())
                    .set(ITERATION_PROPERTY_SOURCES.POSITION, position++)
                    .set(ITERATION_PROPERTY_SOURCES.SOURCE, JSONB.valueOf(json.writeValueAsString(source)))
                    .set(ITERATION_PROPERTY_SOURCES.TIER, property.tier())
                    .set(ITERATION_PROPERTY_SOURCES.VALUE, JSONB.valueOf(json.writeValueAsString(property.value())))
                    .set(ITERATION_PROPERTY_SOURCES.OBSERVED_AT, now).execute();
            if ("page_count".equals(property.key()) && property.value() instanceof Number pages) {
                tx.insertInto(DOCUMENT_PAGE_SOURCES).set(DOCUMENT_PAGE_SOURCES.DOCUMENT_ID, documentId)
                        .set(DOCUMENT_PAGE_SOURCES.POSITION, pagePosition++).set(DOCUMENT_PAGE_SOURCES.SOURCE, "catalog")
                        .set(DOCUMENT_PAGE_SOURCES.TIER, property.tier()).set(DOCUMENT_PAGE_SOURCES.VALUE, pages.intValue())
                        .set(DOCUMENT_PAGE_SOURCES.OBSERVED_AT, now).execute();
            }
        }
        return answer.values().size();
    }

    public int defects(DSLContext tx, String iterationId, String instanceId,
            List<ValidationCheckAnswer.Defect> defects) {
        Map<String, OffsetDateTime> firstSeen = new LinkedHashMap<>();
        tx.select(ITERATION_DEFECTS.KEY, ITERATION_DEFECTS.FIRST_SEEN_AT).from(ITERATION_DEFECTS)
                .where(ITERATION_DEFECTS.ITERATION_ID.eq(iterationId))
                .fetch().forEach(row -> firstSeen.put(row.get(ITERATION_DEFECTS.KEY),
                        row.get(ITERATION_DEFECTS.FIRST_SEEN_AT)));
        tx.deleteFrom(ITERATION_DEFECTS).where(ITERATION_DEFECTS.ITERATION_ID.eq(iterationId))
                .and(ITERATION_DEFECTS.INSTANCE_ID.eq(instanceId)).execute();
        int position = tx.selectCount().from(ITERATION_DEFECTS)
                .where(ITERATION_DEFECTS.ITERATION_ID.eq(iterationId)).fetchOne(0, int.class);
        for (ValidationCheckAnswer.Defect defect : defects) {
            String key = instanceId + ":" + defect.rule() + ":" + defect.field();
            OffsetDateTime first = firstSeen.getOrDefault(key, now());
            tx.insertInto(ITERATION_DEFECTS).set(ITERATION_DEFECTS.ITERATION_ID, iterationId)
                    .set(ITERATION_DEFECTS.POSITION, position++).set(ITERATION_DEFECTS.KEY, key)
                    .set(ITERATION_DEFECTS.INSTANCE_ID, instanceId).set(ITERATION_DEFECTS.RULE_CODE, defect.rule())
                    .set(ITERATION_DEFECTS.SUBJECT, defect.field()).set(ITERATION_DEFECTS.PUBLIC_TEXT, "")
                    .set(ITERATION_DEFECTS.INTERNAL_TEXT, defect.detail()).set(ITERATION_DEFECTS.FIRST_SEEN_AT, first)
                    .execute();
        }
        return defects.size();
    }

    public int restriction(DSLContext tx, String iterationId, RestrictionCheckAnswer answer) {
        RestrictionCheckAnswer.Finding finding = answer.findings().stream()
                .filter(RestrictionCheckAnswer.Finding::forbidden).findFirst().orElse(null);
        String oldRule = tx.select(ITERATIONS.RESTRICTION_RULE).from(ITERATIONS)
                .where(ITERATIONS.ID.eq(iterationId)).fetchOne(0, String.class);
        OffsetDateTime oldAt = tx.select(ITERATIONS.RESTRICTION_FOUND_AT).from(ITERATIONS)
                .where(ITERATIONS.ID.eq(iterationId)).fetchOne(0, OffsetDateTime.class);
        if (finding == null) {
            tx.update(ITERATIONS).set(ITERATIONS.RESTRICTION_RULE, (String) null)
                    .set(ITERATIONS.RESTRICTION_PUBLIC_TEXT, (String) null)
                    .set(ITERATIONS.RESTRICTION_INTERNAL_TEXT, (String) null)
                    .set(ITERATIONS.RESTRICTION_FOUND_AT, (OffsetDateTime) null)
                    .where(ITERATIONS.ID.eq(iterationId)).execute();
            return 0;
        }
        boolean same = finding.rule().equals(oldRule);
        String publicText = same ? tx.select(ITERATIONS.RESTRICTION_PUBLIC_TEXT).from(ITERATIONS)
                .where(ITERATIONS.ID.eq(iterationId)).fetchOne(0, String.class) : null;
        tx.update(ITERATIONS).set(ITERATIONS.RESTRICTION_RULE, finding.rule())
                .set(ITERATIONS.RESTRICTION_PUBLIC_TEXT, publicText)
                .set(ITERATIONS.RESTRICTION_INTERNAL_TEXT, finding.why())
                .set(ITERATIONS.RESTRICTION_FOUND_AT, same ? oldAt : now())
                .where(ITERATIONS.ID.eq(iterationId)).execute();
        return 1;
    }

    private String registryState(String raw) {
        return switch (raw) {
            case "NotFound", "not_found" -> "NotFound";
            case "Planned", "planned" -> "Planned";
            case "InProgress", "in_progress" -> "InProgress";
            case "Digitized", "digitized" -> "Digitized";
            case "Published", "published" -> "Published";
            default -> "Unmapped";
        };
    }

    private OffsetDateTime now() {
        return clock.instant().atOffset(ZoneOffset.UTC);
    }
}
