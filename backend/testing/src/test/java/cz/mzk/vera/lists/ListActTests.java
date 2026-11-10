package cz.mzk.vera.lists;

import static cz.mzk.vera.db.tables.Tables.DIGITIZATION_LISTS;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.HOOK_EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.JOBS;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import cz.mzk.vera.events.HookPayloads;
import cz.mzk.vera.db.tables.tables.records.HookEventsRecord;
import java.net.URI;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// ACT-list-create; ACT-list-save; ACT-list-start; ACT-list-done; ACT-list-delete; ACT-list-not-digitizable.
@SpringBootTest(classes = VeraTestingApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class ListActTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    @Autowired
    private TemplateResetService reset;
    @Autowired
    private DSLContext dsl;
    @Autowired
    private HookPayloads hookPayloads;

    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void createsFutureListAndStartsMembersThroughTheDueJob() throws Exception {
        String cookie = session("u2");
        JsonNode created = post("/api/digitization-lists", cookie, Map.of(
                "name", "Next Monday", "startsOn", "2026-06-29", "endsOn", "2026-07-03",
                "targetPages", 1000, "memberIds", List.of("IT31")), 201);
        assertThat(created.path("row").path("list").path("id").asString()).isEqualTo("L-2026-017");
        assertThat(created.path("members").get(0).path("iteration").path("progress").asString())
                .isEqualTo("Planned");
        assertThat(dsl.fetchExists(dsl.selectOne().from(EVENTS)
                .where(EVENTS.SUBJECT_ID.eq("L-2026-017").and(EVENTS.CODE.eq("list.created"))))).isTrue();
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("at", "2026-06-29T00:00:00.000Z")).exchange().expectStatus().isOk();
        client.post().uri("/_engine/jobs/run").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of()).exchange().expectStatus().isOk();
        assertThat(dsl.select(ITERATIONS.PROGRESS).from(ITERATIONS).where(ITERATIONS.ID.eq("IT31"))
                .fetchOne(ITERATIONS.PROGRESS)).isEqualTo("InProgress");
        assertThat(dsl.selectFrom(EVENTS).where(EVENTS.SUBJECT_ID.eq("L-2026-017")
                .and(EVENTS.CODE.eq("list.started"))).fetch()).isEmpty();
        HookEventsRecord hookEvent = dsl.selectFrom(HOOK_EVENTS).where(HOOK_EVENTS.SUBJECT_ID.eq("L-2026-017")
                .and(HOOK_EVENTS.CODE.eq("list.started"))).fetchOne();
        assertThat(hookEvent).isNotNull();
        hookPayloads.validate(hookPayloads.build("H-test", "Test", "D-test", 1,
                List.of(hookEvent.getId()), false));
    }

    @Test
    void createsRecordedListAndReadsItBack() throws Exception {
        replay("create-list");
    }

    @Test
    void refusesRecordedCreateWithEndBeforeStartWithoutWrites() throws Exception {
        replay("create-list-ends-before-start");
    }

    @Test
    void refusesRecordedCreateMembersWithoutWrites() throws Exception {
        replay("create-list-refusals");
    }

    @Test
    void savesRecordedListAndReadsItBack() throws Exception {
        replay("save-list");
    }

    @Test
    void startsRecordedListEarlyAndReadsItBack() throws Exception {
        replay("start-list-early");
    }

    @Test
    void marksRecordedListDoneAndReadsItBack() throws Exception {
        replay("mark-list-done");
    }

    @Test
    void deletesRecordedListAndReadsItBack() throws Exception {
        replay("delete-list");
    }

    @Test
    void marksRecordedMemberNotDigitizableAndReadsItBack() throws Exception {
        replay("mark-member-not-digitizable");
    }

    @Test
    void createsListStartingTodayWithoutQueueingAJob() throws Exception {
        String cookie = session("u2");
        int jobsBefore = dsl.selectCount().from(JOBS).fetchOne(0, int.class);
        JsonNode created = post("/api/digitization-lists", cookie, Map.of(
                "name", "Starts today", "startsOn", "2026-06-25", "endsOn", "2026-06-26",
                "targetPages", 1, "memberIds", List.of()), 201);
        assertThat(created.path("row").path("state").asString()).isEqualTo("InProgress");
        String id = created.path("row").path("list").path("id").asString();
        assertThat(dsl.selectCount().from(JOBS).fetchOne(0, int.class)).isEqualTo(jobsBefore);
        assertThat(dsl.fetchExists(dsl.selectOne().from(EVENTS)
                .where(EVENTS.SUBJECT_ID.eq(id).and(EVENTS.CODE.eq("list.started"))))).isFalse();
        HookEventsRecord started = dsl.selectFrom(HOOK_EVENTS).where(HOOK_EVENTS.SUBJECT_ID.eq(id)
                .and(HOOK_EVENTS.CODE.eq("list.started"))).fetchOne();
        assertThat(started).isNotNull();
        HookEventsRecord createdHook = dsl.selectFrom(HOOK_EVENTS).where(HOOK_EVENTS.SUBJECT_ID.eq(id)
                .and(HOOK_EVENTS.CODE.eq("list.created"))).fetchOne();
        assertThat(started.getCorrelationId()).isEqualTo(createdHook.getCorrelationId());
        tools.jackson.databind.node.ObjectNode payload = hookPayloads.build("H-test", "Test", "D-test", 1,
                List.of(started.getId()), false);
        hookPayloads.validate(payload);
        assertThat(payload.path("events").get(0).path("subject").path("url").asString())
                .isEqualTo("http://localhost/lists/" + id);
    }

    @Test
    void startsMarksAndDeletesLists() throws Exception {
        String cookie = session("u2");
        JsonNode started = post("/api/digitization-lists/L-2026-015/start", cookie, Map.of(), 200);
        assertThat(started.path("row").path("state").asString()).isEqualTo("InProgress");
        JsonNode marked = post("/api/digitization-lists/L-2026-015/items/IT25/not-digitizable", cookie,
                Map.of("message", "Cannot safely scan"), 200);
        assertThat(marked.path("row").path("notDigitizableCount").asInt()).isEqualTo(1);
        JsonNode preview = get("/api/digitization-lists/L-2026-015/done", cookie, 200);
        assertThat(preview.path("notDigitizableCount").asInt()).isEqualTo(1);

        JsonNode done = post("/api/digitization-lists/L-2026-014/done", cookie, Map.of(), 200);
        assertThat(done.path("row").path("state").asString()).isEqualTo("Done");
        get("/api/digitization-lists/L-2026-015/deletion", cookie, 200);
        client.delete().uri("/api/digitization-lists/L-2026-016").header("Cookie", cookie)
                .exchange().expectStatus().isNoContent();
        assertThat(dsl.fetchExists(dsl.selectOne().from(DIGITIZATION_LISTS)
                .where(DIGITIZATION_LISTS.ID.eq("L-2026-016")))).isFalse();
    }

    @Test
    void everyActRequiresASession() {
        client.post().uri("/api/digitization-lists").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("name", "x", "startsOn", "2026-06-25", "endsOn", "2026-06-26",
                        "targetPages", 1, "memberIds", List.of())).exchange().expectStatus().isUnauthorized();
        client.put().uri("/api/digitization-lists/L-2026-014").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("name", "x", "startsOn", "2026-06-25", "endsOn", "2026-06-26",
                        "targetPages", 1, "memberIds", List.of())).exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/digitization-lists/L-2026-014/start").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of()).exchange().expectStatus().isUnauthorized();
        client.get().uri("/api/digitization-lists/L-2026-014/done").exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/digitization-lists/L-2026-014/done").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of()).exchange().expectStatus().isUnauthorized();
        client.get().uri("/api/digitization-lists/L-2026-014/deletion").exchange().expectStatus().isUnauthorized();
        client.delete().uri("/api/digitization-lists/L-2026-014").exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/digitization-lists/L-2026-014/items/IT5/not-digitizable")
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("message", "x"))
                .exchange().expectStatus().isUnauthorized();
    }

    private void replay(String scenarioName) throws Exception {
        JsonNode recording = mapper.readTree(Path.of("../../replay/recordings/base-lists.json").toFile());
        JsonNode scenario = null;
        for (JsonNode candidate : recording.path("scenarios")) {
            if (scenarioName.equals(candidate.path("name").asString())) {
                scenario = candidate;
                break;
            }
        }
        assertThat(scenario).isNotNull();
        for (JsonNode call : scenario.path("calls")) {
            String cookie = session(call.path("as").asString());
            int status = call.path("status").asInt();
            boolean refusal = status >= 400;
            String listsBefore = dsl.selectFrom(DIGITIZATION_LISTS).orderBy(DIGITIZATION_LISTS.ID)
                    .fetch().toString();
            String iterationsBefore = dsl.select(ITERATIONS.ID, ITERATIONS.LIST_ID, ITERATIONS.PROGRESS)
                    .from(ITERATIONS).orderBy(ITERATIONS.ID).fetch().toString();
            int eventsBefore = dsl.selectCount().from(EVENTS).fetchOne(0, int.class);
            int jobsBefore = dsl.selectCount().from(JOBS).fetchOne(0, int.class);
            var response = exchange(call, cookie);
            response.expectStatus().isEqualTo(status);
            String responseBody = response.expectBody(String.class).returnResult().getResponseBody();
            if (status == 204) {
                assertThat(responseBody).isNull();
                String listId = call.path("path").asString().substring(
                        call.path("path").asString().lastIndexOf('/') + 1);
                assertThat(dsl.fetchExists(dsl.selectOne().from(DIGITIZATION_LISTS)
                        .where(DIGITIZATION_LISTS.ID.eq(listId)))).isFalse();
                assertThat(dsl.fetchExists(dsl.selectOne().from(EVENTS)
                        .where(EVENTS.SUBJECT_ID.eq(listId).and(EVENTS.CODE.eq("list.deleted"))))).isTrue();
            } else if (call.has("body")) {
                JsonNode actual = mapper.readTree(responseBody);
                assertRecording(call.path("body"), actual);
                assertRecordedDatabaseState(actual);
            } else if (refusal && call.has("code")) {
                assertThat(mapper.readTree(responseBody).path("code").asString())
                        .isEqualTo(call.path("code").asString());
            }
            if (refusal) {
                assertThat(dsl.selectFrom(DIGITIZATION_LISTS).orderBy(DIGITIZATION_LISTS.ID).fetch().toString())
                        .isEqualTo(listsBefore);
                assertThat(dsl.select(ITERATIONS.ID, ITERATIONS.LIST_ID, ITERATIONS.PROGRESS)
                        .from(ITERATIONS).orderBy(ITERATIONS.ID).fetch().toString()).isEqualTo(iterationsBefore);
                assertThat(dsl.selectCount().from(EVENTS).fetchOne(0, int.class)).isEqualTo(eventsBefore);
                assertThat(dsl.selectCount().from(JOBS).fetchOne(0, int.class)).isEqualTo(jobsBefore);
            }
        }
    }

    private org.springframework.test.web.servlet.client.RestTestClient.ResponseSpec exchange(
            JsonNode call, String cookie) {
        String path = call.path("path").asString();
        String method = call.path("method").asString();
        if ("GET".equals(method)) {
            return client.get().uri(URI.create(path)).header("Cookie", cookie).exchange();
        }
        if ("DELETE".equals(method)) {
            return client.delete().uri(path).header("Cookie", cookie).exchange();
        }
        if ("PUT".equals(method)) {
            return client.put().uri(path).header("Cookie", cookie).contentType(MediaType.APPLICATION_JSON)
                    .body(call.path("requestBody")).exchange();
        }
        return client.post().uri(path).header("Cookie", cookie).contentType(MediaType.APPLICATION_JSON)
                .body(call.path("requestBody")).exchange();
    }

    private void assertRecordedDatabaseState(JsonNode body) {
        JsonNode list = body.path("row").path("list");
        if (!list.isObject()) {
            return;
        }
        String listId = list.path("id").asString();
        if (list.path("done").isMissingNode()) {
            return;
        }
        var storedList = dsl.selectFrom(DIGITIZATION_LISTS).where(DIGITIZATION_LISTS.ID.eq(listId)).fetchOne();
        assertThat(storedList).isNotNull();
        JsonNode members = body.path("members");
        for (JsonNode member : members) {
            String iterationId = member.path("iteration").path("id").asString();
            var stored = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq(iterationId)).fetchOne();
            assertThat(stored).isNotNull();
            assertThat(stored.getListId()).isEqualTo(member.path("iteration").path("listId").asString(null));
            assertThat(stored.getProgress()).isEqualTo(member.path("iteration").path("progress").asString());
        }
        JsonNode expectedEvents = body.path("log");
        if (expectedEvents.isArray()) {
            java.util.List<String> expected = new java.util.ArrayList<>();
            for (JsonNode event : expectedEvents) {
                expected.add(event.path("subjectId").asString() + "|" + event.path("code").asString());
            }
            java.util.List<String> actual = dsl.select(EVENTS.SUBJECT_ID, EVENTS.CODE).from(EVENTS)
                    .where(EVENTS.SUBJECT_ID.eq(listId)).orderBy(EVENTS.SUBJECT_ID, EVENTS.CODE)
                    .fetch(record -> record.get(EVENTS.SUBJECT_ID) + "|" + record.get(EVENTS.CODE));
            expected.sort(String::compareTo);
            assertThat(actual).containsExactlyElementsOf(expected);
        }
    }

    private void assertRecording(JsonNode expected, JsonNode actual) {
        assertRecording(expected, actual, "$");
    }

    private void assertRecording(JsonNode expected, JsonNode actual, String pointer) {
        if (expected.isString() && expected.asString().startsWith("<") && expected.asString().endsWith(">")) {
            return;
        }
        if (expected.isObject()) {
            assertThat(actual.isObject()).as("object at %s", pointer).isTrue();
            assertThat(actual.size()).as("fields at %s", pointer).isEqualTo(expected.size());
            expected.properties().forEach(entry -> assertRecording(entry.getValue(), actual.path(entry.getKey()),
                    pointer + "." + entry.getKey()));
        } else if (expected.isArray()) {
            assertThat(actual.size()).as("array at %s", pointer).isEqualTo(expected.size());
            for (int index = 0; index < expected.size(); index++) {
                assertRecording(expected.get(index), actual.get(index), pointer + "[" + index + "]");
            }
        } else if (expected.isNumber() && actual.isNumber()) {
            assertThat(actual.decimalValue().compareTo(expected.decimalValue()))
                    .as("number at %s", pointer).isZero();
        } else {
            assertThat(actual).as("value at %s", pointer).isEqualTo(expected);
        }
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }

    private JsonNode post(String path, String cookie, Object body, int status) throws Exception {
        String value = client.post().uri(path).header("Cookie", cookie).contentType(MediaType.APPLICATION_JSON)
                .body(body).exchange().expectStatus().isEqualTo(status).expectBody(String.class)
                .returnResult().getResponseBody();
        return value == null ? mapper.nullNode() : mapper.readTree(value);
    }

    private JsonNode get(String path, String cookie, int status) throws Exception {
        String value = client.get().uri(URI.create(path)).header("Cookie", cookie).exchange().expectStatus()
                .isEqualTo(status).expectBody(String.class).returnResult().getResponseBody();
        return mapper.readTree(value);
    }
}
