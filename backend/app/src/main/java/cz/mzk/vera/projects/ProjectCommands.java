package cz.mzk.vera.projects;

import static cz.mzk.vera.db.tables.Tables.DOCUMENTS;
import static cz.mzk.vera.db.tables.Tables.EVENTS;
import static cz.mzk.vera.db.tables.Tables.GROUPS;
import static cz.mzk.vera.db.tables.Tables.GROUP_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.INTENTIONS;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBER_GROUPS;
import static cz.mzk.vera.db.tables.Tables.PROJECT_MEMBERS;
import static cz.mzk.vera.db.tables.Tables.PROJECTS;
import static cz.mzk.vera.db.tables.Tables.REQUEST_EXISTING_COPIES;
import static cz.mzk.vera.db.tables.Tables.REQUESTS;
import static cz.mzk.vera.db.tables.Tables.USERS;
import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.max;

import cz.mzk.vera.access.ActResult;
import cz.mzk.vera.documents.ProjectQueries;
import cz.mzk.vera.domain.events.EventCode;
import cz.mzk.vera.events.EventChanges;
import cz.mzk.vera.events.EventInput;
import cz.mzk.vera.events.EventRecorder;
import cz.mzk.vera.intentions.ProjectIntentionWrites;
import cz.mzk.vera.requests.RequestDecisions;
import cz.mzk.vera.session.Caller;
import cz.mzk.vera.session.HeldAccessQueries;
import cz.mzk.vera.session.RecordIds;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

// ACT-project-create; ACT-project-save; ACT-project-members; ACT-project-decide; LOG-one-act-one-story.
@Service
class ProjectCommands {
    private static final String PROJECT_READ = "project.read";
    private static final String PROJECT_CREATE = "project.create";
    private static final String PROJECT_EDIT = "project.edit";
    private static final String PROJECT_MANAGE_MEMBERS = "project.manage_members";
    private static final String PROJECT_DECIDE = "project.decide";
    private static final String PROJECT_DELETE = "project.delete";

    private final DSLContext dsl;
    private final HeldAccessQueries access;
    private final ProjectQueries projectQueries;
    private final ProjectReads reads;
    private final ProjectIntentionWrites intentions;
    private final EventRecorder events;
    private final RequestDecisions requestDecisions;
    private final Clock clock;
    private final JsonMapper json;

    ProjectCommands(DSLContext dsl, HeldAccessQueries access, ProjectQueries projectQueries,
            ProjectReads reads, ProjectIntentionWrites intentions, EventRecorder events,
            RequestDecisions requestDecisions, Clock clock, JsonMapper json) {
        this.dsl = dsl;
        this.access = access;
        this.projectQueries = projectQueries;
        this.reads = reads;
        this.intentions = intentions;
        this.events = events;
        this.requestDecisions = requestDecisions;
        this.clock = clock;
        this.json = json;
    }

    @Transactional
    ActResult create(Caller caller, Draft draft) {
        if (!access.scopesHeldBy(caller.userId()).hasPermission(PROJECT_CREATE)) {
            return ActResult.refused(403, "You may not start projects", null);
        }
        String id = RecordIds.next("p", dsl.select(PROJECTS.ID).from(PROJECTS).fetch(PROJECTS.ID));
        int position = dsl.select(coalesce(max(PROJECTS.POSITION), -1).add(1))
                .from(PROJECTS).fetchOne(0, int.class);
        OffsetDateTime at = clock.instant().atOffset(ZoneOffset.UTC);
        dsl.insertInto(PROJECTS)
                .set(PROJECTS.ID, id)
                .set(PROJECTS.NAME, draft.name())
                .set(PROJECTS.DESCRIPTION, draft.description())
                .set(PROJECTS.STATE, "Proposed")
                .set(PROJECTS.STARTS_ON, LocalDate.parse(draft.startsOn()))
                .set(PROJECTS.ENDS_ON, LocalDate.parse(draft.endsOn()))
                .set(PROJECTS.MANAGER_ID, caller.userId())
                .set(PROJECTS.CREATED_AT, at)
                .set(PROJECTS.POSITION, position)
                .execute();
        dsl.insertInto(PROJECT_MEMBERS)
                .set(PROJECT_MEMBERS.PROJECT_ID, id)
                .set(PROJECT_MEMBERS.USER_ID, caller.userId())
                .set(PROJECT_MEMBERS.POSITION, 0)
                .execute();
        intentions.create(id, draft.name(), draft.startsOn(), draft.endsOn(), draft.targetPages());
        record(EventCode.PROJECT_CREATED, id, caller, UUID.randomUUID().toString(), at.toInstant(),
                Map.of(), null, null);
        return new ActResult(201, null, null, reads.detail(caller.userId(), id));
    }

