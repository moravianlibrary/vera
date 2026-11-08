package cz.mzk.vera.lists;

import static cz.mzk.vera.db.tables.Tables.DIGITIZATION_LISTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.DOCUMENT_STATES;
import static cz.mzk.vera.db.tables.Tables.ITERATIONS;
import static cz.mzk.vera.db.tables.Tables.ITERATION_STATES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.domain.iterations.Iterations.progressAfterGates;
import static cz.mzk.vera.domain.lists.Lists.isScanned;
import static org.jooq.impl.DSL.cast;
import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.max;
import static org.jooq.impl.DSL.substring;
import static org.jooq.impl.DSL.sum;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.db.tables.tables.records.DigitizationListsRecord;
import cz.mzk.vera.db.tables.tables.records.IterationsRecord;
import cz.mzk.vera.documents.DocumentStates;
import cz.mzk.vera.domain.entities.CancellationCause;
import cz.mzk.vera.domain.entities.Iteration;
import cz.mzk.vera.domain.entities.Progress;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.events.Correlation;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.jobs.Jobs;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.web.Instants;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

// ACT-list-create; ACT-list-save; ACT-list-start; ACT-list-done; ACT-list-delete; ACT-list-not-digitizable.
@Component
class ListCommands {
    private static final ZoneId LIBRARY_ZONE = ZoneId.of("Europe/Prague");
    private final DSLContext dsl;
    private final ListsQueries queries;
    private final HeldAccessQueries access;
    private final DocumentStates states;
    private final EventRecorder events;
    private final Jobs jobs;
    private final Clock clock;
    private final JsonMapper json;

    ListCommands(DSLContext dsl, ListsQueries queries, HeldAccessQueries access, DocumentStates states,
            EventRecorder events, Jobs jobs, Clock clock, JsonMapper json) {
        this.dsl = dsl;
        this.queries = queries;
        this.access = access;
        this.states = states;
        this.events = events;
        this.jobs = jobs;
        this.clock = clock;
        this.json = json;
    }

    @Transactional
    ActResult create(Caller caller, Draft draft) {
        if (!access.scopesHeldBy(caller.userId()).hasPermission("list.create")) {
            return ActResult.refused(403, "You may not create lists", null);
        }
        String start = draft.startsOn() == null ? today() : draft.startsOn();
        if (draft.endsOn().compareTo(start) < 0) {
            return ActResult.refused(422, "It cannot end before it starts", "list.ends_before_start");
        }
        ActResult invalid = validateMembers(draft.memberIds(), null);
        if (invalid != null) return invalid;
        String id = nextId();
        var at = now();
        dsl.insertInto(DIGITIZATION_LISTS)
                .set(DIGITIZATION_LISTS.ID, id)
                .set(DIGITIZATION_LISTS.NAME, draft.name())
                .set(DIGITIZATION_LISTS.STARTS_ON, LocalDate.parse(start))
                .set(DIGITIZATION_LISTS.ENDS_ON, LocalDate.parse(draft.endsOn()))
                .set(DIGITIZATION_LISTS.TARGET_PAGES, draft.targetPages())
                .set(DIGITIZATION_LISTS.GENERATED, draft.generated() == null ? null
                        : JSONB.valueOf(draft.generated().toString()))
                .set(DIGITIZATION_LISTS.CREATED_BY, caller.userId())
                .set(DIGITIZATION_LISTS.CREATED_AT, at)
                .set(DIGITIZATION_LISTS.POSITION, nextPosition())
                .execute();
        String correlation = Correlation.newId();
        Map<String, Object> eventData = new LinkedHashMap<>();
        eventData.put("generator", generatedInfo(draft.generated()));
        eventData.put("members", draft.memberIds().size());
        record(EventCode.LIST_CREATED, "list", id, caller, correlation, eventData, null, null);
        moveMembers(caller, id, draft.name(), start, draft.memberIds(), correlation);
        if (LocalDate.parse(start).isAfter(LocalDate.now(clock))) queue(id, start);
        return ActResult.ok(queries.detail(id, caller.userId()));
    }

