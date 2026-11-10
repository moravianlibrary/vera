package cz.mzk.vera.watchlists;

import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.testing.VeraTestingApplication;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.jooq.DSLContext;
import org.jooq.ExecuteContext;
import org.jooq.ExecuteListener;
import org.jooq.ExecuteListenerProvider;
import org.jooq.impl.DefaultExecuteListenerProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

// WATCH-model; WATCH-audience; WATCH-delivery; WATCH-push.
@SpringBootTest(classes = VeraTestingApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class WatchlistsTests {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18");

    @Autowired
    private RestTestClient client;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private DSLContext dsl;

    @BeforeEach
    void reset() {
        client.post().uri("/_engine/reset").contentType(MediaType.APPLICATION_JSON)
                .body("{\"seed\":\"base\",\"frozen\":true}")
                .exchange().expectStatus().isOk();
    }

    @Test
    void readsSeededWatchlistsAndDeliveryChannelsForCurator() {
        String cookie = session("u3");
        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[0].id").isEqualTo("W-shared-1")
                .jsonPath("$[0].viewer.push").isEqualTo(true);
        client.get().uri("/api/session/watchlist-channels").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[0].id").isEqualTo("pi16")
                .jsonPath("$[0].canReach").isEqualTo(true)
                .jsonPath("$[2].reach.claim").isEqualTo("slack_id")
                .jsonPath("$[2].canReach").isEqualTo(true);
        client.get().uri("/api/session/push-devices").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.deviceCount").isEqualTo(0);
    }

    @Test
    void administratorReadsItsSharedWatchlistsAgainstDocumentQueries() {
        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, session("u2"))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[0].id").isEqualTo("W-shared-1")
                .jsonPath("$[1].itemCount").isEqualTo(2)
                .jsonPath("$[2].itemCount").isEqualTo(10)
                .jsonPath("$[3].itemCount").isEqualTo(9)
                .jsonPath("$[4].itemCount").isEqualTo(2);
    }

    @Test
    void claimBasedDeliveryReportsUnreachableWhenIdentityHasNoClaim() {
        jdbc.update("UPDATE user_identities SET claims = '{}' WHERE user_id = 'u3'");
        client.get().uri("/api/session/watchlist-channels").header(HttpHeaders.COOKIE, session("u3"))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[2].canReach").isEqualTo(false)
                .jsonPath("$[2].reach.claim").isEqualTo("slack_id");
    }

    @Test
    void registersPushDeviceIdempotentlyForItsOwner() {
        String cookie = session("u3");
        String body = "{\"endpoint\":\"https://push.example/device-a\","
                + "\"keys\":{\"p256dh\":\"key\",\"auth\":\"secret\"}}";
        client.post().uri("/api/session/push-devices").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.deviceCount").isEqualTo(1);
        client.post().uri("/api/session/push-devices").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.deviceCount").isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM push_devices WHERE user_id='u3'", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void createsChangesViewsAndDeletesPersonalWatchlist() {
        String cookie = session("u3");
        String body = "{\"name\":\"Personal test\",\"view\":\"documents\","
                + "\"filter\":{\"q\":\"unique-watchlist-test\"},\"audience\":{\"kind\":\"personal\"}}";
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isCreated()
                .expectBody().jsonPath("$.name").isEqualTo("Personal test").jsonPath("$.id").exists();
        client.patch().uri("/api/watchlists/W-u3-documents-1/viewer").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"position\":2,\"channels\":{\"pi18\":true}}")
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.channels.pi18.isOn").isEqualTo(true)
                .jsonPath("$.channels.pi18.since").exists();
        client.post().uri("/api/watchlists/W-u3-documents-1/seen").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.seenAt").exists();
        client.delete().uri("/api/watchlists/W-u3-documents-1").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isNoContent();
    }

    @Test
    void newWatchlistTakesTheLastViewerPosition() {
        String cookie = session("u3");
        String body = "{\"name\":\"Last position test\",\"view\":\"documents\","
                + "\"filter\":{\"q\":\"last-position-test\"},"
                + "\"audience\":{\"kind\":\"personal\"}}";
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isCreated();

        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[5].name").isEqualTo("Last position test")
                .jsonPath("$[5].viewer.position").isEqualTo(5);
    }

    @Test
    void recordedReadsUsePositionsAfterEarlierUsersWatchlistsWereMaterialized() {
        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, session("u3"))
                .exchange().expectStatus().isOk();

        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, session("u8"))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[0].viewer.position").isEqualTo(0)
                .jsonPath("$[1].viewer.position").isEqualTo(1)
                .jsonPath("$[2].id").isEqualTo("W-u8-documents-1")
                .jsonPath("$[2].viewer.position").isEqualTo(15)
                .jsonPath("$[3].viewer.position").isEqualTo(16)
                .jsonPath("$[4].viewer.position").isEqualTo(17);
    }

    @Test
    void recordedAdminActionsKeepTheViewerPositionsCreatedBySeen() {
        String cookie = session("u3");
        String draft = "{\"name\":\"Recording watchlist\",\"view\":\"documents\","
                + "\"filter\":{\"q\":\"recording-watchlist-unique\"},"
                + "\"audience\":{\"kind\":\"personal\"}}";
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body(draft).exchange().expectStatus().isCreated();
        client.patch().uri("/api/watchlists/W-u3-documents-1/viewer").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body("{\"position\":2,\"channels\":{\"pi18\":true}}")
                .exchange().expectStatus().isOk();
        client.post().uri("/api/watchlists/W-u3-documents-1/seen").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isOk();

        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[0].id").isEqualTo("W-shared-1")
                .jsonPath("$[0].viewer.position").isEqualTo(1)
                .jsonPath("$[1].id").isEqualTo("W-shared-2")
                .jsonPath("$[1].viewer.position").isEqualTo(2)
                .jsonPath("$[2].id").isEqualTo("W-u3-documents-1")
                .jsonPath("$[2].viewer.position").isEqualTo(2)
                .jsonPath("$[3].viewer.position").isEqualTo(3)
                .jsonPath("$[4].viewer.position").isEqualTo(4)
                .jsonPath("$[5].name").isEqualTo("Recording watchlist")
                .jsonPath("$[5].viewer.position").isEqualTo(5);
    }

    @Test
    void firstBaseDocumentWatchlistReadsForSevenPeopleFinishWithinOneAndAHalfSeconds() {
        AtomicInteger queries = new AtomicInteger();
        ExecuteListener listener = new ExecuteListener() {
            @Override
            public void executeStart(ExecuteContext context) {
                queries.incrementAndGet();
            }
        };
        ExecuteListenerProvider[] original = dsl.configuration().executeListenerProviders();
        ExecuteListenerProvider[] instrumented = Arrays.copyOf(original, original.length + 1);
        instrumented[original.length] = new DefaultExecuteListenerProvider(listener);
        dsl.configuration().set(instrumented);
        try {
            long startedAt = System.nanoTime();
            for (String userId : List.of("u3", "u8", "u2", "u4", "u5", "u10", "u9")) {
                queries.set(0);
                readDocumentWatchlists(userId, queries);
                System.out.printf("watchlist GET %s: %d ms, %d SQL executions%n", userId,
                        lastReadMillis, queries.get());
                assertThat(lastReadMillis).as("%s first read took %d ms", userId, lastReadMillis)
                        .isLessThan(500);
            }
            long elapsedMillis = (System.nanoTime() - startedAt) / 1_000_000;
            assertThat(elapsedMillis).as("seven first document watchlist reads took %d ms", elapsedMillis)
                    .isLessThan(1_500);
        } finally {
            dsl.configuration().set(original);
        }
    }

    @Test
    void rejectsBadPageFilterAndKeepsAudienceAndPermissionRefusals() {
        String cookie = session("u3");
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"name\":\"Bad\",\"view\":\"documents\",\"filter\":{"
                        + "\"status\":\"Available\"},\"audience\":{\"kind\":\"personal\"}}")
                .exchange().expectStatus().isEqualTo(422).expectBody()
                .jsonPath("$.type").isEqualTo("https://vera.mzk.cz/problems/watchlist.invalid_filter");
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, session("u5"))
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"name\":\"Personal\",\"view\":\"documents\",\"filter\":{},"
                        + "\"audience\":{\"kind\":\"personal\"}}")
                .exchange().expectStatus().isForbidden().expectBody()
                .jsonPath("$.type").isEqualTo("https://vera.mzk.cz/problems/watchlist.manager_required");
    }

    @Test
    void checksAudienceReachDuplicateAndEveryWatchlistActRefusal() {
        String admin = session("u3");
        String personal = "{\"name\":\"Recording watchlist\",\"view\":\"documents\","
                + "\"filter\":{\"q\":\"recording-watchlist-unique\"},"
                + "\"audience\":{\"kind\":\"personal\"}}";
        String system = "{\"name\":\"Recording shared watchlist\",\"view\":\"documents\","
                + "\"filter\":{\"q\":\"recording-watchlist-unique\"},"
                + "\"audience\":{\"kind\":\"everyone\"}}";
        String reachSystem = system.substring(0, system.length() - 1) + ",\"watchlistId\":null}";
        client.get().uri("/api/watchlists?view=documents&mode=manage-system")
                .header(HttpHeaders.COOKIE, session("u5")).exchange().expectStatus().isForbidden();
        client.post().uri("/api/watchlists/reach").header(HttpHeaders.COOKIE, session("u5"))
                .contentType(MediaType.APPLICATION_JSON).body(reachSystem).exchange().expectStatus().isForbidden();
        client.post().uri("/api/watchlists/reach").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"name\":\"Recording watchlist\",\"view\":\"documents\","
                        + "\"filter\":{\"q\":\"recording-watchlist-unique\"},"
                        + "\"audience\":{\"kind\":\"personal\"},\"watchlistId\":null}")
                .exchange().expectStatus().isOk().expectBody().json("{\"userCount\":0,"
                        + "\"outOfViewCount\":0,\"duplicateCount\":0}");
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, session("u5"))
                .contentType(MediaType.APPLICATION_JSON).body(system).exchange()
                .expectStatus().isForbidden().expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.manager_required");
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON).body(personal).exchange().expectStatus().isCreated();
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON)
                .body(personal.replace("Recording watchlist", "Duplicate"))
                .exchange().expectStatus().isEqualTo(409).expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.already_saved");
        client.post().uri("/api/watchlists").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON)
                .body(personal.replace("\"audience\":{\"kind\":\"personal\"}",
                        "\"audience\":{\"kind\":\"personal\"},\"copyOf\":\"missing\""))
                .exchange().expectStatus().isEqualTo(422).expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.source_unavailable");
        client.patch().uri("/api/watchlists/W-u3-documents-1").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON).body("{\"filter\":{\"status\":\"Available\"}}")
                .exchange().expectStatus().isEqualTo(422).expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.invalid_filter");
        client.patch().uri("/api/watchlists/W-u3-documents-1").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isOk();
        client.patch().uri("/api/watchlists/W-u3-documents-1/viewer").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON).body("{\"channels\":{\"pi18\":\"yes\"}}")
                .exchange().expectStatus().isEqualTo(422);
        client.patch().uri("/api/watchlists/W-shared-1").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"audience\":{\"kind\":\"personal\"}}")
                .exchange().expectStatus().isEqualTo(409).expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.system_to_personal");
        client.patch().uri("/api/watchlists/W-u3-documents-1").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"audience\":{\"kind\":\"everyone\"}}")
                .exchange().expectStatus().isEqualTo(409).expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.personal_to_system");
        client.patch().uri("/api/watchlists/W-u3-documents-2").header(HttpHeaders.COOKIE, admin)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"filter\":{\"priority\":\"Urgent,High\",\"copy\":\"None\"}}")
                .exchange().expectStatus().isEqualTo(409).expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.already_saved");
        client.patch().uri("/api/watchlists/W-shared-2").header(HttpHeaders.COOKIE, session("u8"))
                .contentType(MediaType.APPLICATION_JSON).body("{\"name\":\"Changed\"}")
                .exchange().expectStatus().isForbidden().expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.manager_required");
        client.delete().uri("/api/watchlists/W-shared-2").header(HttpHeaders.COOKIE, session("u8"))
                .exchange().expectStatus().isForbidden().expectBody().jsonPath("$.type")
                .isEqualTo("https://vera.mzk.cz/problems/watchlist.manager_required");
    }

    @Test
    void sharedWatchlistIsOnlyListedForItsAudience() {
        jdbc.update("UPDATE watchlists SET audience = '{\"kind\":\"some\",\"groupIds\":[\"g1\"],\"roleIds\":[]}'::jsonb WHERE id='W-shared-1'");
        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, session("u4"))
                .exchange().expectStatus().isOk().expectBody().json("[]");
    }

    private String session(String userId) {
        String setCookie = client.post().uri("/_engine/sessions")
                .contentType(MediaType.APPLICATION_JSON).body(Map.of("userId", userId))
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult()
                .getResponseHeaders().getFirst(HttpHeaders.SET_COOKIE);
        return setCookie.split(";", 2)[0];
    }

    private long lastReadMillis;

    private void readDocumentWatchlists(String userId, AtomicInteger queries) {
        String cookie = session(userId);
        queries.set(0);
        long startedAt = System.nanoTime();
        client.get().uri("/api/watchlists?view=documents").header(HttpHeaders.COOKIE, cookie)
                .exchange().expectStatus().isOk();
        lastReadMillis = (System.nanoTime() - startedAt) / 1_000_000;
    }
}
