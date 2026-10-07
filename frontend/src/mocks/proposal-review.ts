// What the server does for Proposal Review: gather each document's proposals into one row, keep
// the rows to the caller's proposal custody, then search, filter, count, sort and group; and
// decide. A decision covers every open ask of the document, writes the status log, and on
// approval creates the one iteration the oldest ask originates (status-model.md §2.7).

import type { Answer } from "@/api/documents";
import type {
  Approval,
  AskerCount,
  BulkApproval,
  BulkApprovalResult,
  DecisionResult,
  Decline,
  ProposalDetail,
  ProposalGroup,
  ProposalGrouping,
  ProposalListField,
  ProposalPage,
  ProposalQuery,
  ProposalRangeField,
} from "@/api/proposal-review";
import { proposalPageSchema, proposalSliceSize } from "@/api/proposal-review";
import { categoryPathOf } from "@/domain/categories";
import { existingCopiesOf } from "@/domain/documents";
import type {
  Document,
  Iteration,
  ProposalCustody,
  Request,
  Session,
  StatusLogEntry,
} from "@/domain/entities";
import { scopesOf } from "@/domain/permissions";
import type { ProposalRow } from "@/domain/proposal-review";
import {
  askerIdsOf,
  asksOf,
  batchIdsOf,
  firstAskOf,
  isAfterProjectApproval,
  isBeingChecked,
  isBulkApprovable,
  isProposalDecision,
  isRescan,
  projectIdsOf,
  rowDecisionOf,
} from "@/domain/proposal-review";
import { isWithinRange, resolveDayRange } from "@/lib/value-range";
import type { Arrangement } from "@/mocks/arrangement";
import { countValues, groupedBy, sliceOf } from "@/mocks/arrangement";
import { suggestionFor } from "@/mocks/classification";
import { database } from "@/mocks/database";
import { oncePerCause } from "@/mocks/documents";
import type { StoredProposalCustody } from "@/mocks/fixtures/proposal-custodies";
import { custodyPlacements, houseRuleOf } from "@/mocks/fixtures/proposal-custodies";
import type { Outcome } from "@/mocks/mutations";
import { leafCategoryRefusal, writeLog } from "@/mocks/mutations";
import { mockToday } from "@/mocks/today";

// ---------------------------------------------------------------- reach

export function canDecide(session: Session): boolean {
  return scopesOf(session, "request.decide").length > 0;
}

// The custodies whose proposals the caller decides: every one at `any`, else those they are a
// member of, directly or through a group.
export function decidedCustodiesOf(session: Session): StoredProposalCustody[] {
  const scopes = scopesOf(session, "request.decide");
  if (scopes.includes("any")) {
    return [...database.proposalCustodies];
  }

  if (!scopes.includes("custody")) {
    return [];
  }

  const userId = session.user.id;
  const groupIds = database.groups
    .filter((group) => group.memberIds.includes(userId))
    .map(({ id }) => id);
  return database.proposalCustodies.filter(
    (custody) =>
      custody.memberIds.includes(userId) ||
      custody.groupIds.some((groupId) => groupIds.includes(groupId)),
  );
}

export function publicCustodyOf({
  memberIds: _memberIds,
  groupIds: _groupIds,
  ...custody
}: StoredProposalCustody): ProposalCustody {
  return custody;
}

function reachableRows(session: Session): ProposalRow[] {
  const custodyIds = new Set(decidedCustodiesOf(session).map(({ id }) => id));
  return database.documents
    .flatMap((document) => {
      const row = rowOf(document);
      return row === null ? [] : [row];
    })
    .filter((row) => row.custodyIds.some((custodyId) => custodyIds.has(custodyId)));
}

// The custodies the Custody rules place each open proposal in now, one entry per document since
// one decision covers every asker (proposal-custody.md §5, Users & Groups).
export function openProposalPlacements(): string[][] {
  return database.documents.flatMap((document) => {
    const row = rowOf(document);
    return row === null || row.decision !== "Pending" ? [] : [row.custodyIds];
  });
}

// The open or decided row of a document the caller decides; null outside their reach.
export function findReachableRow(session: Session, documentId: string): ProposalRow | null {
  return reachableRows(session).find((row) => row.record.document.id === documentId) ?? null;
}

