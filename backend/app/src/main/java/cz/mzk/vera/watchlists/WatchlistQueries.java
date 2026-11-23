package cz.mzk.vera.watchlists;

import static cz.mzk.vera.db.tables.Tables.GROUP_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.ROLE_GRANTS;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_MAPPED_ROLES;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_BASELINES;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_ENTRIES;
import static cz.mzk.vera.db.tables.Tables.WATCHLISTS;
import static cz.mzk.vera.db.tables.Tables.WATCHLIST_VIEWERS;
import static cz.mzk.vera.db.tables.Tables.USERS;

import cz.mzk.vera.categories.CategoryFilters;
import cz.mzk.vera.categories.CategoryReads;
import cz.mzk.vera.db.tables.tables.records.UsersRecord;
import cz.mzk.vera.db.tables.tables.records.WatchlistViewersRecord;
import cz.mzk.vera.db.tables.tables.records.WatchlistsRecord;
import cz.mzk.vera.documents.Audience;
import cz.mzk.vera.documents.DocumentQueries;
import cz.mzk.vera.intentions.IntentionFilters;
import cz.mzk.vera.intentions.IntentionReads;
import cz.mzk.vera.lists.ListsQueries;
import cz.mzk.vera.mixes.MixFilters;
import cz.mzk.vera.mixes.MixQueries;
import cz.mzk.vera.projects.ProjectReads;
import cz.mzk.vera.requests.RequestQueries;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import cz.mzk.vera.tasks.TasksQueries;
import cz.mzk.vera.validations.ValidationQueries;
import cz.mzk.vera.web.Instants;
import cz.mzk.vera.web.RequestLanguage;
import cz.mzk.vera.domain.Names;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// WATCH-audience; WATCH-no-duplicates; WATCH-new: reads and persists the caller's watchlists.
@Repository
public class WatchlistQueries {
    private int materializedViewerCount = -1;
    private final DSLContext dsl;
    private final HeldAccessQueries held;
    private final ObjectMapper mapper;
    private final DocumentQueries documents;
    private final RequestQueries requests;
    private final ValidationQueries validations;
    private final ListsQueries lists;
    private final TasksQueries tasks;
    private final CategoryReads categories;
    private final ProjectReads projects;
    private final MixQueries mixes;
    private final IntentionReads intentions;

    public WatchlistQueries(DSLContext dsl, HeldAccessQueries held, ObjectMapper mapper,
            DocumentQueries documents, RequestQueries requests, ValidationQueries validations,
            ListsQueries lists, TasksQueries tasks,
            CategoryReads categories, ProjectReads projects, MixQueries mixes,
            IntentionReads intentions) {
        this.dsl = dsl;
        this.held = held;
        this.mapper = mapper;
        this.documents = documents;
        this.requests = requests;
        this.validations = validations;
        this.lists = lists;
        this.tasks = tasks;
        this.categories = categories;
        this.projects = projects;
        this.mixes = mixes;
        this.intentions = intentions;
    }

    public List<Map<String, Object>> list(String userId, String view, boolean manageSystem) {
        return list(userId, view, manageSystem, true);
    }

    public List<Map<String, Object>> list(String userId, String view, boolean manageSystem,
            boolean materializeViewers) {
        HeldScopes access = held.scopesHeldBy(userId);
        boolean manager = access.hasPermission("watchlist.manage_system");
        if (manageSystem && !manager) {
            return null;
        }
        List<WatchlistsRecord> visibleRows = visibleRows(userId, view, manageSystem, access, manager);
        if (materializeViewers) {
            materializeViewerRows(userId, visibleRows);
        }
        SummaryDetails details = summaryDetails(userId, visibleRows);
        Map<String, Integer> documentCounts = documentCounts(userId, visibleRows);
        List<Map<String, Object>> result = new ArrayList<>();
        for (WatchlistsRecord row : visibleRows) {
            result.add(summary(userId, row, read(row.getAudience().data()), manager, details,
                    documentCounts));
        }
        result.sort((first, second) -> Integer.compare(
                ((Number) first.get("viewerPosition")).intValue(),
                ((Number) second.get("viewerPosition")).intValue()));
        result.forEach(row -> row.remove("viewerPosition"));
        return result;
    }

    // WATCH-new: the watchlists a person may open, with only their stored fields; matching needs no counts.
    public List<Map<String, Object>> openable(String userId) {
        HeldScopes access = held.scopesHeldBy(userId);
        boolean manager = access.hasPermission("watchlist.manage_system");
        List<Map<String, Object>> result = new ArrayList<>();
        for (WatchlistsRecord row : visibleRows(userId, null, false, access, manager)) {
            Map<String, Object> watchlist = stored(row);
            watchlist.put("filterVersion", row.getFilterVersion());
            result.add(watchlist);
        }
        return result;
    }

