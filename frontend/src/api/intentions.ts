// The Intentions resource (intentions.md §2, §3, §6; flows.md M1–M7): every intention the caller
// may see with what the server counts for it, planned, delivered and output in its window, its
// pace against a target, and its mix read against the output; which mix it chose (PLAN-mix);
// and the repeats that make new ones. Figures of different intentions overlap and are never
// added, so nothing here sums across rows.

import { z } from "zod";
import { deleteResource, getJson, postJson, putJson } from "@/api/http";
import { apiRoutes } from "@/api/routes";
import {
  intentionFundingSchema,
  intentionSchema,
  intentionTemplateSchema,
  repeatEverySchema,
} from "@/domain/entities";
import { intentionStates, mixFlags, targetVerdicts } from "@/domain/intentions";
import { propertyConditionSchema } from "@/domain/properties";

const count = z.number().int().nonnegative();
const pages = z.number().int().nonnegative();
const percent = z.number();

export const intentionStateSchema = z.enum(intentionStates);
export const targetVerdictSchema = z.enum(targetVerdicts);
export const mixFlagSchema = z.enum(mixFlags);

const namedSchema = z.object({ id: z.string(), name: z.string() });

// The mix it chose, which any number of intentions may share (PLAN-mix), and the revision read.
export const intentionMixSchema = z.object({
  id: z.string(),
  name: z.string(),
  revision: z.number().int().positive(),
});
export type IntentionMix = z.infer<typeof intentionMixSchema>;

// One category the mix is read across: the scope's children, or the top of the tree.
export const mixRowSchema = z.object({
  categoryId: z.string(),
  name: z.string(),
  // Within the scope; null with no share.
  intended: percent.nullable(),
  // Of the planned pages and of the output, each over its own total; null with none.
  planned: percent.nullable(),
  output: percent.nullable(),
  outputPages: pages,
  // Output minus intended, in points.
  drift: percent.nullable(),
  flag: mixFlagSchema.nullable(),
});
export type MixRowView = z.infer<typeof mixRowSchema>;

// One leaf of a target's scope.
export const fillRowSchema = z.object({
  categoryId: z.string(),
  // From under the scope down: ["Regional"] inside Periodicals, the whole path without one.
  path: z.array(z.string()),
  share: percent.nullable(),
  targetPages: pages.nullable(),
  plannedPages: pages,
  deliveredPages: pages,
  // Planned under 95% of its share of the target.
  isShort: z.boolean(),
});
export type FillRowView = z.infer<typeof fillRowSchema>;

// A list starting in the window that carries something it counts.
export const intentionListSchema = z.object({
  id: z.string(),
  name: z.string(),
  itemCount: count,
  pages,
});
export type IntentionList = z.infer<typeof intentionListSchema>;

export const intentionRowSchema = z.object({
  intention: intentionSchema,
  state: intentionStateSchema,
  // 0 to 1; null without an end.
  timeElapsed: z.number().min(0).max(1).nullable(),
  // Today counts as left; null without an end.
  daysToStart: count,
  daysLeft: count.nullable(),
  // Where planned and delivered would be at an even pace; only while a dated target runs.
  evenPace: z.number().min(0).max(1).nullable(),
  verdict: targetVerdictSchema.nullable(),
  // To reach the target by the end, from today.
  pagesPerWeekNeeded: pages.nullable(),
  // Short of an even pace on lists, for a behind-pace target's catch-up Generate.
  catchUpPages: pages.nullable(),
  plannedPages: pages,
  deliveredPages: pages,
  outputPages: pages,
  noDateCount: count,
  noPagesCount: count,
  project: namedSchema.nullable(),
  // The scope node's path from the root.
  scope: z.object({ id: z.string(), path: z.array(z.string()) }).nullable(),
  mix: intentionMixSchema.nullable(),
  mixRows: z.array(mixRowSchema),
  unallocated: percent,
  outOfBandCount: count,
  // Targets only.
  fill: z.array(fillRowSchema),
  lists: z.array(intentionListSchema),
});
export type IntentionRow = z.infer<typeof intentionRowSchema>;

export const intentionTemplateRowSchema = z.object({
  template: intentionTemplateSchema,
  // The mix its occurrences use; null for none.
  mix: namedSchema.nullable(),
});
export type IntentionTemplateRow = z.infer<typeof intentionTemplateRowSchema>;

// Few intentions exist at once: the whole index, not a page of it.
export const intentionIndexSchema = z.object({
  rows: z.array(intentionRowSchema),
  templates: z.array(intentionTemplateRowSchema),
  // The server's calendar day for relative date filters.
  asOf: z.iso.date().optional(),
});
export type IntentionIndex = z.infer<typeof intentionIndexSchema>;

// ---------------------------------------------------------------- acts

const calendarDate = z.iso.date();
const name = z.string().trim().min(1, "An intention needs a name");

// The one mix field: none, the Primary mix, or a mix and its latest or a pinned revision
// (PLAN-mix, PLAN-no-mix).
export const mixChoiceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("primary") }),
  z.object({
    kind: z.literal("use"),
    mixId: z.string(),
    revision: z.number().int().positive().nullable(),
  }),
]);
export type MixChoice = z.infer<typeof mixChoiceSchema>;

// What decides which items it counts; the counting start is fixed once it exists (§3).
export const intentionScopeSchema = z.object({
  funding: intentionFundingSchema,
  scopeCategoryId: z.string().nullable(),
  // PLAN-scope: conditions on the items' properties, all of which hold; absent is none.
  scopeConditions: z.array(propertyConditionSchema).optional(),
  countsFrom: calendarDate,
  endsOn: calendarDate.nullable(),
});
export type IntentionScope = z.infer<typeof intentionScopeSchema>;

