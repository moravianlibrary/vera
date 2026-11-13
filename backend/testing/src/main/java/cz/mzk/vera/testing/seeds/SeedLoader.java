package cz.mzk.vera.testing.seeds;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.CATEGORY_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.DELETED_PROPERTY_KEYS;
import static cz.mzk.vera.db.tables.Tables.GROUP_CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.GROUP_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.GROUPS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.RUNS;
import static cz.mzk.vera.db.tables.Tables.RUN_ERRORS;
import static cz.mzk.vera.db.tables.Tables.RUN_ITEMS;
import static cz.mzk.vera.db.tables.Tables.RUN_LOG;
import static cz.mzk.vera.db.tables.Tables.SCHEDULES;
import static cz.mzk.vera.db.tables.Tables.TASK_RETENTION;
import static cz.mzk.vera.db.tables.Tables.HOOKS;
import static cz.mzk.vera.db.tables.Tables.HOOK_DELIVERIES;
import static cz.mzk.vera.db.tables.Tables.HOOK_ATTEMPTS;
import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_IDENTITIES;
import static cz.mzk.vera.db.tables.Tables.WATCHLISTS;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_VIEWERS;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_ENTRIES;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_BASELINES;
import static cz.mzk.vera.db.tables.Tables.USER_MAPPED_ROLES;
import static cz.mzk.vera.db.tables.Tables.USERS;

import cz.mzk.vera.tasks.ScheduleQueue;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.List;
import java.util.Set;
import java.util.ArrayList;
import java.util.stream.Collectors;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@Component
public class SeedLoader {
    private final DSLContext dsl;
    private final RecordsSeedLoader records;
    private final JsonMapper json;
    private final ScheduleQueue scheduleQueue;

    public SeedLoader(DSLContext dsl, RecordsSeedLoader records, JsonMapper json, ScheduleQueue scheduleQueue) {
        this.dsl = dsl;
        this.records = records;
        this.json = json;
        this.scheduleQueue = scheduleQueue;
    }

    public void load(JsonNode seed) {
        load(dsl, seed);
    }

    public void load(DSLContext target, JsonNode seed) {
        target.transaction(configuration -> insert(DSL.using(configuration), seed));
    }

