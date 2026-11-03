// What the server does for Projects (projects.md): keep projects to the caller's reach, work out
// each one's period, numbers and pace, gather what it funded and what was proposed into it, and
// carry out its acts: start, edit, members, approve, reject and delete, each logged (§5). Its
// target, planned, delivered and pace are its own intention's (§1.1; intentions.md §3.4), made
// with it, counted by the intention rules over the project's period: the project's dates, name
// and target are written through to it, and it is archived when the project is rejected and
// deleted with it.

import type {
  DecidedDocument,
  DecisionDryRun,
  FundedItem,
  MemberGroup,
  ProjectApproval,
  ProjectChange,
  ProjectDetail,
  ProjectDraft,
  ProjectIndex,
  ProjectList,
  ProjectMembers,
  ProjectProposal,
  ProjectQuery,
  ProjectRejection,
  ProjectRow,
} from "@vera/contract/projects";
import { projectPaces, projectStates } from "@vera/contract/projects";
import { countValues } from "@vera/domain/arrangement";
import { documentIdentifierOf, effectivePageCount, existingCopiesOf } from "@vera/domain/documents";
import type { Intention, Iteration, Project, Request, Session } from "@vera/domain/entities";
import {
  countIntention,
  intentionStateOf,
  intentionTimeElapsedOf,
  targetVerdictOf,
} from "@vera/domain/intentions";
import { listStateOf } from "@vera/domain/lists";
import type { Permission } from "@vera/domain/permissions";
import { can } from "@vera/domain/permissions";
import {
  daysUntil,
  periodOf,
  projectPeriods,
  scopeOfProject,
  timeElapsedOf,
} from "@vera/domain/projects";
import { isProgressAtLeast } from "@vera/domain/status";
import { dayOf, isReversedRange, isWithinRange, resolveDayRange } from "@vera/domain/value-range";
import { database } from "@/mocks/database";
import {
  countingData,
  nextId,
  overallIntention,
  preserveIntentionArchive,
} from "@/mocks/intentions";
import type { Outcome, Refusal } from "@/mocks/mutations";
import { writeLog } from "@/mocks/mutations";
import { mockToday } from "@/mocks/today";

const today = () => dayOf(mockToday);

// ---------------------------------------------------------------- reach

export function canReadProjects(session: Session): boolean {
  return can(session, "project.read");
}

// Deciding reads nothing by itself: it needs `project.read@any` (PERM-requires).
function isVisible(session: Session, project: Project): boolean {
  return can(session, "project.read", scopeOfProject(project));
}

function findVisible(session: Session, projectId: string): Project | null {
  const project = database.projects.find((candidate) => candidate.id === projectId);
  return project === undefined || !isVisible(session, project) ? null : project;
}

// ---------------------------------------------------------------- what it funded

function fundedBy(projectId: string): Iteration[] {
  return database.iterations.filter((iteration) => iteration.projectId === projectId);
}

function pagesOf(iteration: Iteration): number | null {
  const document = database.documents.find((candidate) => candidate.id === iteration.documentId);
  return document === undefined ? null : (effectivePageCount(document)?.value ?? null);
}

const sumPages = (iterations: readonly Iteration[]) =>
  iterations.reduce((sum, iteration) => sum + (pagesOf(iteration) ?? 0), 0);

const isDelivered = (iteration: Iteration) => isProgressAtLeast(iteration.progress, "Digitized");

// On a list that still exists, or already digitized: a deleted list's items stop counting
// (STATUS, decided 2026-10-01). Delivered is a part of it.
const isPlanned = (iteration: Iteration) =>
  isDelivered(iteration) ||
  (iteration.listId !== null && isProgressAtLeast(iteration.progress, "Planned"));

const isWaiting = (iteration: Iteration) =>
  !isPlanned(iteration) && iteration.cancellation === null;

// ---------------------------------------------------------------- proposals

// In any state: what a decision acts on, and what makes a project undeletable.
const proposalsInto = (projectId: string) =>
  database.requests.filter((request) => request.projectId === projectId);

