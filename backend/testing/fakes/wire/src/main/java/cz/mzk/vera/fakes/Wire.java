package cz.mzk.vera.fakes;

import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.PluginUnavailable;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// PLG-api-call. Form encoding keeps the plugin dependencies limited to the JDK and plugin-api.
final class Wire {
    private Wire() {}

    static Map<String, List<String>> send(PluginContext context, String operation, Map<String, List<String>> fields) {
        return send(context, "fakes.vera.test", operation, fields);
    }

    static Map<String, List<String>> send(
            PluginContext context, String host, String operation, Map<String, List<String>> fields) {
        fields.put("instanceId", List.of(context.instanceId()));
        StringBuilder body = new StringBuilder();
        fields.forEach((key, values) -> values.forEach(value -> {
            if (!body.isEmpty()) {
                body.append('&');
            }
            body.append(URLEncoder.encode(key, StandardCharsets.UTF_8)).append('=')
                    .append(URLEncoder.encode(value, StandardCharsets.UTF_8));
        }));
        PluginHttp.Request request = new PluginHttp.Request("POST",
                URI.create("https://" + host + "/" + operation),
                Map.of("content-type", List.of("application/x-www-form-urlencoded")),
                body.toString().getBytes(StandardCharsets.UTF_8));
        PluginHttp.Response response = context.http().send(request);
        if (response.status() < 200 || response.status() >= 300) {
            throw new PluginUnavailable("Fake world did not answer.");
        }
        return parse(new String(response.body(), StandardCharsets.UTF_8));
    }

    static Map<String, List<String>> fields() {
        return new LinkedHashMap<>();
    }

    static void put(Map<String, List<String>> fields, String key, String value) {
        fields.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value == null ? "" : value);
    }

    static String first(Map<String, List<String>> fields, String key) {
        List<String> values = fields.get(key);
        return values == null || values.isEmpty() ? null : values.getFirst();
    }

    static List<String> all(Map<String, List<String>> fields, String key) {
        return fields.getOrDefault(key, List.of());
    }

    static Map<String, List<String>> parse(String value) {
        Map<String, List<String>> result = fields();
        for (String pair : value.split("&")) {
            if (!pair.isEmpty()) {
                String[] parts = pair.split("=", 2);
                String key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
                String item = parts.length == 1 ? "" : URLDecoder.decode(parts[1], StandardCharsets.UTF_8);
                put(result, key, item);
            }
        }
        return result;
    }
}