    private void insert(DSLContext transaction, JsonNode seed) {
        JsonNode collections = seed.path("collections");
        int position = 0;
        for (JsonNode user : collections.path("users")) {
            JsonNode access = collections.path("userAccess").path(user.path("id").asString());
            transaction.insertInto(USERS)
                    .set(USERS.ID, string(user, "id"))
                    .set(USERS.NAME, string(user, "name"))
                    .set(USERS.KIND, string(user, "kind"))
                    .set(USERS.EMAIL, nullableString(user, "email"))
                    .set(USERS.ENTRY, nullableString(access, "entry"))
                    .set(USERS.SUSPENDED_AT, instant(access, "suspendedAt"))
                    .set(USERS.POSITION, position++)
                    .execute();
        }

        position = 0;
        for (JsonNode role : collections.path("roles")) {
            String roleId = string(role, "id");
            transaction.insertInto(ROLES)
                    .set(ROLES.ID, roleId)
                    .set(ROLES.NAME, string(role, "name"))
                    .set(ROLES.NAMES, JSONB.valueOf(namesJson(role)))
                    .set(ROLES.DESCRIPTION, string(role, "description"))
                    .set(ROLES.IS_SHIPPED, role.path("isShipped").asBoolean())
                    .set(ROLES.PROPOSAL_BATCH_LIMIT, nullableInteger(role, "proposalBatchLimit"))
                    .set(ROLES.PROPOSAL_DAILY_LIMIT, nullableInteger(role, "proposalDailyLimit"))
                    .set(ROLES.POSITION, position++)
                    .execute();

            int grantPosition = 0;
            for (JsonNode grant : role.path("grants")) {
                transaction.insertInto(ROLE_GRANTS)
                        .set(ROLE_GRANTS.ROLE_ID, roleId)
                        .set(ROLE_GRANTS.POSITION, grantPosition++)
                        .set(ROLE_GRANTS.PERMISSION, string(grant, "permission"))
                        .set(ROLE_GRANTS.SCOPE, nullableString(grant, "scope"))
                        .execute();
            }
        }

        collections.path("userAccess").properties().forEach(entry -> {
            String userId = entry.getKey();
            JsonNode access = entry.getValue();
            int rolePosition = 0;
            for (JsonNode roleId : access.path("handRoleIds")) {
                transaction.insertInto(USER_HAND_ROLES)
                        .set(USER_HAND_ROLES.USER_ID, userId)
                        .set(USER_HAND_ROLES.ROLE_ID, roleId.asString())
                        .set(USER_HAND_ROLES.POSITION, rolePosition++)
                        .execute();
            }
            rolePosition = 0;
            for (JsonNode mappedRole : access.path("mappedRoles")) {
                transaction.insertInto(USER_MAPPED_ROLES)
                        .set(USER_MAPPED_ROLES.USER_ID, userId)
                        .set(USER_MAPPED_ROLES.ROLE_ID, string(mappedRole, "roleId"))
                        .set(USER_MAPPED_ROLES.INSTANCE_ID, string(mappedRole, "instanceId"))
                        .set(USER_MAPPED_ROLES.CLAIM, string(mappedRole, "claim"))
                        .set(USER_MAPPED_ROLES.POSITION, rolePosition++)
                        .execute();
            }
            int identityPosition = 0;
            for (JsonNode identity : access.path("identities")) {
                Map<String, List<String>> claims = new LinkedHashMap<>();
                String slackHandle = seed.path("fakes").path("slackHandles").path(userId).asString(null);
                if (slackHandle != null && !slackHandle.isBlank()) {
                    // The seed has no claims of its own, so supply the fake Slack claim on each identity.
                    claims.put("slack_id", List.of(slackHandle));
                }
                transaction.insertInto(USER_IDENTITIES)
                        .set(USER_IDENTITIES.USER_ID, userId)
                        .set(USER_IDENTITIES.INSTANCE_ID, string(identity, "instanceId"))
                        .set(USER_IDENTITIES.EXTERNAL_ID, string(identity, "externalId"))
                        .set(USER_IDENTITIES.CLAIMS, JSONB.valueOf(json.valueToTree(claims).toString()))
                        .set(USER_IDENTITIES.LAST_LOGIN_AT, instant(identity, "lastLoginAt"))
                        .set(USER_IDENTITIES.POSITION, identityPosition++)
                        .execute();
            }
        });

        position = 0;
        for (JsonNode category : collections.path("categories")) {
            transaction.insertInto(CATEGORIES)
                    .set(CATEGORIES.ID, string(category, "id"))
                    .set(CATEGORIES.NAME, string(category, "name"))
                    .set(CATEGORIES.NAMES, JSONB.valueOf(namesJson(category)))
                    .set(CATEGORIES.PARENT_ID, nullableString(category, "parentId"))
                    .set(CATEGORIES.POSITION, position++)
                    .execute();
        }

        position = 0;
        for (JsonNode group : collections.path("groups")) {
            String groupId = string(group, "id");
            transaction.insertInto(GROUPS)
                    .set(GROUPS.ID, groupId)
                    .set(GROUPS.NAME, string(group, "name"))
                    .set(GROUPS.DESCRIPTION, string(group, "description"))
                    .set(GROUPS.POSITION, position++)
                    .execute();
            int memberPosition = 0;
            for (JsonNode memberId : group.path("memberIds")) {
                transaction.insertInto(GROUP_MEMBERS)
                        .set(GROUP_MEMBERS.GROUP_ID, groupId)
                        .set(GROUP_MEMBERS.USER_ID, memberId.asString())
                        .set(GROUP_MEMBERS.POSITION, memberPosition++)
                        .execute();
            }
            int categoryPosition = 0;
            for (JsonNode categoryId : group.path("categoryIds")) {
                transaction.insertInto(GROUP_CATEGORIES)
                        .set(GROUP_CATEGORIES.GROUP_ID, groupId)
                        .set(GROUP_CATEGORIES.CATEGORY_ID, categoryId.asString())
                        .set(GROUP_CATEGORIES.POSITION, categoryPosition++)
                        .execute();
            }
        }

        for (Map.Entry<String, JsonNode> entry : collections.path("categoryMembers").properties()) {
            int memberPosition = 0;
            for (JsonNode userId : entry.getValue()) {
                transaction.insertInto(CATEGORY_MEMBERS)
                        .set(CATEGORY_MEMBERS.CATEGORY_ID, entry.getKey())
                        .set(CATEGORY_MEMBERS.USER_ID, userId.asString())
                        .set(CATEGORY_MEMBERS.POSITION, memberPosition++)
                        .execute();
            }
        }

        position = 0;
        for (JsonNode implementation : collections.path("pluginImplementations")) {
            transaction.insertInto(PLUGIN_IMPLEMENTATIONS)
                    .set(PLUGIN_IMPLEMENTATIONS.ID, string(implementation, "id"))
                    .set(PLUGIN_IMPLEMENTATIONS.DESCRIPTOR_ID, string(implementation, "descriptorId"))
                    .set(PLUGIN_IMPLEMENTATIONS.NAME, string(implementation, "name"))
                    .set(PLUGIN_IMPLEMENTATIONS.DESCRIPTION, string(implementation, "description"))
                    .set(PLUGIN_IMPLEMENTATIONS.KIND, string(implementation, "kind"))
                    .set(PLUGIN_IMPLEMENTATIONS.VERSIONS, JSONB.valueOf(implementation.path("versions").toString()))
                    .set(PLUGIN_IMPLEMENTATIONS.POSITION, position++)
                    .execute();
        }

        position = 0;
        for (JsonNode instance : collections.path("pluginInstances")) {
            ObjectNode configuration = (ObjectNode) instance.path("configuration").deepCopy();
            JsonNode catalog = seed.path("fakes").path("catalogBases").path(
                    configuration.path("base_url").asString());
            if (!catalog.isMissingNode()) {
                configuration.put("opac_url", catalog.path("opacUrl").asString());
                configuration.put("catalog_base", catalog.path("base").asString());
            }
            transaction.insertInto(PLUGIN_INSTANCES)
                    .set(PLUGIN_INSTANCES.ID, string(instance, "id"))
                    .set(PLUGIN_INSTANCES.NAME, string(instance, "name"))
                    .set(PLUGIN_INSTANCES.IMPLEMENTATION_ID, string(instance, "implementationId"))
                    .set(PLUGIN_INSTANCES.CONFIGURATION, JSONB.valueOf(configuration.toString()))
                    .set(PLUGIN_INSTANCES.SETTINGS, nullableJson(instance, "settings"))
                    .set(PLUGIN_INSTANCES.VERSION, string(instance, "version"))
                    .set(PLUGIN_INSTANCES.POLICY, nullableJson(instance, "policy"))
                    .set(PLUGIN_INSTANCES.LINKED_CATEGORY_ID,
                            nullableString(instance, "linkedCategoryId"))
                    .set(PLUGIN_INSTANCES.IS_PREDEFINED, instance.path("isPredefined").asBoolean())
                    .set(PLUGIN_INSTANCES.CREATED_BY, instance.path("createdBy").isMissingNode()
                            || instance.path("createdBy").isNull()
                            ? "u3" : string(instance, "createdBy"))
                    .set(PLUGIN_INSTANCES.TRIGGERS, JSONB.valueOf(instance.path("triggers").toString()))
                    .set(PLUGIN_INSTANCES.IS_ENABLED, instance.path("isEnabled").asBoolean())
                    .set(PLUGIN_INSTANCES.IS_DELETED, instance.path("isDeleted").asBoolean())
                    .set(PLUGIN_INSTANCES.CREATED_AT, instant(instance, "createdAt"))
                    .set(PLUGIN_INSTANCES.LAST_RUN_AT, instant(instance, "lastRunAt"))
                    .set(PLUGIN_INSTANCES.POSITION, position++)
                    .execute();
        }
        transaction.deleteFrom(DELETED_PROPERTY_KEYS).execute();
        for (JsonNode key : collections.path("deletedPropertyKeys")) {
            transaction.insertInto(DELETED_PROPERTY_KEYS)
                    .set(DELETED_PROPERTY_KEYS.KEY, key.asString())
                    .execute();
        }
        records.catalogMirror(transaction, seed);
        records.load(transaction, collections);
        tasks(transaction, seed, collections);
        hooks(transaction, collections);
        watchlists(transaction, collections);
    }

