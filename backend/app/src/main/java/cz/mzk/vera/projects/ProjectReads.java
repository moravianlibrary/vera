package cz.mzk.vera.projects;

import static cz.mzk.vera.db.tables.Tables.DOCUMENT_STATES;
import static cz.mzk.vera.db.tables.Tables.DIGITIZATION_LISTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.GROUPS;
import static cz.mzk.vera.db.tables.Tables.GROUP_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.PROJECTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.countDistinct;
import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.inline;
import static org.jooq.impl.DSL.sum;
import static org.jooq.impl.DSL.when;

import cz.mzk.vera.documents.DocumentRecords;
import cz.mzk.vera.documents.ProjectQueries;
import cz.mzk.vera.domain.entities.DigitizationList;
import cz.mzk.vera.domain.entities.Intention;
import cz.mzk.vera.domain.intentions.Intentions;
import cz.mzk.vera.domain.intentions.Intentions.IntentionCount;
import cz.mzk.vera.domain.lists.Lists;
import cz.mzk.vera.domain.projects.Projects;
import cz.mzk.vera.intentions.CountingReads;
import cz.mzk.vera.intentions.CountingReads.CountingSnapshot;
import cz.mzk.vera.intentions.CountingReads.StoredIntention;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import cz.mzk.vera.web.Instants;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// VIEW-projects; PROJECT-members; PLAN-counting: build project read models from stored rows.
@Repository
public class ProjectReads {
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final ProjectQueries projects;
    private final CountingReads counting;
    private final DocumentRecords records;
    private final Clock clock;
    private final JsonMapper mapper;

    public ProjectReads(DSLContext dsl, HeldAccessQueries access, ProjectQueries projects,
            CountingReads counting, DocumentRecords records, Clock clock, JsonMapper mapper) {
        this.dsl = dsl;
        this.access = access;
        this.projects = projects;
        this.counting = counting;
        this.records = records;
        this.clock = clock;
        this.mapper = mapper;
    }

    public boolean canRead(String userId) {
        return access.scopesHeldBy(userId).hasPermission("project.read");
    }

    public List<Map<String, Object>> projects() {
        List<String> ids = dsl.select(PROJECTS.ID)
                .from(PROJECTS)
                .orderBy(PROJECTS.POSITION)
                .fetch(PROJECTS.ID);
        Map<String, Map<String, Object>> rows = projects.projectsOf(ids);
        return ids.stream().map(rows::get).toList();
    }

    public Map<String, Object> overview(String userId, Map<String, String> params) {
        HeldScopes scopes = access.scopesHeldBy(userId);
        List<Map<String, Object>> visible = visibleProjects(userId, scopes);
        List<Map<String, Object>> base = new ArrayList<>();
        CountingSnapshot data = counting.countingData();
        RowStats stats = rowStats(projectIds(visible));
        Map<String, Map<String, Object>> memberGroups = memberGroups(visible);
        for (Map<String, Object> project : visible) {
            base.add(row(project, data, stats, memberGroups));
        }
        base.removeIf(row -> !matchesBase(row, params));

        List<Map<String, Object>> rows = base.stream()
                .filter(row -> matches(row, params))
                .toList();
        List<Map<String, Object>> stateRows = base.stream()
                .filter(row -> matchesExcept(row, params, "state"))
                .toList();
        List<Map<String, Object>> periodRows = base.stream()
                .filter(row -> matchesExcept(row, params, "period"))
                .toList();
        List<Map<String, Object>> paceRows = base.stream()
                .filter(row -> matchesExcept(row, params, "pace"))
                .toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("rows", rows);
        result.put("total", rows.size());
        Map<String, Object> facets = new LinkedHashMap<>();
        facets.put("states", facet(stateRows, "state", List.of("Proposed", "Approved", "Rejected")));
        facets.put("periods", facet(periodRows, "period", List.of("Upcoming", "Active", "Ended")));
        facets.put("paces", paceFacet(paceRows));
        result.put("facets", facets);
        return result;
    }

