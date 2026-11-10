package cz.mzk.vera.hooks;

import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.max;
import static cz.mzk.vera.db.tables.Tables.HOOK_ATTEMPTS;
import static cz.mzk.vera.db.tables.Tables.HOOK_DELIVERIES;
import static cz.mzk.vera.db.tables.Tables.HOOKS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static cz.mzk.vera.db.tables.Tables.NOTIFICATION_TOKENS;
import static org.jooq.impl.DSL.lower;

import cz.mzk.vera.account.AccountQueries;
import cz.mzk.vera.events.HookPayloads;
import cz.mzk.vera.jobs.Job;
import cz.mzk.vera.jobs.JobKind;
import cz.mzk.vera.jobs.Jobs;
import cz.mzk.vera.plugin.deliverychannel.DeliveryChannel;
import cz.mzk.vera.plugin.deliverychannel.SendInput;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
import cz.mzk.vera.web.Instants;
import cz.mzk.vera.web.PublicUrl;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

// HOOK-retry; HOOK-paused; HOOK-channel-off. Plugin calls are outside the worker's apply transaction.
@Component
public class HookDeliverJob implements JobKind<HookDeliverJob.Attempt> {
    private final DSLContext dsl;
    private final JsonMapper json;
    private final Clock clock;
    private final PluginCalls calls;
    private final HookPayloads payloads;
    private final Jobs jobs;
    private final PublicUrl publicUrl;
    private final AccountQueries account;

    public HookDeliverJob(DSLContext dsl, JsonMapper json, Clock clock, PluginCalls calls,
            HookPayloads payloads, Jobs jobs, PublicUrl publicUrl, AccountQueries account) {
        this.dsl = dsl;
        this.json = json;
        this.clock = clock;
        this.calls = calls;
        this.payloads = payloads;
        this.jobs = jobs;
        this.publicUrl = publicUrl;
        this.account = account;
    }

    @Override
    public String name() {
        return "hook.deliver";
    }

    @Override
    public Attempt call(Job job) {
        String deliveryId = job.payload().path("deliveryId").asString();
        var row = dsl.select(HOOK_DELIVERIES.ID, HOOK_DELIVERIES.HOOK_ID, HOOK_DELIVERIES.RECIPIENT,
                        HOOK_DELIVERIES.EVENT_IDS, HOOK_DELIVERIES.ATTEMPTS, HOOKS.NAME, HOOKS.CHANNEL_ID,
                        HOOK_DELIVERIES.SUBJECTS, HOOK_DELIVERIES.EVENTS, HOOK_DELIVERIES.FIRST_AT,
                        HOOKS.ID, HOOKS.RECIPIENT_PREFERENCE,
                        HOOKS.RETRY, HOOKS.INCLUDE_PRIVATE, HOOKS.STATE, PLUGIN_INSTANCES.IS_ENABLED,
                        HOOK_DELIVERIES.STATE, HOOK_DELIVERIES.SEND_AT)
                .from(HOOK_DELIVERIES).join(HOOKS).on(HOOKS.ID.eq(HOOK_DELIVERIES.HOOK_ID))
                .leftJoin(PLUGIN_INSTANCES).on(PLUGIN_INSTANCES.ID.eq(HOOKS.CHANNEL_ID))
                .where(HOOK_DELIVERIES.ID.eq(deliveryId)).fetchOne();
        if (row == null || !"waiting".equals(row.get(HOOK_DELIVERIES.STATE))
                || !"active".equals(row.get(HOOKS.STATE))
                || !Boolean.TRUE.equals(row.get(PLUGIN_INSTANCES.IS_ENABLED))) {
            return new Attempt(deliveryId, null, false, "Delivery is waiting for its hook or channel.",
                    clock.instant(), 0, 0, null, null, null);
        }
        if (row.get(HOOK_DELIVERIES.SEND_AT) != null
                && row.get(HOOK_DELIVERIES.SEND_AT).toInstant().isAfter(clock.instant())) {
            return new Attempt(deliveryId, null, false, "Delivery is not due yet.", clock.instant(),
                    0, 0, null, null, null);
        }
        String recipientUserId = recipientUser(row.get(HOOKS.RECIPIENT_PREFERENCE),
                row.get(HOOK_DELIVERIES.RECIPIENT), row.get(HOOKS.ID));
        if ("unaddressable".equals(recipientUserId)) {
            return new Attempt(deliveryId, row.get(HOOK_DELIVERIES.HOOK_ID), false,
                    "User-addressed Hook recipient is not a VERA user.", clock.instant(), 0, 0, null,
                    "gave_up", null);
        }
        if (recipientUserId != null && recipientOff(recipientUserId, row.get(HOOKS.ID),
                row.get(HOOKS.RECIPIENT_PREFERENCE))) {
            return new Attempt(deliveryId, row.get(HOOK_DELIVERIES.HOOK_ID), false, "Suppressed",
                    clock.instant(), 0, 0, null, "suppressed", recipientUserId);
        }
        JsonNode eventIdsNode = json.readTree(row.get(HOOK_DELIVERIES.EVENT_IDS).data());
        JsonNode retry = json.readTree(row.get(HOOKS.RETRY).data());
        List<String> eventIds = new ArrayList<>();
        eventIdsNode.forEach(node -> eventIds.add(node.asString()));
        int currentAttempts = job.payload().path("resetAttempts").asBoolean()
                ? 0 : row.get(HOOK_DELIVERIES.ATTEMPTS);
        int number = currentAttempts + 1;
        ObjectNode envelope = eventIds.isEmpty()
                ? seededPayload(row, deliveryId, number)
                : payloads.build(row.get(HOOKS.ID), row.get(HOOKS.NAME), deliveryId,
                        number, eventIds, row.get(HOOKS.INCLUDE_PRIVATE));
        payloads.validate(envelope);
        Instant started = clock.instant();
        PluginOutcome<?> outcome = calls.call(row.get(HOOKS.CHANNEL_ID), DeliveryChannel.class, "send",
                (channel, context) -> channel.send(context,
                        new SendInput(row.get(HOOK_DELIVERIES.RECIPIENT), asJava(envelope))));
        long duration = Math.max(0, Duration.between(started, clock.instant()).toMillis());
        if (outcome instanceof PluginOutcome.Answered<?>) {
            return new Attempt(deliveryId, row.get(HOOK_DELIVERIES.HOOK_ID), true, "Delivered", started, duration,
                    number, retry, null, recipientUserId);
        }
        if (outcome instanceof PluginOutcome.Refused<?> refused) {
            return new Attempt(deliveryId, row.get(HOOK_DELIVERIES.HOOK_ID), false, refused.message(), started,
                    duration, number, retry, null, recipientUserId);
        }
        String detail = ((PluginOutcome.Unavailable<?>) outcome).detail();
        return new Attempt(deliveryId, row.get(HOOK_DELIVERIES.HOOK_ID), false,
                detail == null ? "Delivery channel unavailable." : detail, started, duration,
                number, retry, null, recipientUserId);
    }