    // HOOK-model; seeded subscriptions and delivery history follow the contract seed.
    private void hooks(DSLContext target, JsonNode collections) {
        int position = 0;
        for (JsonNode row : collections.path("hooks")) {
            JsonNode preference = row.path("recipientPreference");
            List<String> eventCodes = new ArrayList<>();
            JsonNode events = row.path("events");
            if (events.isArray()) {
                events.forEach(event -> eventCodes.add(event.asString()));
            } else {
                String event = string(row, "event");
                if ("request.decided".equals(event)) {
                    eventCodes.add("request.approved");
                    eventCodes.add("request.declined");
                } else if ("task.failed".equals(event)) {
                    eventCodes.add("run.failed");
                } else if ("list.created".equals(event) && "H-07".equals(string(row, "id"))) {
                    eventCodes.add("list.created");
                    eventCodes.add("list.started");
                    eventCodes.add("list.marked_done");
                } else {
                    eventCodes.add(event);
                }
            }
            target.insertInto(HOOKS)
                    .set(HOOKS.ID, string(row, "id"))
                    .set(HOOKS.NAME, string(row, "name"))
                    .set(HOOKS.EVENTS, JSONB.valueOf(json.valueToTree(eventCodes).toString()))
                    .set(HOOKS.CONDITIONS, JSONB.valueOf(row.path("conditions").toString()))
                    .set(HOOKS.CHANNEL_ID, string(row, "channelId"))
                    .set(HOOKS.RECIPIENT, string(row, "recipient"))
                    .set(HOOKS.MESSAGE, string(row, "message"))
                    .set(HOOKS.BATCH, nullableJson(row, "batch"))
                    .set(HOOKS.RETRY, JSONB.valueOf(row.path("retry").toString()))
                    .set(HOOKS.RECIPIENT_PREFERENCE, preference.isMissingNode() || preference.isNull()
                            ? null : JSONB.valueOf(preference.toString()))
                    .set(HOOKS.INCLUDE_PRIVATE, row.path("includePrivate").asBoolean(false))
                    .set(HOOKS.STATE, string(row, "state"))
                    .set(HOOKS.CREATED_BY, string(row, "createdBy"))
                    .set(HOOKS.CREATED_AT, instant(row, "createdAt"))
                    .set(HOOKS.PAUSE, nullableJson(row, "pause"))
                    .set(HOOKS.POSITION, position++)
                    .execute();
        }
        position = 0;
        for (JsonNode row : collections.path("hookDeliveries")) {
            List<String> events = new ArrayList<>();
            if (row.path("events").isArray()) {
                row.path("events").forEach(event -> events.add(event.asString()));
            } else {
                String event = string(row, "event");
                if ("request.decided".equals(event)) {
                    events.add("request.approved");
                    events.add("request.declined");
                } else {
                    events.add(event);
                }
            }
            target.insertInto(HOOK_DELIVERIES)
                    .set(HOOK_DELIVERIES.ID, string(row, "id"))
                    .set(HOOK_DELIVERIES.HOOK_ID, string(row, "hookId"))
                    .set(HOOK_DELIVERIES.RECIPIENT, string(row, "recipient"))
                    .set(HOOK_DELIVERIES.SUBJECTS, JSONB.valueOf(row.path("subjects").toString()))
                    .set(HOOK_DELIVERIES.EVENTS, JSONB.valueOf(json.valueToTree(events).toString()))
                    .set(HOOK_DELIVERIES.EVENT_IDS, JSONB.valueOf("[]"))
                    .set(HOOK_DELIVERIES.PUBLIC_TEXT, string(row, "publicText"))
                    .set(HOOK_DELIVERIES.STATE, string(row, "state"))
                    .set(HOOK_DELIVERIES.FIRST_AT, instant(row, "firstAt"))
                    .set(HOOK_DELIVERIES.LAST_AT, instant(row, "lastAt"))
                    .set(HOOK_DELIVERIES.SEND_AT, instant(row, "sendAt"))
                    .set(HOOK_DELIVERIES.ATTEMPTS, row.path("attempts").asInt())
                    .set(HOOK_DELIVERIES.LAST_ERROR, nullableString(row, "lastError"))
                    .set(HOOK_DELIVERIES.POSITION, position++)
                    .execute();
        }
        position = 0;
        for (JsonNode row : collections.path("hookAttempts")) {
            target.insertInto(HOOK_ATTEMPTS)
                    .set(HOOK_ATTEMPTS.ID, string(row, "id"))
                    .set(HOOK_ATTEMPTS.DELIVERY_ID, string(row, "deliveryId"))
                    .set(HOOK_ATTEMPTS.AT, instant(row, "at"))
                    .set(HOOK_ATTEMPTS.RESULT, string(row, "result"))
                    .set(HOOK_ATTEMPTS.DETAIL, string(row, "detail"))
                    .set(HOOK_ATTEMPTS.DURATION_MS, row.path("durationMs").asInt())
                    .set(HOOK_ATTEMPTS.POSITION, position++)
                    .execute();
        }
    }

