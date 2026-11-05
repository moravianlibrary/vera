package cz.mzk.vera.login;

import static cz.mzk.vera.db.tables.Tables.PASSWORD_RESETS;
import static cz.mzk.vera.db.tables.Tables.PENDING_SIGN_UPS;
import static cz.mzk.vera.db.tables.Tables.SESSIONS;
import static cz.mzk.vera.db.tables.Tables.USER_IDENTITIES;

import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.events.Correlation;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.events.Outbox;
import cz.mzk.vera.login.IdentityInstances.Instance;
import cz.mzk.vera.plugin.identity.CompleteAnswer;
import cz.mzk.vera.session.SessionFilter;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

// ACCESS-sign-up; ACCESS-verify-email; ACCESS-password-reset; ACCESS-no-enumeration.
@Service
public class SignUpCommands {
    static final Duration SIGN_UP_LIFETIME = Duration.ofDays(7);
    static final Duration VERIFICATION_LIFETIME = Duration.ofDays(1);
    static final Duration VERIFICATION_MAIL_WINDOW = Duration.ofDays(1);
    static final Duration RESET_LIFETIME = Duration.ofHours(1);
    static final int DEFAULT_PASSWORD_MINIMUM = 12;
    static final String VERIFY_SUBJECT = "Verify your email";
    static final String EXISTING_SUBJECT = "You already have an account";
    static final String RESET_SUBJECT = "Set a new password";

    private final DSLContext dsl;
    private final Clock clock;
    private final Passwords passwords;
    private final LocalPasswordStore localPasswords;
    private final Outbox outbox;
    private final JsonMapper json;
    private final EventRecorder events;
    private final IdentityInstances instances;
    private final LoginCommands loginCommands;
    private final SignUpQueries queries;
    private final SecureRandom random = new SecureRandom();

    public SignUpCommands(DSLContext dsl, Clock clock, Passwords passwords, LocalPasswordStore localPasswords,
            Outbox outbox, JsonMapper json, EventRecorder events, IdentityInstances instances,
            LoginCommands loginCommands, SignUpQueries queries) {
        this.dsl = dsl;
        this.clock = clock;
        this.passwords = passwords;
        this.localPasswords = localPasswords;
        this.outbox = outbox;
        this.json = json;
        this.events = events;
        this.instances = instances;
        this.loginCommands = loginCommands;
        this.queries = queries;
    }

    @Transactional
    public SignUpResult signUp(String instanceId, SignUp body) {
        Instance instance = instances.find(instanceId);
        if (instance == null || !instances.canSignUp(instance)) {
            return SignUpResult.NOT_AVAILABLE;
        }
        if (body.website() != null && !body.website().isBlank()) {
            return SignUpResult.ACCEPTED;
        }
        if (body.password().length() < passwordMinimum(instance)) {
            return SignUpResult.PASSWORD_SHORT;
        }
        if (queries.usernameTaken(instanceId, body.username(), clock.instant())) {
            return SignUpResult.USERNAME_TAKEN;
        }
        if (queries.verificationMailCount(body.email(), clock.instant()) >= 3) {
            return SignUpResult.TOO_MANY_MAILS;
        }
        if (queries.personHasEmail(body.email())) {
            String link = "/forgot-password?instance="
                    + URLEncoder.encode(instanceId, StandardCharsets.UTF_8);
            mail(body.email(), EXISTING_SUBJECT, link);
            return SignUpResult.ACCEPTED;
        }
        createPending(instanceId, body);
        return SignUpResult.ACCEPTED;
    }

    @Transactional
    public void resend(String instanceId, String email) {
        var row = queries.newestPending(instanceId, email);
        if (row == null) {
            return;
        }
        dsl.update(PENDING_SIGN_UPS)
                .set(PENDING_SIGN_UPS.USED_AT, clock.instant().atOffset(ZoneOffset.UTC))
                .where(PENDING_SIGN_UPS.INSTANCE_ID.eq(instanceId))
                .and(DSL.lower(PENDING_SIGN_UPS.EMAIL).eq(email.toLowerCase(Locale.ROOT)))
                .and(PENDING_SIGN_UPS.USED_AT.isNull())
                .execute();
        String token = token();
        dsl.insertInto(PENDING_SIGN_UPS)
                .set(PENDING_SIGN_UPS.TOKEN_HASH, SessionFilter.hashOf(token))
                .set(PENDING_SIGN_UPS.INSTANCE_ID, row.instanceId())
                .set(PENDING_SIGN_UPS.NAME, row.name())
                .set(PENDING_SIGN_UPS.EMAIL, row.email())
                .set(PENDING_SIGN_UPS.USERNAME, row.username())
                .set(PENDING_SIGN_UPS.PASSWORD_HASH, row.passwordHash())
                .set(PENDING_SIGN_UPS.RETURN_TO, row.returnTo())
                .set(PENDING_SIGN_UPS.CREATED_AT, clock.instant().atOffset(ZoneOffset.UTC))
                .execute();
        mail(row.email(), VERIFY_SUBJECT, "/verify-email/" + token);
    }