    @Transactional
    ActResult preview(Caller caller, String id, Draft draft) {
        ProjectResult found = projectFor(caller, id, PROJECT_EDIT);
        if (found.refusal() != null) {
            return found.refusal();
        }
        Map<String, Object> before = reads.detail(caller.userId(), id);
        Map<?, ?> row = (Map<?, ?>) before.get("row");
        int plannedBefore = (Integer) row.get("plannedPages");
        int deliveredBefore = (Integer) row.get("deliveredPages");
        // Counting data is evaluated with the proposed window by the shared counting reader.
        Map<String, Object> after = reads.previewCounts(id, draft.startsOn(), draft.endsOn(), draft.targetPages());
        Map<String, Object> planned = new LinkedHashMap<>();
        planned.put("before", plannedBefore);
        planned.put("after", after.get("plannedPages"));
        Map<String, Object> delivered = new LinkedHashMap<>();
        delivered.put("before", deliveredBefore);
        delivered.put("after", after.get("deliveredPages"));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("plannedPages", planned);
        result.put("deliveredPages", delivered);
        return ActResult.ok(result);
    }

    @Transactional
    ActResult save(Caller caller, String id, Draft draft) {
        ProjectResult found = projectFor(caller, id, PROJECT_EDIT);
        if (found.refusal() != null) {
            return found.refusal();
        }
        Map<String, Object> old = projectQueries.projectsOf(List.of(id)).get(id);
        String intentionId = dsl.select(INTENTIONS.ID).from(INTENTIONS)
                .where(INTENTIONS.PROJECT_ID.eq(id)).fetchOne(INTENTIONS.ID);
        Map<String, Object> oldIntention = reads.projectIntention(id);
        List<Map<String, Object>> dateChanges = new ArrayList<>();
        addChange(dateChanges, "startsOn", old.get("startsOn"), draft.startsOn());
        addChange(dateChanges, "endsOn", old.get("endsOn"), draft.endsOn());
        addChange(dateChanges, "targetPages", oldIntention.get("targetPages"), draft.targetPages());
        List<Map<String, Object>> detailChanges = new ArrayList<>();
        addChange(detailChanges, "name", old.get("name"), draft.name());
        addChange(detailChanges, "description", old.get("description"), draft.description());
        dsl.update(PROJECTS)
                .set(PROJECTS.NAME, draft.name())
                .set(PROJECTS.DESCRIPTION, draft.description())
                .set(PROJECTS.STARTS_ON, LocalDate.parse(draft.startsOn()))
                .set(PROJECTS.ENDS_ON, LocalDate.parse(draft.endsOn()))
                .where(PROJECTS.ID.eq(id))
                .execute();
        intentions.follow(intentionId, id, draft.name(), draft.startsOn(), draft.endsOn(), draft.targetPages());
        String correlation = UUID.randomUUID().toString();
        Instant at = clock.instant();
        if (!dateChanges.isEmpty()) {
            record(EventCode.PROJECT_DATES_CHANGED, id, caller, correlation, at,
                    Map.of("changes", dateChanges), null, null);
        }
        if (!detailChanges.isEmpty()) {
            record(EventCode.PROJECT_DETAILS_CHANGED, id, caller, correlation, at,
                    Map.of("changes", detailChanges), null, null);
        }
        return ActResult.ok(reads.detail(caller.userId(), id));
    }

