package cz.mzk.vera.plugins.kramerius_registry;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.PluginUnavailable;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.plugin.registry.LookupAnswer;
import cz.mzk.vera.plugin.registry.LookupInput;
import cz.mzk.vera.plugin.registry.Registry;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

// PLG-api-kinds: Registry.
public final class KrameriusRegistry implements Registry {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String FIELDS = "pid,model,title.search,id_ccnb,id_barcode,id_urnnbn,root.pid,date.str,"
            + "part.number.str,accessibility,id_sysno";
    private static final Pattern BARCODE = Pattern.compile("\\d+");

    @Override
    public LookupAnswer lookup(PluginContext context, LookupInput input) {
        Document record = input.record();
        List<String> queries = new ArrayList<>();
        String sysno = nonblank(record.catalogId());
        if (sysno != null) {
            String lower = sysno.toLowerCase();
            String bare = sysno.contains("-") ? sysno.substring(sysno.indexOf('-') + 1) : sysno;
            queries.add("id_sysno:(\"" + lower + "\" OR \"" + bare + "\")");
        }

        String cnb = input.identifiers().stream().map(String::trim)
                .filter(value -> value.toLowerCase().startsWith("cnb") && !value.isBlank())
                .findFirst().orElse(null);
        if (cnb != null) {
            queries.add("id_ccnb:" + cnb);
        }

        List<String> barcodes = input.identifiers().stream().map(String::trim)
                .filter(value -> BARCODE.matcher(value).matches()).distinct().toList();
        if (!barcodes.isEmpty()) {
            String barcodeQuery = String.join(" OR ", barcodes);
            queries.add("id_barcode:(" + barcodeQuery + ")");
        }

        for (String query : queries) {
            JsonNode response = search(context, query);
            JsonNode docs = response.path("response").path("docs");
            if (docs.isArray() && !docs.isEmpty()) {
                List<LookupAnswer.RegistryRecord> records = recordsFor(input, docs, context);
                if (!records.isEmpty()) {
                    return new LookupAnswer(records);
                }
                return absent();
            }
        }
        return absent();
    }

    private JsonNode search(PluginContext context, String query) {
        String apiUrl = required(context, "api_url");
        String url = apiUrl.replaceAll("/$", "") + "/search/api/client/v7.0/search?q="
                + encode(query) + "&fl=" + encode(FIELDS) + "&rows=50&wt=json";
        PluginHttp.Response response = context.http().send(new PluginHttp.Request("GET", URI.create(url),
                java.util.Map.of("Accept", List.of("application/json")), new byte[0]));
        if (response.status() < 200 || response.status() >= 300) {
            throw new PluginUnavailable("Kramerius search returned HTTP " + response.status());
        }
        try {
            return JSON.readTree(response.body());
        } catch (IOException | RuntimeException exception) {
            throw new PluginUnavailable("Kramerius returned malformed JSON.", exception);
        }
    }

    private List<LookupAnswer.RegistryRecord> recordsFor(LookupInput input, JsonNode docs, PluginContext context) {
        List<JsonNode> matches = new ArrayList<>();
        Document.Unit unit = input.record().unit();
        if (unit != null) {
            for (JsonNode doc : docs) {
                String value = "year".equalsIgnoreCase(unit.type())
                        ? text(doc, "date.str") : text(doc, "part.number.str");
                if (unit.value().equals(value)) {
                    matches.add(doc);
                }
            }
        } else {
            List<JsonNode> topLevel = new ArrayList<>();
            for (JsonNode doc : docs) {
                String pid = text(doc, "pid");
                String rootPid = text(doc, "root.pid");
                if (pid != null && pid.equals(rootPid)) {
                    topLevel.add(doc);
                }
            }
            if (topLevel.isEmpty()) {
                for (JsonNode doc : docs) {
                    String model = doc.path("model").asText();
                    if (!"periodicalitem".equals(model)) {
                        topLevel.add(doc);
                    }
                }
            }
            if (topLevel.isEmpty() && !docs.isEmpty()) {
                topLevel.add(docs.get(0));
            }
            matches.addAll(topLevel);
        }

        String clientUrl = required(context, "client_url").replaceAll("/$", "");
        List<LookupAnswer.RegistryRecord> records = new ArrayList<>();
        for (JsonNode match : matches) {
            String pid = text(match, "pid");
            if (pid != null) {
                records.add(new LookupAnswer.RegistryRecord("published", clientUrl + "/view/" + pid));
            }
        }
        return List.copyOf(records);
    }

    private LookupAnswer absent() {
        return new LookupAnswer(List.of(new LookupAnswer.RegistryRecord("(absent)", null)));
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private String required(PluginContext context, String key) {
        String value = nonblank(context.configuration().get(key));
        if (value == null) {
            throw new PluginUnavailable("Missing Kramerius configuration: " + key);
        }
        return value;
    }

    private String nonblank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
