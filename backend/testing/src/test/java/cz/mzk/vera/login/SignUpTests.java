package cz.mzk.vera.login;

import static cz.mzk.vera.db.tables.Tables.LOCAL_PASSWORDS;
import static cz.mzk.vera.db.tables.Tables.OUTBOX;
import static cz.mzk.vera.db.tables.Tables.PENDING_SIGN_UPS;
import static cz.mzk.vera.db.tables.Tables.USER_MAPPED_ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_IDENTITIES;
import static org.assertj.core.api.Assertions.assertThat;

import cz.mzk.vera.plugin.PasswordCheck;
import cz.mzk.vera.plugin.identity.Identity;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
import cz.mzk.vera.testing.VeraTestingApplication;
import cz.mzk.vera.testing.seeds.TemplateResetService;
import java.util.List;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// ACCESS-sign-up; ACCESS-verify-email; ACCESS-password-reset; ACCESS-local-account.
@SpringBootTest(classes = VeraTestingApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@ActiveProfiles("test")
@Testcontainers
class SignUpTests {
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
    private JsonMapper json;
    @Autowired
    private Passwords passwords;
    @Autowired
    private LocalPasswordStore passwordStore;
    @Autowired
    private PluginCalls calls;

    @BeforeEach
    void reset() {
        resetService.reset("base", true);
    }

    @Test
    void keepsExistingLoginEntryFlagsOnTheBaseSeed() {
        String entries = client.get().uri("/api/login").exchange()
                .expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody();
        assertThat(entries).contains("\"instanceId\":\"pi24\"")
                .contains("\"canSignUp\":true")
                .contains("\"canResetPassword\":true")
                .contains("\"instanceId\":\"pi22\"")
                .contains("\"canSignUp\":false");
    }

    @Test
    void signsUpMailsVerifiesAndOpensSessionWithDefaultRole() throws Exception {
        assertThat(signUp("newuser", "new@example.org").returnResult(String.class).getStatus().value())
                .isEqualTo(202);
        String token = token("Verify your email");
        var confirmed = client.post().uri("/api/email-verification/confirm").contentType(MediaType.APPLICATION_JSON)
                .body("{\"token\":\"" + token + "\"}").exchange().expectStatus().isOk()
                .expectBody(String.class).returnResult();
        assertThat(confirmed.getResponseBody()).contains("/requests");
        String cookie = confirmed.getResponseHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertThat(cookie).contains("vera_session=");
        String userId = dsl.select(USER_IDENTITIES.USER_ID).from(USER_IDENTITIES)
                .where(USER_IDENTITIES.INSTANCE_ID.eq("pi24")).and(USER_IDENTITIES.EXTERNAL_ID.eq("newuser"))
                .fetchOne(USER_IDENTITIES.USER_ID);
        assertThat(userId).isNotNull();
        assertThat(dsl.fetchExists(dsl.selectOne().from(LOCAL_PASSWORDS)
                .where(LOCAL_PASSWORDS.INSTANCE_ID.eq("pi24")).and(LOCAL_PASSWORDS.USERNAME.eq("newuser")))).isTrue();
        assertThat(passwordStore.check("pi24", "newuser", "abcdefghijkl")).isEqualTo(PasswordCheck.MATCHES);
        assertThat(dsl.fetchExists(dsl.selectOne().from(USER_MAPPED_ROLES)
                .where(USER_MAPPED_ROLES.USER_ID.eq(userId)).and(USER_MAPPED_ROLES.ROLE_ID.eq("reader"))
                .and(USER_MAPPED_ROLES.CLAIM.eq("default role")))).isTrue();
        String audit = client.get().uri("/_engine/audit").exchange().expectStatus().isOk()
                .expectBody(String.class).returnResult().getResponseBody();
        assertThat(audit).contains("user.created").contains("sign_up").contains(userId);
        assertThat(client.get().uri("/api/session").header(HttpHeaders.COOKIE, cookie.split(";", 2)[0])
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody())
                .contains("new@example.org");
    }

    @Test
    void removesAnUnusedSignUpAfterAWeek() {
        signUp("expires", "expires@example.org").expectStatus().isAccepted();
        assertThat(dsl.fetchExists(dsl.selectOne().from(PENDING_SIGN_UPS)
                .where(PENDING_SIGN_UPS.USERNAME.eq("expires")))).isTrue();
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                .body("{\"advance\":{\"days\":7}}").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.ran").isEqualTo(1);
        assertThat(dsl.fetchExists(dsl.selectOne().from(PENDING_SIGN_UPS)
                .where(PENDING_SIGN_UPS.USERNAME.eq("expires")))).isFalse();
    }

    @Test
    void keepsAVerifiedSignUpWhenItsExpiryJobRuns() {
        signUp("verified", "verified@example.org").expectStatus().isAccepted();
        String token = token("Verify your email");
        confirm(token).expectStatus().isOk();
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                .body("{\"advance\":{\"days\":7}}").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.ran").isEqualTo(1);
        assertThat(dsl.fetchExists(dsl.selectOne().from(PENDING_SIGN_UPS)
                .where(PENDING_SIGN_UPS.USERNAME.eq("verified")))).isTrue();
    }

    @Test
    void refusesAUsedVerificationToken() {
        signUp("once", "once@example.org").expectStatus().isAccepted();
        String token = token("Verify your email");
        confirm(token).expectStatus().isOk();
        confirm(token).expectStatus().isEqualTo(410);
    }

    @Test
    void rejectsTakenUsernameAndShortPassword() {
        String usernameTaken = signUp("admin", "admin-new@example.org")
                .expectStatus().isEqualTo(422).expectBody(String.class).returnResult().getResponseBody();
        String passwordShort = client.post().uri("/api/signup/pi24").contentType(MediaType.APPLICATION_JSON)
                .body(signUpBody("short", "short@example.org", "12345678901")).exchange()
                .expectStatus().isEqualTo(422).expectBody(String.class).returnResult().getResponseBody();
        assertThat(usernameTaken).contains("access.username_taken").contains("That username is taken.");
        assertThat(passwordShort).contains("access.password_short").contains("The password is too short.");
    }

    @Test
    void refusesSignUpWhenTheIdentityInstanceDoesNotOfferIt() {
        client.post().uri("/api/signup/pi22").contentType(MediaType.APPLICATION_JSON)
                .body(signUpBody("newuser", "new@example.org", "abcdefghijkl"))
                .exchange().expectStatus().isNotFound();
    }

    @Test
    void doesNotEnumerateExistingEmailAddresses() {
        signUp("other", "tomas.marek@muni.cz").expectStatus().isAccepted();
        assertThat(mailSubject("You already have an account")).isTrue();
        assertThat(dsl.selectCount().from(PENDING_SIGN_UPS).fetchOne(0, int.class)).isZero();
    }

    @Test
    void silentlyIgnoresAFilledHoneypot() {
        long before = dsl.selectCount().from(OUTBOX).fetchOne(0, long.class);
        client.post().uri("/api/signup/pi24").contentType(MediaType.APPLICATION_JSON)
                .body("{\"name\":\"Robot\",\"email\":\"bot@example.org\",\"username\":\"bot\",\"password\":\"abcdefghijkl\",\"website\":\"bot\"}").exchange()
                .expectStatus().isAccepted();
        assertThat(dsl.selectCount().from(OUTBOX).fetchOne(0, long.class)).isEqualTo(before);
    }

    @Test
    void limitsVerificationMailToThreePerDayOnMovingClock() {
        signUp("daily0", "daily@example.org").expectStatus().isAccepted();
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                .body("{\"advance\":{\"minutes\":1}}").exchange().expectStatus().isOk();
        signUp("daily1", "daily@example.org").expectStatus().isAccepted();
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                .body("{\"advance\":{\"minutes\":1}}").exchange().expectStatus().isOk();
        signUp("daily2", "daily@example.org").expectStatus().isAccepted();
        var limited = signUp("daily4", "daily@example.org").expectStatus().isEqualTo(429)
                .expectBody(String.class).returnResult().getResponseBody();
        assertThat(limited).contains("access.too_many_verification_emails");
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                .body("{\"advance\":{\"days\":1}}").exchange().expectStatus().isOk();
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                .body("{\"advance\":{\"minutes\":1}}").exchange().expectStatus().isOk();
        signUp("daily-after-window", "daily@example.org").expectStatus().isAccepted();
    }

    @Test
    void mailsAndConsumesAResetToken() {
        client.post().uri("/api/password-reset/pi24").contentType(MediaType.APPLICATION_JSON)
                .body("{\"email\":\"lucie.benesova@gmail.com\"}").exchange().expectStatus().isAccepted();
        String token = token("Set a new password");
        client.post().uri("/api/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .body("{\"token\":\"" + token + "\",\"password\":\"newpassword123\"}")
                .exchange().expectStatus().isNoContent();
        client.post().uri("/api/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .body("{\"token\":\"" + token + "\",\"password\":\"newpassword123\"}")
                .exchange().expectStatus().isEqualTo(410);
    }

    @Test
    void endsEarlierSessionsWhenPasswordIsReset() {
        String oldCookie = client.post().uri("/api/login/pi24").contentType(MediaType.APPLICATION_JSON)
                .body("{\"username\":\"lbenesova\",\"password\":\"first\"}").exchange()
                .expectStatus().isNoContent().returnResult(String.class)
                .getResponseHeaders().getFirst(HttpHeaders.SET_COOKIE);
        client.post().uri("/api/password-reset/pi24").contentType(MediaType.APPLICATION_JSON)
                .body("{\"email\":\"lucie.benesova@gmail.com\"}").exchange().expectStatus().isAccepted();
        String token = token("Set a new password");
        client.post().uri("/api/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .body("{\"token\":\"" + token + "\",\"password\":\"newpassword123\"}").exchange()
                .expectStatus().isNoContent();
        client.get().uri("/api/session").header(HttpHeaders.COOKIE, oldCookie.split(";", 2)[0]).exchange()
                .expectStatus().isUnauthorized();
        var newLogin = client.post().uri("/api/login/pi24").contentType(MediaType.APPLICATION_JSON)
                .body("{\"username\":\"lbenesova\",\"password\":\"newpassword123\"}").exchange()
                .expectStatus().isNoContent().expectBody().returnResult();
        String newCookie = newLogin.getResponseHeaders().getFirst(HttpHeaders.SET_COOKIE);
        client.get().uri("/api/session").header(HttpHeaders.COOKIE, newCookie.split(";", 2)[0]).exchange()
                .expectStatus().isOk();
    }

    @Test
    void asksForUnknownEmailResetWithoutSendingMail() {
        long before = dsl.selectCount().from(OUTBOX).fetchOne(0, long.class);
        client.post().uri("/api/password-reset/pi24").contentType(MediaType.APPLICATION_JSON)
                .body("{\"email\":\"unknown@example.org\"}").exchange().expectStatus().isAccepted();
        assertThat(dsl.selectCount().from(OUTBOX).fetchOne(0, long.class)).isEqualTo(before);
    }

    @Test
    void expiresResetLinkOlderThanOneHour() {
        client.post().uri("/api/password-reset/pi24").contentType(MediaType.APPLICATION_JSON)
                .body("{\"email\":\"lucie.benesova@gmail.com\"}").exchange().expectStatus().isAccepted();
        String token = token("Set a new password");
        client.post().uri("/_engine/clock").contentType(MediaType.APPLICATION_JSON)
                .body("{\"advance\":{\"hours\":2}}").exchange().expectStatus().isOk();
        client.post().uri("/api/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .body("{\"token\":\"" + token + "\",\"password\":\"newpassword123\"}")
                .exchange().expectStatus().isEqualTo(410);
    }

    @Test
    void logsInWithSignedUpPasswordAfterConfirmingAndRejectsWrongPassword() {
        signUp("confirmed", "confirmed@example.org").expectStatus().isAccepted();
        confirm(token("Verify your email")).expectStatus().isOk();
        client.post().uri("/api/login/pi24").contentType(MediaType.APPLICATION_JSON)
                .body("{\"username\":\"confirmed\",\"password\":\"abcdefghijkl\"}")
                .exchange().expectStatus().isNoContent();
        client.post().uri("/api/login/pi24").contentType(MediaType.APPLICATION_JSON)
                .body("{\"username\":\"confirmed\",\"password\":\"wrongpassword\"}")
                .exchange().expectStatus().isUnauthorized();
    }

    @Test
    void resetsBaseAccountWithoutSavedPassword() {
        assertThat(dsl.fetchExists(dsl.selectOne().from(LOCAL_PASSWORDS)
                .where(LOCAL_PASSWORDS.INSTANCE_ID.eq("pi24"))
                .and(LOCAL_PASSWORDS.USERNAME.eq("lbenesova")))).isFalse();
        client.post().uri("/api/password-reset/pi24").contentType(MediaType.APPLICATION_JSON)
                .body("{\"email\":\"lucie.benesova@gmail.com\"}").exchange().expectStatus().isAccepted();
        String token = token("Set a new password");
        client.post().uri("/api/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .body("{\"token\":\"" + token + "\",\"password\":\"newpassword123\"}")
                .exchange().expectStatus().isNoContent();
        client.post().uri("/api/login/pi24").contentType(MediaType.APPLICATION_JSON)
                .body("{\"username\":\"lbenesova\",\"password\":\"first\"}")
                .exchange().expectStatus().isUnauthorized();
        client.post().uri("/api/login/pi24").contentType(MediaType.APPLICATION_JSON)
                .body("{\"username\":\"lbenesova\",\"password\":\"newpassword123\"}")
                .exchange().expectStatus().isNoContent();
    }

    @Test
    void expiresVerificationWhenUsernameIsClaimedMeanwhile() {
        signUp("claimed", "claimed@example.org").expectStatus().isAccepted();
        String token = token("Verify your email");
        dsl.insertInto(USER_IDENTITIES)
                .set(USER_IDENTITIES.USER_ID, "u1")
                .set(USER_IDENTITIES.INSTANCE_ID, "pi24")
                .set(USER_IDENTITIES.EXTERNAL_ID, "claimed")
                .set(USER_IDENTITIES.POSITION, 99)
                .execute();
        confirm(token).expectStatus().isEqualTo(410);
    }

    @Test
    void sendsNewVerificationLinkAndExpiresTheOldOne() {
        signUp("resend", "resend@example.org").expectStatus().isAccepted();
        String oldToken = token("Verify your email");
        client.post().uri("/api/email-verification/pi24").contentType(MediaType.APPLICATION_JSON)
                .body("{\"email\":\"resend@example.org\"}").exchange().expectStatus().isAccepted();
        String newToken = token("Verify your email");
        assertThat(newToken).isNotEqualTo(oldToken);
        confirm(oldToken).expectStatus().isEqualTo(410);
        confirm(newToken).expectStatus().isOk();
    }

    @Test
    void sendsOneNewMailWhenSeveralPendingSignUpsShareAnEmail() {
        signUp("resend-first", "resend-many@example.org").expectStatus().isAccepted();
        signUp("resend-second", "resend-many@example.org").expectStatus().isAccepted();
        int before = dsl.selectCount().from(OUTBOX).where(OUTBOX.RECIPIENT.eq("resend-many@example.org"))
                .fetchOne(0, int.class);
        client.post().uri("/api/email-verification/pi24").contentType(MediaType.APPLICATION_JSON)
                .body("{\"email\":\"resend-many@example.org\"}").exchange().expectStatus().isAccepted();
        int after = dsl.selectCount().from(OUTBOX).where(OUTBOX.RECIPIENT.eq("resend-many@example.org"))
                .fetchOne(0, int.class);
        assertThat(after).isEqualTo(before + 1);
    }

    @Test
    void localPasswordCheckIsScopedToInstance() {
        dsl.insertInto(LOCAL_PASSWORDS).set(LOCAL_PASSWORDS.INSTANCE_ID, "pi24")
                .set(LOCAL_PASSWORDS.USERNAME, "shared").set(LOCAL_PASSWORDS.HASH,
                        new Passwords().hash("secret-password"))
                .execute();
        assertThat(passwordStore.check("pi24", "shared", "secret-password")).isEqualTo(PasswordCheck.MATCHES);
        PluginOutcome<PasswordCheck> outcome = calls.call("pi22", Identity.class, "check-local-password",
                (identity, context) -> context.localPasswords().check("shared", "secret-password"));
        assertThat(outcome).isEqualTo(new PluginOutcome.Answered<>(PasswordCheck.NONE));
    }

    private RestTestClient.ResponseSpec signUp(String username, String email) {
        return client.post().uri("/api/signup/pi24").contentType(MediaType.APPLICATION_JSON)
                .body(signUpBody(username, email, "abcdefghijkl")).exchange();
    }

    private String signUpBody(String username, String email, String password) {
        return "{\"name\":\"New Person\",\"email\":\"" + email + "\",\"username\":\"" + username
                + "\",\"password\":\"" + password + "\",\"returnTo\":\"/requests\"}";
    }

    private RestTestClient.ResponseSpec confirm(String token) {
        return client.post().uri("/api/email-verification/confirm").contentType(MediaType.APPLICATION_JSON)
                .body("{\"token\":\"" + token + "\"}").exchange();
    }

    private String token(String subject) throws RuntimeException {
        var mail = dsl.selectFrom(OUTBOX).orderBy(OUTBOX.ID.desc()).fetch().stream()
                .filter(row -> "mail".equals(row.getChannel()))
                .map(row -> json.readTree(row.getPayload().data()))
                .filter(payload -> subject.equals(payload.path("subject").asString()))
                .findFirst().orElseThrow();
        String link = mail.path("link").asString();
        return link.substring(link.lastIndexOf('/') + 1);
    }

    private boolean mailSubject(String subject) {
        List<JsonNode> payloads = dsl.selectFrom(OUTBOX).fetch().stream()
                .map(row -> json.readTree(row.getPayload().data())).toList();
        return payloads.stream().anyMatch(payload -> subject.equals(payload.path("subject").asString()));
    }
}
