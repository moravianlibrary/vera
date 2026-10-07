// The Categories resource (concepts.md *Category*; intentions.md §2.4; STATUS "Categories"): the
// tree with what each category holds, who holds custody of it and whom that reaches, and
// Overall's mix over it, read-only: a category has no share of its own, and a mix is edited on its
// intention. The mix is the intention's, so it comes only with `intention.read`; the tree and
// custody with `category.read`.
// Changing the tree (permissions.md §3, Categories; intentions.md §1.1.1, §1.2): a category is
// created, renamed or moved, and deleted under `category.edit`, and its custody set written whole
// under `category.grant_custody`; at `custody` both stay inside the person's own subtree, and the
// top level is `any`'s. A leaf that holds documents is refined: a child is made and every document
// moves into it. Nothing rebalances a mix: a category new in a set has no share there, and one
// that leaves it leaves its share unallocated.

import { z } from "zod";
import { deleteResource, getJson, postJson, putJson } from "@/api/http";
import { mixTreeSchema } from "@/api/mixes";
import { apiRoutes, categoryActionRoute, categoryRoute } from "@/api/routes";
import type { Category } from "@/domain/entities";
import { categorySchema } from "@/domain/entities";

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

// ---------------------------------------------------------------- changes

const nameSchema = z.string().trim().min(1);

// A new category, or an existing one renamed or moved; null is the top level.
export const categoryDraftSchema = z.object({ name: nameSchema, parentId: z.string().nullable() });
export type CategoryDraft = z.infer<typeof categoryDraftSchema>;

// Who holds custody granted on the category, the whole set.
export const custodyDraftSchema = z.object({
  groupIds: z.array(z.string()),
  userIds: z.array(z.string()),
});
export type CustodyDraft = z.infer<typeof custodyDraftSchema>;

// The child a refined leaf gains, which takes every document it held.
export const refineDraftSchema = z.object({ name: nameSchema });
export type RefineDraft = z.infer<typeof refineDraftSchema>;

// A mix that gives the category a share: one intention's own, which its trackers follow.
export const mixShareSchema = z.object({
  owner: namedSchema,
  share: z.number().min(0).max(100),
  trackerCount: count,
});
export type MixShare = z.infer<typeof mixShareSchema>;

// What deleting or refining the category would touch, as the server counts it now.
export const categoryImpactSchema = z.object({
  documentCount: count,
  pages,
  // The mixes the caller may read; the others are only counted.
  shares: z.array(mixShareSchema),
  otherMixCount: count,
  grantCount: count,
  // Intentions scoped to it, which a delete would leave without a scope: those the caller may
  // read by name, and how many there are in all.
  scopedIntentions: z.array(namedSchema),
  scopedIntentionCount: count,
});
export type CategoryImpact = z.infer<typeof categoryImpactSchema>;

// ---------------------------------------------------------------- calls

export async function getCategoryIndex(): Promise<CategoryIndex> {
  return getJson(apiRoutes.categoryIndex, categoryIndexSchema);
}

export async function createCategory(draft: CategoryDraft): Promise<Category> {
  return postJson(apiRoutes.categories, draft, categorySchema);
}

export async function saveCategory(categoryId: string, draft: CategoryDraft): Promise<Category> {
  return putJson(categoryRoute(categoryId), draft, categorySchema);
}

export async function deleteCategory(categoryId: string): Promise<void> {
  return deleteResource(categoryRoute(categoryId));
}

export async function getCategoryImpact(categoryId: string): Promise<CategoryImpact> {
  return getJson(categoryActionRoute(categoryId, "impact"), categoryImpactSchema);
}

export async function saveCategoryCustody(
  categoryId: string,
  draft: CustodyDraft,
): Promise<CategoryNode> {
  return putJson(categoryActionRoute(categoryId, "custody"), draft, categoryNodeSchema);
}

// Answers the new child.
export async function refineCategory(categoryId: string, draft: RefineDraft): Promise<Category> {
  return postJson(categoryActionRoute(categoryId, "refine"), draft, categorySchema);
}
