// The Categories resource (concepts.md *Category*; intentions.md §2.4; STATUS "Categories"): the
// tree with what each category holds, who holds custody of it and whom that reaches, and
// Overall's mix over it, read-only: a category has no share of its own, and a mix is edited on its
// intention. The mix is the intention's, so it comes only with `intention.read`; the tree and
// custody with `category.read`.

import { z } from "zod";
import { getJson } from "@/api/http";
import { mixTreeSchema } from "@/api/mixes";
import { apiRoutes } from "@/api/routes";

const count = z.number().int().nonnegative();
const pages = z.number().int().nonnegative();

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

export const categoryIndexSchema = z.object({
  totals: categoryTotalsSchema,
  nodes: z.array(categoryNodeSchema),
  // Overall's; null without `intention.read`.
  mix: mixTreeSchema.nullable(),
  // The highest categories nobody holds custody of.
  unheldIds: z.array(z.string()),
});
export type CategoryIndex = z.infer<typeof categoryIndexSchema>;

export async function getCategoryIndex(): Promise<CategoryIndex> {
  return getJson(apiRoutes.categoryIndex, categoryIndexSchema);
}
