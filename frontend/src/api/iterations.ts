// What may be changed on a document's current iteration from the Documents and Validations panes:
// reclassify it, set where its scan is available, enter its
// page count, run the checks again over the record as the catalog has it now, cancel it and resume
// it (ACT-cancel, ACT-resume), and overrule its restriction (ACT-overrule). Each is its own
// permission, scoped by the iteration's category (permissions.md §3), and the server checks it
// again; a pane only leaves out what the caller may not do.

import { z } from "zod";
import { postJson } from "@/api/http";
import { iterationActionRoute } from "@/api/routes";
import { prioritySchema, progressSchema } from "@/domain/entities";
import { reviewStateSchema } from "@/domain/validations";

const idValueSchema = z.string().trim().min(1);

// ---------------------------------------------------------------- reclassify

// Category and priority after approval, before the scan exists (flows.md V13).
export const reclassificationSchema = z.object({
  categoryId: idValueSchema,
  priority: prioritySchema,
});
export type Reclassification = z.infer<typeof reclassificationSchema>;

export const reclassificationResultSchema = z.object({
  categoryId: z.string(),
  priority: prioritySchema,
  // Moved out of the caller's custody: it leaves their queues and they cannot move it back.
  isHandedOver: z.boolean(),
});
export type ReclassificationResult = z.infer<typeof reclassificationResultSchema>;

// ---------------------------------------------------------------- publish

// Where a reader opens the scan. Setting it is what makes the item Published (flows.md P1).
export const publicationSchema = z.object({
  link: z.url({ protocol: /^https?$/ }),
});
export type Publication = z.infer<typeof publicationSchema>;

export const publicationResultSchema = z.object({
  publishedLink: z.url(),
  progress: progressSchema,
});
export type PublicationResult = z.infer<typeof publicationResultSchema>;

// ---------------------------------------------------------------- page count and recheck

// A page count someone counted: the manual source, above the catalog and the predictor
// (document-properties.md §4). The one value entered in VERA; entering it runs the checks again.
// Every other defect is repaired in the catalog and picked up by a recheck (decided 2026-10-06).
export const pageCountSchema = z.object({
  pages: z.number().int().positive(),
});
export type PageCount = z.infer<typeof pageCountSchema>;

// A recheck carries nothing: it pulls the record from the catalog and runs the checks.
export const recheckSchema = z.object({});
export type Recheck = z.infer<typeof recheckSchema>;

// What the checks found once they ran again. A defect they no longer find needs no verdict.
export const recheckResultSchema = z.object({
  clearedKeys: z.array(z.string()),
  // Where it stands in Validations now; null once nothing holds it there.
  review: reviewStateSchema.nullable(),
  progress: progressSchema,
});
export type RecheckResult = z.infer<typeof recheckResultSchema>;

// ---------------------------------------------------------------- cancel

// Held at the gate rather than moved; every asker reads why (component-interfaces.md §6.3).
export const cancellationRequestSchema = z.object({
  publicText: z.string().trim().min(1),
  internalText: z.string().trim().min(1).nullable(),
});
export type CancellationRequest = z.infer<typeof cancellationRequestSchema>;

export const cancellationResultSchema = z.object({
  progress: progressSchema,
  // How many askers are told.
  askerCount: z.number().int(),
});
export type CancellationResult = z.infer<typeof cancellationResultSchema>;

// ---------------------------------------------------------------- resume and overrule

// Resume carries nothing: the hold is lifted and the item returns to the pool, not to its old
// list (LC-ITER-resume).
export const resumeSchema = z.object({});
export type Resume = z.infer<typeof resumeSchema>;

// Why an administrator lifts the restriction; staff read it (ACT-overrule).
export const overruleSchema = z.object({
  note: z.string().trim().min(1),
});
export type Overrule = z.infer<typeof overruleSchema>;

// Where the gates leave it once the hold or the restriction is gone.
export const releaseResultSchema = z.object({
  progress: progressSchema,
});
export type ReleaseResult = z.infer<typeof releaseResultSchema>;

// ---------------------------------------------------------------- calls

export async function reclassifyIteration(
  iterationId: string,
  reclassification: Reclassification,
): Promise<ReclassificationResult> {
  return postJson(
    iterationActionRoute(iterationId, "reclassify"),
    reclassification,
    reclassificationResultSchema,
  );
}

export async function publishIteration(
  iterationId: string,
  publication: Publication,
): Promise<PublicationResult> {
  return postJson(
    iterationActionRoute(iterationId, "publish"),
    publication,
    publicationResultSchema,
  );
}

export async function enterPageCount(
  iterationId: string,
  pageCount: PageCount,
): Promise<RecheckResult> {
  return postJson(iterationActionRoute(iterationId, "page-count"), pageCount, recheckResultSchema);
}

export async function recheckIteration(iterationId: string): Promise<RecheckResult> {
  return postJson(iterationActionRoute(iterationId, "recheck"), {}, recheckResultSchema);
}

export async function cancelIteration(
  iterationId: string,
  cancellation: CancellationRequest,
): Promise<CancellationResult> {
  return postJson(
    iterationActionRoute(iterationId, "cancel"),
    cancellation,
    cancellationResultSchema,
  );
}

export async function resumeIteration(iterationId: string): Promise<ReleaseResult> {
  return postJson(iterationActionRoute(iterationId, "resume"), {}, releaseResultSchema);
}

export async function overruleRestriction(
  iterationId: string,
  overrule: Overrule,
): Promise<ReleaseResult> {
  return postJson(iterationActionRoute(iterationId, "overrule"), overrule, releaseResultSchema);
}