    @Transactional
    ActResult save(Caller caller, String id, Draft draft) {
        if (!access.scopesHeldBy(caller.userId()).hasPermission("list.edit")) {
            return ActResult.refused(403, "You may not edit lists", null);
        }
        var row = reachable(id, caller.userId());
        if (row == null) return ActResult.refused(404, "List not found", null);
        if (row.getDoneAt() != null) return doneRefusal();
        String start = draft.startsOn() == null ? today() : draft.startsOn();
        if (draft.endsOn().compareTo(start) < 0) return ActResult.refused(422,
                "It cannot end before it starts", "list.ends_before_start");
        ActResult invalid = validateMembers(draft.memberIds(), id);
        if (invalid != null) return invalid;
        String oldName = row.getName();
        String oldStart = row.getStartsOn().toString();
        String oldEnd = row.getEndsOn().toString();
        JSONB generated = draft.generated() == null ? row.getGenerated()
                : JSONB.valueOf(draft.generated().toString());
        dsl.update(DIGITIZATION_LISTS)
                .set(DIGITIZATION_LISTS.NAME, draft.name())
                .set(DIGITIZATION_LISTS.STARTS_ON, LocalDate.parse(start))
                .set(DIGITIZATION_LISTS.ENDS_ON, LocalDate.parse(draft.endsOn()))
                .set(DIGITIZATION_LISTS.TARGET_PAGES, draft.targetPages())
                .set(DIGITIZATION_LISTS.GENERATED, generated)
                .where(DIGITIZATION_LISTS.ID.eq(id)).execute();
        String correlation = Correlation.newId();
        if (!oldStart.equals(start) || !oldEnd.equals(draft.endsOn())) {
            record(EventCode.LIST_DATES_MOVED, "list", id, caller, correlation,
                    Map.of("starts", Map.of("from", oldStart, "to", start),
                            "ends", Map.of("from", oldEnd, "to", draft.endsOn())), null, null);
        }
        if (!oldName.equals(draft.name())) record(EventCode.LIST_RENAMED, "list", id, caller, correlation,
                Map.of("name", Map.of("from", oldName, "to", draft.name())), null, null);
        moveMembers(caller, id, draft.name(), start, draft.memberIds(), correlation);
        if (!oldStart.equals(start) && LocalDate.parse(start).isAfter(LocalDate.now(clock))) {
            queue(id, start);
        }
        return ActResult.ok(queries.detail(id, caller.userId()));
    }

    @Transactional
    ActResult startNow(Caller caller, String id) {
        ActResult found = actionable(caller, id, "list.edit");
        if (found.status() != 200) return found;
        var row = dsl.selectFrom(DIGITIZATION_LISTS).where(DIGITIZATION_LISTS.ID.eq(id)).fetchOne();
        if (!row.getStartsOn().isAfter(LocalDate.now(clock))) {
            return ActResult.refused(409, "It has started already", "list.already_started");
        }
        String oldStart = row.getStartsOn().toString();
        dsl.update(DIGITIZATION_LISTS).set(DIGITIZATION_LISTS.STARTS_ON, LocalDate.now(clock))
                .where(DIGITIZATION_LISTS.ID.eq(id)).execute();
        List<IterationsRecord> active = members(id).stream().filter(this::open).toList();
        dsl.update(ITERATIONS).set(ITERATIONS.PROGRESS, "InProgress")
                .where(ITERATIONS.LIST_ID.eq(id)
                        .and(ITERATIONS.CANCELLATION_CAUSE.isNull())
                        .and(ITERATIONS.PROGRESS.notIn("Digitized", "Published")))
                .execute();
        active.forEach(item -> states.recompute(dsl, item.getDocumentId()));
        record(EventCode.LIST_STARTED_EARLY, "list", id, caller, Correlation.newId(),
                Map.of("starts", oldStart), null, null);
        return ActResult.ok(queries.detail(id, caller.userId()));
    }

