// The Categories resource (concepts.md *Category*; intentions.md §2.4; STATUS "Categories"): the
// tree with what each category holds, who holds custody of it and whom that reaches, and
// the selected mix over it, read-only: a category has no share of its own, and a mix is edited on its
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
import type { ValueRange } from "@/lib/value-range";
import { formatRange, parseCount, parseRange } from "@/lib/value-range";

export const categoryKinds = ["Branch", "Leaf"] as const;
export const categoryCustodies = ["Unheld", "Direct", "Inherited"] as const;
export const categoryAttentions = ["Unallocated", "NoShare"] as const;
export type CategoryKind = (typeof categoryKinds)[number];
export type CategoryCustody = (typeof categoryCustodies)[number];
export type CategoryAttention = (typeof categoryAttentions)[number];

export interface CategoryQuery {
  readonly search?: string;
  // Which intention's own mix the tree and attention filter read; absent means Overall.
  readonly mixId?: string;
  readonly kinds?: readonly CategoryKind[];
  readonly custodies?: readonly CategoryCustody[];
  readonly attentions?: readonly CategoryAttention[];
  readonly documents?: ValueRange<number>;
  readonly readyPages?: ValueRange<number>;
}

const categoryQueryParams = {
  search: "q",
  mixId: "mix",
  kinds: "kind",
  custodies: "custody",
  attentions: "attention",
  documents: "documents",
  readyPages: "ready",
} as const satisfies Record<keyof CategoryQuery, string>;

export function toCategorySearchParams(query: CategoryQuery): URLSearchParams {
  const params = new URLSearchParams();
  const search = query.search?.trim();
  if (search) params.set(categoryQueryParams.search, search);
  if (query.mixId) params.set(categoryQueryParams.mixId, query.mixId);
  if (query.kinds?.length) params.set(categoryQueryParams.kinds, query.kinds.join(","));
  if (query.custodies?.length) params.set(categoryQueryParams.custodies, query.custodies.join(","));
  if (query.attentions?.length)
    params.set(categoryQueryParams.attentions, query.attentions.join(","));
  const documents = formatRange(query.documents);
  if (documents !== null) params.set(categoryQueryParams.documents, documents);
  const readyPages = formatRange(query.readyPages);
  if (readyPages !== null) params.set(categoryQueryParams.readyPages, readyPages);
  return params;
}

export function parseCategorySearchParams(params: URLSearchParams): CategoryQuery {
  const valuesOf = <Value extends string>(
    key: string,
    allowed: readonly Value[],
  ): Value[] | undefined => {
    const values = (params.get(key) ?? "")
      .split(",")
      .filter((value): value is Value => allowed.includes(value as Value));
    return values.length === 0 ? undefined : [...new Set(values)];
  };
  return {
    search: params.get(categoryQueryParams.search)?.trim() || undefined,
    mixId: params.get(categoryQueryParams.mixId)?.trim() || undefined,
    kinds: valuesOf(categoryQueryParams.kinds, categoryKinds),
    custodies: valuesOf(categoryQueryParams.custodies, categoryCustodies),
    attentions: valuesOf(categoryQueryParams.attentions, categoryAttentions),
    documents: parseRange(params.get(categoryQueryParams.documents), parseCount),
    readyPages: parseRange(params.get(categoryQueryParams.readyPages), parseCount),
  };
}

export function isSameCategoryQuery(first: CategoryQuery, second: CategoryQuery): boolean {
  const canonical = (query: CategoryQuery) => {
    const params = toCategorySearchParams({
      ...query,
      kinds: query.kinds?.toSorted(),
      custodies: query.custodies?.toSorted(),
      attentions: query.attentions?.toSorted(),
    });
    params.sort();
    return params.toString();
  };
  return canonical(first) === canonical(second);
}

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
  // The selected mix (Overall by default); null without `intention.read`.
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
  mix: namedSchema,
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

export async function getCategoryIndex(mixId?: string): Promise<CategoryIndex> {
  const params = new URLSearchParams();
  if (mixId !== undefined) {
    params.set("mix", mixId);
  }
  return getJson(apiRoutes.categoryIndex, categoryIndexSchema, params);
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