export const intentionDraftSchema = intentionScopeSchema
  .extend({
    name,
    description: z.string().trim(),
    targetPages: z.number().int().positive().nullable(),
    mix: mixChoiceSchema,
  })
  .refine((draft) => draft.endsOn === null || draft.endsOn >= draft.countsFrom, {
    message: "It cannot end before it starts counting",
    path: ["endsOn"],
  });
export type IntentionDraft = z.infer<typeof intentionDraftSchema>;

// What the editor asks before saving: the draft's scope and mix choice, on the intention it
// edits (none for a new one).
export const intentionPreviewRequestSchema = intentionScopeSchema.extend({
  intentionId: z.string().nullable(),
  mix: mixChoiceSchema,
});
export type IntentionPreviewRequest = z.infer<typeof intentionPreviewRequestSchema>;

// What the draft would count over its whole window, and its mix within the draft's scope beside
// the one it reads now (§2.2: the new percentages beside the old, first).
export const intentionPreviewSchema = z.object({
  plannedPages: pages,
  deliveredPages: pages,
  outputPages: pages,
  mix: z.array(
    z.object({
      categoryId: z.string(),
      name: z.string(),
      // Null with no share; before is null throughout for a new intention.
      before: percent.nullable(),
      after: percent.nullable(),
    }),
  ),
});
export type IntentionPreview = z.infer<typeof intentionPreviewSchema>;

// Deleting moves nothing, since nothing is attached; the lists generated with it keep that in
// their history.
export const intentionDeletionSchema = z.object({
  generatedLists: z.array(namedSchema),
});
export type IntentionDeletion = z.infer<typeof intentionDeletionSchema>;

// What a correcting list of so many pages would take, per category of the scope, shown and
// accepted before anything is generated (STATUS "Intentions").
export const correctionPreviewSchema = z.object({
  outputPages: pages,
  pages,
  // The gaps add up to more than the pages, so each was cut in proportion.
  isCut: z.boolean(),
  unallocated: percent,
  rows: z.array(
    z.object({
      categoryId: z.string(),
      name: z.string(),
      intended: percent.nullable(),
      // Its share of the output now.
      output: percent.nullable(),
      newPages: pages,
      // Its share once the new pages are digitized.
      after: percent,
      readyPages: pages,
      // What the pool cannot cover: the draft stays short there.
      shortPages: pages,
    }),
  ),
});
export type CorrectionPreview = z.infer<typeof correctionPreviewSchema>;

export const intentionTemplateDraftSchema = z.object({
  namePattern: z
    .string()
    .trim()
    .includes("{period}", { message: "Put {period} in the name, so each one is told apart" }),
  every: repeatEverySchema,
  funding: intentionFundingSchema,
  scopeCategoryId: z.string().nullable(),
  scopeConditions: z.array(propertyConditionSchema).optional(),
  mix: mixChoiceSchema,
  targetPages: z.number().int().positive().nullable(),
  isArchivingPrevious: z.boolean(),
});
export type IntentionTemplateDraft = z.infer<typeof intentionTemplateDraftSchema>;

// ---------------------------------------------------------------- calls

const intentionRoute = (intentionId: string) =>
  `${apiRoutes.intentions}/${encodeURIComponent(intentionId)}`;

export async function listIntentionIndex(): Promise<IntentionIndex> {
  return getJson(apiRoutes.intentionIndex, intentionIndexSchema);
}

export async function previewIntention(
  request: IntentionPreviewRequest,
): Promise<IntentionPreview> {
  return postJson(apiRoutes.intentionPreview, request, intentionPreviewSchema);
}

export async function createIntention(draft: IntentionDraft): Promise<IntentionRow> {
  return postJson(apiRoutes.intentions, draft, intentionRowSchema);
}

export async function saveIntention(
  intentionId: string,
  draft: IntentionDraft,
): Promise<IntentionRow> {
  return putJson(intentionRoute(intentionId), draft, intentionRowSchema);
}

export async function archiveIntention(intentionId: string): Promise<IntentionRow> {
  return postJson(`${intentionRoute(intentionId)}/archive`, {}, intentionRowSchema);
}

export async function unarchiveIntention(intentionId: string): Promise<IntentionRow> {
  return postJson(`${intentionRoute(intentionId)}/unarchive`, {}, intentionRowSchema);
}

export async function previewIntentionDeletion(intentionId: string): Promise<IntentionDeletion> {
  return getJson(`${intentionRoute(intentionId)}/deletion`, intentionDeletionSchema);
}

export async function previewCorrection(
  intentionId: string,
  pages: number,
): Promise<CorrectionPreview> {
  return getJson(
    `${intentionRoute(intentionId)}/correction?pages=${pages}`,
    correctionPreviewSchema,
  );
}

export async function deleteIntention(intentionId: string): Promise<void> {
  return deleteResource(intentionRoute(intentionId));
}

export async function createIntentionTemplate(
  draft: IntentionTemplateDraft,
): Promise<IntentionTemplateRow> {
  return postJson(apiRoutes.intentionTemplates, draft, intentionTemplateRowSchema);
}

export async function saveIntentionTemplate(
  templateId: string,
  draft: IntentionTemplateDraft,
): Promise<IntentionTemplateRow> {
  return putJson(
    `${apiRoutes.intentionTemplates}/${encodeURIComponent(templateId)}`,
    draft,
    intentionTemplateRowSchema,
  );
}