    @Transactional(readOnly = true)
    ActResult previewDone(Caller caller, String id) {
        ActResult found = running(caller, id);
        if (found.status() != 200) return found;
        List<IterationsRecord> members = members(id);
        List<IterationsRecord> moving = members.stream().filter(this::open).toList();
        int pages = pages(moving);
        List<Map<String, Object>> blocked = moving.stream().filter(this::blocked).map(item -> {
            String title = dsl.select(DOCUMENTS.TITLE).from(DOCUMENTS).join(ITERATIONS)
                    .on(ITERATIONS.DOCUMENT_ID.eq(DOCUMENTS.ID)).where(ITERATIONS.ID.eq(item.getId()))
                    .fetchOne(DOCUMENTS.TITLE);
            return Map.<String, Object>of("iterationId", item.getId(),
                    "title", title == null ? item.getId() : title);
        }).toList();
        return ActResult.ok(Map.of("toDigitized", Map.of("itemCount", moving.size(), "pages", pages),
                "alreadyScannedCount", members.stream().filter(this::scanned).count(),
                "notDigitizableCount", members.stream().filter(this::notDigitizable).count(),
                "blocked", blocked));
    }

    @Transactional
    ActResult done(Caller caller, String id) {
        ActResult found = running(caller, id);
        if (found.status() != 200) return found;
        var members = members(id);
        var moving = members.stream().filter(this::open).toList();
        var at = now();
        String correlation = Correlation.newId();
        for (var item : moving) {
            dsl.update(ITERATIONS)
                    .set(ITERATIONS.PROGRESS, "Digitized")
                    .set(ITERATIONS.DIGITIZED_AT, at)
                    .where(ITERATIONS.ID.eq(item.getId())).execute();
            record(EventCode.ITERATION_DIGITIZED, "iteration", item.getId(), caller, correlation,
                    Map.of("list", Map.of("id", id, "name", listName(id))), null, null);
            states.recompute(dsl, item.getDocumentId());
        }
        dsl.update(DIGITIZATION_LISTS).set(DIGITIZATION_LISTS.DONE_ACTOR_ID, caller.userId())
                .set(DIGITIZATION_LISTS.DONE_AT, at).where(DIGITIZATION_LISTS.ID.eq(id)).execute();
        long unable = members.stream().filter(this::notDigitizable).count();
        List<String> notes = new ArrayList<>();
        notes.add(moving.size() + " moved to Digitized");
        if (unable > 0) notes.add(unable + " could not be digitized");
        record(EventCode.LIST_MARKED_DONE, "list", id, caller, correlation,
                Map.of("digitized", moving.size()), null, String.join(" · ", notes));
        return ActResult.ok(queries.detail(id, caller.userId()));
    }

    @Transactional(readOnly = true)
    ActResult previewDelete(Caller caller, String id) {
        ActResult found = actionable(caller, id, "list.delete");
        if (found.status() != 200) return found;
        List<IterationsRecord> members = members(id);
        List<IterationsRecord> open = members.stream().filter(this::open).toList();
        List<IterationsRecord> ready = open.stream().filter(this::gatesClear).toList();
        return ActResult.ok(Map.of("toReady", Map.of("itemCount", ready.size(), "pages", pages(ready)),
                "toEnqueuedCount", open.size() - ready.size(),
                "scannedCount", members.stream().filter(this::scanned).count(),
                "heldCount", members.stream()
                        .filter(item -> !scanned(item) && item.getCancellationCause() != null).count()));
    }

