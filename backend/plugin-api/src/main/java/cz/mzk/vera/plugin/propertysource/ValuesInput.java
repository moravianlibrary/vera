package cz.mzk.vera.plugin.propertysource;

import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.records.Iteration;

// PLG-api-kinds: Property source.
public record ValuesInput(Document record, Iteration iteration) {}
