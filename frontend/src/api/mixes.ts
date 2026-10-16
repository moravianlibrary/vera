// Calls the mixes endpoints; what they take and answer is in @vera/contract/mixes.

import type { IntentionMixDetail } from "@vera/contract/mixes";
import { intentionMixSchema } from "@vera/contract/mixes";
import { intentionRoute } from "@vera/contract/routes";
import { findJson } from "@/api/http";

const mixRouteOf = (intentionId: string) => `${intentionRoute(intentionId)}/mix`;

// Null when it does not exist or the caller may not see it.
export async function findIntentionMix(intentionId: string): Promise<IntentionMixDetail | null> {
  return findJson(mixRouteOf(intentionId), intentionMixSchema);
}
