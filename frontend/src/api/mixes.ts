// The mix an intention chose, over the category tree, read against its own output
// (PLAN-mix-reading); a scoped intention reads only its subtree (PLAN-mix-within-scope). Read
// only: the mix is edited on Mixes (ACT-mix-save). Categories reads the selected mix the same way.

import { z } from "zod";
import { findJson } from "@/api/http";
import { intentionRoute } from "@/api/routes";
import { categorySchema, intentionSchema } from "@/domain/entities";

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

// The mix one intention reads; the top-level set on the root.
export const mixTreeSchema = siblingSetSchema.extend({
  mixId: z.string(),
  mixName: z.string(),
  intention: intentionSchema,
  outputPages: pages,
  nodes: z.array(mixNodeSchema),
});
export type MixTree = z.infer<typeof mixTreeSchema>;

export const intentionMixSchema = z.object({
  mix: mixTreeSchema,
  archivedCategories: z.array(categorySchema).nullable().optional(),
  // The mix's revision as read.
  revision: z.number().int().positive(),
});
export type IntentionMixDetail = z.infer<typeof intentionMixSchema>;

const mixRouteOf = (intentionId: string) => `${intentionRoute(intentionId)}/mix`;

// Null when it does not exist or the caller may not see it.
export async function findIntentionMix(intentionId: string): Promise<IntentionMixDetail | null> {
  return findJson(mixRouteOf(intentionId), intentionMixSchema);
}
