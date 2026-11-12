package cz.mzk.vera.watchlists;

import static cz.mzk.vera.db.tables.Tables.HOOK_EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.PUSH_DEVICES;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static cz.mzk.vera.db.tables.Tables.WATCHLISTS;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_ENTRIES;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_BASELINES;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_MAIL_WINDOWS;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_MEMBERSHIPS;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_PUSH_BATCHES;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_VIEWERS;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_VIEWERS;

import cz.mzk.vera.account.AccountQueries;
import cz.mzk.vera.documents.DocumentQueries;
import cz.mzk.vera.jobs.Job;
import cz.mzk.vera.jobs.JobKind;
import cz.mzk.vera.jobs.Jobs;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.Record;
import cz.mzk.vera.db.tables.tables.records.HookEventsRecord;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// WATCH-new; WATCH-mail-batch. Event matching runs after the act's transaction has committed.
@Component
public final class WatchlistMatchJob implements JobKind<WatchlistMatchJob.Match> {
    private static final Duration MAIL_WINDOW = Duration.ofMinutes(15);
    private final DSLContext dsl;
    private final JsonMapper json;
    private final Clock clock;
    private final Jobs jobs;
    private final WatchlistQueries watchlists;
    private final DocumentQueries documents;
    private final AccountQueries account;

    public WatchlistMatchJob(DSLContext dsl, JsonMapper json, Clock clock, Jobs jobs,
            WatchlistQueries watchlists, DocumentQueries documents, AccountQueries account) {
        this.dsl = dsl;
        this.json = json;
        this.clock = clock;
        this.jobs = jobs;
        this.watchlists = watchlists;
        this.documents = documents;
        this.account = account;
    }

    @Override
    public String name() {
        return "watchlist.match";
    }

    @Override
    public Match call(Job job) {
        String eventId = job.payload().path("eventId").asString();
        HookEventsRecord event = dsl.selectFrom(HOOK_EVENTS).where(HOOK_EVENTS.ID.eq(eventId)).fetchOne();
        return event == null ? null : new Match(eventId, event.getSubjectKind(), event.getSubjectId(),
                event.getOccurredAt().toInstant());
    }

    @Override
    public void apply(DSLContext tx, Job job, Match event) {
        if (event == null) {
            return;
        }
        HookEventsRecord existing = tx.selectFrom(HOOK_EVENTS).where(HOOK_EVENTS.ID.eq(event.eventId())).fetchOne();
        if (existing == null) {
            return;
        }
        String documentId = documentId(event.subjectKind(), event.subjectId());
        if (documentId == null && !List.of("list", "iteration", "project", "category", "mix",
                "intention", "run").contains(event.subjectKind())) {
            return;
        }
        List<String> userIds = tx.select(USERS.ID).from(USERS).where(USERS.SUSPENDED_AT.isNull())
                .fetch(USERS.ID);
        for (String userId : userIds) {
            for (Map<String, Object> summary : watchlists.list(userId, null, false, false)) {
                String view = (String) summary.get("view");
                if (!List.of("documents", "my-documents", "requests", "validations", "lists",
                        "projects", "categories", "mixes", "intentions", "tasks")
                        .contains(view)) {
                    continue;
                }
                String recordId = recordId(view, event, documentId);
                if (recordId == null) {
                    continue;
                }
                String id = (String) summary.get("id");
                int filterVersion = (Integer) summary.get("filterVersion");
                tx.insertInto(WATCHLIST_BASELINES)
                        .set(WATCHLIST_BASELINES.ID, userId + ":" + id + ":" + filterVersion)
                        .onConflictDoNothing().execute();
                JsonNode filter = json.valueToTree(summary.get("filter"));
                boolean matches = watchlists.matchesRecord(view, filter, userId, recordId, event.subjectId());
                if (!matches) {
                    tx.deleteFrom(WATCHLIST_MEMBERSHIPS).where(WATCHLIST_MEMBERSHIPS.USER_ID.eq(userId))
                            .and(WATCHLIST_MEMBERSHIPS.WATCHLIST_ID.eq(id))
                            .and(WATCHLIST_MEMBERSHIPS.RECORD_ID.eq(recordId)).execute();
                    continue;
                }
                boolean alreadyMatches = tx.fetchExists(tx.selectOne().from(WATCHLIST_MEMBERSHIPS)
                        .where(WATCHLIST_MEMBERSHIPS.USER_ID.eq(userId))
                        .and(WATCHLIST_MEMBERSHIPS.WATCHLIST_ID.eq(id))
                        .and(WATCHLIST_MEMBERSHIPS.RECORD_ID.eq(recordId)));
                tx.insertInto(WATCHLIST_MEMBERSHIPS)
                        .set(WATCHLIST_MEMBERSHIPS.USER_ID, userId)
                        .set(WATCHLIST_MEMBERSHIPS.WATCHLIST_ID, id)
                        .set(WATCHLIST_MEMBERSHIPS.RECORD_ID, recordId)
                        .onConflictDoNothing().execute();
                if (alreadyMatches) {
                    continue;
                }
                boolean baseline = event.at().isBefore(OffsetDateTime.parse((String) summary.get("createdAt"))
                        .toInstant());
                boolean inserted = tx.insertInto(WATCHLIST_ENTRIES)
                        .set(WATCHLIST_ENTRIES.USER_ID, userId)
                        .set(WATCHLIST_ENTRIES.WATCHLIST_ID, id)
                        .set(WATCHLIST_ENTRIES.RECORD_ID, recordId)
                        .set(WATCHLIST_ENTRIES.ENTERED_AT, event.at().atOffset(ZoneOffset.UTC))
                        .set(WATCHLIST_ENTRIES.BASELINE, baseline)
                        .set(WATCHLIST_ENTRIES.FILTER_VERSION, filterVersion)
                        .set(WATCHLIST_ENTRIES.DELIVERED_AT, JSONB.valueOf("{}"))
                        .onConflictDoNothing().execute() > 0;
                if (inserted && !baseline) {
                    queueForPerson(tx, userId, id, recordId, event.at());
                }
            }
        }
    }

