// What may be changed on a document's current iteration from the Documents pane (More ▾): move it
// to another catalog record, reclassify it, and set where its scan is available. Each is its own
// permission, scoped by the iteration's category (permissions.md §3), and the server checks it
// again; the pane only leaves out what the caller may not do.

import { z } from "zod";
import { postJson } from "@/api/http";
import { iterationActionRoute } from "@/api/routes";
import { prioritySchema, progressSchema } from "@/domain/entities";

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
