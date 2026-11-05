package cz.mzk.vera.session;

import static cz.mzk.vera.db.tables.Tables.SESSIONS;
import static cz.mzk.vera.db.tables.Tables.USERS;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import org.jooq.DSLContext;
import org.springframework.core.Ordered;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

// E14. Resolves and slides the vera_session cookie for each request.
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public final class SessionFilter extends OncePerRequestFilter {
    public static final String COOKIE = "vera_session";
    // These limits are placeholders until the library sets its own.
    public static final Duration IDLE_LIMIT = Duration.ofMinutes(30);
    public static final Duration ABSOLUTE_LIMIT = Duration.ofHours(12);
    private final DSLContext dsl;
    private final Clock clock;
    private final boolean isTestProfile;

    public SessionFilter(DSLContext dsl, Clock clock, Environment environment) {
        this.dsl = dsl;
        this.clock = clock;
        this.isTestProfile = environment.acceptsProfiles(Profiles.of("test"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        String token = cookieOf(request);
        Caller caller = token == null ? null : callerOf(token);
        if (caller != null) {
            request.setAttribute(Caller.class.getName(), caller);
            if (!("DELETE".equals(request.getMethod()) && "/api/session/logout".equals(request.getRequestURI()))) {
                response.setHeader("Set-Cookie", cookie(token, isTestProfile));
            }
        }
        chain.doFilter(request, response);
    }

    private Caller callerOf(String token) {
        String hash = hashOf(token);
        var row = dsl.select(SESSIONS.USER_ID, SESSIONS.STARTED_AT, SESSIONS.SEEN_AT, USERS.SUSPENDED_AT)
                .from(SESSIONS.join(USERS).on(SESSIONS.USER_ID.eq(USERS.ID)))
                .where(SESSIONS.TOKEN_HASH.eq(hash)).fetchOne();
        Instant now = clock.instant();
        if (row == null) return null;
        Instant started = row.get(SESSIONS.STARTED_AT).toInstant();
        Instant seen = row.get(SESSIONS.SEEN_AT).toInstant();
        OffsetDateTime suspended = row.get(USERS.SUSPENDED_AT);
        if (suspended != null || Duration.between(seen, now).compareTo(IDLE_LIMIT) > 0
                || Duration.between(started, now).compareTo(ABSOLUTE_LIMIT) > 0) {
            dsl.deleteFrom(SESSIONS).where(SESSIONS.TOKEN_HASH.eq(hash)).execute();
            return null;
        }
        dsl.update(SESSIONS).set(SESSIONS.SEEN_AT, now.atOffset(ZoneOffset.UTC))
                .where(SESSIONS.TOKEN_HASH.eq(hash)).execute();
        return new Caller(row.get(SESSIONS.USER_ID), hash, token);
    }

    private static String cookieOf(HttpServletRequest request) {
        String cookies = request.getHeader("Cookie");
        if (cookies == null) return null;
        for (String part : cookies.split(";")) {
            String[] value = part.trim().split("=", 2);
            if (value.length == 2 && COOKIE.equals(value[0]) && !value[1].isEmpty()) return value[1];
        }
        return null;
    }

    public static String hashOf(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    public static String cookie(String token, boolean testProfile) {
        return sessionCookie(token, testProfile, "1800");
    }

    public static String clearedCookie(boolean testProfile) {
        return sessionCookie("", testProfile, "0");
    }

    private static String sessionCookie(String token, boolean testProfile, String maxAge) {
        return COOKIE + "=" + token + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" + maxAge
                + (testProfile ? "" : "; Secure");
    }
}
