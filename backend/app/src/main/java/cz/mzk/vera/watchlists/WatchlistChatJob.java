package cz.mzk.vera.watchlists;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_ENTRIES;
import static cz.mzk.vera.db.tables.Tables.WATCHLISTS;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_VIEWERS;

import cz.mzk.vera.account.AccountQueries;
import cz.mzk.vera.account.IdentityClaims;
import cz.mzk.vera.jobs.Job;
import cz.mzk.vera.jobs.JobKind;
import cz.mzk.vera.plugin.deliverychannel.DeliveryChannel;
import cz.mzk.vera.plugin.deliverychannel.SendInput;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.Record;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// WATCH-delivery; WATCH-do-not-send. Chat is delivered for each newly entered record.
@Component
public final class WatchlistChatJob implements JobKind<WatchlistChatJob.ChatAttempt> {
    private final DSLContext dsl;
    private final Clock clock;
    private final JsonMapper json;
    private final AccountQueries account;
    private final IdentityClaims claims;
    private final PluginCalls calls;
    private final WatchlistManageLinks links;

    public WatchlistChatJob(DSLContext dsl, Clock clock, JsonMapper json, AccountQueries account,
            IdentityClaims claims, PluginCalls calls, WatchlistManageLinks links) {
        this.dsl = dsl;
        this.clock = clock;
        this.json = json;
        this.account = account;
        this.claims = claims;
        this.calls = calls;
        this.links = links;
    }

    @Override
    public String name() {
        return "watchlist.chat";
    }

    @Override
    public ChatAttempt call(Job job) {
        String userId = job.payload().path("userId").asString();
        String watchlistId = job.payload().path("watchlistId").asString();
        String recordId = job.payload().path("recordId").asString();
        Record entry = dsl.selectFrom(WATCHLIST_ENTRIES).where(WATCHLIST_ENTRIES.USER_ID.eq(userId))
                .and(WATCHLIST_ENTRIES.WATCHLIST_ID.eq(watchlistId))
                .and(WATCHLIST_ENTRIES.RECORD_ID.eq(recordId)).orderBy(WATCHLIST_ENTRIES.ENTERED_AT.desc())
                .limit(1).fetchOne();
        if (entry == null || entry.get(WATCHLIST_ENTRIES.BASELINE)) {
            return new ChatAttempt(userId, watchlistId, recordId, entry == null ? null
                    : entry.get(WATCHLIST_ENTRIES.ENTERED_AT).toInstant(), List.of());
        }
        Record watchlist = dsl.selectFrom(WATCHLISTS).where(WATCHLISTS.ID.eq(watchlistId)).fetchOne();
        Record viewer = dsl.selectFrom(WATCHLIST_VIEWERS).where(WATCHLIST_VIEWERS.USER_ID.eq(userId))
                .and(WATCHLIST_VIEWERS.WATCHLIST_ID.eq(watchlistId)).fetchOne();
        JsonNode notifications = account.settings(userId).path("notifications");
        if (watchlist == null || viewer == null || notifications.path("doNotSend").asBoolean()
                || viewer.get(WATCHLIST_VIEWERS.CONFIRMED_FILTER) == null
                        && watchlist.get(WATCHLISTS.FILTER_VERSION) > 1) {
            return new ChatAttempt(userId, watchlistId, recordId, entry.get(WATCHLIST_ENTRIES.ENTERED_AT)
                    .toInstant(), List.of());
        }
        Instant now = clock.instant();
        List<SentChannel> sent = new ArrayList<>();
        JsonNode channels = json.readTree(viewer.get(WATCHLIST_VIEWERS.CHANNELS).data());
        for (Record channel : chatChannels()) {
            String channelId = channel.get(PLUGIN_INSTANCES.ID);
            JsonNode setting = channels.path(channelId);
            JsonNode delivered = json.readTree(entry.get(WATCHLIST_ENTRIES.DELIVERED_AT).data());
            if (!setting.path("isOn").asBoolean() || delivered.has(channelId)
                    || isOff(notifications, channelId)) {
                continue;
            }
            String recipient = recipient(userId, channel);
            if (recipient == null) {
                continue;
            }
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("schema", "vera.watchlist-chat/1");
            payload.put("userId", userId);
            payload.put("channelId", channelId);
            payload.put("watchlistId", watchlistId);
            payload.put("view", watchlist.get(WATCHLISTS.VIEW));
            payload.put("recordId", recordId);
            payload.put("sentAt", now.toString());
            payload.put("manageUrl", "/api/watchlists/manage?token=" + links.issue(userId, watchlistId));
            PluginOutcome<?> outcome = calls.call(channelId, DeliveryChannel.class, "send",
                    (delivery, context) -> delivery.send(context, new SendInput(recipient, payload)));
            if (outcome instanceof PluginOutcome.Answered<?>) {
                sent.add(new SentChannel(channelId));
            }
        }
        return new ChatAttempt(userId, watchlistId, recordId, entry.get(WATCHLIST_ENTRIES.ENTERED_AT)
                .toInstant(), sent);
    }

