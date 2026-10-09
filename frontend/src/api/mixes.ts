// An intention's mix over the category tree (intentions.md §1, §2.3–§2.5; concepts.md *Mix*): its
// shares read against its own output, the intentions tracking it, and what is done to it. A
// tracker reads its owner's mix; a scoped intention only its subtree. Shares are written one
// sibling set at a time, whole, against the revision read, and the trackers kept on the old mix
// are detached in the same write. Categories reads Overall's the same way, without editing it.

import { z } from "zod";
import { findJson, postJson, putJson } from "@/api/http";
import { intentionRoute } from "@/api/routes";
import { categorySchema, intentionSchema } from "@/domain/entities";
import { intentionStates } from "@/domain/intentions";

const pages = z.number().int().nonnegative();
const percent = z.number();

// A sibling set: the part of the parent's share no child has, and the children with none.
const siblingSetSchema = z.object({
  unallocated: percent,
  noShareIds: z.array(z.string()),
});

// One category, with the set of its children.
export const mixNodeSchema = siblingSetSchema.extend({
  categoryId: z.string(),
  // Stored: its share of its parent; null with none, and outside the scope.
  share: percent.nullable(),
  // Of the whole, or of the intention's scope; null outside it or with no share on the way.
  ofWhole: percent.nullable(),
  // Its part of the intention's output; null with no output, or outside the scope.
  actual: percent.nullable(),
});
export type MixNode = z.infer<typeof mixNodeSchema>;

// The mix one intention reads, which is its owner's for a tracker; the top-level set on the root.
export const mixTreeSchema = siblingSetSchema.extend({
  mixId: z.string().optional(),
  mixName: z.string().optional(),
  intention: intentionSchema,
  owner: intentionSchema,
  outputPages: pages,
  nodes: z.array(mixNodeSchema),
});
export type MixTree = z.infer<typeof mixTreeSchema>;

// An intention tracking the owner, archived and ended ones too: an edit changes how their history
// reads against the mix (§2.3).
export const mixTrackerSchema = z.object({
  intention: intentionSchema,
  state: z.enum(intentionStates),
});
export type MixTracker = z.infer<typeof mixTrackerSchema>;

export const intentionMixSchema = z.object({
  mix: mixTreeSchema,
  archivedCategories: z.array(categorySchema).nullable().optional(),
  // The owner's mix as read; a write against an older one is refused.
  revision: z.number().int().positive(),
  trackers: z.array(mixTrackerSchema),
});
export type IntentionMixDetail = z.infer<typeof intentionMixSchema>;

// One sibling set, whole: every child of the parent, a percent, or null for no share.
export const mixSetDraftSchema = z.object({
  // Null is the top level.
  parentId: z.string().nullable(),
  shares: z.record(z.string(), z.number().min(0).max(100).nullable()),
  revision: z.number().int().positive(),
  // Trackers that keep the mix as it is now, each detached onto its own copy first.
  keepOldMixFor: z.array(z.string()),
});
export type MixSetDraft = z.infer<typeof mixSetDraftSchema>;

const mixRouteOf = (intentionId: string) => `${intentionRoute(intentionId)}/mix`;

// Null when it does not exist or the caller may not see it.
export async function findIntentionMix(intentionId: string): Promise<IntentionMixDetail | null> {
  return findJson(mixRouteOf(intentionId), intentionMixSchema);
}

// On the intention that owns the mix.
export async function saveMixSet(
  intentionId: string,
  draft: MixSetDraft,
): Promise<IntentionMixDetail> {
  return putJson(mixRouteOf(intentionId), draft, intentionMixSchema);
}

// A tracker gets its own copy of the mix as it is now (§2.2); nothing changes for anyone else.
export async function detachIntention(intentionId: string): Promise<IntentionMixDetail> {
  return postJson(`${intentionRoute(intentionId)}/detach`, {}, intentionMixSchema);
}