    @Override
    public void apply(DSLContext tx, Job job, Attempt attempt) {
        if (attempt.terminalState() != null) {
            tx.update(HOOK_DELIVERIES).set(HOOK_DELIVERIES.STATE, attempt.terminalState())
                    .set(HOOK_DELIVERIES.SEND_AT, (OffsetDateTime) null)
                    .set(HOOK_DELIVERIES.LAST_ERROR, "gave_up".equals(attempt.terminalState())
                            ? attempt.detail() : null)
                    .where(HOOK_DELIVERIES.ID.eq(attempt.deliveryId())).execute();
            return;
        }
        if (attempt.retry() == null) {
            return;
        }
        var delivery = tx.selectFrom(HOOK_DELIVERIES).where(HOOK_DELIVERIES.ID.eq(attempt.deliveryId()))
                .fetchOne();
        if (delivery == null || !"waiting".equals(delivery.getState())) {
            return;
        }
        JsonNode retry = attempt.retry();
        int maxAttempts = retry.path("attempts").asInt(1);
        Instant next = null;
        if (!attempt.sent() && attempt.number() < maxAttempts) {
            int minutes = "fixed".equals(retry.path("backoff").asString())
                    ? 5 : 1 << Math.min(10, attempt.number() - 1);
            next = attempt.at().plus(Duration.ofMinutes(minutes));
        }
        String state = attempt.sent() ? "sent" : next == null ? "gave_up" : "waiting";
        tx.insertInto(HOOK_ATTEMPTS).set(HOOK_ATTEMPTS.ID, "HX-" + UUID.randomUUID())
                .set(HOOK_ATTEMPTS.DELIVERY_ID, attempt.deliveryId())
                .set(HOOK_ATTEMPTS.AT, attempt.at().atOffset(ZoneOffset.UTC))
                .set(HOOK_ATTEMPTS.RESULT, attempt.sent() ? "sent" : "failed")
                .set(HOOK_ATTEMPTS.DETAIL, attempt.detail())
                .set(HOOK_ATTEMPTS.DURATION_MS, (int) attempt.durationMs())
                .set(HOOK_ATTEMPTS.POSITION, tx.select(coalesce(max(HOOK_ATTEMPTS.POSITION), -1).add(1))
                        .from(HOOK_ATTEMPTS).fetchOne(0, Integer.class))
                .execute();
        tx.update(HOOK_DELIVERIES).set(HOOK_DELIVERIES.STATE, state)
                .set(HOOK_DELIVERIES.ATTEMPTS, attempt.number())
                .set(HOOK_DELIVERIES.LAST_AT, attempt.at().atOffset(ZoneOffset.UTC))
                .set(HOOK_DELIVERIES.SEND_AT, next == null ? null : next.atOffset(ZoneOffset.UTC))
                .set(HOOK_DELIVERIES.LAST_ERROR, attempt.sent() ? null : attempt.detail())
                .set(HOOK_DELIVERIES.MANAGE_NOTIFICATIONS_URL,
                        attempt.sent() && attempt.userId() != null ? issueToken(tx, attempt.userId(), attempt.hookId())
                                : delivery.getManageNotificationsUrl())
                .where(HOOK_DELIVERIES.ID.eq(attempt.deliveryId())).execute();
        if (next != null) {
            jobs.enqueue(tx, name(), next, Map.of("deliveryId", attempt.deliveryId()));
        }
    }