    @Transactional
    ActResult delete(Caller caller, String id) {
        ActResult found = actionable(caller, id, "list.delete");
        if (found.status() != 200) return found;
        String name = listName(id);
        String correlation = Correlation.newId();
        List<IterationsRecord> members = members(id);
        for (var item : members) {
            String progress = scanned(item) ? item.getProgress() : gatesClear(item) ? "Ready" : "Enqueued";
            dsl.update(ITERATIONS)
                    .set(ITERATIONS.LIST_ID, (String) null)
                    .set(ITERATIONS.FORMER_LIST_NAME, name)
                    .set(ITERATIONS.PROGRESS, progress)
                    .where(ITERATIONS.ID.eq(item.getId()))
                    .execute();
            record(EventCode.ITERATION_UNLISTED, "iteration", item.getId(), caller, correlation,
                    Map.of("list", Map.of("id", id, "name", name), "why", "list_deleted"), null,
                    progress.equals("Enqueued") ? "Enqueued until its gate clears." : "Keeps its status.");
            states.recompute(dsl, item.getDocumentId());
        }
        dsl.deleteFrom(DIGITIZATION_LISTS).where(DIGITIZATION_LISTS.ID.eq(id)).execute();
        record(EventCode.LIST_DELETED, "list", id, caller, correlation,
                Map.of("returned", members.size()), null, null);
        return ActResult.noContent();
    }

    @Transactional
    ActResult notDigitizable(Caller caller, String id, String iterationId, String message) {
        ActResult found = running(caller, id);
        if (found.status() != 200) return found;
        var item = dsl.selectFrom(ITERATIONS)
                .where(ITERATIONS.ID.eq(iterationId).and(ITERATIONS.LIST_ID.eq(id)))
                .fetchOne();
        if (item == null) return ActResult.refused(404, "It is not on this list", "list.member_not_found");
        if (!open(item)) {
            return ActResult.refused(409, "It is already scanned, or already stopped", "iteration.stopped");
        }
        var at = now();
        dsl.update(ITERATIONS).set(ITERATIONS.CANCELLATION_CAUSE, "NotDigitizable")
                .set(ITERATIONS.CANCELLATION_ACTOR_ID, caller.userId())
                .set(ITERATIONS.CANCELLATION_AT, at)
                .set(ITERATIONS.CANCELLATION_PUBLIC_TEXT, message)
                .set(ITERATIONS.CANCELLATION_INTERNAL_TEXT, (String) null)
                .where(ITERATIONS.ID.eq(iterationId)).execute();
        record(EventCode.ITERATION_NOT_DIGITIZABLE, "iteration", iterationId, caller, Correlation.newId(),
                Map.of("list", Map.of("id", id, "name", listName(id))), message, null);
        states.recompute(dsl, item.getDocumentId());
        return ActResult.ok(queries.detail(id, caller.userId()));
    }

    @Transactional
    void startJob(DSLContext tx, String id, String start) {
        var row = tx.selectFrom(DIGITIZATION_LISTS).where(DIGITIZATION_LISTS.ID.eq(id)).fetchOne();
        if (row == null || row.getDoneAt() != null || !row.getStartsOn().toString().equals(start)) return;
        var at = clock.instant().atOffset(ZoneOffset.UTC);
        tx.update(ITERATIONS).set(ITERATIONS.PROGRESS, "InProgress")
                .where(ITERATIONS.LIST_ID.eq(id).and(ITERATIONS.PROGRESS.eq("Planned"))).execute();
        // Derived list.started is delivered to hooks only; the backend hook delivery table is added later.
    }

    private ActResult actionable(Caller caller, String id, String permission) {
        if (!access.scopesHeldBy(caller.userId()).hasPermission(permission)) {
            return ActResult.refused(403, "You may not do this to lists", null);
        }
        var row = reachable(id, caller.userId());
        if (row == null) return ActResult.refused(404, "List not found", null);
        if (row.getDoneAt() != null) return doneRefusal();
        return ActResult.ok(null);
    }