    private void queueForPerson(DSLContext tx, String userId, String watchlistId,
            String recordId, Instant at) {
        jobs.enqueue(tx, "watchlist.chat", at,
                Map.of("userId", userId, "watchlistId", watchlistId, "recordId", recordId));
        queuePush(tx, userId, watchlistId, at);
        JsonNode settings = account.settings(userId).path("notifications");
        if (settings.path("doNotSend").asBoolean()) {
            return;
        }
        Instant end = at.plus(MAIL_WINDOW);
        Record existing = tx.selectFrom(WATCHLIST_MAIL_WINDOWS).where(WATCHLIST_MAIL_WINDOWS.USER_ID.eq(userId))
                .and(WATCHLIST_MAIL_WINDOWS.STATE.eq("waiting"))
                .and(WATCHLIST_MAIL_WINDOWS.SEND_AT.gt(at.atOffset(ZoneOffset.UTC)))
                .and(WATCHLIST_MAIL_WINDOWS.SEND_AT.le(end.atOffset(ZoneOffset.UTC)))
                .orderBy(WATCHLIST_MAIL_WINDOWS.SEND_AT).limit(1).fetchOne();
        if (existing != null) {
            return;
        }
        String id = "WM-" + UUID.randomUUID();
        boolean inserted = tx.insertInto(WATCHLIST_MAIL_WINDOWS)
                .set(WATCHLIST_MAIL_WINDOWS.ID, id)
                .set(WATCHLIST_MAIL_WINDOWS.USER_ID, userId)
                .set(WATCHLIST_MAIL_WINDOWS.SEND_AT, end.atOffset(ZoneOffset.UTC))
                .set(WATCHLIST_MAIL_WINDOWS.STATE, "waiting")
                .onConflictDoNothing().execute() > 0;
        if (inserted) {
            jobs.enqueue(tx, "watchlist.mail", end, Map.of("windowId", id));
        }
    }

