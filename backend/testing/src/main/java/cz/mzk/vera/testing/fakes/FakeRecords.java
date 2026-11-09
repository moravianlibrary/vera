package cz.mzk.vera.testing.fakes;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.MissingNode;

// BK3d; PLG-api-call; fakes.md Catalog adapter, Input, Custody and Classifier.
@Component
@Profile("test")
public class FakeRecords {
    private volatile List<JsonNode> catalogRecords = List.of();
    private volatile Map<String, String> catalogHosts = Map.of();
    private volatile JsonNode photo = MissingNode.getInstance();
    private volatile Map<String, List<String>> placements = Map.of();
    private volatile List<JsonNode> custodyRules = List.of();
    private volatile Map<String, JsonNode> materialLeaves = Map.of();
    private volatile List<String> moravianPlaces = List.of();
    private volatile Map<String, JsonNode> categories = Map.of();
    private volatile Map<String, String> advisorReasons = Map.of();
    private volatile Map<String, JsonNode> ingestFaults = Map.of();
    private final AtomicInteger barcodeCount = new AtomicInteger();

    public synchronized void reset(JsonNode seed) {
        JsonNode fakes = seed.path("fakes");
        catalogRecords = copies(fakes.path("catalogRecords"));
        Map<String, String> hosts = new HashMap<>();
        fakes.path("catalogBases").properties().forEach(entry -> {
            String host = entry.getKey();
            String base = entry.getValue().path("base").asString();
            hosts.put(host, base);
        });
        catalogHosts = Map.copyOf(hosts);
        photo = fakes.path("photo").deepCopy();
        Map<String, List<String>> nextPlacements = new HashMap<>();
        fakes.path("custodyPlacements").properties().forEach(entry -> {
            nextPlacements.put(entry.getKey(), strings(entry.getValue()));
        });
        placements = Map.copyOf(nextPlacements);
        custodyRules = copies(fakes.path("custodyRules"));
        Map<String, JsonNode> nextMaterial = new HashMap<>();
        fakes.path("materialLeaves").properties().forEach(entry -> {
            nextMaterial.put(entry.getKey(), entry.getValue().deepCopy());
        });
        materialLeaves = Map.copyOf(nextMaterial);
        moravianPlaces = strings(fakes.path("moravianPlaces"));
        Map<String, JsonNode> nextCategories = new HashMap<>();
        for (JsonNode category : seed.path("collections").path("categories")) {
            nextCategories.put(category.path("id").asString(), category.deepCopy());
        }
        categories = Map.copyOf(nextCategories);
        Map<String, String> reasons = new HashMap<>();
        fakes.path("advisorReasons").properties().forEach(entry -> reasons.put(entry.getKey(), entry.getValue().asString()));
        advisorReasons = Map.copyOf(reasons);
        Map<String, JsonNode> faults = new HashMap<>();
        fakes.path("ingest").properties().forEach(entry -> faults.put(entry.getKey(),
                entry.getValue().path("faults").deepCopy()));
        ingestFaults = Map.copyOf(faults);
        barcodeCount.set(0);
    }

    public Map<String, List<String>> answer(String operation, Map<String, List<String>> input) {
        return switch (operation) {
            case "read" -> read(first(input, "catalogId"), catalogHosts.get(first(input, "catalogHost")));
            case "readLink" -> readLink(first(input, "pasted"), catalogHosts.get(first(input, "catalogHost")));
            case "search" -> search(first(input, "query"), catalogHosts.get(first(input, "catalogHost")));
            case "readBarcode" -> readBarcode(first(input, "photo"));
            case "readPhoto" -> readPhoto();
            case "place" -> place(input);
            case "suggest" -> suggest(input);
            case "advisorReasons" -> advisorReason(first(input, "iterationId"));
            case "listGeneratorFault" -> listGeneratorFault(first(input, "instanceId"));
            default -> new LinkedHashMap<>();
        };
    }