type PendingRequest = Extract<Request, { decision: "Pending" }>;

// The document's pending asks; one decision covers every one of them.
const pendingAsksOf = (documentId: string) =>
  database.requests.filter(
    (request): request is PendingRequest =>
      request.documentId === documentId && request.decision === "Pending",
  );

// A copy or unanswered copy check is left out of approval (LC-PROJ-decide).
function isSkipped(documentId: string): boolean {
  const asks = pendingAsksOf(documentId);
  return existingCopiesOf(asks).length > 0 || asks.some((request) => request.checkedAt === null);
}

function pendingDocumentIdsOf(projectId: string): string[] {
  return [
    ...new Set(
      proposalsInto(projectId)
        .filter((request) => request.decision === "Pending")
        .map((request) => request.documentId),
    ),
  ];
}

function decidedDocumentOf(projectId: string, documentId: string): DecidedDocument {
  const document = database.documents.find((candidate) => candidate.id === documentId);
  return {
    documentId,
    title: document?.title ?? documentId,
    isAskedByOthers: pendingAsksOf(documentId).some((request) => request.projectId !== projectId),
  };
}

// ---------------------------------------------------------------- rows

function memberGroupOf(groupId: string): MemberGroup | null {
  const group = database.groups.find((candidate) => candidate.id === groupId);
  return group === undefined
    ? null
    : { id: group.id, name: group.name, peopleCount: group.memberIds.length };
}

export function listMemberGroups(): MemberGroup[] {
  return database.groups.flatMap((group) => memberGroupOf(group.id) ?? []);
}

// Made with the project; every project has exactly one (intentions.md §3.4).
function intentionOf(project: Pick<Project, "id">): Intention {
  const intention = database.intentions.find((candidate) => candidate.projectId === project.id);
  if (intention === undefined) {
    throw new Error(`Project ${project.id} has no intention`);
  }

  return intention;
}

// Its intention's planned and delivered, and its pace once the project is Approved.
function figuresOf(project: Project, intention: Intention) {
  const counted = countIntention(intention, countingData());
  const isApproved = project.state === "Approved";
  return {
    plannedPages: counted.plannedPages,
    deliveredPages: counted.deliveredPages,
    verdict: isApproved
      ? targetVerdictOf({
          intention,
          plannedPages: counted.plannedPages,
          deliveredPages: counted.deliveredPages,
          today: today(),
        })
      : null,
    evenPace:
      isApproved &&
      intention.targetPages !== null &&
      intentionStateOf(intention, today()) === "Running"
        ? intentionTimeElapsedOf(intention, today())
        : null,
  };
}

function rowOf(project: Project): ProjectRow {
  const funded = fundedBy(project.id);
  const waiting = funded.filter(isWaiting);
  const pending = pendingDocumentIdsOf(project.id);
  const listIds = new Set(funded.flatMap((iteration) => iteration.listId ?? []));
  const intention = intentionOf(project);
  return {
    project,
    intention: { id: intention.id, targetPages: intention.targetPages },
    period: periodOf(project, today()),
    timeElapsed: timeElapsedOf(project, today()),
    daysToStart: Math.max(0, daysUntil(project.startsOn, today())),
    daysLeft: Math.max(0, daysUntil(project.endsOn, today()) + 1),
    ...figuresOf(project, intention),
    fundedCount: funded.length,
    waiting: { itemCount: waiting.length, pages: sumPages(waiting) },
    pending: {
      documentCount: pending.length,
      withCopyCount: pending.filter(isSkipped).length,
    },
    proposalCount: proposalsInto(project.id).length,
    listCount: listIds.size,
    memberGroups: project.memberGroupIds.flatMap((groupId) => memberGroupOf(groupId) ?? []),
  };
}