    @Transactional
    ActResult members(Caller caller, String id, Members requested) {
        ProjectResult found = projectFor(caller, id, PROJECT_MANAGE_MEMBERS);
        if (found.refusal() != null) {
            return found.refusal();
        }
        List<String> users = List.copyOf(new LinkedHashSet<>(requested.memberIds()));
        List<String> groups = List.copyOf(new LinkedHashSet<>(requested.memberGroupIds()));
        if (users.stream().anyMatch(user -> !dsl.fetchExists(dsl.selectOne().from(USERS)
                .where(USERS.ID.eq(user).and(USERS.KIND.eq("person")))))) {
            String unknown = users.stream().filter(user -> !dsl.fetchExists(dsl.selectOne().from(USERS)
                    .where(USERS.ID.eq(user).and(USERS.KIND.eq("person"))))).findFirst().orElseThrow();
            return ActResult.refused(422, "No person " + unknown, "person.not_found");
        }
        if (groups.stream().anyMatch(group -> !dsl.fetchExists(dsl.selectOne().from(GROUPS)
                .where(GROUPS.ID.eq(group))))) {
            String unknown = groups.stream().filter(group -> !dsl.fetchExists(dsl.selectOne().from(GROUPS)
                    .where(GROUPS.ID.eq(group)))).findFirst().orElseThrow();
            return ActResult.refused(422, "No group " + unknown, "group.not_found");
        }
        Map<String, Object> old = projectQueries.projectsOf(List.of(id)).get(id);
        List<String> beforeUsers = strings(old.get("memberIds"));
        List<String> beforeGroups = strings(old.get("memberGroupIds"));
        String oldManager = (String) old.get("managerId");
        dsl.deleteFrom(PROJECT_MEMBERS).where(PROJECT_MEMBERS.PROJECT_ID.eq(id)).execute();
        dsl.deleteFrom(PROJECT_MEMBER_GROUPS).where(PROJECT_MEMBER_GROUPS.PROJECT_ID.eq(id)).execute();
        insertMembers(id, users);
        insertGroups(id, groups);
        dsl.update(PROJECTS).set(PROJECTS.MANAGER_ID, requested.managerId())
                .where(PROJECTS.ID.eq(id)).execute();
        String correlation = UUID.randomUUID().toString();
        Instant at = clock.instant();
        for (String user : users) {
            if (!beforeUsers.contains(user)) {
                record(EventCode.PROJECT_MEMBER_ADDED, id, caller, correlation, at,
                        Map.of("userId", user), null, null);
            }
        }
        for (String user : beforeUsers) {
            if (!users.contains(user)) {
                record(EventCode.PROJECT_MEMBER_REMOVED, id, caller, correlation, at,
                        Map.of("userId", user), null, null);
            }
        }
        if (!beforeGroups.equals(groups)) {
            record(EventCode.PROJECT_DETAILS_CHANGED, id, caller, correlation, at,
                    Map.of("changes", List.of(EventChanges.change("memberGroupIds", beforeGroups, groups))),
                    null, null);
        }
        if (!oldManager.equals(requested.managerId())) {
            record(EventCode.PROJECT_MANAGER_CHANGED, id, caller, correlation, at,
                    Map.of("userId", EventChanges.change("userId", oldManager, requested.managerId())), null, null);
        }
        return ActResult.ok(reads.detail(caller.userId(), id));
    }

    @Transactional(readOnly = true)
    ActResult decision(Caller caller, String id) {
        ProjectResult found = proposedProjectFor(caller, id);
        if (found.refusal() != null) {
            return found.refusal();
        }
        List<String> pending = pendingDocuments(id);
        List<Map<String, Object>> rows = pending.stream().map(document -> decidedDocument(id, document)).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("approves", rows.stream().filter(row -> !Boolean.TRUE.equals(row.get("isAskedByOthers"))
                && !hasCopy((String) row.get("documentId"))).toList());
        result.put("skips", rows.stream().filter(row -> Boolean.TRUE.equals(row.get("isAskedByOthers"))
                || hasCopy((String) row.get("documentId"))).toList());
        result.put("pending", rows);
        return ActResult.ok(result);
    }

