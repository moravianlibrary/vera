// What may be done to an iteration, by its state rather than by who asks: the server refuses the
// rest, and the Documents pane leaves it out. Who may is a grant's scope against the iteration's
// category path (permissions.md §2), which `scopeOfIteration` gives `can()`.

import { categoryLineageOf } from "@/domain/categories";
import type { Category, Iteration } from "@/domain/entities";
import type { ScopedRecord } from "@/domain/permissions";
import { isProgressAtLeast } from "@/domain/status";

// Category and priority change until the scan exists (flows.md V13).
export function isReclassifiable(iteration: Iteration): boolean {
  return !isProgressAtLeast(iteration.progress, "Digitized");
}

// Only a scan can be somewhere to read; setting the link is what makes it Published (P1).
export function isPublishable(iteration: Iteration): boolean {
  return isProgressAtLeast(iteration.progress, "Digitized");
}

export function scopeOfIteration(
  categories: readonly Category[],
  categoryId: string,
): Extract<ScopedRecord, { kind: "iteration" }> {
  return { kind: "iteration", categoryPathIds: categoryLineageOf(categories, categoryId) };
}
