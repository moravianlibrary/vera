// The decisions over Requests: plan the records and history an act writes without mutating its store.

import { categoryPathOf, leafCategoriesOf } from "@vera/domain/categories";
import type { Iteration, Request, Session } from "@vera/domain/entities";
import type { EventEntryInput } from "@vera/domain/events";
import { hasPermission } from "@vera/domain/permissions";
import type { RequestRow } from "@vera/domain/requests";
import {
  asksOf,
  batchIdsOf,
  isBeingChecked,
  isBulkApprovable,
  isRescan,
} from "@vera/domain/requests";
import type { RecordStore } from "@vera/domain/store";
import type {
  Approval,
  BulkApproval,
  BulkApprovalResult,
  DecisionResult,
  Decline,
  WithdrawalResult,
} from "../requests";
import type { QueryOutcome, QueryRefusal } from "./outcome";
import { isDecidableBy, type RequestPlugins, reachableRows, rowOf } from "./requests";

export interface DecisionWrites {
  iterations: Iteration[];
  requests: Request[];
  events: EventEntryInput[];
}

type NewId = (prefix: string) => string;
type Planned<Value> = { writes: DecisionWrites; result: Value };

function refusal(
  status: QueryRefusal["status"],
  message: string,
  code?: QueryRefusal["code"],
): QueryRefusal {
  return { status, message, ...(code === undefined ? {} : { code }) };
}

function leafCategoryRefusal(store: RecordStore, categoryId: string): QueryRefusal | null {
  const known = categoryPathOf(store.categories, categoryId).length > 0;
  const leaf = leafCategoriesOf(store.categories).some((category) => category.id === categoryId);
  return known && leaf
    ? null
    : refusal(422, "Choose a category with no subcategories", "category.not_leaf");
}

// Open rows outside the caller's custody are refused, not hidden: they exist, and somebody else
// decides them.
function openRowFor(
  store: RecordStore,
  plugins: RequestPlugins,
  session: Session,
  documentId: string,
): QueryOutcome<RequestRow> {
  const document = store.documents.find((candidate) => candidate.id === documentId);
  const row = document === undefined ? null : rowOf(store, plugins, document);
  if (row === null) return { refusal: refusal(404, "No proposal for this document") };
  if (!isDecidableBy(store, session, row)) {
    return {
      refusal: refusal(
        403,
        "This proposal is outside your request custody",
        "proposal.outside_request_custody",
      ),
    };
  }
  if (row.decision !== "Pending") {
    return { refusal: refusal(409, "This proposal has already been decided", "proposal.decided") };
  }
  return { value: row };
}

function withoutPendingFields(request: Request) {
  const {
    decision: _decision,
    isAfterProjectApproval: _isAfterProjectApproval,
    ...base
  } = request as Extract<Request, { decision: "Pending" }>;
  return base;
}

function approvedRequest(
  ask: Request,
  iteration: Iteration,
  originating: boolean,
  rescan: Extract<Request, { decision: "Approved" }>["rescan"],
): Request {
  return {
    ...withoutPendingFields(ask),
    decision: "Approved",
    iteration: { relation: originating ? "Originates" : "Tracks", id: iteration.id },
    rescan: originating ? rescan : null,
  };
}

function baseWrites(): DecisionWrites {
  return { iterations: [], requests: [], events: [] };
}

