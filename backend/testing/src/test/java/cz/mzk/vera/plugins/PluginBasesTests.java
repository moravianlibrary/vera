package cz.mzk.vera.plugins;

import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.iterations.IterationCheckRun;
import cz.mzk.vera.pluginhost.PluginInstances;
import cz.mzk.vera.plugin.records.Document;
import cz.mzk.vera.tasks.RunSets;
import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
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

// PLG-bases: an instance limited to some catalog bases is not called for a record from another.
@SpringBootTest(classes = VeraTestingApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class PluginBasesTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    @Autowired
    private TemplateResetService resetService;
    @Autowired
    private DSLContext dsl;
    @Autowired
    private IterationCheckRun checks;
    @Autowired
    private RunSets runSets;

    @BeforeEach
    void reset() {
        resetService.reset("base", true);
    }

    @Test
    void anInstanceReadsEveryRecordOrOnlyItsBases() {
        assertThat(new PluginInstances.Instance("pi1", "Any", List.of()).reads(null)).isTrue();
        PluginInstances.Instance limited = new PluginInstances.Instance("pi1", "MZK", List.of("MZK01", "MZK03"));
        assertThat(limited.reads("MZK03-000120447")).isTrue();
        assertThat(limited.reads("MZK05-000004412")).isFalse();
        assertThat(limited.reads("NKC01-002345678")).isFalse();
        assertThat(limited.reads(null)).isFalse();
    }

    @Test
    void aRestrictionLimitedToOtherBasesIsNotCalled() {
        Document record = new Document("D6", "MZK05-000004412", null, "", "Monograph", null);
        assertThat(restrictionInstances(record)).contains("pi28");

        limit("pi28", "[\"NKC01\"]");
        assertThat(restrictionInstances(record)).doesNotContain("pi28");

        limit("pi28", "[\"MZK05\"]");
        assertThat(restrictionInstances(record)).contains("pi28");
    }

    @Test
    void aLimitedInstanceRunsOnlyOnItsBases() {
        int every = runSets.forInstance(dsl, "pi9").size();
        limit("pi9", "[\"MZK05\"]");
        List<RunSets.Target> limited = runSets.forInstance(dsl, "pi9");

        assertThat(limited.size()).isLessThan(every);
        assertThat(limited).allSatisfy(target -> assertThat(dsl.select(DOCUMENTS.CATALOG_ID).from(DOCUMENTS)
                .where(DOCUMENTS.ID.eq(target.documentId())).fetchOne(DOCUMENTS.CATALOG_ID)).startsWith("MZK05-"));
    }

    @Test
    void basesAreSavedOnTheKindsThatReadRecordsAndShownInTheDetail() {
        String cookie = session("u3");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("names", Map.of("cs", "Česká autorská práva", "en", "Czech copyright"));
        body.put("configuration", Map.of("years", "70", "authority", "NKC", "unknown_after", "1900"));
        body.put("linkedCategoryId", null);
        body.put("catalogBases", List.of("MZK01", "MZK03", "MZK01"));
        body.put("settings", null);
        client.put().uri("/api/plugin-instances/pi28").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.catalogBases.length()").isEqualTo(2)
                .jsonPath("$.catalogBases[1]").isEqualTo("MZK03");

        body.remove("catalogBases");
        client.put().uri("/api/plugin-instances/pi28").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.catalogBases.length()").isEqualTo(2);

        body.put("catalogBases", List.of("mzk01"));
        client.put().uri("/api/plugin-instances/pi28").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isEqualTo(422);
    }

    private List<String> restrictionInstances(Document record) {
        return checks.run(record, List.of()).restrictions().stream()
                .map(answer -> answer.instance().id()).toList();
    }

    private void limit(String instanceId, String bases) {
        dsl.update(PLUGIN_INSTANCES).set(PLUGIN_INSTANCES.CATALOG_BASES, JSONB.valueOf(bases))
                .where(PLUGIN_INSTANCES.ID.eq(instanceId)).execute();
    }

    private String session(String userId) {
        String cookie = client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk()
                .expectBody().returnResult().getResponseHeaders().getFirst("Set-Cookie");
        return cookie.substring(0, cookie.indexOf(';'));
    }
}
