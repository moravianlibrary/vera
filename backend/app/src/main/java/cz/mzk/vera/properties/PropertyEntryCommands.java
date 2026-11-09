package cz.mzk.vera.properties;

import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_DEFECTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.PROPERTY_DEFINITIONS;
import static cz.mzk.vera.domain.iterations.Iterations.progressAfterGates;
import static cz.mzk.vera.domain.validations.Validations.isFoundAfterScan;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.documents.Audience;
import cz.mzk.vera.documents.DocumentQueries;
import cz.mzk.vera.documents.DocumentStates;
import cz.mzk.vera.documents.PropertyDefinitions;
import cz.mzk.vera.domain.entities.Defect;
import cz.mzk.vera.domain.entities.Document;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.domain.properties.Properties;
import cz.mzk.vera.db.tables.tables.records.PropertyDefinitionsRecord;
import cz.mzk.vera.events.Correlation;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.iterations.IterationChecks;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import java.text.NumberFormat;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// DOC-property-hand: refuse first, then record the source and its event.
@Service
class PropertyEntryCommands {
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final DocumentQueries documents;
    private final DocumentStates states;
    private final PropertyDefinitions definitions;
    private final IterationChecks checks;
    private final EventRecorder events;
    private final Clock clock;
    private final JsonMapper json;
    private final ObjectProvider<PropertyEntryCommands> proxy;

    PropertyEntryCommands(DSLContext dsl, HeldAccessQueries access, DocumentQueries documents,
            DocumentStates states, PropertyDefinitions definitions, IterationChecks checks,
            EventRecorder events, Clock clock, JsonMapper json, ObjectProvider<PropertyEntryCommands> proxy) {
        this.dsl = dsl;
        this.access = access;
        this.documents = documents;
        this.states = states;
        this.definitions = definitions;
        this.checks = checks;
        this.events = events;
        this.clock = clock;
        this.json = json;
        this.proxy = proxy;
    }

    ActResult enter(Caller caller, String documentId, String key, JsonNode value) {
        Preflight preflight = preflight(caller, documentId, key, value);
        if (preflight.refusal() != null) {
            return preflight.refusal();
        }
        IterationChecks.CheckResult checked = null;
        if (preflight.iteration() != null && checks.readsProperty(key)) {
            checked = checks.runWithPropertyValue(preflight.iteration(), preflight.document(),
                    IterationChecks.Run.RECHECK, key, value);
        }
        return proxy.getObject().write(caller, documentId, key, value, checked);
    }

    ActResult enterMany(Caller caller, List<String> documentIds, String key, JsonNode value) {
        List<Map.Entry<String, ActResult>> outcomes = new ArrayList<>();
        for (String documentId : documentIds) {
            outcomes.add(Map.entry(documentId, enter(caller, documentId, key, value)));
        }
        ActResult first = outcomes.getFirst().getValue();
        boolean allSameGlobalRefusal = first.status() == 403 || first.status() == 404 || first.status() == 422;
        for (Map.Entry<String, ActResult> outcome : outcomes) {
            allSameGlobalRefusal &= outcome.getValue().status() == first.status()
                    && outcome.getValue().body() == null;
        }
        if (allSameGlobalRefusal) {
            return first;
        }
        int entered = (int) outcomes.stream().filter(outcome -> outcome.getValue().status() == 200).count();
        List<Map<String, String>> refusals = outcomes.stream()
                .filter(outcome -> outcome.getValue().status() != 200)
                .map(outcome -> {
                    Map<String, String> refusal = new LinkedHashMap<>();
                    refusal.put("documentId", outcome.getKey());
                    refusal.put("message", outcome.getValue().detail());
                    return refusal;
                })
                .toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("enteredCount", entered);
        result.put("refusals", refusals);
        return ActResult.ok(result);
    }

