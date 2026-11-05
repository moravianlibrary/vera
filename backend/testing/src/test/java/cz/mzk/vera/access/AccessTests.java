package cz.mzk.vera.access;

import static cz.mzk.vera.db.tables.Tables.USERS;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.session.Caller;
import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

// ACCESS-role-ways; ACCESS-read; ACCESS-suspend.
@SpringBootTest(classes = VeraTestingApplication.class, webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class AccessTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    @Autowired
    private TemplateResetService resetService;
    @Autowired
    private AccessQueries queries;
    @Autowired
    private AccessGuard guard;
    @Autowired
    private DSLContext dsl;

    @BeforeEach
    void reset() {
        resetService.reset("base", true);
    }

    @Test
    void matchesU3InBaseAccessActsRecording() {
        Map<String, Object> expected = new LinkedHashMap<>();
        expected.put("id", "u3");
        expected.put("name", "Petr Dvořák");
        expected.put("kind", "person");
        expected.put("email", "petr.dvorak@mzk.cz");
        expected.put("entry", null);
        expected.put("handRoleIds", List.of("admin"));
        expected.put("mappedRoles", List.of(Map.of(
            "roleId", "staff", "instanceId", "pi22", "claim", "group mzk-staff")));
        expected.put("groupIds", List.of());
        expected.put("identities", List.of(
            Map.of("instanceId", "pi22", "externalId", "pdvorak",
                "lastLoginAt", "2026-06-25T07:01:00.000Z"),
            Map.of("instanceId", "pi24", "externalId", "admin",
                "lastLoginAt", "2026-06-02T07:00:00.000Z")));
        expected.put("suspendedAt", null);
        assertThat(queries.user("u3")).isEqualTo(expected);
    }

    @Test
    void projectsGroupsForRecordedPerson() {
        assertThat(queries.user("u4")).containsEntry("groupIds", List.of("g3"));
    }

    @Test
    void unknownPersonIsEmpty() {
        assertThat(queries.user("missing")).isNull();
    }

    @Test
    void manageCheckRequiresSignedInCaller() {
        assertThat(guard.requireManage(null).getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void manageCheckRequiresPermission() {
        assertThat(guard.requireManage(new Caller("u6", "", "")).getStatusCode().value())
            .isEqualTo(403);
    }

    @Test
    void adminPassesManageCheck() {
        assertThat(guard.requireManage(new Caller("u3", "", ""))).isNull();
    }

    @Test
    void suspendedAdminFailsManageCheck() {
        dsl.update(USERS)
            .set(USERS.SUSPENDED_AT, OffsetDateTime.parse("2026-06-25T08:40:00Z"))
            .where(USERS.ID.eq("u3"))
            .execute();
        assertThat(guard.requireManage(new Caller("u3", "", "")).getStatusCode().value())
            .isEqualTo(403);
    }

    @Test
    void endpointInventoryIncludesAccountAndSettings() {
        String endpoints = client.get().uri("/_engine/endpoints").exchange().expectStatus().isOk()
            .expectBody(String.class).returnResult().getResponseBody();
        assertThat(endpoints).contains("\"account\"", "\"settingsGet\"", "\"settingsPatch\"");
    }
}
