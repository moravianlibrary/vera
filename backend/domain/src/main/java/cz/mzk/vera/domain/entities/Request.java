package cz.mzk.vera.domain.entities;

import java.util.List;

// B3 domain entity fields consumed by the Java rule ports.
public record Request(String id, String documentId, String requesterId, String at, String reason,
    String batchId, String projectId, Decision decision, IterationLink iteration, String tracksIterationId,
    List<ExistingCopy> existingCopies, String checkedAt, boolean isAfterProjectApproval) {}
