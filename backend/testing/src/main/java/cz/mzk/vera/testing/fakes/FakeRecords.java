package cz.mzk.vera.testing.fakes;

import cz.mzk.vera.events.Outbox;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.MissingNode;

// BK3d, BK7b; PLG-api-call; fakes.md Catalog adapter, Input, Custody, Classifier, Harvester,
// Publication detector, Message and Delivery channel.
@Component
@Profile("test")
public class FakeRecords {
    private final Outbox outbox;
    private final JsonMapper json;
    private volatile List<JsonNode> catalogRecords = List.of();
    private volatile Map<String, String> catalogReplacements = Map.of();
    private volatile List<String> catalogDrops = List.of();
    private volatile Map<String, String> catalogHosts = Map.of();
    private volatile JsonNode photo = MissingNode.getInstance();
    private volatile Map<String, List<String>> placements = Map.of();
    private volatile List<JsonNode> custodyRules = List.of();
    private volatile Map<String, JsonNode> materialLeaves = Map.of();
    private volatile List<String> moravianPlaces = List.of();
    private volatile Map<String, JsonNode> categories = Map.of();
    private volatile Map<String, String> advisorReasons = Map.of();
    private volatile Map<String, JsonNode> ingestFaults = Map.of();
    private volatile Map<String, JsonNode> harvests = Map.of();
    private volatile Map<String, Integer> failedCatalogPages = Map.of();
    private volatile Map<String, String> deliveryFaults = Map.of();
    private volatile List<String> rejectedRecipients = List.of();
    private volatile List<String> unreachableHosts = List.of();
    private volatile Map<String, String> slackHandles = Map.of();
    private volatile String slackWorkspace = "mzk";
    private volatile String linkBase = "";
    private final AtomicInteger barcodeCount = new AtomicInteger();

    public FakeRecords(Outbox outbox, JsonMapper json) {
        this.outbox = outbox;
        this.json = json;
    }

    public synchronized void reset(JsonNode seed) {
        JsonNode fakes = seed.path("fakes");
        catalogRecords = copies(fakes.path("catalogRecords"));
        Map<String, String> replacements = new HashMap<>();
        fakes.path("catalogReplacements").properties().forEach(entry ->
                replacements.put(entry.getKey(), entry.getValue().asString()));
        catalogReplacements = Map.copyOf(replacements);
        catalogDrops = strings(fakes.path("catalogDrops"));
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
        Map<String, JsonNode> harvestPages = new HashMap<>();
        fakes.path("harvests").properties().forEach(entry -> harvestPages.put(entry.getKey(), entry.getValue().deepCopy()));
        harvests = Map.copyOf(harvestPages);
        failedCatalogPages = Map.of();
        JsonNode channelFault = seed.path("faults").path("deliveryChannel");
        Map<String, String> unavailable = new HashMap<>();
        for (JsonNode instance : channelFault.path("unavailableInstances")) {
            unavailable.put(instance.asString(), "unavailable");
        }
        deliveryFaults = Map.copyOf(unavailable);
        rejectedRecipients = strings(channelFault.path("rejectedRecipients"));
        unreachableHosts = strings(channelFault.path("unreachableHosts"));
        Map<String, String> handles = new HashMap<>();
        fakes.path("slackHandles").properties().forEach(entry -> handles.put(entry.getKey(), entry.getValue().asString()));
        slackHandles = Map.copyOf(handles);
        slackWorkspace = fakes.path("slackWorkspace").asString("mzk");
        Map<String, String> implementationNames = new HashMap<>();
        for (JsonNode implementation : seed.path("collections").path("pluginImplementations")) {
            implementationNames.put(implementation.path("id").asString(),
                    implementation.path("name").asString());
        }
        String nextLinkBase = "";
        for (JsonNode instance : seed.path("collections").path("pluginInstances")) {
            if (instance.path("isEnabled").asBoolean()
                    && "KrameriusLink".equals(implementationNames.get(instance.path("implementationId").asString()))) {
                nextLinkBase = instance.path("configuration").path("base_url").asString("")
                        .replaceAll("/+$", "");
                break;
            }
        }
        linkBase = nextLinkBase;
        barcodeCount.set(0);
    }