// The document's asks that share its liveliest proposal decision; null when it has none.
function rowOf(document: Document): ProposalRow | null {
  const proposals = database.requests.filter(
    (request) => request.documentId === document.id && isProposalDecision(request.decision),
  );
  const decision = rowDecisionOf(proposals);
  if (decision === null) {
    return null;
  }

  const asks = proposals
    .filter((request) => request.decision === decision)
    .toSorted(
      (first, second) => first.at.localeCompare(second.at) || first.id.localeCompare(second.id),
    );
  const iterations = database.iterations
    .filter((iteration) => iteration.documentId === document.id)
    .toSorted((first, second) => first.attempt - second.attempt);
  return {
    record: { document, iterations, requests: asks },
    decision,
    custodyIds: custodiesOf(asks, document),
    suggestion: asks[0] === undefined ? null : suggestionFor(asks[0], document),
  };
}

// The union of what the Custody plugins answered for each ask; the fallback when it is empty.
// A name that is no custody is ignored (proposal-custody.md §3).
function custodiesOf(asks: readonly Request[], document: Document): string[] {
  const names = new Set(
    asks.flatMap(
      (request) => custodyPlacements[baseIdOf(request.id)] ?? houseRuleOf(request, document),
    ),
  );
  const placed = database.proposalCustodies.filter(
    (custody) => !custody.isFallback && names.has(custody.name),
  );
  if (placed.length > 0) {
    return placed.map(({ id }) => id);
  }

  return database.proposalCustodies.filter((custody) => custody.isFallback).map(({ id }) => id);
}

// Copies made for volume carry the fixture's ID with a `.n` suffix.
function baseIdOf(requestId: string): string {
  return requestId.replace(/\.\d+$/, "");
}

// ---------------------------------------------------------------- list

type FilterField = "search" | ProposalListField | ProposalRangeField;

interface Predicate {
  field: FilterField;
  matches: (row: ProposalRow) => boolean;
}

type FieldValues = Record<ProposalListField, (row: ProposalRow) => readonly string[]>;

const listFields = [
  "decisions",
  "custodyIds",
  "documentTypes",
  "projectIds",
  "existingCopies",
  "askerIds",
  "batchIds",
  "askerCounts",
  "afterProjectApproval",
] as const satisfies readonly ProposalListField[];

const fieldValues: FieldValues = {
  decisions: (row) => [row.decision],
  custodyIds: (row) => row.custodyIds,
  documentTypes: (row) => [row.record.document.type],
  projectIds: projectIdsOf,
  existingCopies: (row) => {
    const copies = existingCopiesOf(asksOf(row));
    return copies.length === 0 ? ["None"] : [...new Set(copies.map((copy) => copy.state))];
  },
  askerIds: askerIdsOf,
  batchIds: batchIdsOf,
  askerCounts: (row) => [askerCountOf(row)],
  afterProjectApproval: (row) => [answerOf(isAfterProjectApproval(row))],
};

function askerCountOf(row: ProposalRow): AskerCount {
  return askerIdsOf(row).length > 1 ? "Several" : "One";
}

function answerOf(isTrue: boolean): Answer {
  return isTrue ? "Yes" : "No";
}

export function queryProposals(
  session: Session,
  query: ProposalQuery,
  slice: { cursor: string | null; limit: number } = { cursor: null, limit: proposalSliceSize },
  grouping: ProposalGrouping | null = null,
): ProposalPage {
  const reachable = reachableRows(session);
  const predicates = predicatesOf(query);
  // A facet counts over every other filter, so picking a value never hides its siblings.
  const matchingAllBut = (field: FilterField | null) =>
    reachable.filter((row) =>
      predicates.every((predicate) => predicate.field === field || predicate.matches(row)),
    );

  const matching = matchingAllBut(null).toSorted(byDecisionThenAge);
  const arrangement = arrangementOf(grouping, matching, reachable);
  const arranged = arrangement === null ? matching : arrangement.sorted(matching);
  const { items, nextCursor } = sliceOf(arranged, (row) => row.record.document.id, slice);
  const countOf = (field: ProposalListField) =>
    countValues(matchingAllBut(field).flatMap(fieldValues[field]));

  return {
    items,
    total: matching.length,
    askTotal: matching.reduce((sum, row) => sum + asksOf(row).length, 0),
    nextCursor,
    groups: arrangement === null ? [] : arrangement.headersOf(items, matching),
    // Each list's values were produced by that field's own value function.
    facets: proposalPageSchema.shape.facets.parse(
      Object.fromEntries(listFields.map((field) => [field, countOf(field)])),
    ),
  };
}

export function findProposalDetail(session: Session, documentId: string): ProposalDetail | null {
  const row = findReachableRow(session, documentId);
  if (row === null) {
    return null;
  }

  return { row, log: logOf(row) };
}