    private List<WatchlistsRecord> visibleRows(String userId, String view, boolean manageSystem,
            HeldScopes access, boolean manager) {
        Set<String> groupIds = new HashSet<>(access.groupIds());
        Set<String> roleIds = rolesByUser(List.of(dsl.selectFrom(USERS)
                .where(USERS.ID.eq(userId)).fetchOne())).getOrDefault(userId, Set.of());
        Map<String, Boolean> canOpen = new HashMap<>();
        List<WatchlistsRecord> rows = dsl.selectFrom(WATCHLISTS).orderBy(WATCHLISTS.POSITION).fetch();
        List<WatchlistsRecord> visibleRows = new ArrayList<>();
        for (WatchlistsRecord row : rows) {
            if (view != null && !view.equals(row.getView())) {
                continue;
            }
            JsonNode audience = read(row.getAudience().data());
            boolean personal = "personal".equals(audience.path("kind").asString());
            JsonNode filter = read(row.getFilter().data());
            String viewKey = row.getView() + ("categories".equals(row.getView())
                    && (filter.has("attention") || filter.has("mix")) ? ":restricted" : "");
            boolean open = canOpen.computeIfAbsent(viewKey,
                    ignored -> canOpen(userId, row.getView(), filter, access));
            if (manageSystem ? personal : !visible(userId, row.getOwnerId(), audience, manager,
                    open, groupIds, roleIds)) {
                continue;
            }
            visibleRows.add(row);
        }
        return visibleRows;
    }

    public synchronized void materializeViewersForVisibleWatchlists() {
        int viewerCount = dsl.fetchCount(WATCHLIST_VIEWERS);
        if (materializedViewerCount > 0 && viewerCount >= materializedViewerCount) {
            return;
        }
        List<WatchlistsRecord> rows = dsl.selectFrom(WATCHLISTS).orderBy(WATCHLISTS.POSITION).fetch();
        List<UsersRecord> users = dsl.selectFrom(USERS).orderBy(USERS.POSITION).fetch();
        List<WatchlistViewersRecord> existing = dsl.selectFrom(WATCHLIST_VIEWERS).fetch();
        Map<String, Set<String>> roles = rolesByUser(users);
        Map<String, Set<String>> permissions = permissionsByUser(users, roles);
        Map<String, Set<String>> groups = groupsByUser(users);
        Map<String, Set<String>> existingIds = new HashMap<>();
        Map<String, Integer> positions = new HashMap<>();
        for (WatchlistViewersRecord row : existing) {
            existingIds.computeIfAbsent(row.getUserId(), ignored -> new HashSet<>())
                    .add(row.getWatchlistId());
            positions.merge(row.getUserId(), 1, Integer::sum);
        }
        List<WatchlistViewersRecord> additions = new ArrayList<>();
        for (UsersRecord user : users) {
            String userId = user.getId();
            List<WatchlistsRecord> visibleRows = visibleRows(user, rows,
                    permissions.getOrDefault(userId, Set.of()),
                    groups.getOrDefault(userId, Set.of()), roles.getOrDefault(userId, Set.of()));
            appendMissingViewers(userId, visibleRows, existingIds, positions, additions);
        }
        if (!additions.isEmpty()) {
            dsl.batchInsert(additions).execute();
        }
        materializedViewerCount = viewerCount + additions.size();
    }

    private void materializeViewerRows(String userId, List<WatchlistsRecord> rows) {
        List<String> ids = rows.stream().map(WatchlistsRecord::getId).toList();
        Map<String, WatchlistViewersRecord> existing = dsl.selectFrom(WATCHLIST_VIEWERS)
                .where(WATCHLIST_VIEWERS.USER_ID.eq(userId))
                .fetchMap(WATCHLIST_VIEWERS.WATCHLIST_ID);
        int position = existing.size();
        List<WatchlistViewersRecord> additions = new ArrayList<>();
        for (String id : ids) {
            if (!existing.containsKey(id)) {
                WatchlistViewersRecord viewer = dsl.newRecord(WATCHLIST_VIEWERS);
                viewer.setUserId(userId);
                viewer.setWatchlistId(id);
                viewer.setPosition(position++);
                viewer.setPush(true);
                viewer.setChannels(JSONB.valueOf("{}"));
                additions.add(viewer);
            }
        }
        if (!additions.isEmpty()) {
            dsl.batchInsert(additions).execute();
        }
    }