    public boolean isCatalogHost(String host) {
        return catalogHosts.containsKey(host);
    }

    private Map<String, List<String>> advisorReason(String iterationId) {
        String reason = advisorReasons.get(iterationId);
        return reason == null ? new LinkedHashMap<>() : response("why", reason);
    }

    private Map<String, List<String>> listGeneratorFault(String instanceId) {
        JsonNode faults = ingestFaults.get(instanceId);
        String fault = faults == null ? null : faults.path("listGenerator").asString(null);
        return fault == null ? new LinkedHashMap<>() : response("fault", fault);
    }

    private Map<String, List<String>> read(String catalogId, String base) {
        JsonNode record = catalogRecords.stream()
                .filter(item -> item.path("catalogId").asString().equals(catalogId)
                        && item.path("catalogId").asString().startsWith(base == null ? "" : base))
                .findFirst().orElse(null);
        if (record == null) {
            return response("refusal", "not_found");
        }
        Map<String, List<String>> result = response("catalogId", catalogId);
        add(result, "title", record.path("title").asString());
        addAll(result, "identifiers", strings(record.path("identifiers")));
        record.path("shelfMarks").properties().forEach(entry -> add(result, "shelfMark",
                entry.getKey() + "\u001f" + nullableText(entry.getValue())));
        record.path("barcodes").properties().forEach(entry -> add(result, "barcode",
                entry.getKey() + "\u001f" + nullableText(entry.getValue())));
        addAll(result, "units", strings(record.path("units")));
        add(result, "unitsNull", Boolean.toString(record.path("units").isNull()));
        add(result, "issuanceType", record.path("type").asString());
        return result;
    }

    private Map<String, List<String>> readLink(String pasted, String base) {
        if (base == null) {
            return response("refusal", "not_this_catalog");
        }
        String text = pasted == null ? "" : pasted.trim();
        String pattern = Pattern.quote(base);
        String whole = Pattern.compile(pattern + "\\d{2}-\\d{9}")
                .matcher(text).results().map(java.util.regex.MatchResult::group).findFirst().orElse(null);
        Matcher number = Pattern.compile("doc_number=(\\d{9})").matcher(text);
        String id = whole;
        if (id == null && number.find()) {
            Matcher library = Pattern
                    .compile("base=(" + pattern + "\\d{2})").matcher(text);
            String code = library.find() ? library.group(1) : base + "01";
            id = code + "-" + number.group(1);
        }
        return id == null ? response("refusal", "malformed") : response("catalogId", id);
    }

    private Map<String, List<String>> search(String query, String base) {
        String needle = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        Map<String, List<String>> result = new LinkedHashMap<>();
        for (JsonNode record : catalogRecords) {
            String id = record.path("catalogId").asString();
            if (!id.startsWith(base == null ? "" : base) || needle.isEmpty()) {
                continue;
            }
            if (record.path("title").asString().toLowerCase(Locale.ROOT).contains(needle)
                    || id.toLowerCase(Locale.ROOT).contains(needle)) {
                add(result, "catalogId", id);
                add(result, "title", record.path("title").asString());
                add(result, "hitUnits", String.join("\u001f", strings(record.path("units"))));
                add(result, "hitUnitsNull", Boolean.toString(record.path("units").isNull()));
            }
        }
        return result;
    }

    private Map<String, List<String>> readBarcode(String picture) {
        if (picture == null || picture.isEmpty()) {
            return response("valueNull", "true");
        }
        List<String> barcodes = catalogRecords.stream().flatMap(record -> record.path("barcodes").properties()
                .stream().map(Map.Entry::getKey)).toList();
        String barcode = barcodes.isEmpty() ? null : barcodes.get(barcodeCount.getAndIncrement() % barcodes.size());
        return barcode == null ? response("valueNull", "true") : response("value", barcode);
    }

