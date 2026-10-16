import { z } from "zod";
import { notificationHookSchema } from "./hooks";

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
