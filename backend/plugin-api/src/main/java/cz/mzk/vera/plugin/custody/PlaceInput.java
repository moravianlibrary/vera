package cz.mzk.vera.plugin.custody;

import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.records.Request;

// PLG-api-kinds: Custody.
public record PlaceInput(Request request, Document document) {}
