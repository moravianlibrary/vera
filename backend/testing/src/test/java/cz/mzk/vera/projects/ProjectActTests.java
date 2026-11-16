package cz.mzk.vera.projects;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
import java.nio.file.Path;
import java.util.Map;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// ACT-project-create; ACT-project-save; ACT-project-members; ACT-project-approve; ACT-project-reject; ACT-project-delete.
@SpringBootTest(classes = VeraTestingApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class ProjectActTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    @Autowired
    private TemplateResetService reset;
    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    static Stream<String> projectScenarios() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-projects.json").toFile());
        return Stream.of("create-project", "preview-project-change", "save-project",
                "set-project-members", "decide-project", "reject-project", "delete-project", "project-refusals");
    }

    @ParameterizedTest
    @MethodSource("projectScenarios")
    void recordedActScenarioMatchesHttpAndFollowUpReads(String name) throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-projects.json").toFile());
        JsonNode scenario = StreamSupport.stream(recording.path("scenarios").spliterator(), false)
                .filter(candidate -> name.equals(candidate.path("name").asString())).findFirst().orElseThrow();
        for (JsonNode call : scenario.path("calls")) {
            String method = call.path("method").asString();
            String path = call.path("path").asString();
            String cookie = session(call.path("as").asString());
            Map<String, Integer> before = call.path("status").asInt() >= 400 ? actWriteCounts() : Map.of();
            RestTestClient.RequestBodySpec request = client.method(HttpMethod.valueOf(method))
                    .uri(URI.create(path)).header("Cookie", cookie);
            if (call.has("requestBody")) {
                request.contentType(MediaType.APPLICATION_JSON).body(call.path("requestBody").toString());
            }
            var response = request.exchange().expectBody(String.class).returnResult();
            assertThat(response.getStatus().value()).as(name + " " + method + " " + path)
                    .isEqualTo(call.path("status").asInt());
            if (call.path("status").asInt() >= 400) {
                assertThat(actWriteCounts()).as(name + " refusal wrote data at " + path).isEqualTo(before);
            }
            // LC-PROJ-decide: refreshed approval reads follow the fixed mock's pending flag behavior.
            boolean refreshedApprovalBody = "decide-project".equals(name)
                    && ("POST".equals(method) || "/api/projects/overview".equals(path)
                            || "/api/projects/p8".equals(path));
            if (call.has("body") && call.path("status").asInt() != 204 && !refreshedApprovalBody) {
                assertMatches(call.path("body"), mapper.readTree(response.getResponseBody()), name, path);
            }
        }
    }

    @Test
    void createSaveAndDeleteKeepProjectIntentionTogether() {
        String cookie = session("u8");
        String body = "{\"name\":\"Act project\",\"description\":\"Initial\","
                + "\"startsOn\":\"2026-09-01\",\"endsOn\":\"2027-08-31\",\"targetPages\":1000}";
        var created = client.post().uri("/api/projects").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isCreated()
                .expectBody(String.class).returnResult();
        JsonNode detail = mapper.readTree(created.getResponseBody());
        String projectId = detail.path("row").path("project").path("id").asString();
        String intentionId = detail.path("row").path("intention").path("id").asString();
        assertThat(jdbc.queryForObject("SELECT project_id FROM intentions WHERE id=?", String.class, intentionId))
                .isEqualTo(projectId);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM events WHERE subject_id=? AND code='project.created'",
                Integer.class, projectId)).isEqualTo(1);

        String changed = "{\"name\":\"Act project changed\",\"description\":\"Saved\","
                + "\"startsOn\":\"2026-10-01\",\"endsOn\":\"2027-09-30\",\"targetPages\":1200}";
        client.put().uri("/api/projects/" + projectId).header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body(changed).exchange().expectStatus().isOk();
        assertThat(jdbc.queryForObject("SELECT name FROM intentions WHERE id=?", String.class, intentionId))
                .isEqualTo("Act project changed");
        assertThat(jdbc.queryForObject("SELECT counts_from::text FROM intentions WHERE id=?", String.class,
                intentionId)).isEqualTo("2026-10-01");
        client.delete().uri("/api/projects/" + projectId).header("Cookie", cookie)
                .exchange().expectStatus().isNoContent();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM intentions WHERE id=?", Integer.class, intentionId))
                .isZero();
    }

    @Test
    void projectDecisionFlagsTakenAsksWithoutCreatingIterations() {
        String cookie = session("u8");
        var dryRun = client.get().uri("/api/projects/p8/decision").header("Cookie", cookie)
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult();
        assertThat(dryRun.getResponseBody()).contains("approves", "skips", "pending");
        int approves = dryRun.getResponseBody().indexOf("\"approves\"");
        int skips = dryRun.getResponseBody().indexOf("\"skips\"");
        int pending = dryRun.getResponseBody().indexOf("\"pending\"");
        assertThat(approves).isLessThan(skips);
        assertThat(skips).isLessThan(pending);
        int ingestJobsBefore = jdbc.queryForObject("SELECT count(*) FROM jobs WHERE kind='ingest'", Integer.class);
        client.post().uri("/api/projects/p8/approve").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body("{\"priority\":\"High\"}")
                .exchange().expectStatus().isOk();
        assertThat(jdbc.queryForObject("SELECT decision FROM requests WHERE id='R35'", String.class))
                .isEqualTo("Pending");
        assertThat(jdbc.queryForObject("SELECT is_after_project_approval FROM requests WHERE id='R35'", Boolean.class))
                .isTrue();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM iterations WHERE request_id='R35'", Integer.class))
                .isZero();
        assertThat(jdbc.queryForObject("SELECT decision FROM requests WHERE id='R34'", String.class))
                .isEqualTo("Pending");
        assertThat(jdbc.queryForObject("SELECT is_after_project_approval FROM requests WHERE id='R34'", Boolean.class))
                .isFalse();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM request_existing_copies WHERE request_id='R34'",
                Integer.class)).isPositive();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM iterations WHERE request_id='R34'", Integer.class))
                .isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM jobs WHERE kind='ingest'", Integer.class))
                .isEqualTo(ingestJobsBefore);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM events WHERE subject_id='p8' "
                + "AND code='project.approved'", Integer.class)).isEqualTo(1);
        JsonNode followUp = mapper.readTree(client.get().uri("/api/projects/p8").header("Cookie", cookie)
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody());
        assertThat(followUp.path("row").path("project").path("state").asString()).isEqualTo("Approved");
        JsonNode r35 = StreamSupport.stream(followUp.path("proposals").spliterator(), false)
                .filter(proposal -> "D31".equals(proposal.path("documentId").asString()))
                .findFirst().orElseThrow();
        assertThat(r35.path("decision").asString()).isEqualTo("Pending");
        assertThat(r35.path("isAfterProjectApproval").asBoolean()).isTrue();
        JsonNode overview = mapper.readTree(client.get().uri("/api/projects/overview").header("Cookie", cookie)
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody());
        JsonNode p8 = StreamSupport.stream(overview.path("rows").spliterator(), false)
                .filter(row -> "p8".equals(row.path("project").path("id").asString()))
                .findFirst().orElseThrow();
        assertThat(p8.path("pending").path("documentCount").asInt()).isEqualTo(2);
        assertThat(p8.path("fundedCount").asInt()).isZero();
        assertThat(p8.path("waiting").path("itemCount").asInt()).isZero();
        var afterApproval = client.get().uri("/api/requests?after=yes").header("Cookie", session("u3"))
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult();
        assertThat(afterApproval.getResponseBody()).contains("R35");
    }

    @Test
    void everyProjectActNeedsASession() {
        client.post().uri("/api/projects").contentType(MediaType.APPLICATION_JSON)
                .body("{\"name\":\"x\",\"description\":\"\",\"startsOn\":\"2026-01-01\","
                        + "\"endsOn\":\"2026-01-02\",\"targetPages\":null}")
                .exchange().expectStatus().isUnauthorized();
        String draft = "{\"name\":\"x\",\"description\":\"\",\"startsOn\":\"2026-01-01\","
                + "\"endsOn\":\"2026-01-02\",\"targetPages\":null}";
        client.post().uri("/api/projects/p8/preview").contentType(MediaType.APPLICATION_JSON).body(draft)
                .exchange().expectStatus().isUnauthorized();
        client.put().uri("/api/projects/p8").contentType(MediaType.APPLICATION_JSON).body(draft)
                .exchange().expectStatus().isUnauthorized();
        client.put().uri("/api/projects/p8/members").contentType(MediaType.APPLICATION_JSON)
                .body("{\"managerId\":\"u8\",\"memberIds\":[\"u8\"],\"memberGroupIds\":[]}")
                .exchange().expectStatus().isUnauthorized();
        client.get().uri("/api/projects/p8/decision").exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/projects/p8/approve").contentType(MediaType.APPLICATION_JSON)
                .body("{\"priority\":\"Normal\"}")
                .exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/projects/p8/reject").contentType(MediaType.APPLICATION_JSON)
                .body("{\"reason\":\"No funding\"}")
                .exchange().expectStatus().isUnauthorized();
        client.delete().uri("/api/projects/p8").exchange().expectStatus().isUnauthorized();
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }

    private Map<String, Integer> actWriteCounts() {
        return Map.of(
                "projects", jdbc.queryForObject("SELECT count(*) FROM projects", Integer.class),
                "members", jdbc.queryForObject("SELECT count(*) FROM project_members", Integer.class),
                "groups", jdbc.queryForObject("SELECT count(*) FROM project_member_groups", Integer.class),
                "intentions", jdbc.queryForObject("SELECT count(*) FROM intentions", Integer.class),
                "requests", jdbc.queryForObject("SELECT count(*) FROM requests", Integer.class),
                "events", jdbc.queryForObject("SELECT count(*) FROM events", Integer.class),
                "audit", jdbc.queryForObject("SELECT count(*) FROM audit_outbox", Integer.class));
    }

    private void assertMatches(JsonNode expected, JsonNode actual, String scenario, String path) {
        if (expected.isString() && expected.asString().startsWith("<") && expected.asString().endsWith(">")) {
            assertThat(actual.isString()).as(path).isTrue();
            assertThat(actual.asString()).as(path).isNotBlank();
            return;
        }
        if (expected.isObject()) {
            assertThat(actual.isObject()).as(path).isTrue();
            assertThat(actual.size()).as(path).isEqualTo(expected.size());
            expected.properties().forEach(entry -> assertMatches(entry.getValue(), actual.path(entry.getKey()),
                    scenario, path + "." + entry.getKey()));
            return;
        }
        if (expected.isArray()) {
            assertThat(actual.isArray()).as(path).isTrue();
            assertThat(actual.size()).as(path).isEqualTo(expected.size());
            for (int index = 0; index < expected.size(); index++) {
                assertMatches(expected.get(index), actual.get(index), scenario, path + "[" + index + "]");
            }
            return;
        }
        if (expected.isNumber() && actual.isNumber()) {
            assertThat(actual.asDouble()).as(path).isEqualTo(expected.asDouble());
            return;
        }
        assertThat(actual).as(path).isEqualTo(expected);
    }
}
