package cz.mzk.vera.jobs;

import java.time.Instant;
import tools.jackson.databind.JsonNode;

public record Job(
        long id,
        String kind,
        Instant dueAt,
        JsonNode payload,
        int attempt,
        String traceParent) { }