    private void watchlists(DSLContext target, JsonNode collections) {
        int position = 0;
        for (JsonNode row : collections.path("watchlists")) {
            target.insertInto(WATCHLISTS)
                    .set(WATCHLISTS.ID, string(row, "id"))
                    .set(WATCHLISTS.OWNER_ID, string(row, "ownerId"))
                    .set(WATCHLISTS.NAME, string(row, "name"))
                    .set(WATCHLISTS.NAMES, JSONB.valueOf(namesJson(row)))
                    .set(WATCHLISTS.VIEW, string(row, "view"))
                    .set(WATCHLISTS.FILTER, JSONB.valueOf(row.path("filter").toString()))
                    .set(WATCHLISTS.AUDIENCE, JSONB.valueOf(row.path("audience").toString()))
                    .set(WATCHLISTS.CREATED_AT, instant(row, "createdAt"))
                    .set(WATCHLISTS.COPIED_FROM, nullableString(row, "copiedFrom"))
                    .set(WATCHLISTS.FILTER_VERSION, row.path("filterVersion").asInt(1))
                    .set(WATCHLISTS.POSITION, position++)
                    .execute();
        }
        Map<String, Integer> viewerPositions = new LinkedHashMap<>();
        for (JsonNode row : collections.path("watchlistViewers")) {
            String userId = string(row, "userId");
            int viewerPosition = row.has("position") && !row.path("position").isNull()
                    ? row.path("position").asInt()
                    : viewerPositions.getOrDefault(userId, 0);
            target.insertInto(WATCHLIST_VIEWERS)
                    .set(WATCHLIST_VIEWERS.USER_ID, userId)
                    .set(WATCHLIST_VIEWERS.WATCHLIST_ID, string(row, "watchlistId"))
                    .set(WATCHLIST_VIEWERS.SEEN_AT, instant(row, "seenAt"))
                    .set(WATCHLIST_VIEWERS.POSITION, viewerPosition)
                    .set(WATCHLIST_VIEWERS.PUSH, row.path("push").asBoolean(true))
                    .set(WATCHLIST_VIEWERS.PUSH_SINCE, instant(row, "pushSince"))
                    .set(WATCHLIST_VIEWERS.CHANNELS, JSONB.valueOf(jsonObject(row, "channels")))
                    .set(WATCHLIST_VIEWERS.CONFIRMED_FILTER, nullableString(row, "confirmedFilter"))
                    .execute();
            viewerPositions.put(userId, Math.max(viewerPosition + 1,
                    viewerPositions.getOrDefault(userId, 0)));
        }
        for (JsonNode row : collections.path("watchlistEntries")) {
            target.insertInto(WATCHLIST_ENTRIES)
                    .set(WATCHLIST_ENTRIES.USER_ID, string(row, "userId"))
                    .set(WATCHLIST_ENTRIES.WATCHLIST_ID, string(row, "watchlistId"))
                    .set(WATCHLIST_ENTRIES.RECORD_ID, string(row, "recordId"))
                    .set(WATCHLIST_ENTRIES.ENTERED_AT, instant(row, "enteredAt"))
                    .set(WATCHLIST_ENTRIES.BASELINE, row.path("baseline").asBoolean())
                    .set(WATCHLIST_ENTRIES.FILTER_VERSION, row.path("filterVersion").asInt(1))
                    .set(WATCHLIST_ENTRIES.DELIVERED_AT, JSONB.valueOf(jsonObject(row, "deliveredAt")))
                    .set(WATCHLIST_ENTRIES.PUSH_DELIVERED_AT, instant(row, "pushDeliveredAt"))
                    .execute();
        }
        for (JsonNode baseline : collections.path("watchlistBaselines")) {
            target.insertInto(WATCHLIST_BASELINES).set(WATCHLIST_BASELINES.ID, baseline.asString()).execute();
        }
    }

