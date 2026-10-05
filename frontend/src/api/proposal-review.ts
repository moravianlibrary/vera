// The Proposal Review resource (view-map.md §2): one row per document awaiting a decision within
// the caller's proposal custody, or everywhere with `request.decide@any`; one document's
// proposal with its history; and the decisions on it. A decision covers every open ask of the
// document (status-model.md §2.7). Approving sets the category and the priority; over an
// existing copy it is a rescan and needs a note. A decline carries what every asker is told.

import { z } from "zod";
import type { Answer } from "@/api/documents";
import { answerSchema } from "@/api/documents";
import { findJson, getJson, postJson } from "@/api/http";
import { apiRoutes, proposalDecisionRoute, proposalReviewRoute } from "@/api/routes";
import type { ExistingCopyState } from "@/domain/documents";
import { existingCopyStateSchema } from "@/domain/documents";
import type { DocumentType, ProposalCustody } from "@/domain/entities";
import {
  batchSchema,
  documentTypeSchema,
  prioritySchema,
  proposalCustodySchema,
  statusLogEntrySchema,
} from "@/domain/entities";
import type { ProposalDecision } from "@/domain/proposal-review";
import { proposalDecisionSchema, proposalRowSchema } from "@/domain/proposal-review";

// ---------------------------------------------------------------- query

// How many people asked: one, or several who share one decision.
export const askerCounts = ["One", "Several"] as const;
export const askerCountSchema = z.enum(askerCounts);
export type AskerCount = z.infer<typeof askerCountSchema>;

// Each list matches any of its values; the fields together match all of them (filtering.md §2).
export interface ProposalQuery {
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
}
// TODO(rrandiak): Asked, a date range, once the Advanced editor exists (filtering.md §3.3).

export type ProposalListField = Exclude<keyof ProposalQuery, "search">;

// Query-string names; the same names address the filter in the page URL.
export const proposalQueryParams = {
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
} as const satisfies Record<keyof ProposalQuery, string>;

const idValueSchema = z.string().min(1);

const proposalFieldSchemas = {
  decisions: proposalDecisionSchema,
  custodyIds: idValueSchema,
  documentTypes: documentTypeSchema,
  projectIds: idValueSchema,
  existingCopies: existingCopyStateSchema,
  askerIds: idValueSchema,
  batchIds: idValueSchema,
  askerCounts: askerCountSchema,
  afterProjectApproval: answerSchema,
} as const satisfies Record<ProposalListField, z.ZodType<string>>;

const listFields = Object.keys(proposalFieldSchemas) as ProposalListField[];
const listSeparator = ",";

export function toProposalSearchParams(query: ProposalQuery): URLSearchParams {
  const params = new URLSearchParams();
  const search = query.search?.trim();
  if (search) {
    params.set(proposalQueryParams.search, search);
  }

  for (const field of listFields) {
    const values = query[field];
    if (values === undefined || values.length === 0) {
      continue;
    }

    params.set(proposalQueryParams[field], values.toSorted().join(listSeparator));
  }

  return params;
}

// Unknown or malformed values are dropped, so a stale link still opens the view.
export function parseProposalSearchParams(params: URLSearchParams): ProposalQuery {
  const query: Record<string, unknown> = {
    search: params.get(proposalQueryParams.search)?.trim() || undefined,
  };
  for (const field of listFields) {
    const raw = params.get(proposalQueryParams[field]) ?? "";
    const values = raw.split(listSeparator).flatMap((value) => {
      const parsed = proposalFieldSchemas[field].safeParse(value.trim());
      return parsed.success ? [parsed.data] : [];
    });
    query[field] = values.length === 0 ? undefined : [...new Set(values)];
  }

  // Every value of each field was parsed by that field's own schema.
  return query as ProposalQuery;
}

// True when the two name the same filter, however their lists are ordered.
export function isSameProposalQuery(first: ProposalQuery, second: ProposalQuery): boolean {
  const canonical = (query: ProposalQuery) => {
    const params = toProposalSearchParams(query);
    params.sort();
    return params.toString();
  };

  return canonical(first) === canonical(second);
}

// ---------------------------------------------------------------- grouping

// How the rows are arranged; not a filter, and never saved in a watchlist. A document asked for
// in two batches, or by two people, is one row, listed with its earliest ask.
export const proposalGroupings = ["batch", "requester"] as const;
export const proposalGroupingSchema = z.enum(proposalGroupings);
export type ProposalGrouping = z.infer<typeof proposalGroupingSchema>;

