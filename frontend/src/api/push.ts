// Browser push over HTTP (WATCH-delivery, WATCH-push): the server's key a browser subscribes with,
// whether this person has a browser registered, and registering one once they allow the site's
// notifications there.

import { z } from "zod";
import { getJson, postJson } from "@/api/http";
import { apiRoutes } from "@/api/routes";

export const pushDevicesSchema = z.object({
  // The server's public key (VAPID), base64url, which a browser's subscription is made with.
  publicKey: z.string().min(1),
  deviceCount: z.number().int().nonnegative(),
});
export type PushDevices = z.infer<typeof pushDevicesSchema>;

// What a browser's push subscription says, as `PushSubscription.toJSON()` gives it.
export const pushSubscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});
export type PushSubscriptionBody = z.infer<typeof pushSubscriptionSchema>;

export async function getPushDevices(): Promise<PushDevices> {
  return getJson(apiRoutes.pushDevices, pushDevicesSchema);
}

// The same endpoint registered again changes nothing.
export async function registerPushDevice(subscription: PushSubscriptionBody): Promise<PushDevices> {
  return postJson(apiRoutes.pushDevices, subscription, pushDevicesSchema);
}