    public Map<String, List<String>> answer(String operation, Map<String, List<String>> input) {
        return switch (operation) {
            case "read" -> read(first(input, "catalogId"), catalogHosts.get(first(input, "catalogHost")));
            case "readLink" -> readLink(first(input, "pasted"), catalogHosts.get(first(input, "catalogHost")));
            case "search" -> search(first(input, "query"), catalogHosts.get(first(input, "catalogHost")));
            case "sync", "changes" -> catalogPage(operation, first(input, "instanceId"),
                    first(input, "cursor"), first(input, "catalogHost"));
            case "readBarcode" -> readBarcode(first(input, "photo"));
            case "readPhoto" -> readPhoto();
            case "place" -> place(input);
            case "suggest" -> suggest(input);
            case "advisorReasons" -> advisorReason(first(input, "iterationId"));
            case "listGeneratorFault" -> listGeneratorFault(first(input, "instanceId"));
            case "harvest" -> harvest(first(input, "instanceId"), first(input, "cursor"));
            case "deliverySend", "deliveryTest" -> delivery(operation, input);
            case "message" -> message(input);
            case "detectPublications" -> detectPublications(input);
            default -> new LinkedHashMap<>();
        };
    }

    public boolean isCatalogHost(String host) {
        return catalogHosts.containsKey(host);
    }

    public synchronized void failCatalogPage(String instanceId, int page) {
        Map<String, Integer> next = new HashMap<>(failedCatalogPages);
        next.put(instanceId, page);
        failedCatalogPages = Map.copyOf(next);
    }

    public synchronized void clearCatalogFailure(String instanceId) {
        Map<String, Integer> next = new HashMap<>(failedCatalogPages);
        next.remove(instanceId);
        failedCatalogPages = Map.copyOf(next);
    }

    private Map<String, List<String>> catalogPage(String operation, String instanceId, String cursor, String host) {
        int page = cursor == null || cursor.isEmpty() ? 0 : Integer.parseInt(cursor);
        if (failedCatalogPages.getOrDefault(instanceId, -1) == page) {
            return response("httpStatus", "503");
        }
        String base = catalogHosts.get(host);
        List<JsonNode> records = catalogRecords.stream()
                .filter(record -> record.path("catalogId").asString().startsWith(base == null ? "" : base))
                .toList();
        int start = page * 2;
        int end = Math.min(start + 2, records.size());
        Map<String, List<String>> result = new LinkedHashMap<>();
        catalogReplacements.forEach((oldId, newId) -> {
            if (oldId.startsWith(base == null ? "" : base)) {
                add(result, "replaced", oldId + "\u001f" + newId);
            }
        });
        if ("sync".equals(operation)) {
            catalogDrops.forEach(id -> add(result, "drop", id));
        }
        for (int index = start; index < end; index++) {
            JsonNode record = records.get(index);
            add(result, "catalogId", record.path("catalogId").asString());
            add(result, "title", record.path("title").asString());
            add(result, "type", record.path("type").asString());
            add(result, "units", String.join("\u001f", strings(record.path("units"))));
            add(result, "identifiers", String.join("\u001f", strings(record.path("identifiers"))));
        }
        if (end < records.size()) {
            add(result, "nextCursor", Integer.toString(page + 1));
        } else {
            add(result, "nextCursor", "");
        }
        add(result, "hasMore", Boolean.toString(end < records.size()));
        return result;
    }

    private Map<String, List<String>> harvest(String instanceId, String cursor) {
        JsonNode pages = harvests.get(instanceId);
        int page = cursor == null || cursor.isEmpty() ? 0 : Integer.parseInt(cursor);
        JsonNode values = pages == null ? MissingNode.getInstance() : pages.path(page);
        Map<String, List<String>> result = new LinkedHashMap<>();
        if (values.isArray()) {
            for (JsonNode item : values) {
                add(result, "kind", item.path("kind").asString());
                add(result, "catalogId", item.path("catalogId").asString());
                add(result, "type", item.path("type").asString());
                add(result, "value", item.path("value").asString());
            }
        }
        if (pages != null && page + 1 < pages.size()) {
            add(result, "nextCursor", Integer.toString(page + 1));
        } else {
            add(result, "nextCursor", "");
        }
        return result;
    }

