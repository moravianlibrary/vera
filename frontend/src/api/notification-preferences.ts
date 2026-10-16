// Calls the notification-preferences endpoints; what they take and answer is in
// @vera/contract/notification-preferences.

import type {
  NotificationChoices,
  PublicNotificationPreferences,
} from "@vera/contract/notification-preferences";
import { publicNotificationPreferencesSchema } from "@vera/contract/notification-preferences";
import { notificationPreferencePath } from "@vera/contract/routes";
import { getJson, patchJson } from "@/api/http";

export function getPublicNotificationPreferences(
  token: string,
): Promise<PublicNotificationPreferences> {
  return getJson(notificationPreferencePath(token), publicNotificationPreferencesSchema);
}

export function updatePublicNotificationPreferences(
  token: string,
  notifications: NotificationChoices,
): Promise<PublicNotificationPreferences> {
  return patchJson(
    notificationPreferencePath(token),
    { notifications },
    publicNotificationPreferencesSchema,
  );
}
