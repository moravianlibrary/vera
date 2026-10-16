// Additions: approved items being added to VERA by ingest (concepts.md, Request). An ingest that
// failed is retried, never deleted, and the batch it came in on is the unit retried
// (ACT-retry-batch; `request.retry`, at `custody` or `any`).

import { z } from "zod";

export const batchRetryResultSchema = z.object({
  batchId: z.string(),
  // The iterations sent back to ingest, each now being added again.
  retriedIds: z.array(z.string()).min(1),
});

export type BatchRetryResult = z.infer<typeof batchRetryResultSchema>;
