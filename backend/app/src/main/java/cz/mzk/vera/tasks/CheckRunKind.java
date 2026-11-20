package cz.mzk.vera.tasks;

import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR_KEYS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_LINKS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;

import cz.mzk.vera.documents.PluginAnswerWrites;
import cz.mzk.vera.plugin.propertysource.PropertySource;
import cz.mzk.vera.plugin.propertysource.ValuesAnswer;
import cz.mzk.vera.plugin.propertysource.ValuesInput;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.records.Iteration;
import cz.mzk.vera.plugin.records.Iteration.PublicationLink;
import cz.mzk.vera.plugin.registry.LookupAnswer;
import cz.mzk.vera.plugin.registry.LookupInput;
import cz.mzk.vera.plugin.registry.Registry;
import cz.mzk.vera.plugin.restriction.Restriction;
import cz.mzk.vera.plugin.restriction.RestrictionCheckAnswer;
import cz.mzk.vera.plugin.restriction.RestrictionCheckInput;
import cz.mzk.vera.plugin.validation.Validation;
import cz.mzk.vera.plugin.validation.ValidationCheckAnswer;
import cz.mzk.vera.plugin.validation.ValidationCheckInput;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
import java.util.ArrayList;
import java.util.List;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

// PLG-run-items: check answers are written in their owning document tables.
@Component
public class CheckRunKind implements RunKind {
    private final DSLContext dsl;
    private final PluginCalls calls;
    private final PluginAnswerWrites answerWrites;
    private final JsonMapper json;

    public CheckRunKind(DSLContext dsl, PluginCalls calls, PluginAnswerWrites answerWrites, JsonMapper json) {
        this.dsl = dsl;
        this.calls = calls;
        this.answerWrites = answerWrites;
        this.json = json;
    }

    @Override
    public boolean supports(String kind, String coreName) {
        return "Registry".equals(kind) || "PropertySource".equals(kind)
                || "Validation".equals(kind) || "Restriction".equals(kind);
    }

    @Override
    public Call call(Context context) {
        List<TargetAnswer> answers = new ArrayList<>();
        for (Target target : context.targets()) {
            answers.add(callTarget(context, target));
        }
        boolean allUnavailable = !answers.isEmpty() && answers.stream().allMatch(TargetAnswer::unavailable);
        return new Call(answers, List.of(), answers.size(), allUnavailable, null, null);
    }

    @Override
    public Applied apply(DSLContext tx, Context context, Call call) {
        int changes = 0;
        for (TargetAnswer answer : call.answers()) {
            if (!answer.unavailable() && answer.error() == null) {
                changes += writeAnswer(tx, context, answer);
            }
        }
        return new Applied(changes, 0, 0, false, false, false, List.of(), "/documents");
    }

    private TargetAnswer callTarget(Context context, Target target) {
        Document document = new Document(target.documentId(), target.catalogId(), null, target.title(),
                target.documentType(), target.shelfMark());
        return switch (context.kind()) {
            case "Registry" -> answer(calls.call(context.instanceId(), Registry.class, "lookup",
                    (plugin, pluginContext) -> plugin.lookup(pluginContext,
                            new LookupInput(document, identifiers(target.catalogId())))), target);
            case "PropertySource" -> answer(calls.call(context.instanceId(), PropertySource.class, "values",
                    (plugin, pluginContext) -> plugin.values(pluginContext,
                            new ValuesInput(document, iteration(target)))), target);
            case "Validation" -> answer(calls.call(context.instanceId(), Validation.class, "check",
                    (plugin, pluginContext) -> plugin.check(pluginContext,
                            new ValidationCheckInput(document, propertyValues(target)))), target);
            case "Restriction" -> answer(calls.call(context.instanceId(), Restriction.class, "check",
                    (plugin, pluginContext) -> plugin.check(pluginContext,
                            new RestrictionCheckInput(document, restrictionValues(target)))), target);
            default -> new TargetAnswer(target, null, "The plugin was switched off.", false);
        };
    }

    private List<String> identifiers(String catalogId) {
        return dsl.select(CATALOG_MIRROR_KEYS.VALUE).from(CATALOG_MIRROR_KEYS)
                .where(CATALOG_MIRROR_KEYS.CATALOG_ID.eq(catalogId))
                .and(CATALOG_MIRROR_KEYS.KIND.eq("identifier"))
                .orderBy(CATALOG_MIRROR_KEYS.POSITION).fetch(CATALOG_MIRROR_KEYS.VALUE);
    }

