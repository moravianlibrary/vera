package cz.mzk.vera.lists;

import static cz.mzk.vera.db.tables.Tables.CATEGORIES;
import static cz.mzk.vera.db.tables.Tables.DIGITIZATION_LISTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_PROPERTY_VALUES;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_STATES;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_PROPERTY_SOURCES;
import static cz.mzk.vera.db.tables.Tables.ITERATION_STATES;
import static cz.mzk.vera.db.tables.Tables.PROJECTS;
import static cz.mzk.vera.db.tables.Tables.PROPERTY_DEFINITIONS;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static org.jooq.impl.DSL.countDistinct;
import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.sum;

import cz.mzk.vera.documents.DocumentHistory;
import cz.mzk.vera.documents.DocumentQueries;
import cz.mzk.vera.documents.DocumentRecords;
import cz.mzk.vera.domain.categories.Categories;
import cz.mzk.vera.domain.entities.Category;
import cz.mzk.vera.domain.entities.DigitizationList;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.intentions.Intentions;
import cz.mzk.vera.domain.lists.Lists;
import cz.mzk.vera.domain.listing.Listing;
import cz.mzk.vera.domain.properties.Properties;
import cz.mzk.vera.domain.valuerange.DayRange;
import cz.mzk.vera.domain.valuerange.Range;
import cz.mzk.vera.domain.valuerange.ValueRange;
import cz.mzk.vera.intentions.CountingReads;
import cz.mzk.vera.intentions.CountingReads.CountingSnapshot;
import cz.mzk.vera.intentions.CountingReads.StoredIntention;
import cz.mzk.vera.listing.FacetSource;
import cz.mzk.vera.listing.Facets;
import cz.mzk.vera.db.tables.tables.records.DigitizationListsRecord;
import cz.mzk.vera.db.tables.tables.records.IterationsRecord;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.HeldAccessQueries.HeldScopes;
import cz.mzk.vera.web.Instants;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.JSONB;
import org.jooq.Record3;
import org.jooq.Select;
import org.jooq.SortField;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

// VIEW-lists; SCOPE-list; LC-LIST-state; LC-LIST-pool; PLAN-counting.
@Repository
class ListDetailQueries {
    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final DocumentRecords records;
    private final DocumentHistory history;
    private final CountingReads counting;
    private final JsonMapper mapper;
    private final Clock clock;
    private final DocumentQueries documents;
    private final Facets facets;
    ListDetailQueries(DSLContext dsl, HeldAccessQueries access, DocumentRecords records,
            DocumentHistory history, CountingReads counting, JsonMapper mapper, Clock clock,
            DocumentQueries documents, Facets facets) {
        this.dsl = dsl;
        this.access = access;
        this.records = records;
        this.history = history;
        this.counting = counting;
        this.mapper = mapper;
        this.clock = clock;
        this.documents = documents;
        this.facets = facets;
    }

    Map<String, Object> detail(String listId, String userId) {
        HeldScopes held = access.scopesHeldBy(userId);
        List<Category> categories = categories();
        if (!reachableListIds(held, categories).contains(listId)) {
            return null;
        }
        var stored = dsl.selectFrom(DIGITIZATION_LISTS).where(DIGITIZATION_LISTS.ID.eq(listId)).fetchOne();
        if (stored == null) {
            return null;
        }
        LocalDate today = LocalDate.now(clock);
        Map<String, Object> row = rowsFor(List.of(listId), today).getFirst();
        List<String> memberIds = dsl.select(ITERATIONS.ID).from(ITERATIONS)
                .where(ITERATIONS.LIST_ID.eq(listId)).fetch(ITERATIONS.ID);
        List<Map<String, Object>> members = itemsOf(memberIds).stream().sorted(itemOrder())
                .map(this::wireItem).toList();
        List<Map<String, Object>> log = history.logOf(Set.of(listId), held,
                cz.mzk.vera.documents.Audience.STAFF, false);
        CountingSnapshot snapshot = counting.countingData();
        List<Iteration> countingMembers = snapshot.rules().iterations().stream()
                .filter(iteration -> listId.equals(iteration.listId()))
                .filter(iteration -> iteration.cancellation() == null || Lists.isScanned(iteration)).toList();
        List<Map<String, Object>> countsTowards = countsTowards(
                snapshot, countingMembers, stored.getStartsOn().toString());
        Map<String, Object> mix = listMix(stored, snapshot, countingMembers);
        return ListQuerySupport.map("row", wireRow(row), "members", members, "log", log,
                "countsTowards", countsTowards, "mix", mix);
    }