export function queryProjectIndex(session: Session, query: ProjectQuery = {}): ProjectIndex {
  const search = query.search?.trim().toLowerCase();
  const dates = query.dates === undefined ? undefined : resolveDayRange(query.dates, mockToday);
  const base = database.projects
    .filter((project) => isVisible(session, project))
    .map(rowOf)
    .filter(
      (row) =>
        search === undefined ||
        row.project.name.toLowerCase().includes(search) ||
        row.project.description.toLowerCase().includes(search),
    )
    .filter((row) =>
      dates === undefined
        ? true
        : !isReversedRange(dates) &&
          (dates.from === undefined || row.project.endsOn >= dates.from) &&
          (dates.to === undefined || row.project.startsOn <= dates.to),
    )
    .filter((row) =>
      query.timeElapsed === undefined
        ? true
        : !isReversedRange(query.timeElapsed) &&
          isWithinRange(Math.round(row.timeElapsed * 100), query.timeElapsed),
    )
    .filter((row) =>
      query.delivered === undefined
        ? true
        : !isReversedRange(query.delivered) && isWithinRange(row.deliveredPages, query.delivered),
    );
  const wantedStates = new Set(query.states ?? []);
  const wantedPeriods = new Set(query.periods ?? []);
  const wantedPaces = new Set(query.paces ?? []);
  const matchesState = (row: ProjectRow) =>
    wantedStates.size === 0 || wantedStates.has(row.project.state);
  const matchesPeriod = (row: ProjectRow) =>
    wantedPeriods.size === 0 || wantedPeriods.has(row.period);
  const matchesPace = (row: ProjectRow) =>
    wantedPaces.size === 0 ||
    (wantedPaces.has("BehindPace") && row.verdict === "behindPace") ||
    (wantedPaces.has("OnTrack") && row.verdict === "onPace");
  const rows = base.filter((row) => matchesState(row) && matchesPeriod(row) && matchesPace(row));
  const stateCounts = countValues(
    base.filter((row) => matchesPeriod(row) && matchesPace(row)).map((row) => row.project.state),
  );
  const periodCounts = countValues(
    base.filter((row) => matchesState(row) && matchesPace(row)).map((row) => row.period),
  );
  const paceRows = base.filter((row) => matchesState(row) && matchesPeriod(row));
  return {
    rows,
    total: rows.length,
    facets: {
      states: projectStates.flatMap((value) => {
        const found = stateCounts.find((entry) => entry.value === value);
        return found === undefined ? [] : [{ value, count: found.count }];
      }),
      periods: projectPeriods.flatMap((value) => {
        const found = periodCounts.find((entry) => entry.value === value);
        return found === undefined ? [] : [{ value, count: found.count }];
      }),
      paces: projectPaces.flatMap((value) => {
        const count = paceRows.filter(
          (row) =>
            (value === "BehindPace" && row.verdict === "behindPace") ||
            (value === "OnTrack" && row.verdict === "onPace"),
        ).length;
        return count === 0 ? [] : [{ value, count }];
      }),
    },
  };
}

// ---------------------------------------------------------------- detail

function requestRowsOf(projectId: string): ProjectProposal[] {
  const asks = proposalsInto(projectId).toSorted((first, second) =>
    first.at.localeCompare(second.at),
  );
  const byDocument = new Map<string, Request>();
  for (const request of asks) {
    byDocument.set(request.documentId, byDocument.get(request.documentId) ?? request);
  }

  return [...byDocument.values()].flatMap((request) => {
    const document = database.documents.find((candidate) => candidate.id === request.documentId);
    if (document === undefined) {
      return [];
    }

    return [
      {
        documentId: document.id,
        title: document.title,
        identifier: documentIdentifierOf(document),
        requesterId: request.requesterId,
        at: request.at,
        decision: request.decision,
        isAfterProjectApproval:
          request.decision === "Pending" ? request.isAfterProjectApproval : false,
        hasCopy: request.existingCopies.length > 0,
      },
    ];
  });
}

function listsOf(funded: readonly Iteration[]): ProjectList[] {
  return database.lists.flatMap((list) => {
    const members = funded.filter((iteration) => iteration.listId === list.id);
    return members.length === 0
      ? []
      : [
          {
            list,
            state: listStateOf(list, today()),
            itemCount: members.length,
            pages: sumPages(members),
          },
        ];
  });
}

