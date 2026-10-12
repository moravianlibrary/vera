// Opaque, server-side tokens for the mock email preference link. A production server signs or
// stores these outside the browser and verifies expiry before serving the limited preference API.

import { database } from "@/mocks/database";
import { changeUserSettings, userSettingsOf } from "@/mocks/user-settings";

interface TokenGrant {
  userId: string;
  hookId: string;
  expiresAt: number;
}

const grants = new Map<string, TokenGrant>();
const lifetimeMilliseconds = 30 * 24 * 60 * 60_000;

export function issueNotificationToken(userId: string, hookId: string): string {
  const token = crypto.randomUUID();
  grants.set(token, { userId, hookId, expiresAt: Date.now() + lifetimeMilliseconds });
  return token;
}

export function notificationGrantOf(token: string): TokenGrant | null {
  const grant = grants.get(token);
  return grant !== undefined && grant.expiresAt > Date.now() ? grant : null;
}

export function publicNotificationChoices(token: string) {
  const grant = notificationGrantOf(token);
  if (grant === null) return null;
  const user = database.users.find((candidate) => candidate.id === grant.userId);
  if (user === undefined) return null;
  return {
    userId: grant.userId,
    email: user.email ?? "",
    focusedHookId: grant.hookId,
    hooks: database.hooks.flatMap((hook) =>
      hook.recipientPreference == null
        ? []
        : [
            {
              id: hook.id,
              label: hook.recipientPreference.label,
              event: hook.event,
              defaultEnabled: hook.recipientPreference.defaultEnabled,
              isActive: hook.state === "active",
            },
          ],
    ),
    notifications: userSettingsOf(grant.userId).notifications ?? { doNotSend: false, hooks: {} },
  };
}

export function changePublicNotificationChoices(
  token: string,
  notifications: { doNotSend: boolean; hooks: Record<string, boolean> },
) {
  const grant = notificationGrantOf(token);
  if (grant === null) return null;
  const allowedIds = new Set(
    database.hooks.filter((hook) => hook.recipientPreference != null).map((hook) => hook.id),
  );
  const permittedHooks = Object.fromEntries(
    Object.entries(notifications.hooks).filter(([id]) => allowedIds.has(id)),
  );
  changeUserSettings(grant.userId, {
    notifications: { doNotSend: notifications.doNotSend, hooks: permittedHooks },
  });
  return publicNotificationChoices(token);
}
