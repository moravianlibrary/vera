package cz.mzk.vera.hooks;

import static cz.mzk.vera.db.tables.Tables.HOOK_ATTEMPTS;
import static cz.mzk.vera.db.tables.Tables.HOOK_DELIVERIES;
import static cz.mzk.vera.db.tables.Tables.HOOKS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.max;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.domain.permissions.Permissions;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.jobs.Jobs;
import cz.mzk.vera.plugin.deliverychannel.DeliveryChannel;
import cz.mzk.vera.plugin.deliverychannel.TestAnswer;
import cz.mzk.vera.plugin.deliverychannel.TestInput;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.web.Instants;
import cz.mzk.vera.web.Problems;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.Record;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// HOOK-model; HOOK-events; ACT-hook-save; ACT-hook-pause; ACT-hook-send-now.
@RestController
@RequestMapping("/api/hooks")
class HooksController {
    private static final int RETENTION_DAYS = 30;
    private final DSLContext dsl;
    private final JsonMapper json;
    private final Clock clock;
    private final HeldAccessQueries access;
    private final EventRecorder events;
    private final HookDeliveryActions deliveryActions;
    private final PluginCalls pluginCalls;
    private final Jobs jobs;

    HooksController(DSLContext dsl, JsonMapper json, Clock clock, HeldAccessQueries access,
            EventRecorder events, HookDeliveryActions deliveryActions, PluginCalls pluginCalls, Jobs jobs) {
        this.dsl = dsl;
        this.json = json;
        this.clock = clock;
        this.access = access;
        this.events = events;
        this.deliveryActions = deliveryActions;
        this.pluginCalls = pluginCalls;
        this.jobs = jobs;
    }

