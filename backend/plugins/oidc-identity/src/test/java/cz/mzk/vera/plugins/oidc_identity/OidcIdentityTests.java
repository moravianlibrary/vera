package cz.mzk.vera.plugins.oidc_identity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cz.mzk.vera.plugin.LocalPasswords;
import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.PluginUnavailable;
import cz.mzk.vera.plugin.identity.BeginAnswer;
import cz.mzk.vera.plugin.identity.BeginInput;
import cz.mzk.vera.plugin.identity.CompleteAnswer;
import cz.mzk.vera.plugin.identity.CompleteInput;
import cz.mzk.vera.plugin.identity.IdentityRefusal;
import cz.mzk.vera.plugin.identity.IdentityRefused;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import javax.net.ssl.SSLSession;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.security.KeyPairGenerator;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import dasniko.testcontainers.keycloak.KeycloakContainer;

@Testcontainers
class OidcIdentityTests {
    @Container
    static final KeycloakContainer KEYCLOAK = new KeycloakContainer("quay.io/keycloak/keycloak:26.3")
            .withRealmImportFile("mzk-realm.json");

    private final OidcIdentity plugin = new OidcIdentity();

    @Test
    void completesAuthorizationCodeLoginWithPkceAndMapsGroups() throws Exception {
        String issuer = KEYCLOAK.getAuthServerUrl() + "/realms/mzk";
        TestContext context = new TestContext(issuer, request -> send(request));
        BeginAnswer begin = plugin.begin(context, new BeginInput("http://localhost/callback", "flow-state"));
        assertTrue(begin.redirect().contains("code_challenge_method=S256"));
        assertTrue(begin.flowData().containsKey("verifier"));

        Browser browser = new Browser();
        HttpResponse<String> login = browser.send(HttpRequest.newBuilder(URI.create(begin.redirect())).GET());
        while (login.statusCode() >= 300 && login.statusCode() < 400) {
            URI next = login.headers().firstValue("location").map(URI::create).orElseThrow();
            login = browser.send(HttpRequest.newBuilder(next).GET());
        }
        String action = attribute(login.body(), "action");
        String form = hiddenInputs(login.body()) + "&username=staff&password=staff-password";
        HttpResponse<String> submitted = browser.send(HttpRequest.newBuilder(URI.create(action))
                .header("content-type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form)));
        String location = submitted.headers().firstValue("location")
                .orElseThrow(() -> new AssertionError(submitted.statusCode() + ": " + submitted.body()));
        Map<String, String> callback = query(URI.create(location).getRawQuery());
        callback.put("iss", issuer);
        CompleteAnswer answer = plugin.complete(context, new CompleteInput.Callback(callback,
                withState(begin.flowData(), "flow-state"), "http://localhost/callback", "preferred_username"));
        assertEquals("staff", answer.externalId());
        assertEquals("staff@example.org", answer.email());
        assertTrue(answer.emailVerified());
        assertTrue(answer.claims().contains("group mzk-staff"));
        IdentityRefused reused = assertThrows(IdentityRefused.class, () -> plugin.complete(context,
                new CompleteInput.Callback(callback, withState(begin.flowData(), "flow-state"),
                        "http://localhost/callback", "preferred_username")));
        assertEquals(IdentityRefusal.WRONG_CREDENTIALS.code(), reused.code());
    }

    @Test
    void refusesWrongStateAndUnreachableIssuer() {
        TestContext context = new TestContext("http://127.0.0.1:1/realms/mzk", request -> {
            throw new PluginUnavailable("offline");
        });
        IdentityRefused wrongState = assertThrows(IdentityRefused.class, () -> plugin.complete(context,
                new CompleteInput.Callback(Map.of("state", "wrong", "code", "x"),
                        Map.of("state", "right", "nonce", "n", "verifier", "v"),
                        "http://localhost/callback", "sub")));
        assertEquals(IdentityRefusal.WRONG_CREDENTIALS.code(), wrongState.code());
        IdentityRefused wrongIssuer = assertThrows(IdentityRefused.class, () -> plugin.complete(context,
                new CompleteInput.Callback(Map.of("state", "right", "iss", "https://other.example", "code", "x"),
                        Map.of("state", "right", "nonce", "n", "verifier", "v"),
                        "http://localhost/callback", "sub")));
        assertEquals(IdentityRefusal.WRONG_CREDENTIALS.code(), wrongIssuer.code());
        assertThrows(PluginUnavailable.class, () -> plugin.begin(context,
                new BeginInput("http://localhost/callback", "state")));
    }

    @Test
    void refusesIdTokenSignedByAKeyAbsentFromProviderJwks() throws Exception {
        String issuer = "https://issuer.example/realms/mzk";
        var keyPair = KeyPairGenerator.getInstance("RSA").generateKeyPair();
        RSAKey tokenKey = new RSAKey.Builder((java.security.interfaces.RSAPublicKey) keyPair.getPublic())
                .privateKey(keyPair.getPrivate()).keyID("untrusted-key").build();
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(tokenKey.getKeyID()).build(),
                new JWTClaimsSet.Builder().issuer(issuer).audience("vera").subject("staff")
                        .claim("nonce", "test-nonce").expirationTime(Date.from(Instant.now().plusSeconds(300)))
                        .build());
        jwt.sign(new RSASSASigner(tokenKey));
        String token = jwt.serialize();
        TestContext context = new TestContext(issuer, request -> {
            String path = request.uri().getPath();
            String body = path.endsWith("openid-configuration")
                    ? "{\"authorization_endpoint\":\"https://issuer.example/auth\","
                            + "\"token_endpoint\":\"https://issuer.example/token\","
                            + "\"jwks_uri\":\"https://issuer.example/jwks\"}"
                    : path.endsWith("/token") ? "{\"id_token\":\"" + token + "\"}"
                    : "{\"keys\":[]}";
            return response(200, body);
        });
        IdentityRefused refused = assertThrows(IdentityRefused.class, () -> plugin.complete(context,
                new CompleteInput.Callback(Map.of("state", "s", "code", "c"),
                        Map.of("state", "s", "nonce", "test-nonce", "verifier", "v"),
                        "http://localhost/callback", "sub")));
        assertEquals(IdentityRefusal.WRONG_CREDENTIALS.code(), refused.code());
    }

    private static HttpResponse<String> send(PluginHttp.Request request) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(request.uri());
        request.headers().forEach((name, values) -> values.forEach(value -> builder.header(name, value)));
        builder.method(request.method(), request.body().length == 0 ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofByteArray(request.body()));
        return HttpClient.newHttpClient().send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static HttpResponse<String> response(int status, String body) {
        return new HttpResponse<>() {
            @Override public int statusCode() { return status; }
            @Override public HttpRequest request() { return null; }
            @Override public Optional<HttpResponse<String>> previousResponse() { return Optional.empty(); }
            @Override public HttpHeaders headers() { return HttpHeaders.of(Map.of(), (name, value) -> true); }
            @Override public String body() { return body; }
            @Override public Optional<SSLSession> sslSession() { return Optional.empty(); }
            @Override public URI uri() { return URI.create("https://issuer.example"); }
            @Override public HttpClient.Version version() { return HttpClient.Version.HTTP_1_1; }
        };
    }

    // Keycloak marks its login cookies Secure, which java.net's CookieManager never sends over the
    // container's plain HTTP; a browser on localhost does, and so does this jar.
    private static final class Browser {
        private final HttpClient client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER).build();
        private final Map<String, String> cookies = new java.util.LinkedHashMap<>();

        HttpResponse<String> send(HttpRequest.Builder request) throws Exception {
            if (!cookies.isEmpty()) {
                request.header("cookie", cookies.entrySet().stream()
                        .map(cookie -> cookie.getKey() + "=" + cookie.getValue())
                        .collect(java.util.stream.Collectors.joining("; ")));
            }
            HttpResponse<String> response = client.send(request.build(), HttpResponse.BodyHandlers.ofString());
            for (String header : response.headers().allValues("set-cookie")) {
                String pair = header.split(";", 2)[0];
                int equals = pair.indexOf('=');
                if (equals > 0) cookies.put(pair.substring(0, equals).trim(), pair.substring(equals + 1));
            }
            return response;
        }
    }

