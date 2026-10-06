// What the server does for Projects (projects.md): keep projects to the caller's reach, work out
// each one's period, numbers and pace, gather what it funded and what was proposed into it, and
// carry out its acts: start, edit, members, approve, reject and delete, each logged (§5).
// TODO(rrandiak): the intentions a project funds wait for intentions in the mock API (plan.md
// step 6); until then neither the card's *No intention yet* nor the detail's Intentions exist.

import type {
  DecidedDocument,
  DecisionDryRun,
  FundedItem,
  MemberGroup,
  ProjectApproval,
  ProjectDetail,
  ProjectDraft,
  ProjectIndex,
  ProjectList,
  ProjectMembers,
  ProjectProposal,
  ProjectRejection,
  ProjectRow,
} from "@/api/projects";
import { documentIdentifierOf, effectivePageCount, existingCopiesOf } from "@/domain/documents";
import type { Iteration, Project, Request, Session } from "@/domain/entities";
import { listStateOf } from "@/domain/lists";
import type { Permission } from "@/domain/permissions";
import { can } from "@/domain/permissions";
import {
  daysUntil,
  evenPaceOf,
  paceVerdictOf,
  periodOf,
  scopeOfProject,
  timeElapsedOf,
} from "@/domain/projects";
import { isProgressAtLeast } from "@/domain/status";
import { formatCalendarDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";
import { dayOf } from "@/lib/value-range";
import { database } from "@/mocks/database";
import { groups } from "@/mocks/fixtures/access";
import type { Outcome, Refusal } from "@/mocks/mutations";
import { writeLog } from "@/mocks/mutations";
import { mockToday } from "@/mocks/today";

const today = () => dayOf(mockToday);

// ---------------------------------------------------------------- reach

export function canReadProjects(session: Session): boolean {
  return can(session, "project.read") || can(session, "project.decide");
}

// Deciding projects includes seeing every one (projects.md §3, decided 2026-10-01).
function isVisible(session: Session, project: Project): boolean {
  return can(session, "project.decide") || can(session, "project.read", scopeOfProject(project));
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

// A copy exists, or the copy check has not answered: either way it is decided on its own, as a
// rescan if it is one (flows.md D11).
// TODO(rrandiak): the design names only the copy as a reason to skip; confirm that an ask still
// being checked is skipped too, rather than held until the check answers.
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
  const group = groups.find((candidate) => candidate.id === groupId);
  return group === undefined
    ? null
    : { id: group.id, name: group.name, peopleCount: group.memberIds.length };
}

export function listMemberGroups(): MemberGroup[] {
  return groups.flatMap((group) => memberGroupOf(group.id) ?? []);
}

function rowOf(project: Project): ProjectRow {
  const funded = fundedBy(project.id);
  const delivered = funded.filter(isDelivered);
  const waiting = funded.filter(isWaiting);
  const pending = pendingDocumentIdsOf(project.id);
  const listIds = new Set(funded.flatMap((iteration) => iteration.listId ?? []));
  return {
    project,
    period: periodOf(project, today()),
    timeElapsed: timeElapsedOf(project, today()),
    daysToStart: Math.max(0, daysUntil(project.startsOn, today())),
    daysLeft: Math.max(0, daysUntil(project.endsOn, today()) + 1),
    evenPace: evenPaceOf(project, today()),
    verdict: paceVerdictOf({
      project,
      fundedCount: funded.length,
      deliveredPages: sumPages(delivered),
      today: today(),
    }),
    fundedCount: funded.length,
    plannedPages: sumPages(funded.filter(isPlanned)),
    deliveredPages: sumPages(delivered),
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

export function queryProjectIndex(session: Session): ProjectIndex {
  return { rows: database.projects.filter((project) => isVisible(session, project)).map(rowOf) };
}

// ---------------------------------------------------------------- detail

function proposalRowsOf(projectId: string): ProjectProposal[] {
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
    proposals: proposalRowsOf(project.id),
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

// Starting needs its own grant; it starts Proposed, the creator its manager and only member
// (flows.md PJ1).
export function createProject(session: Session, draft: ProjectDraft): Outcome<ProjectDetail> {
  if (!can(session, "project.create")) {
    return { refusal: { status: 403, message: "You may not start projects" } };
  }

  const project: Project = {
    id: nextProjectId(),
    ...draft,
    managerId: session.user.id,
    memberIds: [session.user.id],
    memberGroupIds: [],
    createdAt: new Date().toISOString(),
    state: "Proposed",
  };
  database.projects.push(project);
  logProject(session, project, crypto.randomUUID(), "Created", `${periodText(project)} · proposed`);
  return { value: detailOf(project) };
}

// Details, description, dates and target (flows.md PJ2). On an Approved project the dates and
// target stay editable, since a grant can be extended (PJ6); its decision and priority do not.
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
  const saved: Project = { ...project, ...draft };
  replaceProject(saved);
  const correlationId = crypto.randomUUID();
  if (periodText(saved) !== periodText(project)) {
    logProject(
      session,
      saved,
      correlationId,
      "Dates or target changed",
      `${periodText(project)} → ${periodText(saved)}`,
    );
  }

  if (saved.name !== project.name || saved.description !== project.description) {
    logProject(
      session,
      saved,
      correlationId,
      "Details changed",
      saved.name === project.name ? null : `${project.name} → ${saved.name}`,
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
    return { refusal: { status: 422, message: `No person ${unknownUser}` } };
  }

  const unknownGroup = members.memberGroupIds.find(
    (groupId) => !groups.some((group) => group.id === groupId),
  );
  if (unknownGroup !== undefined) {
    return { refusal: { status: 422, message: `No group ${unknownGroup}` } };
  }

  const project = found.value;
  const memberIds = [...new Set(members.memberIds)];
  const memberGroupIds = [...new Set(members.memberGroupIds)];
  const saved: Project = { ...project, managerId: members.managerId, memberIds, memberGroupIds };
  replaceProject(saved);

  const correlationId = crypto.randomUUID();
  const log = (event: string, detail: string) =>
    logProject(session, saved, correlationId, event, detail);
  for (const userId of memberIds.filter((userId) => !project.memberIds.includes(userId))) {
    log("Member added", nameOf(userId));
  }

  for (const userId of project.memberIds.filter((userId) => !memberIds.includes(userId))) {
    log("Member removed", `${nameOf(userId)} — their proposals stay in the project`);
  }

  for (const groupId of memberGroupIds.filter((id) => !project.memberGroupIds.includes(id))) {
    log("Member added", `${groupNameOf(groupId)} (group)`);
  }

  for (const groupId of project.memberGroupIds.filter((id) => !memberGroupIds.includes(id))) {
    log("Member removed", `${groupNameOf(groupId)} (group)`);
  }

  if (saved.managerId !== project.managerId) {
    log("Manager changed", `${nameOf(project.managerId)} → ${nameOf(saved.managerId)}`);
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
      logRequest(session, ask, correlationId, now, `Approved with ${project.name}`, null);
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
    "Approved",
    [
      `priority ${approval.priority}`,
      `${plural(taken.length, "proposal")} approved`,
      skipped > 0 ? `${skipped} skipped (a copy exists)` : null,
    ]
      .filter((part) => part !== null)
      .join(" · "),
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
    logRequest(session, ask, correlationId, now, `Declined with ${project.name}`, rejection.reason);
  }

  const rejected: Project = {
    ...project,
    state: "Rejected",
    reason: rejection.reason,
    actorId: session.user.id,
    at: now,
  };
  replaceProject(rejected);
  logProject(session, rejected, correlationId, "Rejected", rejection.reason);
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

  database.projects.splice(database.projects.indexOf(project), 1);
  logProject(session, project, crypto.randomUUID(), "Deleted", "it had no proposals");
  return { value: null };
}

// ---------------------------------------------------------------- records

function nextProjectId(): string {
  const numbers = database.projects.map((project) => Number(project.id.slice(1)) || 0);
  return `p${Math.max(0, ...numbers) + 1}`;
}

function periodText(project: Pick<Project, "startsOn" | "endsOn" | "targetPages">): string {
  return `${formatCalendarDay(project.startsOn)} → ${formatCalendarDay(project.endsOn)} · ${formatCount(project.targetPages)} pp`;
}

function nameOf(userId: string): string {
  return database.users.find((user) => user.id === userId)?.name ?? userId;
}

function groupNameOf(groupId: string): string {
  return groups.find((group) => group.id === groupId)?.name ?? groupId;
}

function logProject(
  session: Session,
  project: Project,
  correlationId: string,
  event: string,
  detail: string | null,
): void {
  writeLog({
    subjectKind: "project",
    subjectId: project.id,
    at: new Date().toISOString(),
    actor: { kind: "user", userId: session.user.id },
    correlationId,
    event,
    detail,
  });
}

function logRequest(
  session: Session,
  request: Request,
  correlationId: string,
  at: string,
  event: string,
  detail: string | null,
): void {
  writeLog({
    subjectKind: "request",
    subjectId: request.id,
    at,
    actor: { kind: "user", userId: session.user.id },
    correlationId,
    event,
    detail,
  });
}

function withoutPendingFields(request: PendingRequest) {
  const {
    decision: _decision,
    approveOnCheck: _approveOnCheck,
    isAfterProjectApproval: _isAfterProjectApproval,
    ...base
  } = request;
  return base;
}

function replaceRequest(request: Request): void {
  const index = database.requests.findIndex((candidate) => candidate.id === request.id);
  database.requests.splice(index, 1, request);
}
