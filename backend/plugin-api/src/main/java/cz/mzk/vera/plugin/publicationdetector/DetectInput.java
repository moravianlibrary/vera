package cz.mzk.vera.plugin.publicationdetector;

import cz.mzk.vera.plugin.records.Iteration;
import java.util.List;

// PLG-api-kinds: Publication detector; id, documentId, identifiers and links are retained.
public record DetectInput(List<Iteration> iterations) {}
