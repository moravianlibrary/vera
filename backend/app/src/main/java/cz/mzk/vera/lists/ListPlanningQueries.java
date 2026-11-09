package cz.mzk.vera.lists;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.DIGITIZATION_LISTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_STATES;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_STATES;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_IMPLEMENTATIONS;
import static cz.mzk.vera.db.tables.Tables.PLUGIN_INSTANCES;
import static cz.mzk.vera.db.tables.Tables.PROJECTS;
import static cz.mzk.vera.domain.categories.Categories.leavesOf;
import static cz.mzk.vera.domain.intentions.Intentions.countsTowardsOf;
import static cz.mzk.vera.domain.intentions.Intentions.isInIntentionScope;
import static cz.mzk.vera.domain.intentions.Intentions.listMixOf;
import static cz.mzk.vera.domain.intentions.Intentions.mixNodesOf;
import static cz.mzk.vera.domain.intentions.Intentions.shareWithinOf;

import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.lists.Lists;
import cz.mzk.vera.intentions.CountingReads;
import cz.mzk.vera.intentions.CountingReads.CountingSnapshot;
import cz.mzk.vera.intentions.CountingReads.StoredIntention;
import cz.mzk.vera.intentions.CountingReads.StoredDistribution;
import cz.mzk.vera.plugin.listgenerator.GenerateAnswer;
import cz.mzk.vera.plugin.listgenerator.GenerateInput;
import cz.mzk.vera.plugin.listgenerator.ListGenerator;
import cz.mzk.vera.plugin.listgenerator.ShortfallCause;
import cz.mzk.vera.plugin.records.Category;
import cz.mzk.vera.pluginhost.PluginCalls;
import cz.mzk.vera.pluginhost.PluginOutcome;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import cz.mzk.vera.web.Instants;
import cz.mzk.vera.web.Problems;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jooq.DSLContext;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Repository;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// PLAN-generate-*; LC-LIST-pool; PLAN-mix-within-scope; PLAN-counting.
@Repository
class ListPlanningQueries {
    private static final Pattern TOLERANCE = Pattern.compile(
            "^[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?");

    private final DSLContext dsl;
    private final CountingReads counting;
    private final HeldAccessQueries access;
    private final PluginCalls calls;
    private final ListDetailQueries details;
    private final JsonMapper mapper;
    private final Clock clock;

    ListPlanningQueries(DSLContext dsl, CountingReads counting, HeldAccessQueries access,
            PluginCalls calls, ListDetailQueries details,
            JsonMapper mapper, Clock clock) {
        this.dsl = dsl;
        this.counting = counting;
        this.access = access;
        this.calls = calls;
        this.details = details;
        this.mapper = mapper;
        this.clock = clock;
    }

    boolean canBuild(String userId) {
        HeldScopes held = access.scopesHeldBy(userId);
        return held.hasPermission("list.create") || held.hasPermission("list.edit");
    }

