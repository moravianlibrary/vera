package cz.mzk.vera.access;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

// ACCESS-custody-live; ACCESS-custody-delete; ACCESS-custody-by-plugins; L8.
@SpringBootTest(classes = VeraTestingApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class AccessCustodyTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void resetBase() {
        client.post().uri("/_engine/reset").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("seed", "base", "frozen", true)).exchange().expectStatus().isOk();
    }

    @Test
    void createsChangesAndAddsCustodyMembersWithAuditRows() {
        String cookie = session("u3");
        client.post().uri("/api/access/custodies").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("names", Map.of("en", "New desk"), "description", "Review"))
                .exchange().expectStatus().isOk().expectBody().jsonPath("$.id").isEqualTo("pc4");
        client.put().uri("/api/access/custodies/pc4").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("names", Map.of("en", "New desk"), "description", "Updated"))
                .exchange().expectStatus().isOk().expectBody().jsonPath("$.description").isEqualTo("Updated");
        client.put().uri("/api/access/custodies/pc4/members").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userIds", java.util.List.of("u1"), "groupIds", java.util.List.of("g1")))
                .exchange().expectStatus().isOk().expectBody().jsonPath("$.memberIds[0]").isEqualTo("u1")
                .jsonPath("$.groupIds[0]").isEqualTo("g1");
        assertThat(jdbc.queryForList("SELECT record->>'code' FROM audit_outbox ORDER BY at", String.class))
                .contains("custody.created", "custody.changed", "custody.members_changed");
    }

    @Test
    void refusesFallbackRenameAndDeleteAndReportsUnknownImpact() {
        String cookie = session("u3");
        client.put().uri("/api/access/custodies/pc0").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("names", Map.of("en", "Changed"), "description", ""))
                .exchange().expectStatus().isEqualTo(422).expectBody().jsonPath("$.code").isEqualTo("access.fallback");
        client.delete().uri("/api/access/custodies/pc0").header("Cookie", cookie)
                .exchange().expectStatus().isEqualTo(422).expectBody().jsonPath("$.code").isEqualTo("access.fallback");
        client.get().uri("/api/access/custodies/missing/impact").header("Cookie", cookie)
                .exchange().expectStatus().isNotFound();
    }

    @Test
    void fallbackImpactIncludesProposalsWithoutCustodyRules() {
        client.get().uri("/api/access/custodies/pc0/impact").header("Cookie", session("u3"))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.openCount").isEqualTo(1)
                .jsonPath("$.toFallbackCount").isEqualTo(1);
    }

    @Test
    void deletingCustodyStartsPlacingRunWithoutPlacingImmediately() {
        String cookie = session("u3");
        client.delete().uri("/api/access/custodies/pc2").header("Cookie", cookie)
                .exchange().expectStatus().isNoContent();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM runs WHERE what='Placing open proposals again'",
                Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM request_placements WHERE custody_id='pc2'",
                Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM audit_outbox WHERE record->>'code'='custody.deleted'",
                Integer.class)).isEqualTo(1);
    }

    @Test
    void deniesCustodyChangesToPersonWithoutAccessManage() {
        client.post().uri("/api/access/custodies").header("Cookie", session("u5"))
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("names", Map.of("en", "No"), "description", ""))
                .exchange().expectStatus().isForbidden();
    }

    @Test
    void custodyNamesRoundTripAndConflictWithinOneLanguage() {
        String cookie = session("u3");
        client.post().uri("/api/access/custodies").header("Cookie", cookie)
                .header("Accept-Language", "cs").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("names", Map.of("cs", "Nová kontrola", "en", "New review"), "description", ""))
                .exchange().expectStatus().isOk().expectBody().jsonPath("$.name").isEqualTo("Nová kontrola")
                .jsonPath("$.names.en").isEqualTo("New review");
        client.post().uri("/api/access/custodies").header("Cookie", cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("names", Map.of("cs", "Nová kontrola", "en", "Different"), "description", ""))
                .exchange().expectStatus().isEqualTo(409);
    }

    private String session(String userId) {
        String cookie = client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("userId", userId)).exchange().expectStatus().isOk()
                .expectBody().returnResult().getResponseHeaders().getFirst("Set-Cookie");
        return cookie.substring(0, cookie.indexOf(';'));
    }
}