    private List<WatchlistsRecord> visibleRows(UsersRecord user, List<WatchlistsRecord> rows,
            Set<String> permissions, Set<String> groupIds, Set<String> roleIds) {
        String userId = user.getId();
        boolean manager = permissions.contains("watchlist.manage_system");
        List<WatchlistsRecord> result = new ArrayList<>();
        for (WatchlistsRecord row : rows) {
            JsonNode audience = read(row.getAudience().data());
            JsonNode filter = read(row.getFilter().data());
            boolean open = canOpen(row.getView(), filter, permissions);
            String kind = audience.path("kind").asString();
            boolean audienceVisible = "personal".equals(kind) ? row.getOwnerId().equals(userId)
                    : manager || "everyone".equals(kind)
                    || audience.path("groupIds").isArray()
                            && audience.path("groupIds").valueStream()
                                    .anyMatch(group -> groupIds.contains(group.asString()))
                    || audience.path("roleIds").isArray()
                            && audience.path("roleIds").valueStream()
                                    .anyMatch(role -> roleIds.contains(role.asString()));
            if (open && audienceVisible) {
                result.add(row);
            }
        }
        return result;
    }

    private Map<String, Set<String>> permissionsByUser(List<UsersRecord> users,
            Map<String, Set<String>> rolesByUser) {
        Set<String> suspended = users.stream().filter(user -> user.getSuspendedAt() != null)
                .map(UsersRecord::getId).collect(java.util.stream.Collectors.toSet());
        Map<String, Set<String>> permissionsByRole = new HashMap<>();
        dsl.select(ROLE_GRANTS.ROLE_ID, ROLE_GRANTS.PERMISSION).from(ROLE_GRANTS).fetch()
                .forEach(row -> permissionsByRole.computeIfAbsent(row.get(ROLE_GRANTS.ROLE_ID),
                        ignored -> new HashSet<>()).add(row.get(ROLE_GRANTS.PERMISSION)));
        Map<String, Set<String>> result = new HashMap<>();
        rolesByUser.forEach((userId, roleIds) -> {
            if (!suspended.contains(userId)) {
                Set<String> heldPermissions = result.computeIfAbsent(userId, ignored -> new HashSet<>());
                roleIds.forEach(roleId -> heldPermissions.addAll(
                        permissionsByRole.getOrDefault(roleId, Set.of())));
            }
        });
        return result;
    }

    private Map<String, Set<String>> groupsByUser(List<UsersRecord> users) {
        Set<String> userIds = users.stream().map(UsersRecord::getId).collect(Collectors.toSet());
        Map<String, Set<String>> result = new HashMap<>();
        dsl.select(GROUP_MEMBERS.USER_ID, GROUP_MEMBERS.GROUP_ID).from(GROUP_MEMBERS).fetch()
                .forEach(row -> {
                    String userId = row.get(GROUP_MEMBERS.USER_ID);
                    if (userIds.contains(userId)) {
                        result.computeIfAbsent(userId, ignored -> new HashSet<>())
                                .add(row.get(GROUP_MEMBERS.GROUP_ID));
                    }
                });
        return result;
    }

    private Map<String, Set<String>> rolesByUser(List<UsersRecord> users) {
        Set<String> userIds = users.stream().map(UsersRecord::getId).collect(Collectors.toSet());
        Map<String, Set<String>> result = new HashMap<>();
        dsl.select(USER_HAND_ROLES.USER_ID, USER_HAND_ROLES.ROLE_ID).from(USER_HAND_ROLES).fetch()
                .forEach(row -> {
                    String userId = row.get(USER_HAND_ROLES.USER_ID);
                    if (userIds.contains(userId)) {
                        result.computeIfAbsent(userId, ignored -> new HashSet<>())
                                .add(row.get(USER_HAND_ROLES.ROLE_ID));
                    }
                });
        dsl.select(USER_MAPPED_ROLES.USER_ID, USER_MAPPED_ROLES.ROLE_ID).from(USER_MAPPED_ROLES).fetch()
                .forEach(row -> {
                    String userId = row.get(USER_MAPPED_ROLES.USER_ID);
                    if (userIds.contains(userId)) {
                        result.computeIfAbsent(userId, ignored -> new HashSet<>())
                                .add(row.get(USER_MAPPED_ROLES.ROLE_ID));
                    }
                });
        return result;
    }

    private boolean canOpen(String view, JsonNode filter, Set<String> permissions) {
        boolean open = switch (view) {
            case "documents" -> permissions.contains("iteration.read");
            case "my-documents" -> permissions.contains("request.read_mine");
            case "requests" -> permissions.contains("request.read");
            case "validations" -> permissions.contains("validation.approve")
                    || permissions.contains("validation.deny") || permissions.contains("validation.revoke");
            case "lists" -> permissions.contains("list.read");
            case "projects" -> permissions.contains("project.read");
            case "categories" -> permissions.contains("category.read");
            case "mixes" -> permissions.contains("mix.read");
            case "intentions" -> permissions.contains("intention.read");
            case "tasks" -> permissions.contains("task.read") || permissions.contains("task.read_own");
            default -> false;
        };
        return open && (!"categories".equals(view) || !filter.has("attention") && !filter.has("mix")
                || permissions.contains("intention.read"));
    }

