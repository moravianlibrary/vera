package cz.mzk.vera.access;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
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
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// ACT-role-save; ACT-role-delete; ACT-group-save; ACCESS-last-manager; PERM-once-per-role; PERM-requires.
@SpringBootTest(classes = VeraTestingApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class RoleGroupTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired private RestTestClient client;
    @Autowired private TemplateResetService resetService;
    @Autowired private JdbcTemplate jdbc;
    private final JsonMapper json = JsonMapper.builder().build();

    @BeforeEach
    void resetBase() {
        resetService.reset("base", true);
    }

    @Test
    void ACT_role_save_creates_and_names_a_new_role() {
        JsonNode role = body(post("/api/access/roles", session("u3"), draft("New reader")));
        assertThat(role.path("id").asString()).isEqualTo("new-reader");
        assertThat(role.path("isShipped").asBoolean()).isFalse();
        assertAudit("role.created");
    }

    @Test
    void ACT_role_save_refuses_a_taken_role_name() {
        post("/api/access/roles", session("u3"), draft("New reader"));
        assertProblem(post("/api/access/roles", session("u3"), draft("New reader")), 409, "access.name_taken");
    }

    @Test
    void ACT_role_save_refuses_a_missing_permission_requirement() {
        assertProblem(post("/api/access/roles", session("u3"), roleDraft("Invalid",
                List.of(grant("iteration.publish", "custody")))), 422, "role.requires");
    }

    @Test
    void ACT_role_save_updates_a_role() {
        post("/api/access/roles", session("u3"), draft("New reader"));
        JsonNode saved = body(put("/api/access/roles/new-reader", session("u3"), draft("Renamed")));
        assertThat(saved.path("name").asString()).isEqualTo("renamed");
        assertAudit("role.renamed");
    }

    @Test
    void ACT_role_delete_removes_a_role() {
        post("/api/access/roles", session("u3"), draft("New reader"));
        assertThat(delete("/api/access/roles/new-reader", session("u3")).getStatus().value()).isEqualTo(204);
        assertAudit("role.deleted");
    }

    @Test
    void ACT_role_delete_refuses_to_remove_the_last_access_manager() {
        post("/api/access/roles", session("u3"), roleDraft("Admin replacement", List.of(
                grant("access.read", "any"), grant("access.manage", "any"))));
        assertProblem(delete("/api/access/roles/admin", session("u3")), 409, "access.last_manager");
    }

    @Test
    void ACT_role_save_refuses_a_change_that_removes_the_last_access_manager() {
        assertProblem(put("/api/access/roles/admin", session("u3"), roleDraft("Admin",
                List.of(grant("access.read", "any")))), 409, "access.last_manager");
    }

    @Test
    void grants_reject_duplicate_permissions_and_invalid_scopes() {
        assertProblem(post("/api/access/roles", session("u3"), roleDraft("Dup", List.of(
                grant("iteration.read", "custody"), grant("iteration.read", "any")))), 422,
                "role.duplicate_permission");
        assertProblem(post("/api/access/roles", session("u3"), roleDraft("Own", List.of(
                grant("iteration.read", null)))), 422, null);
        assertProblem(post("/api/access/roles", session("u3"), roleDraft("Scope", List.of(
                grant("access.manage", "custody")))), 422, null);
    }

    @Test
    void grants_report_missing_requirements_with_scopes() {
        assertProblem(post("/api/access/roles", session("u3"), roleDraft("Need any",
                List.of(grant("list.create", "any")))), 422, "role.requires");
        JsonNode problem = body(post("/api/access/roles", session("u3"), roleDraft("Need any",
                List.of(grant("list.create", "any")))));
        assertThat(problem.path("detail").asString()).contains(" at any");
        JsonNode noScope = body(post("/api/access/roles", session("u3"), roleDraft("Need own",
                List.of(grant("request.create", null)))));
        assertThat(noScope.path("detail").asString()).isEqualTo("request.create needs request.read_mine");
    }

    @Test
    void role_names_and_ids_follow_engine_rules() {
        JsonNode role = body(post("/api/access/roles", session("u3"), draft("Maps Curator")));
        assertThat(role.path("name").asString()).isEqualTo("maps-curator");
        assertThat(role.path("id").asString()).isEqualTo("maps-curator");
        jdbc.update("UPDATE roles SET name='something else' WHERE id='curator'");
        JsonNode collision = body(post("/api/access/roles", session("u3"), draft("Curator")));
        assertThat(collision.path("id").asString()).isEqualTo("curator-1");
    }

    @Test
    void changed_role_grants_reach_holders_in_session() {
        post("/api/access/roles", session("u3"), roleDraft("new-reader", List.of(
                grant("iteration.read", "custody"), grant("request.read_mine", null))));
        jdbc.update("INSERT INTO user_hand_roles(user_id,role_id,position) VALUES ('u4','new-reader',"
                + "(SELECT coalesce(max(position),-1)+1 FROM user_hand_roles WHERE user_id='u4'))");
        put("/api/access/roles/new-reader", session("u3"), roleDraft("new-reader", List.of(
                grant("request.read_mine", null))));
        JsonNode session = body(client.get().uri("/api/session").header("Cookie", session("u4"))
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult());
        assertThat(session.path("grants").toString()).doesNotContain("iteration.read");
    }

    @Test
    void role_save_description_only_records_renamed_and_no_change_records_nothing() {
        int before = auditCount();
        post("/api/access/roles", session("u3"), draft("New reader"));
        put("/api/access/roles/new-reader", session("u3"), roleDraft("New reader", List.of(
                grant("iteration.read", "custody")), "Updated"));
        assertAudit("role.renamed");
        int changed = auditCount();
        put("/api/access/roles/new-reader", session("u3"), roleDraft("New reader", List.of(
                grant("iteration.read", "custody")), "Updated"));
        assertThat(auditCount()).isEqualTo(changed);
        assertThat(changed).isGreaterThan(before);
    }

    @Test
    void ACT_group_save_creates_saves_and_sets_members() {
        JsonNode group = body(post("/api/access/groups", session("u3"), Map.of("name", "Maps", "description", "")));
        assertThat(group.path("id").asString()).isEqualTo("g4");
        assertThat(group.path("memberIds").toString()).isEqualTo("[]");
        JsonNode saved = body(put("/api/access/groups/g4", session("u3"),
                Map.of("name", "Maps team", "description", "Team")));
        assertThat(saved.path("name").asString()).isEqualTo("Maps team");
        assertAudit("group.changed");
        JsonNode members = body(put("/api/access/groups/g4/members", session("u3"), Map.of("userIds", List.of("u1"))));
        assertThat(members.path("memberIds").toString()).isEqualTo("[\"u1\"]");
        assertAudit("group.members_changed");
    }

    @Test
    void group_members_reject_unknown_users_and_ignore_order_only_changes() {
        put("/api/access/groups/g3/members", session("u3"), Map.of("userIds", List.of("u1", "u2")));
        int count = auditCount();
        put("/api/access/groups/g3/members", session("u3"), Map.of("userIds", List.of("u2", "u1")));
        assertThat(auditCount()).isEqualTo(count);
        assertProblem(put("/api/access/groups/g3/members", session("u3"), Map.of("userIds", List.of("unknown"))),
                404, "not_found");
    }

    @Test
    void all_role_and_group_endpoints_require_manage() {
        List<Request> requests = List.of(
                new Request(HttpMethod.POST, "/api/access/roles", draft("New reader")),
                new Request(HttpMethod.PUT, "/api/access/roles/reader", draft("Reader")),
                new Request(HttpMethod.DELETE, "/api/access/roles/reader", null),
                new Request(HttpMethod.POST, "/api/access/groups", Map.of("name", "Maps", "description", "")),
                new Request(HttpMethod.PUT, "/api/access/groups/g3", Map.of("name", "Maps", "description", "")),
                new Request(HttpMethod.PUT, "/api/access/groups/g3/members", Map.of("userIds", List.of())));
        for (Request request : requests) {
            assertThat(send(request, "").getStatus().value()).isEqualTo(401);
            assertThat(send(request, session("u5")).getStatus().value()).isEqualTo(403);
        }
    }

    @Test
    void endpoint_inventory_includes_all_six_operations() throws Exception {
        JsonNode endpoints = json.readTree(client.get().uri("/_engine/endpoints").exchange().expectStatus().isOk()
                .expectBody(String.class).returnResult().getResponseBody());
        assertThat(endpoints.toString()).contains("roleCreate", "roleSave", "roleDelete",
                "groupCreate", "groupSave", "groupMembers");
    }

    private Map<String, Object> draft(String name) {
        return roleDraft(name, List.of(grant("iteration.read", "custody")));
    }

    private Map<String, Object> roleDraft(String name, List<Map<String, Object>> grants) {
        return roleDraft(name, grants, "");
    }

    private Map<String, Object> roleDraft(String name, List<Map<String, Object>> grants, String description) {
        return Map.of("name", name, "description", description, "grants", grants,
                "proposalBatchLimit", 10, "proposalDailyLimit", 300);
    }

    private Map<String, Object> grant(String permission, String scope) {
        Map<String, Object> grant = new java.util.LinkedHashMap<>();
        grant.put("permission", permission);
        grant.put("scope", scope);
        return grant;
    }

    private String session(String userId) {
        String cookie = client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk()
                .expectBody().returnResult().getResponseHeaders().getFirst("Set-Cookie");
        return cookie.substring(0, cookie.indexOf(';'));
    }

    private EntityExchangeResult<String> post(String uri, String cookie, Object body) {
        return request(HttpMethod.POST, uri, cookie, body);
    }

    private EntityExchangeResult<String> put(String uri, String cookie, Object body) {
        return request(HttpMethod.PUT, uri, cookie, body);
    }

    private EntityExchangeResult<String> delete(String uri, String cookie) {
        return request(HttpMethod.DELETE, uri, cookie, null);
    }

    private EntityExchangeResult<String> request(HttpMethod method, String uri, String cookie, Object body) {
        var request = client.method(method).uri(uri);
        if (!cookie.isEmpty()) request.header("Cookie", cookie);
        if (body == null) return request.exchange().expectBody(String.class).returnResult();
        return request.contentType(MediaType.APPLICATION_JSON).body(body).exchange()
                .expectBody(String.class).returnResult();
    }

    private EntityExchangeResult<String> send(Request request, String cookie) {
        return request(request.method(), request.uri(), cookie, request.body());
    }

    private JsonNode body(EntityExchangeResult<String> result) {
        try {
            return json.readTree(result.getResponseBody());
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void assertProblem(EntityExchangeResult<String> result, int status, String code) {
        assertThat(result.getStatus().value()).isEqualTo(status);
        if (code != null) assertThat(body(result).path("code").asString()).isEqualTo(code);
    }

    private void assertAudit(String code) {
        String lastCode = jdbc.queryForObject(
                "SELECT record->>'code' FROM audit_outbox ORDER BY id DESC LIMIT 1", String.class);
        assertThat(lastCode).isEqualTo(code);
    }

    private int auditCount() { return jdbc.queryForObject("SELECT count(*) FROM audit_outbox", Integer.class); }

    private record Request(HttpMethod method, String uri, Object body) {}
}
