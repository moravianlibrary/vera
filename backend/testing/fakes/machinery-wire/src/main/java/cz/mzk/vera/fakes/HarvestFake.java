package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.harvester.HarvestAnswer;
import cz.mzk.vera.plugin.harvester.HarvestAnswer.CatalogId;
import cz.mzk.vera.plugin.harvester.HarvestAnswer.Identifier;
import cz.mzk.vera.plugin.harvester.HarvestInput;
import cz.mzk.vera.plugin.harvester.Harvester;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

// PLG-api-kinds: Harvester; PLG-api-cursor.
public final class HarvestFake implements Harvester {
    @Override
    public HarvestAnswer harvest(PluginContext context, HarvestInput input) {
        Map<String, List<String>> fields = Wire.fields();
        Wire.put(fields, "cursor", input.cursor());
        Map<String, List<String>> answer = Wire.send(context, "harvest", fields);
        List<HarvestAnswer.ProposalItem> items = new ArrayList<>();
        List<String> kinds = Wire.all(answer, "kind");
        List<String> catalogs = Wire.all(answer, "catalogId");
        List<String> types = Wire.all(answer, "type");
        List<String> values = Wire.all(answer, "value");
        for (int i = 0; i < kinds.size(); i++) {
            if ("catalogId".equals(kinds.get(i))) {
                items.add(new CatalogId(catalogs.get(i)));
            } else {
                items.add(new Identifier(types.get(i), values.get(i)));
            }
        }
        String nextCursor = Wire.first(answer, "nextCursor");
        return new HarvestAnswer(List.copyOf(items), nextCursor == null || nextCursor.isEmpty() ? null : nextCursor);
    }
}