    private void appendMissingViewers(String userId, List<WatchlistsRecord> visibleRows,
            Map<String, Set<String>> existingIds, Map<String, Integer> positions,
            List<WatchlistViewersRecord> additions) {
        Set<String> existing = existingIds.getOrDefault(userId, Set.of());
        int position = positions.getOrDefault(userId, 0);
        for (WatchlistsRecord watchlist : visibleRows) {
            if (!existing.contains(watchlist.getId())) {
                WatchlistViewersRecord viewer = dsl.newRecord(WATCHLIST_VIEWERS);
                viewer.setUserId(userId);
                viewer.setWatchlistId(watchlist.getId());
                viewer.setPosition(position++);
                viewer.setPush(true);
                viewer.setChannels(JSONB.valueOf("{}"));
                additions.add(viewer);
            }
        }
    }

    public Map<String, Object> find(String userId, String id, boolean mustChange) {
        WatchlistsRecord row = dsl.selectFrom(WATCHLISTS).where(WATCHLISTS.ID.eq(id)).fetchOne();
        if (row == null) {
            return null;
        }
        JsonNode audience = read(row.getAudience().data());
        boolean manager = held.scopesHeldBy(userId).hasPermission("watchlist.manage_system");
        boolean personal = "personal".equals(audience.path("kind").asString());
        boolean editable = personal ? row.getOwnerId().equals(userId) : manager;
        if (mustChange ? !editable : !visible(userId, row.getOwnerId(), row.getView(), audience,
                read(row.getFilter().data()), manager)) {
            return null;
        }
        Map<String, Object> result = stored(row);
        result.put("filterVersion", row.getFilterVersion());
        return result;
    }

    public Map<String, Object> viewer(String userId, String watchlistId) {
        return viewer(userId, watchlistId, true);
    }

    private Map<String, Object> viewer(String userId, String watchlistId, boolean materialize) {
        WatchlistViewersRecord row = dsl.selectFrom(WATCHLIST_VIEWERS).where(WATCHLIST_VIEWERS.USER_ID.eq(userId))
                .and(WATCHLIST_VIEWERS.WATCHLIST_ID.eq(watchlistId)).fetchOne();
        if (row == null) {
            int position = dsl.fetchCount(WATCHLIST_VIEWERS, WATCHLIST_VIEWERS.USER_ID.eq(userId));
            if (!materialize) {
                return defaultViewer(position);
            }
            dsl.insertInto(WATCHLIST_VIEWERS)
                    .set(WATCHLIST_VIEWERS.USER_ID, userId)
                    .set(WATCHLIST_VIEWERS.WATCHLIST_ID, watchlistId)
                    .set(WATCHLIST_VIEWERS.POSITION, position)
                    .onConflict(WATCHLIST_VIEWERS.USER_ID, WATCHLIST_VIEWERS.WATCHLIST_ID).doNothing()
                    .execute();
            row = dsl.selectFrom(WATCHLIST_VIEWERS).where(WATCHLIST_VIEWERS.USER_ID.eq(userId))
                    .and(WATCHLIST_VIEWERS.WATCHLIST_ID.eq(watchlistId)).fetchOne();
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("seenAt", format(row.getSeenAt()));
        result.put("position", row.getPosition());
        result.put("push", row.getPush());
        result.put("pushSince", format(row.getPushSince()));
        result.put("channels", read(row.getChannels().data()));
        result.put("confirmedFilter", row.getConfirmedFilter());
        return result;
    }

    private Map<String, Object> defaultViewer(int position) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("seenAt", null);
        result.put("position", position);
        result.put("push", true);
        result.put("pushSince", null);
        result.put("channels", Map.of());
        result.put("confirmedFilter", null);
        return result;
    }