    private Preflight preflight(Caller caller, String documentId, String key, JsonNode value) {
        var property = dsl.selectFrom(PROPERTY_DEFINITIONS).where(PROPERTY_DEFINITIONS.KEY.eq(key)).fetchOne();
        var documentRow = dsl.selectFrom(DOCUMENTS).where(DOCUMENTS.ID.eq(documentId)).fetchOne();
        if (property == null || documentRow == null || documents.audienceOf(caller.userId()) != Audience.STAFF) {
            return Preflight.refused(ActResult.refused(404, "No such property or document", null));
        }
        if (!Permissions.hasPermission(access.heldBy(caller.userId()).grants(), "property." + key + ".edit")) {
            return Preflight.refused(ActResult.refused(403, "You may not enter this property", null));
        }
        JsonNode type = json.readTree(property.getType().data());
        String kind = type.path("kind").asString();
        boolean catalogFact = definitions.catalogPropertyKeys(dsl).contains(key);
        if (property.getHandTier() == null || key.equals("page_count") || (catalogFact && !key.equals("page_count"))) {
            return Preflight.refused(ActResult.refused(422,
                    "This property is not entered by hand here", "property.not_by_hand"));
        }
        Properties.PropertyKind propertyKind = switch (kind) {
            case "text" -> Properties.PropertyKind.Text;
            case "number" -> Properties.PropertyKind.Number;
            case "yesNo" -> Properties.PropertyKind.YesNo;
            case "date" -> Properties.PropertyKind.Date;
            case "enum" -> Properties.PropertyKind.Enum;
            default -> null;
        };
        List<String> enumValues = new ArrayList<>();
        type.path("values").forEach(item -> enumValues.add(item.path("value").asString()));
        Properties.Definition definition = new Properties.Definition(key, propertyKind,
                type.path("unit").asString(""), property.getIsList(), enumValues, Map.of(), catalogFact);
        Object valueObject = value == null || value.isNull() ? null : json.convertValue(value, Object.class);
        if (valueObject != null && !Properties.isValueOf(definition, valueObject)) {
            return Preflight.refused(ActResult.refused(422,
                    "That is not a value this property takes", "property.value_not_allowed"));
        }
        var record = states.recordOf(dsl, documentId);
        Iteration iteration = record.iterations().isEmpty() ? null : record.iterations().getLast();
        if ("attempt".equals(property.getAbout()) && iteration == null) {
            return Preflight.refused(ActResult.refused(409,
                    "There is no attempt to set it on yet", "property.no_attempt"));
        }
        if ("attempt".equals(property.getAbout()) && isFoundAfterScan(iteration)) {
            return Preflight.refused(ActResult.refused(409,
                    "This attempt is scanned; what it was scanned with stays", "iteration.scanned"));
        }
        return new Preflight(null, record.document(), iteration, property, valueObject);
    }