    @Override
    public void apply(DSLContext tx, Job job, ChatAttempt attempt) {
        if (attempt.enteredAt() == null || attempt.sent().isEmpty()) {
            return;
        }
        for (SentChannel channel : attempt.sent()) {
            Record entry = tx.selectFrom(WATCHLIST_ENTRIES).where(WATCHLIST_ENTRIES.USER_ID.eq(attempt.userId()))
                    .and(WATCHLIST_ENTRIES.WATCHLIST_ID.eq(attempt.watchlistId()))
                    .and(WATCHLIST_ENTRIES.RECORD_ID.eq(attempt.recordId()))
                    .and(WATCHLIST_ENTRIES.ENTERED_AT.eq(attempt.enteredAt().atOffset(ZoneOffset.UTC)))
                    .fetchOne();
            if (entry == null) {
                continue;
            }
            JsonNode prior = json.readTree(entry.get(WATCHLIST_ENTRIES.DELIVERED_AT).data());
            Map<String, Object> delivered = new LinkedHashMap<>();
            prior.properties().forEach(property -> delivered.put(property.getKey(), property.getValue()));
            delivered.put(channel.id(), clock.instant().toString());
            tx.update(WATCHLIST_ENTRIES).set(WATCHLIST_ENTRIES.DELIVERED_AT,
                            JSONB.valueOf(json.writeValueAsString(delivered)))
                    .where(WATCHLIST_ENTRIES.USER_ID.eq(attempt.userId()))
                    .and(WATCHLIST_ENTRIES.WATCHLIST_ID.eq(attempt.watchlistId()))
                    .and(WATCHLIST_ENTRIES.RECORD_ID.eq(attempt.recordId()))
                    .and(WATCHLIST_ENTRIES.ENTERED_AT.eq(attempt.enteredAt().atOffset(ZoneOffset.UTC)))
                    .execute();
        }
    }

    private List<Record> chatChannels() {
        return dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_IMPLEMENTATIONS.VERSIONS)
                .from(PLUGIN_INSTANCES.join(PLUGIN_IMPLEMENTATIONS)
                        .on(PLUGIN_INSTANCES.IMPLEMENTATION_ID.eq(PLUGIN_IMPLEMENTATIONS.ID)))
                .where(PLUGIN_IMPLEMENTATIONS.KIND.eq("DeliveryChannel"))
                .and(PLUGIN_INSTANCES.IS_ENABLED.isTrue()).and(PLUGIN_INSTANCES.IS_DELETED.isFalse())
                .orderBy(PLUGIN_INSTANCES.POSITION).fetch().stream()
                .filter(row -> {
                    JsonNode declarations = json.readTree(row.get(PLUGIN_IMPLEMENTATIONS.VERSIONS).data());
                    JsonNode declares = declarations.path(0).path("declares");
                    return "Chat".equals(declares.path("channelInterface").asString())
                            && "claim".equals(declares.path("personReach").path("by").asString());
                }).map(row -> (Record) row).toList();
    }

    private String recipient(String userId, Record channel) {
        JsonNode declarations = json.readTree(channel.get(PLUGIN_IMPLEMENTATIONS.VERSIONS).data());
        String claim = declarations.path(0).path("declares").path("personReach").path("claim").asString();
        return claims.value(userId, claim);
    }

    private boolean isOff(JsonNode notifications, String channelId) {
        for (JsonNode channel : notifications.path("channelsOff")) {
            if (channelId.equals(channel.asString())) {
                return true;
            }
        }
        return false;
    }

    public record SentChannel(String id) {}

    public record ChatAttempt(String userId, String watchlistId, String recordId, Instant enteredAt,
            List<SentChannel> sent) {}
}