function formerListsOf(funded: readonly Iteration[]) {
  const names = new Map<string, number>();
  for (const iteration of funded) {
    if (iteration.listId === null && iteration.formerListName !== null) {
      names.set(iteration.formerListName, (names.get(iteration.formerListName) ?? 0) + 1);
    }
  }

  return [...names].map(([name, itemCount]) => ({ name, itemCount }));
}

function fundedItemsOf(funded: readonly Iteration[]): FundedItem[] {
  return funded.flatMap((iteration) => {
    const document = database.documents.find((candidate) => candidate.id === iteration.documentId);
    if (document === undefined) {
      return [];
    }

    const list = database.lists.find((candidate) => candidate.id === iteration.listId);
    return [
      {
        iteration,
        document,
        pages: pagesOf(iteration),
        listName: list?.name ?? iteration.formerListName,
      },
    ];
  });
}

function detailOf(project: Project): ProjectDetail {
  const funded = fundedBy(project.id);
  return {
    row: rowOf(project),
    proposals: requestRowsOf(project.id),
    lists: listsOf(funded),
    formerLists: formerListsOf(funded),
    funded: fundedItemsOf(funded),
    log: database.statusLog
      .filter((entry) => entry.subjectKind === "project" && entry.subjectId === project.id)
      .toSorted((first, second) => second.at.localeCompare(first.at)),
  };
}

export function findProjectDetail(session: Session, projectId: string): ProjectDetail | null {
  const project = findVisible(session, projectId);
  return project === null ? null : detailOf(project);
}

// ---------------------------------------------------------------- acts

const notFound: Refusal = { status: 404, message: "Project not found" };

const decidedRefusal: Refusal = {
  status: 409,
  message: "It has been decided meanwhile; a decision is final",
  code: "project.decided",
};

// Found, visible, and within the scope of the permission the act needs.
function projectFor(session: Session, projectId: string, permission: Permission): Outcome<Project> {
  const project = findVisible(session, projectId);
  if (project === null) {
    return { refusal: notFound };
  }

  if (!can(session, permission, scopeOfProject(project))) {
    return { refusal: { status: 403, message: "You may not do this to this project" } };
  }

  return { value: project };
}

function replaceProject(project: Project): void {
  const index = database.projects.findIndex((candidate) => candidate.id === project.id);
  database.projects.splice(index, 1, project);
}

// Its intention follows the project: name, funding and window are the project's, the target is
// the one entered on the project form (intentions.md §3.4).
function intentionFollowing(
  project: Project,
  targetPages: number | null,
  intention: Intention,
): Intention {
  return {
    ...intention,
    name: project.name,
    funding: { kind: "project", projectId: project.id },
    projectId: project.id,
    countsFrom: project.startsOn,
    endsOn: project.endsOn,
    targetPages,
  };
}

function replaceIntention(intention: Intention): void {
  database.intentions = database.intentions.map((candidate) =>
    candidate.id === intention.id ? intention : candidate,
  );
}

// Starting needs its own grant; it starts Proposed, the creator its manager and only member
// (flows.md PJ1). Its intention is made with it, without a mix (PLAN-no-mix), and is
// listed on Intentions once the project is decided.
export function createProject(session: Session, draft: ProjectDraft): Outcome<ProjectDetail> {
  if (!can(session, "project.create")) {
    return { refusal: { status: 403, message: "You may not start projects" } };
  }

  const { targetPages, ...fields } = draft;
  const project: Project = {
    id: nextProjectId(),
    ...fields,
    managerId: session.user.id,
    memberIds: [session.user.id],
    memberGroupIds: [],
    createdAt: new Date().toISOString(),
    state: "Proposed",
  };
  database.projects.push(project);
  const overall = overallIntention();
  database.intentions.push(
    intentionFollowing(project, targetPages, {
      ...overall,
      id: nextId(
        "i",
        database.intentions.map((intention) => intention.id),
      ),
      description: "",
      scopeCategoryId: null,
      distributionId: null,
      isOverall: false,
      templateId: null,
      archived: null,
    }),
  );
  logProject(
    session,
    project,
    crypto.randomUUID(),
    new Date().toISOString(),
    "project.created",
    {},
    null,
  );
  return { value: detailOf(project) };
}

