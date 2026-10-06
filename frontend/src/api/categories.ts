// The Categories resource (intentions.md §1, §2.4; STATUS "Categories"): the tree with what each
// category holds, who holds custody of it and whom that reaches, and one intention's mix over it,
// read against that intention's output. A tracker reads its owner's mix. The mix is the
// intention's, so it comes only with `intention.read`; the tree and custody with
// `category.read`.

import { z } from "zod";
import { getJson } from "@/api/http";
import { apiRoutes } from "@/api/routes";
import { intentionSchema } from "@/domain/entities";

const count = z.number().int().nonnegative();
const pages = z.number().int().nonnegative();
const percent = z.number();

const namedSchema = z.object({ id: z.string(), name: z.string() });

// What a category and everything under it holds; the root totals the whole tree.
export const categoryTotalsSchema = z.object({
  documentCount: count,
  pages,
  // Digitized or further.
  deliveredPages: pages,
  // Approved, on no list, every gate passed.
  readyPages: pages,
});
export type CategoryTotals = z.infer<typeof categoryTotalsSchema>;

// Granted on the category itself.
export const custodyGrantSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("group"), id: z.string(), name: z.string() }),
  z.object({ kind: z.literal("person"), id: z.string(), name: z.string() }),
]);
export type CustodyGrant = z.infer<typeof custodyGrantSchema>;

// Someone custody reaches here, and from where: a group or directly, here or above.
export const custodyReachSchema = z.object({
  userId: z.string(),
  name: z.string(),
  group: namedSchema.nullable(),
  grantedOn: namedSchema,
});
export type CustodyReachView = z.infer<typeof custodyReachSchema>;

export const categoryNodeSchema = categoryTotalsSchema.extend({
  categoryId: z.string(),
  grants: z.array(custodyGrantSchema),
  reach: z.array(custodyReachSchema),
});
export type CategoryNode = z.infer<typeof categoryNodeSchema>;

// A sibling set: the part of the parent's share no child has, and the children with none.
const siblingSetSchema = z.object({
  unallocated: percent,
  noShareIds: z.array(z.string()),
});

export const mixNodeSchema = siblingSetSchema.extend({
  categoryId: z.string(),
  // Stored: its share of its parent; null with none.
  share: percent.nullable(),
  // Of the whole, or of the intention's scope; null outside it or with no share on the way.
  ofWhole: percent.nullable(),
  // Its part of the intention's output; null with no output, or outside the scope.
  actual: percent.nullable(),
});
export type MixNode = z.infer<typeof mixNodeSchema>;

// The mix of the intention picked (`?i=`), which is its owner's for a tracker (§2.4).
export const categoryMixSchema = siblingSetSchema.extend({
  intention: intentionSchema,
  owner: intentionSchema,
  // Everyone tracking the owner; they change with it.
  trackers: z.array(namedSchema),
  outputPages: pages,
  nodes: z.array(mixNodeSchema),
});
export type CategoryMix = z.infer<typeof categoryMixSchema>;

// One entry of the picker: the owners, each with what tracks it, then the trackers.
export const mixPickSchema = z.object({
  id: z.string(),
  name: z.string(),
  isOverall: z.boolean(),
  // The owner it tracks; null when it owns its mix.
  tracks: namedSchema.nullable(),
  trackerCount: count,
});
export type MixPick = z.infer<typeof mixPickSchema>;

// A set under 100 in some owner's mix; the root's set when categoryId is null.
export const unallocatedSetSchema = siblingSetSchema.extend({
  categoryId: z.string().nullable(),
  owner: namedSchema,
});
export type UnallocatedSet = z.infer<typeof unallocatedSetSchema>;

export const categoryIndexSchema = z.object({
  totals: categoryTotalsSchema,
  nodes: z.array(categoryNodeSchema),
  // Null without `intention.read`.
  mix: categoryMixSchema.nullable(),
  // Not archived.
  picks: z.array(mixPickSchema),
  attention: z.object({
    sets: z.array(unallocatedSetSchema),
    // The highest categories nobody holds custody of.
    unheldIds: z.array(z.string()),
  }),
});
export type CategoryIndex = z.infer<typeof categoryIndexSchema>;

// No intention, or one the caller cannot see, reads Overall's mix.
export async function getCategoryIndex(intentionId: string | null): Promise<CategoryIndex> {
  const query = new URLSearchParams(intentionId === null ? {} : { i: intentionId });
  return getJson(apiRoutes.categoryIndex, categoryIndexSchema, query);
}
