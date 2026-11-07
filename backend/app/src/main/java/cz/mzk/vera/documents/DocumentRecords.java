package cz.mzk.vera.documents;

import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PAGE_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_REGISTRY_RECORDS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_DEFECTS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_LINKS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.ITERATION_VERDICTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;

import cz.mzk.vera.web.Instants;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Repository;

// DOC-property-values; DOC-identifiers: read each record table in batches, preserving child order.
@Repository
public class DocumentRecords {
    private final DSLContext dsl;
    private final DocumentJson json;

    public DocumentRecords(DSLContext dsl, DocumentJson json) {
        this.dsl = dsl;
        this.json = json;
    }

    public Map<String, Map<String, Object>> recordsOf(Collection<String> documentIds) {
        return recordsOf(documentIds, null);
    }

    public Map<String, Map<String, Object>> recordsOf(Collection<String> documentIds,
            Collection<String> requestIds) {
        if (documentIds.isEmpty()) {
            return Map.of();
        }
        Map<String, Map<String, Object>> documents = new LinkedHashMap<>();
        dsl.selectFrom(DOCUMENTS).where(DOCUMENTS.ID.in(documentIds)).fetch().forEach(row -> {
            Map<String, Object> document = map("id", row.getId(), "catalogId", row.getCatalogId(),
                "unit", row.getUnitType() == null ? null
                    : map("type", row.getUnitType(), "value", row.getUnitValue()),
                "title", row.getTitle(), "type", row.getType(), "shelfMark", row.getShelfMark(),
                "pageSources", new ArrayList<>(), "registryRecords", new ArrayList<>(),
                "properties", new ArrayList<>(), "iterations", new ArrayList<>(),
                "requests", new ArrayList<>());
            documents.put(row.getId(), document);
        });
        dsl.selectFrom(DOCUMENT_PAGE_SOURCES).where(DOCUMENT_PAGE_SOURCES.DOCUMENT_ID.in(documentIds))
            .orderBy(DOCUMENT_PAGE_SOURCES.DOCUMENT_ID, DOCUMENT_PAGE_SOURCES.POSITION)
            .fetch().forEach(row -> {
                add(documents.get(row.getDocumentId()), "pageSources", map("source", row.getSource(),
                    "tier", row.getTier(), "value", row.getValue(), "observedAt", time(row.getObservedAt()),
                    "setBy", row.getSetBy()));
            });
        dsl.selectFrom(DOCUMENT_REGISTRY_RECORDS)
            .where(DOCUMENT_REGISTRY_RECORDS.DOCUMENT_ID.in(documentIds))
            .orderBy(DOCUMENT_REGISTRY_RECORDS.DOCUMENT_ID, DOCUMENT_REGISTRY_RECORDS.POSITION)
            .fetch().forEach(row -> {
                add(documents.get(row.getDocumentId()), "registryRecords", map("registry", row.getRegistry(),
                    "state", row.getState(), "rawState", row.getRawState(), "linkKind", row.getLinkKind(),
                    "url", row.getUrl(), "observedAt", time(row.getObservedAt()),
                    "checkedAt", time(row.getCheckedAt()), "error", row.getError()));
            });
        dsl.selectFrom(DOCUMENT_PROPERTY_SOURCES)
            .where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.in(documentIds))
            .orderBy(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID,
                DOCUMENT_PROPERTY_SOURCES.KEY_POSITION, DOCUMENT_PROPERTY_SOURCES.POSITION)
            .fetch().forEach(row -> {
                    addProperty(documents.get(row.get(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID)),
                        row.get(DOCUMENT_PROPERTY_SOURCES.KEY), row.get(DOCUMENT_PROPERTY_SOURCES.SOURCE),
                        row.get(DOCUMENT_PROPERTY_SOURCES.TIER), row.get(DOCUMENT_PROPERTY_SOURCES.VALUE),
                        row.get(DOCUMENT_PROPERTY_SOURCES.OBSERVED_AT),
                        row.get(DOCUMENT_PROPERTY_SOURCES.SET_BY));
                });
        Map<String, Map<String, Object>> iterations = new LinkedHashMap<>();
        dsl.selectFrom(ITERATIONS).where(ITERATIONS.DOCUMENT_ID.in(documentIds))
            .orderBy(ITERATIONS.DOCUMENT_ID, ITERATIONS.ATTEMPT).fetch().forEach(row -> {
                Map<String, Object> restriction = row.getRestrictionRule() == null ? null : map(
                    "rule", row.getRestrictionRule(), "publicText", row.getRestrictionPublicText(),
                    "internalText", row.getRestrictionInternalText(),
                    "foundAt", time(row.getRestrictionFoundAt()));
                Map<String, Object> override = row.getOverrideNote() == null ? null : map(
                    "actorId", row.getOverrideActorId(), "at", time(row.getOverrideAt()),
                    "note", row.getOverrideNote());
                Map<String, Object> cancellation = row.getCancellationCause() == null ? null : map(
                    "cause", row.getCancellationCause(), "actorId", row.getCancellationActorId(),
                    "at", time(row.getCancellationAt()), "publicText", row.getCancellationPublicText(),
                    "internalText", row.getCancellationInternalText());
                Map<String, Object> failure = row.getIngestFailureAttempts() == null ? null : map(
                    "attempts", row.getIngestFailureAttempts(), "error", row.getIngestFailureError());
                Map<String, Object> item = map("id", row.getId(), "documentId", row.getDocumentId(),
                    "attempt", row.getAttempt(), "requestId", row.getRequestId(),
                    "categoryId", row.getCategoryId(), "priority", row.getPriority(),
                    "projectId", row.getProjectId(), "progress", row.getProgress(),
                    "listId", row.getListId(), "formerListName", row.getFormerListName(),
                    "restriction", restriction, "restrictionOverride", override, "cancellation", cancellation,
                    "defects", new ArrayList<>(), "verdicts", new ArrayList<>(), "ingestFailure", failure,
                    "digitizedAt", time(row.getDigitizedAt()), "links", new ArrayList<>(),
                    "scanDpi", row.getScanDpi(), "properties", new ArrayList<>());
                iterations.put(row.getId(), item);
                add(documents.get(row.getDocumentId()), "iterations", item);
            });
        dsl.selectFrom(ITERATION_DEFECTS).where(ITERATION_DEFECTS.ITERATION_ID.in(iterations.keySet()))
            .orderBy(ITERATION_DEFECTS.ITERATION_ID, ITERATION_DEFECTS.POSITION)
            .fetch().forEach(row -> {
                add(iterations.get(row.getIterationId()), "defects", map("key", row.getKey(),
                    "instanceId", row.getInstanceId(), "ruleCode", row.getRuleCode(),
                    "subject", row.getSubject(),
                    "publicText", row.getPublicText(), "internalText", row.getInternalText(),
                    "firstSeenAt", time(row.getFirstSeenAt())));
            });
        dsl.selectFrom(ITERATION_VERDICTS).where(ITERATION_VERDICTS.ITERATION_ID.in(iterations.keySet()))
            .orderBy(ITERATION_VERDICTS.ITERATION_ID, ITERATION_VERDICTS.POSITION)
            .fetch().forEach(row -> {
                add(iterations.get(row.getIterationId()), "verdicts",
                    map("defectKeys", List.of(row.getDefectKeys()),
                    "verdict", row.getVerdict(), "actorId", row.getActorId(), "at", time(row.getAt()),
                    "note", row.getNote(), "publicText", row.getPublicText()));
            });
        dsl.selectFrom(ITERATION_LINKS).where(ITERATION_LINKS.ITERATION_ID.in(iterations.keySet()))
            .orderBy(ITERATION_LINKS.ITERATION_ID, ITERATION_LINKS.POSITION).fetch().forEach(row -> {
                add(iterations.get(row.getIterationId()), "links", map("id", row.getId(), "url", row.getUrl(),
                    "instanceId", row.getInstanceId(), "setBy", row.getSetBy(), "setAt", time(row.getSetAt()),
                    "isPrimary", row.getIsPrimary()));
            });
        dsl.selectFrom(ITERATION_PROPERTY_SOURCES)
            .where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.in(iterations.keySet()))
            .orderBy(ITERATION_PROPERTY_SOURCES.ITERATION_ID,
                ITERATION_PROPERTY_SOURCES.KEY_POSITION, ITERATION_PROPERTY_SOURCES.POSITION)
            .fetch().forEach(row -> {
                    addProperty(iterations.get(row.get(ITERATION_PROPERTY_SOURCES.ITERATION_ID)),
                        row.get(ITERATION_PROPERTY_SOURCES.KEY), row.get(ITERATION_PROPERTY_SOURCES.SOURCE),
                        row.get(ITERATION_PROPERTY_SOURCES.TIER), row.get(ITERATION_PROPERTY_SOURCES.VALUE),
                        row.get(ITERATION_PROPERTY_SOURCES.OBSERVED_AT),
                        row.get(ITERATION_PROPERTY_SOURCES.SET_BY));
                });
        Map<String, Map<String, Object>> requests = new LinkedHashMap<>();
        Condition requestCondition = REQUESTS.DOCUMENT_ID.in(documentIds);
        if (requestIds != null) {
            requestCondition = requestCondition.and(REQUESTS.ID.in(requestIds));
        }
        dsl.selectFrom(REQUESTS).where(requestCondition)
            .orderBy(REQUESTS.DOCUMENT_ID, REQUESTS.AT, REQUESTS.ID).fetch().forEach(row -> {
                Map<String, Object> base = map("id", row.getId(), "documentId", row.getDocumentId(),
                    "requesterId", row.getRequesterId(), "at", time(row.getAt()), "reason", row.getReason(),
                    "batchId", row.getBatchId(), "projectId", row.getProjectId(),
                    "existingCopies", new ArrayList<>(),
                    "checkedAt", time(row.getCheckedAt()), "decision", row.getDecision());
                switch (row.getDecision()) {
                    case "Pending" -> base.put("isAfterProjectApproval", row.getIsAfterProjectApproval());
                    case "Approved" -> {
                        base.put("iteration", row.getIterationRelation() == null ? null : map(
                            "relation", row.getIterationRelation(), "id", row.getIterationId()));
                        base.put("rescan", row.getRescanNote() == null ? null
                            : map("actorId", row.getRescanActorId(),
                            "at", time(row.getRescanAt()), "note", row.getRescanNote()));
                    }
                    case "Denied" -> base.put("decline", map("actorId", row.getDeclineActorId(),
                        "at", time(row.getDeclineAt()), "publicText", row.getDeclinePublicText(),
                        "internalText", row.getDeclineInternalText()));
                    case "Withdrawn" -> base.put("withdrawnAt", time(row.getWithdrawnAt()));
                    case "Duplicate" -> base.put("tracksIterationId", row.getTracksIterationId());
                    default -> throw new IllegalStateException("Unknown request decision");
                }
                requests.put(row.getId(), base);
                add(documents.get(row.getDocumentId()), "requests", base);
            });
        if (!requests.isEmpty()) {
            dsl.selectFrom(REQUEST_EXISTING_COPIES)
                .where(REQUEST_EXISTING_COPIES.REQUEST_ID.in(requests.keySet()))
                .orderBy(REQUEST_EXISTING_COPIES.REQUEST_ID, REQUEST_EXISTING_COPIES.POSITION)
                .fetch().forEach(row -> {
                add(requests.get(row.getRequestId()), "existingCopies", map("source", row.getSource(),
                    "state", row.getState(), "link", row.getLink(), "iterationId", row.getIterationId(),
                    "seenAt", time(row.getSeenAt()), "foundAfterApproval", row.getFoundAfterApproval()));
            });
        }
        Map<String, Map<String, Object>> records = new LinkedHashMap<>();
        documents.forEach((id, document) -> records.put(id, map("document", document,
            "iterations", document.remove("iterations"), "requests", document.remove("requests"))));
        return records;
    }

    private static Map<String, Object> map(Object... entries) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < entries.length; i += 2) {
            result.put((String) entries[i], entries[i + 1]);
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private static void add(Map<String, Object> owner, String key, Object value) {
        ((List<Object>) owner.get(key)).add(value);
    }

    private String time(OffsetDateTime value) {
        return value == null ? null : Instants.format(value.toInstant());
    }

    @SuppressWarnings("unchecked")
    private void addProperty(Map<String, Object> owner, String key, JSONB source,
            Integer tier, JSONB value, OffsetDateTime observedAt, String setBy) {
        List<Map<String, Object>> properties = (List<Map<String, Object>>) owner.get("properties");
        Map<String, Object> property = properties.stream()
            .filter(candidate -> candidate.get("key").equals(key))
            .findFirst().orElseGet(() -> {
                Map<String, Object> created = map("key", key, "sources", new ArrayList<>());
                properties.add(created);
                return created;
            });
        add(property, "sources", map("source", json.read(source), "tier", tier, "value", json.read(value),
            "observedAt", time(observedAt), "setBy", setBy));
    }
}
