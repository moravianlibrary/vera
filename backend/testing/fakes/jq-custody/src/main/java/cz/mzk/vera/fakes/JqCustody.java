package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.custody.Custody;
import cz.mzk.vera.plugin.custody.PlaceAnswer;
import cz.mzk.vera.plugin.custody.PlaceInput;
import java.util.List;
import java.util.Map;

// BK3d; PLG-api-kinds: Custody.
public final class JqCustody implements Custody {
    @Override
    public PlaceAnswer place(PluginContext context, PlaceInput input) {
        Map<String, List<String>> fields = Wire.fields();
        Wire.put(fields, "requestId", input.request().id());
        Wire.put(fields, "baseId", input.request().id().replaceFirst("\\.\\d+$", ""));
        Wire.put(fields, "projectId", input.request().projectId());
        Wire.put(fields, "documentType", input.document().type());
        Wire.put(fields, "catalogId", input.document().catalogId());
        Map<String, List<String>> answer = Wire.send(context, "place", fields);
        return new PlaceAnswer(Wire.all(answer, "custody"));
    }
}