    @Transactional
    public Confirmed confirm(String token) {
        String tokenHash = SessionFilter.hashOf(token);
        var row = queries.pendingByToken(tokenHash);
        if (row == null || row.usedAt() != null
                || Duration.between(row.createdAt(), clock.instant()).compareTo(VERIFICATION_LIFETIME) > 0) {
            return null;
        }
        if (queries.usernameOrEmailTaken(row.instanceId(), row.username(), row.email())) {
            dsl.update(PENDING_SIGN_UPS)
                    .set(PENDING_SIGN_UPS.USED_AT, clock.instant().atOffset(ZoneOffset.UTC))
                    .where(PENDING_SIGN_UPS.TOKEN_HASH.eq(tokenHash))
                    .execute();
            return null;
        }
        Instance instance = instances.find(row.instanceId());
        if (instance == null) {
            return null;
        }
        String userId = loginCommands.createLinkedPerson(instance,
                new CompleteAnswer(row.username(), row.email(), false, row.name(), List.of()), clock.instant(), false);
        dsl.update(PENDING_SIGN_UPS)
                .set(PENDING_SIGN_UPS.USED_AT, clock.instant().atOffset(ZoneOffset.UTC))
                .where(PENDING_SIGN_UPS.TOKEN_HASH.eq(tokenHash))
                .execute();
        localPasswords.save(row.instanceId(), row.username(), row.passwordHash());
        var data = json.createObjectNode().set("changes", json.valueToTree(List.of(
                change("how", null, "sign_up"), change("instanceId", null, row.instanceId()))));
        events.record(new EventInput(EventCode.USER_CREATED, "user", userId, null,
                new EventInput.User(userId), Correlation.newId(), clock.instant(), data, null));
        return new Confirmed(userId, row.instanceId(), row.returnTo());
    }

    @Transactional
    public void requestReset(String instanceId, String email) {
        String userId = queries.personForReset(instanceId, email);
        if (userId == null) {
            return;
        }
        String token = token();
        dsl.insertInto(PASSWORD_RESETS)
                .set(PASSWORD_RESETS.TOKEN_HASH, SessionFilter.hashOf(token))
                .set(PASSWORD_RESETS.INSTANCE_ID, instanceId)
                .set(PASSWORD_RESETS.USER_ID, userId)
                .set(PASSWORD_RESETS.CREATED_AT, clock.instant().atOffset(ZoneOffset.UTC))
                .execute();
        mail(email, RESET_SUBJECT, "/reset-password/" + token);
    }

    @Transactional
    public ResetResult resetPassword(String token, String password) {
        var row = queries.resetByToken(SessionFilter.hashOf(token));
        if (row == null || row.usedAt() != null
                || Duration.between(row.createdAt(), clock.instant()).compareTo(RESET_LIFETIME) > 0) {
            return new ResetResult(ResetStatus.EXPIRED, null, null);
        }
        if (password.length() < passwordMinimum(row.instanceId())) {
            return new ResetResult(ResetStatus.PASSWORD_SHORT, null, null);
        }
        String externalId = queries.identityForUser(row.userId(), row.instanceId());
        if (externalId == null) {
            return new ResetResult(ResetStatus.EXPIRED, null, null);
        }
        dsl.update(PASSWORD_RESETS)
                .set(PASSWORD_RESETS.USED_AT, clock.instant().atOffset(ZoneOffset.UTC))
                .where(PASSWORD_RESETS.TOKEN_HASH.eq(SessionFilter.hashOf(token)))
                .execute();
        localPasswords.save(row.instanceId(), externalId, passwords.hash(password));
        dsl.deleteFrom(SESSIONS).where(SESSIONS.USER_ID.eq(row.userId())).execute();
        return new ResetResult(ResetStatus.DONE, row.userId(), row.instanceId());
    }

    private int passwordMinimum(Instance instance) {
        return instance.configuration().path("password_min").asInt(DEFAULT_PASSWORD_MINIMUM);
    }

    private int passwordMinimum(String instanceId) {
        Instance instance = instances.find(instanceId);
        return instance == null ? DEFAULT_PASSWORD_MINIMUM : passwordMinimum(instance);
    }

    private void createPending(String instanceId, SignUp body) {
        String token = token();
        dsl.insertInto(PENDING_SIGN_UPS)
                .set(PENDING_SIGN_UPS.TOKEN_HASH, SessionFilter.hashOf(token))
                .set(PENDING_SIGN_UPS.INSTANCE_ID, instanceId)
                .set(PENDING_SIGN_UPS.NAME, body.name())
                .set(PENDING_SIGN_UPS.EMAIL, body.email())
                .set(PENDING_SIGN_UPS.USERNAME, body.username())
                .set(PENDING_SIGN_UPS.PASSWORD_HASH, passwords.hash(body.password()))
                .set(PENDING_SIGN_UPS.RETURN_TO, ReturnTo.safe(body.returnTo()))
                .set(PENDING_SIGN_UPS.CREATED_AT, clock.instant().atOffset(ZoneOffset.UTC))
                .execute();
        // Removal of this pending sign-up waits for the sign-up.expire job in B5.
        mail(body.email(), VERIFY_SUBJECT, "/verify-email/" + token);
    }

    private void mail(String email, String subject, String link) {
        var payload = json.createObjectNode().put("subject", subject).put("link", link);
        outbox.send("mail", email, payload);
    }

    private String token() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static Map<String, Object> change(String field, Object from, Object to) {
        var change = new LinkedHashMap<String, Object>();
        change.put("field", field);
        change.put("from", from);
        change.put("to", to);
        return change;
    }

    public enum SignUpResult {
        ACCEPTED,
        NOT_AVAILABLE,
        PASSWORD_SHORT,
        USERNAME_TAKEN,
        TOO_MANY_MAILS
    }

    public enum ResetStatus {
        EXPIRED,
        PASSWORD_SHORT,
        DONE
    }

    public record SignUp(String name, String email, String username, String password, String website, String returnTo) {}
    public record Confirmed(String userId, String instanceId, String returnTo) {}
    public record ResetResult(ResetStatus status, String userId, String instanceId) {}
}
