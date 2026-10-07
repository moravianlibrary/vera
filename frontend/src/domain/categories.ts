// The category tree: a category stands for itself and everything under it. Documents sit on
// leaves only; custody attaches at any node and reaches everything under it (intentions.md §1.2,
// relationships.md §5.2).

import type { Category } from "@/domain/entities";

// What each row of a category tree carries, picked per viewer (STATUS "Categories"): the first
// three read a mix, the rest count what the subtree holds.
export const categoryTreeValues = ["share", "whole", "mix", "documents", "pages", "ready"] as const;
export type CategoryTreeValue = (typeof categoryTreeValues)[number];

// From the root down to the category; empty for an unknown ID.
export function categoryPathOf(categories: readonly Category[], categoryId: string): Category[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const path: Category[] = [];
  let current = byId.get(categoryId);
  while (current !== undefined && !path.includes(current)) {
    path.unshift(current);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }

  return path;
}

// The category's ID and those of every category above it.
export function categoryLineageOf(categories: readonly Category[], categoryId: string): string[] {
  return categoryPathOf(categories, categoryId).map((category) => category.id);
}

// The categories with no subcategories: the only ones an item is classified into.
export function leafCategoriesOf(categories: readonly Category[]): Category[] {
  return categories.filter(
    (category) => !categories.some((child) => child.parentId === category.id),
  );
}

export function isInSubtree(
  categories: readonly Category[],
  categoryId: string,
  topId: string,
): boolean {
  return categoryLineageOf(categories, categoryId).includes(topId);
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
      .flatMap((category) => categoryLineageOf(categories, category.id)),
  );
}

// Outside a scope's subtree, the root included; nothing is outside no scope.
export function isOutsideScope(
  categories: readonly Category[],
  scopeCategoryId: string | null,
  categoryId: string | null,
): boolean {
  if (scopeCategoryId === null) {
    return false;
  }

  return categoryId === null || !isInSubtree(categories, categoryId, scopeCategoryId);
}

// ---------------------------------------------------------------- custody

// Who holds custody where: groups, for everyone in them while they are, and people directly.
export interface CustodyHolders {
  readonly groups: readonly {
    readonly id: string;
    readonly name: string;
    readonly categoryIds: readonly string[];
    readonly memberIds: readonly string[];
  }[];
  // People by category.
  readonly members: Readonly<Record<string, readonly string[]>>;
}

export interface CustodyReach {
  readonly userId: string;
  // Through this group, or directly when null.
  readonly groupId: string | null;
  // Where it was granted: the category itself or one above it.
  readonly categoryId: string;
}

// Everyone custody reaches on the category, each once, by the grant nearest the root: provenance,
// not just names (STATUS "Categories").
export function custodyReachOf(
  categories: readonly Category[],
  holders: CustodyHolders,
  categoryId: string,
): CustodyReach[] {
  const reach = new Map<string, CustodyReach>();
  for (const id of categoryLineageOf(categories, categoryId)) {
    for (const userId of holders.members[id] ?? []) {
      if (!reach.has(userId)) {
        reach.set(userId, { userId, groupId: null, categoryId: id });
      }
    }

    for (const group of holders.groups.filter((candidate) => candidate.categoryIds.includes(id))) {
      for (const userId of group.memberIds) {
        if (!reach.has(userId)) {
          reach.set(userId, { userId, groupId: group.id, categoryId: id });
        }
      }
    }
  }

  return [...reach.values()];
}

function grantCountOn(holders: CustodyHolders, categoryId: string): number {
  return (
    (holders.members[categoryId]?.length ?? 0) +
    holders.groups.filter((group) => group.categoryIds.includes(categoryId)).length
  );
}

// The highest categories nobody holds custody of, above or below: nobody's validation queue. A
// branch held somewhere below is reported at its gaps, not whole.
export function unheldCategoriesOf(
  categories: readonly Category[],
  holders: CustodyHolders,
): Category[] {
  const isHeld = (id: string) => grantCountOn(holders, id) > 0;
  const isCovered = (id: string) => categoryLineageOf(categories, id).some(isHeld);
  const isHeldBelow = (id: string) =>
    categories.some((category) => isInSubtree(categories, category.id, id) && isHeld(category.id));
  return categories.filter(
    (category) =>
      !isCovered(category.id) &&
      !isHeldBelow(category.id) &&
      (category.parentId === null || isHeldBelow(category.parentId)),
  );
}