    private ActResult running(Caller caller, String id) {
        ActResult result = actionable(caller, id, "list.edit");
        if (result.status() != 200) return result;
        var row = dsl.selectFrom(DIGITIZATION_LISTS).where(DIGITIZATION_LISTS.ID.eq(id)).fetchOne();
        if (row.getStartsOn().isAfter(LocalDate.now(clock))) {
            return ActResult.refused(409, "It has not started yet: nothing on it is being scanned",
                    "list.not_started");
        }
        return result;
    }

    private ActResult doneRefusal() {
        return ActResult.refused(409, "A Done list is history: it no longer changes and is not deleted",
                "list.done");
    }

    private DigitizationListsRecord reachable(String id, String userId) {
        if (queries.detail(id, userId) == null) return null;
        return dsl.selectFrom(DIGITIZATION_LISTS).where(DIGITIZATION_LISTS.ID.eq(id)).fetchOne();
    }

    private ActResult validateMembers(List<String> ids, String currentList) {
        for (String id : new LinkedHashSet<>(ids)) {
            var item = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq(id)).fetchOne();
            if (item == null) return ActResult.refused(422, "No item " + id, "list.member_unknown");
            if (!id.equals(item.getId())) continue;
            if (currentList != null && currentList.equals(item.getListId())) continue;
            if (!"Ready".equals(item.getProgress()) || item.getListId() != null || !gatesClear(item)) {
                return ActResult.refused(409,
                        id + " is no longer ready to list: another list took it, or a gate holds it",
                        "list.member_unavailable");
            }
        }
        return null;
    }

    private void moveMembers(Caller caller, String id, String name, String start, List<String> ids,
            String correlation) {
        Set<String> wanted = new LinkedHashSet<>(ids);
        List<IterationsRecord> before = members(id);
        List<String> added = new ArrayList<>();
        List<String> removed = new ArrayList<>();
        String progress = LocalDate.parse(start).isAfter(LocalDate.now(clock)) ? "Planned" : "InProgress";
        for (var item : before) {
            if (wanted.contains(item.getId()) || scanned(item)) continue;
            removed.add(item.getId());
            String restored = gatesClear(item) ? "Ready" : "Enqueued";
            dsl.update(ITERATIONS)
                    .set(ITERATIONS.LIST_ID, (String) null)
                    .set(ITERATIONS.PROGRESS, restored)
                    .where(ITERATIONS.ID.eq(item.getId())).execute();
            record(EventCode.ITERATION_UNLISTED, "iteration", item.getId(), caller, correlation,
                    Map.of("list", Map.of("id", id, "name", name), "why", "edited"),
                    null, "Back in the pool.");
            states.recompute(dsl, item.getDocumentId());
        }
        for (String memberId : wanted) {
            var item = dsl.selectFrom(ITERATIONS).where(ITERATIONS.ID.eq(memberId)).fetchOne();
            if (item.getListId() != null && item.getListId().equals(id) || scanned(item)
                    || item.getCancellationCause() != null) continue;
            added.add(memberId);
            dsl.update(ITERATIONS)
                    .set(ITERATIONS.LIST_ID, id)
                    .set(ITERATIONS.PROGRESS, progress)
                    .where(ITERATIONS.ID.eq(memberId)).execute();
            record(EventCode.ITERATION_LISTED, "iteration", memberId, caller, correlation,
                    Map.of("list", Map.of("id", id, "name", name)), null, null);
            states.recompute(dsl, item.getDocumentId());
        }
        if (!added.isEmpty() || !removed.isEmpty()) record(EventCode.LIST_MEMBERS_CHANGED, "list", id, caller,
                correlation, Map.of("added", added, "removed", removed), null, null);
    }

    private boolean gatesClear(IterationsRecord item) {
        var state = dsl.selectFrom(ITERATION_STATES)
                .where(ITERATION_STATES.ITERATION_ID.eq(item.getId()))
                .fetchOne();
        return state != null && !Boolean.TRUE.equals(state.getIsRestricted())
                && ("NotRequired".equals(state.getValidation()) || "Approved".equals(state.getValidation()));
    }

    private boolean blocked(IterationsRecord item) {
        var state = dsl.select(ITERATION_STATES.STATUS).from(ITERATION_STATES)
                .where(ITERATION_STATES.ITERATION_ID.eq(item.getId())).fetchOne(ITERATION_STATES.STATUS);
        return List.of("Forbidden", "ReviewNeeded", "ValidationDenied").contains(state);
    }

    private boolean scanned(IterationsRecord item) {
        return List.of("Digitized", "Published").contains(item.getProgress());
    }

    private boolean open(IterationsRecord item) {
        return !scanned(item) && item.getCancellationCause() == null;
    }

    private boolean notDigitizable(IterationsRecord item) {
        return "NotDigitizable".equals(item.getCancellationCause());
    }

    private int pages(List<IterationsRecord> items) {
        if (items.isEmpty()) return 0;
        Integer total = dsl.select(coalesce(sum(DOCUMENT_STATES.PAGE_COUNT), 0))
                .from(ITERATIONS).join(DOCUMENT_STATES)
                .on(DOCUMENT_STATES.DOCUMENT_ID.eq(ITERATIONS.DOCUMENT_ID))
                .where(ITERATIONS.ID.in(items.stream().map(IterationsRecord::getId).toList()))
                .fetchOne(0, Integer.class);
        return total == null ? 0 : total;
    }

    private List<IterationsRecord> members(String id) {
        return dsl.selectFrom(ITERATIONS).where(ITERATIONS.LIST_ID.eq(id)).fetch();
    }

    private int nextPosition() {
        Integer max = dsl.select(max(DIGITIZATION_LISTS.POSITION))
                .from(DIGITIZATION_LISTS)
                .fetchOne(0, Integer.class);
        return max == null ? 0 : max + 1;
    }

    private String nextId() {
        int year = LocalDate.now(clock).getYear();
        Integer max = dsl.select(max(cast(substring(DIGITIZATION_LISTS.ID, 8), Integer.class)))
                .from(DIGITIZATION_LISTS)
                .where(DIGITIZATION_LISTS.ID.like("L-" + year + "-%")).fetchOne(0, Integer.class);
        return "L-" + year + "-" + String.format("%03d", max == null ? 1 : max + 1);
    }

    private String today() { return LocalDate.now(clock).toString(); }
    private OffsetDateTime now() { return clock.instant().atOffset(ZoneOffset.UTC); }

    private String listName(String id) {
        return dsl.select(DIGITIZATION_LISTS.NAME).from(DIGITIZATION_LISTS)
                .where(DIGITIZATION_LISTS.ID.eq(id)).fetchOne(DIGITIZATION_LISTS.NAME);
    }

    private void queue(String id, String start) {
        jobs.enqueue(dsl, "list.start",
                LocalDate.parse(start).atStartOfDay(clock.getZone()).toInstant(),
                Map.of("listId", id, "startsOn", start));
    }
    private Map<String, Object> generatedInfo(JsonNode generated) {
        if (generated == null) return null;
        String value = generated.path("generator").asString("");
        var match = Pattern.compile("^(.*?)(?:\\s+(\\d+(?:\\.\\d+)*))?$").matcher(value);
        match.matches();
        return Map.of("name", match.group(1), "version", match.group(2) == null ? "" : match.group(2));
    }
    private void record(EventCode code, String kind, String id, Caller caller, String correlation,
            Map<String, Object> data, String publicReason, String internalReason) {
        events.record(new EventInput(code, kind, id, null, new EventInput.User(caller.userId()), correlation,
                clock.instant(), json.valueToTree(data),
                new EventInput.Reason(publicReason, internalReason)));
    }
    record Draft(String name, String startsOn, String endsOn, Integer targetPages, List<String> memberIds,
            JsonNode generated) {}
    record NotDigitizable(String message) {}
}