// What the edit would do to its intention's figures: new dates move its window (§3.4).
export function previewProjectChange(
  session: Session,
  projectId: string,
  draft: ProjectDraft,
): Outcome<ProjectChange> {
  const found = projectFor(session, projectId, "project.edit");
  if ("refusal" in found) {
    return found;
  }

  const project = found.value;
  const intention = intentionOf(project);
  const { targetPages, ...fields } = draft;
  const data = countingData();
  const before = countIntention(intention, data);
  const after = countIntention(
    intentionFollowing({ ...project, ...fields }, targetPages, intention),
    data,
  );
  return {
    value: {
      plannedPages: { before: before.plannedPages, after: after.plannedPages },
      deliveredPages: { before: before.deliveredPages, after: after.deliveredPages },
    },
  };
}

// Details, description, dates and its intention's target (flows.md PJ2). On an Approved project
// the dates and target stay editable, since a grant can be extended (PJ6); its decision and
// priority do not. The intention follows: its window moves with the dates and is recounted.
export function saveProject(
  session: Session,
  projectId: string,
  draft: ProjectDraft,
): Outcome<ProjectDetail> {
  const found = projectFor(session, projectId, "project.edit");
  if ("refusal" in found) {
    return found;
  }

  const project = found.value;
  const intention = intentionOf(project);
  const { targetPages, ...fields } = draft;
  const saved: Project = { ...project, ...fields };
  replaceProject(saved);
  replaceIntention(intentionFollowing(saved, targetPages, intention));
  const correlationId = crypto.randomUUID();
  const now = new Date().toISOString();
  const changes = [
    ...(saved.startsOn === project.startsOn
      ? []
      : [{ field: "startsOn", from: project.startsOn, to: saved.startsOn }]),
    ...(saved.endsOn === project.endsOn
      ? []
      : [{ field: "endsOn", from: project.endsOn, to: saved.endsOn }]),
    ...(targetPages === intention.targetPages
      ? []
      : [{ field: "targetPages", from: intention.targetPages, to: targetPages }]),
  ];
  if (changes.length > 0) {
    logProject(session, saved, correlationId, now, "project.dates_changed", { changes }, null);
  }

  if (saved.name !== project.name || saved.description !== project.description) {
    logProject(
      session,
      saved,
      correlationId,
      now,
      "project.details_changed",
      {
        changes: [
          ...(saved.name === project.name
            ? []
            : [{ field: "name", from: project.name, to: saved.name }]),
          ...(saved.description === project.description
            ? []
            : [{ field: "description", from: project.description, to: saved.description }]),
        ],
      },
      null,
    );
  }

  return { value: detailOf(saved) };
}

