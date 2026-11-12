package cz.mzk.vera.proposals;

import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR;
import static cz.mzk.vera.db.tables.Tables.CATALOG_MIRROR_KEYS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;

import cz.mzk.vera.documents.DocumentCodes;
import cz.mzk.vera.documents.DocumentRecords;
import cz.mzk.vera.documents.DocumentStates;
import cz.mzk.vera.domain.documents.Documents;
import cz.mzk.vera.domain.entities.Decision;
import cz.mzk.vera.domain.entities.DocumentRecord;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.Request;
import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.domain.status.Status;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.HeldAccessQueries.HeldAccess;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// DOC-identifiers; ACT-propose: port resolve, heldCatalogRecords and checkItem.
@Repository
public class ProposalCheck {
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final DocumentRecords documentRecords;
    private final DocumentStates documentStates;
    private final JsonMapper mapper;
    private final ProposalPluginRuns pluginRuns;
    public ProposalCheck(DSLContext dsl, HeldAccessQueries access, DocumentRecords documentRecords,
            DocumentStates documentStates, JsonMapper mapper, ProposalPluginRuns pluginRuns) {
        this.dsl = dsl;
        this.access = access;
        this.documentRecords = documentRecords;
        this.documentStates = documentStates;
        this.mapper = mapper;
        this.pluginRuns = pluginRuns;
    }

    public Map<String, Object> checkItem(Map<String, Object> item, String userId) {
        return checkItem(item, userId, true);
    }

    public Map<String, Object> checkItem(Map<String, Object> item, String userId, boolean includePreview) {
        return checkItem(item, userId, includePreview, null);
    }

    public List<Map<String, Object>> lookupItems(List<Map<String, Object>> items, String userId) {
        long deadline = pluginRuns.previewDeadline();
        List<Map<String, Object>> results = new ArrayList<>();
        List<ProposalPluginRuns.PreviewRequest> previews = new ArrayList<>();
        List<Integer> resultIndexes = new ArrayList<>();
        for (Map<String, Object> item : items) {
            String[] type = {null};
            Map<String, Object> result = checkItem(item, userId, false, type);
            results.add(result);
            String kind = (String) result.get("kind");
            if ("new".equals(kind) || "inVera".equals(kind)) {
                previews.add(new ProposalPluginRuns.PreviewRequest((String) result.get("catalogId"),
                        (String) result.get("unit"), (String) result.get("title"), type[0],
                        (String) result.get("documentId")));
                resultIndexes.add(results.size() - 1);
            }
        }
        List<Map<String, Object>> answers = pluginRuns.previewBatch(previews, isStaff(userId), deadline);
        for (int index = 0; index < answers.size(); index++) {
            results.get(resultIndexes.get(index)).put("preview", answers.get(index));
        }
        return results;
    }