    private Iteration iteration(Target target) {
        if (target.iterationId() == null) {
            return new Iteration("", target.documentId(), 1, null, null, null, null, "Enqueued", null, null);
        }
        Record row = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq(target.iterationId())).fetchOne();
        List<PublicationLink> links = dsl.selectFrom(ITERATION_LINKS)
                .where(ITERATION_LINKS.ITERATION_ID.eq(target.iterationId()))
                .orderBy(ITERATION_LINKS.POSITION)
                .fetch(link -> new PublicationLink(link.getId(), link.getUrl(), link.getInstanceId(),
                        link.getSetBy(), link.getSetAt().toInstant(), link.getIsPrimary()));
        return new Iteration(row.get(ITERATIONS.ID), row.get(ITERATIONS.DOCUMENT_ID), row.get(ITERATIONS.ATTEMPT),
                row.get(ITERATIONS.REQUEST_ID), row.get(ITERATIONS.CATEGORY_ID), row.get(ITERATIONS.PRIORITY),
                row.get(ITERATIONS.PROJECT_ID), row.get(ITERATIONS.PROGRESS), row.get(ITERATIONS.LIST_ID),
                row.get(ITERATIONS.FORMER_LIST_NAME), null, null, null, List.of(), List.of(), null,
                row.get(ITERATIONS.DIGITIZED_AT) == null ? null : row.get(ITERATIONS.DIGITIZED_AT).toInstant(),
                links, row.get(ITERATIONS.SCAN_DPI), List.of());
    }

    private List<ValidationCheckInput.PropertyValue> propertyValues(Target target) {
        List<ValidationCheckInput.PropertyValue> values = new ArrayList<>();
        dsl.select(DOCUMENT_PROPERTY_SOURCES.KEY, DOCUMENT_PROPERTY_SOURCES.VALUE)
                .from(DOCUMENT_PROPERTY_SOURCES)
                .where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq(target.documentId()))
                .orderBy(DOCUMENT_PROPERTY_SOURCES.POSITION).fetch().forEach(row -> values.add(
                        new ValidationCheckInput.PropertyValue(row.get(DOCUMENT_PROPERTY_SOURCES.KEY),
                                json.readTree(row.get(DOCUMENT_PROPERTY_SOURCES.VALUE).data()))));
        if (target.iterationId() != null) {
            dsl.select(ITERATION_PROPERTY_SOURCES.KEY, ITERATION_PROPERTY_SOURCES.VALUE)
                    .from(ITERATION_PROPERTY_SOURCES)
                    .where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq(target.iterationId()))
                    .orderBy(ITERATION_PROPERTY_SOURCES.POSITION).fetch().forEach(row -> values.add(
                            new ValidationCheckInput.PropertyValue(row.get(ITERATION_PROPERTY_SOURCES.KEY),
                                    json.readTree(row.get(ITERATION_PROPERTY_SOURCES.VALUE).data()))));
        }
        return values;
    }

    private List<RestrictionCheckInput.PropertyValue> restrictionValues(Target target) {
        return propertyValues(target).stream()
                .map(value -> new RestrictionCheckInput.PropertyValue(value.key(), value.value())).toList();
    }

    private TargetAnswer answer(PluginOutcome<?> outcome, Target target) {
        if (outcome instanceof PluginOutcome.Answered<?> answered) {
            return new TargetAnswer(target, answered.answer(), null, false);
        }
        if (outcome instanceof PluginOutcome.Refused<?> refused) {
            return new TargetAnswer(target, null, refused.code() + ": " + refused.message(), false);
        }
        return new TargetAnswer(target, null, null, true);
    }

    private int writeAnswer(DSLContext tx, Context context, TargetAnswer answer) {
        Target target = answer.target();
        String instanceName = tx.select(PLUGIN_INSTANCES.NAME).from(PLUGIN_INSTANCES)
                .where(PLUGIN_INSTANCES.ID.eq(context.instanceId())).fetchOne(PLUGIN_INSTANCES.NAME);
        if ("Registry".equals(context.kind())) {
            return answerWrites.registry(tx, target.documentId(), instanceName, (LookupAnswer) answer.answer());
        }
        if (target.iterationId() == null) {
            return 0;
        }
        if ("PropertySource".equals(context.kind())) {
            return answerWrites.properties(tx, target.documentId(), target.iterationId(), context.instanceId(),
                    instanceName, (ValuesAnswer) answer.answer());
        }
        if ("Validation".equals(context.kind())) {
            ValidationCheckAnswer found = (ValidationCheckAnswer) answer.answer();
            return answerWrites.defects(tx, target.iterationId(), context.instanceId(), found.defects());
        }
        if ("Restriction".equals(context.kind())) {
            return answerWrites.restriction(tx, target.iterationId(),
                    context.instanceId(), instanceName, (RestrictionCheckAnswer) answer.answer(), context.runId());
        }
        return 0;
    }
}
