package cz.mzk.vera.testing.control;

import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_IDENTITIES;
import static cz.mzk.vera.db.tables.Tables.USER_MAPPED_ROLES;

import cz.mzk.vera.domain.Names;
import cz.mzk.vera.login.IdentityInstances;
import cz.mzk.vera.testing.fakes.identity.FakeWorld;
import cz.mzk.vera.web.Problems;
import cz.mzk.vera.web.RequestLanguage;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// BK2a; ACCESS-login-page. The fake OpenID Connect provider's sign-in page: FakeOidcIdentity sends
// the browser to its authorize address, the person picks one of the seed's accounts, each shown
// with the roles VERA gives it at login, and the provider redirects back with a code and the state.
@Component
@Profile("test")
public class FakeProviderPage {
    private final DSLContext dsl;
    private final IdentityInstances instances;
    private final FakeWorld world;
    private final JsonMapper json;

    public FakeProviderPage(DSLContext dsl, IdentityInstances instances, FakeWorld world, JsonMapper json) {
        this.dsl = dsl;
        this.instances = instances;
        this.world = world;
        this.json = json;
    }

    public ResponseEntity<?> page(String instanceId, String clientId, String redirectUri, String scope,
            String state) {
        IdentityInstances.Instance instance = redirectInstance(instanceId);
        if (instance == null) {
            return noInstance();
        }
        if (!isOwnCallback(instanceId, redirectUri)) {
            return badRedirect();
        }
        StringBuilder html = new StringBuilder("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">")
                .append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>")
                .append(escape(instance.settings().label())).append("</title><style>").append(STYLE)
                .append("</style></head><body><main><p class=\"provider\">")
                .append(escape(issuerOf(instance))).append(" · test provider</p><h1>")
                .append(escape(instance.settings().label())).append("</h1><p class=\"muted\">Signing in to <b>")
                .append(escape(clientId == null ? "" : clientId)).append("</b> with <code>")
                .append(escape(scope == null ? "" : scope))
                .append("</code>. Pick an account; nobody is asked for a password.</p>")
                // The bare path: posting back to the query too would send redirect_uri and state twice.
                .append("<form method=\"post\" action=\"/_engine/identity/").append(escape(instanceId))
                .append("/auth\"><input type=\"hidden\" name=\"redirect_uri\" value=\"")
                .append(escape(redirectUri)).append("\"><input type=\"hidden\" name=\"state\" value=\"")
                .append(escape(state)).append("\"><ul>");
        Map<String, String> roleNames = roleNames();
        for (var entry : world.accountsForInstance(instanceId).entrySet()) {
            JsonNode account = entry.getValue();
            Login login = loginOf(instance, account);
            html.append("<li><button name=\"code\" value=\"").append(escape(entry.getKey())).append("\">")
                    .append("<span class=\"name\">").append(escape(account.path("name").asString()))
                    .append("</span><span class=\"muted\">")
                    .append(escape(account.path("email").isNull() ? entry.getKey() : account.path("email").asString()))
                    .append("</span><span class=\"roles\">");
            if (login.roleIds().isEmpty()) {
                html.append("<span class=\"none\">no role</span>");
            }
            for (String roleId : login.roleIds()) {
                html.append("<span class=\"role\">").append(escape(roleNames.getOrDefault(roleId, roleId)))
                        .append("</span>");
            }
            html.append("</span><span class=\"muted small\">")
                    .append(login.userName() == null ? "new to VERA" : "VERA: " + escape(login.userName()));
            List<String> groups = groupsOf(account);
            if (!groups.isEmpty()) {
                html.append(" · groups ").append(escape(String.join(", ", groups)));
            }
            html.append("</span></button></li>");
        }
        html.append("</ul><button class=\"cancel\" name=\"error\" value=\"access_denied\">Cancel</button>")
                .append("</form></main></body></html>");
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html.toString());
    }

    // What a provider does after its login form: back to the callback with a code, or an error.
    public ResponseEntity<?> choose(String instanceId, String redirectUri, String state, String code,
            String error) {
        if (redirectInstance(instanceId) == null) {
            return noInstance();
        }
        if (!isOwnCallback(instanceId, redirectUri)) {
            return badRedirect();
        }
        String answer = error != null ? "error=" + encode(error) : "code=" + encode(code == null ? "" : code);
        // The path alone, so the redirect also lands behind the dev server's proxy, whose origin
        // the backend's public address does not name.
        String location = URI.create(redirectUri).getRawPath() + "?" + answer + "&state=" + encode(state);
        return ResponseEntity.status(302).header(HttpHeaders.LOCATION, location).build();
    }

    private record Login(String userName, List<String> roleIds) {}

