// Calls the additions endpoints; what they take and answer is in @vera/contract/additions.

import type { BatchRetryResult } from "@vera/contract/additions";
import { batchRetryResultSchema } from "@vera/contract/additions";
import { batchRetryRoute } from "@vera/contract/routes";
import { postJson } from "@/api/http";

export async function retryBatch(batchId: string): Promise<BatchRetryResult> {
  return postJson(batchRetryRoute(batchId), {}, batchRetryResultSchema);
}