    private List<String> reachableListIds(HeldScopes held, List<Category> categories) {
        if (held.scopesOf("list.read").contains("any")) {
            return dsl.select(DIGITIZATION_LISTS.ID).from(DIGITIZATION_LISTS)
                    .orderBy(DIGITIZATION_LISTS.POSITION).fetch(DIGITIZATION_LISTS.ID);
        }
        Condition memberReach = DSL.falseCondition();
        List<String> scopes = held.scopesOf("list.read");
        if (scopes.contains("custody")) {
            for (Category category : categories) {
                if (held.reachesIteration("list.read", Categories.lineageOf(categories, category.id()))) {
                    memberReach = memberReach.or(ITERATIONS.CATEGORY_ID.eq(category.id()));
                }
            }
        }
        if (scopes.contains("project") || scopes.contains("own")) {
            memberReach = memberReach.or(ITERATIONS.PROJECT_ID.in(held.projectIds()));
        }
        List<String> result = dsl.select(DIGITIZATION_LISTS.ID).from(DIGITIZATION_LISTS)
                .where(DSL.exists(dsl.selectOne().from(ITERATIONS)
                        .where(ITERATIONS.LIST_ID.eq(DIGITIZATION_LISTS.ID)
                        .and(memberReach))))
                .orderBy(DIGITIZATION_LISTS.POSITION).fetch(DIGITIZATION_LISTS.ID);
        if (scopes.contains("any")) {
            return result;
        }
        // Empty lists are reachable only through `any`.
        return result;
    }

