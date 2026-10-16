// The browsers each person allowed to be notified in (WATCH-delivery): registered with the
// subscription the browser made, and since when, which is the push baseline. In memory: a
// reload forgets them, and the client registers again while the browser still allows it.

import type { PushDevices, PushSubscriptionBody } from "@/api/push";

// A valid P-256 public key, as a real server's VAPID key would be; the mock pushes nothing
// through a push service, so nobody holds its private half.
const mockPublicKey =
  "BNbxGYNMhEIi9zrneh7mqV4oUanjLUK3m-mYZBc62frMKrEoMk88r3Lk596T0ck9xlT-aOe2kJPcZ4TlTjaUeCs";

const devices = new Map<string, { endpoint: string; since: string }[]>();

export function pushDevicesOf(userId: string): PushDevices {
  return { publicKey: mockPublicKey, deviceCount: devices.get(userId)?.length ?? 0 };
}

export function registerPushDevice(
  userId: string,
  subscription: PushSubscriptionBody,
): PushDevices {
  const known = devices.get(userId) ?? [];
  if (!known.some((device) => device.endpoint === subscription.endpoint)) {
    devices.set(userId, [
      ...known,
      { endpoint: subscription.endpoint, since: new Date().toISOString() },
    ]);
  }

  return pushDevicesOf(userId);
}

// When the person first allowed a browser; null while none is registered.
export function pushAllowedSince(userId: string): string | null {
  const since = (devices.get(userId) ?? []).map((device) => device.since).toSorted();
  return since[0] ?? null;
}

export function forgetPushDevices(): void {
  devices.clear();
}
