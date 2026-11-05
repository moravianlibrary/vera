package cz.mzk.vera.domain.entities;

import java.util.List;

// B3 domain entity fields consumed by the Java rule ports.
public record Iteration(String id, String documentId, int attempt, String requestId, String categoryId,
    String projectId, Progress progress, Restriction restriction, RestrictionOverride restrictionOverride,
    Cancellation cancellation, List<Defect> defects, List<Verdict> verdicts) {}