// One item decided on its own, or a batch approved under one category.
// One iteration for the document: the oldest ask originates it and its project funds it; every
// other ask follows it (status-model.md §2.7).
function plannedApproval(
  categories: RecordStore["categories"],
  session: Session,
  row: RequestRow,
  approval: Approval,
  now: Date,
  newId: NewId,
): DecisionWrites {
  const writes = baseWrites();
  const asks = asksOf(row);
  const originating = asks[0];
  if (originating === undefined) return writes;
  const at = now.toISOString();
  const iteration: Iteration = {
    id: newId("IT"),
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
  writes.iterations.push(iteration);
  const rescan =
    approval.rescanNote === null
      ? null
      : { actorId: session.user.id, at, note: approval.rescanNote };
  for (const ask of asks)
    writes.requests.push(approvedRequest(ask, iteration, ask === originating, rescan));
  const correlationId = newId("C");
  for (const ask of asks) {
    writes.events.push({
      subjectKind: "request",
      subjectId: ask.id,
      at,
      actor: { kind: "user", userId: session.user.id },
      correlationId,
      code: "request.approved",
      data: {
        iterationId: iteration.id,
        isRescan: rescan !== null,
        batchSize: asks.length > 1 ? asks.length : null,
        suggestion:
          row.suggestion === null
            ? null
            : {
                category: {
                  id: row.suggestion.categoryId,
                  name: categoryPathOf(categories, row.suggestion.categoryId)
                    .map((category) => category.name)
                    .join(" / "),
                },
                classifier: row.suggestion.classifier,
                kept: approval.categoryId === row.suggestion.categoryId,
              },
      },
      reason: { public: null, internal: rescan === null ? null : rescan.note },
    });
  }
  return writes;
}

export function planApproval(
  store: RecordStore,
  plugins: RequestPlugins,
  session: Session,
  documentId: string,
  approval: Approval,
  now: Date,
  newId: NewId,
): QueryOutcome<Planned<DecisionResult>> {
  const found = openRowFor(store, plugins, session, documentId);
  if ("refusal" in found) return found;
  const categoryRefusal = leafCategoryRefusal(store, approval.categoryId);
  if (categoryRefusal !== null) return { refusal: categoryRefusal };
  const row = found.value;
  if (isBeingChecked(row))
    return { refusal: refusal(409, "The checks have not answered yet", "proposal.checks_pending") };
  if (isRescan(row) && approval.rescanNote === null)
    return {
      refusal: refusal(422, "Say why it is scanned again", "proposal.rescan_reason_missing"),
    };
  return {
    value: {
      writes: plannedApproval(store.categories, session, row, approval, now, newId),
      result: { documentId, decision: "Approved", askCount: asksOf(row).length },
    },
  };
}

export function planDecline(
  store: RecordStore,
  plugins: RequestPlugins,
  session: Session,
  documentId: string,
  decline: Decline,
  now: Date,
): QueryOutcome<Planned<DecisionResult>> {
  const found = openRowFor(store, plugins, session, documentId);
  if ("refusal" in found) return found;
  const asks = asksOf(found.value);
  const at = now.toISOString();
  const correlationId = crypto.randomUUID();
  const writes = baseWrites();
  for (const ask of asks) {
    writes.requests.push({
      ...withoutPendingFields(ask),
      decision: "Denied",
      decline: { actorId: session.user.id, at, ...decline },
    });
    // Each asker's history tells them; the entries share one cause.
    writes.events.push({
      subjectKind: "request",
      subjectId: ask.id,
      at,
      actor: { kind: "user", userId: session.user.id },
      correlationId,
      code: "request.declined",
      data: { batchSize: asks.length > 1 ? asks.length : null },
      reason: { public: decline.publicText, internal: decline.internalText || null },
    });
  }
  return { value: { writes, result: { documentId, decision: "Denied", askCount: asks.length } } };
}

export function planWithdrawal(
  store: RecordStore,
  session: Session,
  documentId: string,
  now: Date,
): QueryOutcome<Planned<WithdrawalResult>> {
  if (!hasPermission(session, "request.withdraw_own"))
    return { refusal: refusal(403, "You may not withdraw asks") };
  const own = store.requests.filter(
    (request) => request.documentId === documentId && request.requesterId === session.user.id,
  );
  if (own.length === 0)
    return { refusal: refusal(404, "You have not asked for this document", "request.not_asked") };
  const ask = own.find((request) => request.decision === "Pending");
  if (ask === undefined)
    return { refusal: refusal(409, "It has been decided meanwhile", "proposal.decided") };
  const at = now.toISOString();
  return {
    value: {
      writes: {
        iterations: [],
        requests: [{ ...withoutPendingFields(ask), decision: "Withdrawn", withdrawnAt: at }],
        events: [
          {
            subjectKind: "request",
            subjectId: ask.id,
            at,
            actor: { kind: "user", userId: session.user.id },
            correlationId: crypto.randomUUID(),
            code: "request.withdrawn",
            data: {},
            reason: { public: null, internal: null },
          },
        ],
      },
      result: { documentId, requestId: ask.id },
    },
  };
}

function applyWrites(store: RecordStore, writes: DecisionWrites): RecordStore {
  const requests = [...store.requests];
  for (const replacement of writes.requests) {
    const index = requests.findIndex((request) => request.id === replacement.id);
    if (index >= 0) requests[index] = replacement;
  }
  return { ...store, iterations: [...store.iterations, ...writes.iterations], requests };
}

export function planBulkApproval(
  store: RecordStore,
  plugins: RequestPlugins,
  session: Session,
  batchId: string,
  bulk: BulkApproval,
  now: Date,
  newId: NewId,
): QueryOutcome<Planned<BulkApprovalResult>> {
  if (!store.batches.some((batch) => batch.id === batchId))
    return { refusal: refusal(404, "No such batch") };
  const categoryRefusal = leafCategoryRefusal(store, bulk.categoryId);
  if (categoryRefusal !== null) return { refusal: categoryRefusal };
  const open = reachableRows(store, plugins, session).filter(
    (row) =>
      row.decision === "Pending" &&
      batchIdsOf(row).includes(batchId) &&
      isDecidableBy(store, session, row),
  );
  const excludedIds = new Set(bulk.excludedIds);
  const taken = open.filter(
    (row) => isBulkApprovable(row) && !excludedIds.has(row.record.document.id),
  );
  if (taken.length === 0)
    return {
      refusal: refusal(409, "Nothing in this batch is left to approve", "batch.nothing_to_approve"),
    };
  const writes = baseWrites();
  let working = store;
  for (const row of taken) {
    const planned = planApproval(
      working,
      plugins,
      session,
      row.record.document.id,
      { ...bulk, rescanNote: null },
      now,
      newId,
    );
    if ("refusal" in planned) return planned;
    writes.iterations.push(...planned.value.writes.iterations);
    writes.requests.push(...planned.value.writes.requests);
    writes.events.push(...planned.value.writes.events);
    working = applyWrites(working, planned.value.writes);
  }
  return {
    value: {
      writes,
      result: {
        approvedCount: taken.length,
        rescanCount: open.filter(isRescan).length,
        checkingCount: open.filter((row) => !isRescan(row) && isBeingChecked(row)).length,
      },
    },
  };
}