    // ENT-run; PLG-run-items.
    private void tasks(DSLContext target, JsonNode seed, JsonNode collections) {
        Instant seedAt = Instant.parse(string(seed, "now"));
        for (JsonNode run : collections.path("runs")) {
            JsonNode ending = run.path("ending");
            boolean running = ending.isNull();
            int done = nullableInteger(run, "doneCount") == null
                    ? running ? (int) Math.max(0, Math.min(run.path("itemCount").asInt(),
                            Duration.between(Instant.parse(string(run, "startedAt")), seedAt).toMillis()
                                    * run.path("itemsPerMinute").asDouble() / 60_000.0))
                            : ending.path("doneCount").asInt()
                    : run.path("doneCount").asInt();
            String state = running ? "Running" : string(ending, "state");
            if (state.equals("Done") && !run.path("errors").isEmpty()) {
                state = "DoneWithErrors";
            }
            target.insertInto(RUNS)
                    .set(RUNS.ID, string(run, "id"))
                    .set(RUNS.WHAT, string(run, "what"))
                    .set(RUNS.INSTANCE_ID, nullableString(run, "instanceId"))
                    .set(RUNS.CORE_NAME, nullableString(run, "coreName"))
                    .set(RUNS.TRIGGER, JSONB.valueOf(run.path("trigger").toString()))
                    .set(RUNS.STARTED_BY, nullableString(run, "startedBy"))
                    .set(RUNS.STATE, state)
                    .set(RUNS.STARTED_AT, instant(run, "startedAt"))
                    .set(RUNS.FINISHED_AT, running ? null : instant(ending, "finishedAt"))
                    .set(RUNS.ITEM_COUNT, run.path("itemCount").asInt())
                    .set(RUNS.DONE_COUNT, done)
                    .set(RUNS.ITEMS_PER_MINUTE, running ? run.path("itemsPerMinute").asDouble() : null)
                    .set(RUNS.CHANGES, JSONB.valueOf(run.path("changes").toString()))
                    .set(RUNS.FAILURE, nullableString(run, "failure"))
                    .set(RUNS.NOTE, nullableString(run, "note"))
                    .set(RUNS.CANCELLED_BY, nullableString(run, "cancelledBy"))
                    .set(RUNS.RERUN_OF, nullableString(run, "rerunOf"))
                    .execute();
            seedRunDetails(target, run, collections.path("iterations"), done, state, seedAt);
        }
        int schedulePosition = 0;
        for (JsonNode schedule : collections.path("schedules")) {
            JsonNode pause = schedule.path("pause");
            Map<String, Object> cadence = scheduleQueue.cadence(schedule.path("cadence").toString());
            Instant nextAt = pause.isNull() ? scheduleQueue.next(cadence, seedAt) : null;
            target.insertInto(SCHEDULES)
                    .set(SCHEDULES.ID, string(schedule, "id"))
                    .set(SCHEDULES.INSTANCE_ID, string(schedule, "instanceId"))
                    .set(SCHEDULES.NAME, string(schedule, "name"))
                    .set(SCHEDULES.CADENCE, JSONB.valueOf(schedule.path("cadence").toString()))
                    .set(SCHEDULES.OVERLAP, string(schedule, "overlap"))
                    .set(SCHEDULES.PAUSED_BY, nullableString(pause, "pausedBy"))
                    .set(SCHEDULES.PAUSED_AT, instant(pause, "pausedAt"))
                    .set(SCHEDULES.PAUSE_REASON, nullableString(pause, "reason"))
                    .set(SCHEDULES.CREATED_BY, string(schedule, "createdBy"))
                    .set(SCHEDULES.SINCE, LocalDate.parse(string(schedule, "since")))
                    .set(SCHEDULES.NEXT_AT, nextAt == null ? null : nextAt.atOffset(ZoneOffset.UTC))
                    .set(SCHEDULES.POSITION, schedulePosition++)
                    .execute();
        }
        JsonNode retention = collections.path("taskRetention");
        if (!retention.isMissingNode()) {
            target.insertInto(TASK_RETENTION)
                    .set(TASK_RETENTION.ID, 1)
                    .set(TASK_RETENTION.DAYS, retention.path("days").asInt())
                    .set(TASK_RETENTION.FAILED_DAYS, retention.path("failedDays").asInt())
                    .execute();
        }
    }

