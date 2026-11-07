package cz.mzk.vera.testing.fakes;

import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.testing.fakes.identity.FakeWorld;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

// PLG-api-call; the test profile's providers and record fakes stay in process.
@Component
@Profile("test")
@Primary
public class FakeWorldHttp implements PluginHttp {
    private final FakeWorld identities;
    private final FakeRecords records;
    private final FakeIngest ingest;

    public FakeWorldHttp(FakeWorld identities, FakeRecords records, FakeIngest ingest) {
        this.identities = identities;
        this.records = records;
        this.ingest = ingest;
    }

    @Override
    public Response send(Request request) {
        String path = request.uri().getPath();
        Map<String, List<String>> fields = parseForm(new String(
                request.body() == null ? new byte[0] : request.body(), StandardCharsets.UTF_8));
        if ("POST".equals(request.method()) && path.endsWith("/token")) {
            return tokenResponse(request, fields);
        }
        String[] segments = path.split("/");
        if ("POST".equals(request.method()) && segments.length == 3 && "check".equals(segments[2])) {
            return checkResponse(segments[1], fields);
        }
        if ("fakes.vera.test".equals(request.uri().getHost())
                || records.isCatalogHost(request.uri().getHost())) {
            if (records.isCatalogHost(request.uri().getHost())) {
                fields.put("catalogHost", List.of(request.uri().getHost()));
            }
            String operation = path.substring(1);
            String requestedKind = first(fields, "kind");
            String kind = requestedKind == null ? null : switch (requestedKind) {
                case "Registry" -> "Registry";
                case "PropertySource" -> "PropertySource";
                case "Validation" -> "Validation";
                case "Restriction" -> "Restriction";
                default -> null;
            };
            if (kind != null) {
                Map<String, List<String>> answer = ingest.answer(kind, first(fields, "catalogId"),
                        first(fields, "instanceId"), fields.getOrDefault("identifier", List.of()));
                String status = first(answer, "httpStatus");
                if (status != null) {
                    return response(Integer.parseInt(status), Map.of());
                }
                return response(200, answer);
            }
            return response(200, records.answer(operation, fields));
        }
        return response(404, Map.of());
    }

    private Response tokenResponse(Request request, Map<String, List<String>> fields) {
        JsonNode account = identities.accountForIssuer(request.uri().getHost(), first(fields, "code"));
        if (account == null) {
            return response(400, Map.of());
        }
        Map<String, List<String>> output = new LinkedHashMap<>();
        put(output, "external_id", account.path("externalId").asString());
        put(output, "name", account.path("name").asString());
        put(output, "email_verified", Boolean.toString(account.path("emailVerified").asBoolean()));
        if (account.path("email").isString()) {
            put(output, "email", account.path("email").asString());
        }
        for (JsonNode claim : account.path("claims")) {
            put(output, "claim", claim.asString());
        }
        return response(200, output);
    }

    private Response checkResponse(String instanceId, Map<String, List<String>> fields) {
        boolean accepted = identities.checkPassword(instanceId, first(fields, "username"),
                first(fields, "password"));
        return response(accepted ? 204 : 401, Map.of());
    }

    private Map<String, List<String>> parseForm(String input) {
        Map<String, List<String>> result = new LinkedHashMap<>();
        for (String pair : input.split("&")) {
            if (pair.isEmpty()) {
                continue;
            }
            String[] parts = pair.split("=", 2);
            String key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
            String value = parts.length > 1 ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : "";
            put(result, key, value);
        }
        return result;
    }

    private String first(Map<String, List<String>> fields, String key) {
        List<String> values = fields.get(key);
        return values == null || values.isEmpty() ? null : values.getFirst();
    }

    private void put(Map<String, List<String>> fields, String key, String value) {
        fields.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value);
    }

    private Response response(int status, Map<String, List<String>> fields) {
        StringBuilder output = new StringBuilder();
        fields.forEach((key, values) -> values.forEach(value -> {
            if (!output.isEmpty()) {
                output.append('&');
            }
            output.append(URLEncoder.encode(key, StandardCharsets.UTF_8)).append('=')
                    .append(URLEncoder.encode(value, StandardCharsets.UTF_8));
        }));
        return new Response(status, Map.of("content-type", List.of("application/x-www-form-urlencoded")),
                output.toString().getBytes(StandardCharsets.UTF_8));
    }
}