    private Map<String, Object> checkItem(Map<String, Object> item, String userId, boolean includePreview,
            String[] previewType) {
        String type = (String) item.get("type");
        String value = (String) item.get("value");
        String kind = switch (type) {
            case "catalogId" -> null;
            case "barcode" -> "barcode";
            case "shelfMark" -> "shelfMark";
            default -> "identifier";
        };
        String normalized = switch (type) {
            case "catalogId" -> value.toUpperCase(Locale.ROOT);
            case "nbn", "isbn", "issn" -> value.replace("-", "").toLowerCase(Locale.ROOT);
            case "shelfMark" -> value.trim().toUpperCase(Locale.ROOT);
            default -> value;
        };
        List<Map<String, Object>> catalogRecords = new ArrayList<>();
        List<Map<String, Object>> heldRecords = heldCatalogRecords();
        if (kind == null) {
            dsl.select(CATALOG_MIRROR.RECORD).from(CATALOG_MIRROR)
                    .where(CATALOG_MIRROR.CATALOG_ID.eq(value.toUpperCase(Locale.ROOT)))
                    .orderBy(CATALOG_MIRROR.POSITION).fetch().forEach(row ->
                            catalogRecords.add(record(mapper.readTree(row.get(CATALOG_MIRROR.RECORD).data()))));
        } else {
            dsl.select(CATALOG_MIRROR.RECORD).from(CATALOG_MIRROR)
                    .join(CATALOG_MIRROR_KEYS).on(CATALOG_MIRROR_KEYS.INSTANCE_ID.eq(CATALOG_MIRROR.INSTANCE_ID)
                            .and(CATALOG_MIRROR_KEYS.CATALOG_ID.eq(CATALOG_MIRROR.CATALOG_ID)))
                    .where(CATALOG_MIRROR_KEYS.KIND.eq(kind))
                    .and(CATALOG_MIRROR_KEYS.NORMALIZED.eq(normalized))
                    .orderBy(CATALOG_MIRROR.POSITION).fetch().forEach(row ->
                            catalogRecords.add(record(mapper.readTree(row.get(CATALOG_MIRROR.RECORD).data()))));
        }
        heldRecords.stream().filter(record -> switch (type) {
            case "catalogId" -> ((String) record.get("catalogId")).equals(value.toUpperCase(Locale.ROOT));
            case "barcode" -> ((Map<?, ?>) record.get("barcodes")).containsKey(value);
            case "shelfMark" -> ((Map<?, ?>) record.get("shelfMarks")).keySet().stream()
                    .anyMatch(mark -> mark.toString().trim().equalsIgnoreCase(value.trim()));
            default -> false;
        }).forEach(catalogRecords::add);
        List<Map<String, Object>> unique = catalogRecords.stream().collect(Collectors.toMap(
                row -> (String) row.get("catalogId"), row -> row, (first, ignored) -> first,
                LinkedHashMap::new)).values().stream().toList();
        if (unique.isEmpty()) {
            return Map.of("kind", "notInCatalog");
        }
        if (unique.size() > 1) {
            return Map.of("kind", "whichRecord", "records", unique.stream().map(row -> Map.of(
                    "catalogId", row.get("catalogId"), "title", row.get("title"))).toList());
        }
        Map<String, Object> record = unique.getFirst();
        if (previewType != null) {
            previewType[0] = (String) record.get("type");
        }
        String catalogId = (String) record.get("catalogId");
        String requestedUnit = item.get("unit") == null ? null : (String) item.get("unit");
        String unit = requestedUnit;
        if ("barcode".equals(kind) || "shelfMark".equals(kind)) {
            List<Map<String, Object>> keyRows = dsl.select(CATALOG_MIRROR_KEYS.UNIT)
                    .from(CATALOG_MIRROR_KEYS).where(CATALOG_MIRROR_KEYS.CATALOG_ID.eq(catalogId))
                    .and(CATALOG_MIRROR_KEYS.KIND.eq(kind))
                    .and(CATALOG_MIRROR_KEYS.NORMALIZED.eq(normalized)).fetch(row -> Map.of(
                            "unit", row.get(CATALOG_MIRROR_KEYS.UNIT) == null ? "" : row.get(CATALOG_MIRROR_KEYS.UNIT)));
            if ("barcode".equals(kind) && !keyRows.isEmpty()) {
                String mappedUnit = (String) keyRows.getFirst().get("unit");
                unit = "".equals(mappedUnit) ? null : mappedUnit;
            } else if (unit == null && !keyRows.isEmpty() && !"".equals(keyRows.getFirst().get("unit"))) {
                unit = (String) keyRows.getFirst().get("unit");
            }
        }
        Object unitsValue = record.get("units");
        List<String> units = unitsValue instanceof List<?> values
                ? values.stream().map(String.class::cast).toList() : null;
        boolean barcodeUnitNamed = "barcode".equals(kind);
        boolean shelfMarkUnitNamed = "shelfMark".equals(kind) && unit != null;
        if (!barcodeUnitNamed && !shelfMarkUnitNamed) {
            if (units == null) {
                unit = null;
            } else if (requestedUnit != null && units.contains(requestedUnit)) {
                unit = requestedUnit;
            } else if (requestedUnit == null && units.size() == 1) {
                unit = units.getFirst();
            } else {
                return Map.of("kind", "whichUnit", "catalogId", catalogId,
                        "title", record.get("title"), "units", units);
            }
        }
        String title = (String) record.get("title");
        String displayTitle = unit == null ? title : title + " · " + unit;
        var docs = dsl.select(DOCUMENTS.ID, DOCUMENTS.TITLE)
                .from(DOCUMENTS)
                .where(DOCUMENTS.CATALOG_ID.eq(catalogId))
                .and(unit == null ? DOCUMENTS.UNIT_VALUE.isNull() : DOCUMENTS.UNIT_VALUE.eq(unit))
                .fetch();
        if (docs.isEmpty()) {
            Map<String, Object> result = fields("kind", "new", "catalogId", catalogId, "unit", unit,
                    "title", displayTitle, "isAskedBefore", false);
            if (includePreview) {
                result.put("preview", pluginRuns.preview(catalogId, unit, displayTitle,
                        (String) record.get("type"), isStaff(userId), null));
            }
            return result;
        }
        String documentId = docs.getFirst().get(DOCUMENTS.ID);
        Map<String, Object> heldRecord = documentRecords.recordsOf(List.of(documentId)).get(documentId);
        Map<?, ?> heldDocument = (Map<?, ?>) heldRecord.get("document");
        documentId = (String) heldDocument.get("id");
        DocumentRecord domainRecord = documentStates.recordOf(dsl, documentId);
        Iteration current = Documents.currentIterationOf(domainRecord);
        boolean live = isLive(domainRecord);
        boolean askedBy = isAskedBy(domainRecord, userId);
        if (askedBy) {
            return fields("kind", "mine", "catalogId", catalogId, "unit", unit, "title", displayTitle,
                    "documentId", documentId);
        }
        if (!live) {
            Map<String, Object> result = fields("kind", "new", "catalogId", catalogId, "unit", unit,
                    "title", displayTitle, "isAskedBefore", !domainRecord.requests().isEmpty());
            if (includePreview) {
                result.put("preview", pluginRuns.preview(catalogId, unit, displayTitle,
                        (String) record.get("type"), isStaff(userId), documentId));
            }
            return result;
        }
        String status;
        HeldAccess held = access.heldBy(userId);
        boolean staff = Permissions.hasPermission(held.grants(), DocumentCodes.ITERATION_READ);
        if (staff) {
            Status.DisplayStatus recordStatus = Documents.recordStatusOf(domainRecord);
            status = recordStatus == null ? "AwaitingReview" : recordStatus.name();
        } else if (current == null) {
            status = Status.PublicStatus.WaitingForReview.name();
        } else {
            status = Status.publicIterationStatusOf(current).name();
        }
        Map<String, Object> result = fields("kind", "inVera", "catalogId", catalogId, "unit", unit,
                "title", displayTitle, "documentId", documentId, "status", status);
        if (includePreview) {
            result.put("preview", pluginRuns.preview(catalogId, unit, displayTitle,
                    (String) record.get("type"), isStaff(userId), documentId));
        }
        return result;
    }