    List<Map<String, Object>> rowsFor(List<String> ids, LocalDate today) {
        if (ids.isEmpty()) {
            return List.of();
        }
        CountingSnapshot snapshot = counting.countingData();
        Map<String, List<Iteration>> members = new LinkedHashMap<>();
        snapshot.rules().iterations().forEach(item -> {
            if (item.listId() != null) {
                members.computeIfAbsent(item.listId(), ignored -> new ArrayList<>()).add(item);
            }
        });
        Map<String, String> names = new LinkedHashMap<>();
        dsl.select(USERS.ID, USERS.NAME).from(USERS).fetch()
                .forEach(r -> names.put(r.get(USERS.ID), r.get(USERS.NAME)));
        Map<String, String> intentions = new LinkedHashMap<>();
        snapshot.intentions().forEach(value -> intentions.put(value.rule().id(), value.name()));
        Map<String, String> statuses = new LinkedHashMap<>();
        Map<String, String> validations = new LinkedHashMap<>();
        dsl.select(ITERATION_STATES.ITERATION_ID, ITERATION_STATES.STATUS).from(ITERATION_STATES)
                .where(ITERATION_STATES.ITERATION_ID.in(snapshot.rules().iterations().stream()
                        .map(Iteration::id).toList()))
                .fetch().forEach(row -> statuses.put(row.get(ITERATION_STATES.ITERATION_ID),
                        row.get(ITERATION_STATES.STATUS)));
        dsl.select(ITERATION_STATES.ITERATION_ID, ITERATION_STATES.VALIDATION).from(ITERATION_STATES)
                .where(ITERATION_STATES.ITERATION_ID.in(snapshot.rules().iterations().stream()
                        .map(Iteration::id).toList()))
                .fetch().forEach(row -> validations.put(row.get(ITERATION_STATES.ITERATION_ID),
                        row.get(ITERATION_STATES.VALIDATION)));
        Map<String, Integer> lateCopies = dsl.select(ITERATIONS.LIST_ID, countDistinct(ITERATIONS.ID))
                .from(ITERATIONS.join(REQUEST_EXISTING_COPIES)
                        .on(REQUEST_EXISTING_COPIES.REQUEST_ID.eq(ITERATIONS.REQUEST_ID)))
                .where(ITERATIONS.LIST_ID.in(ids).and(REQUEST_EXISTING_COPIES.FOUND_AFTER_APPROVAL.isTrue()))
                .groupBy(ITERATIONS.LIST_ID).fetch()
                .intoMap(ITERATIONS.LIST_ID, countDistinct(ITERATIONS.ID));
        List<Map<String, Object>> result = new ArrayList<>();
        dsl.selectFrom(DIGITIZATION_LISTS).where(DIGITIZATION_LISTS.ID.in(ids))
                .orderBy(DIGITIZATION_LISTS.POSITION).fetch().forEach(list -> {
            DigitizationList value = new DigitizationList(
                    list.getId(), list.getName(), list.getStartsOn().toString(),
                    list.getEndsOn().toString(), list.getTargetPages(), instant(list.getDoneAt()));
            List<Iteration> onList = members.getOrDefault(list.getId(), List.of());
            List<Iteration> scanned = onList.stream().filter(Lists::isScanned).toList();
            int pageCount = onList.stream().map(snapshot.pagesOf()).filter(java.util.Objects::nonNull)
                    .mapToInt(Integer::intValue).sum();
            int scannedPages = scanned.stream().map(snapshot.pagesOf()).filter(java.util.Objects::nonNull)
                    .mapToInt(Integer::intValue).sum();
            List<Map<String, Object>> counts = countsTowards(snapshot, onList.stream()
                    .filter(item -> item.cancellation() == null || Lists.isScanned(item)).toList(),
                    value.startsOn());
            JSONBHolder generated = generated(list.getGenerated());
            Object generatedWith = generated.intentionId() == null ? null
                    : ListQuerySupport.map("id", generated.intentionId(),
                    "name", intentions.getOrDefault(generated.intentionId(), generated.intentionId()));
            Map<String, Object> wire = ListQuerySupport.map("id", list.getId(), "name", list.getName(),
                    "startsOn", value.startsOn(), "endsOn", value.endsOn(),
                    "targetPages", value.targetPages(), "generated", readJson(list.getGenerated()),
                    "createdBy", list.getCreatedBy(),
                    "createdAt", Instants.format(list.getCreatedAt().toInstant()),
                    "done", list.getDoneAt() == null ? null
                            : ListQuerySupport.map("actorId", list.getDoneActorId(),
                            "at", Instants.format(list.getDoneAt().toInstant())));
            result.add(ListQuerySupport.map("listId", list.getId(), "list", wire,
                    "state", Lists.listStateOf(value, today.toString()).name(),
                    "isOverdue", Lists.isOverdue(value, today.toString()), "itemCount", onList.size(),
                    "pages", pageCount, "scannedItemCount", scanned.size(), "scannedPages", scannedPages,
                    "blockedCount", (int) onList.stream()
                            .filter(item -> isBlocked(statuses.get(item.id()))).count(),
                    "lateCopyCount", lateCopies.getOrDefault(list.getId(), 0),
                    "reviewNeededCount", (int) onList.stream().filter(item -> Lists.isScanned(item)
                            && ("Needed".equals(validations.get(item.id()))
                                    || "Denied".equals(validations.get(item.id())))).count(),
                    "notDigitizableCount", (int) onList.stream().filter(item -> item.cancellation() != null
                            && item.cancellation().cause().name().equals("NotDigitizable")).count(),
                    "cancelledCount", (int) onList.stream().filter(item -> item.cancellation() != null
                            && item.cancellation().cause().name().equals("Decided")).count(),
                    "countsTowards", counts.stream().map(item -> ListQuerySupport.map(
                            "id", item.get("intentionId"),
                            "name", item.get("name"), "isOverall", item.get("isOverall"))).toList(),
                    "generatedWith", generatedWith));
        });
        return result;
    }

