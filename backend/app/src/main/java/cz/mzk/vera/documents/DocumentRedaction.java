package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.PROPERTY_DEFINITIONS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;

import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;

// DOC-property-visibility; LOG-ingest-detail; VIEW-documents-audience: redact a record by audience.
@Component
public class DocumentRedaction {
    private final DSLContext dsl;
    private final DocumentReach reach;

    public DocumentRedaction(DSLContext dsl, DocumentReach reach) {
        this.dsl = dsl;
        this.reach = reach;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> redact(Map<String, Object> record, HeldScopes held, String callerId,
            String documentId, Audience audience) {
        List<Map<String, Object>> requests = (List<Map<String, Object>>) record.get("requests");
        List<Map<String, Object>> iterations = (List<Map<String, Object>>) record.get("iterations");
        if (audience == Audience.PUBLIC) {
            Set<String> publicKeys = new HashSet<>(dsl.select(PROPERTY_DEFINITIONS.KEY)
                .from(PROPERTY_DEFINITIONS)
                .where(PROPERTY_DEFINITIONS.VISIBILITY.eq("public")).fetch(PROPERTY_DEFINITIONS.KEY));
            Set<String> reachedRequestIds = new HashSet<>(dsl.select(REQUESTS.ID).from(REQUESTS)
                .where(REQUESTS.DOCUMENT_ID.eq(documentId)
                    .and(reach.requestCondition(held, callerId))).fetch(REQUESTS.ID));
            requests.removeIf(request -> !reachedRequestIds.contains(request.get("id")));
            Set<String> followed = new HashSet<>();
            for (Map<String, Object> request : requests) {
                String decision = (String) request.get("decision");
                if ("Approved".equals(decision) && request.get("iteration") instanceof Map<?, ?> item) {
                    followed.add((String) item.get("id"));
                } else if ("Duplicate".equals(decision)) {
                    followed.add((String) request.get("tracksIterationId"));
                }
                if ("Denied".equals(decision)) {
                    ((Map<String, Object>) request.get("decline")).put("internalText", null);
                }
            }
            iterations.removeIf(iteration -> !followed.contains(iteration.get("id")));
            publicProperties((Map<String, Object>) record.get("document"), publicKeys);
            for (Map<String, Object> iteration : iterations) {
                publicIteration(iteration, publicKeys);
            }
        } else if (!held.hasPermission("request.read_ingest")) {
            for (Map<String, Object> iteration : iterations) {
                removeIngestError(iteration);
            }
        }
        return record;
    }

    @SuppressWarnings("unchecked")
    private void publicProperties(Map<String, Object> owner, Set<String> publicKeys) {
        List<Map<String, Object>> properties = (List<Map<String, Object>>) owner.get("properties");
        properties.removeIf(property -> !publicKeys.contains(property.get("key")));
        for (Map<String, Object> property : properties) {
            for (Map<String, Object> source : (List<Map<String, Object>>) property.get("sources")) {
                source.put("setBy", null);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void publicIteration(Map<String, Object> iteration, Set<String> publicKeys) {
        removeIngestError(iteration);
        publicProperties(iteration, publicKeys);
        redactText(iteration, "restriction", "internalText");
        redactText(iteration, "cancellation", "internalText");
        for (Map<String, Object> defect : (List<Map<String, Object>>) iteration.get("defects")) {
            defect.put("internalText", null);
        }
    }

    @SuppressWarnings("unchecked")
    private void removeIngestError(Map<String, Object> iteration) {
        if (iteration.get("ingestFailure") instanceof Map<?, ?> failure) {
            ((Map<String, Object>) failure).put("error", null);
        }
    }

    @SuppressWarnings("unchecked")
    private void redactText(Map<String, Object> owner, String key, String field) {
        if (owner.get(key) instanceof Map<?, ?> nested) {
            ((Map<String, Object>) nested).put(field, null);
        }
    }
}