    private boolean isStaff(String userId) {
        return Permissions.hasPermission(access.heldBy(userId).grants(), DocumentCodes.ITERATION_READ);
    }

    private boolean isLive(DocumentRecord record) {
        return isAttemptMoving(record)
                || record.requests().stream().anyMatch(request -> request.decision() == Decision.Pending);
    }

    private boolean isAttemptMoving(DocumentRecord record) {
        Iteration current = Documents.currentIterationOf(record);
        return current != null && !Documents.isAttemptOver(current);
    }

    private boolean isAskedBy(DocumentRecord record, String userId) {
        Iteration current = Documents.currentIterationOf(record);
        return Documents.requestsBy(record, userId).stream().anyMatch(request -> isStillAsked(request, current));
    }

    private boolean isStillAsked(Request request, Iteration current) {
        if (request.decision() == Decision.Pending) {
            return true;
        }
        if (request.decision() != Decision.Approved && request.decision() != Decision.Duplicate) {
            return false;
        }
        String followedId = Documents.followedIterationId(request);
        return followedId == null || (current != null && followedId.equals(current.id())
                && !Documents.isAttemptOver(current));
    }

    private List<Map<String, Object>> heldCatalogRecords() {
        Map<String, List<Map<String, Object>>> byCatalog = new LinkedHashMap<>();
        dsl.selectFrom(DOCUMENTS).orderBy(DOCUMENTS.POSITION).fetch().forEach(row -> {
            Map<String, Object> document = new LinkedHashMap<>();
            document.put("catalogId", row.getCatalogId());
            document.put("title", row.getTitle());
            document.put("type", row.getType());
            document.put("shelfMark", row.getShelfMark());
            document.put("unit", row.getUnitValue());
            document.put("unitType", row.getUnitType());
            byCatalog.computeIfAbsent(row.getCatalogId(), ignored -> new ArrayList<>()).add(document);
        });
        List<Map<String, Object>> records = new ArrayList<>();
        byCatalog.forEach((catalogId, documents) -> {
            Map<String, Object> record = new LinkedHashMap<>();
            record.put("catalogId", catalogId);
            record.put("title", documents.getFirst().get("title"));
            record.put("type", documents.getFirst().get("type"));
            List<String> units = documents.stream().map(row -> (String) row.get("unit"))
                    .filter(Objects::nonNull).toList();
            record.put("units", units.isEmpty() ? null : units);
            record.put("identifiers", List.of());
            Map<String, String> barcodes = new LinkedHashMap<>();
            Map<String, String> shelfMarks = new LinkedHashMap<>();
            documents.forEach(row -> {
                if ("barcode".equals(row.get("unitType"))) {
                    barcodes.put((String) row.get("unit"), (String) row.get("unit"));
                }
                String shelfMark = (String) row.get("shelfMark");
                if (shelfMark != null) {
                    String unit = (String) row.get("unit");
                    shelfMarks.put(shelfMark, shelfMarks.containsKey(shelfMark) ? null : unit);
                }
            });
            record.put("barcodes", barcodes);
            record.put("shelfMarks", shelfMarks);
            records.add(record);
        });
        return records;
    }