    @Transactional
    ActResult approve(Caller caller, String id, Approval approval) {
        ProjectResult found = proposedProjectFor(caller, id);
        if (found.refusal() != null) {
            return found.refusal();
        }
        List<String> pending = pendingDocuments(id);
        List<String> taken = pending.stream().filter(document -> !skipDocument(document)).toList();
        String correlation = UUID.randomUUID().toString();
        Instant at = clock.instant();
        for (String documentId : taken) {
            requestDecisions.markProjectAsksAfterApproval(id, documentId);
        }
        dsl.update(PROJECTS).set(PROJECTS.STATE, "Approved")
                .set(PROJECTS.PRIORITY, approval.priority()).set(PROJECTS.ACTED_BY, caller.userId())
                .set(PROJECTS.ACTED_AT, at.atOffset(ZoneOffset.UTC)).where(PROJECTS.ID.eq(id)).execute();
        int skipped = pending.size() - taken.size();
        record(EventCode.PROJECT_APPROVED, id, caller, correlation, at,
                Map.of("priority", approval.priority(), "approved", taken.size()), null,
                skipped > 0 ? skipped + " skipped because a copy exists." : null);
        return ActResult.ok(reads.detail(caller.userId(), id));
    }

    @Transactional
    ActResult reject(Caller caller, String id, Rejection rejection) {
        ProjectResult found = proposedProjectFor(caller, id);
        if (found.refusal() != null) {
            return found.refusal();
        }
        List<String> requests = dsl.select(REQUESTS.ID).from(REQUESTS)
                .where(REQUESTS.PROJECT_ID.eq(id).and(REQUESTS.DECISION.eq("Pending")))
                .orderBy(REQUESTS.AT, REQUESTS.ID).fetch(REQUESTS.ID);
        OffsetDateTime at = clock.instant().atOffset(ZoneOffset.UTC);
        String correlation = UUID.randomUUID().toString();
        requestDecisions.declineProjectAsks(caller.userId(), id, rejection.reason(), at.toInstant(), correlation);
        dsl.update(PROJECTS).set(PROJECTS.STATE, "Rejected").set(PROJECTS.REASON, rejection.reason())
                .set(PROJECTS.ACTED_BY, caller.userId()).set(PROJECTS.ACTED_AT, at)
                .where(PROJECTS.ID.eq(id)).execute();
        intentions.archive(id, caller.userId(), at);
        record(EventCode.PROJECT_REJECTED, id, caller, correlation, at.toInstant(),
                Map.of("declined", requests.size()), null, rejection.reason());
        return ActResult.ok(reads.detail(caller.userId(), id));
    }

    @Transactional
    ActResult delete(Caller caller, String id) {
        ProjectResult found = projectFor(caller, id, PROJECT_DELETE);
        if (found.refusal() != null) {
            return found.refusal();
        }
        if (dsl.fetchExists(dsl.selectOne().from(REQUESTS).where(REQUESTS.PROJECT_ID.eq(id)))) {
            return ActResult.refused(409, "Something has been proposed into it, so it stays as history",
                    "project.has_proposals");
        }
        OffsetDateTime at = clock.instant().atOffset(ZoneOffset.UTC);
        intentions.delete(id);
        dsl.deleteFrom(PROJECT_MEMBER_GROUPS).where(PROJECT_MEMBER_GROUPS.PROJECT_ID.eq(id)).execute();
        dsl.deleteFrom(PROJECT_MEMBERS).where(PROJECT_MEMBERS.PROJECT_ID.eq(id)).execute();
        dsl.deleteFrom(PROJECTS).where(PROJECTS.ID.eq(id)).execute();
        record(EventCode.PROJECT_DELETED, id, caller, UUID.randomUUID().toString(), at.toInstant(),
                Map.of(), null, "It had no proposals.");
        return ActResult.noContent();
    }

    private ProjectResult proposedProjectFor(Caller caller, String id) {
        ProjectResult found = projectFor(caller, id, PROJECT_DECIDE);
        if (found.refusal() != null) {
            return found;
        }
        return "Proposed".equals(found.project().get("state")) ? found
                : ProjectResult.refused(ActResult.refused(409,
                        "It has been decided meanwhile; a decision is final", "project.decided"));
    }

    private ProjectResult projectFor(Caller caller, String id, String permission) {
        Map<String, Object> project = projectQueries.projectsOf(List.of(id)).get(id);
        if (project == null || !access.scopesHeldBy(caller.userId()).reachesProject(PROJECT_READ,
                (String) project.get("managerId"), strings(project.get("memberIds")),
                strings(project.get("memberGroupIds")))) {
            return ProjectResult.refused(ActResult.refused(404, "Project not found", null));
        }
        if (!access.scopesHeldBy(caller.userId()).reachesProject(permission,
                (String) project.get("managerId"), strings(project.get("memberIds")),
                strings(project.get("memberGroupIds")))) {
            return ProjectResult.refused(ActResult.refused(403, "You may not do this to this project", null));
        }
        return ProjectResult.found(project);
    }

