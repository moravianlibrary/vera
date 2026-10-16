// What the Categories page reads from its URL and works out for its pane (STATUS "Categories";
// concepts.md *Category*): a saved filter, `?c=` the category open in the pane, none for *All
// categories*, and `&refine=1` the Refine wizard in its place. `?mix=` selects a mix for
// read-only context; it is edited on Mixes (ACT-mix-save).

import type { CategoryQuery } from "@vera/contract/categories";
import {
  categoryAttentions,
  categoryCustodies,
  categoryKinds,
  isSameCategoryQuery,
  parseCategorySearchParams,
  toCategorySearchParams,
} from "@vera/contract/categories";
import { categoryPathOf } from "@vera/domain/categories";
import type { Category } from "@vera/domain/entities";
import type { ViewDefinition } from "@/lib/view-definition";
import { vocabulary } from "@/lib/view-definition";

export const categoriesView: ViewDefinition<CategoryQuery> = {
  view: "categories",
  toSearchParams: toCategorySearchParams,
  parseSearchParams: parseCategorySearchParams,
  isSameQuery: isSameCategoryQuery,
  fields: [
    {
      key: "kinds",
      label: "Kind",
      field: vocabulary(categoryKinds, { Branch: "Branch", Leaf: "Leaf" }),
      isQuick: true,
    },
    {
      key: "custodies",
      label: "Custody",
      field: vocabulary(categoryCustodies, {
        Unheld: "Without custody",
        Direct: "Direct grant",
        Inherited: "Inherited",
      }),
    },
    {
      key: "attentions",
      label: "Needs attention",
      field: vocabulary(categoryAttentions, {
        Unallocated: "Unallocated share",
        NoShare: "No share",
      }),
    },
    { key: "documents", label: "Documents", field: { kind: "numberRange", unit: "documents" } },
    { key: "readyPages", label: "Ready pages", field: { kind: "numberRange", unit: "pages" } },
  ],
  groupings: [],
  groupingParam: "group",
};

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
