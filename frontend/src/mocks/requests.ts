// What the server does for Requests: gather each document's asks into one row, keep the rows to
// the reach of the caller's `request.read`, then search, filter, count, sort and group; and
// decide. A decision covers every open ask of the document, writes the status log, and on
// approval creates the one iteration the oldest ask originates (status-model.md §2.7).

import {
  planApproval,
  planBulkApproval,
  planDecline,
  planWithdrawal,
} from "@vera/contract/queries/decisions";
import type { RequestPlugins } from "@vera/contract/queries/requests";
import { baseIdOf } from "@vera/contract/queries/requests";
import type {
  Approval,
  BulkApproval,
  BulkApprovalResult,
  DecisionResult,
  Decline,
  WithdrawalResult,
} from "@vera/contract/requests";
import type { Iteration, Request, Session } from "@vera/domain/entities";
import type { EventEntryInput } from "@vera/domain/events";
import { suggestionFor } from "@/mocks/classification";
import { database, mockStore } from "@/mocks/database";
import { custodyPlacements, houseRuleOf } from "@/mocks/fixtures/request-custodies";
import type { Outcome } from "@/mocks/mutations";
import { writeLog } from "@/mocks/mutations";

// The mock answers the plugins the Requests queries ask about custody and classification.
export const mockRequestPlugins: RequestPlugins = {
  placementsOf: (request, document) =>
    custodyPlacements[baseIdOf(request.id)] ?? houseRuleOf(request, document),
  suggestionFor,
};

// ---------------------------------------------------------------- decisions

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function writeDecision(writes: {
  iterations: Iteration[];
  requests: Request[];
  events: EventEntryInput[];
}): void {
  database.iterations.push(...writes.iterations);
  for (const request of writes.requests) replaceRequest(request);
  for (const event of writes.events) writeLog(event);
}

export function approveProposal(
  session: Session,
  documentId: string,
  approval: Approval,
): Outcome<DecisionResult> {
  const planned = planApproval(
    mockStore(),
    mockRequestPlugins,
    session,
    documentId,
    approval,
    new Date(),
    newId,
  );
  if ("refusal" in planned) return planned;
  writeDecision(planned.value.writes);
  return { value: planned.value.result };
}

export function declineProposal(
  session: Session,
  documentId: string,
  decline: Decline,
): Outcome<DecisionResult> {
  const planned = planDecline(
    mockStore(),
    mockRequestPlugins,
    session,
    documentId,
    decline,
    new Date(),
  );
  if ("refusal" in planned) return planned;
  writeDecision(planned.value.writes);
  return { value: planned.value.result };
}

// The asker takes back their own ask on the document while it waits (ACT-withdraw); they have at
// most one open (LC-REQ-check). It is Withdrawn for good, and asking again makes a new request
// (LC-REQ-final). Others' asks stand.
export function withdrawAsk(session: Session, documentId: string): Outcome<WithdrawalResult> {
  const planned = planWithdrawal(mockStore(), session, documentId, new Date());
  if ("refusal" in planned) return planned;
  writeDecision(planned.value.writes);
  return { value: planned.value.result };
}

// Takes every open row the batch asked for that may be approved together, wherever its earliest
// ask was, but those unticked; a rescan or an ask still being checked is decided on its own
// (status-model.md §2.8), and is counted as left out.
export function bulkApproveProposals(
  session: Session,
  batchId: string,
  bulk: BulkApproval,
): Outcome<BulkApprovalResult> {
  const planned = planBulkApproval(
    mockStore(),
    mockRequestPlugins,
    session,
    batchId,
    bulk,
    new Date(),
    newId,
  );
  if ("refusal" in planned) return planned;
  writeDecision(planned.value.writes);
  return { value: planned.value.result };
}

function replaceRequest(request: Request): void {
  const index = database.requests.findIndex((candidate) => candidate.id === request.id);
  database.requests.splice(index, 1, request);
}
