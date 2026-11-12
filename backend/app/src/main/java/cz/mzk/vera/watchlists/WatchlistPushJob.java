package cz.mzk.vera.watchlists;

import static cz.mzk.vera.db.tables.Tables.PUSH_DEVICES;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_ENTRIES;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_PUSH_BATCHES;
import static cz.mzk.vera.db.tables.Tables.WATCHLISTS;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_VIEWERS;

import cz.mzk.vera.account.AccountQueries;
import cz.mzk.vera.jobs.Job;
import cz.mzk.vera.jobs.JobKind;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.jooq.Record;
import cz.mzk.vera.db.tables.tables.records.WatchlistEntriesRecord;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// WATCH-push; WATCH-channel-off. PushSender encrypts and signs real Web Push outside the apply transaction.
@Component
public final class WatchlistPushJob implements JobKind<WatchlistPushJob.PushAttempt> {
    private final DSLContext dsl;
    private final Clock clock;
    private final JsonMapper json;
    private final AccountQueries account;
    private final WatchlistQueries queries;
    private final PushSender sender;

    public WatchlistPushJob(DSLContext dsl, Clock clock, JsonMapper json, AccountQueries account,
            WatchlistQueries queries, PushSender sender) {
        this.dsl = dsl;
        this.clock = clock;
        this.json = json;
        this.account = account;
        this.queries = queries;
        this.sender = sender;
    }

    @Override
    public String name() {
        return "watchlist.push";
    }

    @Override
    public PushAttempt call(Job job) throws Exception {
        String batchId = job.payload().path("batchId").asString();
        Record batch = dsl.selectFrom(WATCHLIST_PUSH_BATCHES)
                .where(WATCHLIST_PUSH_BATCHES.ID.eq(batchId)).fetchOne();
        if (batch == null || !"waiting".equals(batch.get(WATCHLIST_PUSH_BATCHES.STATE))
                || batch.get(WATCHLIST_PUSH_BATCHES.SEND_AT).toInstant().isAfter(clock.instant())) {
            return new PushAttempt(batchId, List.of(), List.of(), false);
        }
        String userId = batch.get(WATCHLIST_PUSH_BATCHES.USER_ID);
        String watchlistId = batch.get(WATCHLIST_PUSH_BATCHES.WATCHLIST_ID);
        JsonNode notifications = account.settings(userId).path("notifications");
        if (notifications.path("doNotSend").asBoolean() || contains(notifications.path("channelsOff"), "push")) {
            return new PushAttempt(batchId, List.of(), List.of(), false);
        }
        Record watchlist = dsl.selectFrom(WATCHLISTS).where(WATCHLISTS.ID.eq(watchlistId)).fetchOne();
        Record viewer = dsl.selectFrom(WATCHLIST_VIEWERS).where(WATCHLIST_VIEWERS.USER_ID.eq(userId))
                .and(WATCHLIST_VIEWERS.WATCHLIST_ID.eq(watchlistId)).fetchOne();
        boolean visible = watchlist != null && queries.list(userId, watchlist.get(WATCHLISTS.VIEW), false, false)
                .stream().anyMatch(summary -> watchlistId.equals(summary.get("id")));
        if (watchlist == null || viewer == null || !viewer.get(WATCHLIST_VIEWERS.PUSH) || !visible) {
            return new PushAttempt(batchId, List.of(), List.of(), false);
        }
        Instant pushSince = viewer.get(WATCHLIST_VIEWERS.PUSH_SINCE) == null ? null
                : viewer.get(WATCHLIST_VIEWERS.PUSH_SINCE).toInstant();
        Instant seenAt = viewer.get(WATCHLIST_VIEWERS.SEEN_AT) == null ? null
                : viewer.get(WATCHLIST_VIEWERS.SEEN_AT).toInstant();
        OffsetDateTime allowedAt = dsl.select(PUSH_DEVICES.CREATED_AT).from(PUSH_DEVICES)
                .where(PUSH_DEVICES.USER_ID.eq(userId)).orderBy(PUSH_DEVICES.CREATED_AT).limit(1)
                .fetchOne(PUSH_DEVICES.CREATED_AT);
        if (allowedAt == null) {
            return new PushAttempt(batchId, List.of(), List.of(), false);
        }
        List<WatchlistEntriesRecord> entries = dsl.selectFrom(WATCHLIST_ENTRIES)
                .where(WATCHLIST_ENTRIES.USER_ID.eq(userId))
                .and(WATCHLIST_ENTRIES.WATCHLIST_ID.eq(watchlistId))
                .and(WATCHLIST_ENTRIES.BASELINE.isFalse())
                .and(WATCHLIST_ENTRIES.PUSH_DELIVERED_AT.isNull()).fetch();
        List<WatchlistEntriesRecord> pending = entries.stream().filter(entry -> entry.get(WATCHLIST_ENTRIES.ENTERED_AT)
                        .toInstant().isAfter(allowedAt.toInstant()))
                .filter(entry -> pushSince == null || entry.get(WATCHLIST_ENTRIES.ENTERED_AT)
                        .toInstant().isAfter(pushSince))
                .filter(entry -> seenAt == null || entry.get(WATCHLIST_ENTRIES.ENTERED_AT)
                        .toInstant().isAfter(seenAt))
                .filter(entry -> stillMatches(userId, watchlist, entry.get(WATCHLIST_ENTRIES.RECORD_ID)))
                .toList();
        if (pending.isEmpty()) {
            return new PushAttempt(batchId, List.of(), List.of(), false);
        }
        Instant last = pending.stream().map(entry -> entry.get(WATCHLIST_ENTRIES.ENTERED_AT).toInstant())
                .max(Instant::compareTo).orElseThrow();
        Instant first = pending.stream().map(entry -> entry.get(WATCHLIST_ENTRIES.ENTERED_AT).toInstant())
                .min(Instant::compareTo).orElseThrow();
        if (clock.instant().isBefore(last.plusSeconds(5))
                && clock.instant().isBefore(first.plusSeconds(30))) {
            return new PushAttempt(batchId, List.of(), List.of(), false);
        }
        List<String> names = pending.stream().limit(3).map(entry -> entry.get(WATCHLIST_ENTRIES.RECORD_ID))
                .toList();
        int rest = pending.size() - names.size();
        String body = String.join(", ", names) + (rest > 0 ? " +" + rest + " more" : "");
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", watchlist.get(WATCHLISTS.NAME));
        payload.put("body", body);
        payload.put("url", "/preferences/watchlists?watchlist=" + watchlistId);
        String serialized = json.writeValueAsString(payload);
        List<DeviceResult> results = new ArrayList<>();
        for (Record device : dsl.selectFrom(PUSH_DEVICES).where(PUSH_DEVICES.USER_ID.eq(userId)).fetch()) {
            int status = sender.send(device.get(PUSH_DEVICES.ENDPOINT), device.get(PUSH_DEVICES.P256DH),
                    device.get(PUSH_DEVICES.AUTH), serialized);
            results.add(new DeviceResult(device.get(PUSH_DEVICES.ID), status));
        }
        List<PendingEntry> sentEntries = pending.stream().map(entry -> new PendingEntry(
                entry.get(WATCHLIST_ENTRIES.RECORD_ID), entry.get(WATCHLIST_ENTRIES.ENTERED_AT).toInstant())).toList();
        return new PushAttempt(batchId, results, sentEntries, true);
    }