    private List<String> pendingDocuments(String projectId) {
        return dsl.selectDistinct(REQUESTS.DOCUMENT_ID).from(REQUESTS)
                .where(REQUESTS.PROJECT_ID.eq(projectId).and(REQUESTS.DECISION.eq("Pending")))
                .orderBy(REQUESTS.DOCUMENT_ID).fetch(REQUESTS.DOCUMENT_ID);
    }

    private Map<String, Object> decidedDocument(String projectId, String id) {
        var document = dsl.select(DOCUMENTS.TITLE).from(DOCUMENTS).where(DOCUMENTS.ID.eq(id)).fetchOne();
        boolean others = dsl.fetchExists(dsl.selectOne().from(REQUESTS)
                .where(REQUESTS.DOCUMENT_ID.eq(id).and(REQUESTS.DECISION.eq("Pending"))
                        .and(REQUESTS.PROJECT_ID.isNull().or(REQUESTS.PROJECT_ID.ne(projectId)))));
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("documentId", id);
        row.put("title", document.get(DOCUMENTS.TITLE));
        row.put("isAskedByOthers", others);
        return row;
    }

    private boolean hasCopy(String documentId) {
        return dsl.fetchExists(dsl.selectOne().from(REQUESTS).join(REQUEST_EXISTING_COPIES)
                .on(REQUEST_EXISTING_COPIES.REQUEST_ID.eq(REQUESTS.ID))
                .where(REQUESTS.DOCUMENT_ID.eq(documentId).and(REQUESTS.DECISION.eq("Pending"))));
    }

    private boolean skipDocument(String documentId) {
        return hasCopy(documentId) || dsl.fetchExists(dsl.selectOne().from(REQUESTS)
                .where(REQUESTS.DOCUMENT_ID.eq(documentId).and(REQUESTS.DECISION.eq("Pending"))
                        .and(REQUESTS.CHECKED_AT.isNull())));
    }

    private void insertMembers(String projectId, List<String> members) {
        for (int index = 0; index < members.size(); index++) {
            dsl.insertInto(PROJECT_MEMBERS).set(PROJECT_MEMBERS.PROJECT_ID, projectId)
                    .set(PROJECT_MEMBERS.USER_ID, members.get(index))
                    .set(PROJECT_MEMBERS.POSITION, index).execute();
        }
    }

    private void insertGroups(String projectId, List<String> groups) {
        for (int index = 0; index < groups.size(); index++) {
            dsl.insertInto(PROJECT_MEMBER_GROUPS).set(PROJECT_MEMBER_GROUPS.PROJECT_ID, projectId)
                    .set(PROJECT_MEMBER_GROUPS.GROUP_ID, groups.get(index))
                    .set(PROJECT_MEMBER_GROUPS.POSITION, index).execute();
        }
    }

    private void addChange(List<Map<String, Object>> changes, String field, Object before, Object after) {
        if (!Objects.equals(before, after)) {
            changes.add(EventChanges.change(field, before, after));
        }
    }

    private List<String> strings(Object value) {
        if (!(value instanceof List<?> values)) {
            return List.of();
        }
        return values.stream().map(String.class::cast).toList();
    }

    private void record(EventCode code, String id, Caller caller, String correlation, Instant at,
            Map<String, Object> data, String publicReason, String internalReason) {
        events.record(new EventInput(code, "project".equals(code.subject()) ? "project" : "request", id,
                null, new EventInput.User(caller.userId()), correlation, at,
                json.valueToTree(data), new EventInput.Reason(publicReason, internalReason)));
    }

    record Draft(String name, String description, String startsOn, String endsOn, Integer targetPages) {}
    record Members(String managerId, List<String> memberIds, List<String> memberGroupIds) {}
    record Approval(String priority) {}
    record Rejection(String reason) {}
    private record ProjectResult(Map<String, Object> project, ActResult refusal) {
        static ProjectResult found(Map<String, Object> project) { return new ProjectResult(project, null); }
        static ProjectResult refused(ActResult refusal) { return new ProjectResult(null, refusal); }
    }
}