    private void seedRunDetails(DSLContext target, JsonNode run, JsonNode seededIterations,
            int done, String state, Instant seedAt) {
        List<JsonNode> visibleErrors = new ArrayList<>();
        run.path("errors").forEach(error -> {
            if ((!state.equals("Running") && !state.equals("Cancelled"))
                    || error.path("atItem").asInt() < done) {
                visibleErrors.add(error);
            }
        });
        int position = 0;
        for (JsonNode error : visibleErrors) {
            String iterationId = string(error, "iterationId");
            target.insertInto(RUN_ERRORS)
                    .set(RUN_ERRORS.RUN_ID, string(run, "id"))
                    .set(RUN_ERRORS.ITERATION_ID, iterationId)
                    .set(RUN_ERRORS.MESSAGE, string(error, "message"))
                    .set(RUN_ERRORS.AT_ITEM, error.path("atItem").asInt())
                    .set(RUN_ERRORS.POSITION, position++)
                    .execute();
            insertRunItem(target, string(run, "id"), iterationId, string(error, "message"), position++);
        }
        int remaining = Math.max(0, Math.min(6, done - visibleErrors.size()));
        Set<String> excluded = visibleErrors.stream().map(error -> string(error, "iterationId"))
                .collect(Collectors.toSet());
        int added = 0;
        for (JsonNode iteration : seededIterations) {
            String iterationId = string(iteration, "id");
            if (!excluded.contains(iterationId) && added < remaining) {
                insertRunItem(target, string(run, "id"), iterationId, null, position++);
                added++;
            }
        }
        if (added != remaining) {
            throw new IllegalStateException("Seeded run item list is incomplete for " + string(run, "id"));
        }
        Instant started = Instant.parse(string(run, "startedAt"));
        Instant ended = run.path("ending").isNull() ? seedAt
                : Instant.parse(string(run.path("ending"), "finishedAt"));
        int logPosition = 0;
        log(target, string(run, "id"), started, string(run, "id") + " started — "
                + string(run, "what") + " (" + triggerWords(target, run) + ")", false, logPosition++);
        if (state.equals("Skipped")) {
            log(target, string(run, "id"), started, "skipped — " + nullableString(run, "note"),
                    false, logPosition);
            return;
        }
        int finalDone = done;
        for (JsonNode error : visibleErrors) {
            Instant at = started.plusMillis(Duration.between(started, ended).toMillis()
                    * error.path("atItem").asInt() / Math.max(1, finalDone));
            log(target, string(run, "id"), at, string(error, "iterationId") + " "
                    + string(error, "message"), true, logPosition++);
        }
    }

