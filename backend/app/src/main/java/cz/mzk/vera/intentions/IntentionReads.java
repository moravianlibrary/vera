package cz.mzk.vera.intentions;

import static cz.mzk.vera.db.tables.Tables.ARCHIVED_INTENTION_SNAPSHOTS;
import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.DIGITIZATION_LISTS;
import static cz.mzk.vera.db.tables.Tables.INTENTIONS;
import static cz.mzk.vera.db.tables.Tables.INTENTION_TEMPLATES;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.MIXES;
import static cz.mzk.vera.db.tables.Tables.PROJECTS;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBER_GROUPS;
import static cz.mzk.vera.domain.mixes.Mixes.siblingSetOf;

import cz.mzk.vera.domain.Names;
import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.entities.Distribution;
import cz.mzk.vera.domain.entities.Intention;
import cz.mzk.vera.domain.entities.IntentionFunding;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.entities.PropertyCondition;
import cz.mzk.vera.domain.intentions.Intentions.CountingData;
import cz.mzk.vera.domain.intentions.Intentions.IntentionCount;
import cz.mzk.vera.domain.intentions.Intentions.MixReading;
import cz.mzk.vera.domain.intentions.Intentions.TargetVerdict;
import cz.mzk.vera.domain.intentions.Intentions;
import cz.mzk.vera.domain.mixes.Mixes.SiblingSet;
import cz.mzk.vera.intentions.CountingReads.CountingSnapshot;
import cz.mzk.vera.intentions.CountingReads.StoredDistribution;
import cz.mzk.vera.intentions.CountingReads.StoredIntention;
import cz.mzk.vera.intentions.CountingReads.StoredMix;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.web.Instants;
import cz.mzk.vera.web.Problems;
import cz.mzk.vera.web.RequestLanguage;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Repository;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// PLAN-counting; PLAN-target; PLAN-mix-reading; PLAN-mix-within-scope; LC-INT-archive.
@Repository
public class IntentionReads {
    private final DSLContext dsl;
    private final CountingReads counting;
    private final HeldAccessQueries access;
    private final Clock clock;
    private final JsonMapper mapper;

    IntentionReads(
        DSLContext dsl, CountingReads counting, HeldAccessQueries access, Clock clock, JsonMapper mapper) {
        this.dsl = dsl;
        this.counting = counting;
        this.access = access;
        this.clock = clock;
        this.mapper = mapper;
    }

    boolean canRead(String userId) {
        return access.scopesHeldBy(userId).hasPermission("intention.read");
    }

