package cz.mzk.vera.testing.fakes.identity;

import cz.mzk.vera.plugin.PluginHttp;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

// PLG-api-call; the test profile's provider endpoints stay in process.
@Component
@Profile("test")
@Primary
public class FakeWorldHttp implements PluginHttp {
    private final FakeWorld world;

    public FakeWorldHttp(FakeWorld world) {
        this.world = world;
    }

    @Override
    public Response send(Request request) {
        String path = request.uri().getPath();
        String body = new String(request.body() == null ? new byte[0] : request.body(), StandardCharsets.UTF_8);
        Map<String, String> fields = parseForm(body);
        if ("POST".equals(request.method()) && path.endsWith("/token")) {
            return tokenResponse(request, fields);
        }
        String[] segments = path.split("/");
        if ("POST".equals(request.method()) && segments.length == 3 && "check".equals(segments[2])) {
            return checkResponse(segments[1], fields);
        }
        return response(404, "");
    }

    private Response tokenResponse(Request request, Map<String, String> fields) {
        var account = world.accountForIssuer(request.uri().getHost(), fields.get("code"));
        if (account == null) {
            return response(400, "");
        }
        StringBuilder output = new StringBuilder("external_id=")
                .append(encode(account.path("externalId").asString()))
                .append("&name=")
                .append(encode(account.path("name").asString()))
                .append("&email_verified=")
                .append(account.path("emailVerified").asBoolean());
        if (account.path("email").isString()) {
            output.append("&email=").append(encode(account.path("email").asString()));
        }
        for (JsonNode claim : account.path("claims")) {
            output.append("&claim=").append(encode(claim.asString()));
        }
        return new Response(200,
                Map.of("content-type", List.of("application/x-www-form-urlencoded")),
                output.toString().getBytes(StandardCharsets.UTF_8));
    }

    private Response checkResponse(String instanceId, Map<String, String> fields) {
        boolean accepted = world.checkPassword(instanceId, fields.get("username"), fields.get("password"));
        return accepted ? response(204, "") : response(401, "");
    }

    private Map<String, String> parseForm(String input) {
        Map<String, String> result = new HashMap<>();
        for (String pair : input.split("&")) {
            String[] parts = pair.split("=", 2);
            String key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
            String value = parts.length > 1 ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : "";
            result.put(key, value);
        }
        return result;
    }

    private Response response(int status, String body) {
        return new Response(status, Map.of(), body.getBytes(StandardCharsets.UTF_8));
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
