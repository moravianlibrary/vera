// What every action of the mock server shares: its answer is a value or a refusal the handler
// turns into an HTTP status, the status log it writes (status-log.md), and the checks more than
// one action makes. Kept apart from the resources so each of them reads only its own rules.

import { categoryPathOf, leafCategoriesOf } from "@/domain/categories";
import type { StatusLogEntry } from "@/domain/entities";
import { database } from "@/mocks/database";

export type Refusal = { status: 403 | 404 | 409 | 422; message: string };
export type Outcome<Value> = { value: Value } | { refusal: Refusal };

export function writeLog(entry: Omit<StatusLogEntry, "id">): void {
  database.statusLog.push({ ...entry, id: `E-${crypto.randomUUID()}` });
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
