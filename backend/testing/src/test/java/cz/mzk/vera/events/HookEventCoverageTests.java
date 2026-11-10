package cz.mzk.vera.events;

import static cz.mzk.vera.db.tables.Tables.HOOK_EVENTS;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.util.Set;
import java.util.stream.Collectors;
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

// HOOK-events; HOOK-list-transitions: every supported hook code has an explicit act or job case.
@SpringBootTest(classes = VeraTestingApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class HookEventCoverageTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    // BK7d2 owns the catalog adapter record-change work; no catalog record relink act exists yet.
    private static final Set<EventCode> NOT_BUILT = Set.of(EventCode.DOCUMENT_RELINKED);
    private static final Set<EventCode> CASES = Set.of(
            EventCode.REQUEST_CREATED, EventCode.REQUEST_APPROVED, EventCode.REQUEST_DECLINED,
            EventCode.REQUEST_HELD,
            EventCode.ITERATION_INGESTED, EventCode.ITERATION_INGEST_FAILED,
            EventCode.ITERATION_VERDICT_ACCEPTED, EventCode.ITERATION_VERDICT_DENIED,
            EventCode.ITERATION_VERDICT_REVOKED, EventCode.ITERATION_RESTRICTED,
            EventCode.ITERATION_RECLASSIFIED, EventCode.ITERATION_CANCELLED,
            EventCode.ITERATION_NOT_DIGITIZABLE, EventCode.ITERATION_LISTED,
            EventCode.ITERATION_DIGITIZED, EventCode.ITERATION_PUBLISHED,
            EventCode.ITERATION_LINK_ADDED, EventCode.ITERATION_LINK_CHANGED,
            EventCode.ITERATION_LINK_MADE_PRIMARY, EventCode.ITERATION_LINK_REMOVED,
            EventCode.ITERATION_PROPERTY_CHANGED, EventCode.DOCUMENT_PROPERTY_CHANGED,
            EventCode.DOCUMENT_REGISTRY_CHANGED, EventCode.LIST_CREATED, EventCode.LIST_DATES_MOVED,
            EventCode.LIST_STARTED_EARLY, EventCode.LIST_STARTED, EventCode.LIST_MARKED_DONE,
            EventCode.LIST_DELETED, EventCode.RUN_FINISHED, EventCode.RUN_FAILED);

    @Autowired
    private RestTestClient client;
    @Autowired
    private TemplateResetService reset;
    @Autowired
    private DSLContext dsl;

    @BeforeEach
    void loadBase() {
        reset.reset("base", true);
    }

    @Test
    void supportedCasesCoverEveryHookableCatalogueCodeAndListActsWriteEventsOverHttp() {
        Set<EventCode> hookable = java.util.Arrays.stream(EventCode.values())
                .filter(EventCode::hook).collect(Collectors.toSet());
        assertThat(NOT_BUILT).allMatch(EventCode::hook);
        assertThat(CASES).doesNotContainAnyElementsOf(NOT_BUILT);
        assertThat(CASES).containsExactlyInAnyOrderElementsOf(
                hookable.stream().filter(code -> !NOT_BUILT.contains(code)).toList());

        String cookie = session("u2");
        client.post().uri("/api/digitization-lists")
                .header("Cookie", cookie).contentType(MediaType.APPLICATION_JSON)
                .body(java.util.Map.of("name", "Starts today", "startsOn", "2026-06-25",
                        "endsOn", "2026-06-26", "targetPages", 1, "memberIds", java.util.List.of()))
                .exchange().expectStatus().isCreated();
        assertThat(dsl.select(HOOK_EVENTS.CODE).from(HOOK_EVENTS)
                .where(HOOK_EVENTS.SUBJECT_ID.eq("L-2026-017")).fetch(HOOK_EVENTS.CODE))
                .contains("list.created", "list.started");
    }

    private String session(String userId) {
        return client.post().uri("/_engine/sessions").contentType(MediaType.APPLICATION_JSON)
                .body(java.util.Map.of("userId", userId)).exchange().expectStatus().isOk().expectBody()
                .returnResult().getResponseHeaders().getFirst("Set-Cookie").split(";", 2)[0];
    }
}
