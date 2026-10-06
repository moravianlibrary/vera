// What the Categories page reads from its URL and works out for its rows (STATUS "Categories";
// intentions.md §2.4): `?c=` the category open in the pane, none for *All categories*; `?i=` the
// intention whose mix is read, none for Overall. Each row carries the number the Show picker
// chose; the three that read a mix fall back to Documents for someone who cannot see one.
// TODO(rrandiak): labels move to i18n.

import type { CategoryMix } from "@/api/categories";
import type { CategoryTreeValue } from "@/domain/categories";
import { categoryPathOf, isInSubtree } from "@/domain/categories";
import type { Category } from "@/domain/entities";

export const categoryTreeValueLabels = {
  share: "Share of parent",
  whole: "Of the whole",
  mix: "Intended vs actual",
  documents: "Documents",
  pages: "Pages",
  ready: "Ready",
} as const satisfies Record<CategoryTreeValue, string>;

const mixValues: readonly CategoryTreeValue[] = ["share", "whole", "mix"];

export function isMixValue(value: CategoryTreeValue): boolean {
  return mixValues.includes(value);
}

// The pick in effect: the one remembered, Share of parent before any, and never one that reads a
// mix the person cannot see.
export function treeValueOf(
  remembered: CategoryTreeValue | undefined,
  hasMix: boolean,
): CategoryTreeValue {
  const value = remembered ?? "share";
  return hasMix || !isMixValue(value) ? value : "documents";
}

export interface CategoriesUrlState {
  categoryId: string | null;
  intentionId: string | null;
}

export function categoriesUrlStateOf(params: URLSearchParams): CategoriesUrlState {
  return { categoryId: params.get("c"), intentionId: params.get("i") };
}

// The page's own address; Intentions links here with an intention's `i`, and its scope's `c`.
export function categoriesHrefOf({ categoryId, intentionId }: CategoriesUrlState): string {
  const params = new URLSearchParams();
  if (intentionId !== null) {
    params.set("i", intentionId);
  }

  if (categoryId !== null) {
    params.set("c", categoryId);
  }

  const query = params.toString();
  return query === "" ? "/categories" : `/categories?${query}`;
}

// The categories a search leaves: those whose name holds it, and every one above them. Null
// when nothing is searched for, which leaves them all.
export function searchedCategoriesOf(
  categories: readonly Category[],
  search: string,
): ReadonlySet<string> | null {
  const term = search.trim().toLocaleLowerCase();
  if (term === "") {
    return null;
  }

  return new Set(
    categories
      .filter((category) => category.name.toLocaleLowerCase().includes(term))
      .flatMap((category) => categoryPathOf(categories, category.id).map(({ id }) => id)),
  );
}

// How deep it sits: 1 on the top level.
export function levelOf(categories: readonly Category[], categoryId: string): number {
  return categoryPathOf(categories, categoryId).length;
}

// Outside a scoped intention's subtree, the root included: its shares are not used there.
export function isOutOfScope(
  categories: readonly Category[],
  mix: Pick<CategoryMix, "intention">,
  categoryId: string | null,
): boolean {
  const scope = mix.intention.scopeCategoryId;
  if (scope === null) {
    return false;
  }

  return categoryId === null || !isInSubtree(categories, categoryId, scope);
}

// "the house mix", "Periodicals push — watch's mix".
export function mixNameOf(mix: Pick<CategoryMix, "owner">): string {
  return mix.owner.isOverall ? "the house mix" : `${mix.owner.name}'s mix`;
}

// One decimal, without a trailing zero: "13.5%", "45%".
export function percentTextOf(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}