    private void insertRunItem(DSLContext target, String runId, String iterationId, String error,
            int position) {
        target.insertInto(RUN_ITEMS)
                .set(RUN_ITEMS.RUN_ID, runId)
                .set(RUN_ITEMS.ITERATION_ID, iterationId)
                .set(RUN_ITEMS.ERROR, error)
                .set(RUN_ITEMS.POSITION, position)
                .execute();
    }

    private void log(DSLContext target, String runId, Instant at, String text, boolean isError,
            int position) {
        target.insertInto(RUN_LOG)
                .set(RUN_LOG.RUN_ID, runId)
                .set(RUN_LOG.AT, at.atOffset(ZoneOffset.UTC))
                .set(RUN_LOG.TEXT, text)
                .set(RUN_LOG.IS_ERROR, isError)
                .set(RUN_LOG.POSITION, position)
                .execute();
    }

    private String triggerWords(DSLContext target, JsonNode run) {
        JsonNode trigger = run.path("trigger");
        return switch (string(trigger, "kind")) {
            case "schedule" -> "schedule " + string(trigger, "scheduleId");
            case "repeat" -> "intention repeat " + string(trigger, "templateId");
            case "approval" -> "on approval by " + nameOf(target, nullableString(run, "startedBy"));
            default -> "by " + nameOf(target, nullableString(run, "startedBy")) + ", from "
                    + string(trigger.path("from"), "label");
        };
    }