    @Transactional
    public ActResult write(Caller caller, String documentId, String key, JsonNode value,
            IterationChecks.CheckResult checked) {
        Preflight preflight = preflight(caller, documentId, key, value);
        if (preflight.refusal() != null) {
            return preflight.refusal();
        }
        var property = preflight.property();
        Iteration iteration = preflight.iteration();
        boolean documentProperty = "document".equals(property.getAbout());
        String subjectKind = checked != null ? "iteration" : documentProperty ? "document" : "iteration";
        String subjectId = checked != null && iteration != null ? iteration.id()
                : documentProperty ? documentId : iteration.id();
        String sourceTableKey = key;
        JsonNode before = currentValue(documentProperty, documentId, iteration, sourceTableKey);
        writeSource(caller, documentId, iteration, property, value);
        JsonNode after = currentValue(documentProperty, documentId, iteration, sourceTableKey);
        String code = checked == null
                ? documentProperty ? "document.property_changed" : "iteration.property_changed"
                : "iteration.property_changed";
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("key", key);
        Map<String, Object> change = new LinkedHashMap<>();
        change.put("from", before == null ? null : json.convertValue(before, Object.class));
        change.put("to", after == null ? null : json.convertValue(after, Object.class));
        data.put("value", change);
        String reason = "Changed by hand.";
        if (checked != null && iteration != null) {
            String progress = applyChecks(iteration, checked);
            String name = json.readTree(property.getNames().data()).path("en").asString();
            String detail = name + ": "
                    + displayValue(property, before) + " → " + displayValue(property, after) + ", by hand.";
            reason = detail + " The checks ran again."
                    + progressNote(iteration.progress().name(), progress);
        }
        events.record(new EventInput(EventCode.of(code), subjectKind, subjectId, null,
                new EventInput.User(caller.userId()), Correlation.newId(), clock.instant(),
                json.valueToTree(data), new EventInput.Reason(null, reason)));
        states.recompute(dsl, documentId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("isRechecked", checked != null);
        return ActResult.ok(result);
    }

    private void writeSource(Caller caller, String documentId, Iteration iteration,
            PropertyDefinitionsRecord property, JsonNode value) {
        boolean documentProperty = "document".equals(property.getAbout());
        if (documentProperty) {
            Integer keyPosition = dsl.select(DOCUMENT_PROPERTY_SOURCES.KEY_POSITION)
                    .from(DOCUMENT_PROPERTY_SOURCES).where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq(documentId)
                            .and(DOCUMENT_PROPERTY_SOURCES.KEY.eq(property.getKey())))
                    .fetchAnyInto(Integer.class);
            if (keyPosition == null) {
                keyPosition = dsl.select(org.jooq.impl.DSL.coalesce(
                        org.jooq.impl.DSL.max(DOCUMENT_PROPERTY_SOURCES.KEY_POSITION), -1).add(1))
                        .from(DOCUMENT_PROPERTY_SOURCES)
                        .where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq(documentId)).fetchOne(0, Integer.class);
            }
            List<SourceRow> others = dsl.selectFrom(DOCUMENT_PROPERTY_SOURCES)
                    .where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq(documentId)
                            .and(DOCUMENT_PROPERTY_SOURCES.KEY.eq(property.getKey())))
                    .fetch().stream().filter(row -> !"hand".equals(json.readTree(row.getSource().data())
                            .path("kind").asString()))
                    .map(row -> new SourceRow(row.getSource(), row.getTier(), row.getValue(), row.getObservedAt(),
                            row.getSetBy())).toList();
            dsl.deleteFrom(DOCUMENT_PROPERTY_SOURCES).where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq(documentId)
                    .and(DOCUMENT_PROPERTY_SOURCES.KEY.eq(property.getKey()))).execute();
            int position = 0;
            for (SourceRow source : others) {
                insertDocumentSource(documentId, property.getKey(), keyPosition, position++, source.source(), source.tier(),
                        source.value(), source.observedAt(), source.setBy());
            }
            if (value != null && !value.isNull()) {
                insertDocumentSource(documentId, property.getKey(), keyPosition, position, JSONB.valueOf("{\"kind\":\"hand\"}"),
                        property.getHandTier(), JSONB.valueOf(value.toString()), now(), caller.userId());
            }
            return;
        }
        Integer keyPosition = dsl.select(ITERATION_PROPERTY_SOURCES.KEY_POSITION)
                .from(ITERATION_PROPERTY_SOURCES).where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq(iteration.id())
                        .and(ITERATION_PROPERTY_SOURCES.KEY.eq(property.getKey())))
                .fetchAnyInto(Integer.class);
        if (keyPosition == null) {
            keyPosition = dsl.select(org.jooq.impl.DSL.coalesce(
                    org.jooq.impl.DSL.max(ITERATION_PROPERTY_SOURCES.KEY_POSITION), -1).add(1))
                    .from(ITERATION_PROPERTY_SOURCES)
                    .where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq(iteration.id())).fetchOne(0, Integer.class);
        }
        List<SourceRow> others = dsl.selectFrom(ITERATION_PROPERTY_SOURCES)
                .where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq(iteration.id())
                        .and(ITERATION_PROPERTY_SOURCES.KEY.eq(property.getKey())))
                .fetch().stream().filter(row -> !"hand".equals(json.readTree(row.getSource().data())
                        .path("kind").asString()))
                .map(row -> new SourceRow(row.getSource(), row.getTier(), row.getValue(), row.getObservedAt(),
                        row.getSetBy())).toList();
        dsl.deleteFrom(ITERATION_PROPERTY_SOURCES).where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq(iteration.id())
                .and(ITERATION_PROPERTY_SOURCES.KEY.eq(property.getKey()))).execute();
        int position = 0;
        for (SourceRow source : others) {
            insertIterationSource(iteration.id(), property.getKey(), keyPosition, position++, source.source(), source.tier(),
                    source.value(), source.observedAt(), source.setBy());
        }
        if (value != null && !value.isNull()) {
            insertIterationSource(iteration.id(), property.getKey(), keyPosition, position, JSONB.valueOf("{\"kind\":\"hand\"}"),
                    property.getHandTier(), JSONB.valueOf(value.toString()), now(), caller.userId());
        }
    }

    private void insertDocumentSource(String documentId, String key, int keyPosition, int position, JSONB source, int tier,
            JSONB value, OffsetDateTime observedAt, String setBy) {
        dsl.insertInto(DOCUMENT_PROPERTY_SOURCES).set(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID, documentId)
                .set(DOCUMENT_PROPERTY_SOURCES.KEY, key).set(DOCUMENT_PROPERTY_SOURCES.KEY_POSITION, keyPosition)
                .set(DOCUMENT_PROPERTY_SOURCES.POSITION, position)
                .set(DOCUMENT_PROPERTY_SOURCES.SOURCE, source).set(DOCUMENT_PROPERTY_SOURCES.TIER, tier)
                .set(DOCUMENT_PROPERTY_SOURCES.VALUE, value).set(DOCUMENT_PROPERTY_SOURCES.OBSERVED_AT, observedAt)
                .set(DOCUMENT_PROPERTY_SOURCES.SET_BY, setBy).execute();
    }

    private void insertIterationSource(String iterationId, String key, int keyPosition, int position, JSONB source, int tier,
            JSONB value, OffsetDateTime observedAt, String setBy) {
        dsl.insertInto(ITERATION_PROPERTY_SOURCES).set(ITERATION_PROPERTY_SOURCES.ITERATION_ID, iterationId)
                .set(ITERATION_PROPERTY_SOURCES.KEY, key).set(ITERATION_PROPERTY_SOURCES.KEY_POSITION, keyPosition)
                .set(ITERATION_PROPERTY_SOURCES.POSITION, position)
                .set(ITERATION_PROPERTY_SOURCES.SOURCE, source).set(ITERATION_PROPERTY_SOURCES.TIER, tier)
                .set(ITERATION_PROPERTY_SOURCES.VALUE, value).set(ITERATION_PROPERTY_SOURCES.OBSERVED_AT, observedAt)
                .set(ITERATION_PROPERTY_SOURCES.SET_BY, setBy).execute();
    }

    private JsonNode currentValue(boolean documentProperty, String documentId, Iteration iteration, String key) {
        if (documentProperty) {
            var rows = dsl.select(DOCUMENT_PROPERTY_SOURCES.TIER, DOCUMENT_PROPERTY_SOURCES.VALUE)
                    .from(DOCUMENT_PROPERTY_SOURCES).where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq(documentId)
                            .and(DOCUMENT_PROPERTY_SOURCES.KEY.eq(key)))
                    .orderBy(DOCUMENT_PROPERTY_SOURCES.TIER.desc(), DOCUMENT_PROPERTY_SOURCES.POSITION.asc())
                    .fetch();
            return rows.isEmpty() ? null : json.readTree(rows.getFirst().get(DOCUMENT_PROPERTY_SOURCES.VALUE).data());
        }
        var rows = dsl.select(ITERATION_PROPERTY_SOURCES.TIER, ITERATION_PROPERTY_SOURCES.VALUE)
                .from(ITERATION_PROPERTY_SOURCES).where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq(iteration.id())
                        .and(ITERATION_PROPERTY_SOURCES.KEY.eq(key)))
                .orderBy(ITERATION_PROPERTY_SOURCES.TIER.desc(), ITERATION_PROPERTY_SOURCES.POSITION.asc())
                .fetch();
        return rows.isEmpty() ? null : json.readTree(rows.getFirst().get(ITERATION_PROPERTY_SOURCES.VALUE).data());
    }

    private String applyChecks(Iteration iteration, IterationChecks.CheckResult checked) {
        dsl.deleteFrom(ITERATION_DEFECTS)
                .where(ITERATION_DEFECTS.ITERATION_ID.eq(iteration.id())
                        .and(ITERATION_DEFECTS.SUBJECT.in(checked.goneSubjects())))
                .execute();
        List<Defect> remaining = iteration.defects().stream()
                .filter(defect -> !checked.goneSubjects().contains(defect.subject())).toList();
        Iteration current = new Iteration(iteration.id(), iteration.documentId(), iteration.attempt(),
                iteration.requestId(), iteration.categoryId(), iteration.projectId(), iteration.progress(),
                iteration.restriction(), iteration.restrictionOverride(), iteration.cancellation(), remaining,
                iteration.verdicts(), iteration.links(), iteration.listId(), iteration.digitizedAt());
        String progress = isFoundAfterScan(iteration) ? iteration.progress().name()
                : progressAfterGates(current).name();
        dsl.update(ITERATIONS).set(ITERATIONS.PROGRESS, progress)
                .where(ITERATIONS.ID.eq(iteration.id())).execute();
        return progress;
    }

    private String displayValue(PropertyDefinitionsRecord property, JsonNode value) {
        if (value == null) {
            return "no value";
        }
        JsonNode type = json.readTree(property.getType().data());
        List<String> formatted = new ArrayList<>();
        if (value.isArray()) {
            value.forEach(item -> formatted.add(displayScalar(type, item)));
        } else {
            formatted.add(displayScalar(type, value));
        }
        return String.join(", ", formatted);
    }

    private String displayScalar(JsonNode type, JsonNode value) {
        String kind = type.path("kind").asString();
        if ("yesNo".equals(kind)) {
            return value.booleanValue() ? "Yes" : "No";
        }
        if ("enum".equals(kind)) {
            for (JsonNode choice : type.path("values")) {
                if (choice.path("value").asString().equals(value.asString())) {
                    return choice.path("names").path("en").asString(value.asString());
                }
            }
        }
        if ("number".equals(kind)) {
            NumberFormat format = NumberFormat.getNumberInstance(Locale.UK);
            format.setMaximumFractionDigits(3);
            String number = format.format(value.doubleValue());
            String unit = type.path("unit").asString();
            return unit.isEmpty() ? number : number + " " + unit;
        }
        return value.asString(value.toString());
    }

    private String progressNote(String before, String after) {
        if (before.equals(after)) {
            return "";
        }
        return "Ready".equals(after) ? " Every gate passes: Ready." : " Back to " + after + ": a gate holds it.";
    }

    private OffsetDateTime now() {
        return clock.instant().atOffset(ZoneOffset.UTC);
    }

    private record SourceRow(JSONB source, int tier, JSONB value, OffsetDateTime observedAt,
            String setBy) {}

    private record Preflight(ActResult refusal, Document document,
            Iteration iteration, PropertyDefinitionsRecord property,
            Object value) {
        static Preflight refused(ActResult refusal) {
            return new Preflight(refusal, null, null, null, null);
        }
    }
}
