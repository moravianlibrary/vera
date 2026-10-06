// A mix: percentages over the category tree, each sibling set summing to at most 100 (intentions.md
// §1). A category's effective share is its own share times its parent's, all the way up; a set
// summing to less leaves the rest unallocated, flagged rather than corrected.

import { categoryPathOf } from "@/domain/categories";
import type { Category } from "@/domain/entities";

// Percent by category ID; a category without an entry has no share.
export type Shares = Readonly<Record<string, number>>;

// The percentage of everything that falls on the category; null when it, or a category above it,
// has no share.
export function effectiveShareOf(
  categories: readonly Category[],
  shares: Shares,
  categoryId: string,
): number | null {
  const path = categoryPathOf(categories, categoryId);
  if (path.length === 0) {
    return null;
  }

  let share = 1;
  for (const category of path) {
    const own = shares[category.id];
    if (own === undefined) {
      return null;
    }

    share *= own / 100;
  }

  return share * 100;
}

export interface SiblingSet {
  // Percent of the parent's share no child has; 0 for a leaf.
  readonly unallocated: number;
  // The children without a share: unallocated, flagged rather than corrected (§1.1.1).
  readonly noShareIds: string[];
}

// The children of a category, or the top level for null, as one set: what they leave unallocated.
export function siblingSetOf(
  categories: readonly Category[],
  shares: Shares,
  parentId: string | null,
): SiblingSet {
  const children = categories.filter((category) => category.parentId === parentId);
  if (children.length === 0) {
    return { unallocated: 0, noShareIds: [] };
  }

  const allocated = children.reduce((sum, child) => sum + (shares[child.id] ?? 0), 0);
  return {
    unallocated: Math.max(0, 100 - allocated),
    noShareIds: children.filter((child) => shares[child.id] === undefined).map((child) => child.id),
  };
}
