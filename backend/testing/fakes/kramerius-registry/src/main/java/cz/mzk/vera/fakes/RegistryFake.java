package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.registry.LookupAnswer;
import cz.mzk.vera.plugin.registry.LookupInput;
import cz.mzk.vera.plugin.registry.Registry;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

// BK4g; PLG-api-kinds: Registry.
public final class RegistryFake implements Registry {
    @Override
    public LookupAnswer lookup(PluginContext context, LookupInput input) {
        Map<String, List<String>> answer = IngestWire.call(context, "Registry", "lookup",
                input.record().id(), input.record().catalogId(), input.identifiers());
        IngestWire.check(answer);
        List<LookupAnswer.RegistryRecord> records = new ArrayList<>();
        List<String> rawStates = IngestWire.aligned(answer, "recordRawState", "recordLink");
        List<String> links = Wire.all(answer, "recordLink");
        for (int index = 0; index < rawStates.size(); index++) {
            String link = links.get(index);
            records.add(new LookupAnswer.RegistryRecord(rawStates.get(index), link.isEmpty() ? null : link));
        }
        return new LookupAnswer(List.copyOf(records));
    }
}