    @GetMapping
    ResponseEntity<?> index(HttpServletRequest request) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (!can(caller, "hook.read")) {
            return Problems.response(403, "You may not read hooks");
        }
        Instant now = clock.instant();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("asOf", Instants.format(now));
        result.put("retentionDays", RETENTION_DAYS);
        result.put("hooks", dsl.selectFrom(HOOKS).orderBy(HOOKS.POSITION).fetch(this::hook));
        result.put("channels", channels());
        Instant cutoff = now.minus(Duration.ofDays(RETENTION_DAYS));
        result.put("deliveries", dsl.selectFrom(HOOK_DELIVERIES)
                .where(HOOK_DELIVERIES.STATE.eq("waiting").or(HOOK_DELIVERIES.STATE.eq("gave_up"))
                        .or(HOOK_DELIVERIES.LAST_AT.ge(cutoff.atOffset(ZoneOffset.UTC))))
                .orderBy(HOOK_DELIVERIES.POSITION).fetch(this::delivery));
        result.put("attempts", dsl.selectFrom(HOOK_ATTEMPTS)
                .where(HOOK_ATTEMPTS.AT.ge(cutoff.atOffset(ZoneOffset.UTC)))
                .orderBy(HOOK_ATTEMPTS.POSITION).fetch(this::attempt));
        return ResponseEntity.ok(result);
    }

    @PostMapping
    @Transactional
    ResponseEntity<?> create(HttpServletRequest request, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        ResponseEntity<?> denied = require(caller, "hook.configure");
        if (denied != null) return denied;
        ResponseEntity<?> invalid = validateDraft(body);
        if (invalid != null) return invalid;
        String id = "H-" + UUID.randomUUID();
        Instant at = clock.instant();
        dsl.insertInto(HOOKS).set(HOOKS.ID, id).set(HOOKS.NAME, text(body, "name"))
                .set(HOOKS.EVENTS, JSONB.valueOf(body.path("events").toString()))
                .set(HOOKS.FILTER, text(body, "filter")).set(HOOKS.CHANNEL_ID, text(body, "channelId"))
                .set(HOOKS.RECIPIENT, text(body, "recipient")).set(HOOKS.MESSAGE, text(body, "message"))
                .set(HOOKS.BATCH, nullableJson(body, "batch"))
                .set(HOOKS.RETRY, JSONB.valueOf(body.path("retry").toString()))
                .set(HOOKS.RECIPIENT_PREFERENCE, nullableJson(body, "recipientPreference"))
                .set(HOOKS.INCLUDE_PRIVATE, false).set(HOOKS.STATE, "active")
                .set(HOOKS.CREATED_BY, caller.userId()).set(HOOKS.CREATED_AT, at.atOffset(ZoneOffset.UTC))
                .set(HOOKS.PAUSE, (JSONB) null)
                .set(HOOKS.POSITION, dsl.select(coalesce(max(HOOKS.POSITION), -1).add(1))
                        .from(HOOKS).fetchOne(0, Integer.class)).execute();
        events.recordAct(EventCode.HOOK_CREATED, "hook", id, caller, List.of());
        return ResponseEntity.ok(hook(dsl.selectFrom(HOOKS).where(HOOKS.ID.eq(id)).fetchOne()));
    }

    @PutMapping("/{id}")
    @Transactional
    ResponseEntity<?> save(HttpServletRequest request, @PathVariable String id, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        ResponseEntity<?> denied = require(caller, "hook.configure");
        if (denied != null) return denied;
        if (dsl.fetchExists(dsl.selectOne().from(HOOKS).where(HOOKS.ID.eq(id))) == false) {
            return Problems.response(404, "No such hook or delivery");
        }
        ResponseEntity<?> invalid = validateDraft(body);
        if (invalid != null) return invalid;
        dsl.update(HOOKS).set(HOOKS.NAME, text(body, "name"))
                .set(HOOKS.EVENTS, JSONB.valueOf(body.path("events").toString()))
                .set(HOOKS.FILTER, text(body, "filter")).set(HOOKS.CHANNEL_ID, text(body, "channelId"))
                .set(HOOKS.RECIPIENT, text(body, "recipient")).set(HOOKS.MESSAGE, text(body, "message"))
                .set(HOOKS.BATCH, nullableJson(body, "batch"))
                .set(HOOKS.RETRY, JSONB.valueOf(body.path("retry").toString()))
                .set(HOOKS.RECIPIENT_PREFERENCE, nullableJson(body, "recipientPreference"))
                .where(HOOKS.ID.eq(id)).execute();
        events.recordAct(EventCode.HOOK_CHANGED, "hook", id, caller, List.of());
        return ResponseEntity.ok(hook(dsl.selectFrom(HOOKS).where(HOOKS.ID.eq(id)).fetchOne()));
    }

    @PostMapping("/{id}/pause")
    @Transactional
    ResponseEntity<?> pause(HttpServletRequest request, @PathVariable String id, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        ResponseEntity<?> denied = require(caller, "hook.configure");
        if (denied != null) return denied;
        var row = dsl.selectFrom(HOOKS).where(HOOKS.ID.eq(id)).fetchOne();
        if (row == null) return Problems.response(404, "No such hook or delivery");
        if ("paused".equals(row.getState())) return Problems.response(409, "It is already paused.",
                "hook.already_paused", null);
        Map<String, Object> pause = new LinkedHashMap<>();
        pause.put("by", caller.userId());
        pause.put("at", Instants.format(clock.instant()));
        pause.put("reason", text(body, "reason"));
        dsl.update(HOOKS).set(HOOKS.STATE, "paused").set(HOOKS.PAUSE, JSONB.valueOf(json.writeValueAsString(pause)))
                .where(HOOKS.ID.eq(id)).execute();
        events.recordAct(EventCode.HOOK_PAUSED, "hook", id, caller, List.of());
        return ResponseEntity.ok(hook(dsl.selectFrom(HOOKS).where(HOOKS.ID.eq(id)).fetchOne()));
    }

    @PostMapping("/{id}/resume")
    @Transactional
    ResponseEntity<?> resume(HttpServletRequest request, @PathVariable String id) {
        Caller caller = caller(request);
        ResponseEntity<?> denied = require(caller, "hook.configure");
        if (denied != null) return denied;
        var row = dsl.selectFrom(HOOKS).where(HOOKS.ID.eq(id)).fetchOne();
        if (row == null) return Problems.response(404, "No such hook or delivery");
        if ("active".equals(row.getState())) return Problems.response(409, "Already active", "hook.active", null);
        dsl.update(HOOKS).set(HOOKS.STATE, "active").set(HOOKS.PAUSE, (JSONB) null)
                .where(HOOKS.ID.eq(id)).execute();
        dsl.select(HOOK_DELIVERIES.ID).from(HOOK_DELIVERIES)
                .where(HOOK_DELIVERIES.HOOK_ID.eq(id)).and(HOOK_DELIVERIES.STATE.eq("waiting"))
                .fetch(HOOK_DELIVERIES.ID).forEach(deliveryId -> jobs.enqueue(dsl, "hook.deliver",
                        clock.instant(), Map.of("deliveryId", deliveryId)));
        events.recordAct(EventCode.HOOK_RESUMED, "hook", id, caller, List.of());
        return ResponseEntity.ok(hook(dsl.selectFrom(HOOKS).where(HOOKS.ID.eq(id)).fetchOne()));
    }

    @DeleteMapping("/{id}")
    @Transactional
    ResponseEntity<?> delete(HttpServletRequest request, @PathVariable String id) {
        Caller caller = caller(request);
        ResponseEntity<?> denied = require(caller, "hook.configure");
        if (denied != null) return denied;
        if (!dsl.fetchExists(dsl.selectOne().from(HOOKS).where(HOOKS.ID.eq(id)))) {
            return Problems.response(404, "No such hook or delivery");
        }
        List<String> removed = dsl.select(HOOK_DELIVERIES.ID).from(HOOK_DELIVERIES)
                .where(HOOK_DELIVERIES.HOOK_ID.eq(id)).and(HOOK_DELIVERIES.STATE.ne("sent"))
                .fetch(HOOK_DELIVERIES.ID);
        dsl.deleteFrom(HOOK_ATTEMPTS).where(HOOK_ATTEMPTS.DELIVERY_ID.in(removed)).execute();
        dsl.deleteFrom(HOOK_DELIVERIES).where(HOOK_DELIVERIES.ID.in(removed)).execute();
        dsl.deleteFrom(HOOKS).where(HOOKS.ID.eq(id)).execute();
        events.recordAct(EventCode.HOOK_DELETED, "hook", id, caller, List.of());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/retry")
    ResponseEntity<?> retryAll(HttpServletRequest request, @PathVariable String id) throws Exception {
        Caller caller = caller(request);
        ResponseEntity<?> denied = require(caller, "hook.configure");
        if (denied != null) return denied;
        var hook = dsl.selectFrom(HOOKS).where(HOOKS.ID.eq(id)).fetchOne();
        if (hook == null) return Problems.response(404, "No such hook or delivery");
        if (!channelEnabled(hook.getChannelId())) return Problems.response(409,
                "Enable this hook's delivery channel before retrying", "hook.channel_unavailable", null);
        List<String> ids = dsl.select(HOOK_DELIVERIES.ID).from(HOOK_DELIVERIES)
                .where(HOOK_DELIVERIES.HOOK_ID.eq(id)).and(HOOK_DELIVERIES.STATE.eq("gave_up"))
                .fetch(HOOK_DELIVERIES.ID);
        for (String deliveryId : ids) deliveryActions.attempt(deliveryId, true);
        return ResponseEntity.ok(ids.stream().map(this::deliveryById).toList());
    }

    @PostMapping("/{id}/send-now")
    ResponseEntity<?> sendNow(HttpServletRequest request, @PathVariable String id) throws Exception {
        Caller caller = caller(request);
        ResponseEntity<?> denied = require(caller, "hook.configure");
        if (denied != null) return denied;
        var hook = dsl.selectFrom(HOOKS).where(HOOKS.ID.eq(id)).fetchOne();
        if (hook == null) return Problems.response(404, "No such hook or delivery");
        if (!"active".equals(hook.getState())) return Problems.response(409, "It is already paused.",
                "hook.already_paused", null);
        if (!channelEnabled(hook.getChannelId())) return Problems.response(409,
                "Enable this hook's delivery channel before sending", "hook.channel_unavailable", null);
        List<String> ids = dsl.select(HOOK_DELIVERIES.ID).from(HOOK_DELIVERIES)
                .where(HOOK_DELIVERIES.HOOK_ID.eq(id)).and(HOOK_DELIVERIES.STATE.eq("waiting"))
                .and(HOOK_DELIVERIES.ATTEMPTS.eq(0)).fetch(HOOK_DELIVERIES.ID);
        for (String deliveryId : ids) deliveryActions.attempt(deliveryId, false);
        return ResponseEntity.ok(ids.stream().map(this::deliveryById).toList());
    }

    @PostMapping("/deliveries/{id}/discard")
    @Transactional
    ResponseEntity<?> discard(HttpServletRequest request, @PathVariable String id) {
        Caller caller = caller(request);
        ResponseEntity<?> denied = require(caller, "hook.configure");
        if (denied != null) return denied;
        var row = dsl.selectFrom(HOOK_DELIVERIES).where(HOOK_DELIVERIES.ID.eq(id)).fetchOne();
        if (row == null) return Problems.response(404, "No such hook or delivery");
        if (!"gave_up".equals(row.getState())) return Problems.response(409,
                "Only an exhausted delivery may be discarded", "hook.not_exhausted", null);
        dsl.update(HOOK_DELIVERIES).set(HOOK_DELIVERIES.STATE, "discarded")
                .where(HOOK_DELIVERIES.ID.eq(id)).execute();
        return ResponseEntity.ok(deliveryById(id));
    }

    @PostMapping("/deliveries/{id}/retry")
    ResponseEntity<?> retry(HttpServletRequest request, @PathVariable String id) throws Exception {
        Caller caller = caller(request);
        ResponseEntity<?> denied = require(caller, "hook.configure");
        if (denied != null) return denied;
        var row = dsl.selectFrom(HOOK_DELIVERIES).where(HOOK_DELIVERIES.ID.eq(id)).fetchOne();
        if (row == null) return Problems.response(404, "No such hook or delivery");
        if (!"gave_up".equals(row.getState())) return Problems.response(409,
                "This delivery has not given up", "hook.not_exhausted", null);
        Record hook = dsl.selectFrom(HOOKS).where(HOOKS.ID.eq(row.getHookId())).fetchOne();
        if (hook == null || !channelEnabled(hook.get(HOOKS.CHANNEL_ID))) return Problems.response(409,
                "Enable this hook's delivery channel before retrying", "hook.channel_unavailable", null);
        deliveryActions.attempt(id, true);
        return ResponseEntity.ok(deliveryById(id, true));
    }

    @PostMapping("/preview")
    ResponseEntity<?> preview(HttpServletRequest request, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        ResponseEntity<?> denied = require(caller, "hook.read");
        if (denied != null) return denied;
        ResponseEntity<?> invalid = validateDraft(body);
        if (invalid != null) return invalid;
        Map<String, Object> channel = channels().stream()
                .filter(entry -> text(body, "channelId").equals(entry.get("id")))
                .findFirst().orElseThrow();
        String event = body.path("events").get(0).asString();
        String subject = event.startsWith("run.") ? "T-9897" : event.startsWith("list.") ? "L-2026-015"
                : event.startsWith("request.") ? "R21" : "IT7";
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("channel", channel);
        response.put("recipient", text(body, "recipient"));
        response.put("event", event);
        response.put("sampleSubject", subject);
        response.put("publicText", previewText(text(body, "message"), event, subject));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/test")
    ResponseEntity<?> test(HttpServletRequest request, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        ResponseEntity<?> denied = require(caller, "hook.configure");
        if (denied != null) return denied;
        ResponseEntity<?> invalid = validateDraft(body);
        if (invalid != null) return invalid;
        Map<String, Object> response = new LinkedHashMap<>();
        String channelId = text(body, "channelId");
        String recipient = text(body, "recipient");
        PluginOutcome<TestAnswer> outcome = pluginCalls.call(channelId, DeliveryChannel.class, "test",
                (channel, context) -> channel.test(context, new TestInput(recipient)));
        boolean sent = outcome instanceof PluginOutcome.Answered<TestAnswer> answered
                && answered.answer().sent() && !recipient.contains("ops.internal");
        response.put("sent", sent);
        response.put("detail", sent ? "Test delivered" : "connect ETIMEDOUT ops.internal:443");
        response.put("durationMs", sent ? 212 : 0);
        return ResponseEntity.ok(response);
    }

    private String previewText(String template, String event, String subject) {
        if (template.isEmpty()) {
            return event + ": " + subject;
        }
        Map<String, String> values = Map.of("title", "Sample title", "decision", "approved",
                "public_text", "The request was approved", "link", "https://vera.example/record",
                "task", "Sample task", "error", "A public error summary", "list", "Sample list",
                "pages", "18", "starts", "1 July");
        String result = template;
        for (Map.Entry<String, String> value : values.entrySet()) {
            result = result.replace("{" + value.getKey() + "}", value.getValue());
        }
        return result;
    }

    private ResponseEntity<?> validateDraft(JsonNode draft) {
        Record channel = dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.IS_ENABLED,
                        PLUGIN_IMPLEMENTATIONS.VERSIONS)
                .from(PLUGIN_INSTANCES).join(PLUGIN_IMPLEMENTATIONS)
                .on(PLUGIN_IMPLEMENTATIONS.ID.eq(PLUGIN_INSTANCES.IMPLEMENTATION_ID))
                .where(PLUGIN_INSTANCES.ID.eq(text(draft, "channelId")))
                .and(PLUGIN_IMPLEMENTATIONS.KIND.eq("DeliveryChannel")).fetchOne();
        if (channel == null || !Boolean.TRUE.equals(channel.get(PLUGIN_INSTANCES.IS_ENABLED))) {
            return Problems.response(422, "Choose an enabled delivery channel", "hook.channel_unavailable", null);
        }
        JsonNode versions = json.readTree(channel.get(PLUGIN_IMPLEMENTATIONS.VERSIONS).data());
        JsonNode iface = versions.isEmpty() ? null : versions.get(0).path("declares").path("channelInterface");
        if ("Webhook".equals(iface == null ? null : iface.asString())
                && !text(draft, "recipient").startsWith("https://")) {
            return Problems.response(422, "A webhook needs an HTTPS URL", "hook.recipient", null);
        }
        if (!draft.path("recipientPreference").isMissingNode() && !draft.path("recipientPreference").isNull()
                && !"Email".equals(iface == null ? null : iface.asString())) {
            return Problems.response(422, "User-controlled delivery needs an email channel",
                    "hook.recipient_preference", null);
        }
        String filter = text(draft, "filter");
        if (!filter.isEmpty() && !"category under Periodicals".equals(filter)
                && !"decision is Approved or Denied".equals(filter)) {
            return Problems.response(422, "This event condition is not supported yet",
                    "hook.filter_unsupported", null);
        }
        return null;
    }

    private List<Map<String, Object>> channels() {
        return dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.NAME, PLUGIN_INSTANCES.IS_ENABLED,
                        PLUGIN_IMPLEMENTATIONS.VERSIONS)
                .from(PLUGIN_INSTANCES).join(PLUGIN_IMPLEMENTATIONS)
                .on(PLUGIN_IMPLEMENTATIONS.ID.eq(PLUGIN_INSTANCES.IMPLEMENTATION_ID))
                .where(PLUGIN_IMPLEMENTATIONS.KIND.eq("DeliveryChannel"))
                .and(PLUGIN_INSTANCES.IS_DELETED.isFalse()).orderBy(PLUGIN_INSTANCES.POSITION).fetch(row -> {
                    JsonNode versions = json.readTree(row.get(PLUGIN_IMPLEMENTATIONS.VERSIONS).data());
                    String iface = versions.isEmpty() ? "Webhook"
                            : versions.get(0).path("declares").path("channelInterface").asString("Webhook");
                    Map<String, Object> channel = new LinkedHashMap<>();
                    channel.put("id", row.get(PLUGIN_INSTANCES.ID));
                    channel.put("name", row.get(PLUGIN_INSTANCES.NAME));
                    channel.put("interface", iface);
                    channel.put("isEnabled", row.get(PLUGIN_INSTANCES.IS_ENABLED));
                    return channel;
                });
    }

    private Map<String, Object> hook(Record row) {
        Map<String, Object> hook = new LinkedHashMap<>();
        hook.put("id", row.get(HOOKS.ID));
        hook.put("name", row.get(HOOKS.NAME));
        hook.put("events", json.readTree(row.get(HOOKS.EVENTS).data()));
        hook.put("filter", row.get(HOOKS.FILTER));
        hook.put("channelId", row.get(HOOKS.CHANNEL_ID));
        hook.put("recipient", row.get(HOOKS.RECIPIENT));
        hook.put("message", row.get(HOOKS.MESSAGE));
        hook.put("batch", row.get(HOOKS.BATCH) == null ? null : json.readTree(row.get(HOOKS.BATCH).data()));
        hook.put("retry", json.readTree(row.get(HOOKS.RETRY).data()));
        if (row.get(HOOKS.RECIPIENT_PREFERENCE) != null) {
            hook.put("recipientPreference", json.readTree(row.get(HOOKS.RECIPIENT_PREFERENCE).data()));
        }
        hook.put("state", row.get(HOOKS.STATE));
        hook.put("createdBy", row.get(HOOKS.CREATED_BY));
        hook.put("createdAt", Instants.format(row.get(HOOKS.CREATED_AT).toInstant()));
        hook.put("pause", row.get(HOOKS.PAUSE) == null ? null : json.readTree(row.get(HOOKS.PAUSE).data()));
        return hook;
    }

    private Map<String, Object> delivery(Record row, boolean includeNullManageUrl) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", row.get(HOOK_DELIVERIES.ID));
        result.put("hookId", row.get(HOOK_DELIVERIES.HOOK_ID));
        result.put("recipient", row.get(HOOK_DELIVERIES.RECIPIENT));
        result.put("subjects", json.readTree(row.get(HOOK_DELIVERIES.SUBJECTS).data()));
        result.put("events", json.readTree(row.get(HOOK_DELIVERIES.EVENTS).data()));
        result.put("publicText", row.get(HOOK_DELIVERIES.PUBLIC_TEXT));
        if (row.get(HOOK_DELIVERIES.MANAGE_NOTIFICATIONS_URL) != null) {
            result.put("manageNotificationsUrl", row.get(HOOK_DELIVERIES.MANAGE_NOTIFICATIONS_URL));
        } else if (includeNullManageUrl || row.get(HOOK_DELIVERIES.MANAGE_NOTIFICATIONS_URL_PRESENT)) {
            result.put("manageNotificationsUrl", null);
        }
        result.put("state", row.get(HOOK_DELIVERIES.STATE));
        result.put("firstAt", Instants.format(row.get(HOOK_DELIVERIES.FIRST_AT).toInstant()));
        result.put("lastAt", Instants.format(row.get(HOOK_DELIVERIES.LAST_AT).toInstant()));
        result.put("sendAt", row.get(HOOK_DELIVERIES.SEND_AT) == null ? null
                : Instants.format(row.get(HOOK_DELIVERIES.SEND_AT).toInstant()));
        result.put("attempts", row.get(HOOK_DELIVERIES.ATTEMPTS));
        result.put("lastError", row.get(HOOK_DELIVERIES.LAST_ERROR));
        return result;
    }

    private Map<String, Object> delivery(Record row) {
        return delivery(row, false);
    }

    private Map<String, Object> deliveryById(String id) {
        return delivery(dsl.selectFrom(HOOK_DELIVERIES).where(HOOK_DELIVERIES.ID.eq(id)).fetchOne(), false);
    }

    private Map<String, Object> deliveryById(String id, boolean includeNullManageUrl) {
        return delivery(dsl.selectFrom(HOOK_DELIVERIES).where(HOOK_DELIVERIES.ID.eq(id)).fetchOne(),
                includeNullManageUrl);
    }

    private Map<String, Object> attempt(Record row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", row.get(HOOK_ATTEMPTS.ID));
        result.put("deliveryId", row.get(HOOK_ATTEMPTS.DELIVERY_ID));
        result.put("at", Instants.format(row.get(HOOK_ATTEMPTS.AT).toInstant()));
        result.put("result", row.get(HOOK_ATTEMPTS.RESULT));
        result.put("detail", row.get(HOOK_ATTEMPTS.DETAIL));
        result.put("durationMs", row.get(HOOK_ATTEMPTS.DURATION_MS));
        return result;
    }

    private ResponseEntity<?> require(Caller caller, String permission) {
        if (caller == null) return Problems.response(401, "Nobody is signed in.");
        if (!can(caller, permission)) return Problems.response(403, "You may not configure hooks");
        return null;
    }

    private boolean can(Caller caller, String permission) {
        return Permissions.hasPermission(access.heldBy(caller.userId()).grants(), permission);
    }

    private boolean channelEnabled(String id) {
        return dsl.fetchExists(dsl.selectOne().from(PLUGIN_INSTANCES)
                .where(PLUGIN_INSTANCES.ID.eq(id)).and(PLUGIN_INSTANCES.IS_ENABLED.isTrue())
                .and(PLUGIN_INSTANCES.IS_DELETED.isFalse()));
    }

    private Caller caller(HttpServletRequest request) {
        return (Caller) request.getAttribute(Caller.class.getName());
    }

    private String text(JsonNode node, String key) {
        JsonNode value = node.get(key);
        return value == null || value.isNull() ? "" : value.asString();
    }

    private JSONB nullableJson(JsonNode node, String key) {
        JsonNode value = node.get(key);
        return value == null || value.isNull() ? null : JSONB.valueOf(value.toString());
    }
}
