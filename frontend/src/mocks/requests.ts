// What the server does for Requests: gather each document's asks into one row, keep the rows to
// the reach of the caller's `request.read`, then search, filter, count, sort and group; and
// decide. A decision covers every open ask of the document, writes the status log, and on
// approval creates the one iteration the oldest ask originates (status-model.md §2.7).

import type { RequestPlugins } from "@vera/contract/queries/requests";
import { baseIdOf, isDecidableBy, reachableRows, rowOf } from "@vera/contract/queries/requests";
import type {
  Approval,
  BulkApproval,
  BulkApprovalResult,
  DecisionResult,
  Decline,
  WithdrawalResult,
} from "@vera/contract/requests";
import { categoryPathOf } from "@vera/domain/categories";
import { existingCopiesOf } from "@vera/domain/documents";
import type { Iteration, Request, Session } from "@vera/domain/entities";
import { hasPermission } from "@vera/domain/permissions";
import type { RequestRow } from "@vera/domain/requests";
import {
  asksOf,
  batchIdsOf,
  isBeingChecked,
  isBulkApprovable,
  isRescan,
} from "@vera/domain/requests";
import { suggestionFor } from "@/mocks/classification";
import { database, mockStore } from "@/mocks/database";
import { custodyPlacements, houseRuleOf } from "@/mocks/fixtures/request-custodies";
import type { Outcome } from "@/mocks/mutations";
import { leafCategoryRefusal, writeLog } from "@/mocks/mutations";

// The mock answers the plugins the Requests queries ask about custody and classification.
export const mockRequestPlugins: RequestPlugins = {
  placementsOf: (request, document) =>
    custodyPlacements[baseIdOf(request.id)] ?? houseRuleOf(request, document),
  suggestionFor,
};

// ---------------------------------------------------------------- decisions

// Open rows outside the caller's custody are refused, not hidden: they exist, and somebody else
// decides them.
function openRowFor(session: Session, documentId: string): Outcome<RequestRow> {
  const document = database.documents.find((candidate) => candidate.id === documentId);
  const row = document === undefined ? null : rowOf(mockStore(), mockRequestPlugins, document);
  if (row === null) {
    return { refusal: { status: 404, message: "No proposal for this document" } };
  }

  if (!isDecidableBy(mockStore(), session, row)) {
    return {
      refusal: {
        status: 403,
        code: "proposal.outside_request_custody",
        message: "This proposal is outside your request custody",
      },
    };
  }

  if (row.decision !== "Pending") {
    return {
      refusal: {
        status: 409,
        code: "proposal.decided",
        message: "This proposal has already been decided",
      },
    };
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
    return {
      refusal: {
        status: 409,
        code: "proposal.checks_pending",
        message: "The checks have not answered yet",
      },
    };
  }

  if (isRescan(row) && approval.rescanNote === null) {
    return {
      refusal: {
        status: 422,
        code: "proposal.rescan_reason_missing",
        message: "Say why it is scanned again",
      },
    };
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
      code: "request.declined",
      data: { batchSize: asksOf(row).length > 1 ? asksOf(row).length : null },
      reason: {
        public: decline.publicText,
        internal: joinSentences([decline.internalText, custodyNote(row)]) || null,
      },
    });
  }

  return { value: { documentId, decision: "Denied", askCount: asksOf(row).length } };
}

// The asker takes back their own ask on the document while it waits (ACT-withdraw); they have at
// most one open (LC-REQ-check). It is Withdrawn for good, and asking again makes a new request
// (LC-REQ-final). Others' asks stand.
export function withdrawAsk(session: Session, documentId: string): Outcome<WithdrawalResult> {
  if (!hasPermission(session, "request.withdraw_own")) {
    return { refusal: { status: 403, message: "You may not withdraw asks" } };
  }

  const own = database.requests.filter(
    (request) => request.documentId === documentId && request.requesterId === session.user.id,
  );
  if (own.length === 0) {
    return {
      refusal: {
        status: 404,
        code: "request.not_asked",
        message: "You have not asked for this document",
      },
    };
  }

  const ask = own.find((request) => request.decision === "Pending");
  if (ask === undefined) {
    return {
      refusal: {
        status: 409,
        code: "proposal.decided",
        message: "It has been decided meanwhile",
      },
    };
  }

  const now = new Date().toISOString();
  replaceRequest({ ...withoutPendingFields(ask), decision: "Withdrawn", withdrawnAt: now });
  writeLog({
    subjectKind: "request",
    subjectId: ask.id,
    at: now,
    actor: { kind: "user", userId: session.user.id },
    correlationId: crypto.randomUUID(),
    code: "request.withdrawn",
    data: {},
    reason: { public: null, internal: null },
  });
  return { value: { documentId, requestId: ask.id } };
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

  const open = reachableRows(mockStore(), mockRequestPlugins, session).filter(
    (row) =>
      row.decision === "Pending" &&
      batchIdsOf(row).includes(batchId) &&
      isDecidableBy(mockStore(), session, row),
  );
  const excludedIds = new Set(bulk.excludedIds);
  const taken = open.filter(
    (row) => isBulkApprovable(row) && !excludedIds.has(row.record.document.id),
  );
  if (taken.length === 0) {
    return {
      refusal: {
        status: 409,
        code: "batch.nothing_to_approve",
        message: "Nothing in this batch is left to approve",
      },
    };
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
  row: RequestRow,
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
    links: [],
    scanDpi: null,
    properties: [],
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

  const correlationId = crypto.randomUUID();
  for (const ask of asks) {
    writeLog({
      subjectKind: "request",
      subjectId: ask.id,
      at: now,
      actor: { kind: "user", userId: session.user.id },
      correlationId,
      code: "request.approved",
      data: {
        iterationId: iteration.id,
        isRescan: rescan !== null,
        batchSize: asks.length > 1 ? asks.length : null,
      },
      reason: {
        public: null,
        internal:
          joinSentences([
            rescan === null ? null : `Over ${copiesLineOf(row)}. ${rescan.note}`,
            suggestionNote(row, approval.categoryId, decidedBy),
            custodyNote(row),
          ]) || null,
      },
    });
  }
}

// The suggestion, its instance and whether the decider kept it go on the approval's entry, so a
// classifier that is usually overruled shows as one (plugins.md §4.13).
function suggestionNote(row: RequestRow, categoryId: string, decidedBy: ApprovedBy): string | null {
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

function copiesLineOf(row: RequestRow): string {
  return existingCopiesOf(asksOf(row))
    .map((copy) => `${copy.source}: ${copy.state.toLowerCase()}`)
    .join(", ");
}

// The custodies it was in when decided go on the decision's entry (proposal-custody.md §6).
function custodyNote(row: RequestRow): string {
  const names = row.custodyIds.map(
    (custodyId) =>
      database.requestCustodies.find((custody) => custody.id === custodyId)?.name ?? custodyId,
  );
  return `Request custody: ${names.join(", ")}`;
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
    isAfterProjectApproval: _isAfterProjectApproval,
    ...base
  } = request as PendingRequest;
  return base;
}

function replaceRequest(request: Request): void {
  const index = database.requests.findIndex((candidate) => candidate.id === request.id);
  database.requests.splice(index, 1, request);
}
