// Calls the requests endpoints; what they take and answer is in @vera/contract/requests.

import type {
  Approval,
  BulkApproval,
  BulkApprovalResult,
  DecisionResult,
  Decline,
  RequestDetail,
  RequestGrouping,
  RequestPage,
  RequestQuery,
  WithdrawalResult,
} from "@vera/contract/requests";
import {
  bulkApprovalResultSchema,
  decisionResultSchema,
  requestDetailSchema,
  requestGroupingParam,
  requestPageSchema,
  requestSliceParams,
  requestSliceSize,
  toRequestSearchParams,
  withdrawalResultSchema,
} from "@vera/contract/requests";
import {
  apiRoutes,
  askWithdrawalRoute,
  proposalBulkApprovalRoute,
  proposalDecisionRoute,
  requestRoute,
} from "@vera/contract/routes";
import type { RequestCustody } from "@vera/domain/entities";
import { requestCustodySchema } from "@vera/domain/entities";
import { z } from "zod";
import { findJson, getJson, postJson } from "@/api/http";

// ---------------------------------------------------------------- calls

interface RequestListOptions {
  readonly grouping?: RequestGrouping | null;
  readonly cursor?: string | null;
  readonly limit?: number;
}

export async function listRequests(
  query: RequestQuery,
  { grouping = null, cursor = null, limit = requestSliceSize }: RequestListOptions = {},
): Promise<RequestPage> {
  const params = toRequestSearchParams(query);
  if (grouping !== null) {
    params.set(requestGroupingParam, grouping);
  }

  if (cursor !== null) {
    params.set(requestSliceParams.cursor, cursor);
  }

  params.set(requestSliceParams.limit, String(limit));
  return getJson(apiRoutes.requests, requestPageSchema, params);
}

// Null when the document has no proposal within the caller's reach.
export async function findRequest(documentId: string): Promise<RequestDetail | null> {
  return findJson(requestRoute(documentId), requestDetailSchema);
}

export async function approveProposal(
  documentId: string,
  approval: Approval,
): Promise<DecisionResult> {
  return postJson(proposalDecisionRoute(documentId, "approve"), approval, decisionResultSchema);
}

export async function declineProposal(
  documentId: string,
  decline: Decline,
): Promise<DecisionResult> {
  return postJson(proposalDecisionRoute(documentId, "decline"), decline, decisionResultSchema);
}

export async function withdrawAsk(documentId: string): Promise<WithdrawalResult> {
  return postJson(askWithdrawalRoute(documentId), {}, withdrawalResultSchema);
}

export async function bulkApproveProposals(
  batchId: string,
  approval: BulkApproval,
): Promise<BulkApprovalResult> {
  return postJson(proposalBulkApprovalRoute(batchId), approval, bulkApprovalResultSchema);
}

export async function listRequestCustodies(): Promise<RequestCustody[]> {
  return getJson(apiRoutes.requestCustodies, z.array(requestCustodySchema));
}