    private void queuePush(DSLContext tx, String userId, String watchlistId, Instant at) {
        JsonNode settings = account.settings(userId).path("notifications");
        JsonNode channelsOff = settings.path("channelsOff");
        for (JsonNode channel : channelsOff) {
            if ("push".equals(channel.asString())) {
                return;
            }
        }
        Record viewer = tx.selectFrom(WATCHLIST_VIEWERS).where(WATCHLIST_VIEWERS.USER_ID.eq(userId))
                .and(WATCHLIST_VIEWERS.WATCHLIST_ID.eq(watchlistId)).fetchOne();
        if (settings.path("doNotSend").asBoolean() || viewer == null
                || !viewer.get(WATCHLIST_VIEWERS.PUSH)
                || !tx.fetchExists(tx.selectOne().from(PUSH_DEVICES).where(PUSH_DEVICES.USER_ID.eq(userId)))) {
            return;
        }
        Record batch = tx.selectFrom(WATCHLIST_PUSH_BATCHES).where(WATCHLIST_PUSH_BATCHES.USER_ID.eq(userId))
                .and(WATCHLIST_PUSH_BATCHES.WATCHLIST_ID.eq(watchlistId))
                .and(WATCHLIST_PUSH_BATCHES.STATE.eq("waiting"))
                .orderBy(WATCHLIST_PUSH_BATCHES.FIRST_AT).limit(1).fetchOne();
        Instant sendAt;
        String batchId;
        if (batch == null) {
            batchId = "WP-" + UUID.randomUUID();
            sendAt = at.plusSeconds(5);
            tx.insertInto(WATCHLIST_PUSH_BATCHES).set(WATCHLIST_PUSH_BATCHES.ID, batchId)
                    .set(WATCHLIST_PUSH_BATCHES.USER_ID, userId)
                    .set(WATCHLIST_PUSH_BATCHES.WATCHLIST_ID, watchlistId)
                    .set(WATCHLIST_PUSH_BATCHES.FIRST_AT, at.atOffset(ZoneOffset.UTC))
                    .set(WATCHLIST_PUSH_BATCHES.SEND_AT, sendAt.atOffset(ZoneOffset.UTC))
                    .set(WATCHLIST_PUSH_BATCHES.STATE, "waiting").execute();
        } else {
            batchId = batch.get(WATCHLIST_PUSH_BATCHES.ID);
            Instant quiet = at.plusSeconds(5);
            Instant ceiling = batch.get(WATCHLIST_PUSH_BATCHES.FIRST_AT).toInstant().plusSeconds(30);
            sendAt = quiet.isBefore(ceiling) ? quiet : ceiling;
            tx.update(WATCHLIST_PUSH_BATCHES).set(WATCHLIST_PUSH_BATCHES.SEND_AT, sendAt.atOffset(ZoneOffset.UTC))
                    .where(WATCHLIST_PUSH_BATCHES.ID.eq(batchId)).execute();
        }
        jobs.enqueue(tx, "watchlist.push", sendAt, Map.of("batchId", batchId));
    }

    private String documentId(String kind, String id) {
        if ("document".equals(kind)) {
            return id;
        }
        if ("request".equals(kind)) {
            return dsl.select(REQUESTS.DOCUMENT_ID).from(REQUESTS).where(REQUESTS.ID.eq(id))
                    .fetchOne(REQUESTS.DOCUMENT_ID);
        }
        if ("proposal".equals(kind)) {
            return id;
        }
        if ("iteration".equals(kind)) {
            return dsl.select(ITERATIONS.DOCUMENT_ID).from(ITERATIONS).where(ITERATIONS.ID.eq(id))
                    .fetchOne(ITERATIONS.DOCUMENT_ID);
        }
        return null;
    }

    private String recordId(String view, Match event, String documentId) {
        String kind = event.subjectKind();
        if ("requests".equals(view)) {
            return "request".equals(kind) ? documentId : null;
        }
        if (("projects".equals(view) && "project".equals(kind))
                || ("categories".equals(view) && "category".equals(kind))
                || ("mixes".equals(view) && "mix".equals(kind))
                || ("intentions".equals(view) && "intention".equals(kind))
                || ("tasks".equals(view) && "run".equals(kind))) {
            return event.subjectId();
        }
        if ("lists".equals(view)) {
            return "list".equals(event.subjectKind()) ? event.subjectId() : null;
        }
        if ("validations".equals(view)) {
            return "iteration".equals(event.subjectKind()) ? event.subjectId() : null;
        }
        if ("list".equals(event.subjectKind())) {
            return null;
        }
        return documentId;
    }

    public record Match(String eventId, String subjectKind, String subjectId, Instant at) {}
}
