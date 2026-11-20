package cz.mzk.vera.plugins.oidc_identity;

import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.SignedJWT;
import cz.mzk.vera.plugin.PluginContext;
import cz.mzk.vera.plugin.PluginHttp;
import cz.mzk.vera.plugin.PluginUnavailable;
import cz.mzk.vera.plugin.identity.BeginAnswer;
import cz.mzk.vera.plugin.identity.BeginInput;
import cz.mzk.vera.plugin.identity.CompleteAnswer;
import cz.mzk.vera.plugin.identity.CompleteInput;
import cz.mzk.vera.plugin.identity.Identity;
import cz.mzk.vera.plugin.identity.IdentityRefusal;
import cz.mzk.vera.plugin.identity.IdentityRefused;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import net.minidev.json.JSONValue;

// PLG-api-kinds: Identity.
public final class OidcIdentity implements Identity {
    private static final SecureRandom RANDOM = new SecureRandom();

    @Override
    public BeginAnswer begin(PluginContext context, BeginInput input) {
        try {
            Map<?, ?> discovery = json(send(context, "GET", discoveryUri(issuer(context)), null, null));
            String authorize = required(discovery, "authorization_endpoint");
            String verifier = randomValue(32);
            String nonce = randomValue(32);
            String challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(
                    MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));
            String scopes = config(context, "scopes", "openid email profile");
            StringBuilder url = new StringBuilder(authorize).append(authorize.contains("?") ? '&' : '?')
                    .append("response_type=code&client_id=").append(encode(config(context, "client", null)))
                    .append("&redirect_uri=").append(encode(input.callback()))
                    .append("&scope=").append(encode(scopes)).append("&state=").append(encode(input.state()))
                    .append("&nonce=").append(encode(nonce)).append("&code_challenge=").append(challenge)
                    .append("&code_challenge_method=S256");
            return new BeginAnswer(url.toString(), Map.of("verifier", verifier, "nonce", nonce, "state", input.state()));
        } catch (PluginUnavailable unavailable) {
            throw unavailable;
        } catch (Exception exception) {
            throw new PluginUnavailable("The identity provider could not be reached.", exception);
        }
    }

    @Override
    public CompleteAnswer complete(PluginContext context, CompleteInput input) {
        if (!(input instanceof CompleteInput.Callback callback)) {
            throw new IdentityRefused(IdentityRefusal.NOT_ALLOWED);
        }
        String expectedIssuer = issuer(context);
        Map<String, String> flow = callback.flowData();
        Map<String, String> parameters = callback.parameters();
        if (flow == null || parameters == null || !same(flow.get("state"), parameters.get("state"))
                || parameters.get("iss") != null
                && !expectedIssuer.equals(parameters.get("iss"))) {
            throw new IdentityRefused(IdentityRefusal.WRONG_CREDENTIALS);
        }
        try {
            Map<?, ?> discovery = json(send(context, "GET", discoveryUri(expectedIssuer), null, null));
            String tokenEndpoint = required(discovery, "token_endpoint");
            String jwksUri = required(discovery, "jwks_uri");
            String body = "grant_type=authorization_code&code=" + encode(parameters.get("code"))
                    + "&redirect_uri=" + encode(callback.callback()) + "&code_verifier="
                    + encode(required(flow, "verifier"));
            String basic = Base64.getEncoder().encodeToString((config(context, "client", null) + ":"
                    + secret(context)).getBytes(StandardCharsets.UTF_8));
            Map<?, ?> token = json(send(context, "POST", URI.create(tokenEndpoint), body,
                    Map.of("authorization", "Basic " + basic,
                            "content-type", "application/x-www-form-urlencoded")));
            String idToken = required(token, "id_token");
            PluginHttp.Response keys = send(context, "GET", URI.create(jwksUri), null, null);
            SignedJWT jwt = SignedJWT.parse(idToken);
            JWK jwk = JWKSet.parse(new String(keys.body(), StandardCharsets.UTF_8))
                    .getKeyByKeyId(jwt.getHeader().getKeyID());
            if (!(jwk instanceof RSAKey rsa)) {
                throw new IllegalArgumentException("Unsupported signing key.");
            }
            JWSVerifier verifier = new RSASSAVerifier(rsa.toRSAPublicKey());
            if (!jwt.verify(verifier)) {
                throw new IllegalArgumentException("Invalid token signature.");
            }
            Map<String, Object> claims = jwt.getJWTClaimsSet().getClaims();
            Instant now = context.clock().instant();
            if (!expectedIssuer.equals(claims.get("iss")) || !audienceContains(claims.get("aud"), config(context, "client", null))
                    || claims.get("exp") == null || !((java.util.Date) claims.get("exp")).toInstant().isAfter(now)
                    || !same(flow.get("nonce"), (String) claims.get("nonce"))) {
                throw new IllegalArgumentException("Invalid ID token claims.");
            }
            String idClaim = callback.userIdClaim() == null || callback.userIdClaim().isBlank()
                    ? "sub" : callback.userIdClaim();
            Object externalId = claims.get(idClaim);
            if (externalId == null) {
                throw new IllegalArgumentException("The configured user id claim is missing.");
            }
            List<String> groups = new ArrayList<>();
            Object rawGroups = claims.get(config(context, "groups_claim", "groups"));
            if (rawGroups instanceof List<?> values) {
                for (Object value : values) {
                    if (value instanceof String group) {
                        groups.add("group " + (group.startsWith("/") ? group.substring(1) : group));
                    }
                }
            }
            return new CompleteAnswer(externalId.toString(), stringClaim(claims, "email"),
                    Boolean.TRUE.equals(claims.get("email_verified")), stringClaim(claims, "name"), groups);
        } catch (PluginUnavailable unavailable) {
            throw unavailable;
        } catch (Exception exception) {
            throw new IdentityRefused(IdentityRefusal.WRONG_CREDENTIALS);
        }
    }

    private static PluginHttp.Response send(PluginContext context, String method, URI uri, String body,
            Map<String, String> extraHeaders) {
        Map<String, List<String>> headers = new LinkedHashMap<>();
        if (extraHeaders != null) {
            extraHeaders.forEach((name, value) -> headers.put(name, List.of(value)));
        }
        if (body != null && !headers.containsKey("content-type")) {
            headers.put("content-type", List.of("application/x-www-form-urlencoded"));
        }
        PluginHttp.Response response = context.http().send(new PluginHttp.Request(method, uri, headers,
                body == null ? new byte[0] : body.getBytes(StandardCharsets.UTF_8)));
        if (response.status() < 200 || response.status() >= 300) {
            if (method.equals("POST") && (response.status() == 400 || response.status() == 401)) {
                throw new IdentityRefused(IdentityRefusal.WRONG_CREDENTIALS);
            }
            throw new PluginUnavailable("The identity provider did not answer successfully.");
        }
        return response;
    }

    private static Map<?, ?> json(PluginHttp.Response response) {
        Object parsed = JSONValue.parse(new String(response.body(), StandardCharsets.UTF_8));
        if (!(parsed instanceof Map<?, ?> map)) {
            throw new PluginUnavailable("The identity provider returned an invalid answer.");
        }
        return map;
    }

    private static URI discoveryUri(String issuer) {
        return URI.create(issuer.replaceAll("/$", "") + "/.well-known/openid-configuration");
    }

    private static String issuer(PluginContext context) {
        String value = config(context, "issuer", null);
        return value.replaceAll("/$", "");
    }

    private static String config(PluginContext context, String key, String fallback) {
        String value = context.configuration().get(key);
        return value == null || value.isBlank() ? fallback : value;
    }

    private static String secret(PluginContext context) {
        String value = context.secrets().get("client_secret");
        return value == null ? config(context, "client_secret", "") : value;
    }

    private static String required(Map<?, ?> values, String key) {
        Object value = values.get(key);
        if (!(value instanceof String text) || text.isBlank()) {
            throw new IllegalArgumentException("Missing " + key);
        }
        return text;
    }

    private static String randomValue(int bytes) {
        byte[] value = new byte[bytes];
        RANDOM.nextBytes(value);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    private static String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private static boolean same(String expected, String actual) {
        return expected != null && actual != null
                && MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
    }

    private static boolean audienceContains(Object audience, String client) {
        return audience instanceof String value && value.equals(client)
                || audience instanceof List<?> values && values.contains(client);
    }

    private static String stringClaim(Map<String, Object> claims, String key) {
        Object value = claims.get(key);
        return value == null ? null : value.toString();
    }
}