function predicatesOf(query: ProposalQuery): Predicate[] {
  const predicates: Predicate[] = [];
  const { search } = query;
  if (search !== undefined) {
    predicates.push({ field: "search", matches: (row) => matchesSearch(row, search) });
  }

  for (const field of listFields) {
    const wanted = query[field];
    if (wanted === undefined || wanted.length === 0) {
      continue;
    }

    const wantedValues = new Set<string>(wanted);
    predicates.push({
      field,
      matches: (row) => fieldValues[field](row).some((value) => wantedValues.has(value)),
    });
  }

  // A row asked for on several days is in the range when any of its asks is.
  const { asked } = query;
  if (asked !== undefined) {
    predicates.push({
      field: "asked",
      matches: (row) =>
        asksOf(row).some((request) =>
          isWithinRange(request.at.slice(0, 10), resolveDayRange(asked, mockToday)),
        ),
    });
  }

  return predicates;
}

// Title, identifiers, who asked and the batch; a request ID matches whole.
function matchesSearch(row: ProposalRow, search: string): boolean {
  const needle = search.toLowerCase();
  const { document } = row.record;
  const askerNames = askerIdsOf(row).map(
    (userId) => database.users.find((user) => user.id === userId)?.name,
  );
  const texts = [
    document.title,
    document.catalogId,
    document.unit?.value,
    document.signature,
    ...askerNames,
    ...batchIdsOf(row),
  ];
  const ids = asksOf(row).map((request) => request.id.toLowerCase());
  return texts.some((text) => text?.toLowerCase().includes(needle)) || ids.includes(needle);
}

// Open rows first, then the longest waiting, then by title.
function byDecisionThenAge(first: ProposalRow, second: ProposalRow): number {
  return (
    Number(first.decision !== "Pending") - Number(second.decision !== "Pending") ||
    (firstAskOf(first)?.at ?? "").localeCompare(firstAskOf(second)?.at ?? "") ||
    first.record.document.title.localeCompare(second.record.document.title)
  );
}

// ---------------------------------------------------------------- grouping

function arrangementOf(
  grouping: ProposalGrouping | null,
  matching: readonly ProposalRow[],
  reachable: readonly ProposalRow[],
): Arrangement<ProposalRow, ProposalGroup> | null {
  if (grouping === "batch") {
    return batchArrangementOf(matching, reachable);
  }

  if (grouping === "requester") {
    return requesterArrangementOf(matching);
  }

  return null;
}

// A row is listed in the batch of its earliest ask. Batches come in the order their first rows
// wait, oldest first, and what was proposed on its own comes last.
function batchArrangementOf(
  matching: readonly ProposalRow[],
  reachable: readonly ProposalRow[],
): Arrangement<ProposalRow, ProposalGroup> {
  const homeOf = (row: ProposalRow) => firstAskOf(row)?.batchId ?? null;
  const order = [...new Set(matching.flatMap((row) => homeOf(row) ?? []))];
  const openInBatch = (batchId: string) =>
    reachable.filter((row) => row.decision === "Pending" && batchIdsOf(row).includes(batchId));

  return groupedBy(homeOf, order, (batchId, total, rowCount) => {
    const batch = database.batches.find((candidate) => candidate.id === batchId) ?? null;
    const asks = matching.flatMap((row) =>
      asksOf(row).filter((request) => request.batchId === batchId),
    );
    const elsewhere = matching.filter(
      (row) => homeOf(row) !== batchId && batchIdsOf(row).some((id) => id === batchId),
    );
    const open = batchId === null ? [] : openInBatch(batchId);
    return {
      kind: "batch",
      batch,
      askCount: batchId === null ? 0 : asks.length,
      elsewhereCount: batchId === null ? 0 : elsewhere.length,
      approvableCount: open.filter(isBulkApprovable).length,
      suggestedCounts: countValues(
        open.flatMap((row) =>
          isBulkApprovable(row) && row.suggestion !== null ? [row.suggestion.categoryId] : [],
        ),
      ),
      rescanCount: open.filter(isRescan).length,
      checkingCount: open.filter((row) => !isRescan(row) && isBeingChecked(row)).length,
      total,
      rowCount,
    };
  });
}

// A row is listed under whoever asked first; the busiest requesters come first.
function requesterArrangementOf(
  matching: readonly ProposalRow[],
): Arrangement<ProposalRow, ProposalGroup> {
  const homeOf = (row: ProposalRow) => firstAskOf(row)?.requesterId ?? null;
  const counts = countValues(matching.flatMap((row) => homeOf(row) ?? []));
  const nameOf = (userId: string) =>
    database.users.find((user) => user.id === userId)?.name ?? userId;
  const order = counts
    .toSorted(
      (first, second) =>
        second.count - first.count || nameOf(first.value).localeCompare(nameOf(second.value)),
    )
    .map(({ value }) => value);

  return groupedBy(homeOf, order, (userId, total, rowCount) => ({
    kind: "requester",
    userId: userId ?? "",
    sharedCount: matching.filter((row) => homeOf(row) === userId && askerIdsOf(row).length > 1)
      .length,
    total,
    rowCount,
  }));
}

