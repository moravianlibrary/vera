// The category tree: a category stands for itself and everything under it.

import type { Category } from "@/domain/entities";

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