export const proposalGroupingParam = "group";

export function parseProposalGrouping(params: URLSearchParams): ProposalGrouping | null {
  const grouping = proposalGroupingSchema.safeParse(params.get(proposalGroupingParam));
  return grouping.success ? grouping.data : null;
}

// ---------------------------------------------------------------- slices

export const proposalSliceParams = { cursor: "cursor", limit: "limit" } as const;
export const proposalSliceSize = 50;
export const maximumProposalSliceSize = 200;

export function parseProposalSliceParams(params: URLSearchParams): {
  cursor: string | null;
  limit: number;
} {
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(maximumProposalSliceSize)
    .safeParse(params.get(proposalSliceParams.limit) ?? undefined);
  return {
    cursor: params.get(proposalSliceParams.cursor) || null,
    limit: limit.success ? limit.data : proposalSliceSize,
  };
}

// ---------------------------------------------------------------- responses

function facetCountsOf<Value extends z.ZodType>(value: Value) {
  return z.array(z.object({ value, count: z.number().int() }));
}

const groupCounts = {
  // Rows of the group matching the whole filter, across every slice.
  total: z.number().int(),
  // How many of this slice's rows, next in order, fall into the group.
  rowCount: z.number().int(),
};

export const proposalGroupSchema = z.discriminatedUnion("kind", [
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
export type ProposalGroup = z.infer<typeof proposalGroupSchema>;

export const proposalPageSchema = z.object({
  items: z.array(proposalRowSchema),
  // Rows and asks matching the whole filter, across every slice.
  total: z.number().int(),
  askTotal: z.number().int(),
  nextCursor: z.string().nullable(),
  groups: z.array(proposalGroupSchema),
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
  } satisfies Record<ProposalListField, z.ZodType>),
});
export type ProposalPage = z.infer<typeof proposalPageSchema>;

export const proposalDetailSchema = z.object({
  row: proposalRowSchema,
  // Newest first.
  log: z.array(statusLogEntrySchema),
});
export type ProposalDetail = z.infer<typeof proposalDetailSchema>;

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

export const bulkApprovalSchema = z.object({
  documentIds: z.array(idValueSchema).min(1),
  categoryId: idValueSchema,
  priority: prioritySchema,
});
export type BulkApproval = z.infer<typeof bulkApprovalSchema>;

export const decisionResultSchema = z.object({
  documentId: z.string(),
  decision: z.enum(["Approved", "Denied"]),
  // Every open ask the decision covered.
  askCount: z.number().int(),
});
export type DecisionResult = z.infer<typeof decisionResultSchema>;

// A bulk approve leaves out what needs deciding on its own, and says why.
export const bulkSkipReasons = ["rescan", "beingChecked", "decided", "outOfReach"] as const;

export const bulkApprovalResultSchema = z.object({
  approvedIds: z.array(z.string()),
  skipped: z.array(z.object({ documentId: z.string(), reason: z.enum(bulkSkipReasons) })),
});
export type BulkApprovalResult = z.infer<typeof bulkApprovalResultSchema>;

// ---------------------------------------------------------------- calls

interface ProposalListOptions {
  readonly grouping?: ProposalGrouping | null;
  readonly cursor?: string | null;
  readonly limit?: number;
}

export async function listProposals(
  query: ProposalQuery,
  { grouping = null, cursor = null, limit = proposalSliceSize }: ProposalListOptions = {},
): Promise<ProposalPage> {
  const params = toProposalSearchParams(query);
  if (grouping !== null) {
    params.set(proposalGroupingParam, grouping);
  }

  if (cursor !== null) {
    params.set(proposalSliceParams.cursor, cursor);
  }

  params.set(proposalSliceParams.limit, String(limit));
  return getJson(apiRoutes.proposalReview, proposalPageSchema, params);
}

// Null when the document has no proposal within the caller's reach.
export async function findProposal(documentId: string): Promise<ProposalDetail | null> {
  return findJson(proposalReviewRoute(documentId), proposalDetailSchema);
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

export async function bulkApproveProposals(approval: BulkApproval): Promise<BulkApprovalResult> {
  return postJson(apiRoutes.proposalBulkApproval, approval, bulkApprovalResultSchema);
}

export async function listProposalCustodies(): Promise<ProposalCustody[]> {
  return getJson(apiRoutes.proposalCustodies, z.array(proposalCustodySchema));
}
