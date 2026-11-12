package cz.mzk.vera.watchlists;

import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_ENTRIES;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_MAIL_WINDOWS;

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
import cz.mzk.vera.db.tables.tables.records.WatchlistEntriesRecord;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// WATCH-mail-batch; WATCH-delivery; WATCH-do-not-send. Delivery uses the shared channel send operation.
@Component
public final class WatchlistMailJob implements JobKind<WatchlistMailJob.MailAttempt> {
    private final DSLContext dsl;
    private final Clock clock;
    private final JsonMapper json;
    private final WatchlistQueries queries;
    private final AccountQueries account;
    private final IdentityClaims claims;
    private final PluginCalls calls;
    private final WatchlistManageLinks links;

    public WatchlistMailJob(DSLContext dsl, Clock clock, JsonMapper json, WatchlistQueries queries,
            AccountQueries account, IdentityClaims claims, PluginCalls calls,
            WatchlistManageLinks links) {
        this.dsl = dsl;
        this.clock = clock;
        this.json = json;
        this.queries = queries;
        this.account = account;
        this.claims = claims;
        this.calls = calls;
        this.links = links;
    }

    @Override
    public String name() {
        return "watchlist.mail";
    }

    @Override
    public MailAttempt call(Job job) {
        String windowId = job.payload().path("windowId").asString();
        Record window = dsl.selectFrom(WATCHLIST_MAIL_WINDOWS).where(WATCHLIST_MAIL_WINDOWS.ID.eq(windowId))
                .fetchOne();
        if (window == null || !"waiting".equals(window.get(WATCHLIST_MAIL_WINDOWS.STATE))
                || window.get(WATCHLIST_MAIL_WINDOWS.SEND_AT).toInstant().isAfter(clock.instant())) {
            return new MailAttempt(windowId, List.of(), false);
        }
        String userId = window.get(WATCHLIST_MAIL_WINDOWS.USER_ID);
        JsonNode notificationSettings = account.settings(userId).path("notifications");
        if (notificationSettings.path("doNotSend").asBoolean()) {
            return new MailAttempt(windowId, List.of(), false);
        }
        List<Map<String, Object>> visible = queries.list(userId, null, false, false);
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        for (Map<String, Object> summary : visible) {
            byId.put((String) summary.get("id"), summary);
        }
        List<WatchlistEntriesRecord> entries = dsl.selectFrom(WATCHLIST_ENTRIES)
                .where(WATCHLIST_ENTRIES.USER_ID.eq(userId))
                .and(WATCHLIST_ENTRIES.BASELINE.isFalse()).fetch();
        Instant now = clock.instant();
        List<EntryKey> delivered = new ArrayList<>();
        boolean found = false;
        for (Record channel : emailChannels(dsl, userId)) {
            String channelId = channel.get(PLUGIN_INSTANCES.ID);
            if (notificationSettings.path("channelsOff").isArray()
                    && contains(notificationSettings.path("channelsOff"), channelId)) {
                continue;
            }
            Map<String, Map<String, Object>> grouped = new LinkedHashMap<>();
            List<EntryKey> channelEntries = new ArrayList<>();
            for (WatchlistEntriesRecord entry : entries) {
                Map<String, Object> summary = byId.get(entry.getWatchlistId());
                if (summary == null || !owed(entry, summary, channelId, now)
                        || !stillMatches(userId, summary, entry.getRecordId())) {
                    continue;
                }
                String key = summary.get("view") + ":" + entry.getRecordId();
                Map<String, Object> record = grouped.computeIfAbsent(key, ignored -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("view", summary.get("view"));
                    item.put("recordId", entry.getRecordId());
                    item.put("watchlistIds", new ArrayList<String>());
                    return item;
                });
                @SuppressWarnings("unchecked")
                List<String> watchlistIds = (List<String>) record.get("watchlistIds");
                if (!watchlistIds.contains(entry.getWatchlistId())) {
                    watchlistIds.add(entry.getWatchlistId());
                }
                channelEntries.add(new EntryKey(entry.getWatchlistId(), entry.getRecordId(),
                        entry.getEnteredAt().toInstant(), null));
            }
            if (grouped.isEmpty()) {
                continue;
            }
            found = true;
            String recipient = recipient(userId, channel);
            if (recipient == null) {
                continue;
            }
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("schema", "vera.watchlist-mail/1");
            payload.put("userId", userId);
            payload.put("sentAt", now.toString());
            payload.put("records", new ArrayList<>(grouped.values()));
            payload.put("manageUrl", "/api/watchlists/manage?token="
                    + links.issue(userId, channelEntries.getFirst().watchlistId()));
            PluginOutcome<?> outcome = calls.call(channelId, DeliveryChannel.class, "send",
                    (delivery, context) -> delivery.send(context, new SendInput(recipient, payload)));
            if (outcome instanceof PluginOutcome.Answered<?>) {
                delivered.addAll(channelEntries.stream()
                        .map(key -> new EntryKey(key.watchlistId(), key.recordId(), key.enteredAt(), channelId))
                        .toList());
            }
        }
        return new MailAttempt(windowId, delivered, found);
    }

    @Override
    public void apply(DSLContext tx, Job job, MailAttempt attempt) {
        String windowId = attempt.windowId();
        Record window = tx.selectFrom(WATCHLIST_MAIL_WINDOWS).where(WATCHLIST_MAIL_WINDOWS.ID.eq(windowId))
                .forUpdate().fetchOne();
        if (window == null || !"waiting".equals(window.get(WATCHLIST_MAIL_WINDOWS.STATE))) {
            return;
        }
        Instant now = clock.instant();
        for (EntryKey key : attempt.delivered()) {
            WatchlistEntriesRecord entry = tx.selectFrom(WATCHLIST_ENTRIES)
                    .where(WATCHLIST_ENTRIES.USER_ID.eq(window.get(WATCHLIST_MAIL_WINDOWS.USER_ID)))
                    .and(WATCHLIST_ENTRIES.WATCHLIST_ID.eq(key.watchlistId()))
                    .and(WATCHLIST_ENTRIES.RECORD_ID.eq(key.recordId()))
                    .and(WATCHLIST_ENTRIES.ENTERED_AT.eq(key.enteredAt().atOffset(ZoneOffset.UTC)))
                    .fetchOne();
            if (entry == null) {
                continue;
            }
            JsonNode delivered = json.readTree(entry.getDeliveredAt().data());
            Map<String, Object> values = new LinkedHashMap<>();
            delivered.properties().forEach(property -> values.put(property.getKey(), property.getValue()));
            values.put(key.channelId(), now.toString());
            tx.update(WATCHLIST_ENTRIES)
                    .set(WATCHLIST_ENTRIES.DELIVERED_AT, JSONB.valueOf(json.writeValueAsString(values)))
                    .where(WATCHLIST_ENTRIES.USER_ID.eq(entry.getUserId()))
                    .and(WATCHLIST_ENTRIES.WATCHLIST_ID.eq(entry.getWatchlistId()))
                    .and(WATCHLIST_ENTRIES.RECORD_ID.eq(entry.getRecordId()))
                    .and(WATCHLIST_ENTRIES.ENTERED_AT.eq(entry.getEnteredAt())).execute();
        }
        tx.update(WATCHLIST_MAIL_WINDOWS).set(WATCHLIST_MAIL_WINDOWS.STATE,
                        attempt.hadEntries() ? "sent" : "empty")
                .where(WATCHLIST_MAIL_WINDOWS.ID.eq(windowId)).execute();
    }

    public record EntryKey(String watchlistId, String recordId, Instant enteredAt, String channelId) {}

    public record MailAttempt(String windowId, List<EntryKey> delivered, boolean hadEntries) {}

    private List<Record> emailChannels(DSLContext tx, String userId) {
        return tx.select(PLUGIN_INSTANCES.ID, PLUGIN_IMPLEMENTATIONS.VERSIONS)
                .from(PLUGIN_INSTANCES.join(PLUGIN_IMPLEMENTATIONS)
                        .on(PLUGIN_INSTANCES.IMPLEMENTATION_ID.eq(PLUGIN_IMPLEMENTATIONS.ID)))
                .where(PLUGIN_IMPLEMENTATIONS.KIND.eq("DeliveryChannel"))
                .and(PLUGIN_INSTANCES.IS_ENABLED.isTrue()).and(PLUGIN_INSTANCES.IS_DELETED.isFalse())
                .orderBy(PLUGIN_INSTANCES.POSITION).fetch().stream()
                .filter(row -> {
                    JsonNode declarations = json.readTree(row.get(PLUGIN_IMPLEMENTATIONS.VERSIONS).data());
                    JsonNode declares = declarations.path(0).path("declares");
                    return "Email".equals(declares.path("channelInterface").asString("Email"))
                            && personCanReach(userId, declares.path("personReach"));
                }).map(row -> (Record) row).toList();
    }

    private boolean personCanReach(String userId, JsonNode reach) {
        if ("email".equals(reach.path("by").asString())) {
            return dsl.fetchExists(dsl.selectOne().from(USERS)
                    .where(USERS.ID.eq(userId)).and(USERS.EMAIL.isNotNull()));
        }
        return "claim".equals(reach.path("by").asString())
                && claims.value(userId, reach.path("claim").asString()) != null;
    }

    private String recipient(String userId, Record channel) {
        JsonNode declarations = json.readTree(channel.get(PLUGIN_IMPLEMENTATIONS.VERSIONS).data());
        JsonNode reach = declarations.path(0).path("declares").path("personReach");
        if ("email".equals(reach.path("by").asString())) {
            return dsl.select(USERS.EMAIL).from(USERS).where(USERS.ID.eq(userId)).fetchOne(USERS.EMAIL);
        }
        return claims.value(userId, reach.path("claim").asString());
    }

    private boolean owed(Record entry, Map<String, Object> summary, String channelId, Instant now) {
        Map<?, ?> viewer = (Map<?, ?>) summary.get("viewer");
        Object channelsValue = viewer.get("channels");
        JsonNode channels = json.valueToTree(channelsValue);
        JsonNode setting = channels.path(channelId);
        JsonNode delivered = json.readTree(entry.get(WATCHLIST_ENTRIES.DELIVERED_AT).data());
        String entered = entry.get(WATCHLIST_ENTRIES.ENTERED_AT).toInstant().toString();
        String since = setting.path("since").asString(null);
        String seen = (String) viewer.get("seenAt");
        String confirmed = (String) viewer.get("confirmedFilter");
        int filterVersion = (Integer) summary.get("filterVersion");
        return setting.path("isOn").asBoolean() && !delivered.has(channelId)
                && (since == null || entered.compareTo(since) > 0)
                && (seen == null || entered.compareTo(seen) > 0)
                && (filterVersion <= 1 || String.valueOf(filterVersion).equals(confirmed));
    }

    private boolean stillMatches(String userId, Map<String, Object> summary, String recordId) {
        JsonNode filter = json.valueToTree(summary.get("filter"));
        return queries.matchesRecord((String) summary.get("view"), filter, userId, recordId);
    }

    private boolean contains(JsonNode array, String value) {
        for (JsonNode item : array) {
            if (value.equals(item.asString())) {
                return true;
            }
        }
        return false;
    }
}
