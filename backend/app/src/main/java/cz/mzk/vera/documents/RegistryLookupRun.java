package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;

import cz.mzk.vera.plugin.registry.LookupAnswer;
import cz.mzk.vera.plugin.registry.LookupInput;
import cz.mzk.vera.plugin.registry.Registry;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginInstances;
import cz.mzk.vera.pluginhost.PluginOutcome;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;

// REG-lookup; LC-REQ-checks-job: ingest and proposal checks share ordered Registry lookup calls.
@Component
public class RegistryLookupRun {
    private final DSLContext dsl;
    private final PluginCalls calls;
    private final PluginInstances instances;

    public RegistryLookupRun(DSLContext dsl, PluginCalls calls, PluginInstances instances) {
        this.dsl = dsl;
        this.calls = calls;
        this.instances = instances;
    }

    public List<Answer> run(Document document, List<String> identifiers, Duration timeout) {
        List<Answer> answers = new ArrayList<>();
        for (RegistryInstance registry : enabled()) {
            PluginInstances.Instance instance = registry.instance();
            PluginOutcome<LookupAnswer> outcome = timeout == null
                    ? calls.call(dsl, instance.id(), Registry.class, "lookup",
                            (plugin, context) -> plugin.lookup(context, new LookupInput(document, identifiers)))
                    : calls.call(dsl, instance.id(), Registry.class, "lookup", timeout,
                            (plugin, context) -> plugin.lookup(context, new LookupInput(document, identifiers)));
            if (!(outcome instanceof PluginOutcome.Answered<LookupAnswer> answer)) {
                throw new RegistryLookupFailure(instance.name() + " registry lookup failed");
            }
            answers.add(new Answer(instance, registry.registry(), answer.answer()));
        }
        return List.copyOf(answers);
    }

    public List<RegistryInstance> enabled() {
        return dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.NAME, PLUGIN_IMPLEMENTATIONS.NAME)
                .from(PLUGIN_INSTANCES).join(PLUGIN_IMPLEMENTATIONS)
                .on(PLUGIN_INSTANCES.IMPLEMENTATION_ID.eq(PLUGIN_IMPLEMENTATIONS.ID))
                .where(PLUGIN_IMPLEMENTATIONS.KIND.eq("Registry"))
                .and(PLUGIN_INSTANCES.IS_ENABLED.isTrue()).and(PLUGIN_INSTANCES.IS_DELETED.isFalse())
                .orderBy(PLUGIN_INSTANCES.POSITION)
                .fetch(row -> {
                    String implementation = row.get(PLUGIN_IMPLEMENTATIONS.NAME);
                    String registry = implementation.endsWith("Registry")
                            ? implementation.substring(0, implementation.length() - "Registry".length())
                            : implementation;
                    if (registry.equals("Rdcz")) {
                        registry = "RDCZ";
                    }
                    return new RegistryInstance(new PluginInstances.Instance(row.get(PLUGIN_INSTANCES.ID),
                            row.get(PLUGIN_INSTANCES.NAME)), registry);
                });
    }

    public record RegistryInstance(PluginInstances.Instance instance, String registry) {}
    public record Answer(PluginInstances.Instance instance, String registry, LookupAnswer answer) {}

    public static final class RegistryLookupFailure extends RuntimeException {
        private static final long serialVersionUID = 1L;

        public RegistryLookupFailure(String message) {
            super(message);
        }
    }
}