    private Map<String, List<String>> readPhoto() {
        JsonNode sample = photo;
        Map<String, List<String>> result = response("seen", sample.path("seen").asString());
        if (sample.isMissingNode()) {
            return result;
        }
        for (JsonNode value : sample.path("read")) {
            add(result, "value", value.path("label").asString() + "\u001f"
                    + value.path("value").asString() + "\u001f" + value.path("confidence").asString());
        }
        addCandidate(result, sample.path("best").asString(), "title and author match");
        addCandidate(result, sample.path("near").asString(), "bound with it: the same shelf");
        return result;
    }

    private void addCandidate(Map<String, List<String>> result, String title, String why) {
        catalogRecords.stream().filter(record -> record.path("title").asString().equals(title)).findFirst()
                .ifPresent(record -> add(result, "candidate", record.path("catalogId").asString() + "\u001f"
                        + title + "\u001f" + why));
    }

    private Map<String, List<String>> place(Map<String, List<String>> input) {
        String base = first(input, "baseId");
        List<String> selected = placements.get(base);
        if (selected == null) {
            selected = custodyRules.stream().filter(rule ->
                    (rule.path("documentType").isMissingNode()
                            || rule.path("documentType").asString().equals(first(input, "documentType")))
                    && (rule.path("projectId").isMissingNode()
                            || rule.path("projectId").asString().equals(first(input, "projectId"))))
                    .map(rule -> rule.path("custodyId").asString()).toList();
        }
        return response("custody", selected);
    }

    private Map<String, List<String>> suggest(Map<String, List<String>> input) {
        String strategy = first(input, "strategy");
        String categoryId = null;
        String why = null;
        String type = first(input, "documentType");
        if ("PlaceOfPublication".equals(strategy) && "Periodical".equals(type)) {
            String title = first(input, "title").toLowerCase(Locale.forLanguageTag("cs"));
            if (moravianPlaces.stream().anyMatch(title::contains)) {
                categoryId = "c21";
                why = "Periodical, Moravian place of publication";
            }
        } else if ("MaterialType".equals(strategy)) {
            JsonNode material = materialLeaves.get(type);
            if (material != null) {
                categoryId = material.path("categoryId").asString();
                why = material.path("reason").asString();
            }
        }
        if (categoryId == null) {
            return response("empty", "true");
        }
        JsonNode category = categories.get(categoryId);
        if (category == null) {
            return response("empty", "true");
        }
        Map<String, List<String>> result = response("categoryId", categoryId);
        add(result, "categoryName", category.path("name").asString());
        add(result, "categoryParentId", category.path("parentId").isNull()
                ? "" : category.path("parentId").asString());
        add(result, "why", why);
        return result;
    }

    private List<JsonNode> copies(JsonNode values) {
        List<JsonNode> result = new ArrayList<>();
        for (JsonNode value : values) {
            result.add(value.deepCopy());
        }
        return List.copyOf(result);
    }

    private List<String> strings(JsonNode values) {
        if (values == null || !values.isArray()) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        for (JsonNode value : values) {
            result.add(value.asString());
        }
        return List.copyOf(result);
    }

    private String first(Map<String, List<String>> fields, String key) {
        List<String> values = fields.get(key);
        return values == null || values.isEmpty() ? null : values.getFirst();
    }

    private Map<String, List<String>> response(String key, String value) {
        Map<String, List<String>> result = new LinkedHashMap<>();
        add(result, key, value);
        return result;
    }

    private Map<String, List<String>> response(String key, List<String> values) {
        Map<String, List<String>> result = new LinkedHashMap<>();
        addAll(result, key, values);
        return result;
    }

    private void addAll(Map<String, List<String>> result, String key, List<String> values) {
        for (String value : values) {
            add(result, key, value);
        }
    }

    private void add(Map<String, List<String>> result, String key, String value) {
        result.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value);
    }

    private String nullableText(JsonNode value) {
        return value == null || value.isNull() ? "\u0000" : value.asString();
    }
}
