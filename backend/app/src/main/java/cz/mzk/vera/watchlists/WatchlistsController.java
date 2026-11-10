package cz.mzk.vera.watchlists;

import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.max;
import static cz.mzk.vera.db.tables.Tables.GROUP_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.USER_HAND_ROLES;
import static cz.mzk.vera.db.tables.Tables.USER_MAPPED_ROLES;
import static cz.mzk.vera.db.tables.Tables.WATCHLISTS;
import static cz.mzk.vera.db.tables.Tables.USERS;

import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.documents.PropertyDefinitions;
import cz.mzk.vera.domain.status.Status.PublicStatus;
import cz.mzk.vera.db.tables.tables.records.WatchlistsRecord;
import cz.mzk.vera.web.Problems;
import cz.mzk.vera.web.Instants;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

// WATCH-model; WATCH-personal-system; WATCH-audience; WATCH-no-duplicates; WATCH-new.
@RestController
@RequestMapping("/api/watchlists")
final class WatchlistsController {
    private final DSLContext dsl;
    private final WatchlistQueries queries;
    private final HeldAccessQueries held;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final PropertyDefinitions propertyDefinitions;

    WatchlistsController(DSLContext dsl, WatchlistQueries queries, HeldAccessQueries held,
            ObjectMapper mapper, Clock clock, PropertyDefinitions propertyDefinitions) {
        this.dsl = dsl;
        this.queries = queries;
        this.held = held;
        this.mapper = mapper;
        this.clock = clock;
        this.propertyDefinitions = propertyDefinitions;
    }