    @Override
    public void apply(DSLContext tx, Job job, PushAttempt attempt) {
        Record batch = tx.selectFrom(WATCHLIST_PUSH_BATCHES).where(WATCHLIST_PUSH_BATCHES.ID.eq(attempt.batchId()))
                .fetchOne();
        if (batch == null || !"waiting".equals(batch.get(WATCHLIST_PUSH_BATCHES.STATE))) {
            return;
        }
        for (DeviceResult result : attempt.devices()) {
            if (result.status() == 404 || result.status() == 410) {
                tx.deleteFrom(PUSH_DEVICES).where(PUSH_DEVICES.ID.eq(result.deviceId())).execute();
            }
        }
        if (attempt.sent()) {
            for (PendingEntry entry : attempt.entries()) {
                tx.update(WATCHLIST_ENTRIES).set(WATCHLIST_ENTRIES.PUSH_DELIVERED_AT,
                                clock.instant().atOffset(ZoneOffset.UTC))
                        .where(WATCHLIST_ENTRIES.USER_ID.eq(batch.get(WATCHLIST_PUSH_BATCHES.USER_ID)))
                        .and(WATCHLIST_ENTRIES.WATCHLIST_ID.eq(batch.get(WATCHLIST_PUSH_BATCHES.WATCHLIST_ID)))
                        .and(WATCHLIST_ENTRIES.RECORD_ID.eq(entry.recordId()))
                        .and(WATCHLIST_ENTRIES.ENTERED_AT.eq(entry.enteredAt().atOffset(ZoneOffset.UTC)))
                        .execute();
            }
        }
        tx.update(WATCHLIST_PUSH_BATCHES).set(WATCHLIST_PUSH_BATCHES.STATE,
                        attempt.sent() ? "sent" : "empty")
                .where(WATCHLIST_PUSH_BATCHES.ID.eq(attempt.batchId())).execute();
    }

    private boolean stillMatches(String userId, Record watchlist, String recordId) {
        JsonNode filter = json.readTree(watchlist.get(WATCHLISTS.FILTER).data());
        return queries.matchesRecord(watchlist.get(WATCHLISTS.VIEW), filter, userId, recordId);
    }

    private boolean contains(JsonNode values, String value) {
        for (JsonNode item : values) {
            if (value.equals(item.asString())) {
                return true;
            }
        }
        return false;
    }

    public record DeviceResult(String deviceId, int status) {}

    public record PendingEntry(String recordId, Instant enteredAt) {}

    public record PushAttempt(String batchId, List<DeviceResult> devices,
            List<PendingEntry> entries, boolean sent) {}
}
