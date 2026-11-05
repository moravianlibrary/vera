package cz.mzk.vera.plugin.records;

import java.time.Instant;

// PLG-api-kinds: Custody; Classifier. Page sources, registry records, properties and existing copies
// come in a minor version when a plugin needs one (PLG-api-version).
public record Request(String id, String documentId, String requesterId, Instant at, String reason,
        String batchId, String projectId, Instant checkedAt, String decision) {}