// The whole set of members at once. The manager is always one; handing over keeps the old manager
// a member until removed, and a removed member's proposals stay in the project (flows.md PJ2,
// PJ4).
export function saveProjectMembers(
  session: Session,
  projectId: string,
  members: ProjectMembers,
): Outcome<ProjectDetail> {
  const found = projectFor(session, projectId, "project.manage_members");
  if ("refusal" in found) {
    return found;
  }

  const unknownUser = members.memberIds.find(
    (userId) => !database.users.some((user) => user.id === userId && user.kind === "person"),
  );
  if (unknownUser !== undefined) {
    return {
      refusal: { status: 422, code: "person.not_found", message: `No person ${unknownUser}` },
    };
  }

  const unknownGroup = members.memberGroupIds.find(
    (groupId) => !database.groups.some((group) => group.id === groupId),
  );
  if (unknownGroup !== undefined) {
    return {
      refusal: { status: 422, code: "group.not_found", message: `No group ${unknownGroup}` },
    };
  }

  const project = found.value;
  const memberIds = [...new Set(members.memberIds)];
  const memberGroupIds = [...new Set(members.memberGroupIds)];
  const saved: Project = { ...project, managerId: members.managerId, memberIds, memberGroupIds };
  replaceProject(saved);

  const correlationId = crypto.randomUUID();
  const now = new Date().toISOString();
  const log = (code: "project.member_added" | "project.member_removed", userId: string) =>
    logProject(session, saved, correlationId, now, code, { userId }, null);
  for (const userId of memberIds.filter((userId) => !project.memberIds.includes(userId))) {
    log("project.member_added", userId);
  }

  for (const userId of project.memberIds.filter((userId) => !memberIds.includes(userId))) {
    log("project.member_removed", userId);
  }

  if (memberGroupIds.join("\u0000") !== project.memberGroupIds.join("\u0000")) {
    logProject(
      session,
      saved,
      correlationId,
      now,
      "project.details_changed",
      {
        changes: [{ field: "memberGroupIds", from: project.memberGroupIds, to: memberGroupIds }],
      },
      null,
    );
  }

  if (saved.managerId !== project.managerId) {
    logProject(
      session,
      saved,
      correlationId,
      now,
      "project.manager_changed",
      {
        userId: { from: project.managerId, to: saved.managerId },
      },
      null,
    );
  }

  return { value: detailOf(saved) };
}

function proposedProjectFor(session: Session, projectId: string): Outcome<Project> {
  const found = projectFor(session, projectId, "project.decide");
  if ("refusal" in found) {
    return found;
  }

  return found.value.state === "Proposed" ? found : { refusal: decidedRefusal };
}

export function previewDecision(session: Session, projectId: string): Outcome<DecisionDryRun> {
  const found = proposedProjectFor(session, projectId);
  if ("refusal" in found) {
    return found;
  }

  const project = found.value;
  const pending = pendingDocumentIdsOf(project.id).map((documentId) =>
    decidedDocumentOf(project.id, documentId),
  );
  return {
    value: {
      approves: pending.filter(({ documentId }) => !isSkipped(documentId)),
      skips: pending.filter(({ documentId }) => isSkipped(documentId)),
      pending,
    },
  };
}

// Approving picks the priority, set once (projects.md §2.1), and approves every document pending
// in it at that moment but those skipped (flows.md D11). Each waits for ingest, which classifies
// it, before it has an iteration (relationships.md §2).
export function approveProject(
  session: Session,
  projectId: string,
  approval: ProjectApproval,
): Outcome<ProjectDetail> {
  const found = proposedProjectFor(session, projectId);
  if ("refusal" in found) {
    return found;
  }

  const project = found.value;
  const now = new Date().toISOString();
  const correlationId = crypto.randomUUID();
  const pending = pendingDocumentIdsOf(project.id);
  const taken = pending.filter((documentId) => !isSkipped(documentId));
  for (const documentId of taken) {
    for (const ask of pendingAsksOf(documentId)) {
      replaceRequest({
        ...withoutPendingFields(ask),
        decision: "Approved",
        iteration: null,
        rescan: null,
      });
      // Project decisions are recorded on the project; ingest has not created an iteration yet.
    }
  }

  const approved: Project = {
    ...project,
    state: "Approved",
    priority: approval.priority,
    actorId: session.user.id,
    at: now,
  };
  replaceProject(approved);
  const skipped = pending.length - taken.length;
  logProject(
    session,
    approved,
    correlationId,
    now,
    "project.approved",
    { priority: approval.priority, approved: taken.length },
    skipped > 0 ? { public: null, internal: `${skipped} skipped because a copy exists.` } : null,
  );
  return { value: detailOf(approved) };
}