    public void saveViewer(String userId, String watchlistId, Map<String, Object> viewer) {
        OffsetDateTime seenAt = parse((String) viewer.get("seenAt"));
        OffsetDateTime pushSince = parse((String) viewer.get("pushSince"));
        WatchlistViewersRecord existing = dsl.selectFrom(WATCHLIST_VIEWERS).where(WATCHLIST_VIEWERS.USER_ID.eq(userId))
                .and(WATCHLIST_VIEWERS.WATCHLIST_ID.eq(watchlistId)).fetchOne();
        if (existing == null) {
            dsl.insertInto(WATCHLIST_VIEWERS).set(WATCHLIST_VIEWERS.USER_ID, userId)
                    .set(WATCHLIST_VIEWERS.WATCHLIST_ID, watchlistId)
                    .set(WATCHLIST_VIEWERS.SEEN_AT, seenAt)
                    .set(WATCHLIST_VIEWERS.POSITION, ((Number) viewer.get("position")).intValue())
                    .set(WATCHLIST_VIEWERS.PUSH, (Boolean) viewer.get("push"))
                    .set(WATCHLIST_VIEWERS.PUSH_SINCE, pushSince)
                    .set(WATCHLIST_VIEWERS.CHANNELS, JSONB.valueOf(mapper.valueToTree(viewer.get("channels")).toString()))
                    .set(WATCHLIST_VIEWERS.CONFIRMED_FILTER, (String) viewer.get("confirmedFilter")).execute();
        } else {
            dsl.update(WATCHLIST_VIEWERS).set(WATCHLIST_VIEWERS.SEEN_AT, seenAt)
                    .set(WATCHLIST_VIEWERS.POSITION, ((Number) viewer.get("position")).intValue())
                    .set(WATCHLIST_VIEWERS.PUSH, (Boolean) viewer.get("push"))
                    .set(WATCHLIST_VIEWERS.PUSH_SINCE, pushSince)
                    .set(WATCHLIST_VIEWERS.CHANNELS, JSONB.valueOf(mapper.valueToTree(viewer.get("channels")).toString()))
                    .set(WATCHLIST_VIEWERS.CONFIRMED_FILTER, (String) viewer.get("confirmedFilter"))
                    .where(WATCHLIST_VIEWERS.USER_ID.eq(userId))
                    .and(WATCHLIST_VIEWERS.WATCHLIST_ID.eq(watchlistId)).execute();
        }
    }

    private Map<String, Object> summary(String userId, WatchlistsRecord row, JsonNode audience,
            boolean manager, SummaryDetails details, Map<String, Integer> documentCounts) {
        Map<String, Object> result = stored(row);
        String id = (String) result.get("id");
        Integer documentCount = documentCounts.get(id);
        int count = documentCount == null ? itemCount(userId, row.getView(), read(row.getFilter().data()))
                : documentCount;
        Map<String, Object> viewer = details.viewers().get(id);
        int unseen = details.unseenCounts().getOrDefault(id, 0);
        int subscribers = details.subscriberCounts().getOrDefault(id, 0);
        result.put("itemCount", count);
        result.put("newCount", unseen);
        result.put("createdBy", row.get(WATCHLISTS.OWNER_ID));
        result.put("subscriberCount", subscribers);
        result.put("filterVersion", row.get(WATCHLISTS.FILTER_VERSION));
        result.put("isEditable", "personal".equals(audience.path("kind").asString())
                ? row.get(WATCHLISTS.OWNER_ID).equals(userId) : manager);
        result.put("viewer", viewer);
        result.put("viewerPosition", viewer.get("position"));
        return result;
    }

    private Map<String, Integer> documentCounts(String userId, List<WatchlistsRecord> rows) {
        Map<String, Integer> result = new HashMap<>();
        for (boolean mine : List.of(false, true)) {
            List<WatchlistsRecord> matching = rows.stream()
                    .filter(row -> ("my-documents".equals(row.getView())) == mine)
                    .filter(row -> mine || "documents".equals(row.getView())).toList();
            if (!matching.isEmpty()) {
                List<Map<String, String>> filters = matching.stream()
                        .map(row -> filterParameters(read(row.getFilter().data()))).toList();
                List<Integer> counts = documents.counts(filters, userId, mine);
                for (int index = 0; index < matching.size(); index++) {
                    result.put(matching.get(index).getId(), counts.get(index));
                }
            }
        }
        return result;
    }

