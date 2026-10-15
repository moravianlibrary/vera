// Proposing: the deployment's limits, the check each item runs as it lands, and the submit that
// turns the items into requests (view-map.md §1, propose). The check asks the catalog for the
// identifier, then VERA for the document, so each item says what submitting will do. One item
// is a request; several are one batch.

import { z } from "zod";
import { recordStatusSchema } from "@/api/documents";
import { getJson, postJson } from "@/api/http";
import { apiRoutes } from "@/api/routes";
import { batchSchema, prioritySchema } from "@/domain/entities";
import { identifierTypeSchema } from "@/domain/proposals";

export const proposalSettingsSchema = z.object({
  // Effective role limit for the current user; null means unlimited.
  maxAtOnce: z.number().int().nonnegative().nullable(),
  // Whether an identifier detector plugin reads each pasted line's type; without one the
  // person picks the type and every line is read as it.
  canDetectTypes: z.boolean(),
});
export type ProposalSettings = z.infer<typeof proposalSettingsSchema>;

// What the server returns about rate limits for the current user.
export const rateLimitStatusSchema = z.object({
  perDay: z.number().int().nonnegative().nullable(),
});
export type RateLimitStatus = z.infer<typeof rateLimitStatusSchema>;

const unit = z.string().min(1).nullable();

export const proposalItemSchema = z.object({
  type: identifierTypeSchema,
  value: z.string().min(1),
  unit,
});
export type ProposalItem = z.infer<typeof proposalItemSchema>;

const found = {
  catalogId: z.string(),
  unit,
  title: z.string(),
};

// What submitting an item will do, by the catalog's and VERA's answers.
export const proposalCheckSchema = z.discriminatedUnion("kind", [
  // Proposes it. Asked before when VERA holds the document but nothing is moving.
  z.object({ kind: z.literal("new"), ...found, isAskedBefore: z.boolean() }),
  // Asks for it too: joins the work under way, or the decision every asker waits on.
  z.object({
    kind: z.literal("inVera"),
    ...found,
    documentId: z.string(),
    status: recordStatusSchema,
  }),
  // The caller already asks for it; skipped.
  z.object({ kind: z.literal("mine"), ...found, documentId: z.string() }),
  // A record of several volumes or issues, and none given: nothing until one is picked.
  z.object({
    kind: z.literal("whichUnit"),
    catalogId: z.string(),
    title: z.string(),
    units: z.array(z.string()).min(1),
  }),
  // Skipped and reported, never guessed.
  z.object({ kind: z.literal("notInCatalog") }),
]);
export type ProposalCheck = z.infer<typeof proposalCheckSchema>;

export const proposalLookupSchema = z.object({ items: z.array(proposalItemSchema).min(1) });

export const proposalDraftSchema = z.object({
  items: z.array(proposalItemSchema.extend({ reason: z.string().nullable() })).min(1),
  // For every item without its own.
  reason: z.string().nullable(),
  projectId: z.string().nullable(),
  // Null leaves the name to the server: when the batch was submitted (ENT-batch).
  batchName: z.string().nullable(),
  // Approve the new items with no copy at once; `request.decide` (LC-REQ-approve-now).
  approval: z.object({ categoryId: z.string(), priority: prioritySchema }).nullable(),
});
export type ProposalDraft = z.infer<typeof proposalDraftSchema>;

export const proposalReportSchema = z.object({
  batch: batchSchema.nullable(),
  proposed: z.number().int().nonnegative(),
  // Of the proposed, those approved at once; the rest stay Pending (LC-REQ-approve-now).
  approved: z.number().int().nonnegative(),
  joined: z.number().int().nonnegative(),
  skipped: z.array(proposalItemSchema),
});
export type ProposalReport = z.infer<typeof proposalReportSchema>;

export async function getProposalSettings(): Promise<ProposalSettings> {
  return getJson(apiRoutes.proposalSettings, proposalSettingsSchema);
}

// One answer per item, in order.
export async function checkProposalItems(items: ProposalItem[]): Promise<ProposalCheck[]> {
  return postJson(apiRoutes.proposalLookup, { items }, z.array(proposalCheckSchema));
}

export async function submitProposal(draft: ProposalDraft): Promise<ProposalReport> {
  return postJson(apiRoutes.proposals, draft, proposalReportSchema);
}

// The remaining rate limit count for the current user, checked before submit.
export async function getRateLimitStatus(): Promise<RateLimitStatus> {
  return getJson(apiRoutes.proposalRateLimit, rateLimitStatusSchema);
}
