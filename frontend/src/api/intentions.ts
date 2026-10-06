// The Intentions resource (intentions.md §2, §3, §6; flows.md M1–M7): every intention the caller
// may see with what the server counts for it, planned, delivered and output in its window, its
// pace against a target, and its mix read against the output; whose mix it reads and who tracks
// it; and the repeats that make new ones. Figures of different intentions overlap and are never
// added, so nothing here sums across rows.

import { z } from "zod";
import { getJson } from "@/api/http";
import { apiRoutes } from "@/api/routes";
import { intentionSchema, intentionTemplateSchema } from "@/domain/entities";
import { intentionStates, mixFlags, targetVerdicts } from "@/domain/intentions";

const count = z.number().int().nonnegative();
const pages = z.number().int().nonnegative();
const percent = z.number();

export const intentionStateSchema = z.enum(intentionStates);
export const targetVerdictSchema = z.enum(targetVerdicts);
export const mixFlagSchema = z.enum(mixFlags);

const namedSchema = z.object({ id: z.string(), name: z.string() });

// Whose mix it reads (§2): its own, or the owner it tracks, never one further.
export const intentionMixSchema = z.object({
  owner: namedSchema.extend({ isOverall: z.boolean() }),
  isOwn: z.boolean(),
  // Those tracking this intention's own mix; 0 for a tracker.
  trackerCount: count,
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
  mix: intentionMixSchema,
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
  // The owner its occurrences track; null when each gets its own copy.
  tracks: namedSchema.nullable(),
});
export type IntentionTemplateRow = z.infer<typeof intentionTemplateRowSchema>;

// Few intentions exist at once: the whole index, not a page of it.
export const intentionIndexSchema = z.object({
  rows: z.array(intentionRowSchema),
  templates: z.array(intentionTemplateRowSchema),
});
export type IntentionIndex = z.infer<typeof intentionIndexSchema>;

// ---------------------------------------------------------------- calls

export async function listIntentionIndex(): Promise<IntentionIndex> {
  return getJson(apiRoutes.intentionIndex, intentionIndexSchema);
}