    private SummaryDetails summaryDetails(String userId, List<WatchlistsRecord> rows) {
        List<String> ids = rows.stream().map(WatchlistsRecord::getId).toList();
        if (ids.isEmpty()) {
            return new SummaryDetails(Map.of(), Map.of(), Map.of());
        }
        List<WatchlistViewersRecord> viewerRows = dsl.selectFrom(WATCHLIST_VIEWERS)
                .where(WATCHLIST_VIEWERS.WATCHLIST_ID.in(ids)).fetch();
        Map<String, Map<String, Object>> viewers = new HashMap<>();
        Map<String, Integer> subscriberCounts = new HashMap<>();
        int defaultPosition = (int) viewerRows.stream().filter(row -> row.getUserId().equals(userId)).count();
        for (WatchlistViewersRecord viewerRow : viewerRows) {
            String id = viewerRow.getWatchlistId();
            if (viewerRow.getUserId().equals(userId)) {
                viewers.put(id, viewerSettings(viewerRow));
            }
            if (read(viewerRow.getChannels().data()).properties().stream()
                    .anyMatch(entry -> entry.getValue().path("isOn").asBoolean())) {
                subscriberCounts.merge(id, 1, Integer::sum);
            }
        }
        for (String id : ids) {
            if (!viewers.containsKey(id)) {
                viewers.put(id, defaultViewer(defaultPosition++));
            }
        }

        Map<String, String> baselineByWatchlist = new HashMap<>();
        for (WatchlistsRecord row : rows) {
            baselineByWatchlist.put(row.getId(), userId + ":" + row.getId() + ":" + row.getFilterVersion());
        }
        Set<String> baselineIds = new HashSet<>(baselineByWatchlist.values());
        Set<String> existingBaselines = new HashSet<>(dsl.select(WATCHLIST_BASELINES.ID)
                .from(WATCHLIST_BASELINES).where(WATCHLIST_BASELINES.ID.in(baselineIds))
                .fetch(WATCHLIST_BASELINES.ID));
        Map<String, OffsetDateTime> seenAtByWatchlist = new HashMap<>();
        viewerRows.stream().filter(row -> row.getUserId().equals(userId))
                .forEach(row -> seenAtByWatchlist.put(row.getWatchlistId(), row.getSeenAt()));
        Map<String, Integer> unseenCounts = new HashMap<>();
        dsl.select(WATCHLIST_ENTRIES.WATCHLIST_ID, WATCHLIST_ENTRIES.ENTERED_AT)
                .from(WATCHLIST_ENTRIES).where(WATCHLIST_ENTRIES.USER_ID.eq(userId))
                .and(WATCHLIST_ENTRIES.WATCHLIST_ID.in(ids)).and(WATCHLIST_ENTRIES.BASELINE.isFalse())
                .fetch().forEach(entry -> {
                    String id = entry.get(WATCHLIST_ENTRIES.WATCHLIST_ID);
                    OffsetDateTime seenAt = seenAtByWatchlist.get(id);
                    boolean unseen = seenAt == null
                            || entry.get(WATCHLIST_ENTRIES.ENTERED_AT).isAfter(seenAt);
                    if (unseen && existingBaselines.contains(baselineByWatchlist.get(id))) {
                        unseenCounts.merge(id, 1, Integer::sum);
                    }
                });
        return new SummaryDetails(viewers, unseenCounts, subscriberCounts);
    }

    private Map<String, Object> viewerSettings(WatchlistViewersRecord row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("seenAt", format(row.getSeenAt()));
        result.put("position", row.getPosition());
        result.put("push", row.getPush());
        result.put("pushSince", format(row.getPushSince()));
        result.put("channels", read(row.getChannels().data()));
        result.put("confirmedFilter", row.getConfirmedFilter());
        return result;
    }

    private record SummaryDetails(Map<String, Map<String, Object>> viewers,
            Map<String, Integer> unseenCounts, Map<String, Integer> subscriberCounts) {}

    // WATCH-model: every record that matches now, as opening the watchlist shows them.
    private int itemCount(String userId, String view, JsonNode filter) {
        Map<String, String> parameters = filterParameters(filter);
        Map<String, Object> page = switch (view) {
            case "documents" -> Map.of("total", documents.count(parameters, userId, false));
            case "my-documents" -> Map.of("total", documents.count(parameters, userId, true));
            default -> page(view, parameters, userId);
        };
        if (page.get("total") instanceof Number total) {
            return total.intValue();
        }
        return ((List<?>) page.get("items")).size();
    }

    private Map<String, String> filterParameters(JsonNode filter) {
        Map<String, String> parameters = new LinkedHashMap<>();
        filter.properties().forEach(entry -> parameters.put(entry.getKey(), entry.getValue().asString()));
        return parameters;
    }

    public boolean matchesRecord(String view, JsonNode filter, String userId, String recordId) {
        return matchesRecord(view, filter, userId, recordId, recordId);
    }

    public boolean matchesRecord(String view, JsonNode filter, String userId, String recordId, String subjectId) {
        Map<String, String> parameters = filterParameters(filter);
        return switch (view) {
            case "documents" -> documents.matches(parameters, userId, false, recordId);
            case "my-documents" -> documents.matches(parameters, userId, true, recordId);
            case "requests" -> requests.matches(parameters, userId, subjectId);
            case "validations" -> validations.matches(parameters, userId, recordId);
            // These smaller views keep using their page query to match the full result.
            default -> {
                Map<String, Object> page = page(view, parameters, userId);
                yield ((List<?>) page.get("items")).stream()
                        .anyMatch(item -> hasRecord(view, item, recordId));
            }
        };
    }

    // HOOK-condition: evaluate page filters without applying a person's reach or access.
    public boolean matchesRecordForHook(String view, JsonNode filter, String recordId) {
        Map<String, String> parameters = filterParameters(filter);
        return switch (view) {
            case "documents" -> documents.matchesForHook(parameters, recordId);
            case "requests" -> requests.matchesForHook(parameters, recordId);
            case "lists" -> lists.matchesForHook(parameters, recordId);
            case "tasks" -> tasks.matchesForHook(parameters, recordId);
            default -> false;
        };
    }