    private String recipientUser(org.jooq.JSONB preference, String recipient, String hookId) {
        if (preference == null) {
            return null;
        }
        var user = dsl.select(USERS.ID).from(USERS)
                .where(lower(USERS.EMAIL).eq(recipient.toLowerCase()))
                .fetchOne(USERS.ID);
        return user == null ? "unaddressable" : user;
    }

    private boolean recipientOff(String userId, String hookId, org.jooq.JSONB preference) {
        JsonNode settings = account.settings(userId).path("notifications");
        boolean defaultEnabled = json.readTree(preference.data()).path("defaultEnabled").asBoolean();
        return settings.path("doNotSend").asBoolean() || settings.path("noHookEmail").asBoolean()
                || (settings.path("hooks").has(hookId) && !settings.path("hooks").path(hookId).asBoolean())
                || (!settings.path("hooks").has(hookId) && !defaultEnabled);
    }

    private String issueToken(DSLContext tx, String userId, String hookId) {
        String token = UUID.randomUUID().toString();
        Instant now = clock.instant();
        tx.insertInto(NOTIFICATION_TOKENS).set(NOTIFICATION_TOKENS.TOKEN_HASH, hash(token))
                .set(NOTIFICATION_TOKENS.USER_ID, userId).set(NOTIFICATION_TOKENS.HOOK_ID, hookId)
                .set(NOTIFICATION_TOKENS.CREATED_AT, now.atOffset(ZoneOffset.UTC))
                .set(NOTIFICATION_TOKENS.EXPIRES_AT, now.plus(Duration.ofDays(30)).atOffset(ZoneOffset.UTC))
                .execute();
        return "/email-notifications/" + token;
    }

    private String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private Object asJava(JsonNode node) {
        if (node.isObject()) {
            Map<String, Object> result = new LinkedHashMap<>();
            node.properties().forEach(entry -> result.put(entry.getKey(), asJava(entry.getValue())));
            return result;
        }
        if (node.isArray()) {
            List<Object> result = new ArrayList<>();
            node.forEach(value -> result.add(asJava(value)));
            return result;
        }
        if (node.isNull()) {
            return null;
        }
        if (node.isBoolean()) {
            return node.asBoolean();
        }
        if (node.isNumber()) {
            return node.numberValue();
        }
        return node.asString();
    }

    private ObjectNode seededPayload(org.jooq.Record row, String deliveryId, int number) {
        ObjectNode envelope = json.createObjectNode().put("schema", "vera.hook/1");
        envelope.putObject("hook").put("id", row.get(HOOKS.ID)).put("name", row.get(HOOKS.NAME));
        envelope.putObject("delivery").put("id", deliveryId).put("attempt", number);
        JsonNode eventCodes = json.readTree(row.get(HOOK_DELIVERIES.EVENTS).data());
        JsonNode subjects = json.readTree(row.get(HOOK_DELIVERIES.SUBJECTS).data());
        String type = eventCodes.isEmpty() ? "iteration.ingest_failed" : eventCodes.get(0).asString();
        if ("request.decided".equals(type)) type = "request.approved";
        if ("task.failed".equals(type)) type = "run.failed";
        String subjectId = subjects.isEmpty() ? deliveryId : subjects.get(0).asString();
        String kind = type.startsWith("run.") ? "run" : type.startsWith("list.") ? "list"
                : type.startsWith("request.") ? "request" : type.startsWith("document.")
                        ? "document" : "iteration";
        ObjectNode event = envelope.putArray("events").addObject()
                .put("id", "SEED-" + deliveryId).put("type", type)
                .put("occurredAt", Instants.format(row.get(HOOK_DELIVERIES.FIRST_AT).toInstant()))
                .put("correlationId", "seed-" + deliveryId);
        event.putObject("subject").put("kind", kind).put("id", subjectId)
                .put("url", publicUrl.value().replaceAll("/$", "") + "/" + kind + "s/" + subjectId);
        event.putArray("changes");
        ObjectNode cause = event.putObject("cause").put("kind", "date");
        cause.putNull("act").putNull("run");
        cause.putObject("actor").put("kind", "system").putNull("id").putNull("name");
        cause.putObject("reason").putNull("public");
        return envelope;
    }

    public record Attempt(String deliveryId, String hookId, boolean sent, String detail, Instant at,
            long durationMs, int number, JsonNode retry, String terminalState, String userId) { }
}
