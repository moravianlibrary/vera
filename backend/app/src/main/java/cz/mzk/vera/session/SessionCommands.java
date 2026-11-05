package cz.mzk.vera.session;

import static cz.mzk.vera.db.tables.Tables.SESSIONS;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.HexFormat;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Service;

// E14. The raw token is returned only to the caller's cookie.
@Service
public class SessionCommands {
    private final DSLContext dsl;
    private final Clock clock;
    private final boolean testProfile;
    private final SecureRandom random = new SecureRandom();

    public SessionCommands(DSLContext dsl, Clock clock, Environment environment) {
        this.dsl = dsl;
        this.clock = clock;
        this.testProfile = environment.acceptsProfiles(Profiles.of("test"));
    }

    public String open(String userId, String instanceId) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = HexFormat.of().formatHex(bytes);
        var now = clock.instant().atOffset(ZoneOffset.UTC);
        dsl.insertInto(SESSIONS)
                .set(SESSIONS.TOKEN_HASH, SessionFilter.hashOf(token))
                .set(SESSIONS.USER_ID, userId)
                .set(SESSIONS.INSTANCE_ID, instanceId)
                .set(SESSIONS.PLUGIN_STATE, JSONB.valueOf("{}"))
                .set(SESSIONS.STARTED_AT, now)
                .set(SESSIONS.SEEN_AT, now)
                .set(SESSIONS.RENEWED_AT, now)
                .execute();
        return token;
    }

    public void end(String tokenHash) {
        if (tokenHash != null) {
            dsl.deleteFrom(SESSIONS).where(SESSIONS.TOKEN_HASH.eq(tokenHash)).execute();
        }
    }

    public String cookie(String token) {
        return SessionFilter.cookie(token, testProfile);
    }

    public String clearedCookie() {
        return SessionFilter.clearedCookie(testProfile);
    }
}
