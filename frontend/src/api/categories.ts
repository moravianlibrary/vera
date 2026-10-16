// Calls the categories endpoints; what they take and answer is in @vera/contract/categories.

import type {
  CategoryDraft,
  CategoryImpact,
  CategoryIndex,
  CategoryNode,
  CustodyDraft,
  RefineDraft,
} from "@vera/contract/categories";
import {
  categoryImpactSchema,
  categoryIndexSchema,
  categoryNodeSchema,
} from "@vera/contract/categories";
import { apiRoutes, categoryActionRoute, categoryRoute } from "@vera/contract/routes";
import type { Category } from "@vera/domain/entities";
import { categorySchema } from "@vera/domain/entities";
import { deleteResource, getJson, postJson, putJson } from "@/api/http";

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
