package cz.mzk.vera.plugin.input;

import cz.mzk.vera.plugin.PluginContext;

// PLG-api-kinds: Input.
public interface BarcodeReader {
    ReadBarcodeAnswer readBarcode(PluginContext context, ReadBarcodeInput input);
}