    public Map<String, Object> overview(String userId) {
        CountingSnapshot data = counting.countingData();
        HeldScopes scopes = access.scopesHeldBy(userId);
        Map<String, ProjectInfo> projects = projects();
        LocalDate today = LocalDate.now(clock);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (StoredIntention stored : data.intentions()) {
            if (visible(scopes, stored, projects)) {
                rows.add(archivedRow(stored, data, today, projects));
            }
        }
        List<Map<String, Object>> templates = new ArrayList<>();
        if (scopes.scopesOf("intention.read").contains("any")) {
            dsl.selectFrom(INTENTION_TEMPLATES).orderBy(INTENTION_TEMPLATES.POSITION).fetch().forEach(row -> {
                Map<String, Object> template = new LinkedHashMap<>();
                template.put("id", row.getId());
                template.put("description", row.getDescription());
                // UI-names: the pattern in the request's language, as a name is.
        template.put("namePattern", Names.nameIn(mapper.readValue(row.getNamePatterns().data(),
                new TypeReference<Map<String, String>>() { }), RequestLanguage.current()));
                template.put("namePatterns", mapper.readTree(row.getNamePatterns().data()));
                template.put("every", row.getEvery());
                template.put("funding", funding(row.getFundingKind(), row.getFundingProjectId()));
                template.put("scopeCategoryId", row.getScopeCategoryId());
                if (row.getScopeConditions() != null) {
                    template.put("scopeConditions", jsonList(row.getScopeConditions()));
                }
                template.put("distributionId", row.getDistributionId());
                if (row.getMixRevision() != null) {
                    template.put("mixRevision", row.getMixRevision());
                }
                template.put("targetPages", row.getTargetPages());
                template.put("isArchivingPrevious", row.getIsArchivingPrevious());
                template.put("since", row.getSince().toString());
                template.put("nextOn", row.getNextOn().toString());
                template.put("createdBy", row.getCreatedBy());
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("template", template);
                result.put("mix",
                    row.getDistributionId() == null ? null : namedTemplateMix(data, row.getDistributionId()));
                templates.add(result);
            });
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("asOf", today.toString());
        result.put("rows", rows);
        result.put("templates", templates);
        return result;
    }

    Map<String, Object> mix(String userId, String intentionId) {
        CountingSnapshot data = counting.countingData();
        Map<String, ProjectInfo> projects = projects();
        StoredIntention stored = find(data, intentionId);
        if (stored == null || stored.distributionId() == null
            || !visible(access.scopesHeldBy(userId), stored, projects)) {
            return null;
        }
        StoredDistribution distribution = counting.distributionOf(data, stored);
        Map<String, Object> tree = mixTree(stored, distribution, data, true);
        var snapshot = dsl.selectFrom(ARCHIVED_INTENTION_SNAPSHOTS)
                           .where(ARCHIVED_INTENTION_SNAPSHOTS.INTENTION_ID.eq(intentionId))
                           .fetchOne();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put(
            "mix", snapshot != null && snapshot.getMixTree() != null ? jsonMap(snapshot.getMixTree()) : tree);
        result.put("archivedCategories",
            stored.rule().archivedAt() == null ? null
                : snapshot == null             ? categoryRows(data.rules().categories())
                                               : jsonList(snapshot.getCategoryTree()));
        result.put("revision", distribution.revision());
        return result;
    }

    Map<String, Object> archiveSnapshot(String intentionId) {
        return archiveSnapshot(dsl, intentionId);
    }

    Map<String, Object> archiveSnapshot(DSLContext database, String intentionId) {
        CountingSnapshot data = counting.countingData(database);
        StoredIntention stored = find(data, intentionId);
        if (stored == null) {
            throw new IllegalArgumentException("Unknown intention " + intentionId);
        }
        StoredDistribution distribution = stored.distributionId() == null
            ? null
            : counting.distributionOf(data, stored);
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("captured_row", archivedRow(stored, data, LocalDate.now(clock), projects()));
        snapshot.put("mix_tree", distribution == null ? null : mixTree(stored, distribution, data, true));
        snapshot.put("category_tree", categoryRows(data.rules().categories()));
        return snapshot;
    }

    ResponseEntity<?> deletion(String userId, String intentionId) {
        CountingSnapshot data = counting.countingData();
        StoredIntention stored = find(data, intentionId);
        Map<String, ProjectInfo> projects = projects();
        HeldScopes scopes = access.scopesHeldBy(userId);
        if (stored == null || !visible(scopes, stored, projects)) {
            return Problems.response(404, "Intention not found");
        }
        if (!canEdit(scopes, stored, projects)) {
            return Problems.response(403, "You may not change this intention");
        }
        if (stored.rule().archivedAt() != null) {
            return Problems.response(
                409, "An archived intention is preserved", "intention.is_archived", null);
        }
        if (stored.rule().isOverall()) {
            return Problems.response(
                409, "The Overall intention cannot be archived or deleted", "intention.overall", null);
        }
        if (stored.projectId() != null) {
            return Problems.response(409,
                "It is its project's intention: it changes, and goes, with the project", "intention.project",
                null);
        }
        List<Map<String, Object>> lists = new ArrayList<>();
        dsl.selectFrom(DIGITIZATION_LISTS).orderBy(DIGITIZATION_LISTS.POSITION).fetch().forEach(row -> {
            if (row.getGenerated() != null
                && intentionId.equals(
                    mapper.readTree(row.getGenerated().data()).path("intentionId").asString())) {
                Map<String, Object> named = new LinkedHashMap<>();
                named.put("id", row.getId());
                named.put("name", row.getName());
                lists.add(named);
            }
        });
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("generatedLists", lists);
        return ResponseEntity.ok(response);
    }

    ResponseEntity<?> correction(String userId, String intentionId, int pages) {
        HeldScopes scopes = access.scopesHeldBy(userId);
        if (!scopes.hasPermission("list.create") && !scopes.hasPermission("list.edit")) {
            return Problems.response(403, "You may not build lists");
        }
        CountingSnapshot data = counting.countingData();
        StoredIntention stored =
            data.intentions()
                .stream()
                .filter(candidate
                    -> candidate.rule().id().equals(intentionId) && candidate.rule().archivedAt() == null
                        && (candidate.rule().endsOn() == null
                            || candidate.rule().endsOn().compareTo(LocalDate.now(clock).toString()) >= 0))
                .findFirst()
                .orElse(null);
        if (stored == null) {
            return Problems.response(
                404, "No intention to correct towards", "list.intention_not_found", null);
        }
        if (stored.distributionId() == null) {
            return Problems.response(
                422, "This intention has no mix to correct towards", "list.correction_needs_mix", null);
        }
        IntentionCount counted = Intentions.countIntention(stored.rule(), data.rules());
        StoredDistribution mix = counting.distributionOf(data, stored);
        MixReading reading = Intentions.mixReadingOf(data.rules().categories(), mix.countingShares(),
            stored.rule().scopeCategoryId(), selected(counted.planned(), data.rules()),
            selected(counted.output(), data.rules()), counted.plannedPages(), counted.outputPages(),
            data.pagesOf());
        Map<String, Integer> ready = new LinkedHashMap<>();
        data.rules()
            .iterations()
            .stream()
            .filter(item
                -> item.progress() == Progress.Ready && item.cancellation() == null
                    && Intentions.isInIntentionScope(
                        stored.rule(), item, data.rules().categories(), data.rules().meetsConditions()))
            .forEach(item
                -> ready.merge(item.categoryId(),
                    data.pagesOf().apply(item) == null ? 0 : data.pagesOf().apply(item), Integer::sum));
        List<Intentions.CorrectionInputRow> inputs =
            reading.rows()
                .stream()
                .map(row
                    -> new Intentions.CorrectionInputRow(row.categoryId(), row.intended(), row.outputPages()))
                .toList();
        Intentions.Correction correction =
            Intentions.correctionOf(inputs, counted.outputPages(), pages, readyUnder(data, ready));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (int i = 0; i < correction.rows().size(); i++) {
            var row = correction.rows().get(i);
            var source = reading.rows().get(i);
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("categoryId", row.categoryId());
            value.put("name", categoryName(data.rules().categories(), row.categoryId()));
            value.put("intended", source.intended());
            value.put("output", source.output());
            value.put("newPages", row.newPages());
            value.put("after", row.after());
            value.put("readyPages", row.readyPages());
            value.put("shortPages", row.shortPages());
            rows.add(value);
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("outputPages", counted.outputPages());
        response.put("pages", pages);
        response.put("isCut", correction.isCut());
        response.put("unallocated", reading.unallocated());
        response.put("rows", rows);
        return ResponseEntity.ok(response);
    }

    ResponseEntity<?> preview(String userId, JsonNode body, JsonMapper objectMapper) {
        HeldScopes scopes = access.scopesHeldBy(userId);
        if (!scopes.hasPermission("intention.edit")) {
            return Problems.response(403, "You may not change intentions");
        }
        CountingSnapshot data = counting.countingData();
        try {
            String id = body.path("intentionId").isNull() ? "draft" : body.path("intentionId").asString();
            String projectId = body.path("funding").path("projectId").isString()
                ? body.path("funding").path("projectId").asString()
                : null;
            List<PropertyCondition> conditions = body.has("scopeConditions")
                ? objectMapper.readValue(body.path("scopeConditions").toString(), new TypeReference<>() {})
                : List.of();
            Intention draft = new Intention(id,
                new IntentionFunding(body.path("funding").path("kind").asString(), projectId),
                nullable(body.path("scopeCategoryId")), conditions, body.path("countsFrom").asString(),
                nullable(body.path("endsOn")), null, false, null);
            IntentionCount count = Intentions.countIntention(draft, data.rules());
            StoredIntention before =
                body.path("intentionId").isNull() ? null : find(data, body.path("intentionId").asString());
            DistributionChoice choice = chosenMix(body.path("mix"), data);
            List<Map<String, Object>> rows = new ArrayList<>();
            for (Category category :
                Intentions.mixCategoriesOf(data.rules().categories(), draft.scopeCategoryId())) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("categoryId", category.id());
                row.put("name", category.name());
                row.put("before",
                    before == null || before.distributionId() == null
                        ? null
                        : Intentions.shareWithinOf(data.rules().categories(),
                              counting.distributionOf(data, before).countingShares(), draft.scopeCategoryId(),
                              category.id()));
                row.put("after",
                    choice.distribution() == null
                        ? null
                        : Intentions.shareWithinOf(data.rules().categories(), choice.distribution(),
                              draft.scopeCategoryId(), category.id()));
                rows.add(row);
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("plannedPages", count.plannedPages());
            result.put("deliveredPages", count.deliveredPages());
            result.put("outputPages", count.outputPages());
            result.put("mix", rows);
            return ResponseEntity.ok(result);
        } catch (JacksonException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private Map<String, Object> archivedRow(
        StoredIntention stored, CountingSnapshot data, LocalDate today, Map<String, ProjectInfo> projects) {
        if (stored.rule().archivedAt() != null) {
            var snapshot = dsl.selectFrom(ARCHIVED_INTENTION_SNAPSHOTS)
                               .where(ARCHIVED_INTENTION_SNAPSHOTS.INTENTION_ID.eq(stored.rule().id()))
                               .fetchOne();
            if (snapshot != null) {
                return jsonMap(snapshot.getCapturedRow());
            }
        }
        Intention rule = stored.rule();
        IntentionCount counted = Intentions.countIntention(rule, data.rules());
        StoredDistribution distribution =
            stored.distributionId() == null ? null : counting.distributionOf(data, stored);
        ProjectInfo projectInfo = projects.get(stored.rule().funding().projectId());
        Map<String, Object> project = projectInfo == null ? null : namedProject(projectInfo);
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("intention", intentionJson(stored));
        var state = Intentions.intentionStateOf(rule.countsFrom(), rule.endsOn(), today.toString());
        Double elapsed =
            Intentions.intentionTimeElapsedOf(rule.countsFrom(), rule.endsOn(), today.toString());
        value.put("state", state.name());
        value.put("timeElapsed", elapsed);
        value.put("daysToStart",
            Math.max(0,
                (int) java.time.temporal.ChronoUnit.DAYS.between(today, LocalDate.parse(rule.countsFrom()))));
        value.put("daysLeft",
            rule.endsOn() == null
                ? null
                : Math.max(0,
                      (int) java.time.temporal.ChronoUnit.DAYS.between(today, LocalDate.parse(rule.endsOn()))
                          + 1));
        value.put("evenPace",
            state == Intentions.IntentionState.Running && rule.targetPages() != null ? elapsed : null);
        TargetVerdict verdict = Intentions.targetVerdictOf(
            rule, counted.plannedPages(), counted.deliveredPages(), today.toString());
        value.put("verdict", verdict == null ? null : verdict.wireName());
        value.put("pagesPerWeekNeeded",
            Intentions.pagesPerWeekNeededOf(rule, counted.deliveredPages(), today.toString()));
        value.put("catchUpPages",
            Intentions.catchUpPagesOf(
                rule, counted.plannedPages(), counted.deliveredPages(), today.toString()));
        value.put("plannedPages", counted.plannedPages());
        value.put("deliveredPages", counted.deliveredPages());
        value.put("outputPages", counted.outputPages());
        value.put("noDateCount", counted.noDateCount());
        value.put("noPagesCount", counted.noPagesCount());
        value.put("project", project);
        value.put("scope",
            rule.scopeCategoryId() == null ? null : scope(data.rules().categories(), rule.scopeCategoryId()));
        value.put(
            "mix", distribution == null ? null : namedMix(data, distribution.id(), distribution.revision()));
        MixReading reading = distribution == null ? null : reading(stored, distribution, counted, data);
        value.put("mixRows", mixRows(stored, distribution, reading, counted, data));
        value.put("unallocated", reading == null ? 0 : reading.unallocated());
        value.put("outOfBandCount", reading == null ? 0 : reading.outOfBandCount());
        value.put("fill", fill(stored, distribution, counted, data));
        value.put("lists", lists(counted, data));
        return value;
    }

    private MixReading reading(StoredIntention stored, StoredDistribution distribution, IntentionCount count,
        CountingSnapshot data) {
        List<Category> categories =
            Intentions.mixCategoriesOf(data.rules().categories(), stored.rule().scopeCategoryId());
        List<Intentions.MixRow> rows = new ArrayList<>();
        for (Category category : categories) {
            int outputPages = pagesUnder(category.id(), count.output(), data);
            Double intended = Intentions.shareWithinOf(data.rules().categories(),
                distribution.countingShares(), stored.rule().scopeCategoryId(), category.id());
            Double actual =
                count.outputPages() == 0 ? null : outputPages / (double) count.outputPages() * 100;
            Double drift = intended == null || actual == null ? null : actual - intended;
            String flag = intended != null && intended == 0 && outputPages > 0 ? "excludedUsed"
                : intended == null                                             ? "noShare"
                : drift == null                                                ? null
                : Math.abs(drift) <= 5                                         ? "inBand"
                : drift > 0                                                    ? "over"
                                                                               : "under";
            Double plannedShare = count.plannedPages() == 0
                ? null
                : pagesUnder(category.id(), count.planned(), data) / (double) count.plannedPages() * 100;
            rows.add(new Intentions.MixRow(
                category.id(), intended, plannedShare, actual, outputPages, drift, flag));
        }
        double allocated =
            categories.stream()
                .mapToDouble(
                    category -> distribution.countingShares().shares().getOrDefault(category.id(), 0.0))
                .sum();
        int outOfBand = (int) rows.stream()
                            .filter(row
                                -> "over".equals(row.flag()) || "under".equals(row.flag())
                                    || "excludedUsed".equals(row.flag()))
                            .count();
        return new MixReading(
            List.copyOf(rows), categories.isEmpty() ? 0 : Math.max(0, 100 - allocated), outOfBand);
    }

    private List<Map<String, Object>> mixRows(StoredIntention stored, StoredDistribution distribution,
        MixReading reading, IntentionCount counted, CountingSnapshot data) {
        List<Map<String, Object>> rows = new ArrayList<>();
        List<Category> categories =
            Intentions.mixCategoriesOf(data.rules().categories(), stored.rule().scopeCategoryId());
        for (Category category : categories) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("categoryId", category.id());
            row.put("name", category.name());
            if (reading == null) {
                row.put("intended", null);
                row.put("planned",
                    counted.plannedPages() == 0 ? null : pageShare(category.id(), counted.planned(), data));
                row.put("output",
                    counted.outputPages() == 0 ? null : pageShare(category.id(), counted.output(), data));
                row.put("outputPages", pagesUnder(category.id(), counted.output(), data));
                row.put("drift", null);
                row.put("flag", null);
            } else {
                var match = reading.rows()
                                .stream()
                                .filter(candidate -> candidate.categoryId().equals(category.id()))
                                .findFirst()
                                .orElseThrow();
                row.put("intended", match.intended());
                row.put("planned", match.planned());
                row.put("output", match.output());
                row.put("outputPages", match.outputPages());
                row.put("drift", match.drift());
                row.put("flag", match.flag());
            }
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, Object>> fill(StoredIntention stored, StoredDistribution distribution,
        IntentionCount count, CountingSnapshot data) {
        if (stored.rule().targetPages() == null) {
            return List.of();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        if (distribution == null) {
            for (Category category : Categories.leavesOf(data.rules().categories())) {
                if (stored.rule().scopeCategoryId() != null
                    && !Categories.isInSubtree(
                        data.rules().categories(), category.id(), stored.rule().scopeCategoryId())) {
                    continue;
                }
                Map<String, Object> row = fillRow(category.id(), null, null, false, stored, count, data);
                result.add(row);
            }
            return result;
        }
        return Intentions
            .fillOf(data.rules().categories(), distribution.countingShares(), stored.rule().scopeCategoryId(),
                stored.rule().targetPages(), selected(count.planned(), data.rules()),
                selected(count.delivered(), data.rules()), data.pagesOf())
            .stream()
            .map(row
                -> fillRow(
                    row.categoryId(), row.share(), row.targetPages(), row.isShort(), stored, count, data))
            .toList();
    }

    private Map<String, Object> fillRow(String categoryId, Double share, Integer target, boolean shortFill,
        StoredIntention stored, IntentionCount count, CountingSnapshot data) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("categoryId", categoryId);
        List<Category> path = Categories.categoryPathOf(data.rules().categories(), categoryId);
        int scopeIndex = -1;
        for (int i = 0; i < path.size(); i++) {
            if (Objects.equals(path.get(i).id(), stored.rule().scopeCategoryId())) {
                scopeIndex = i;
                break;
            }
        }
        List<String> names =
            path.subList(Math.max(0, scopeIndex + 1), path.size()).stream().map(Category::name).toList();
        if (names.isEmpty() && !path.isEmpty()) {
            names = List.of(path.get(path.size() - 1).name());
        }
        row.put("path", names);
        row.put("share", share);
        row.put("targetPages", target);
        row.put("plannedPages", pagesExact(categoryId, count.planned(), data));
        row.put("deliveredPages", pagesExact(categoryId, count.delivered(), data));
        row.put("isShort", shortFill);
        return row;
    }

    private List<Map<String, Object>> lists(IntentionCount count, CountingSnapshot data) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (var list : data.rules().lists()) {
            List<Iteration> items = selected(count.planned(), data.rules())
                                        .stream()
                                        .filter(item -> Objects.equals(item.listId(), list.id()))
                                        .toList();
            if (!items.isEmpty()) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", list.id());
                row.put("name", list.name());
                row.put("itemCount", items.size());
                row.put("pages",
                    items.stream()
                        .map(data.pagesOf())
                        .filter(Objects::nonNull)
                        .mapToInt(Integer::intValue)
                        .sum());
                result.add(row);
            }
        }
        return result;
    }

    private Map<String, Object> mixTree(StoredIntention stored, StoredDistribution distribution,
        CountingSnapshot data, boolean includeOutput) {
        IntentionCount counted =
            includeOutput ? Intentions.countIntention(stored.rule(), data.rules()) : null;
        List<Iteration> output = counted == null ? List.of() : selected(counted.output(), data.rules());
        int outputPages = counted == null ? 0 : counted.outputPages();
        Map<String, Object> tree = new LinkedHashMap<>();
        SiblingSet rootSet = stored.rule().scopeCategoryId() == null
            ? siblingSetOf(data.rules().categories(), distribution.countingShares().shares(), null)
            : new SiblingSet(0, List.of());
        tree.put("unallocated", rootSet.unallocated());
        tree.put("noShareIds", rootSet.noShareIds());
        tree.put("mixId", distribution.id());
        tree.put("mixName", distribution.name());
        tree.put("intention", intentionJson(stored));
        tree.put("outputPages", outputPages);
        List<Map<String, Object>> nodes = new ArrayList<>();
        for (Category category : data.rules().categories()) {
            boolean inScope = stored.rule().scopeCategoryId() == null
                || Categories.isInSubtree(
                    data.rules().categories(), category.id(), stored.rule().scopeCategoryId());
            boolean belowScope = inScope && !category.id().equals(stored.rule().scopeCategoryId());
            Map<String, Object> node = new LinkedHashMap<>();
            SiblingSet sibling = inScope ? siblingSetOf(data.rules().categories(),
                                               distribution.countingShares().shares(), category.id())
                                         : new SiblingSet(0, List.of());
            node.put("unallocated", sibling.unallocated());
            node.put("noShareIds", sibling.noShareIds());
            node.put("categoryId", category.id());
            node.put("share", belowScope ? distribution.countingShares().shares().get(category.id()) : null);
            node.put("ofWhole",
                inScope ? Intentions.shareWithinOf(data.rules().categories(), distribution.countingShares(),
                              stored.rule().scopeCategoryId(), category.id())
                        : null);
            node.put("actual",
                !inScope || outputPages == 0
                    ? null
                    : pagesUnder(category.id(), counted.output(), data) / (double) outputPages * 100);
            nodes.add(node);
        }
        tree.put("nodes", nodes);
        return tree;
    }

    private boolean visible(HeldScopes scopes, StoredIntention intention, Map<String, ProjectInfo> projects) {
        if (intention.projectId() != null) {
            ProjectInfo info = projects.get(intention.projectId());
            if (info != null && "Proposed".equals(info.state())) {
                return false;
            }
        }
        if (intention.rule().funding().kind().equals("project")) {
            String projectId = intention.rule().funding().projectId();
            if (scopes.scopesOf("intention.read").contains("any")) {
                return true;
            }
            ProjectInfo info = projects.get(projectId);
            return info != null
                && scopes.reachesProject(
                    "intention.read", info.managerId(), info.memberIds(), info.memberGroupIds());
        }
        return scopes.scopesOf("intention.read").contains("any");
    }

    private boolean canEdit(HeldScopes scopes, StoredIntention intention, Map<String, ProjectInfo> projects) {
        if (!intention.rule().funding().kind().equals("project")) {
            return scopes.scopesOf("intention.edit").contains("any");
        }
        if (scopes.scopesOf("intention.edit").contains("any")) {
            return true;
        }
        ProjectInfo project = projects.get(intention.rule().funding().projectId());
        return project != null
            && scopes.reachesProject(
                "intention.edit", project.managerId(), project.memberIds(), project.memberGroupIds());
    }

    private Map<String, Object> namedProject(ProjectInfo row) {
        Map<String, Object> project = new LinkedHashMap<>();
        project.put("id", row.id());
        project.put("name", row.name());
        return project;
    }

    private Map<String, Object> intentionJson(StoredIntention stored) {
        Intention rule = stored.rule();
        Map<String, Object> intention = new LinkedHashMap<>();
        intention.put("id", rule.id());
        intention.put("name", stored.name());
        intention.put("description", stored.description());
        intention.put("funding", funding(rule.funding().kind(), rule.funding().projectId()));
        intention.put("projectId", stored.projectId());
        intention.put("scopeCategoryId", rule.scopeCategoryId());
        if (!rule.scopeConditions().isEmpty()) {
            intention.put("scopeConditions", rule.scopeConditions().stream()
                .map(IntentionReads::propertyConditionJson).toList());
        }
        intention.put("distributionId", stored.distributionId());
        if (stored.mixRevision() != null) {
            intention.put("mixRevision", stored.mixRevision());
        }
        intention.put("targetPages", rule.targetPages());
        intention.put("countsFrom", rule.countsFrom());
        intention.put("endsOn", rule.endsOn());
        intention.put("isOverall", rule.isOverall());
        intention.put("templateId", stored.templateId());
        String actorKind = stored.archivedActorKind();
        String actorId = stored.archivedActorUserId();
        Map<String, Object> actor = new LinkedHashMap<>();
        if (actorKind != null) {
            actor.put("kind", actorKind);
            if ("user".equals(actorKind)) {
                actor.put("userId", actorId);
            }
        }
        Map<String, Object> archived = new LinkedHashMap<>();
        if (rule.archivedAt() != null) {
            archived.put("actor", actor);
            archived.put("at", Instants.format(Instant.parse(rule.archivedAt())));
        }
        intention.put("archived", rule.archivedAt() == null ? null : archived);
        return intention;
    }

    private static Map<String, Object> propertyConditionJson(PropertyCondition condition) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("key", condition.key());
        if (condition.hasNoValue() != null) value.put("hasNoValue", condition.hasNoValue());
        if (condition.contains() != null) value.put("contains", condition.contains());
        if (condition.startsWith() != null) value.put("startsWith", condition.startsWith());
        if (condition.endsWith() != null) value.put("endsWith", condition.endsWith());
        if (condition.numberRange() != null) value.put("numberRange", condition.numberRange());
        if (condition.dayRange() != null) value.put("dayRange", condition.dayRange());
        if (condition.anyOf() != null) value.put("anyOf", condition.anyOf());
        return value;
    }

    private Map<String, Object> scope(List<Category> categories, String categoryId) {
        Map<String, Object> scope = new LinkedHashMap<>();
        scope.put("id", categoryId);
        scope.put(
            "path", Categories.categoryPathOf(categories, categoryId).stream().map(Category::name).toList());
        return scope;
    }

    private Object funding(String kind, String projectId) {
        Map<String, Object> funding = new LinkedHashMap<>();
        funding.put("kind", kind);
        if (kind.equals("project")) {
            funding.put("projectId", projectId);
        }
        return funding;
    }

    private Map<String, Object> namedMix(CountingSnapshot data, String mixId) {
        StoredMix mix =
            data.mixes().stream().filter(candidate -> candidate.id().equals(mixId)).findFirst().orElse(null);
        return mix == null ? null : namedMix(data, mix.id(), mix.revision());
    }

    private Map<String, Object> namedTemplateMix(CountingSnapshot data, String mixId) {
        StoredMix mix =
            data.mixes().stream().filter(candidate -> candidate.id().equals(mixId)).findFirst().orElse(null);
        if (mix == null) {
            return null;
        }
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", mix.id());
        value.put("name", mix.name());
        return value;
    }

    private Map<String, Object> namedMix(CountingSnapshot data, String mixId, int revision) {
        StoredMix mix =
            data.mixes().stream().filter(candidate -> candidate.id().equals(mixId)).findFirst().orElseThrow();
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", mix.id());
        value.put("name", mix.name());
        value.put("revision", revision);
        return value;
    }

    private Map<String, Object> jsonMap(JSONB json) {
        try {
            return mapper.readValue(json.data(), new TypeReference<>() {});
        } catch (JacksonException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private List<?> jsonList(JSONB json) {
        if (json == null) {
            return List.of();
        }
        try {
            return mapper.readValue(json.data(), new TypeReference<>() {});
        } catch (JacksonException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private List<Map<String, Object>> categoryRows(List<Category> categories) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Category category : categories) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", category.id());
            row.put("name", category.name());
            row.put("parentId", category.parentId());
            rows.add(row);
        }
        return rows;
    }

    private String categoryName(List<Category> categories, String id) {
        return categories.stream()
            .filter(category -> category.id().equals(id))
            .map(Category::name)
            .findFirst()
            .orElse(id);
    }

    private StoredIntention find(CountingSnapshot data, String id) {
        return data.intentions()
            .stream()
            .filter(intention -> intention.rule().id().equals(id))
            .findFirst()
            .orElse(null);
    }

    private Map<String, ProjectInfo> projects() {
        Map<String, ProjectInfo> result = new LinkedHashMap<>();
        dsl.selectFrom(PROJECTS)
            .orderBy(PROJECTS.POSITION)
            .fetch()
            .forEach(row
                -> result.put(row.getId(),
                    new ProjectInfo(row.getId(), row.getName(), row.getState(), row.getManagerId(),
                        new ArrayList<>(), new ArrayList<>())));
        List<String> ids = List.copyOf(result.keySet());
        if (ids.isEmpty()) {
            return result;
        }
        dsl.select(PROJECT_MEMBERS.PROJECT_ID, PROJECT_MEMBERS.USER_ID)
            .from(PROJECT_MEMBERS)
            .where(PROJECT_MEMBERS.PROJECT_ID.in(ids))
            .orderBy(PROJECT_MEMBERS.PROJECT_ID, PROJECT_MEMBERS.POSITION)
            .fetch()
            .forEach(row
                -> result.get(row.get(PROJECT_MEMBERS.PROJECT_ID))
                    .memberIds()
                    .add(row.get(PROJECT_MEMBERS.USER_ID)));
        dsl.select(PROJECT_MEMBER_GROUPS.PROJECT_ID, PROJECT_MEMBER_GROUPS.GROUP_ID)
            .from(PROJECT_MEMBER_GROUPS)
            .where(PROJECT_MEMBER_GROUPS.PROJECT_ID.in(ids))
            .orderBy(PROJECT_MEMBER_GROUPS.PROJECT_ID, PROJECT_MEMBER_GROUPS.POSITION)
            .fetch()
            .forEach(row
                -> result.get(row.get(PROJECT_MEMBER_GROUPS.PROJECT_ID))
                    .memberGroupIds()
                    .add(row.get(PROJECT_MEMBER_GROUPS.GROUP_ID)));
        return result;
    }

    private List<Iteration> selected(List<String> ids, CountingData data) {
        return data.iterations().stream().filter(item -> ids.contains(item.id())).toList();
    }

    private int pagesUnder(String categoryId, List<String> ids, CountingSnapshot data) {
        return selected(ids, data.rules())
            .stream()
            .filter(item -> Categories.isInSubtree(data.rules().categories(), item.categoryId(), categoryId))
            .map(data.pagesOf())
            .filter(Objects::nonNull)
            .mapToInt(Integer::intValue)
            .sum();
    }

    private double pageShare(String categoryId, List<String> ids, CountingSnapshot data) {
        int total = selected(ids, data.rules())
                        .stream()
                        .map(data.pagesOf())
                        .filter(Objects::nonNull)
                        .mapToInt(Integer::intValue)
                        .sum();
        return total == 0 ? 0 : pagesUnder(categoryId, ids, data) * 100.0 / total;
    }

    private int pagesExact(String categoryId, List<String> ids, CountingSnapshot data) {
        return selected(ids, data.rules())
            .stream()
            .filter(item -> item.categoryId().equals(categoryId))
            .map(data.pagesOf())
            .filter(Objects::nonNull)
            .mapToInt(Integer::intValue)
            .sum();
    }

    private Map<String, Integer> readyUnder(CountingSnapshot data, Map<String, Integer> byCategory) {
        Map<String, Integer> result = new LinkedHashMap<>();
        for (Category category : data.rules().categories()) {
            int pages =
                data.rules()
                    .categories()
                    .stream()
                    .filter(
                        child -> Categories.isInSubtree(data.rules().categories(), child.id(), category.id()))
                    .mapToInt(child -> byCategory.getOrDefault(child.id(), 0))
                    .sum();
            result.put(category.id(), pages);
        }
        return result;
    }

    private String nullable(JsonNode node) {
        return node == null || node.isNull() ? null : node.asString();
    }

    private DistributionChoice chosenMix(JsonNode choice, CountingSnapshot data) {
        String kind = choice.path("kind").asString();
        if (kind.equals("none")) {
            return new DistributionChoice(null);
        }
        StoredMix mix;
        Integer revision = null;
        if (kind.equals("primary")) {
            mix = data.mixes()
                      .stream()
                      .filter(candidate
                          -> candidate.archivedAt() == null
                              && dsl.select(MIXES.IS_PRIMARY)
                                  .from(MIXES)
                                  .where(MIXES.ID.eq(candidate.id()))
                                  .fetchOne(MIXES.IS_PRIMARY))
                      .findFirst()
                      .orElse(null);
        } else {
            String mixId = choice.path("mixId").asString();
            mix = data.mixes()
                      .stream()
                      .filter(candidate -> candidate.id().equals(mixId))
                      .findFirst()
                      .orElse(null);
            if (choice.has("revision") && !choice.path("revision").isNull()) {
                revision = choice.path("revision").asInt();
            }
        }
        if (mix == null) {
            return new DistributionChoice(null);
        }
        if (revision == null) {
            return new DistributionChoice(new Distribution(mix.shares()));
        }
        int selectedRevision = revision;
        return new DistributionChoice(mix.revisions()
                .stream()
                .filter(row -> row.revision() == selectedRevision)
                .findFirst()
                .map(row -> new Distribution(row.shares()))
                .orElse(null));
    }

    private record DistributionChoice(Distribution distribution) {}

    private record ProjectInfo(String id, String name, String state, String managerId, List<String> memberIds,
        List<String> memberGroupIds) {}
}
