// Batches as the server sends them. Every submission is one, one item included, and each is sent
// with how many requests it made, so a batch of one can be shown as none (ENT-batch).

import type { Batch } from "@/domain/entities";
import { database } from "@/mocks/database";

export type StoredBatch = Omit<Batch, "size">;

export function servedBatches(): Batch[] {
  const sizes = batchSizes();
  return database.batches.map((batch) => ({ ...batch, size: sizes.get(batch.id) ?? 0 }));
}

export function servedBatchOf(batchId: string): Batch | null {
  return servedBatches().find((batch) => batch.id === batchId) ?? null;
}

// The batch to show a request under: none for a batch of one (ENT-batch).
export function shownBatchIdOf(batchId: string | null): string | null {
  return batchId !== null && (batchSizes().get(batchId) ?? 0) >= 2 ? batchId : null;
}

// Counted again only when a submission added requests; requests never change batch.
let counted: { requestCount: number; sizes: Map<string, number> } | null = null;

function batchSizes(): Map<string, number> {
  if (counted?.requestCount !== database.requests.length) {
    const sizes = new Map<string, number>();
    for (const request of database.requests) {
      sizes.set(request.batchId, (sizes.get(request.batchId) ?? 0) + 1);
    }
    counted = { requestCount: database.requests.length, sizes };
  }

  return counted.sizes;
}
