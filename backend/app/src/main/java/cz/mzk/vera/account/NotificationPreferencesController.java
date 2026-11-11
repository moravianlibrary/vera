package cz.mzk.vera.account;

import static cz.mzk.vera.db.tables.Tables.HOOKS;
import static cz.mzk.vera.db.tables.Tables.NOTIFICATION_TOKENS;
import static cz.mzk.vera.db.tables.Tables.USERS;

import cz.mzk.vera.access.AccessGuard;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.SessionFilter;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@RestController
final class NotificationPreferencesController {
    private final DSLContext dsl;
    private final Clock clock;
    private final AccessGuard guard;
    private final AccountQueries queries;
    private final AccountCommands commands;
    private final JsonMapper json;

    NotificationPreferencesController(DSLContext dsl, Clock clock, AccessGuard guard,
            AccountQueries queries, AccountCommands commands, JsonMapper json) {
        this.dsl = dsl;
        this.clock = clock;
        this.guard = guard;
        this.queries = queries;
        this.commands = commands;
        this.json = json;
    }

    @GetMapping("/api/session/notification-hooks")
    ResponseEntity<?> hooks(HttpServletRequest request) {
        Caller caller = guard.callerOf(request);
        ResponseEntity<?> refusal = guard.requireCaller(caller);
        if (refusal != null) return refusal;
        return ResponseEntity.ok(hookChoices());
    }

    @GetMapping("/api/notification-preferences/{token}")
    ResponseEntity<?> get(@PathVariable String token) {
        var grant = grant(token);
        return grant == null ? expired() : ResponseEntity.ok(preferences(grant.userId(), grant.hookId()));
    }

    @PatchMapping("/api/notification-preferences/{token}")
    ResponseEntity<?> patch(@PathVariable String token, @RequestBody JsonNode body) {
        var grant = grant(token);
        if (grant == null) return expired();
        JsonNode notifications = body.path("notifications");
        ObjectNode change = json.createObjectNode();
        ObjectNode choices = change.putObject("notifications");
        choices.put("doNotSend", notifications.path("doNotSend").booleanValue());
        ObjectNode enabled = choices.putObject("hooks");
        notifications.path("hooks").properties().forEach(entry -> {
            if (dsl.fetchExists(dsl.selectOne().from(HOOKS).where(HOOKS.ID.eq(entry.getKey())
                    .and(HOOKS.RECIPIENT_PREFERENCE.isNotNull())))) enabled.set(entry.getKey(), entry.getValue());
        });
        commands.patch(grant.userId(), change);
        return ResponseEntity.ok(preferences(grant.userId(), grant.hookId()));
    }

    private List<Map<String, Object>> hookChoices() {
        return dsl.selectFrom(HOOKS).where(HOOKS.RECIPIENT_PREFERENCE.isNotNull()).orderBy(HOOKS.POSITION)
                .fetch(row -> choice(row.getId(), row.getRecipientPreference(), row.getEvents(), row.getState()));
    }

    private Map<String, Object> preferences(String userId, String hookId) {
        var user = dsl.select(USERS.EMAIL).from(USERS).where(USERS.ID.eq(userId)).fetchOne();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", userId);
        result.put("email", user == null || user.get(USERS.EMAIL) == null ? "" : user.get(USERS.EMAIL));
        result.put("focusedHookId", hookId);
        result.put("hooks", hookChoices());
        ObjectNode settings = queries.settings(userId);
        JsonNode notifications = settings.path("notifications");
        result.put("notifications", notifications.isMissingNode()
                ? Map.of("doNotSend", false, "hooks", Map.of()) : notifications);
        return result;
    }

    private Map<String, Object> choice(String id, JSONB preference, JSONB events, String state) {
        try {
            JsonNode pref = json.readTree(preference.data());
            JsonNode eventList = json.readTree(events.data());
            return Map.of("id", id, "label", pref.path("label").asString(""), "events", eventList,
                    "defaultEnabled", pref.path("defaultEnabled").booleanValue(), "isActive", "active".equals(state));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private Grant grant(String token) {
        String hash = SessionFilter.hashOf(token);
        var row = dsl.select(NOTIFICATION_TOKENS.USER_ID, NOTIFICATION_TOKENS.HOOK_ID)
                .from(NOTIFICATION_TOKENS).where(NOTIFICATION_TOKENS.TOKEN_HASH.eq(hash)
                        .and(NOTIFICATION_TOKENS.EXPIRES_AT.gt(clock.instant().atOffset(ZoneOffset.UTC))))
                .fetchOne();
        return row == null ? null : new Grant(row.get(NOTIFICATION_TOKENS.USER_ID), row.get(NOTIFICATION_TOKENS.HOOK_ID));
    }

    private ResponseEntity<?> expired() {
        return Problems.response(404, "This notification link has expired", "notification.link_expired", null);
    }

    private record Grant(String userId, String hookId) {}
}
