// Calls the push endpoints; what they take and answer is in @vera/contract/push.

import type { PushDevices, PushSubscriptionBody } from "@vera/contract/push";
import { pushDevicesSchema } from "@vera/contract/push";
import { apiRoutes } from "@vera/contract/routes";
import { getJson, postJson } from "@/api/http";

export async function getPushDevices(): Promise<PushDevices> {
  return getJson(apiRoutes.pushDevices, pushDevicesSchema);
}

// The same endpoint registered again changes nothing.
export async function registerPushDevice(subscription: PushSubscriptionBody): Promise<PushDevices> {
  return postJson(apiRoutes.pushDevices, subscription, pushDevicesSchema);
}