    // As LoginCommands does it: the person matched keeps their hand roles, the roles other
    // instances mapped and a default role; a new person gets this instance's default role; and
    // this instance's mappings add a role for each claim the account has.
    private Login loginOf(IdentityInstances.Instance instance, JsonNode account) {
        String userId = dsl.select(USER_IDENTITIES.USER_ID).from(USER_IDENTITIES)
                .where(USER_IDENTITIES.INSTANCE_ID.eq(instance.id()))
                .and(USER_IDENTITIES.EXTERNAL_ID.eq(account.path("externalId").asString()))
                .fetchOne(USER_IDENTITIES.USER_ID);
        String email = account.path("email").isNull() ? null : account.path("email").asString();
        if (userId == null && instance.settings().matchByEmail() && email != null
                && account.path("emailVerified").asBoolean(false)) {
            userId = dsl.select(USERS.ID).from(USERS)
                    .where(DSL.lower(USERS.EMAIL).eq(email.toLowerCase(Locale.ROOT))).fetchOne(USERS.ID);
        }
        Set<String> roleIds = new LinkedHashSet<>();
        String userName = null;
        if (userId != null) {
            userName = dsl.select(USERS.NAME).from(USERS).where(USERS.ID.eq(userId)).fetchOne(USERS.NAME);
            roleIds.addAll(dsl.select(USER_HAND_ROLES.ROLE_ID).from(USER_HAND_ROLES)
                    .where(USER_HAND_ROLES.USER_ID.eq(userId)).orderBy(USER_HAND_ROLES.POSITION)
                    .fetch(USER_HAND_ROLES.ROLE_ID));
            roleIds.addAll(dsl.select(USER_MAPPED_ROLES.ROLE_ID).from(USER_MAPPED_ROLES)
                    .where(USER_MAPPED_ROLES.USER_ID.eq(userId))
                    .and(USER_MAPPED_ROLES.INSTANCE_ID.ne(instance.id())
                            .or(USER_MAPPED_ROLES.CLAIM.eq("default role")))
                    .orderBy(USER_MAPPED_ROLES.POSITION).fetch(USER_MAPPED_ROLES.ROLE_ID));
        } else if (instance.settings().defaultRoleId() != null) {
            roleIds.add(instance.settings().defaultRoleId());
        }
        Set<String> claims = new LinkedHashSet<>();
        account.path("claims").forEach(claim -> claims.add(claim.asString()));
        for (IdentityInstances.Mapping mapping : instance.settings().mappings()) {
            if (claims.contains(mapping.claim())) {
                roleIds.add(mapping.roleId());
            }
        }
        return new Login(userName, List.copyOf(roleIds));
    }

    private List<String> groupsOf(JsonNode account) {
        List<String> groups = new ArrayList<>();
        account.path("claims").forEach(claim -> {
            String value = claim.asString();
            groups.add(value.startsWith("group ") ? value.substring("group ".length()) : value);
        });
        return groups;
    }

    private Map<String, String> roleNames() {
        Map<String, String> result = new LinkedHashMap<>();
        dsl.select(ROLES.ID, ROLES.NAMES).from(ROLES).fetch().forEach(row -> {
            Map<String, String> names = new LinkedHashMap<>();
            json.readTree(row.get(ROLES.NAMES).data()).properties()
                    .forEach(entry -> names.put(entry.getKey(), entry.getValue().asString()));
            result.put(row.get(ROLES.ID), Names.nameIn(names, RequestLanguage.current()));
        });
        return result;
    }

    private IdentityInstances.Instance redirectInstance(String instanceId) {
        IdentityInstances.Instance instance = instances.find(instanceId);
        return instance != null && instance.enabled() && "redirect".equals(instance.entry()) ? instance : null;
    }

    // Like a provider's registered redirect address: only this instance's own callback.
    private static boolean isOwnCallback(String instanceId, String redirectUri) {
        try {
            return redirectUri != null
                    && ("/api/login/" + instanceId + "/callback").equals(URI.create(redirectUri).getPath());
        } catch (IllegalArgumentException malformed) {
            return false;
        }
    }

    private static String issuerOf(IdentityInstances.Instance instance) {
        return instance.configuration().path("issuer").asString("");
    }

    private static ResponseEntity<?> noInstance() {
        return Problems.response(404, "There is no enabled Identity instance.", "identity.no_instance", null);
    }

    private static ResponseEntity<?> badRedirect() {
        return Problems.response(400, "The redirect address is not this instance's callback.");
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    private static final String STYLE = """
            :root { color-scheme: light dark; --line: #d4d4d8; --muted: #71717a; --role: #e0f2f1; --role-text: #0f5f58; }
            @media (prefers-color-scheme: dark) { :root { --line: #3f3f46; --muted: #a1a1aa; --role: #134e4a; --role-text: #ccfbf1; } }
            body { margin: 0; font: 15px/1.45 system-ui, sans-serif; background: Canvas; color: CanvasText; }
            main { max-width: 34rem; margin: 3rem auto; padding: 0 1rem; }
            h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
            .provider { margin: 0 0 .5rem; color: var(--muted); font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; }
            .muted { color: var(--muted); } .small { font-size: .8rem; }
            ul { list-style: none; padding: 0; margin: 1.25rem 0; display: grid; gap: .5rem; }
            li button { width: 100%; display: grid; gap: .15rem; text-align: left; padding: .75rem 1rem; border: 1px solid var(--line); border-radius: .6rem; background: transparent; color: inherit; font: inherit; cursor: pointer; }
            li button:hover, li button:focus-visible { border-color: var(--role-text); }
            .name { font-weight: 600; }
            .roles { display: flex; flex-wrap: wrap; gap: .3rem; margin: .2rem 0; }
            .role, .none { font-size: .75rem; padding: .05rem .5rem; border-radius: 99px; background: var(--role); color: var(--role-text); }
            .none { background: transparent; border: 1px dashed var(--line); color: var(--muted); }
            .cancel { border: 0; background: none; color: var(--muted); font: inherit; cursor: pointer; padding: 0; text-decoration: underline; }
            """;
}
