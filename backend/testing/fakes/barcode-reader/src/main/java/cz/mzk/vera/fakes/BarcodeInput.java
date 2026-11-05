package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.input.BarcodeReader;
import cz.mzk.vera.plugin.input.Input;
import cz.mzk.vera.plugin.input.ReadBarcodeAnswer;
import cz.mzk.vera.plugin.input.ReadBarcodeInput;
import java.util.List;
import java.util.Map;

// BK3d; PLG-api-kinds: Input.
public final class BarcodeInput implements Input, BarcodeReader {
    @Override
    public ReadBarcodeAnswer readBarcode(PluginContext context, ReadBarcodeInput input) {
        Map<String, List<String>> fields = Wire.fields();
        Wire.put(fields, "photo", input.photo());
        Map<String, List<String>> answer = Wire.send(context, "readBarcode", fields);
        return new ReadBarcodeAnswer("true".equals(Wire.first(answer, "valueNull"))
                ? null : Wire.first(answer, "value"));
    }
}
