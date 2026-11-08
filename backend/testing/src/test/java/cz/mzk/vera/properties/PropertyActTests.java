package cz.mzk.vera.properties;

import static cz.mzk.vera.db.tables.Tables.AUDIT_OUTBOX;
import static cz.mzk.vera.db.tables.Tables.PROPERTY_DEFINITIONS;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.net.URI;
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
import tools.jackson.databind.json.JsonMapper;

// ACT-property-create; ACT-property-save; ACT-property-delete; DOC-property-fixed; DOC-property-delete.
@SpringBootTest(classes = VeraTestingApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class PropertyActTests {
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
    private JsonMapper json;

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void propertyIndexShowsReadableDefinitionsAndValueCounts() throws Exception {
        JsonNode result = get("/api/properties", session("u3"), 200);
        assertThat(result.path("definitions").size()).isGreaterThan(4);
        assertThat(result.path("definitions").get(0).path("key").asString()).isEqualTo("page_count");
        assertThat(result.path("valueCounts").path("material_type").asInt()).isEqualTo(54);
        assertThat(result.path("definitions").get(0).path("isCatalogFact").asBoolean()).isTrue();
    }

    @Test
    void definesSavesAndDeletesAPropertyWithAuditEvents() throws Exception {
        String cookie = session("u3");
        Map<String, Object> draft = draft("Archive note", "text", null, false, "document", 100);
        JsonNode created = post("/api/properties", cookie, Map.of("key", "archive_note", "draft", draft), 200);
        assertThat(created.path("key").asString()).isEqualTo("archive_note");
        assertThat(created.path("isPredefined").asBoolean()).isFalse();
        assertEvent("property.defined", "archive_note");

        JsonNode impact = get("/api/properties/archive_note/impact", cookie, 200);
        assertThat(impact).isEqualTo(json.readTree("""
                {"valueCount":0,"roleNames":[],"watchlists":[],"intentionNames":[]}
                """));
        client.delete().uri("/api/properties/archive_note").header("Cookie", cookie)
                .exchange().expectStatus().isNoContent();
        assertEvent("property.deleted", "archive_note");
        assertThat(dsl.fetchExists(dsl.selectOne().from(PROPERTY_DEFINITIONS)
                .where(PROPERTY_DEFINITIONS.KEY.eq("archive_note")))).isFalse();
        assertThat(dsl.fetchExists(dsl.selectOne().from(AUDIT_OUTBOX)
                .where(AUDIT_OUTBOX.RECORD.cast(String.class).contains("property.deleted")))).isTrue();
        JsonNode index = get("/api/properties", cookie, 200);
        assertThat(index.path("deletedKeys").toString()).contains("archive_note");
        JsonNode reused = post("/api/properties", cookie,
                Map.of("key", "archive_note", "draft", draft), 409);
        assertThat(reused.path("code").asString()).isEqualTo("property.key_taken");
    }

    @Test
    void changesOnlyMutableFieldsAndWritesChangedEvent() throws Exception {
        String cookie = session("u3");
        Map<String, Object> draft = draft("Large size", "enum", List.of(
                Map.of("value", "A5", "names", names("A5")),
                Map.of("value", "A4", "names", names("A4")),
                Map.of("value", "A3", "names", names("A3")),
                Map.of("value", "A2", "names", names("A2")),
                Map.of("value", "folio", "names", names("Folio"))), false, "document", 100);
        JsonNode saved = put("/api/properties/size", cookie, draft, 200);
        assertThat(saved.path("names").path("en").asString()).isEqualTo("Large size");
        assertEvent("property.changed", "size");
    }

    @Test
    void refusedDefinitionActsWriteNoRowsOrEvents() throws Exception {
        String cookie = session("u3");
        int auditBefore = dsl.fetchCount(dsl.selectFrom(AUDIT_OUTBOX));
        post("/api/properties", cookie, Map.of("key", "size", "draft",
                draft("Duplicate", "text", null, false, "document", 100)), 409);
        JsonNode duplicate = post("/api/properties", cookie, Map.of("key", "duplicate_enum", "draft",
                draft("Duplicate enum", "enum", List.of(
                        Map.of("value", "A", "names", names("A")),
                        Map.of("value", "A", "names", names("Again"))), false, "document", null)), 422);
        assertThat(duplicate.path("code").asString()).isEqualTo("property.duplicate_value");
        JsonNode forbidden = post("/api/properties", session("u4"), Map.of("key", "reader_note", "draft",
                draft("Reader note", "text", null, false, "document", 100)), 403);
        assertThat(forbidden.path("code").asString()).isEqualTo("forbidden");
        JsonNode inUse = put("/api/properties/size", cookie,
                draft("Changed", "text", null, false, "document", 100), 409);
        assertThat(inUse.path("code").asString()).isEqualTo("property.in_use");
        JsonNode enumUsed = put("/api/properties/size", cookie,
                draft("Changed", "enum", List.of(Map.of("value", "A2", "names", names("A2"))),
                        false, "document", 100), 409);
        assertThat(enumUsed.path("code").asString()).isEqualTo("property.value_in_use");
        JsonNode catalogFact = put("/api/properties/title", cookie,
                draft("Changed", "text", null, false, "document", 100), 422);
        assertThat(catalogFact.path("code").asString()).isEqualTo("property.catalog_fact");
        JsonNode predefined = delete("/api/properties/title", cookie, 409);
        assertThat(predefined.path("code").asString()).isEqualTo("property.predefined");
        assertThat(dsl.fetchCount(dsl.selectFrom(AUDIT_OUTBOX))).isEqualTo(auditBefore);
        assertThat(dsl.fetchExists(dsl.selectOne().from(PROPERTY_DEFINITIONS)
                .where(PROPERTY_DEFINITIONS.KEY.eq("duplicate_enum")))).isFalse();
    }

    @Test
    void everyPropertyActRequiresASession() {
        client.get().uri("/api/properties").exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/properties").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("key", "reader_note", "draft",
                        draft("Reader note", "text", null, false, "document", 100)))
                .exchange().expectStatus().isUnauthorized();
        client.put().uri("/api/properties/size").contentType(MediaType.APPLICATION_JSON)
                .body(draft("Size", "text", null, false, "document", 100))
                .exchange().expectStatus().isUnauthorized();
        client.get().uri("/api/properties/size/impact").exchange().expectStatus().isUnauthorized();
        client.delete().uri("/api/properties/size").exchange().expectStatus().isUnauthorized();
    }

    private JsonNode get(String path, String cookie, int status) throws Exception {
        var request = client.get().uri(URI.create(path));
        if (cookie != null) {
            request.header("Cookie", cookie);
        }
        return json.readTree(request.exchange().expectStatus().isEqualTo(status)
                .expectBody(String.class).returnResult().getResponseBody());
    }

    private JsonNode post(String path, String cookie, Object body, int status) throws Exception {
        return json.readTree(client.post().uri(URI.create(path)).header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isEqualTo(status)
                .expectBody(String.class).returnResult().getResponseBody());
    }

    private JsonNode put(String path, String cookie, Object body, int status) throws Exception {
        return json.readTree(client.put().uri(URI.create(path)).header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isEqualTo(status)
                .expectBody(String.class).returnResult().getResponseBody());
    }

    private JsonNode delete(String path, String cookie, int status) throws Exception {
        return json.readTree(client.delete().uri(URI.create(path)).header("Cookie", cookie)
                .exchange().expectStatus().isEqualTo(status).expectBody(String.class).returnResult()
                .getResponseBody());
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }

    private Map<String, Object> draft(String name, String kind, Object values, boolean isList,
            String about, Integer handTier) {
        Map<String, Object> type = new java.util.LinkedHashMap<>();
        type.put("kind", kind);
        if (kind.equals("enum")) {
            type.put("values", values);
        }
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("names", names(name));
        result.put("visibility", "staff");
        result.put("type", type);
        result.put("isList", isList);
        result.put("about", about);
        result.put("handTier", handTier);
        return result;
    }

    private Map<String, String> names(String english) {
        return Map.of("en", english, "cs", english);
    }

    private void assertEvent(String code, String subjectId) throws Exception {
        List<org.jooq.JSONB> rows = dsl.select(AUDIT_OUTBOX.RECORD).from(AUDIT_OUTBOX)
                .orderBy(AUDIT_OUTBOX.AT.desc()).limit(10).fetch(AUDIT_OUTBOX.RECORD);
        assertThat(rows).anySatisfy(record -> {
            try {
                JsonNode event = json.readTree(record.data());
                assertThat(event.path("code").asString()).isEqualTo(code);
                assertThat(event.path("subject").path("id").asString()).isEqualTo(subjectId);
            } catch (Exception exception) {
                throw new AssertionError(exception);
            }
        });
    }
}