// Only the project's own asks are rejected; a document others asked for stays theirs (flows.md
// D12). Every member reads the reason.
export function rejectProject(
  session: Session,
  projectId: string,
  rejection: ProjectRejection,
): Outcome<ProjectDetail> {
  const found = proposedProjectFor(session, projectId);
  if ("refusal" in found) {
    return found;
  }

  const project = found.value;
  const now = new Date().toISOString();
  const correlationId = crypto.randomUUID();
  const asks = proposalsInto(project.id).filter(
    (request): request is PendingRequest => request.decision === "Pending",
  );
  for (const ask of asks) {
    replaceRequest({
      ...withoutPendingFields(ask),
      decision: "Denied",
      decline: {
        actorId: session.user.id,
        at: now,
        publicText: rejection.reason,
        internalText: null,
      },
    });
    logRequest(
      session,
      ask,
      correlationId,
      now,
      asks.length > 1 ? asks.length : null,
      rejection.reason,
    );
  }

  const rejected: Project = {
    ...project,
    state: "Rejected",
    reason: rejection.reason,
    actorId: session.user.id,
    at: now,
  };
  replaceProject(rejected);
  // Its intention stays, archived, so what it counted can still be read (intentions.md §3.4).
  const intention = intentionOf(project);
  preserveIntentionArchive({
    ...intention,
    archived: intention.archived ?? { actor: { kind: "user", userId: session.user.id }, at: now },
  });
  logProject(
    session,
    rejected,
    correlationId,
    now,
    "project.rejected",
    { declined: asks.length },
    {
      public: null,
      internal: rejection.reason,
    },
  );
  return { value: detailOf(rejected) };
}

// Only while nothing was ever proposed into it: anything else is history (projects.md §3).
export function deleteProject(session: Session, projectId: string): Outcome<null> {
  const found = projectFor(session, projectId, "project.delete");
  if ("refusal" in found) {
    return found;
  }

  const project = found.value;
  if (proposalsInto(project.id).length > 0) {
    return {
      refusal: {
        status: 409,
        message: "Something has been proposed into it, so it stays as history",
        code: "project.has_proposals",
      },
    };
  }

  const intention = intentionOf(project);

  database.projects.splice(database.projects.indexOf(project), 1);
  database.intentions = database.intentions.filter((candidate) => candidate !== intention);
  logProject(
    session,
    project,
    crypto.randomUUID(),
    new Date().toISOString(),
    "project.deleted",
    {},
    { public: null, internal: "It had no proposals." },
  );
  return { value: null };
}

// ---------------------------------------------------------------- records

function nextProjectId(): string {
  const numbers = database.projects.map((project) => Number(project.id.slice(1)) || 0);
  return `p${Math.max(0, ...numbers) + 1}`;
}

// LOG-one-act-one-story: every entry of one act shares its correlation ID and its time, so the
// log keeps them in the order they were written.
function logProject(
  session: Session,
  project: Project,
  correlationId: string,
  at: string,
  code:
    | "project.created"
    | "project.details_changed"
    | "project.dates_changed"
    | "project.member_added"
    | "project.member_removed"
    | "project.manager_changed"
    | "project.approved"
    | "project.rejected"
    | "project.deleted",
  data: unknown,
  reason: { public: string | null; internal: string | null } | null,
): void {
  writeLog({
    subjectKind: "project",
    subjectId: project.id,
    at,
    actor: { kind: "user", userId: session.user.id },
    correlationId,
    code,
    data: data as never,
    reason: reason ?? { public: null, internal: null },
  });
}

function logRequest(
  session: Session,
  request: Request,
  correlationId: string,
  at: string,
  batchSize: number | null,
  detail: string | null,
): void {
  writeLog({
    subjectKind: "request",
    subjectId: request.id,
    at,
    actor: { kind: "user", userId: session.user.id },
    correlationId,
    code: "request.declined",
    data: { batchSize },
    reason: { public: detail, internal: null },
  });
}

function withoutPendingFields(request: PendingRequest) {
  const { decision: _decision, isAfterProjectApproval: _isAfterProjectApproval, ...base } = request;
  return base;
}

function replaceRequest(request: Request): void {
  const index = database.requests.findIndex((candidate) => candidate.id === request.id);
  database.requests.splice(index, 1, request);
}