// ---------------------------------------------------------------- history

// The status log of the asks and of the attempts before them, newest first.
function logOf(row: ProposalRow): StatusLogEntry[] {
  const subjects = new Set(
    [...row.record.requests, ...row.record.iterations].map((entry) => entry.id),
  );
  return oncePerCause(
    database.statusLog
      .filter((entry) => subjects.has(entry.subjectId))
      .toSorted((first, second) => second.at.localeCompare(first.at)),
  );
}

// ---------------------------------------------------------------- decisions

// Open rows outside the caller's custody are refused, not hidden: they exist, and somebody else
// decides them.
function openRowFor(session: Session, documentId: string): Outcome<ProposalRow> {
  const document = database.documents.find((candidate) => candidate.id === documentId);
  const row = document === undefined ? null : rowOf(document);
  if (row === null) {
    return { refusal: { status: 404, message: "No proposal for this document" } };
  }

  if (findReachableRow(session, documentId) === null) {
    return { refusal: { status: 403, message: "This proposal is outside your proposal custody" } };
  }

  if (row.decision !== "Pending") {
    return { refusal: { status: 409, message: "This proposal has already been decided" } };
  }

  return { value: row };
}

export function approveProposal(
  session: Session,
  documentId: string,
  approval: Approval,
): Outcome<DecisionResult> {
  const found = openRowFor(session, documentId);
  if ("refusal" in found) {
    return found;
  }

  const refusal = leafCategoryRefusal(approval.categoryId);
  if (refusal !== null) {
    return { refusal };
  }

  const row = found.value;
  if (isBeingChecked(row)) {
    return { refusal: { status: 409, message: "The checks have not answered yet" } };
  }

  if (isRescan(row) && approval.rescanNote === null) {
    return { refusal: { status: 422, message: "Say why it is scanned again" } };
  }

  approveRow(session, row, approval);
  return { value: { documentId, decision: "Approved", askCount: asksOf(row).length } };
}

export function declineProposal(
  session: Session,
  documentId: string,
  decline: Decline,
): Outcome<DecisionResult> {
  const found = openRowFor(session, documentId);
  if ("refusal" in found) {
    return found;
  }

  const row = found.value;
  const now = new Date().toISOString();
  const correlationId = crypto.randomUUID();
  for (const ask of asksOf(row)) {
    replaceRequest({
      ...withoutPendingFields(ask),
      decision: "Denied",
      decline: { actorId: session.user.id, at: now, ...decline },
    });
    // Each asker's history tells them; the entries share one cause.
    writeLog({
      subjectKind: "request",
      subjectId: ask.id,
      at: now,
      actor: { kind: "user", userId: session.user.id },
      correlationId,
      event: asksOf(row).length > 1 ? `Declined — ${asksOf(row).length} requests` : "Declined",
      detail: joinSentences([
        `They were told: “${decline.publicText}”`,
        decline.internalText,
        custodyNote(row),
      ]),
    });
  }

  return { value: { documentId, decision: "Denied", askCount: asksOf(row).length } };
}

// Takes every open row the batch asked for that may be approved together, wherever its earliest
// ask was, but those unticked; a rescan or an ask still being checked is decided on its own
// (status-model.md §2.8), and is counted as left out.
export function bulkApproveProposals(
  session: Session,
  batchId: string,
  bulk: BulkApproval,
): Outcome<BulkApprovalResult> {
  if (!database.batches.some((batch) => batch.id === batchId)) {
    return { refusal: { status: 404, message: "No such batch" } };
  }

  const refusal = leafCategoryRefusal(bulk.categoryId);
  if (refusal !== null) {
    return { refusal };
  }

  const open = reachableRows(session).filter(
    (row) => row.decision === "Pending" && batchIdsOf(row).includes(batchId),
  );
  const excludedIds = new Set(bulk.excludedIds);
  const taken = open.filter(
    (row) => isBulkApprovable(row) && !excludedIds.has(row.record.document.id),
  );
  if (taken.length === 0) {
    return { refusal: { status: 409, message: "Nothing in this batch is left to approve" } };
  }

  for (const row of taken) {
    approveRow(session, row, { ...bulk, rescanNote: null }, "batch");
  }

  return {
    value: {
      approvedCount: taken.length,
      rescanCount: open.filter(isRescan).length,
      checkingCount: open.filter((row) => !isRescan(row) && isBeingChecked(row)).length,
    },
  };
}

