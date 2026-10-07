// Proposal Review's read model (view-map.md §2): one row per document, never one per ask, since
// a decision on one ask is a decision on all of them (status-model.md §2.7). A row holds the
// document's asks that share its decision, oldest first: the open ones while any is open,
// otherwise the declined or the withdrawn ones. Everything a row says about itself is derived
// here, so the list, the pane and the server read it the same way.

import { z } from "zod";
import { documentRecordSchema, existingCopiesOf } from "@/domain/documents";
import type { Request } from "@/domain/entities";

// The decisions a proposal can rest at. Pending is open; the others stay one filter away
// (status-model.md §6), which the shared "Awaiting a decision" watchlist leaves out.
export const proposalDecisions = ["Pending", "Denied", "Withdrawn"] as const;
export const proposalDecisionSchema = z.enum(proposalDecisions);
export type ProposalDecision = z.infer<typeof proposalDecisionSchema>;

// A Classifier plugin's suggestion (plugins.md §4.13): a leaf and the sentence the decider reads
// beside it, from the instance that made it. It only opens the decide form on that leaf; a
// suggestion nobody confirmed is not a classification (concepts.md *Category*).
export const classifierSuggestionSchema = z.object({
  categoryId: z.string(),
  reason: z.string(),
  classifier: z.object({ id: z.string(), name: z.string() }),
});
export type ClassifierSuggestion = z.infer<typeof classifierSuggestionSchema>;

export const proposalRowSchema = z.object({
  // The document, its earlier attempts and the asks of this row, oldest first.
  record: documentRecordSchema,
  decision: proposalDecisionSchema,
  // The proposal custodies the Custody plugins placed its asks in; the fallback when none.
  custodyIds: z.array(z.string()),
  // For the oldest open ask, which originates the iteration; null when no classifier is
  // configured, none suggested, or the checks have not finished.
  suggestion: classifierSuggestionSchema.nullable(),
});
export type ProposalRow = z.infer<typeof proposalRowSchema>;

export function isProposalDecision(decision: Request["decision"]): decision is ProposalDecision {
  return proposalDecisionSchema.safeParse(decision).success;
}

// The open asks, or failing those the declined, or the withdrawn: the decision a row stands for.
export function rowDecisionOf(requests: readonly Request[]): ProposalDecision | null {
  const decisions = new Set(requests.map((request) => request.decision));
  return proposalDecisions.find((decision) => decisions.has(decision)) ?? null;
}

export function asksOf(row: ProposalRow): Request[] {
  return row.record.requests;
}

export function firstAskOf(row: ProposalRow): Request | null {
  return row.record.requests[0] ?? null;
}

export function askerIdsOf(row: ProposalRow): string[] {
  return [...new Set(asksOf(row).map((request) => request.requesterId))];
}

// Approving over a copy is a rescan, decided one item at a time.
export function isRescan(row: ProposalRow): boolean {
  return existingCopiesOf(asksOf(row)).length > 0;
}

// The copy check has not answered for some ask, so nobody knows yet whether it is a rescan.
export function isBeingChecked(row: ProposalRow): boolean {
  return row.decision === "Pending" && asksOf(row).some((request) => request.checkedAt === null);
}

// Approval was asked for on arrival and a copy turned up, so it waits here (status-model §2.8).
export function isHeld(row: ProposalRow): boolean {
  return (
    row.decision === "Pending" &&
    isRescan(row) &&
    asksOf(row).some((request) => request.decision === "Pending" && request.approveOnCheck !== null)
  );
}

export function isAfterProjectApproval(row: ProposalRow): boolean {
  return asksOf(row).some(
    (request) => request.decision === "Pending" && request.isAfterProjectApproval,
  );
}

// What a bulk approve takes: open, no copy, and checked.
export function isBulkApprovable(row: ProposalRow): boolean {
  return row.decision === "Pending" && !isRescan(row) && !isBeingChecked(row);
}

export function projectIdsOf(row: ProposalRow): string[] {
  return [
    ...new Set(
      asksOf(row).flatMap((request) => (request.projectId === null ? [] : [request.projectId])),
    ),
  ];
}

export function batchIdsOf(row: ProposalRow): string[] {
  return [
    ...new Set(
      asksOf(row).flatMap((request) => (request.batchId === null ? [] : [request.batchId])),
    ),
  ];
}

// The distinct reasons the askers gave, in the order they asked.
export function reasonsOf(row: ProposalRow): string[] {
  return [
    ...new Set(asksOf(row).flatMap((request) => (request.reason === null ? [] : [request.reason]))),
  ];
}
