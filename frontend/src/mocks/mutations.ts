// What every action of the mock server shares: its answer is a value or a refusal the handler
// turns into an HTTP status, the status log it writes (status-log.md), the records it replaces
// and the checks more than one action makes. Kept apart from the resources so each of them
// reads only its own rules.

import { categoryPathOf, leafCategoriesOf } from "@vera/domain/categories";
import type { Iteration, StatusLogEntry } from "@vera/domain/entities";
import { database } from "@/mocks/database";

// Answered as RFC 9457 Problem Details (problem.ts): the message is its detail, and the code, when
// a refusal has one of its own, lets the frontend word it.
export type Refusal = { status: 403 | 404 | 409 | 422 | 429; message: string; code?: string };
export type Outcome<Value> = { value: Value } | { refusal: Refusal };

export function writeLog(entry: Omit<StatusLogEntry, "id">): void {
  database.statusLog.push({ ...entry, id: `E-${crypto.randomUUID()}` });
}

export function replaceIteration(iteration: Iteration): void {
  const index = database.iterations.findIndex((candidate) => candidate.id === iteration.id);
  database.iterations.splice(index, 1, iteration);
}

// An item is classified only into a category with no subcategories.
export function leafCategoryRefusal(categoryId: string): Refusal | null {
  const isKnown = categoryPathOf(database.categories, categoryId).length > 0;
  const isLeaf = leafCategoriesOf(database.categories).some(
    (category) => category.id === categoryId,
  );
  if (!isKnown || !isLeaf) {
    return { status: 422, message: "Choose a category with no subcategories" };
  }

  return null;
}

// Said in the entry of the act that moved progress, since the move is that act's effect
// (status-log.md: causes, not derivations).
export function progressNote(
  before: Iteration["progress"],
  after: Iteration["progress"],
): string | null {
  if (before === after) {
    return null;
  }

  return after === "Ready" ? "Every gate passes: Ready." : `Back to ${after}: a gate holds it.`;
}
