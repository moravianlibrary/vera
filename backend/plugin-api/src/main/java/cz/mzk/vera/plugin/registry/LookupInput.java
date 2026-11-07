package cz.mzk.vera.plugin.registry;

import cz.mzk.vera.plugin.records.Document;
import java.util.List;

// PLG-api-kinds: Registry.
public record LookupInput(Document record, List<String> identifiers) {}
