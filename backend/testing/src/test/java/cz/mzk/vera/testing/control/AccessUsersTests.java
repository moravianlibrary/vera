package cz.mzk.vera.testing.control;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// ACT-local-account; ACT-user-roles; ACT-user-groups; ACT-identity-link; ACT-identity-unlink;
// ACT-identity-default-role; ACT-user-suspend; ACT-user-restore.
@SpringBootTest(classes = VeraTestingApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class AccessUsersTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;

    @Autowired
    private JdbcTemplate jdbc;

    private final JsonMapper json = JsonMapper.builder().build();

    @BeforeEach
    void resetBase() {
        client.post().uri("/_engine/reset").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("seed", "base", "frozen", true)).exchange().expectStatus().isOk();
    }

    @Test
    void ACT_identity_default_role_sets_a_default_role_and_preserves_settings() throws Exception {
        String settings = jdbc.queryForObject("SELECT settings::text FROM plugin_instances WHERE id='pi22'", String.class);
        List<String> existingRoles = jdbc.queryForList("SELECT role_id FROM user_mapped_roles WHERE user_id='u3' "
                + "ORDER BY position", String.class);
        var result = put("/api/access/identity-instances/pi22/default-role", session("u3"), Map.of("roleId", "reader"));
        assertThat(result.getStatus().value()).isEqualTo(200);
        assertThat(body(result).path("defaultRoleId").asString()).isEqualTo("reader");
        assertThat(jdbc.queryForObject("SELECT settings::text FROM plugin_instances WHERE id='pi22'", String.class))
                .contains("defaultRoleId", "userIdClaim");
        assertThat(settings).contains("userIdClaim");
        assertThat(jdbc.queryForList("SELECT role_id FROM user_mapped_roles WHERE user_id='u3' "
                + "ORDER BY position", String.class)).isEqualTo(existingRoles);
        assertAudit("plugin_instance.default_role_changed");
        int eventCount = jdbc.queryForObject("SELECT count(*) FROM audit_outbox "
                + "WHERE record->>'code'='plugin_instance.default_role_changed'", Integer.class);
        put("/api/access/identity-instances/pi22/default-role", session("u3"), Map.of("roleId", "reader"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM audit_outbox "
                + "WHERE record->>'code'='plugin_instance.default_role_changed'", Integer.class)).isEqualTo(eventCount);
    }

    @Test
    void ACT_identity_default_role_sets_no_default_role_and_leaves_existing_roles_unchanged() {
        List<String> before = jdbc.queryForList("SELECT role_id FROM user_mapped_roles WHERE user_id='u5'", String.class);
        var result = put("/api/access/identity-instances/pi41/default-role", session("u3"), nullBody("roleId"));
        assertThat(result.getStatus().value()).isEqualTo(200);
        assertThat(body(result).path("defaultRoleId").isNull()).isTrue();
        assertThat(jdbc.queryForList("SELECT role_id FROM user_mapped_roles WHERE user_id='u5'", String.class))
                .isEqualTo(before);
        assertAudit("plugin_instance.default_role_changed");
    }

    @Test
    void ACT_identity_default_role_refuses_a_missing_instance() {
        assertProblem(put("/api/access/identity-instances/pi99/default-role", session("u3"), Map.of("roleId", "reader")),
                404, "not_found");
    }

    @Test
    void ACT_identity_default_role_refuses_an_unknown_role_with_contract_code() {
        assertProblem(put("/api/access/identity-instances/pi22/default-role", session("u3"), Map.of("roleId", "missing")),
                422, "role.not_found");
    }

    @Test
    void ACT_identity_default_role_gives_the_new_default_to_a_first_login() throws Exception {
        put("/api/access/identity-instances/pi41/default-role", session("u3"), Map.of("roleId", "curator"));
        var start = client.get().uri("/api/login/pi41").exchange().expectStatus().is3xxRedirection()
                .expectBody().returnResult();
        String location = start.getResponseHeaders().getFirst("Location");
        String callback = java.net.URLDecoder.decode(location.substring(location.indexOf("return=") + 7),
                java.nio.charset.StandardCharsets.UTF_8);
        String flow = java.util.regex.Pattern.compile("flow=([^&]+)").matcher(callback).results()
                .findFirst().orElseThrow().group(1);
        client.get().uri("/api/login/pi41/callback?flow=" + flow + "&code=nova.ctenarka@muni.cz")
                .exchange().expectStatus().is3xxRedirection();
        String userId = jdbc.queryForObject("SELECT user_id FROM user_identities WHERE instance_id='pi41' "
                + "AND external_id='nova.ctenarka@muni.cz'", String.class);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM user_mapped_roles WHERE user_id=? AND role_id='curator'",
                Integer.class, userId)).isEqualTo(1);
        JsonNode created = lastAudit();
        assertThat(created.path("code").asString()).isEqualTo("user.created");
        assertThat(created.path("changes").toString()).contains("first_login");
    }

    @Test
    void ACT_local_account_creates_a_local_account_with_deduplicated_roles() throws Exception {
        var result = post("/api/access/users", session("u3"), Map.of("name", "Hana Malá", "username", "hmala",
                "email", "", "roleIds", List.of("reader", "reader")));
        assertThat(result.getStatus().value()).isEqualTo(200);
        JsonNode user = body(result);
        assertThat(user.path("identities").get(0).path("lastLoginAt").isNull()).isTrue();
        assertThat(user.path("handRoleIds").toString()).isEqualTo("[\"reader\"]");
        assertAudit("user.created");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM local_passwords WHERE username='hmala'", Integer.class))
                .isZero();
    }

    @Test
    void ACT_local_account_refuses_when_local_accounts_are_switched_off() {
        jdbc.update("UPDATE plugin_instances SET is_enabled=false WHERE id='pi24'");
        assertProblem(post("/api/access/users", session("u3"), localAccount("switch-off")), 422,
                "access.local_accounts_off");
    }

    @Test
    void ACT_local_account_refuses_a_taken_username() {
        post("/api/access/users", session("u3"), localAccount("taken"));
        assertProblem(post("/api/access/users", session("u3"), localAccount("taken")), 409,
                "access.identity_taken");
    }

    @Test
    void ACT_local_account_refuses_an_unknown_role() {
        assertProblem(post("/api/access/users", session("u3"), Map.of("name", "Hana", "username", "unknown-role",
                "email", "", "roleIds", List.of("missing"))), 404, "not_found");
    }

    @Test
    void ACT_user_roles_replaces_hand_roles_without_changing_mapped_roles() throws Exception {
        var result = put("/api/access/users/u4/roles", session("u3"), Map.of("roleIds", List.of("reader")));
        assertThat(body(result).path("handRoleIds").toString()).isEqualTo("[\"reader\"]");
        assertThat(body(result).path("mappedRoles").get(0).path("roleId").asString()).isEqualTo("staff");
        assertAudit("user.roles_changed");
    }

    @Test
    void ACT_user_roles_refuses_to_remove_the_last_manager_and_unknown_roles() {
        assertProblem(put("/api/access/users/u3/roles", session("u3"), Map.of("roleIds", List.of())), 409,
                "access.last_manager");
        assertProblem(put("/api/access/users/u4/roles", session("u3"), Map.of("roleIds", List.of("missing"))),
                404, "not_found");
    }

    @Test
    void ACT_user_roles_records_nothing_when_the_set_is_unchanged() {
        String cookie = session("u3");
        put("/api/access/users/u4/roles", cookie, Map.of("roleIds", List.of("reader")));
        int count = jdbc.queryForObject("SELECT count(*) FROM audit_outbox", Integer.class);
        put("/api/access/users/u4/roles", cookie, Map.of("roleIds", List.of("reader")));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM audit_outbox", Integer.class)).isEqualTo(count);
    }

    @Test
    void ACT_user_groups_replaces_memberships_and_refuses_unknown_groups() throws Exception {
        var result = put("/api/access/users/u9/groups", session("u3"), Map.of("groupIds", List.of("g3")));
        assertThat(result.getStatus().value()).isEqualTo(200);
        assertThat(body(result).path("groupIds").toString()).isEqualTo("[\"g3\"]");
        assertAudit("user.groups_changed");
        assertProblem(put("/api/access/users/u9/groups", session("u3"), Map.of("groupIds", List.of("missing"))),
                404, "not_found");
    }

    @Test
    void ACT_identity_link_links_an_identity_and_hides_its_external_id_from_audit() throws Exception {
        var result = post("/api/access/users/u1/identities", session("u3"),
                Map.of("instanceId", "pi41", "externalId", "one-off"));
        assertThat(result.getStatus().value()).isEqualTo(200);
        assertThat(body(result).path("lastLoginAt").isNull()).isTrue();
        assertAudit("user.identity_linked");
        assertThat(lastAudit().toString()).doesNotContain("one-off");
    }

    @Test
    void ACT_identity_link_refuses_agents_missing_providers_and_taken_identities() {
        String cookie = session("u3");
        assertProblem(post("/api/access/users/a1/identities", cookie,
                Map.of("instanceId", "pi41", "externalId", "one-off")), 422, "access.agent_no_login");
        assertProblem(post("/api/access/users/u1/identities", cookie,
                Map.of("instanceId", "pi99", "externalId", "one-off")), 404, "not_found");
        post("/api/access/users/u1/identities", cookie, Map.of("instanceId", "pi41", "externalId", "one-off"));
        assertProblem(post("/api/access/users/u2/identities", cookie,
                Map.of("instanceId", "pi41", "externalId", "one-off")), 409, "access.identity_taken");
    }

    @Test
    void ACT_identity_unlink_removes_an_identity_and_refuses_the_last_one() {
        String cookie = session("u3");
        post("/api/access/users/u1/identities", cookie, Map.of("instanceId", "pi41", "externalId", "one-off"));
        assertThat(delete("/api/access/users/u1/identities/pi41/one-off", cookie).getStatus().value()).isEqualTo(204);
        assertAudit("user.identity_unlinked");
        assertProblem(delete("/api/access/users/u1/identities/pi22/jnovakova", cookie), 409, "access.last_identity");
        assertProblem(delete("/api/access/users/u1/identities/pi22/missing", cookie), 404, "not_found");
    }

    @Test
    void ACT_user_suspend_suspends_a_person_ends_sessions_and_refuses_second_suspend() {
        String oldCookie = session("u4");
        var result = post("/api/access/users/u4/suspend", session("u3"), Map.of());
        assertThat(result.getStatus().value()).isEqualTo(200);
        assertThat(lastAudit().path("actor").path("userId").asString()).isEqualTo("u3");
        client.get().uri("/api/session").header("Cookie", oldCookie).exchange().expectStatus().isUnauthorized();
        assertProblem(post("/api/access/users/u4/suspend", session("u3"), Map.of()), 409, "access.suspended");
        assertProblem(post("/api/access/users/a1/suspend", session("u3"), Map.of()), 422, "access.agent_no_login");
    }

    @Test
    void ACT_user_suspend_refuses_to_suspend_the_last_access_manager() {
        assertProblem(post("/api/access/users/u3/suspend", session("u3"), Map.of()), 409, "access.last_manager");
    }

    @Test
    void ACT_user_restore_restores_a_suspended_person_and_refuses_an_active_person() {
        String cookie = session("u3");
        post("/api/access/users/u4/suspend", cookie, Map.of());
        var result = post("/api/access/users/u4/restore", cookie, Map.of());
        assertThat(result.getStatus().value()).isEqualTo(200);
        assertAudit("user.restored");
        assertProblem(post("/api/access/users/u4/restore", cookie, Map.of()), 409, "access.not_suspended");
    }

    @Test
    void access_user_acts_refuse_a_missing_user() {
        String cookie = session("u3");
        assertProblem(put("/api/access/users/missing/roles", cookie, Map.of("roleIds", List.of())),
                404, "not_found");
        assertProblem(put("/api/access/users/missing/groups", cookie, Map.of("groupIds", List.of())),
                404, "not_found");
        assertProblem(post("/api/access/users/missing/identities", cookie,
                Map.of("instanceId", "pi41", "externalId", "one-off")), 404, "not_found");
        assertProblem(delete("/api/access/users/missing/identities/pi22/jnovakova", cookie), 404, "not_found");
        assertProblem(post("/api/access/users/missing/suspend", cookie, Map.of()), 404, "not_found");
        assertProblem(post("/api/access/users/missing/restore", cookie, Map.of()), 404, "not_found");
    }

    @Test
    void local_account_reset_request_sets_a_password_that_can_log_in() throws Exception {
        String cookie = session("u3");
        post("/api/access/users", cookie, Map.of("name", "Hana Malá", "username", "hmala",
                "email", "hana@example.cz", "roleIds", List.of("reader")));
        client.post().uri("/api/password-reset/pi24").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("email", "hana@example.cz")).exchange().expectStatus().isAccepted();
        JsonNode messages = json.readTree(client.get().uri("/_engine/outbox?channel=mail").exchange()
                .expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody());
        String link = messages.get(messages.size() - 1).path("payload").path("link").asString();
        String token = link.substring(link.lastIndexOf('/') + 1);
        client.post().uri("/api/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("token", token, "password", "new-password-123"))
                .exchange().expectStatus().isNoContent();
        client.post().uri("/api/login/pi24").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("username", "hmala", "password", "new-password-123"))
                .exchange().expectStatus().isNoContent();
    }

    @Test
    void local_account_requires_a_signed_in_manager() {
        assertDenied(HttpMethod.POST, "/api/access/users", Map.of("name", "H", "username", "h", "email", "",
                "roleIds", List.of()));
    }

    @Test
    void user_roles_requires_a_signed_in_manager() {
        assertDenied(HttpMethod.PUT, "/api/access/users/u4/roles", Map.of("roleIds", List.of()));
    }

    @Test
    void user_groups_requires_a_signed_in_manager() {
        assertDenied(HttpMethod.PUT, "/api/access/users/u4/groups", Map.of("groupIds", List.of()));
    }

    @Test
    void identity_link_requires_a_signed_in_manager() {
        assertDenied(HttpMethod.POST, "/api/access/users/u1/identities", Map.of("instanceId", "pi41", "externalId", "x"));
    }

    @Test
    void identity_unlink_requires_a_signed_in_manager() {
        assertDenied(HttpMethod.DELETE, "/api/access/users/u1/identities/pi22/jnovakova", null);
    }

    @Test
    void identity_default_role_requires_a_signed_in_manager() {
        assertDenied(HttpMethod.PUT, "/api/access/identity-instances/pi22/default-role", Map.of("roleId", "reader"));
    }

    @Test
    void user_suspend_requires_a_signed_in_manager() {
        assertDenied(HttpMethod.POST, "/api/access/users/u4/suspend", Map.of());
    }

    @Test
    void user_restore_requires_a_signed_in_manager() {
        assertDenied(HttpMethod.POST, "/api/access/users/u4/restore", Map.of());
    }

    private Map<String, Object> localAccount(String username) {
        return Map.of("name", "Hana", "username", username, "email", "", "roleIds", List.of());
    }

    private Map<String, Object> nullBody(String key) {
        return java.util.Collections.singletonMap(key, null);
    }

    private String session(String userId) {
        String cookie = client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk()
                .expectBody().returnResult().getResponseHeaders().getFirst("Set-Cookie");
        return cookie.substring(0, cookie.indexOf(';'));
    }

    private EntityExchangeResult<String> post(
            String uri, String cookie, Object body) {
        return request(HttpMethod.POST, uri, cookie, body);
    }

    private EntityExchangeResult<String> put(
            String uri, String cookie, Object body) {
        return request(HttpMethod.PUT, uri, cookie, body);
    }

    private EntityExchangeResult<String> delete(
            String uri, String cookie) {
        return request(HttpMethod.DELETE, uri, cookie, null);
    }

    private EntityExchangeResult<String> request(
            HttpMethod method, String uri, String cookie, Object body) {
        var request = client.method(method).uri(uri).header("Cookie", cookie);
        if (body == null) return request.exchange().expectBody(String.class).returnResult();
        return request.contentType(MediaType.APPLICATION_JSON).body(body).exchange()
                .expectBody(String.class).returnResult();
    }

    private JsonNode body(EntityExchangeResult<String> result) {
        try {
            return json.readTree(result.getResponseBody());
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void assertProblem(EntityExchangeResult<String> result,
            int status, String code) {
        assertThat(result.getStatus().value()).isEqualTo(status);
        assertThat(body(result).path("code").asString()).isEqualTo(code);
    }

    private JsonNode lastAudit() {
        try {
            JsonNode audit = json.readTree(client.get().uri("/_engine/audit").exchange().expectStatus().isOk()
                    .expectBody(String.class).returnResult().getResponseBody());
            return audit.get(audit.size() - 1).path("record");
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void assertAudit(String code) {
        assertThat(lastAudit().path("code").asString()).isEqualTo(code);
    }

    private void assertDenied(HttpMethod method, String uri, Object body) {
        var signedOut = request(method, uri, "", body);
        assertThat(signedOut.getStatus().value()).isEqualTo(401);
        String reader = session("u5");
        assertThat(request(method, uri, reader, body).getStatus().value()).isEqualTo(403);
    }

    @Test
    void suspended_admin_is_refused_by_an_access_act() {
        String cookie = session("u3");
        jdbc.update("UPDATE users SET suspended_at='2026-06-25T08:40:00Z' WHERE id='u3'");
        assertThat(put("/api/access/users/u4/roles", cookie, Map.of("roleIds", List.of("reader")))
                .getStatus().value()).isEqualTo(401);
    }
}
