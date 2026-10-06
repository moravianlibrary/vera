// What the server does for Digitization Lists: keep the lists to the caller's reach, work out
// each one's state and counts from its dates and members, gather the pool a list draws from with
// what review still holds back, and save what the editor built. Saving writes the members'
// progress as the list's start says (flows.md L1, L2): a real server derives it on read.

import type {
  DeletionDryRun,
  ListDetail,
  ListDraft,
  ListItem,
  ListPage,
  ListQuery,
  ListRow,
  MarkDoneDryRun,
  NotDigitizableRequest,
  PoolPage,
  PoolQuery,
} from "@/api/lists";
import { listSliceSize } from "@/api/lists";
import { categoryLineageOf, categoryPathOf } from "@/domain/categories";
import { effectivePageCount } from "@/domain/documents";
import type { DigitizationList, Iteration, Session, StatusLogEntry } from "@/domain/entities";
import { priorities } from "@/domain/entities";
import { progressAfterGates, scopeOfIteration } from "@/domain/iterations";
import type { ListState } from "@/domain/lists";
import {
  isInPool,
  isOverdue,
  isScanned,
  listStateOf,
  listStates,
  memberBlockerOf,
  progressOnList,
} from "@/domain/lists";
import type { Permission } from "@/domain/permissions";
import { can, hasPermission, scopesOf } from "@/domain/permissions";
import { scopeOfProject } from "@/domain/projects";
import { isRestricted, statusFootnoteOf, validationOf } from "@/domain/status";
import { formatShortCalendarDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import { dayOf } from "@/lib/value-range";
import { countValues, sliceOf } from "@/mocks/arrangement";
import { database } from "@/mocks/database";
import {
  countingMembersOf,
  countsTowardsRowsOf,
  generatedWithOf,
  savedListMixOf,
} from "@/mocks/intention-lists";
import type { Outcome } from "@/mocks/mutations";
import { replaceIteration, writeLog } from "@/mocks/mutations";
import { mockToday } from "@/mocks/today";

const today = () => dayOf(mockToday);

type Slice = { cursor: string | null; limit: number };

// ---------------------------------------------------------------- reach

export function canReadLists(session: Session): boolean {
  return can(session, "list.read");
}

// Building a list needs the pool; either grant opens it.
export function canBuildLists(session: Session): boolean {
  return hasPermission(session, "list.create") || hasPermission(session, "list.edit");
}

function membersOf(listId: string): Iteration[] {
  return database.iterations.filter((iteration) => iteration.listId === listId);
}

// TODO(rrandiak): permissions.md §3 gives `list.read` the scopes custody and project without
// saying what brings a list within them; read here as any member in the caller's custody, or
// funded by a project they are on. An empty list is then reached only at `any`.
function isInReach(session: Session, list: DigitizationList): boolean {
  if (scopesOf(session, "list.read").includes("any")) {
    return true;
  }

  return membersOf(list.id).some((iteration) => {
    if (can(session, "list.read", scopeOfIteration(database.categories, iteration.categoryId))) {
      return true;
    }

    const project = database.projects.find((candidate) => candidate.id === iteration.projectId);
    return project !== undefined && can(session, "list.read", scopeOfProject(project));
  });
}

// ---------------------------------------------------------------- rows

function pagesOf(iteration: Iteration): number | null {
  const document = database.documents.find((candidate) => candidate.id === iteration.documentId);
  return document === undefined ? null : (effectivePageCount(document)?.value ?? null);
}

const sumPages = (iterations: readonly Iteration[]) =>
  iterations.reduce((sum, iteration) => sum + (pagesOf(iteration) ?? 0), 0);

function originatingRequestOf(iteration: Iteration) {
  return database.requests.find((request) => request.id === iteration.requestId);
}

function lateCopyOf(iteration: Iteration) {
  const copies = originatingRequestOf(iteration)?.existingCopies ?? [];
  return copies.find((copy) => copy.foundAfterApproval) ?? null;
}

function rowOf(list: DigitizationList): ListRow {
  const members = membersOf(list.id);
  const scanned = members.filter(isScanned);
  return {
    list,
    state: listStateOf(list, today()),
    isOverdue: isOverdue(list, today()),
    itemCount: members.length,
    pages: sumPages(members),
    scannedItemCount: scanned.length,
    scannedPages: sumPages(scanned),
    blockedCount: members.filter((iteration) => memberBlockerOf(iteration) !== null).length,
    lateCopyCount: members.filter((iteration) => lateCopyOf(iteration) !== null).length,
    reviewNeededCount: members.filter((iteration) => statusFootnoteOf(iteration) !== null).length,
    notDigitizableCount: members.filter(
      (iteration) => iteration.cancellation?.cause === "NotDigitizable",
    ).length,
    cancelledCount: members.filter((iteration) => iteration.cancellation?.cause === "Decided")
      .length,
    countsTowards: countsTowardsRowsOf(countingMembersOf(list.id), list.startsOn).map((row) => ({
      id: row.intentionId,
      name: row.name,
      isOverall: row.isOverall,
    })),
    generatedWith: (() => {
      const intention = generatedWithOf(list);
      return intention === null ? null : { id: intention.id, name: intention.name };
    })(),
  };
}

export function itemOf(iteration: Iteration): ListItem | null {
  const document = database.documents.find((candidate) => candidate.id === iteration.documentId);
  const request = originatingRequestOf(iteration);
  if (document === undefined || request === undefined) {
    return null;
  }

  return {
    iteration,
    document,
    pages: pagesOf(iteration),
    askedAt: request.at,
    blocker: memberBlockerOf(iteration),
    lateCopy: lateCopyOf(iteration),
  };
}

// Highest priority first, then the oldest ask: the reference generator's order (intentions.md
// §4.2), so a hand-built list reads the same way.
export function byPriorityThenAge(first: ListItem, second: ListItem): number {
  const rankOf = (item: ListItem) => priorities.indexOf(item.iteration.priority);
  return rankOf(second) - rankOf(first) || first.askedAt.localeCompare(second.askedAt);
}

// Running first, then what is coming by start, then what is done, latest first.
function byState(first: ListRow, second: ListRow): number {
  const order: readonly ListState[] = ["InProgress", "Planned", "Done"];
  const rank = order.indexOf(first.state) - order.indexOf(second.state);
  if (rank !== 0) {
    return rank;
  }

  return first.state === "Done"
    ? second.list.endsOn.localeCompare(first.list.endsOn)
    : first.list.startsOn.localeCompare(second.list.startsOn);
}

// ---------------------------------------------------------------- list and detail

export function queryLists(
  session: Session,
  query: ListQuery,
  slice: Slice = { cursor: null, limit: listSliceSize },
): ListPage {
  const search = query.search?.toLowerCase();
  const searched = database.lists
    .filter((list) => isInReach(session, list))
    .map(rowOf)
    .filter(
      (row) =>
        search === undefined ||
        row.list.name.toLowerCase().includes(search) ||
        row.list.id.toLowerCase() === search,
    );
  const wanted = new Set(query.states ?? []);
  const matching = searched
    .filter((row) => wanted.size === 0 || wanted.has(row.state))
    .toSorted(byState);
  const { items, nextCursor } = sliceOf(matching, (row) => row.list.id, slice);
  const states = countValues(searched.map((row) => row.state));

  return {
    items,
    total: matching.length,
    nextCursor,
    // A facet counts over every other filter, so picking a state never hides the others.
    facets: {
      states: listStates.flatMap((value) => {
        const found = states.find((entry) => entry.value === value);
        return found === undefined ? [] : [{ value, count: found.count }];
      }),
    },
  };
}

function findReachableList(session: Session, listId: string): DigitizationList | null {
  const list = database.lists.find((candidate) => candidate.id === listId);
  return list === undefined || !isInReach(session, list) ? null : list;
}

function detailOf(list: DigitizationList): ListDetail {
  return {
    row: rowOf(list),
    members: membersOf(list.id)
      .flatMap((iteration) => itemOf(iteration) ?? [])
      .toSorted(byPriorityThenAge),
    // The list's own entries; each member keeps its own story in Documents.
    log: database.statusLog
      .filter((entry) => entry.subjectKind === "list" && entry.subjectId === list.id)
      .toSorted((first, second) => second.at.localeCompare(first.at)),
    countsTowards: countsTowardsRowsOf(countingMembersOf(list.id), list.startsOn),
    mix: savedListMixOf(list),
  };
}

export function findListDetail(session: Session, listId: string): ListDetail | null {
  const list = findReachableList(session, listId);
  return list === null ? null : detailOf(list);
}

// ---------------------------------------------------------------- the pool

export function topCategoryOf(categoryId: string): string {
  return categoryPathOf(database.categories, categoryId)[0]?.id ?? categoryId;
}

// Approved, on no list, and held only by a defect still to rule on or denied.
export function isHeldInReview(iteration: Iteration): boolean {
  return (
    iteration.listId === null &&
    iteration.progress === "Enqueued" &&
    iteration.cancellation === null &&
    !isRestricted(iteration) &&
    ["Needed", "Denied"].includes(validationOf(iteration))
  );
}

function matchesPool(item: ListItem, query: PoolQuery): boolean {
  const { categoryId, search } = query;
  if (
    categoryId !== undefined &&
    !categoryLineageOf(database.categories, item.iteration.categoryId).includes(categoryId)
  ) {
    return false;
  }

  if (search === undefined) {
    return true;
  }

  const needle = search.toLowerCase();
  const { document, iteration } = item;
  const texts = [document.title, document.catalogId, document.unit?.value, document.signature];
  return (
    texts.some((text) => text?.toLowerCase().includes(needle)) ||
    [iteration.id, document.id].some((id) => id.toLowerCase() === needle)
  );
}

export function queryPool(
  query: PoolQuery,
  slice: Slice = { cursor: null, limit: listSliceSize },
): PoolPage {
  const matching = database.iterations
    .filter(isInPool)
    .flatMap((iteration) => itemOf(iteration) ?? [])
    .filter((item) => matchesPool(item, query))
    .toSorted(byPriorityThenAge);
  const { items, nextCursor } = sliceOf(matching, (item) => item.iteration.id, slice);

  const inReview = database.iterations.filter(isHeldInReview);
  const tops = [...new Set(inReview.map((iteration) => topCategoryOf(iteration.categoryId)))];
  const undecided = database.requests
    .filter((request) => request.decision === "Pending")
    .map((request) => request.documentId);

  return {
    items,
    total: matching.length,
    pages: matching.reduce((sum, item) => sum + (item.pages ?? 0), 0),
    nextCursor,
    inReview: database.categories
      .filter((category) => tops.includes(category.id))
      .map((category) => {
        const held = inReview.filter(
          (iteration) => topCategoryOf(iteration.categoryId) === category.id,
        );
        return { categoryId: category.id, itemCount: held.length, pages: sumPages(held) };
      }),
    undecidedCount: new Set(undecided).size,
    cancelledCount: database.iterations.filter(
      (iteration) =>
        iteration.progress === "Ready" &&
        iteration.listId === null &&
        iteration.cancellation !== null,
    ).length,
  };
}

// ---------------------------------------------------------------- saving

// Creates a list from the editor's draft (flows.md L1, L2).
export function createList(session: Session, draft: ListDraft): Outcome<ListDetail> {
  if (!hasPermission(session, "list.create")) {
    return { refusal: { status: 403, message: "You may not create lists" } };
  }

  const startsOn = draft.startsOn ?? today();
  if (draft.endsOn < startsOn) {
    return { refusal: { status: 422, message: "It cannot end before it starts" } };
  }

  const refusal = membersRefusal(draft.memberIds, null);
  if (refusal !== null) {
    return refusal;
  }

  const now = new Date().toISOString();
  const list: DigitizationList = {
    id: nextListId(),
    name: draft.name,
    startsOn,
    endsOn: draft.endsOn,
    targetPages: draft.targetPages,
    generated: draft.generated ?? null,
    createdBy: session.user.id,
    createdAt: now,
    done: null,
  };
  database.lists.push(list);
  const correlationId = crypto.randomUUID();
  logList(session, list, correlationId, "Created", datesOf(list));
  logGeneration(session, list, correlationId);
  moveMembers(session, list, draft.memberIds, correlationId);
  return { value: detailOf(list) };
}

// Saves the editor's draft over a list: name, dates, target and the whole set of members. Taking
// one off returns it to the pool, with no reason (flows.md L9).
export function saveList(session: Session, listId: string, draft: ListDraft): Outcome<ListDetail> {
  if (!hasPermission(session, "list.edit")) {
    return { refusal: { status: 403, message: "You may not edit lists" } };
  }

  const list = findReachableList(session, listId);
  if (list === null) {
    return { refusal: { status: 404, message: "List not found" } };
  }

  if (list.done !== null) {
    return {
      refusal: {
        status: 409,
        message: "A Done list is history: its members and dates no longer change",
        code: "list.done",
      },
    };
  }

  const startsOn = draft.startsOn ?? today();
  if (draft.endsOn < startsOn) {
    return { refusal: { status: 422, message: "It cannot end before it starts" } };
  }

  const refusal = membersRefusal(draft.memberIds, list.id);
  if (refusal !== null) {
    return refusal;
  }

  const saved: DigitizationList = {
    ...list,
    name: draft.name,
    startsOn,
    endsOn: draft.endsOn,
    targetPages: draft.targetPages,
    generated: draft.generated ?? list.generated,
  };
  database.lists.splice(database.lists.indexOf(list), 1, saved);
  const correlationId = crypto.randomUUID();
  if (saved.startsOn !== list.startsOn || saved.endsOn !== list.endsOn) {
    logList(session, saved, correlationId, "Dates moved", `${datesOf(list)} → ${datesOf(saved)}`);
  }

  if (saved.name !== list.name) {
    logList(session, saved, correlationId, "Renamed", `${list.name} → ${saved.name}`);
  }

  if (draft.generated !== undefined) {
    logGeneration(session, saved, correlationId);
  }

  moveMembers(session, saved, draft.memberIds, correlationId);
  return { value: detailOf(saved) };
}

// Each one must be on this list already or in the pool now; one another list took meanwhile is
// refused, so two editors never list the same item twice.
function membersRefusal(
  memberIds: readonly string[],
  listId: string | null,
): { refusal: { status: 409 | 422; message: string; code?: string } } | null {
  for (const memberId of new Set(memberIds)) {
    const iteration = database.iterations.find((candidate) => candidate.id === memberId);
    if (iteration === undefined) {
      return { refusal: { status: 422, message: `No item ${memberId}` } };
    }

    const isOnThisList = listId !== null && iteration.listId === listId;
    if (!isOnThisList && !isInPool(iteration)) {
      return {
        refusal: {
          status: 409,
          message: `${memberId} is no longer ready to list: another list took it, or a gate holds it`,
          code: "list.member_unavailable",
        },
      };
    }
  }

  return null;
}

// Puts the new members on, takes the missing ones off, and has every unscanned member read what
// the list's start says. A scanned or cancelled member keeps its written value.
function moveMembers(
  session: Session,
  list: DigitizationList,
  memberIds: readonly string[],
  correlationId: string,
): void {
  const wanted = new Set(memberIds);
  const before = membersOf(list.id);
  const progress = progressOnList(list, today());
  let added = 0;
  let removed = 0;

  for (const iteration of before.filter((member) => !wanted.has(member.id))) {
    if (isScanned(iteration)) {
      continue;
    }

    removed += 1;
    replaceIteration({
      ...iteration,
      listId: null,
      progress: progressAfterGates({ ...iteration, progress: "Ready" }),
    });
    logIteration(
      session,
      iteration,
      correlationId,
      "Taken off a list",
      `Back in the pool · ${list.id}`,
    );
  }

  for (const memberId of wanted) {
    const iteration = database.iterations.find((candidate) => candidate.id === memberId);
    if (iteration === undefined || isScanned(iteration) || iteration.cancellation !== null) {
      continue;
    }

    if (iteration.listId !== list.id) {
      added += 1;
      logIteration(session, iteration, correlationId, "Listed", list.id);
    }

    replaceIteration({ ...iteration, listId: list.id, progress });
  }

  if (added > 0 || removed > 0) {
    logList(session, list, correlationId, "Members moved", `+${added} −${removed}`);
  }
}

// ---------------------------------------------------------------- acting on a list

const doneRefusal = {
  refusal: {
    status: 409,
    message: "A Done list is history: it no longer changes and is not deleted",
    code: "list.done",
  },
} as const;

// A list within reach, not Done, and the grant to act on it.
function actionableList(
  session: Session,
  listId: string,
  permission: Permission,
): Outcome<DigitizationList> {
  if (!hasPermission(session, permission)) {
    return { refusal: { status: 403, message: "You may not do this to lists" } };
  }

  const list = findReachableList(session, listId);
  if (list === null) {
    return { refusal: { status: 404, message: "List not found" } };
  }

  return list.done === null ? { value: list } : doneRefusal;
}

// Only a list that has started can be through: one still Planned has nothing scanned.
function runningList(session: Session, listId: string): Outcome<DigitizationList> {
  const found = actionableList(session, listId, "list.edit");
  if ("refusal" in found || listStateOf(found.value, today()) === "InProgress") {
    return found;
  }

  return {
    refusal: {
      status: 409,
      message: "It has not started yet: nothing on it is being scanned",
      code: "list.not_started",
    },
  };
}

// Not scanned and not stopped: what Done moves, and what deleting returns to the pool.
const isOpenMember = (iteration: Iteration) =>
  !isScanned(iteration) && iteration.cancellation === null;

export function previewMarkDone(session: Session, listId: string): Outcome<MarkDoneDryRun> {
  const found = runningList(session, listId);
  if ("refusal" in found) {
    return found;
  }

  const members = membersOf(found.value.id);
  const moving = members.filter(isOpenMember);
  return {
    value: {
      toDigitized: { itemCount: moving.length, pages: sumPages(moving) },
      alreadyScannedCount: members.filter(isScanned).length,
      notDigitizableCount: members.filter(
        (iteration) => iteration.cancellation?.cause === "NotDigitizable",
      ).length,
      blocked: moving
        .filter((iteration) => memberBlockerOf(iteration) !== null)
        .map((iteration) => ({
          iterationId: iteration.id,
          title: itemOf(iteration)?.document.title ?? iteration.id,
        })),
    },
  };
}

// Done is an act (flows.md L14): every open member moves to Digitized, and the list's dates are
// fixed from then on.
export function markListDone(session: Session, listId: string): Outcome<ListDetail> {
  const found = runningList(session, listId);
  if ("refusal" in found) {
    return found;
  }

  const list = found.value;
  const now = new Date().toISOString();
  const correlationId = crypto.randomUUID();
  const members = membersOf(list.id);
  const moving = members.filter(isOpenMember);
  for (const iteration of moving) {
    replaceIteration({ ...iteration, progress: "Digitized", digitizedAt: now });
    logIteration(session, iteration, correlationId, "Digitized", `${list.id} marked Done`);
  }

  const done: DigitizationList = { ...list, done: { actorId: session.user.id, at: now } };
  database.lists.splice(database.lists.indexOf(list), 1, done);
  const notDigitizable = members.filter(
    (iteration) => iteration.cancellation?.cause === "NotDigitizable",
  ).length;
  logList(
    session,
    done,
    correlationId,
    "Marked Done",
    [
      `${moving.length} moved to Digitized`,
      notDigitizable > 0 ? `${notDigitizable} could not be digitized` : null,
    ]
      .filter((part) => part !== null)
      .join(" · "),
  );
  return { value: detailOf(done) };
}

// Where a member goes when its list is deleted: Ready, or Enqueued where a gate now fails.
const progressOffList = (iteration: Iteration) =>
  isScanned(iteration)
    ? iteration.progress
    : progressAfterGates({ ...iteration, progress: "Ready" });

export function previewDeletion(session: Session, listId: string): Outcome<DeletionDryRun> {
  const found = actionableList(session, listId, "list.delete");
  if ("refusal" in found) {
    return found;
  }

  const members = membersOf(found.value.id);
  const open = members.filter(isOpenMember);
  const toReady = open.filter((iteration) => progressOffList(iteration) === "Ready");
  return {
    value: {
      toReady: { itemCount: toReady.length, pages: sumPages(toReady) },
      toEnqueuedCount: open.length - toReady.length,
      scannedCount: members.filter(isScanned).length,
      heldCount: members.filter(
        (iteration) => !isScanned(iteration) && iteration.cancellation !== null,
      ).length,
    },
  };
}

// Lists are deleted, not cancelled (flows.md L15): no reason, and each member's history keeps
// that it was listed, by the list's name.
export function deleteList(session: Session, listId: string): Outcome<null> {
  const found = actionableList(session, listId, "list.delete");
  if ("refusal" in found) {
    return found;
  }

  const list = found.value;
  const correlationId = crypto.randomUUID();
  for (const iteration of membersOf(list.id)) {
    const progress = progressOffList(iteration);
    replaceIteration({ ...iteration, listId: null, formerListName: list.name, progress });
    logIteration(
      session,
      iteration,
      correlationId,
      "List deleted",
      `${list.id} · ${progress === "Enqueued" ? "Enqueued until its gate clears" : "keeps its status"}`,
    );
  }

  database.lists.splice(database.lists.indexOf(list), 1);
  logList(session, list, correlationId, "Deleted", datesOf(list));
  return { value: null };
}

// It stays on the list, marked, with a message every asker reads (flows.md L13); Done does not
// move it, and Resume in Documents brings it back to Ready.
export function markNotDigitizable(
  session: Session,
  listId: string,
  iterationId: string,
  request: NotDigitizableRequest,
): Outcome<ListDetail> {
  const found = runningList(session, listId);
  if ("refusal" in found) {
    return found;
  }

  const list = found.value;
  const iteration = membersOf(list.id).find((member) => member.id === iterationId);
  if (iteration === undefined) {
    return { refusal: { status: 404, message: "It is not on this list" } };
  }

  if (!isOpenMember(iteration)) {
    return {
      refusal: {
        status: 409,
        message: "It is already scanned, or already stopped",
        code: "iteration.stopped",
      },
    };
  }

  const now = new Date().toISOString();
  replaceIteration({
    ...iteration,
    cancellation: {
      cause: "NotDigitizable",
      actorId: session.user.id,
      at: now,
      publicText: request.message,
      internalText: null,
    },
  });
  logIteration(
    session,
    iteration,
    crypto.randomUUID(),
    "Could not be digitized",
    `${request.message} · on ${list.id}`,
  );
  return { value: detailOf(list) };
}

function nextListId(): string {
  const year = mockToday.getFullYear();
  const numbers = database.lists
    .map((list) => list.id.match(new RegExp(`^L-${year}-(\\d+)$`))?.[1])
    .flatMap((number) => (number === undefined ? [] : [Number(number)]));
  return `L-${year}-${String(Math.max(0, ...numbers) + 1).padStart(3, "0")}`;
}

function datesOf(list: DigitizationList): string {
  return `${formatShortCalendarDay(list.startsOn)} → ${formatShortCalendarDay(list.endsOn)}`;
}

function logList(
  session: Session,
  list: DigitizationList,
  correlationId: string,
  event: string,
  detail: string,
): void {
  writeLog(entryOf(session, "list", list.id, correlationId, event, detail));
}

// Which generator and which inputs drafted it: for an AI generator the only way to say afterwards
// why a list looks the way it does (intentions.md §4.3).
function logGeneration(session: Session, list: DigitizationList, correlationId: string): void {
  if (list.generated === null) {
    return;
  }

  const { generator, pages } = list.generated;
  logList(
    session,
    list,
    correlationId,
    `Generated — ${generator}`,
    `${formatCount(pages)} pp asked`,
  );
}

function logIteration(
  session: Session,
  iteration: Iteration,
  correlationId: string,
  event: string,
  detail: string,
): void {
  writeLog(entryOf(session, "iteration", iteration.id, correlationId, event, detail));
}

function entryOf(
  session: Session,
  subjectKind: StatusLogEntry["subjectKind"],
  subjectId: string,
  correlationId: string,
  event: string,
  detail: string,
): Omit<StatusLogEntry, "id"> {
  return {
    subjectKind,
    subjectId,
    at: new Date().toISOString(),
    actor: { kind: "user", userId: session.user.id },
    correlationId,
    event,
    detail,
  };
}