    @GetMapping
    ResponseEntity<?> list(HttpServletRequest request, @RequestParam(required = false) String view,
            @RequestParam(required = false) String mode) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        List<Map<String, Object>> rows = queries.list(caller.userId(), view, "manage-system".equals(mode));
        if (rows == null) {
            return managerRequired();
        }
        queries.materializeViewersForVisibleWatchlists();
        return ResponseEntity.ok(rows);
    }

    @PostMapping
    ResponseEntity<?> create(HttpServletRequest request, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        String view = body.path("view").asString();
        JsonNode filter = body.path("filter");
        JsonNode audience = body.path("audience");
        if (!validFilter(view, filter)) {
            return Problems.response(422, "Filter is not valid for this view", "watchlist.invalid_filter", null);
        }
        if (!queries.canOpen(caller.userId(), view, filter)) {
            return managerRequired();
        }
        boolean personal = "personal".equals(audience.path("kind").asString());
        if (personal && !held.scopesHeldBy(caller.userId()).hasPermission("watch")) {
            return managerRequired();
        }
        if (!personal && !held.scopesHeldBy(caller.userId()).hasPermission("watchlist.manage_system")) {
            return managerRequired();
        }
        String copyId = body.path("copyOf").asString(null);
        if (copyId != null) {
            Map<String, Object> source = queries.find(caller.userId(), copyId, false);
            if (source == null || !"personal".equals(audience.path("kind").asString())
                    || "personal".equals(mapper.valueToTree(source.get("audience")).path("kind").asString())
                    || !source.get("view").equals(view) || !source.get("filter").equals(toValue(filter))) {
                return Problems.response(422, "Choose a visible system watchlist to copy",
                        "watchlist.source_unavailable", null);
            }
        }
        Map<String, Object> duplicate = duplicate(caller.userId(), view, filter, null, copyId != null);
        boolean publishingOwnPersonal = duplicate != null
                && !personal
                && "personal".equals(mapper.valueToTree(duplicate.get("audience")).path("kind").asString())
                && caller.userId().equals(duplicate.get("createdBy"));
        if (duplicate != null && !publishingOwnPersonal) {
            return alreadySaved((String) duplicate.get("name"));
        }
        String id = UUID.randomUUID().toString();
        Map<String, Object> created = watchlist(body, id);
        dsl.insertInto(WATCHLISTS)
                .set(WATCHLISTS.ID, id)
                .set(WATCHLISTS.OWNER_ID, caller.userId())
                .set(WATCHLISTS.NAME, body.path("name").asString())
                .set(WATCHLISTS.VIEW, view)
                .set(WATCHLISTS.FILTER, JSONB.valueOf(filter.toString()))
                .set(WATCHLISTS.AUDIENCE, JSONB.valueOf(audience.toString()))
                .set(WATCHLISTS.CREATED_AT, clock.instant().atOffset(ZoneOffset.UTC))
                .set(WATCHLISTS.COPIED_FROM, copyId)
                .set(WATCHLISTS.FILTER_VERSION, 1)
                .set(WATCHLISTS.POSITION, nextPosition())
                .execute();
        created.put("id", id);
        return ResponseEntity.status(201).body(created);
    }

    @PostMapping("/reach")
    ResponseEntity<?> reach(HttpServletRequest request, @RequestBody JsonNode body) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (!held.scopesHeldBy(caller.userId()).hasPermission("watchlist.manage_system")) {
            return managerRequired();
        }
        if (!validFilter(body.path("view").asString(), body.path("filter"))) {
            return Problems.response(422, "Filter is not valid for this view", "watchlist.invalid_filter", null);
        }
        if (!queries.canOpen(caller.userId(), body.path("view").asString(), body.path("filter"))) {
            return managerRequired();
        }
        List<Map<String, Object>> users = dsl.selectFrom(USERS).fetch(row -> {
            String userId = row.getId();
            JsonNode audience = body.path("audience");
            boolean inAudience = "everyone".equals(audience.path("kind").asString())
                    || hasAudience(userId, audience);
            boolean canOpen = queries.canOpen(userId, body.path("view").asString(), body.path("filter"));
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("reached", inAudience && canOpen);
            result.put("outOfView", inAudience && !canOpen);
            result.put("duplicate", inAudience && canOpen
                    && duplicate(userId, body.path("view").asString(), body.path("filter"),
                            body.path("watchlistId").asString(null), false) != null);
            return result;
        });
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("userCount", users.stream().filter(row -> Boolean.TRUE.equals(row.get("reached"))).count());
        response.put("outOfViewCount", users.stream().filter(row -> Boolean.TRUE.equals(row.get("outOfView"))).count());
        response.put("duplicateCount", users.stream().filter(row -> Boolean.TRUE.equals(row.get("duplicate"))).count());
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{watchlistId}")
    ResponseEntity<?> update(HttpServletRequest request, @PathVariable String watchlistId,
            @RequestBody JsonNode change) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        Map<String, Object> existing = queries.find(caller.userId(), watchlistId, true);
        if (existing == null) {
            existing = queries.find(caller.userId(), watchlistId, false);
            if (existing == null) {
                return Problems.response(404, "Watchlist not found");
            }
            if (!held.scopesHeldBy(caller.userId()).hasPermission("watchlist.manage_system")) {
                return managerRequired();
            }
        }
        String view = (String) existing.get("view");
        JsonNode filter = change.has("filter") ? change.path("filter") : mapper.valueToTree(existing.get("filter"));
        if (!validFilter(view, filter)) {
            return Problems.response(422, "Filter is not valid for this view", "watchlist.invalid_filter", null);
        }
        JsonNode audience = change.has("audience") ? change.path("audience")
                : mapper.valueToTree(existing.get("audience"));
        String oldKind = mapper.valueToTree(existing.get("audience")).path("kind").asString();
        String newKind = audience.path("kind").asString();
        if (!oldKind.equals(newKind)) {
            return Problems.response(409, "Watchlist audience kind cannot be changed",
                    "personal".equals(newKind) ? "watchlist.system_to_personal" : "watchlist.personal_to_system", null);
        }
        Map<String, Object> dup = duplicate(caller.userId(), view, filter, watchlistId, false);
        if (dup != null) {
            return alreadySaved((String) dup.get("name"));
        }
        int filterVersion = ((Number) existing.getOrDefault("filterVersion", 1)).intValue();
        if (change.has("filter") && !filter.equals(mapper.valueToTree(existing.get("filter")))) {
            filterVersion++;
        }
        WatchlistsRecord row = dsl.update(WATCHLISTS).set(WATCHLISTS.NAME, change.has("name") ? change.path("name").asString()
                        : (String) existing.get("name"))
                .set(WATCHLISTS.FILTER, JSONB.valueOf(filter.toString()))
                .set(WATCHLISTS.AUDIENCE, JSONB.valueOf(audience.toString()))
                .set(WATCHLISTS.FILTER_VERSION, filterVersion)
                .where(WATCHLISTS.ID.eq(watchlistId)).returning().fetchOne();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("name", row.getName());
        response.put("filter", toValue(filter));
        response.put("view", row.getView());
        response.put("createdAt", Instants.format(row.getCreatedAt().toInstant()));
        response.put("id", row.getId());
        response.put("audience", toValue(audience));
        response.put("filterVersion", filterVersion);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{watchlistId}/viewer")
    ResponseEntity<?> viewer(HttpServletRequest request, @PathVariable String watchlistId,
            @RequestBody JsonNode change) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        if (queries.find(caller.userId(), watchlistId, false) == null) {
            return Problems.response(404, "Watchlist not found");
        }
        Map<String, Object> viewer = queries.viewer(caller.userId(), watchlistId);
        if (change.has("position")) {
            viewer.put("position", change.path("position").asInt());
        }
        if (change.has("push")) {
            boolean push = change.path("push").asBoolean();
            if (push && !Boolean.TRUE.equals(viewer.get("push"))) {
                viewer.put("pushSince", Instants.format(clock.instant()));
            }
            viewer.put("push", push);
        }
        if (change.has("confirmedFilter")) {
            viewer.put("confirmedFilter", change.path("confirmedFilter").isNull()
                    ? null : change.path("confirmedFilter").asString());
        }
        JsonNode channels = change.path("channels");
        if (channels.isObject()) {
            JsonNode current = mapper.valueToTree(viewer.get("channels"));
            Map<String, Object> changed = new LinkedHashMap<>();
            current.properties().forEach(entry -> changed.put(entry.getKey(), toValue(entry.getValue())));
            channels.properties().forEach(entry -> {
                Map<String, Object> state = new LinkedHashMap<>();
                boolean enabled = entry.getValue().asBoolean();
                Object storedChannel = changed.get(entry.getKey());
                Map<?, ?> previous = storedChannel instanceof Map<?, ?> map ? map : Map.of();
                boolean wasEnabled = Boolean.TRUE.equals(previous.get("isOn"));
                state.put("isOn", enabled);
                state.put("since", enabled && !wasEnabled ? Instants.format(clock.instant()) : previous.get("since"));
                changed.put(entry.getKey(), state);
            });
            viewer.put("channels", changed);
        }
        queries.saveViewer(caller.userId(), watchlistId, viewer);
        return ResponseEntity.ok(viewer);
    }

    @PostMapping("/{watchlistId}/seen")
    ResponseEntity<?> seen(HttpServletRequest request, @PathVariable String watchlistId) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        Map<String, Object> watchlist = queries.find(caller.userId(), watchlistId, false);
        if (watchlist == null) {
            return Problems.response(404, "Watchlist not found");
        }
        queries.list(caller.userId(), (String) watchlist.get("view"), false);
        Map<String, Object> viewer = queries.viewer(caller.userId(), watchlistId);
        viewer.put("seenAt", Instants.format(clock.instant()));
        queries.saveViewer(caller.userId(), watchlistId, viewer);
        return ResponseEntity.ok(viewer);
    }

    @DeleteMapping("/{watchlistId}")
    ResponseEntity<?> delete(HttpServletRequest request, @PathVariable String watchlistId) {
        Caller caller = caller(request);
        if (caller == null) {
            return Problems.response(401, "Nobody is signed in.");
        }
        Map<String, Object> record = queries.find(caller.userId(), watchlistId, true);
        if (record == null) {
            if (queries.find(caller.userId(), watchlistId, false) == null) {
                return Problems.response(404, "Watchlist not found");
            }
            return managerRequired();
        }
        dsl.deleteFrom(WATCHLISTS).where(WATCHLISTS.ID.eq(watchlistId)).execute();
        return ResponseEntity.noContent().build();
    }

    private Map<String, Object> watchlist(JsonNode body, String id) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("name", body.path("name").asString());
        result.put("filter", toValue(body.path("filter")));
        result.put("view", body.path("view").asString());
        result.put("createdAt", Instants.format(clock.instant()));
        result.put("id", id);
        result.put("audience", toValue(body.path("audience")));
        return result;
    }

    private boolean validFilter(String view, JsonNode filter) {
        if (!filter.isObject()) {
            return false;
        }
        if ("documents".equals(view)) {
            return !filter.has("status") && filter.properties().stream().allMatch(entry -> entry.getValue().isString());
        }
        if ("my-documents".equals(view)) {
            Set<String> allowed = new HashSet<>(List.of("q", "status"));
            propertyDefinitions.publicKeys(dsl).forEach(key -> {
                allowed.add("p." + key);
                allowed.add("p." + key + ".starts");
                allowed.add("p." + key + ".ends");
                allowed.add("p." + key + ".none");
            });
            if (!filter.properties().stream().allMatch(entry -> allowed.contains(entry.getKey())
                    && entry.getValue().isString())) {
                return false;
            }
            String statuses = filter.path("status").asString(null);
            Set<String> publicStatuses = new HashSet<>(Arrays.stream(PublicStatus.values())
                    .map(Enum::name).toList());
            return statuses == null || !statuses.isEmpty()
                    && Arrays.stream(statuses.split(",")).allMatch(publicStatuses::contains);
        }
        return List.of("my-documents", "requests", "validations", "lists", "projects", "categories",
                "mixes", "intentions", "tasks").contains(view)
                && filter.properties().stream().allMatch(entry -> entry.getValue().isString());
    }

    private boolean hasAudience(String userId, JsonNode audience) {
        if ("personal".equals(audience.path("kind").asString())) {
            return false;
        }
        if (held.scopesHeldBy(userId).hasPermission("watchlist.manage_system")) {
            return true;
        }
        for (JsonNode group : audience.path("groupIds")) {
            if (dsl.fetchExists(dsl.selectOne().from(GROUP_MEMBERS)
                    .where(GROUP_MEMBERS.USER_ID.eq(userId))
                    .and(GROUP_MEMBERS.GROUP_ID.eq(group.asString())))) {
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

    private Map<String, Object> duplicate(String userId, String view, JsonNode filter, String exceptId,
            boolean personalOnly) {
        for (Map<String, Object> item : queries.list(userId, view, false, false)) {
            boolean personal = "personal".equals(
                    mapper.valueToTree(item.get("audience")).path("kind").asString());
            if (!item.get("id").equals(exceptId) && (!personalOnly || personal)
                    && item.get("filter").equals(toValue(filter))) {
                return item;
            }
        }
        return null;
    }

    private int nextPosition() {
        return dsl.select(coalesce(max(WATCHLISTS.POSITION), -1).add(1))
                .from(WATCHLISTS).fetchOne(0, int.class);
    }

    private Caller caller(HttpServletRequest request) {
        return (Caller) request.getAttribute(Caller.class.getName());
    }

    private Object toValue(JsonNode value) {
        return mapper.convertValue(value, Object.class);
    }

    private ResponseEntity<?> managerRequired() {
        return Problems.response(403, "Only those who manage shared watchlists can change them",
                "watchlist.manager_required", null);
    }

    private ResponseEntity<?> alreadySaved(String name) {
        return Problems.response(409, "The filter is already saved as “" + name + "”",
                "watchlist.already_saved", null);
    }
}
