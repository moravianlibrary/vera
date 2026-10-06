// Additions: approved items being added to VERA by ingest (concepts.md, Request). An ingest that
// failed is retried, never deleted, and the batch it came in on is the unit an administrator
// retries (use case A1; `addition.retry`, which only an administrator holds, at any scope).

import { z } from "zod";
import { postJson } from "@/api/http";
import { batchRetryRoute } from "@/api/routes";

export const batchRetryResultSchema = z.object({
  batchId: z.string(),
  // The iterations sent back to ingest, each now being added again.
  retriedIds: z.array(z.string()).min(1),
});
export type BatchRetryResult = z.infer<typeof batchRetryResultSchema>;

export async function retryBatch(batchId: string): Promise<BatchRetryResult> {
  return postJson(batchRetryRoute(batchId), {}, batchRetryResultSchema);
}