    private Map<String, Object> page(String view, Map<String, String> parameters, String userId) {
        return switch (view) {
            case "documents" -> documents.page(parameters, userId, false);
            case "my-documents" -> documents.page(parameters, userId, true);
            case "requests" -> requests.page(parameters, userId);
            case "validations" -> validations.page(parameters, userId);
            case "lists" -> lists.index(parameters, userId);
            case "projects" -> Map.of("items", projects.overview(userId, parameters).get("rows"));
            case "categories" -> {
                Map<String, Object> index = categories.index(userId, parameters.get("mix"));
                Set<String> matching = CategoryFilters.matchingCategoryIds(categories.categories(), index,
                        parameters);
                yield Map.of("items", categoryNodes(index).stream().filter(node ->
                        matching.contains(((Map<?, ?>) node).get("categoryId"))).toList());
            }
            case "mixes" -> Map.of("items", MixFilters.matchingMixes(mixes.list(userId),
                    categories.categories(), parameters));
            case "intentions" -> {
                Map<String, Object> matching = IntentionFilters.matchingIntentions(
                        intentions.overview(userId), parameters);
                List<Object> items = new ArrayList<>((List<?>) matching.get("rows"));
                items.addAll((List<?>) matching.get("templates"));
                yield Map.of("items", items);
            }
            case "tasks" -> {
                Map<String, Object> result = tasks.index(userId, parameters);
                List<Object> items = new ArrayList<>((List<?>) result.get("running"));
                items.addAll((List<?>) result.get("finished"));
                yield Map.of("items", items);
            }
            default -> Map.of("items", List.of());
        };
    }

    private List<Object> categoryNodes(Map<String, Object> index) {
        List<Object> result = new ArrayList<>();
        Object nodes = index.get("nodes");
        if (nodes instanceof List<?> values) {
            for (Object value : values) {
                appendCategoryNode(value, result);
            }
        }
        return result;
    }

    private void appendCategoryNode(Object value, List<Object> result) {
        if (!(value instanceof Map<?, ?> node)) {
            return;
        }
        result.add(value);
        Object children = node.get("children");
        if (children instanceof List<?> values) {
            values.forEach(child -> appendCategoryNode(child, result));
        }
    }

    private boolean hasRecord(String view, Object item, String recordId) {
        if (!(item instanceof Map<?, ?> row)) {
            return false;
        }
        if ("lists".equals(view)) {
            Object listId = row.get("listId");
            if (listId == null && row.get("list") instanceof Map<?, ?> list) {
                listId = list.get("id");
            }
            return recordId.equals(listId);
        }
        if ("validations".equals(view)) {
            Object iteration = row.get("iteration");
            return iteration instanceof Map<?, ?> values && recordId.equals(values.get("id"));
        }
        if ("categories".equals(view)) {
            return recordId.equals(row.get("categoryId")) || recordId.equals(row.get("id"));
        }
        if ("projects".equals(view)) {
            Object project = row.get("project");
            return project instanceof Map<?, ?> values && recordId.equals(values.get("id"));
        }
        if ("intentions".equals(view)) {
            Object intention = row.containsKey("template") ? row.get("template") : row.get("intention");
            return intention instanceof Map<?, ?> values && recordId.equals(values.get("id"));
        }
        if (List.of("mixes", "tasks").contains(view)) {
            return recordId.equals(row.get("id")) || recordId.equals(row.get("runId"));
        }
        Object rowRecord = "requests".equals(view) ? row.get("record") : row.get("document");
        if (!(rowRecord instanceof Map<?, ?> record)) {
            return false;
        }
        Object document = record.get("document");
        if (document instanceof Map<?, ?> nested) {
            return recordId.equals(nested.get("id"));
        }
        return recordId.equals(record.get("id"));
    }

    private Map<String, Object> stored(WatchlistsRecord row) {
        Map<String, Object> result = new LinkedHashMap<>();
        JsonNode names = read(row.get(WATCHLISTS.NAMES).data());
        Map<String, String> nameValues = new LinkedHashMap<>();
        names.properties().forEach(property -> nameValues.put(property.getKey(), property.getValue().asString()));
        result.put("name", Names.nameIn(nameValues, RequestLanguage.current()));
        result.put("names", names);
        result.put("filter", mapper.convertValue(read(row.get(WATCHLISTS.FILTER).data()), Object.class));
        result.put("view", row.get(WATCHLISTS.VIEW));
        result.put("createdAt", format(row.get(WATCHLISTS.CREATED_AT)));
        result.put("id", row.get(WATCHLISTS.ID));
        result.put("audience", mapper.convertValue(read(row.get(WATCHLISTS.AUDIENCE).data()), Object.class));
        return result;
    }

