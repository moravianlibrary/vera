// What the Categories page reads from its URL and works out for its pane (STATUS "Categories";
// concepts.md *Category*): `?c=` the category open in the pane, none for *All categories*, and
// `&refine=1` the Refine wizard in its place. No
// intention is picked here any more: the page reads Overall's mix only, and a mix is read and
// edited on its intention (intentions.md §2.4).

import { categoryPathOf } from "@/domain/categories";
import type { Category } from "@/domain/entities";

export interface CategoriesUrlState {
  categoryId: string | null;
  isRefining: boolean;
}

export const refineParam = "refine";

export function categoriesUrlStateOf(params: URLSearchParams): CategoriesUrlState {
  return { categoryId: params.get("c"), isRefining: params.get(refineParam) === "1" };
}

// How deep it sits: 1 on the top level.
export function levelOf(categories: readonly Category[], categoryId: string): number {
  return categoryPathOf(categories, categoryId).length;
}