    private Map<String, Object> record(JsonNode node) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("catalogId", node.path("catalogId").asString());
        result.put("title", node.path("title").asString());
        result.put("type", node.path("type").asString());
        List<String> units = new ArrayList<>();
        if (node.path("units").isArray()) {
            node.path("units").forEach(value -> units.add(value.asString()));
        }
        result.put("units", node.path("units").isNull() ? null : units);
        List<String> identifiers = new ArrayList<>();
        node.path("identifiers").forEach(value -> identifiers.add(value.asString()));
        result.put("identifiers", identifiers);
        Map<String, String> barcodes = new LinkedHashMap<>();
        node.path("barcodes").properties().forEach(entry -> barcodes.put(entry.getKey(),
                entry.getValue().isNull() ? null : entry.getValue().asString()));
        result.put("barcodes", barcodes);
        Map<String, String> shelfMarks = new LinkedHashMap<>();
        node.path("shelfMarks").properties().forEach(entry -> shelfMarks.put(entry.getKey(),
                entry.getValue().isNull() ? null : entry.getValue().asString()));
        result.put("shelfMarks", shelfMarks);
        return result;
    }

    private Map<String, Object> fields(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < values.length; index += 2) {
            result.put((String) values[index], values[index + 1]);
        }
        return result;
    }
}
