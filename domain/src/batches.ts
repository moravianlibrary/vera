// Batches as the server sends them. Every submission is one, one item included, and each is sent
// with how many requests it made, so a batch of one can be shown as none (ENT-batch).
import type { Batch, Request } from "./entities";
import type { RecordStore } from "./store";

export type StoredBatch = Omit<Batch, "size" | "source"> & { source?: Batch["source"] };

// RecordStore snapshot arrays can key this derived index; see store.ts.
const countedByRequests = new WeakMap<readonly Request[], Map<string, number>>();

export function servedBatches(store: RecordStore): Batch[] {
  const sizes = batchSizes(store);
  return store.batches.map((batch) => ({
    ...batch,
    source: batch.source ?? null,
    size: sizes.get(batch.id) ?? 0,
  }));
}

export function servedBatchOf(store: RecordStore, batchId: string): Batch | null {
  return servedBatches(store).find((batch) => batch.id === batchId) ?? null;
}

// The batch to show a request under: none for a batch of one (ENT-batch).
export function shownBatchIdOf(store: RecordStore, batchId: string | null): string | null {
  return batchId !== null && (batchSizes(store).get(batchId) ?? 0) >= 2 ? batchId : null;
}

function batchSizes(store: RecordStore): Map<string, number> {
  const requests = store.requests;
  let counted = countedByRequests.get(requests);
  if (!counted) {
    const sizes = new Map<string, number>();
    for (const request of requests) {
      sizes.set(request.batchId, (sizes.get(request.batchId) ?? 0) + 1);
    }
    counted = sizes;
    countedByRequests.set(requests, sizes);
  }
  return counted;
}
