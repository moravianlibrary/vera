// This browser and watchlist push (WATCH-delivery): whether the site may notify here, asking,
// and registering the browser's subscription with the server, so pushes reach it. A push is shown
// by public/push-worker.js. The mock has no push service: it registers a stand-in subscription
// and shows its pushes from the open tab (mocks/browser.ts).

import type { PushSubscriptionBody } from "@/api/push";
import { getPushDevices, registerPushDevice } from "@/api/push";
import { env } from "@/config/env";

// "unsupported" where the browser has no notifications; "denied" once refused, which only the
// browser's site settings undo.
export type PushPermission = NotificationPermission | "unsupported";

export function pushPermission(): PushPermission {
  return typeof window === "undefined" || !("Notification" in window)
    ? "unsupported"
    : Notification.permission;
}

const workerScope = "/push/";

function keyBytesOf(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function subscriptionOf(publicKey: string): Promise<PushSubscriptionBody | null> {
  if (env.VITE_API_MODE === "mock") {
    return {
      endpoint: "https://push.invalid/vera-mock",
      keys: { p256dh: "mock", auth: "mock" },
    };
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  const registration = await navigator.serviceWorker.register("/push-worker.js", {
    scope: workerScope,
  });
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytesOf(publicKey),
    }));
  const json = subscription.toJSON();
  return json.endpoint === undefined ||
    json.keys?.p256dh === undefined ||
    json.keys.auth === undefined
    ? null
    : { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

// Registers this browser while the site may notify here; false when it cannot be reached.
export async function registerThisBrowser(): Promise<boolean> {
  if (pushPermission() !== "granted") {
    return false;
  }

  const { publicKey } = await getPushDevices();
  const subscription = await subscriptionOf(publicKey).catch(() => null);
  if (subscription === null) {
    return false;
  }

  await registerPushDevice(subscription);
  return true;
}

// Asks the browser, which only asks the person after a click; registers once they allow it.
export async function allowPush(): Promise<PushPermission> {
  if (pushPermission() === "unsupported") {
    return "unsupported";
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    await registerThisBrowser();
  }

  return permission;
}
