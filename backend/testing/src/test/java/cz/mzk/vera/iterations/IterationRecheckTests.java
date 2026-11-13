package cz.mzk.vera.iterations;

import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PAGE_SOURCES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.time.OffsetDateTime;
import java.util.Map;
import org.jooq.DSLContext;
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

// ACT-recheck; DOC-property-predefined; DOC-property-values; PLG-triggers.
@SpringBootTest(classes = VeraTestingApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class IterationRecheckTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired private RestTestClient client;
    @Autowired private TemplateResetService reset;
    @Autowired private DSLContext dsl;
    @Autowired private JsonMapper json;

    @Test
    void recheckReadsTheSourceAdapterAndNamesTheEarlierTitle() {
        reset.reset("l67-recheck", true);
        recheck();
        assertThat(dsl.select(DOCUMENTS.TITLE).from(DOCUMENTS).where(DOCUMENTS.ID.eq("D1"))
                .fetchOne(DOCUMENTS.TITLE)).isEqualTo("Rechecked title");
        var sources = dsl.select(DOCUMENT_PROPERTY_SOURCES.SOURCE).from(DOCUMENT_PROPERTY_SOURCES)
                .where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq("D1"))
                .and(DOCUMENT_PROPERTY_SOURCES.KEY.eq("title")).fetch(DOCUMENT_PROPERTY_SOURCES.SOURCE);
        assertThat(sources).hasSize(1).allMatch(source -> json.readTree(source.data())
                .path("instanceId").asString().equals("l67-adapter"));
        JsonNode changed = rechecked().path("changed");
        assertThat(changed.size()).isEqualTo(1);
        assertThat(changed.get(0).path("key").asString()).isEqualTo("title");
        assertThat(changed.get(0).path("previous").asString()).isEqualTo("Lidové noviny");
        assertThat(changed.get(0).path("value").asString()).isEqualTo("Rechecked title");
        var event = dsl.select(EVENTS.DATA).from(EVENTS).where(EVENTS.SUBJECT_ID.eq("D1"))
                .and(EVENTS.CODE.eq("document.property_changed")).fetchOne(EVENTS.DATA);
        JsonNode data = json.readTree(event.data());
        assertThat(data.path("key").asString()).isEqualTo("title");
        assertThat(data.path("value").path("from").asString()).isEqualTo("Lidové noviny");
        assertThat(data.path("value").path("to").asString()).isEqualTo("Rechecked title");
    }

    @Test
    void unchangedReadHasNoChangesAndAdvancesTheReadingTime() {
        reset.reset("l67-unchanged", true);
        recheck();
        assertThat(rechecked().path("changed").isEmpty()).isTrue();
        var observed = dsl.select(DOCUMENT_PROPERTY_SOURCES.OBSERVED_AT).from(DOCUMENT_PROPERTY_SOURCES)
                .where(DOCUMENT_PROPERTY_SOURCES.DOCUMENT_ID.eq("D1"))
                .and(DOCUMENT_PROPERTY_SOURCES.KEY.in("title", "material_type", "shelf_mark"))
                .fetch(DOCUMENT_PROPERTY_SOURCES.OBSERVED_AT);
        assertThat(observed).hasSize(3).allMatch(at -> at.isAfter(
                OffsetDateTime.parse("2026-03-11T09:00:00Z")));
    }

    @Test
    void recordChangeCallsOnlyTheTriggeredSourceAndReplacesItsOwnValue() {
        reset.reset("l67-unchanged", true);
        recheck();
        assertThat(dsl.select(DOCUMENT_PAGE_SOURCES.VALUE).from(DOCUMENT_PAGE_SOURCES)
                .where(DOCUMENT_PAGE_SOURCES.DOCUMENT_ID.eq("D1"))
                .and(DOCUMENT_PAGE_SOURCES.SOURCE.eq("manual")).fetchOne(DOCUMENT_PAGE_SOURCES.VALUE))
                .isEqualTo(3333);
        var sources = dsl.selectFrom(ITERATION_PROPERTY_SOURCES)
                .where(ITERATION_PROPERTY_SOURCES.ITERATION_ID.eq("IT1"))
                .and(ITERATION_PROPERTY_SOURCES.KEY.eq("page_count")).fetch();
        assertThat(sources).hasSize(2);
        for (var source : sources) {
            String instance = json.readTree(source.getSource().data()).path("instanceId").asString();
            assertThat(json.readTree(source.getValue().data()).asInt()).isEqualTo(
                    instance.equals("pi6") ? 111 : 222);
            if (instance.equals("pi6")) {
                assertThat(source.getObservedAt()).isAfter(OffsetDateTime.parse("2026-03-11T09:00:00Z"));
            } else {
                assertThat(source.getObservedAt()).isEqualTo(OffsetDateTime.parse("2026-03-11T09:00:00Z"));
            }
        }
    }

    @Test
    void theRecheckActNamesItsCause() {
        reset.reset("l67-unchanged", true);
        recheck();
        assertThat(rechecked().path("by").asString()).isEqualTo("act");
    }

    @Test
    void aCatalogRunNamesItsCause() {
        reset.reset("l67-unchanged", true);
        String cookie = session("u3");
        client.post().uri("/api/plugin-instances/l67-adapter/run").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isOk();
        client.post().uri("/_engine/jobs/run").exchange().expectStatus().isOk();
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("advance", Map.of("minutes", 1))).exchange().expectStatus().isOk();
        client.post().uri("/_engine/jobs/run").exchange().expectStatus().isOk();
        assertThat(rechecked().path("by").asString()).isEqualTo("catalog_change");
    }

    private void recheck() {
        client.post().uri("/api/iterations/IT1/recheck").header("Cookie", session("u8"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of()).exchange().expectStatus().isOk();
    }

    private JsonNode rechecked() {
        var event = dsl.select(EVENTS.DATA).from(EVENTS).where(EVENTS.SUBJECT_ID.eq("IT1"))
                .and(EVENTS.CODE.eq("iteration.rechecked"))
                .orderBy(EVENTS.AT.desc()).limit(1).fetchOne(EVENTS.DATA);
        assertThat(event).isNotNull();
        return json.readTree(event.data());
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }
}
