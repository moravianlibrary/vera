package cz.mzk.vera.plugin.records;

import java.time.Instant;
import java.util.List;

// PLG-api-kinds: Property source. Page sources, registry records, properties and existing copies
// come in a minor version when a plugin needs one (PLG-api-version).
public record Iteration(String id, String documentId, int attempt, String requestId, String categoryId,
        String priority, String projectId, String progress, String listId, String formerListName,
        Restriction restriction, RestrictionOverride restrictionOverride, Cancellation cancellation,
        List<Defect> defects, List<ValidationVerdict> verdicts, IngestFailure ingestFailure,
        Instant digitizedAt, List<PublicationLink> links, Integer scanDpi, List<Document.PropertyValues> properties) {
    public Iteration(String id, String documentId, int attempt, String requestId, String categoryId,
            String priority, String projectId, String progress, String listId, String formerListName) {
        this(id, documentId, attempt, requestId, categoryId, priority, projectId, progress, listId,
                formerListName, null, null, null, List.of(), List.of(), null, null, List.of(), null, List.of());
    }

    public record Restriction(String rule, String publicText, String internalText, Instant foundAt) {}

    public record RestrictionOverride(String actorId, Instant at, String note) {}

    public record Cancellation(String cause, String actorId, Instant at, String publicText, String internalText) {}

    public record Defect(String key, String instanceId, String ruleCode, String subject, String publicText,
            String internalText, Instant firstSeenAt) {}

    public record ValidationVerdict(List<String> defectKeys, String verdict, String actorId, Instant at,
            String note, String publicText) {}

    public record IngestFailure(int attempts, String error) {}

    public record PublicationLink(String id, String url, String instanceId, String setBy, Instant setAt,
            boolean isPrimary) {}
}
