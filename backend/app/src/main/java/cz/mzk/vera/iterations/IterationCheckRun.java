package cz.mzk.vera.iterations;

import cz.mzk.vera.plugin.PluginUnavailable;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.restriction.Restriction;
import cz.mzk.vera.plugin.restriction.RestrictionCheckAnswer;
import cz.mzk.vera.plugin.restriction.RestrictionCheckInput;
import cz.mzk.vera.plugin.validation.Validation;
import cz.mzk.vera.plugin.validation.ValidationCheckAnswer;
import cz.mzk.vera.plugin.validation.ValidationCheckInput;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginInstances;
import cz.mzk.vera.pluginhost.PluginOutcome;
import java.util.ArrayList;
import java.util.List;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;

// ACT-recheck; DOC-manual-page-count; LC-ITER-ingest: one path for validation and restriction checks.
@Component
public class IterationCheckRun {
    private final DSLContext dsl;
    private final PluginCalls calls;
    private final PluginInstances instances;

    public IterationCheckRun(DSLContext dsl, PluginCalls calls, PluginInstances instances) {
        this.dsl = dsl;
        this.calls = calls;
        this.instances = instances;
    }

    public Result run(Document record, List<Value> values) {
        List<ValidationAnswer> validations = new ArrayList<>();
        List<RestrictionAnswer> restrictions = new ArrayList<>();
        List<ValidationCheckInput.PropertyValue> validationValues = values.stream()
                .map(value -> new ValidationCheckInput.PropertyValue(value.key(), value.value())).toList();
        List<RestrictionCheckInput.PropertyValue> restrictionValues = values.stream()
                .map(value -> new RestrictionCheckInput.PropertyValue(value.key(), value.value())).toList();
        for (PluginInstances.Instance instance : instances.enabled(dsl, "Validation")) {
            PluginOutcome<ValidationCheckAnswer> outcome = calls.call(instance.id(), Validation.class, "check",
                    (plugin, context) -> plugin.check(context, new ValidationCheckInput(record, validationValues)));
            if (!(outcome instanceof PluginOutcome.Answered<ValidationCheckAnswer> answer)) {
                throw new PluginUnavailable("Validation " + instance.name() + " is unavailable");
            }
            validations.add(new ValidationAnswer(instance, answer.answer()));
        }
        for (PluginInstances.Instance instance : instances.enabled(dsl, "Restriction")) {
            PluginOutcome<RestrictionCheckAnswer> outcome = calls.call(instance.id(), Restriction.class, "check",
                    (plugin, context) -> plugin.check(context, new RestrictionCheckInput(record, restrictionValues)));
            if (!(outcome instanceof PluginOutcome.Answered<RestrictionCheckAnswer> answer)) {
                throw new PluginUnavailable("Restriction " + instance.name() + " is unavailable");
            }
            restrictions.add(new RestrictionAnswer(instance, answer.answer()));
        }
        return new Result(validations, restrictions);
    }

    public record Value(String key, Object value) {}
    public record ValidationAnswer(PluginInstances.Instance instance, ValidationCheckAnswer answer) {}
    public record RestrictionAnswer(PluginInstances.Instance instance, RestrictionCheckAnswer answer) {}
    public record Result(List<ValidationAnswer> validations, List<RestrictionAnswer> restrictions) {}
}
