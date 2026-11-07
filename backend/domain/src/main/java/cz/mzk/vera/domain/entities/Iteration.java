package cz.mzk.vera.domain.entities;

import java.util.List;

// B3 domain entity fields consumed by the Java rule ports.
public record Iteration(String id, String documentId, int attempt, String requestId, String categoryId,
    String projectId, Progress progress, Restriction restriction, RestrictionOverride restrictionOverride,
    Cancellation cancellation, List<Defect> defects, List<Verdict> verdicts, List<PublicationLink> links,
    String listId, String digitizedAt) {
  public Iteration(String id, String documentId, int attempt, String requestId, String categoryId,
      String projectId, Progress progress, Restriction restriction, RestrictionOverride restrictionOverride,
      Cancellation cancellation, List<Defect> defects, List<Verdict> verdicts) {
    this(id, documentId, attempt, requestId, categoryId, projectId, progress, restriction,
        restrictionOverride, cancellation, defects, verdicts, List.of(), null, null);
  }

  public Iteration(String id, String documentId, int attempt, String requestId, String categoryId,
      String projectId, Progress progress, Restriction restriction, RestrictionOverride restrictionOverride,
      Cancellation cancellation, List<Defect> defects, List<Verdict> verdicts, List<PublicationLink> links) {
    this(id, documentId, attempt, requestId, categoryId, projectId, progress, restriction,
        restrictionOverride, cancellation, defects, verdicts, links, null, null);
  }
}