    public Map<String, Object> detail(String userId, String projectId) {
        HeldScopes scopes = access.scopesHeldBy(userId);
        List<Map<String, Object>> visible = visibleProjects(userId, scopes);
        Map<String, Object> project = visible.stream().filter(row -> projectId.equals(row.get("id")))
                .findFirst().orElse(null);
        if (project == null) {
            return null;
        }
        List<Map<String, Object>> selected = List.of(project);
        return detail(project, counting.countingData(), rowStats(projectIds(selected)),
                memberGroups(selected));
    }

    public Map<String, Object> projectIntention(String projectId) {
        StoredIntention intention = counting.intentionOf(counting.countingData(), projectId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", intention.rule().id());
        result.put("targetPages", intention.rule().targetPages());
        return result;
    }

    public Map<String, Object> previewCounts(String projectId, String startsOn, String endsOn,
            Integer targetPages) {
        CountingSnapshot data = counting.countingData();
        StoredIntention stored = counting.intentionOf(data, projectId);
        var rule = new Intention(stored.rule().id(), stored.rule().funding(),
                stored.rule().scopeCategoryId(), stored.rule().scopeConditions(), startsOn, endsOn,
                targetPages, stored.rule().isOverall(), stored.rule().archivedAt());
        IntentionCount count = Intentions.countIntention(rule, data.rules());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("plannedPages", count.plannedPages());
        result.put("deliveredPages", count.deliveredPages());
        return result;
    }

    private List<Map<String, Object>> visibleProjects(String userId, HeldScopes scopes) {
        List<String> ids = dsl.select(PROJECTS.ID)
                .from(PROJECTS)
                .orderBy(PROJECTS.POSITION)
                .fetch(PROJECTS.ID);
        Map<String, Map<String, Object>> all = projects.projectsOf(ids);
        if (!scopes.hasPermission("project.read")) {
            return List.of();
        }
        return ids.stream()
                .map(all::get)
                .filter(project -> scopes.reachesProject("project.read",
                        (String) project.get("managerId"),
                        strings(project.get("memberIds")), strings(project.get("memberGroupIds"))))
                .toList();
    }

    private Map<String, Object> row(Map<String, Object> project, CountingSnapshot data, RowStats stats,
            Map<String, Map<String, Object>> availableGroups) {
        String id = (String) project.get("id");
        StoredIntention intention = counting.intentionOf(data, id);
        IntentionCount figures = Intentions.countIntention(intention.rule(), data.rules());
        LocalDate today = LocalDate.now(clock);
        String start = (String) project.get("startsOn");
        String end = (String) project.get("endsOn");
        String period = Projects.periodOf(start, end, today.toString()).name();
        String state = (String) project.get("state");
        Integer target = intention.rule().targetPages();
        var verdict = "Approved".equals(state) ? Intentions.targetVerdictOf(intention.rule(),
                figures.plannedPages(), figures.deliveredPages(), today.toString()) : null;
        Double elapsed = "Approved".equals(state) && target != null
                && Intentions.intentionStateOf(intention.rule().countsFrom(), intention.rule().endsOn(),
                        today.toString()) == Intentions.IntentionState.Running
                ? Intentions.intentionTimeElapsedOf(intention.rule().countsFrom(), intention.rule().endsOn(),
                        today.toString()) : null;
        ProjectCounts counts = stats.counts().getOrDefault(id, ProjectCounts.EMPTY);
        List<Map<String, Object>> memberGroups = strings(project.get("memberGroupIds")).stream()
                .filter(availableGroups::containsKey).map(availableGroups::get).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("project", project);
        result.put("intention", nullableIntention(intention.rule().id(), target));
        result.put("period", period);
        result.put("timeElapsed", Projects.timeElapsedOf(start, end, today.toString()));
        result.put("daysToStart", Math.max(0, Projects.daysUntil(start, today.toString())));
        result.put("daysLeft", Math.max(0, Projects.daysUntil(end, today.toString()) + 1));
        result.put("evenPace", elapsed);
        result.put("verdict", verdict == null ? null : verdict.wireName());
        result.put("fundedCount", counts.funded());
        result.put("plannedPages", figures.plannedPages());
        result.put("deliveredPages", figures.deliveredPages());
        Map<String, Object> waiting = new LinkedHashMap<>();
        waiting.put("itemCount", counts.waiting());
        waiting.put("pages", counts.waitingPages());
        result.put("waiting", waiting);
        Map<String, Object> pending = new LinkedHashMap<>();
        pending.put("documentCount", counts.pending());
        pending.put("withCopyCount", counts.withCopy());
        result.put("pending", pending);
        result.put("proposalCount", counts.proposals());
        result.put("listCount", counts.listCount());
        result.put("memberGroups", memberGroups);
        return result;
    }

    private Map<String, Object> nullableIntention(String id, Integer target) {
        Map<String, Object> intention = new LinkedHashMap<>();
        intention.put("id", id);
        intention.put("targetPages", target);
        return intention;
    }

    private RowStats rowStats(List<String> projectIds) {
        if (projectIds.isEmpty()) {
            return new RowStats(Map.of());
        }
        var waiting = ITERATIONS.CANCELLATION_CAUSE.isNull()
                .and(ITERATIONS.PROGRESS.notIn("Digitized", "Published"))
                .and(ITERATIONS.LIST_ID.isNull().or(ITERATIONS.PROGRESS.eq("Ready")
                        .or(ITERATIONS.PROGRESS.eq("Enqueued")).or(ITERATIONS.PROGRESS.eq("IngestFailed"))));
        Map<String, ProjectCounts> values = new LinkedHashMap<>();
        var waitingCount = sum(when(waiting, 1).otherwise(0));
        var waitingPages = coalesce(sum(when(waiting, DOCUMENT_STATES.PAGE_COUNT).otherwise(0)), inline(0));
        var listCount = countDistinct(ITERATIONS.LIST_ID);
        dsl.select(ITERATIONS.PROJECT_ID, count(), waitingCount, waitingPages, listCount)
                .from(ITERATIONS.leftJoin(DOCUMENT_STATES)
                        .on(DOCUMENT_STATES.DOCUMENT_ID.eq(ITERATIONS.DOCUMENT_ID)))
                .where(ITERATIONS.PROJECT_ID.in(projectIds)).groupBy(ITERATIONS.PROJECT_ID).fetch()
                .forEach(row -> values.put(row.get(ITERATIONS.PROJECT_ID), new ProjectCounts(row.get(count()),
                        row.get(waitingCount).intValue(), row.get(waitingPages).intValue(), 0, 0, 0,
                        row.get(listCount))));
        var pendingDocs = countDistinct(when(REQUESTS.DECISION.eq("Pending"), REQUESTS.DOCUMENT_ID));
        dsl.select(REQUESTS.PROJECT_ID, count(), pendingDocs).from(REQUESTS)
                .where(REQUESTS.PROJECT_ID.in(projectIds)).groupBy(REQUESTS.PROJECT_ID).fetch()
                .forEach(row -> {
                    ProjectCounts current = values.getOrDefault(
                            row.get(REQUESTS.PROJECT_ID), ProjectCounts.EMPTY);
                    values.put(row.get(REQUESTS.PROJECT_ID), new ProjectCounts(
                            current.funded(), current.waiting(), current.waitingPages(), row.get(count()),
                            row.get(pendingDocs), current.withCopy(), current.listCount()));
                });
        var copyDocs = countDistinct(REQUESTS.DOCUMENT_ID);
        dsl.select(REQUESTS.PROJECT_ID, copyDocs).from(REQUESTS)
                .join(REQUEST_EXISTING_COPIES).on(REQUEST_EXISTING_COPIES.REQUEST_ID.eq(REQUESTS.ID))
                .where(REQUESTS.PROJECT_ID.in(projectIds).and(REQUESTS.DECISION.eq("Pending")))
                .groupBy(REQUESTS.PROJECT_ID).fetch().forEach(row -> {
                    ProjectCounts current = values.getOrDefault(
                            row.get(REQUESTS.PROJECT_ID), ProjectCounts.EMPTY);
                    values.put(row.get(REQUESTS.PROJECT_ID), new ProjectCounts(
                            current.funded(), current.waiting(), current.waitingPages(), current.proposals(),
                            current.pending(), row.get(copyDocs), current.listCount()));
                });
        return new RowStats(values);
    }

    private Map<String, Map<String, Object>> memberGroups(List<Map<String, Object>> projects) {
        List<String> ids = projects.stream()
                .flatMap(project -> strings(project.get("memberGroupIds")).stream())
                .distinct().toList();
        Map<String, Map<String, Object>> groups = new LinkedHashMap<>();
        dsl.select(GROUPS.ID, GROUPS.NAME, count(GROUP_MEMBERS.USER_ID)).from(GROUPS)
                .leftJoin(GROUP_MEMBERS).on(GROUP_MEMBERS.GROUP_ID.eq(GROUPS.ID))
                .where(GROUPS.ID.in(ids)).groupBy(GROUPS.ID, GROUPS.NAME).fetch().forEach(row -> {
                    Map<String, Object> group = new LinkedHashMap<>();
                    group.put("id", row.get(GROUPS.ID));
                    group.put("name", row.get(GROUPS.NAME));
                    group.put("peopleCount", row.get(count(GROUP_MEMBERS.USER_ID)));
                    groups.put(row.get(GROUPS.ID), group);
                });
        return groups;
    }

    private List<String> projectIds(List<Map<String, Object>> projects) {
        return projects.stream().map(project -> (String) project.get("id")).toList();
    }

    private record RowStats(Map<String, ProjectCounts> counts) {}

    private record ProjectCounts(int funded, int waiting, int waitingPages, int proposals,
            int pending, int withCopy, int listCount) {
        private static final ProjectCounts EMPTY = new ProjectCounts(0, 0, 0, 0, 0, 0, 0);
    }

    private boolean matchesBase(Map<String, Object> row, Map<String, String> p) {
        String search = p.get("q");
        if (search != null && !search.isBlank()) {
            Map<?, ?> project = (Map<?, ?>) row.get("project");
            String needle = search.trim().toLowerCase();
            if (!String.valueOf(project.get("name")).toLowerCase().contains(needle)
                    && !String.valueOf(project.get("description")).toLowerCase().contains(needle)) {
                return false;
            }
        }
        return matchesDates(row, p.get("dates")) && matchesRange(row, p.get("elapsed"), "timeElapsed")
                && matchesRange(row, p.get("delivered"), "deliveredPages");
    }

    private boolean matchesDates(Map<String, Object> row, String range) {
        if (range == null) {
            return true;
        }
        String[] bounds = range.split("\\.\\.", -1);
        String start = (String) ((Map<?, ?>) row.get("project")).get("startsOn");
        String end = (String) ((Map<?, ?>) row.get("project")).get("endsOn");
        return (bounds[0].isEmpty() || end.compareTo(bounds[0]) >= 0)
                && (bounds.length < 2 || bounds[1].isEmpty() || start.compareTo(bounds[1]) <= 0);
    }

    private boolean matchesRange(Map<String, Object> row, String range, String key) {
        if (range == null) {
            return true;
        }
        String[] bounds = range.split("\\.\\.", -1);
        double value = ((Number) row.get(key)).doubleValue();
        double percent = key.equals("timeElapsed") ? Math.round(value * 100) : value;
        return (bounds[0].isEmpty() || percent >= Double.parseDouble(bounds[0]))
                && (bounds.length < 2 || bounds[1].isEmpty() || percent <= Double.parseDouble(bounds[1]));
    }

    private boolean matches(Map<String, Object> row, Map<String, String> p) {
        return matchesExcept(row, p, null);
    }

    private boolean matchesExcept(Map<String, Object> row, Map<String, String> p, String omitted) {
        if (!"state".equals(omitted)
                && !hasValue(p.get("state"), ((Map<?, ?>) row.get("project")).get("state"))) {
            return false;
        }
        if (!"period".equals(omitted) && !hasValue(p.get("period"), row.get("period"))) {
            return false;
        }
        if (!"pace".equals(omitted) && !paceMatches(p.get("pace"), row.get("verdict"))) {
            return false;
        }
        return true;
    }

    private boolean hasValue(String csv, Object value) {
        return csv == null || csv.isBlank() || List.of(csv.split(",")).contains(value);
    }

    private boolean paceMatches(String csv, Object verdict) {
        if (csv == null || csv.isBlank()) {
            return true;
        }
        return (csv.contains("BehindPace") && "behindPace".equals(verdict))
                || (csv.contains("OnTrack") && "onPace".equals(verdict));
    }

    private List<Map<String, Object>> facet(List<Map<String, Object>> rows, String key, List<String> order) {
        Map<String, Integer> counts = new HashMap<>();
        rows.forEach(row -> counts.merge("period".equals(key) ? row.get(key).toString()
                : ((Map<?, ?>) row.get("project")).get(key).toString(), 1, Integer::sum));
        return order.stream().filter(counts::containsKey)
                .map(value -> Map.<String, Object>of("value", value, "count", counts.get(value))).toList();
    }

    private List<Map<String, Object>> paceFacet(List<Map<String, Object>> rows) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (String value : List.of("BehindPace", "OnTrack")) {
            long count = rows.stream().filter(row -> value.equals("BehindPace")
                    ? "behindPace".equals(row.get("verdict")) : "onPace".equals(row.get("verdict"))).count();
            if (count > 0) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("value", value);
                item.put("count", count);
                result.add(item);
            }
        }
        return result;
    }

    private Map<String, Object> detail(Map<String, Object> project, CountingSnapshot data, RowStats stats,
            Map<String, Map<String, Object>> memberGroups) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("row", row(project, data, stats, memberGroups));
        detail.put("proposals", proposals((String) project.get("id")));
        List<Map<String, Object>> funded = funded((String) project.get("id"));
        detail.put("lists", lists(funded));
        detail.put("formerLists", formerLists(funded));
        detail.put("funded", funded);
        detail.put("log", projectLog((String) project.get("id")));
        return detail;
    }

    private List<Map<String, Object>> proposals(String projectId) {
        Map<String, Map<String, Object>> earliest = new LinkedHashMap<>();
        var asks = dsl.select(REQUESTS.DOCUMENT_ID, REQUESTS.REQUESTER_ID, REQUESTS.AT, REQUESTS.DECISION,
                REQUESTS.IS_AFTER_PROJECT_APPROVAL, REQUESTS.ID)
                .from(REQUESTS).where(REQUESTS.PROJECT_ID.eq(projectId))
                .fetch();
        asks.sort(Comparator.comparing((Record row) -> row.get(REQUESTS.AT))
                .thenComparingInt(row -> naturalSequence(row.get(REQUESTS.ID)))
                .thenComparing(row -> row.get(REQUESTS.ID)));
        List<String> documentIds = asks.stream()
                .map(row -> row.get(REQUESTS.DOCUMENT_ID))
                .distinct()
                .toList();
        Map<String, Map<String, Object>> documents = new HashMap<>();
        dsl.selectFrom(DOCUMENTS).where(DOCUMENTS.ID.in(documentIds)).fetch().forEach(document -> {
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("title", document.getTitle());
            value.put("identifier", document.getUnitValue() == null ? document.getCatalogId()
                    : document.getCatalogId() + " · " + document.getUnitValue());
            documents.put(document.getId(), value);
        });
        List<String> requestIds = asks.stream().map(row -> row.get(REQUESTS.ID)).toList();
        var requestsWithCopies = new HashSet<>(dsl.selectDistinct(REQUEST_EXISTING_COPIES.REQUEST_ID)
                .from(REQUEST_EXISTING_COPIES)
                .where(REQUEST_EXISTING_COPIES.REQUEST_ID.in(requestIds))
                .fetch(REQUEST_EXISTING_COPIES.REQUEST_ID));
        asks.forEach(row -> {
            String docId = row.get(REQUESTS.DOCUMENT_ID);
            if (!earliest.containsKey(docId) && documents.containsKey(docId)) {
                Map<String, Object> document = documents.get(docId);
                Map<String, Object> proposal = new LinkedHashMap<>();
                proposal.put("documentId", docId);
                proposal.put("title", document.get("title"));
                proposal.put("identifier", document.get("identifier"));
                proposal.put("requesterId", row.get(REQUESTS.REQUESTER_ID));
                proposal.put("at", Instants.format(row.get(REQUESTS.AT).toInstant()));
                proposal.put("decision", row.get(REQUESTS.DECISION));
                proposal.put("isAfterProjectApproval", "Pending".equals(row.get(REQUESTS.DECISION))
                        && Boolean.TRUE.equals(row.get(REQUESTS.IS_AFTER_PROJECT_APPROVAL)));
                proposal.put("hasCopy", requestsWithCopies.contains(row.get(REQUESTS.ID)));
                earliest.put(docId, proposal);
            }
        });
        return List.copyOf(earliest.values());
    }

    private int naturalSequence(String id) {
        int start = id.length();
        while (start > 0 && Character.isDigit(id.charAt(start - 1))) {
            start--;
        }
        return start == id.length() ? Integer.MAX_VALUE : Integer.parseInt(id.substring(start));
    }

    private List<Map<String, Object>> funded(String projectId) {
        List<String> iterationIds = dsl.select(ITERATIONS.ID).from(ITERATIONS)
                .where(ITERATIONS.PROJECT_ID.eq(projectId)).fetch(ITERATIONS.ID);
        iterationIds.sort(Comparator.comparingInt(this::naturalSequence));
        List<String> documentIds = dsl.selectDistinct(ITERATIONS.DOCUMENT_ID).from(ITERATIONS)
                .where(ITERATIONS.PROJECT_ID.eq(projectId)).fetch(ITERATIONS.DOCUMENT_ID);
        Map<String, Map<String, Object>> docRecords = records.recordsOf(documentIds);
        Map<String, Integer> pageCounts = new HashMap<>();
        dsl.select(DOCUMENT_STATES.DOCUMENT_ID, DOCUMENT_STATES.PAGE_COUNT).from(DOCUMENT_STATES)
                .where(DOCUMENT_STATES.DOCUMENT_ID.in(documentIds)).fetch().forEach(row -> {
                    pageCounts.put(row.get(DOCUMENT_STATES.DOCUMENT_ID), row.get(DOCUMENT_STATES.PAGE_COUNT));
                });
        Map<String, String> lists = new HashMap<>();
        dsl.select(DIGITIZATION_LISTS.ID, DIGITIZATION_LISTS.NAME)
                .from(DIGITIZATION_LISTS)
                .fetch()
                .forEach(row -> lists.put(
                        row.get(DIGITIZATION_LISTS.ID), row.get(DIGITIZATION_LISTS.NAME)));
        List<Map<String, Object>> result = new ArrayList<>();
        var fundedIterations = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.in(iterationIds)).fetch();
        fundedIterations.sort(Comparator.comparingInt(iteration -> naturalSequence(iteration.getId())));
        fundedIterations.forEach(iteration -> {
                    Map<String, Object> record = docRecords.get(iteration.getDocumentId());
                    if (record == null) {
                        return;
                    }
                    @SuppressWarnings("unchecked")
                    Map<String, Object> document = (Map<String, Object>) record.get("document");
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> its = (List<Map<String, Object>>) record.get("iterations");
                    Map<String, Object> wireIteration = its.stream()
                            .filter(candidate -> iteration.getId().equals(candidate.get("id")))
                            .findFirst()
                            .orElse(null);
                    if (wireIteration == null) {
                        return;
                    }
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("iteration", wireIteration);
                    item.put("document", document);
                    Integer pages = pageCounts.get(iteration.getDocumentId());
                    item.put("pages", pages);
                    item.put("listName", lists.getOrDefault(
                            iteration.getListId(), iteration.getFormerListName()));
                    result.add(item);
                });
        return result;
    }

    private List<Map<String, Object>> lists(List<Map<String, Object>> funded) {
        Map<String, List<Map<String, Object>>> byList = new LinkedHashMap<>();
        funded.forEach(item -> {
            @SuppressWarnings("unchecked")
            Map<String, Object> iteration = (Map<String, Object>) item.get("iteration");
            String listId = (String) iteration.get("listId");
            if (listId != null) {
                byList.computeIfAbsent(listId, ignored -> new ArrayList<>()).add(item);
            }
        });
        List<Map<String, Object>> result = new ArrayList<>();
        dsl.selectFrom(DIGITIZATION_LISTS).orderBy(DIGITIZATION_LISTS.POSITION).fetch().forEach(list -> {
                    List<Map<String, Object>> members = byList.get(list.getId());
                    if (members == null || members.isEmpty()) {
                        return;
                    }
                    Map<String, Object> value = new LinkedHashMap<>();
                    Map<String, Object> listValue = new LinkedHashMap<>();
                    listValue.put("id", list.getId());
                    listValue.put("name", list.getName());
                    listValue.put("startsOn", list.getStartsOn().toString());
                    listValue.put("endsOn", list.getEndsOn().toString());
                    listValue.put("targetPages", list.getTargetPages());
                    listValue.put("generated", list.getGenerated() == null
                            ? null : json(list.getGenerated().data()));
                    listValue.put("createdBy", list.getCreatedBy());
                    listValue.put("createdAt", Instants.format(list.getCreatedAt().toInstant()));
                    if (list.getDoneAt() == null) {
                        listValue.put("done", null);
                    } else {
                        Map<String, Object> done = new LinkedHashMap<>();
                        done.put("actorId", list.getDoneActorId());
                        done.put("at", Instants.format(list.getDoneAt().toInstant()));
                        listValue.put("done", done);
                    }
                    value.put("list", listValue);
                    DigitizationList stateInput = new DigitizationList(list.getId(), list.getName(),
                            list.getStartsOn().toString(), list.getEndsOn().toString(), list.getTargetPages(),
                            list.getDoneAt() == null ? null : list.getDoneAt().toInstant().toString());
                    value.put("state", Lists.listStateOf(stateInput, LocalDate.now(clock).toString()).name());
                    value.put("itemCount", members.size());
                    value.put("pages", members.stream().map(item -> (Integer) item.get("pages"))
                            .filter(Objects::nonNull).mapToInt(Integer::intValue).sum());
                    result.add(value);
                });
        return result;
    }

    private List<Map<String, Object>> formerLists(List<Map<String, Object>> funded) {
        Map<String, Integer> names = new LinkedHashMap<>();
        for (Map<String, Object> item : funded) {
            @SuppressWarnings("unchecked")
            Map<String, Object> iteration = (Map<String, Object>) item.get("iteration");
            if (iteration.get("listId") == null && iteration.get("formerListName") != null) {
                names.merge((String) iteration.get("formerListName"), 1, Integer::sum);
            }
        }
        return names.entrySet().stream().map(entry -> Map.<String, Object>of("name", entry.getKey(),
                "itemCount", entry.getValue())).toList();
    }

    private List<Map<String, Object>> projectLog(String id) {
        return dsl.selectFrom(EVENTS).where(EVENTS.SUBJECT_KIND.eq("project").and(EVENTS.SUBJECT_ID.eq(id)))
                .orderBy(EVENTS.AT.desc(), EVENTS.POSITION.asc()).fetch().map(event -> {
                    Map<String, Object> log = new LinkedHashMap<>();
                    log.put("id", event.getId());
                    log.put("subjectKind", event.getSubjectKind());
                    log.put("subjectId", event.getSubjectId());
                    log.put("at", Instants.format(event.getAt().toInstant()));
                    log.put("actor", json(event.getActor().data()));
                    log.put("correlationId", event.getCorrelationId());
                    Map<String, Object> reason = new LinkedHashMap<>();
                    reason.put("public", event.getReasonPublic());
                    reason.put("internal", event.getReasonInternal());
                    log.put("reason", reason);
                    log.put("code", event.getCode());
                    log.put("data", json(event.getData().data()));
                    return log;
                });
    }

    private Object json(String value) {
        JsonNode node = mapper.readTree(value);
        return mapper.convertValue(node, Object.class);
    }

    @SuppressWarnings("unchecked")
    private List<String> strings(Object values) {
        return (List<String>) values;
    }
}