    ResponseEntity<?> generators(String userId) {
        if (!canBuild(userId)) {
            return Problems.response(403, "You may not build lists");
        }
        List<Map<String, Object>> result = new ArrayList<>();
        dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.NAME, PLUGIN_INSTANCES.CONFIGURATION,
                        PLUGIN_IMPLEMENTATIONS.NAME, PLUGIN_IMPLEMENTATIONS.DESCRIPTION,
                        PLUGIN_IMPLEMENTATIONS.VERSIONS)
                .from(PLUGIN_INSTANCES)
                .join(PLUGIN_IMPLEMENTATIONS)
                .on(PLUGIN_INSTANCES.IMPLEMENTATION_ID.eq(PLUGIN_IMPLEMENTATIONS.ID))
                .where(PLUGIN_IMPLEMENTATIONS.KIND.eq("ListGenerator"))
                .and(PLUGIN_INSTANCES.IS_ENABLED.isTrue())
                .and(PLUGIN_INSTANCES.IS_DELETED.isFalse())
                .orderBy(PLUGIN_INSTANCES.POSITION)
                .fetch().forEach(row -> {
                    JsonNode versions = mapper.readTree(row.get(PLUGIN_IMPLEMENTATIONS.VERSIONS).data());
                    JsonNode version = versions.isArray() && !versions.isEmpty() ? versions.get(0) : null;
                    if (version == null || !version.path("declares").path("generatorClass").isString()) {
                        return;
                    }
                    JsonNode configuration = mapper.readTree(row.get(PLUGIN_INSTANCES.CONFIGURATION).data());
                    String tolerance = configuration.path("tolerance").asString("");
                    double parsed = parseTolerance(tolerance);
                    result.add(ListQuerySupport.map("id", row.get(PLUGIN_INSTANCES.ID),
                            "name", row.get(PLUGIN_INSTANCES.NAME), "plugin",
                            row.get(PLUGIN_IMPLEMENTATIONS.NAME), "version", version.path("version").asString(),
                            "generatorClass", version.path("declares").path("generatorClass").asString(),
                            "description", row.get(PLUGIN_IMPLEMENTATIONS.DESCRIPTION),
                            "tolerance", parsed));
                });
        return ResponseEntity.ok(result);
    }

    ResponseEntity<?> shapes(String userId) {
        if (!canBuild(userId)) {
            return Problems.response(403, "You may not build lists");
        }
        CountingSnapshot snapshot = counting.countingData();
        LocalDate today = LocalDate.now(clock);
        Map<String, String> projectNames = new LinkedHashMap<>();
        dsl.selectFrom(PROJECTS)
                .fetch().forEach(row -> projectNames.put(row.getId(), row.getName()));
        List<Map<String, Object>> result = new ArrayList<>();
        snapshot.intentions().stream()
                .filter(value -> value.rule().archivedAt() == null
                        && (value.rule().endsOn() == null || value.rule().endsOn().compareTo(today.toString()) >= 0))
                .sorted(Comparator.comparing((StoredIntention value) -> !value.rule().isOverall()))
                .forEach(value -> {
                    Map<String, Object> funding = new LinkedHashMap<>();
                    String kind = value.rule().funding().kind();
                    funding.put("kind", kind);
                    if ("project".equals(kind)) {
                        funding.put("name", projectNames.getOrDefault(value.rule().funding().projectId(),
                                value.rule().funding().projectId()));
                    }
                    result.add(ListQuerySupport.map("id", value.rule().id(), "name", value.name(),
                            "isOverall", value.rule().isOverall(), "countsFrom", value.rule().countsFrom(),
                            "endsOn", value.rule().endsOn(), "scope",
                            categoryName(snapshot, value.rule().scopeCategoryId()),
                            "funding", funding));
                });
        return ResponseEntity.ok(result);
    }

    ResponseEntity<?> reading(String userId, JsonNode body) {
        if (!canBuild(userId)) {
            return Problems.response(403, "You may not build lists");
        }
        CountingSnapshot snapshot = counting.countingData();
        String intentionId = nullable(body.get("intentionId"));
        StoredIntention intention = intentionId == null ? counting.overallIntention(snapshot)
                : find(snapshot, intentionId);
        if (intention == null) {
            return Problems.response(422, "No intention " + intentionId,
                    "list.intention_not_found", null);
        }
        Set<String> memberIds = strings(body.path("memberIds"));
        List<Iteration> members = snapshot.rules().iterations().stream()
                .filter(item -> memberIds.contains(item.id()))
                .filter(item -> item.cancellation() == null || Lists.isScanned(item)).toList();
        String startsOn = nullable(body.get("startsOn"));
        if (startsOn == null) {
            startsOn = LocalDate.now(clock).toString();
        }
        List<Map<String, Object>> counts = countRows(snapshot, members, startsOn);
        List<Map<String, Object>> before = new ArrayList<>();
        String listId = nullable(body.get("listId"));
        if (listId != null) {
            var saved = dsl.selectFrom(DIGITIZATION_LISTS)
                    .where(DIGITIZATION_LISTS.ID.eq(listId)).fetchOne();
            if (saved != null) {
                before = countRows(snapshot, members, saved.getStartsOn().toString());
            }
        }
        List<Map<String, Object>> stopped = before.stream()
                .filter(row -> counts.stream().noneMatch(now -> now.get("intentionId").equals(row.get("intentionId"))))
                .map(row -> ListQuerySupport.map("id", row.get("intentionId"), "name", row.get("name"))).toList();
        Map<String, Object> mix = readingMix(snapshot, intention, members,
                nullableInt(body.get("targetPages")), readAllocation(body.get("allocation")));
        return ResponseEntity.ok(ListQuerySupport.map("startsOn", startsOn, "countsTowards", counts,
                "stopsCountingTowards", stopped, "mix", mix));
    }

    ResponseEntity<?> generate(String userId, JsonNode body) {
        if (!canBuild(userId)) {
            return Problems.response(403, "You may not build lists");
        }
        GeneratorMeta generator = generator(nullable(body.get("generatorId")));
        if (generator == null) {
            return Problems.response(404, "No such list generator is running");
        }
        CountingSnapshot snapshot = counting.countingData();
        String intentionId = nullable(body.get("intentionId"));
        StoredIntention shaped = intentionId == null ? counting.overallIntention(snapshot)
                : shapeable(snapshot).stream().filter(value -> value.rule().id().equals(intentionId))
                        .findFirst().orElse(null);
        if (shaped == null) {
            return Problems.response(422, "Shape it by an intention that is neither ended nor archived",
                    "list.intention_ended", null);
        }
        var categories = snapshot.rules().categories();
        String scope = shaped.rule().scopeCategoryId();
        var nodes = mixNodesOf(categories, scope);
        Map<String, Integer> allocation = readAllocation(body.get("allocation"));
        if (allocation != null && allocation.keySet().stream().anyMatch(id -> nodes.stream()
                .noneMatch(node -> node.id().equals(id)))) {
            return Problems.response(422, "Allocate pages only to the categories its mix is read across",
                    "list.allocation_outside_mix", null);
        }
        boolean hasMix = shaped.distributionId() != null;
        if (!hasMix && allocation != null) {
            return Problems.response(422, "A correcting allocation needs a mix",
                    "list.correction_needs_mix", null);
        }
        StoredDistribution storedDistribution = hasMix ? counting.distributionOf(snapshot, shaped) : null;
        var distribution = storedDistribution == null ? null : storedDistribution.countingShares();
        var leaves = leavesOf(categories).stream()
                .filter(leaf -> scope == null || Categories.lineageOf(categories, leaf.id()).contains(scope)).toList();
        Map<String, String> topIds = new LinkedHashMap<>();
        for (var category : categories) {
            List<String> path = Categories.lineageOf(categories, category.id());
            topIds.put(category.id(), path.isEmpty() ? category.id() : path.getFirst());
        }
        Set<String> requestedMembers = strings(body.path("memberIds"));
        Set<String> currentIds = dsl.select(DOCUMENT_STATES.CURRENT_ITERATION_ID)
                .from(DOCUMENT_STATES).fetchSet(DOCUMENT_STATES.CURRENT_ITERATION_ID);
        List<Iteration> all = snapshot.rules().iterations();
        List<String> allIds = all.stream().map(Iteration::id).toList();
        Map<String, Map<String, Object>> itemById = new LinkedHashMap<>();
        details.itemsOf(allIds).forEach(item -> itemById.put((String) item.get("iterationId"), item));
        List<Map<String, Object>> fixed = all.stream().filter(item -> requestedMembers.contains(item.id()))
                .map(item -> itemById.get(item.id())).filter(Objects::nonNull).toList();
        List<Map<String, Object>> pool = all.stream().filter(item -> currentIds.contains(item.id()))
                .filter(item -> !requestedMembers.contains(item.id()))
                .filter(Lists::isInPool)
                .filter(item -> isInIntentionScope(shaped.rule(), item, categories, snapshot.rules().meetsConditions()))
                .map(item -> itemById.get(item.id())).filter(Objects::nonNull)
                .filter(item -> item.get("pages") instanceof Integer)
                .sorted(Comparator.<Map<String, Object>>comparingInt(
                                item -> priorityRank((String) item.get("priority")))
                        .reversed()
                        .thenComparing(item -> (String) item.get("askedAt")))
                .toList();
        int pages = body.path("pages").asInt();
        List<GenerateInput.Leaf> inputLeaves = leaves.stream().map(leaf -> {
            String nodeId = allocation == null ? null : nodes.stream()
                    .filter(node -> Categories.lineageOf(categories, leaf.id()).contains(node.id()))
                    .map(node -> node.id()).findFirst().orElse(null);
            Double share = distribution == null ? null
                    : shareWithinOf(categories, distribution, scope, leaf.id());
            return new GenerateInput.Leaf(new Category(leaf.id(), leaf.name(), leaf.parentId()),
                    topIds.get(leaf.id()), share, nodeId);
        }).toList();
        List<GenerateInput.Node> inputNodes = nodes.stream().map(node -> new GenerateInput.Node(node.id(),
                distribution == null ? null : shareWithinOf(categories, distribution, scope, node.id()))).toList();
        GenerateInput input = new GenerateInput(new GenerateInput.ShapingIntention(shaped.rule().id(), shaped.name()),
                hasMix, inputLeaves, inputNodes, pool.stream().map(this::poolInput).toList(),
                fixed.stream().filter(item -> item.get("pages") instanceof Integer).map(this::memberInput).toList(),
                pages, strings(body.path("categoryIds")).stream().toList(), allocation);
        PluginOutcome<GenerateAnswer> outcome = calls.call(generator.id(), ListGenerator.class, "generate",
                (plugin, context) -> plugin.generate(context, input));
        if (!(outcome instanceof PluginOutcome.Answered<GenerateAnswer> answered)
                || !answerFits(answered.answer(), input)) {
            return Problems.response(503, "The list generator did not answer.");
        }
        return draft(shaped, generator, answered.answer(), pool, fixed, pages, allocation,
                storedDistribution);
    }

    private ResponseEntity<?> draft(StoredIntention shaped,
            GeneratorMeta generator, GenerateAnswer answer, List<Map<String, Object>> pool,
            List<Map<String, Object>> fixed, int pages, Map<String, Integer> allocation,
            StoredDistribution distribution) {
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        pool.forEach(item -> byId.put((String) item.get("iterationId"), item));
        List<Map<String, Object>> picks = new ArrayList<>();
        int total = 0;
        for (Map<String, Object> member : fixed) {
            total += member.get("pages") instanceof Integer value ? value : 0;
        }
        for (GenerateAnswer.Pick pick : answer.picks()) {
            Map<String, Object> item = byId.get(pick.iterationId());
            if (item == null) {
                return Problems.response(503, "The list generator did not answer.");
            }
            total += (Integer) item.get("pages");
            picks.add(ListQuerySupport.map("item", details.wireItem(item), "reason", pick.why()));
        }
        Map<String, Object> generatorWire = ListQuerySupport.map("id", generator.id(), "name", generator.name(),
                "plugin", generator.plugin(), "version", generator.version(), "generatorClass",
                generator.generatorClass(), "description", generator.description(), "tolerance", generator.tolerance());
        List<Map<String, Object>> review = reviewCounts();
        List<Map<String, Object>> shortfalls = answer.shortfalls().stream().map(shortfall ->
                ListQuerySupport.map("categoryId", shortfall.categoryId(), "pages", shortfall.pages(),
                        "cause", cause(shortfall.cause()), "inReviewCount", review.stream()
                                .filter(row -> row.get("categoryId").equals(shortfall.categoryId()))
                                .mapToInt(row -> (Integer) row.get("itemCount")).sum())).toList();
        Map<String, Object> provenance = ListQuerySupport.map("intentionId", shaped.rule().id(),
                "mixId", distribution == null ? null : distribution.id(), "mixRevision",
                distribution == null ? null : distribution.revision(), "pages", pages,
                "allocation", allocation, "generator", generator.plugin() + " " + generator.version(),
                "at", Instants.format(clock.instant()));
        return ResponseEntity.ok(ListQuerySupport.map("generator", generatorWire,
                "shapedBy", ListQuerySupport.map("intentionId", shaped.rule().id(), "name", shaped.name()),
                "picks", picks, "requestedPages", pages, "totalPages", total,
                "spreadCount", answer.spreadCount(), "shortfalls", shortfalls, "provenance", provenance));
    }

    private GenerateInput.PoolItem poolInput(Map<String, Object> item) {
        Map<?, ?> value = (Map<?, ?>) item.get("iteration");
        var iteration = pluginIteration(value);
        return new GenerateInput.PoolItem(iteration, (Integer) item.get("pages"),
                (String) item.get("askedAt"));
    }

    private GenerateInput.Member memberInput(Map<String, Object> item) {
        return new GenerateInput.Member(pluginIteration((Map<?, ?>) item.get("iteration")),
                (Integer) item.get("pages"));
    }

    private cz.mzk.vera.plugin.records.Iteration pluginIteration(Map<?, ?> value) {
        return new cz.mzk.vera.plugin.records.Iteration((String) value.get("id"),
                (String) value.get("documentId"), (Integer) value.get("attempt"),
                (String) value.get("requestId"), (String) value.get("categoryId"),
                (String) value.get("priority"), (String) value.get("projectId"),
                (String) value.get("progress"), (String) value.get("listId"),
                (String) value.get("formerListName"));
    }

    private boolean answerFits(GenerateAnswer answer, GenerateInput input) {
        Set<String> available = input.pool().stream().map(item -> item.iteration().id())
                .collect(Collectors.toSet());
        if (answer.picks() == null || answer.shortfalls() == null || answer.spreadCount() < 0) {
            return false;
        }
        Set<String> picked = new LinkedHashSet<>();
        for (GenerateAnswer.Pick pick : answer.picks()) {
            if (pick == null || pick.iterationId() == null || pick.why() == null
                    || !available.contains(pick.iterationId()) || !picked.add(pick.iterationId())) {
                return false;
            }
        }
        Set<String> leaves = input.leaves().stream().map(value -> value.category().id())
                .collect(Collectors.toSet());
        return answer.shortfalls().stream().allMatch(value -> value != null && value.pages() >= 0
                && leaves.contains(value.categoryId()) && value.cause() != null);
    }

    private List<Map<String, Object>> countRows(CountingSnapshot snapshot, List<Iteration> members,
            String startsOn) {
        return countsTowardsOf(snapshot.intentions().stream().map(StoredIntention::rule).toList(),
                members, startsOn, snapshot.rules()).stream()
                .sorted(Comparator.comparing(value -> snapshot.intentions().stream()
                        .filter(intention -> intention.rule().id().equals(value.intentionId()))
                        .findFirst().map(intention -> intention.rule().isOverall()).orElse(false)))
                .map(value -> {
                    StoredIntention intention = find(snapshot, value.intentionId());
                    return ListQuerySupport.map("intentionId", value.intentionId(), "name", intention.name(),
                            "isOverall", intention.rule().isOverall(), "itemCount", value.itemCount(),
                            "pages", value.pages());
                }).toList();
    }

    private Map<String, Object> readingMix(CountingSnapshot snapshot, StoredIntention intention,
            List<Iteration> members, Integer targetPages, Map<String, Integer> allocation) {
        String scope = intention.rule().scopeCategoryId();
        if (intention.distributionId() == null) {
            return ListQuerySupport.map("intention", ListQuerySupport.map("id", intention.rule().id(),
                    "name", intention.name()), "scope", categoryName(snapshot, scope),
                    "isAllocation", false, "rows", List.of());
        }
        var mix = counting.distributionOf(snapshot, intention);
        List<Map<String, Object>> rows = listMixOf(snapshot.rules().categories(), mix.countingShares(), scope,
                members, targetPages, allocation, snapshot.pagesOf()).stream()
                .map(row -> ListQuerySupport.map("categoryId", row.categoryId(), "name",
                        categoryName(snapshot, row.categoryId()), "share", row.share(),
                        "pages", row.pages(), "goalPages", row.goalPages())).toList();
        return ListQuerySupport.map("intention", ListQuerySupport.map("id", intention.rule().id(),
                "name", intention.name()), "scope", categoryName(snapshot, scope),
                "isAllocation", allocation != null, "rows", rows);
    }

    private List<Map<String, Object>> reviewCounts() {
        Map<String, Integer> counts = new LinkedHashMap<>();
        dsl.select(ITERATIONS.CATEGORY_ID).from(ITERATIONS)
                .join(ITERATION_STATES).on(ITERATION_STATES.ITERATION_ID.eq(ITERATIONS.ID))
                .where(ITERATIONS.PROGRESS.eq("Enqueued").and(ITERATIONS.LIST_ID.isNull())
                        .and(ITERATIONS.CANCELLATION_CAUSE.isNull())
                        .and(ITERATION_STATES.IS_RESTRICTED.isFalse())
                        .and(ITERATION_STATES.REVIEW_STATE.in("Needed", "Denied")))
                .fetch().forEach(row -> counts.merge(row.get(ITERATIONS.CATEGORY_ID), 1, Integer::sum));
        return counts.entrySet().stream().map(entry -> ListQuerySupport.map("categoryId", entry.getKey(),
                "itemCount", entry.getValue())).toList();
    }

    private GeneratorMeta generator(String id) {
        if (id == null) {
            return null;
        }
        var row = dsl.select(PLUGIN_INSTANCES.ID, PLUGIN_INSTANCES.NAME, PLUGIN_INSTANCES.CONFIGURATION,
                        PLUGIN_IMPLEMENTATIONS.NAME, PLUGIN_IMPLEMENTATIONS.DESCRIPTION,
                        PLUGIN_IMPLEMENTATIONS.VERSIONS)
                .from(PLUGIN_INSTANCES).join(PLUGIN_IMPLEMENTATIONS)
                .on(PLUGIN_INSTANCES.IMPLEMENTATION_ID.eq(PLUGIN_IMPLEMENTATIONS.ID))
                .where(PLUGIN_INSTANCES.ID.eq(id).and(PLUGIN_IMPLEMENTATIONS.KIND.eq("ListGenerator"))
                        .and(PLUGIN_INSTANCES.IS_ENABLED.isTrue()).and(PLUGIN_INSTANCES.IS_DELETED.isFalse()))
                .fetchOne();
        if (row == null) {
            return null;
        }
        JsonNode versions = mapper.readTree(row.get(PLUGIN_IMPLEMENTATIONS.VERSIONS).data());
        JsonNode version = versions.isArray() && !versions.isEmpty() ? versions.get(0) : null;
        if (version == null) {
            return null;
        }
        String generatorClass = version.path("declares").path("generatorClass").asString();
        JsonNode configuration = mapper.readTree(row.get(PLUGIN_INSTANCES.CONFIGURATION).data());
        return new GeneratorMeta(row.get(PLUGIN_INSTANCES.ID), row.get(PLUGIN_INSTANCES.NAME),
                row.get(PLUGIN_IMPLEMENTATIONS.NAME), version.path("version").asString(), generatorClass,
                row.get(PLUGIN_IMPLEMENTATIONS.DESCRIPTION),
                parseTolerance(configuration.path("tolerance").asString("")));
    }

    private List<StoredIntention> shapeable(CountingSnapshot snapshot) {
        String today = LocalDate.now(clock).toString();
        return snapshot.intentions().stream().filter(value -> value.rule().archivedAt() == null
                && (value.rule().endsOn() == null || value.rule().endsOn().compareTo(today) >= 0))
                .sorted(Comparator.comparing(value -> !value.rule().isOverall())).toList();
    }

    private StoredIntention find(CountingSnapshot snapshot, String id) {
        return snapshot.intentions().stream().filter(value -> value.rule().id().equals(id)).findFirst().orElse(null);
    }

    private String categoryName(CountingSnapshot snapshot, String id) {
        return id == null ? null : snapshot.rules().categories().stream()
                .filter(category -> category.id().equals(id))
                .map(category -> category.name()).findFirst().orElse(id);
    }

    private int priorityRank(String priority) {
        return List.of("Low", "Normal", "High", "Urgent").indexOf(priority);
    }

    private String nullable(JsonNode node) {
        return node == null || node.isNull() ? null : node.asString();
    }

    private Integer nullableInt(JsonNode node) {
        return node == null || node.isNull() ? null : node.asInt();
    }

    private Set<String> strings(JsonNode node) {
        Set<String> result = new LinkedHashSet<>();
        if (node != null && node.isArray()) {
            node.forEach(value -> result.add(value.asString()));
        }
        return result;
    }

    private Map<String, Integer> readAllocation(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        return mapper.convertValue(node, new TypeReference<>() {});
    }

    private double parseTolerance(String value) {
        try {
            Matcher matcher = TOLERANCE.matcher(value);
            if (!matcher.find()) {
                return 0.05;
            }
            double parsed = Double.parseDouble(matcher.group());
            return parsed == 0 || !Double.isFinite(parsed) ? 0.05 : parsed / 100;
        } catch (NumberFormatException exception) {
            return 0.05;
        }
    }

    private String cause(ShortfallCause cause) {
        return switch (cause) {
            case LEFT_OUT -> "leftOut";
            case OVERSHOOT -> "overshoot";
            case NO_SUPPLY -> "noSupply";
            case UNALLOCATED -> "unallocated";
        };
    }

    private record GeneratorMeta(String id, String name, String plugin, String version,
            String generatorClass, String description, double tolerance) {}
}
