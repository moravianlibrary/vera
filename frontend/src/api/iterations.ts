// What may be changed on a document's current iteration from the Documents and Validations panes:
// move it to another catalog record, reclassify it, set where its scan is available, enter its
// page count or correct a field (the fixes in place, after which the checks run again) and cancel
// it. Each is its own permission, scoped by the iteration's category (permissions.md §3), and the
// server checks it again; a pane only leaves out what the caller may not do.

import { z } from "zod";
import { postJson } from "@/api/http";
import { iterationActionRoute } from "@/api/routes";
import { prioritySchema, progressSchema } from "@/domain/entities";
import { reviewStateSchema } from "@/domain/validations";

const idValueSchema = z.string().trim().min(1);

// ---------------------------------------------------------------- relink

// The catalog record the document is moved to: the record, and the volume or issue when the
// record has several (document-identity.md). The document keeps its own ID; the old link goes to
// the history.
export const relinkSchema = z.object({
  catalogId: idValueSchema,
  unit: z.string().trim().min(1).nullable(),
});
export type Relink = z.infer<typeof relinkSchema>;

export const relinkResultSchema = z.object({
  documentId: z.string(),
  catalogId: z.string(),
  unit: z.string().nullable(),
  // The record's title, as the catalog names it.
  title: z.string(),
});
export type RelinkResult = z.infer<typeof relinkResultSchema>;

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

// ---------------------------------------------------------------- fixes in place

// A page count someone counted: the manual source, above the catalog and the predictor
// (document-properties.md §4).
export const pageCountSchema = z.object({
  pages: z.number().int().positive(),
});
export type PageCount = z.infer<typeof pageCountSchema>;

// A field of the catalog record corrected in VERA ("260$c"), not in the catalog.
export const fieldCorrectionSchema = z.object({
  subject: idValueSchema,
  value: z.string().trim().min(1),
});
export type FieldCorrection = z.infer<typeof fieldCorrectionSchema>;

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

// ---------------------------------------------------------------- calls

export async function relinkIteration(iterationId: string, relink: Relink): Promise<RelinkResult> {
  return postJson(iterationActionRoute(iterationId, "relink"), relink, relinkResultSchema);
}

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

export async function correctField(
  iterationId: string,
  correction: FieldCorrection,
): Promise<RecheckResult> {
  return postJson(iterationActionRoute(iterationId, "field"), correction, recheckResultSchema);
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