    private List<Map<String, Object>> countsTowards(CountingSnapshot snapshot, List<Iteration> members,
            String startsOn) {
        List<Intentions.CountsTowards> values = Intentions.countsTowardsOf(snapshot.intentions().stream()
                .map(StoredIntention::rule).toList(), members, startsOn, snapshot.rules());
        Map<String, StoredIntention> byId = new LinkedHashMap<>();
        snapshot.intentions().forEach(value -> byId.put(value.rule().id(), value));
        return values.stream().map(value -> {
            StoredIntention intention = byId.get(value.intentionId());
            return ListQuerySupport.map("intentionId", value.intentionId(), "name", intention.name(),
                "isOverall", intention.rule().isOverall(), "itemCount", value.itemCount(),
                "pages", value.pages());
        }).sorted(Comparator.comparing((Map<String, Object> value) -> (Boolean) value.get("isOverall")))
                .toList();
    }

    private Map<String, Object> listMix(DigitizationListsRecord stored, CountingSnapshot snapshot,
            List<Iteration> members) {
        StoredIntention intention = snapshot.intentions().stream()
                .filter(value -> value.rule().id().equals(
                        generated(stored.get(DIGITIZATION_LISTS.GENERATED)).intentionId()))
                .findFirst().orElseGet(() -> counting.overallIntention(snapshot));
        if (intention.distributionId() == null) {
            return ListQuerySupport.map("intention",
                    ListQuerySupport.map("id", intention.rule().id(), "name", intention.name()),
                    "scope", intention.rule().scopeCategoryId(), "isAllocation", false, "rows", List.of());
        }
        var distribution = counting.distributionOf(snapshot, intention);
        List<Intentions.ListMixRow> rows = Intentions.listMixOf(snapshot.rules().categories(),
                distribution.countingShares(), intention.rule().scopeCategoryId(), members,
                stored.get(DIGITIZATION_LISTS.TARGET_PAGES),
                generated(stored.get(DIGITIZATION_LISTS.GENERATED)).allocation(),
                snapshot.pagesOf());
        Map<String, String> categoryNames = new LinkedHashMap<>();
        dsl.select(CATEGORIES.ID, CATEGORIES.NAME).from(CATEGORIES).fetch()
                .forEach(row -> categoryNames.put(row.get(CATEGORIES.ID), row.get(CATEGORIES.NAME)));
        return ListQuerySupport.map("intention",
                ListQuerySupport.map("id", intention.rule().id(), "name", intention.name()),
                "scope", categoryNames.getOrDefault(
                        intention.rule().scopeCategoryId(), intention.rule().scopeCategoryId()),
                "isAllocation", generated(stored.get(DIGITIZATION_LISTS.GENERATED)).allocation() != null,
                "rows", rows.stream().map(row -> ListQuerySupport.map("categoryId", row.categoryId(),
                        "name", categoryNames.getOrDefault(row.categoryId(), row.categoryId()),
                        "share", row.share(), "pages", row.pages(), "goalPages", row.goalPages())).toList());
    }

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> itemsOf(List<String> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        List<IterationsRecord> iterations = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.in(ids)).fetch();
        List<String> documentIds = iterations.stream().map(IterationsRecord::getDocumentId)
                .distinct().toList();
        Map<String, Map<String, Object>> byDocument = records.recordsOf(documentIds);
        Map<String, String> requests = new LinkedHashMap<>();
        dsl.select(REQUESTS.ID, REQUESTS.AT).from(REQUESTS)
                .where(REQUESTS.ID.in(iterations.stream().map(IterationsRecord::getRequestId).toList()))
                .fetch().forEach(row -> requests.put(row.get(REQUESTS.ID),
                        Instants.format(row.get(REQUESTS.AT).toInstant())));
        Map<String, Integer> pageCounts = new LinkedHashMap<>();
        dsl.select(DOCUMENT_STATES.DOCUMENT_ID, DOCUMENT_STATES.PAGE_COUNT).from(DOCUMENT_STATES)
                .where(DOCUMENT_STATES.DOCUMENT_ID.in(documentIds)).fetch()
                .forEach(row -> pageCounts.put(row.get(DOCUMENT_STATES.DOCUMENT_ID),
                        row.get(DOCUMENT_STATES.PAGE_COUNT)));
        Map<String, String> statuses = new LinkedHashMap<>();
        dsl.select(ITERATION_STATES.ITERATION_ID, ITERATION_STATES.STATUS).from(ITERATION_STATES)
                .where(ITERATION_STATES.ITERATION_ID.in(ids)).fetch()
                .forEach(row -> statuses.put(row.get(ITERATION_STATES.ITERATION_ID),
                        row.get(ITERATION_STATES.STATUS)));
        List<Map<String, Object>> result = new ArrayList<>();
        for (IterationsRecord iteration : iterations) {
            String id = iteration.getId();
            Map<String, Object> bundle = byDocument.get(iteration.getDocumentId());
            if (bundle == null) {
                continue;
            }
            Map<String, Object> document = (Map<String, Object>) bundle.get("document");
            List<Map<String, Object>> attempts = (List<Map<String, Object>>) bundle.get("iterations");
            Map<String, Object> wireIteration = attempts.stream().filter(value -> id.equals(value.get("id")))
                    .findFirst().orElse(null);
            if (wireIteration == null) {
                continue;
            }
            String askedAt = requests.get(iteration.getRequestId());
            if (askedAt == null) {
                continue;
            }
            Integer pages = pageCounts.get(iteration.getDocumentId());
            String status = statuses.get(id);
            String blocker = isBlocked(status) ? status : null;
            List<Map<String, Object>> documentRequests = (List<Map<String, Object>>) bundle.get("requests");
            Map<String, Object> originatingRequest = documentRequests.stream()
                    .filter(value -> iteration.getRequestId().equals(value.get("id")))
                    .findFirst().orElse(Map.of());
            List<Map<String, Object>> copies = (List<Map<String, Object>>) originatingRequest
                    .getOrDefault("existingCopies", List.of());
            Map<String, Object> lateCopy = copies.stream()
                    .filter(value -> Boolean.TRUE.equals(value.get("foundAfterApproval")))
                    .findFirst().orElse(null);
            result.add(ListQuerySupport.map("iterationId", id, "iteration", wireIteration,
                    "document", document,
                    "pageValue", pages, "pages", pages, "askedAt", askedAt, "blocker", blocker,
                    "lateCopy", lateCopy, "requestId", iteration.getRequestId(),
                    "priority", iteration.getPriority()));
        }
        return result;
    }

    private Comparator<Map<String, Object>> itemOrder() {
        return Comparator.<Map<String, Object>>comparingInt(
                item -> priorityRank((String) item.get("priority")))
                .reversed().thenComparing(item -> (String) item.get("askedAt"));
    }

    private int priorityRank(String priority) {
        return List.of("Low", "Normal", "High", "Urgent").indexOf(priority);
    }

    private boolean isBlocked(String status) {
        return "Forbidden".equals(status) || "ReviewNeeded".equals(status)
                || "ValidationDenied".equals(status);
    }

    Map<String, Object> wireRow(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>(row);
        result.remove("listId");
        return result;
    }

    Map<String, Object> wireItem(Map<String, Object> row) {
        return ListQuerySupport.map("iteration", row.get("iteration"), "document", row.get("document"),
                "pages", row.get("pages"), "askedAt", row.get("askedAt"), "blocker", row.get("blocker"),
                "lateCopy", row.get("lateCopy"));
    }

    private List<Category> categories() {
        return dsl.select(CATEGORIES.ID, CATEGORIES.PARENT_ID).from(CATEGORIES)
                .fetch(row -> new Category(row.get(CATEGORIES.ID), row.get(CATEGORIES.PARENT_ID)));
    }


    private String instant(OffsetDateTime value) {
        return value == null ? null : Instants.format(value.toInstant());
    }

    private JSONBHolder generated(JSONB value) {
        if (value == null) {
            return new JSONBHolder(null, null);
        }
        try {
            Map<String, Object> data = mapper.readValue(value.data(),
                    new tools.jackson.core.type.TypeReference<>() {});
            String intentionId = (String) data.get("intentionId");
            @SuppressWarnings("unchecked")
            Map<String, Integer> allocation = (Map<String, Integer>) data.get("allocation");
            return new JSONBHolder(intentionId, allocation);
        } catch (JacksonException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private Object readJson(JSONB value) {
        if (value == null) {
            return null;
        }
        try {
            return mapper.readValue(value.data(), Object.class);
        } catch (JacksonException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private record JSONBHolder(String intentionId, Map<String, Integer> allocation) {}
}

