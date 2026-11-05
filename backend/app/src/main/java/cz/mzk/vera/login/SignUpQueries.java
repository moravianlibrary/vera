package cz.mzk.vera.login;

import static cz.mzk.vera.db.tables.Tables.OUTBOX;
import static cz.mzk.vera.db.tables.Tables.PASSWORD_RESETS;
import static cz.mzk.vera.db.tables.Tables.PENDING_SIGN_UPS;
import static cz.mzk.vera.db.tables.Tables.USER_IDENTITIES;
import static cz.mzk.vera.db.tables.Tables.USERS;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Locale;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

// ACCESS-sign-up; ACCESS-verify-email; ACCESS-password-reset; ACCESS-no-enumeration.
@Repository
public class SignUpQueries {
    private final DSLContext dsl;

    public SignUpQueries(DSLContext dsl) {
        this.dsl = dsl;
    }

    public boolean usernameTaken(String instanceId, String username, Instant now) {
        return dsl.fetchExists(dsl.selectOne().from(USER_IDENTITIES)
                .where(USER_IDENTITIES.INSTANCE_ID.eq(instanceId))
                .and(USER_IDENTITIES.EXTERNAL_ID.eq(username)))
                || dsl.fetchExists(dsl.selectOne().from(PENDING_SIGN_UPS)
                        .where(PENDING_SIGN_UPS.INSTANCE_ID.eq(instanceId))
                        .and(PENDING_SIGN_UPS.USERNAME.eq(username))
                        .and(PENDING_SIGN_UPS.USED_AT.isNull())
                        .and(PENDING_SIGN_UPS.CREATED_AT.gt(now.minus(SignUpCommands.SIGN_UP_LIFETIME)
                                .atOffset(ZoneOffset.UTC))));
    }

    public long verificationMailCount(String email, Instant now) {
        return dsl.selectCount()
                .from(OUTBOX)
                .where(OUTBOX.CHANNEL.eq("mail"))
                .and(DSL.lower(OUTBOX.RECIPIENT).eq(email.toLowerCase(Locale.ROOT)))
                .and(DSL.field("payload->>'subject'", String.class).eq(SignUpCommands.VERIFY_SUBJECT))
                .and(OUTBOX.SENT_AT.ge(now.minus(SignUpCommands.VERIFICATION_MAIL_WINDOW).atOffset(ZoneOffset.UTC)))
                .fetchOne(0, long.class);
    }

    public boolean personHasEmail(String email) {
        return dsl.fetchExists(dsl.selectOne().from(USERS)
                .where(DSL.lower(USERS.EMAIL).eq(email.toLowerCase(Locale.ROOT))));
    }

    public Pending newestPending(String instanceId, String email) {
        var row = dsl.selectFrom(PENDING_SIGN_UPS)
                .where(PENDING_SIGN_UPS.INSTANCE_ID.eq(instanceId))
                .and(DSL.lower(PENDING_SIGN_UPS.EMAIL).eq(email.toLowerCase(Locale.ROOT)))
                .and(PENDING_SIGN_UPS.USED_AT.isNull())
                .orderBy(PENDING_SIGN_UPS.CREATED_AT.desc())
                .limit(1)
                .fetchOne();
        return row == null ? null : new Pending(row.getInstanceId(), row.getName(), row.getEmail(),
                row.getUsername(), row.getPasswordHash(), row.getReturnTo(), row.getCreatedAt().toInstant(),
                row.getUsedAt() == null ? null : row.getUsedAt().toInstant());
    }

    public Pending pendingByToken(String tokenHash) {
        var row = dsl.selectFrom(PENDING_SIGN_UPS)
                .where(PENDING_SIGN_UPS.TOKEN_HASH.eq(tokenHash))
                .fetchOne();
        return row == null ? null : new Pending(row.getInstanceId(), row.getName(), row.getEmail(),
                row.getUsername(), row.getPasswordHash(), row.getReturnTo(), row.getCreatedAt().toInstant(),
                row.getUsedAt() == null ? null : row.getUsedAt().toInstant());
    }

    public boolean usernameOrEmailTaken(String instanceId, String username, String email) {
        return dsl.fetchExists(dsl.selectOne().from(USER_IDENTITIES)
                .where(USER_IDENTITIES.INSTANCE_ID.eq(instanceId))
                .and(USER_IDENTITIES.EXTERNAL_ID.eq(username)))
                || personHasEmail(email);
    }

    public String personForReset(String instanceId, String email) {
        return dsl.select(USER_IDENTITIES.USER_ID)
                .from(USER_IDENTITIES)
                .join(USERS).on(USER_IDENTITIES.USER_ID.eq(USERS.ID))
                .where(USER_IDENTITIES.INSTANCE_ID.eq(instanceId))
                .and(DSL.lower(USERS.EMAIL).eq(email.toLowerCase(Locale.ROOT)))
                .limit(1)
                .fetchOne(USER_IDENTITIES.USER_ID);
    }

    public Reset resetByToken(String tokenHash) {
        var row = dsl.selectFrom(PASSWORD_RESETS)
                .where(PASSWORD_RESETS.TOKEN_HASH.eq(tokenHash))
                .fetchOne();
        return row == null ? null : new Reset(row.getUserId(), row.getInstanceId(),
                row.getCreatedAt().toInstant(), row.getUsedAt() == null ? null : row.getUsedAt().toInstant());
    }

    public String identityForUser(String userId, String instanceId) {
        return dsl.select(USER_IDENTITIES.EXTERNAL_ID)
                .from(USER_IDENTITIES)
                .where(USER_IDENTITIES.USER_ID.eq(userId))
                .and(USER_IDENTITIES.INSTANCE_ID.eq(instanceId))
                .fetchOne(USER_IDENTITIES.EXTERNAL_ID);
    }

    public record Pending(String instanceId, String name, String email, String username, String passwordHash,
            String returnTo, Instant createdAt, Instant usedAt) {}

    public record Reset(String userId, String instanceId, Instant createdAt, Instant usedAt) {}
}
