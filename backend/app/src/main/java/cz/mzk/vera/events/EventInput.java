package cz.mzk.vera.events;

import cz.mzk.vera.domain.events.EventCode;
import java.time.Instant;
import tools.jackson.databind.JsonNode;

// EVENT-shape; LOG-actor; ACT-reason-two-texts.
public record EventInput(
        EventCode code,
        String subjectKind,
        String subjectId,
        String subjectName,
        Actor actor,
        String correlationId,
        Instant at,
        JsonNode data,
        Reason reason) {
    public sealed interface Actor permits System, User, Undisclosed {}

    public record System() implements Actor {}

    public record User(String userId) implements Actor {}

    public record Undisclosed() implements Actor {}

    public record Reason(String publicReason, String internal) {}
}