    private String nameOf(DSLContext target, String userId) {
        if (userId == null) {
            return "VERA";
        }
        String name = target.select(USERS.NAME).from(USERS).where(USERS.ID.eq(userId))
                .fetchOne(USERS.NAME);
        return name == null ? userId : name;
    }

    private String string(JsonNode object, String field) {
        return object.path(field).asString();
    }

    private String namesJson(JsonNode object) {
        JsonNode names = object.get("names");
        return names == null || names.isNull()
                ? json.valueToTree(Map.of("en", string(object, "name"))).toString()
                : names.toString();
    }

    private String nullableString(JsonNode object, String field) {
        JsonNode value = object.get(field);
        return value == null || value.isNull() ? null : value.asString();
    }

    private Integer nullableInteger(JsonNode object, String field) {
        JsonNode value = object.get(field);
        return value == null || value.isNull() ? null : value.asInt();
    }

    private OffsetDateTime instant(JsonNode object, String field) {
        String value = nullableString(object, field);
        if (value == null) {
            return null;
        }
        Instant parsed = value.length() == 10
                ? LocalDate.parse(value).atStartOfDay(ZoneOffset.UTC).toInstant()
                : Instant.parse(value);
        return parsed.atOffset(ZoneOffset.UTC);
    }

    private JSONB nullableJson(JsonNode object, String field) {
        JsonNode value = object.get(field);
        return value == null || value.isNull() ? null : JSONB.valueOf(value.toString());
    }

    private String jsonObject(JsonNode object, String field) {
        JsonNode value = object.get(field);
        return value == null || value.isNull() ? "{}" : value.toString();
    }
}