// One item decided on its own, or a batch approved under one category.
type ApprovedBy = "item" | "batch";

// One iteration for the document: the oldest ask originates it and its project funds it; every
// other ask follows it (status-model.md §2.7).
function approveRow(
  session: Session,
  row: ProposalRow,
  approval: Approval,
  decidedBy: ApprovedBy = "item",
): void {
  const now = new Date().toISOString();
  const asks = asksOf(row);
  const [originating] = asks;
  if (originating === undefined) {
    return;
  }

  const iteration: Iteration = {
    id: `IT-${crypto.randomUUID()}`,
    documentId: row.record.document.id,
    attempt: row.record.iterations.length + 1,
    requestId: originating.id,
    categoryId: approval.categoryId,
    priority: approval.priority,
    projectId: originating.projectId,
    progress: "Enqueued",
    listId: null,
    formerListName: null,
    restriction: null,
    restrictionOverride: null,
    cancellation: null,
    defects: [],
    verdicts: [],
    ingestFailure: null,
    digitizedAt: null,
    publishedLink: null,
    scanDpi: null,
  };
  database.iterations.push(iteration);

  const rescan =
    approval.rescanNote === null
      ? null
      : { actorId: session.user.id, at: now, note: approval.rescanNote };
  for (const ask of asks) {
    replaceRequest({
      ...withoutPendingFields(ask),
      decision: "Approved",
      iteration: { relation: ask === originating ? "Originates" : "Tracks", id: iteration.id },
      rescan: ask === originating ? rescan : null,
    });
  }

  const categoryPath = categoryPathOf(database.categories, approval.categoryId)
    .map((category) => category.name)
    .join(" / ");
  writeLog({
    subjectKind: "iteration",
    subjectId: iteration.id,
    at: now,
    actor: { kind: "user", userId: session.user.id },
    correlationId: crypto.randomUUID(),
    event: joinEvent(rescan === null ? "Approved" : "Approved as rescan", asks.length),
    detail: joinSentences([
      rescan === null ? null : `Over ${copiesLineOf(row)}. ${rescan.note}`,
      `Category ${categoryPath}, priority ${approval.priority}`,
      suggestionNote(row, approval.categoryId, decidedBy),
      custodyNote(row),
    ]),
  });
}

// The suggestion, its instance and whether the decider kept it go on the approval's entry, so a
// classifier that is usually overruled shows as one (plugins.md §4.13).
function suggestionNote(
  row: ProposalRow,
  categoryId: string,
  decidedBy: ApprovedBy,
): string | null {
  const { suggestion } = row;
  if (suggestion === null) {
    return null;
  }

  const name = categoryPathOf(database.categories, suggestion.categoryId)
    .map((category) => category.name)
    .join(" / ");
  const verdict =
    suggestion.categoryId === categoryId
      ? "kept"
      : decidedBy === "batch"
        ? "overridden by the batch's category"
        : "overruled";
  return `${suggestion.classifier.name} suggested ${name} (“${suggestion.reason}”) — ${verdict}`;
}

function joinEvent(event: string, askCount: number): string {
  return askCount > 1 ? `${event} — ${askCount} requests` : event;
}

function copiesLineOf(row: ProposalRow): string {
  return existingCopiesOf(asksOf(row))
    .map((copy) => `${copy.source}: ${copy.state.toLowerCase()}`)
    .join(", ");
}

// The custodies it was in when decided go on the decision's entry (proposal-custody.md §6).
function custodyNote(row: ProposalRow): string {
  const names = row.custodyIds.map(
    (custodyId) =>
      database.proposalCustodies.find((custody) => custody.id === custodyId)?.name ?? custodyId,
  );
  return `Proposal custody: ${names.join(", ")}`;
}

function joinSentences(sentences: readonly (string | null)[]): string {
  return sentences
    .filter((sentence): sentence is string => sentence !== null && sentence !== "")
    .map((sentence) =>
      sentence.endsWith(".") || sentence.endsWith("”") ? sentence : `${sentence}.`,
    )
    .join(" ");
}

type PendingRequest = Extract<Request, { decision: "Pending" }>;

function withoutPendingFields(request: Request) {
  const {
    decision: _decision,
    approveOnCheck: _approveOnCheck,
    isAfterProjectApproval: _isAfterProjectApproval,
    ...base
  } = request as PendingRequest;
  return base;
}

function replaceRequest(request: Request): void {
  const index = database.requests.findIndex((candidate) => candidate.id === request.id);
  database.requests.splice(index, 1, request);
}
