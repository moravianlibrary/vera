// The Requests resource (VIEW-requests): one row per document asked for, within the reach of
// the caller's `request.read`; one document's asks with their history; and the decisions on a
// proposal, within the reach of `request.decide`. A decision covers every open ask of the
// document (status-model.md §2.7). Approving sets the category and the priority; over an
// existing copy it is a rescan and needs a note. A decline carries what every asker is told. An
// asker withdraws their own ask while it waits, with nothing to say (ACT-withdraw).

import { z } from "zod";
import type { Answer } from "@/api/documents";
import { answerSchema } from "@/api/documents";
import { facetCountsOf } from "@/api/facets";
import { findJson, getJson, postJson } from "@/api/http";
import {
  apiRoutes,
  askWithdrawalRoute,
  proposalBulkApprovalRoute,
  proposalDecisionRoute,
  requestRoute,
} from "@/api/routes";
import type { ExistingCopyState } from "@/domain/documents";
import { existingCopyStateSchema } from "@/domain/documents";
import type { DocumentType, RequestCustody } from "@/domain/entities";
import {
  batchSchema,
  documentTypeSchema,
  prioritySchema,
  requestCustodySchema,
  statusLogEntrySchema,
} from "@/domain/entities";
import type { ProposalDecision } from "@/domain/requests";
import { proposalDecisionSchema, requestRowSchema } from "@/domain/requests";
import type { DayRange } from "@/lib/value-range";
import { formatDayRange, parseDayRange } from "@/lib/value-range";

// ---------------------------------------------------------------- query

// How many people asked: one, or several who share one decision.
export const askerCounts = ["One", "Several"] as const;
export const askerCountSchema = z.enum(askerCounts);
export type AskerCount = z.infer<typeof askerCountSchema>;

// Each list matches any of its values; the fields together match all of them (filtering.md §2).
export interface RequestQuery {
  readonly search?: string;
  readonly decisions?: readonly ProposalDecision[];
  readonly custodyIds?: readonly string[];
  readonly documentTypes?: readonly DocumentType[];
  readonly projectIds?: readonly string[];
  readonly existingCopies?: readonly ExistingCopyState[];
  readonly askerIds?: readonly string[];
  readonly batchIds?: readonly string[];
  readonly askerCounts?: readonly AskerCount[];
  readonly afterProjectApproval?: readonly Answer[];
  // Advanced, a range rather than values (filtering.md §6): the day any of the row's asks was
  // made.
  readonly asked?: DayRange;
}

// The fields that are lists of values, each counted as a facet.
export type RequestListField = Exclude<keyof RequestQuery, "search" | RequestRangeField>;
export type RequestRangeField = "asked";

// Query-string names; the same names address the filter in the page URL.
export const requestQueryParams = {
  search: "q",
  decisions: "decision",
  custodyIds: "custody",
  documentTypes: "type",
  projectIds: "project",
  existingCopies: "copy",
  askerIds: "asker",
  batchIds: "batch",
  askerCounts: "askers",
  afterProjectApproval: "after",
  asked: "asked",
} as const satisfies Record<keyof RequestQuery, string>;

const idValueSchema = z.string().min(1);

const requestFieldSchemas = {
  decisions: proposalDecisionSchema,
  custodyIds: idValueSchema,
  documentTypes: documentTypeSchema,
  projectIds: idValueSchema,
  existingCopies: existingCopyStateSchema,
  askerIds: idValueSchema,
  batchIds: idValueSchema,
  askerCounts: askerCountSchema,
  afterProjectApproval: answerSchema,
} as const satisfies Record<RequestListField, z.ZodType<string>>;

const listFields = Object.keys(requestFieldSchemas) as RequestListField[];
const listSeparator = ",";

export function toRequestSearchParams(query: RequestQuery): URLSearchParams {
  const params = new URLSearchParams();
  const search = query.search?.trim();
  if (search) {
    params.set(requestQueryParams.search, search);
  }

  for (const field of listFields) {
    const values = query[field];
    if (values === undefined || values.length === 0) {
      continue;
    }

    params.set(requestQueryParams[field], values.toSorted().join(listSeparator));
  }

  const asked = formatDayRange(query.asked);
  if (asked !== null) {
    params.set(requestQueryParams.asked, asked);
  }

  return params;
}

// Unknown or malformed values are dropped, so a stale link still opens the view.
export function parseRequestSearchParams(params: URLSearchParams): RequestQuery {
  const query: Record<string, unknown> = {
    search: params.get(requestQueryParams.search)?.trim() || undefined,
  };
  for (const field of listFields) {
    const raw = params.get(requestQueryParams[field]) ?? "";
    const values = raw.split(listSeparator).flatMap((value) => {
      const parsed = requestFieldSchemas[field].safeParse(value.trim());
      return parsed.success ? [parsed.data] : [];
    });
    query[field] = values.length === 0 ? undefined : [...new Set(values)];
  }

  query.asked = parseDayRange(params.get(requestQueryParams.asked));

  // Every value of each field was parsed by that field's own schema.
  return query as RequestQuery;
}

// True when the two name the same filter, however their lists are ordered.
export function isSameRequestQuery(first: RequestQuery, second: RequestQuery): boolean {
  const canonical = (query: RequestQuery) => {
    const params = toRequestSearchParams(query);
    params.sort();
    return params.toString();
  };

  return canonical(first) === canonical(second);
}

// ---------------------------------------------------------------- grouping