    private boolean visible(String userId, String ownerId, String view, JsonNode audience,
            JsonNode filter, boolean manager) {
        if (!canOpen(userId, view, filter)) {
            return false;
        }
        String kind = audience.path("kind").asString();
        if ("personal".equals(kind)) {
            return ownerId.equals(userId);
        }
        if (manager) {
            return true;
        }
        if ("everyone".equals(kind)) {
            return true;
        }
        for (JsonNode group : audience.path("groupIds")) {
            if (dsl.fetchExists(dsl.selectOne().from(GROUP_MEMBERS)
                    .where(GROUP_MEMBERS.USER_ID.eq(userId)).and(GROUP_MEMBERS.GROUP_ID.eq(group.asString())))) {
                return true;
            }
        }
        List<String> roles = dsl.select(USER_HAND_ROLES.ROLE_ID).from(USER_HAND_ROLES)
                .where(USER_HAND_ROLES.USER_ID.eq(userId)).fetch(USER_HAND_ROLES.ROLE_ID);
        roles.addAll(dsl.select(USER_MAPPED_ROLES.ROLE_ID).from(USER_MAPPED_ROLES)
                .where(USER_MAPPED_ROLES.USER_ID.eq(userId)).fetch(USER_MAPPED_ROLES.ROLE_ID));
        for (JsonNode role : audience.path("roleIds")) {
            if (roles.contains(role.asString())) {
                return true;
            }
        }
        return false;
    }

    private boolean visible(String userId, String ownerId, JsonNode audience, boolean manager,
            boolean canOpen, Set<String> groupIds, Set<String> roleIds) {
        if (!canOpen) {
            return false;
        }
        String kind = audience.path("kind").asString();
        if ("personal".equals(kind)) {
            return ownerId.equals(userId);
        }
        if (manager || "everyone".equals(kind)) {
            return true;
        }
        return audience.path("groupIds").isArray()
                && audience.path("groupIds").valueStream()
                        .anyMatch(group -> groupIds.contains(group.asString()))
                || audience.path("roleIds").isArray()
                && audience.path("roleIds").valueStream().anyMatch(role -> roleIds.contains(role.asString()));
    }

    public boolean canOpen(String userId, String view) {
        HeldScopes access = held.scopesHeldBy(userId);
        return switch (view) {
            case "documents" -> documents.audienceOf(userId) == Audience.STAFF;
            case "my-documents" -> documents.canOpenMyDocuments(userId);
            case "requests" -> requests.canReadRequests(userId);
            case "validations" -> access.hasPermission("validation.approve")
                    || access.hasPermission("validation.deny")
                    || access.hasPermission("validation.revoke");
            case "lists" -> access.hasPermission("list.read");
            case "projects" -> projects.canRead(userId);
            case "categories" -> categories.canRead(userId);
            case "mixes" -> access.hasPermission("mix.read");
            case "intentions" -> access.hasPermission("intention.read");
            case "tasks" -> tasks.canRead(userId);
            default -> false;
        };
    }

    public boolean canOpen(String userId, String view, JsonNode filter) {
        return canOpen(userId, view, filter, held.scopesHeldBy(userId));
    }

    private boolean canOpen(String userId, String view, JsonNode filter, HeldScopes access) {
        boolean open = switch (view) {
            case "documents" -> documents.audienceOf(access) == Audience.STAFF;
            case "my-documents" -> documents.canOpenMyDocuments(access);
            case "requests" -> requests.canReadRequests(access);
            case "validations" -> access.hasPermission("validation.approve")
                    || access.hasPermission("validation.deny") || access.hasPermission("validation.revoke");
            case "lists" -> access.hasPermission("list.read");
            case "projects" -> access.hasPermission("project.read");
            case "categories" -> access.hasPermission("category.read");
            case "mixes" -> access.hasPermission("mix.read");
            case "intentions" -> access.hasPermission("intention.read");
            case "tasks" -> access.hasPermission("task.read") || access.hasPermission("task.read_own");
            default -> false;
        };
        if (!open) {
            return false;
        }
        if ("categories".equals(view) && (filter.has("attention") || filter.has("mix"))) {
            return access.hasPermission("intention.read");
        }
        return true;
    }

    private JsonNode read(String value) {
        try {
            return mapper.readTree(value);
        } catch (Exception exception) {
            throw new IllegalStateException("Invalid watchlist JSON", exception);
        }
    }

    private String format(OffsetDateTime value) {
        return value == null ? null : Instants.format(value.toInstant());
    }

    private OffsetDateTime parse(String value) {
        return value == null ? null : OffsetDateTime.parse(value.replace("Z", "+00:00"));
    }
}