    private static String attribute(String html, String name) {
        Matcher matcher = Pattern.compile(name + "=\"([^\"]*)\"").matcher(html);
        if (!matcher.find()) throw new AssertionError("Missing " + name);
        return matcher.group(1).replace("&amp;", "&");
    }

    private static String hiddenInputs(String html) {
        Matcher matcher = Pattern.compile("<input[^>]*type=\"hidden\"[^>]*>").matcher(html);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            String input = matcher.group();
            String name = attribute(input, "name");
            Matcher valueAttribute = Pattern.compile("value=\"([^\"]*)\"").matcher(input);
            String value = valueAttribute.find() ? valueAttribute.group(1) : "";
            result.append(encode(name)).append('=').append(encode(value)).append('&');
        }
        return result.toString();
    }

    private static Map<String, String> query(String raw) {
        java.util.LinkedHashMap<String, String> result = new java.util.LinkedHashMap<>();
        for (String pair : raw.split("&")) {
            String[] parts = pair.split("=", 2);
            result.put(java.net.URLDecoder.decode(parts[0], StandardCharsets.UTF_8),
                    java.net.URLDecoder.decode(parts.length > 1 ? parts[1] : "", StandardCharsets.UTF_8));
        }
        return result;
    }

    private static String encode(String value) {
        return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static Map<String, String> withState(Map<String, String> values, String state) {
        java.util.LinkedHashMap<String, String> result = new java.util.LinkedHashMap<>(values);
        result.put("state", state);
        return result;
    }

    @FunctionalInterface
    private interface Sender { HttpResponse<String> send(PluginHttp.Request request) throws Exception; }

    private record TestContext(String issuer, Sender sender) implements PluginContext {
        @Override public String instanceId() { return "oidc-test"; }
        @Override public Map<String, String> configuration() {
            return Map.of("issuer", issuer, "client", "vera", "scopes", "openid email profile", "groups_claim", "groups");
        }
        @Override public Map<String, String> secrets() { return Map.of("client_secret", "vera-test-secret"); }
        @Override public PluginHttp http() {
            return request -> {
                try {
                    HttpResponse<String> response = sender.send(request);
                    return new PluginHttp.Response(response.statusCode(), Map.of(), response.body().getBytes(StandardCharsets.UTF_8));
                } catch (PluginUnavailable exception) { throw exception; }
                catch (Exception exception) { throw new PluginUnavailable("HTTP request failed.", exception); }
            };
        }
        @Override public System.Logger logger() { return System.getLogger("oidc-test"); }
        @Override public Clock clock() { return Clock.systemUTC(); }
        @Override public LocalPasswords localPasswords() { throw new UnsupportedOperationException(); }
    }
}