    private Map<String, List<String>> delivery(String operation, Map<String, List<String>> input) {
        String instanceId = first(input, "instanceId");
        String recipient = first(input, "recipient");
        if ("unavailable".equals(deliveryFaults.get(instanceId))) {
            return deliveryFailure("Delivery channel unavailable.");
        }
        if (rejectedRecipients.contains(recipient)) {
            return response("fault", "recipient_rejected");
        }
        {
            for (String host : unreachableHosts) {
                if (recipient.contains(host)) {
                    return deliveryFailure("connect ETIMEDOUT " + host + ":443");
                }
            }
        }
        String channel = first(input, "channel");
        JsonNode payload = json.readTree("deliveryTest".equals(operation)
                ? "{}" : first(input, "payload"));
        outbox.send(channel, recipient, payload);
        return new LinkedHashMap<>();
    }

    private Map<String, List<String>> message(Map<String, List<String>> input) {
        String kind = first(input, "kind");
        List<String> recipients = input.getOrDefault("recipient", List.of());
        String subject = first(input, "subject");
        String text = first(input, "text");
        if ("slackBot".equals(kind)) {
            JsonNode payload = json.createObjectNode().put("subject", subject).put("text", text);
            outbox.send("chat", String.join(",", recipients), payload);
            return response("sent", "true");
        }
        String address;
        if ("mailto".equals(kind)) {
            address = "mailto:" + String.join(",", recipients) + "?subject="
                    + java.net.URLEncoder.encode(subject == null ? "" : subject, java.nio.charset.StandardCharsets.UTF_8)
                    + "&body=" + java.net.URLEncoder.encode(text == null ? "" : text,
                            java.nio.charset.StandardCharsets.UTF_8);
        } else {
            List<String> handles = recipients.stream().map(id -> slackHandles.getOrDefault(id, id)).toList();
            address = "https://slack.com/app_redirect?team="
                    + java.net.URLEncoder.encode(slackWorkspace, java.nio.charset.StandardCharsets.UTF_8)
                    + "&users=" + java.net.URLEncoder.encode(String.join(",", handles),
                            java.nio.charset.StandardCharsets.UTF_8)
                    + "&text=" + java.net.URLEncoder.encode(text == null ? "" : text,
                            java.nio.charset.StandardCharsets.UTF_8);
        }
        return response("address", address);
    }

    private Map<String, List<String>> detectPublications(Map<String, List<String>> input) {
        Map<String, List<String>> result = new LinkedHashMap<>();
        List<String> ids = input.getOrDefault("iterationId", List.of());
        List<String> progress = input.getOrDefault("progress", List.of());
        List<String> heldIds = input.getOrDefault("heldLinkId", List.of());
        List<String> heldLinks = input.getOrDefault("heldLink", List.of());
        for (int i = 0; i < ids.size(); i++) {
            if (!("Digitized".equals(progress.get(i)) || "Published".equals(progress.get(i)))) {
                continue;
            }
            StringBuilder hex = new StringBuilder();
            for (char character : ids.get(i).toCharArray()) {
                hex.append(Integer.toHexString(character));
            }
            String suffix = ("000000000000" + hex).substring(Math.max(0, hex.length()));
            if (suffix.length() > 12) {
                suffix = suffix.substring(suffix.length() - 12);
            }
            String url = linkBase + "/uuid/uuid:00000000-0000-4000-8000-" + suffix;
            boolean held = false;
            for (int link = 0; link < heldLinks.size(); link++) {
                if (ids.get(i).equals(heldIds.get(link)) && url.equals(heldLinks.get(link))) {
                    held = true;
                    break;
                }
            }
            if (!linkBase.isEmpty() && !held) {
                add(result, "iterationId", ids.get(i));
                add(result, "url", url);
            }
        }
        return result;
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
                            || rule.path("projectId").asString().equals(first(input, "projectId")))
                    && (rule.path("catalogId").isMissingNode()
                            || rule.path("catalogId").asString().equals(first(input, "catalogId"))))
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

    private Map<String, List<String>> deliveryFailure(String detail) {
        Map<String, List<String>> result = new LinkedHashMap<>();
        result.put("fault", List.of("unavailable"));
        result.put("detail", List.of(detail));
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