// How the rows are arranged; not a filter, and never saved in a watchlist. A document asked for
// in two batches, or by two people, is one row, listed with its earliest ask.
export const requestGroupings = ["batch", "requester"] as const;
export const requestGroupingSchema = z.enum(requestGroupings);
export type RequestGrouping = z.infer<typeof requestGroupingSchema>;

export const requestGroupingParam = "group";

export function parseRequestGrouping(params: URLSearchParams): RequestGrouping | null {
  const grouping = requestGroupingSchema.safeParse(params.get(requestGroupingParam));
  return grouping.success ? grouping.data : null;
}

// ---------------------------------------------------------------- slices

export const requestSliceParams = { cursor: "cursor", limit: "limit" } as const;
export const requestSliceSize = 50;
export const maximumRequestSliceSize = 200;

export function parseRequestSliceParams(params: URLSearchParams): {
  cursor: string | null;
  limit: number;
} {
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(maximumRequestSliceSize)
    .safeParse(params.get(requestSliceParams.limit) ?? undefined);
  return {
    cursor: params.get(requestSliceParams.cursor) || null,
    limit: limit.success ? limit.data : requestSliceSize,
  };
}

// ---------------------------------------------------------------- responses

const groupCounts = {
  // Rows of the group matching the whole filter, across every slice.
  total: z.number().int(),
  // How many of this slice's rows, next in order, fall into the group.
  rowCount: z.number().int(),
};

export const requestGroupSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("batch"),
    // Null gathers what was proposed on its own.
    batch: batchSchema.nullable(),
    // The batch's asks that match the filter, and how many of those are on rows listed with an
    // earlier ask from elsewhere.
    askCount: z.number().int(),
    elsewhereCount: z.number().int(),
    // Over every open row in reach the batch asked for, filtered or not: what a bulk approve
    // takes, and what it leaves to be decided one at a time.
    approvableCount: z.number().int(),
    // Of those, how many a classifier suggested each leaf for; a bulk approve under one category
    // overrides the others (plugins.md §4.13).
    suggestedCounts: z.array(z.object({ value: z.string(), count: z.number().int() })),
    rescanCount: z.number().int(),
    checkingCount: z.number().int(),
    ...groupCounts,
  }),
  z.object({
    kind: z.literal("requester"),
    userId: z.string(),
    // Rows in the group someone else asked for too.
    sharedCount: z.number().int(),
    ...groupCounts,
  }),
]);
export type RequestGroup = z.infer<typeof requestGroupSchema>;

export const requestPageSchema = z.object({
  items: z.array(requestRowSchema),
  // Rows and asks matching the whole filter, across every slice.
  total: z.number().int(),
  askTotal: z.number().int(),
  nextCursor: z.string().nullable(),
  groups: z.array(requestGroupSchema),
  // Each field's values with a match, counted over every other active filter.
  facets: z.object({
    decisions: facetCountsOf(proposalDecisionSchema),
    custodyIds: facetCountsOf(z.string()),
    documentTypes: facetCountsOf(documentTypeSchema),
    projectIds: facetCountsOf(z.string()),
    existingCopies: facetCountsOf(existingCopyStateSchema),
    askerIds: facetCountsOf(z.string()),
    batchIds: facetCountsOf(z.string()),
    askerCounts: facetCountsOf(askerCountSchema),
    afterProjectApproval: facetCountsOf(answerSchema),
  } satisfies Record<RequestListField, z.ZodType>),
});
export type RequestPage = z.infer<typeof requestPageSchema>;

export const requestDetailSchema = z.object({
  row: requestRowSchema,
  // Newest first.
  log: z.array(statusLogEntrySchema),
  // Whether the caller's `request.decide` reaches this proposal (VIEW-requests).
  canDecide: z.boolean(),
});
export type RequestDetail = z.infer<typeof requestDetailSchema>;

// ---------------------------------------------------------------- decisions

export const approvalSchema = z.object({
  categoryId: idValueSchema,
  priority: prioritySchema,
  // Why it is scanned again; required over an existing copy, and kept in the history.
  rescanNote: z.string().trim().min(1).nullable(),
});
export type Approval = z.infer<typeof approvalSchema>;

export const declineSchema = z.object({
  // Read by every asker, so it is about the document, never a motive.
  publicText: z.string().trim().min(1),
  internalText: z.string().trim().min(1).nullable(),
});
export type Decline = z.infer<typeof declineSchema>;

// A batch is approved on the server, however many it asked for (a harvest may bring thousands):
// the dialog names the batch and what was unticked, never the documents it takes.
export const bulkApprovalSchema = z.object({
  categoryId: idValueSchema,
  priority: prioritySchema,
  // Unticked, to be decided on their own.
  excludedIds: z.array(idValueSchema),
});
export type BulkApproval = z.infer<typeof bulkApprovalSchema>;

export const decisionResultSchema = z.object({
  documentId: z.string(),
  decision: z.enum(["Approved", "Denied"]),
  // Every open ask the decision covered.
  askCount: z.number().int(),
});
export type DecisionResult = z.infer<typeof decisionResultSchema>;

// The caller's ask it took back, their only open one on the document (LC-REQ-check): Withdrawn
// from then on, and asking again makes a new request (LC-REQ-final).
export const withdrawalResultSchema = z.object({
  documentId: z.string(),
  requestId: z.string(),
});
export type WithdrawalResult = z.infer<typeof withdrawalResultSchema>;

// What the bulk approve took, and what it left to be decided on its own, counted when it ran.
export const bulkApprovalResultSchema = z.object({
  approvedCount: z.number().int(),
  rescanCount: z.number().int(),
  checkingCount: z.number().int(),
});
export type BulkApprovalResult = z.infer<typeof bulkApprovalResultSchema>;

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
