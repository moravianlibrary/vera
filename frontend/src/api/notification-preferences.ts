import { z } from "zod";
import { getJson, patchJson } from "@/api/http";
import { notificationHookSchema } from "@/api/hooks";
import { notificationPreferencePath } from "@/api/routes";

export const notificationChoicesSchema = z.object({
  doNotSend: z.boolean(),
  hooks: z.record(z.string(), z.boolean()),
});
export type NotificationChoices = z.infer<typeof notificationChoicesSchema>;

export const publicNotificationPreferencesSchema = z.object({
  userId: z.string(),
  email: z.string(),
  focusedHookId: z.string(),
  hooks: z.array(notificationHookSchema),
  notifications: notificationChoicesSchema,
});
export type PublicNotificationPreferences = z.infer<typeof publicNotificationPreferencesSchema>;

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
