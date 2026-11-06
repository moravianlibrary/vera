package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.EVENTS;

import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import cz.mzk.vera.web.Instants;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// LOG-history; LOG-ingest-detail: preserve event order and apply the audience's history rules.
@Repository
public class DocumentHistory {
    private final DSLContext dsl;
    private final JsonMapper mapper;

    public DocumentHistory(DSLContext dsl, JsonMapper mapper) {
        this.dsl = dsl;
        this.mapper = mapper;
    }

    public List<Map<String, Object>> logOf(Set<String> subjects, HeldScopes held, Audience audience) {
        List<Map<String, Object>> entries = new ArrayList<>();
        for (var row : dsl.selectFrom(EVENTS).where(EVENTS.SUBJECT_ID.in(subjects))
                .orderBy(EVENTS.AT.desc(), EVENTS.POSITION.asc()).fetch()) {
            JsonNode data = json(row.getData().data());
            EventCode code = EventCode.of(row.getCode());
            if (audience == Audience.PUBLIC
                    && (!code.isPublic() || (code == EventCode.ITERATION_RESTRICTED
                        && !"forbidden".equals(data.path("outcome").asString())))) {
                continue;
            }
            Map<String, Object> actor = object(json(row.getActor().data()));
            Object payload = object(data);
            Map<String, Object> reason = new LinkedHashMap<>();
            reason.put("public", row.getReasonPublic());
            reason.put("internal", row.getReasonInternal());
            if (audience == Audience.PUBLIC) {
                payload = null;
                reason.put("internal", null);
                if (!"system".equals(actor.get("kind"))) {
                    actor = new LinkedHashMap<>(Map.of("kind", "undisclosed"));
                }
            } else if (!held.hasPermission("request.read_ingest")
                    && code == EventCode.ITERATION_INGEST_FAILED && payload instanceof Map<?, ?> values) {
                @SuppressWarnings("unchecked")
                Map<String, Object> sanitized = (Map<String, Object>) values;
                sanitized.put("error", null);
            }
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id", row.getId());
            entry.put("subjectKind", row.getSubjectKind());
            entry.put("subjectId", row.getSubjectId());
            entry.put("at", Instants.format(row.getAt().toInstant()));
            entry.put("actor", actor);
            entry.put("correlationId", row.getCorrelationId());
            entry.put("reason", reason);
            entry.put("code", row.getCode());
            entry.put("data", payload);
            entries.add(entry);
        }
        if (audience == Audience.PUBLIC) {
            return entries;
        }
        Set<String> seen = new HashSet<>();
        return entries.stream().filter(entry -> seen.add(
            entry.get("correlationId") + "|" + entry.get("code"))).toList();
    }

    private JsonNode json(String value) {
        try {
            return mapper.readTree(value);
        } catch (JacksonException exception) {
            throw new IllegalStateException(exception);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> object(JsonNode node) {
        return mapper.convertValue(node, Map.class);
    }
}
