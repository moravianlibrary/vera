// Hooks' HTTP contract: subscriptions, channel-backed delivery and public previews
// (STATUS "Hooks"; plugins.md §4.12; permissions.md §3).

import { hookEventCodes } from "@vera/domain/events";
import { z } from "zod";

const id = z.string().min(1);

const timestamp = z.iso.datetime({ offset: true });

const count = z.number().int().nonnegative();

export const hookGroups = ["Requests", "Documents", "Records", "Lists", "Tasks"] as const;

export const hookEventSchema = z.enum(hookEventCodes);

export type HookEvent = z.infer<typeof hookEventSchema>;

export function hookGroupOfEvent(event: HookEvent): (typeof hookGroups)[number] {
  if (event.startsWith("request.")) return "Requests";
  if (event.startsWith("list.")) return "Lists";
  if (event.startsWith("run.")) return "Tasks";
  if (event.startsWith("document.")) return "Records";
  if (event === "iteration.property_changed") return "Records";
  return "Documents";
}

export const hookInterfaceSchema = z.enum(["Email", "Chat", "Webhook", "File"]);

export const hookChannelSchema = z.object({
  id,
  name: z.string(),
  interface: hookInterfaceSchema,
  isEnabled: z.boolean(),
});

export type HookChannel = z.infer<typeof hookChannelSchema>;

export const hookRetrySchema = z.object({
  attempts: z.number().int().min(1).max(10),
  backoff: z.enum(["fixed", "exponential"]),
});

export const hookBatchSchema = z
  .object({
    waitMinutes: z.number().int().min(1),
    maxMinutes: z.number().int().min(1),
    by: z.enum(["recipient", "all"]),
  })
  .refine((batch) => batch.maxMinutes >= batch.waitMinutes, {
    message: "The maximum wait must be at least the quiet wait",
    path: ["maxMinutes"],
  });

export const hookDraftSchema = z.object({
  name: z.string().trim().min(1),
  events: z
    .array(hookEventSchema)
    .min(1)
    .refine((events) => new Set(events).size === events.length, {
      message: "Pick each event once",
    }),
  filter: z.string().trim(),
  channelId: id,
  recipient: z.string().trim().min(1),
  message: z.string().trim(),
  batch: hookBatchSchema.nullable(),
  retry: hookRetrySchema,
  recipientPreference: z
    .object({
      label: z.string().trim().min(1),
      defaultEnabled: z.boolean(),
    })
    .nullable()
    .optional(),
});

export type HookDraft = z.infer<typeof hookDraftSchema>;

export const hookPauseSchema = z.object({ reason: z.string().trim().min(1) });

export const hookDeliverySchema = z.object({
  id,
  hookId: id,
  recipient: z.string(),
  subjects: z.array(z.string()),
  events: z.array(hookEventSchema).min(1),
  publicText: z.string(),
  manageNotificationsUrl: z.string().nullable().optional(),
  state: z.enum(["waiting", "gave_up", "sent", "discarded", "suppressed"]),
  firstAt: timestamp,
  lastAt: timestamp,
  sendAt: timestamp.nullable(),
  attempts: count,
  lastError: z.string().nullable(),
});

export type HookDelivery = z.infer<typeof hookDeliverySchema>;

export const hookAttemptSchema = z.object({
  id,
  deliveryId: id,
  at: timestamp,
  result: z.enum(["sent", "failed"]),
  detail: z.string(),
  durationMs: count,
});

export type HookAttempt = z.infer<typeof hookAttemptSchema>;

export const hookSchema = hookDraftSchema.extend({
  id,
  state: z.enum(["active", "paused"]),
  createdBy: id,
  createdAt: timestamp,
  pause: z.object({ by: id, at: timestamp, reason: z.string() }).nullable(),
});

export type Hook = z.infer<typeof hookSchema>;

export const notificationHookSchema = z.object({
  id,
  label: z.string(),
  events: z.array(hookEventSchema).min(1),
  defaultEnabled: z.boolean(),
  isActive: z.boolean(),
});

export type NotificationHook = z.infer<typeof notificationHookSchema>;

export const hookIndexSchema = z.object({
  asOf: timestamp,
  retentionDays: count,
  hooks: z.array(hookSchema),
  channels: z.array(hookChannelSchema),
  deliveries: z.array(hookDeliverySchema),
  attempts: z.array(hookAttemptSchema),
});

export type HookIndex = z.infer<typeof hookIndexSchema>;

export const hookPreviewSchema = z.object({
  channel: hookChannelSchema,
  recipient: z.string(),
  event: hookEventSchema,
  sampleSubject: z.string(),
  publicText: z.string(),
});

export type HookPreview = z.infer<typeof hookPreviewSchema>;

export const hookTestResultSchema = z.object({
  sent: z.boolean(),
  detail: z.string(),
  durationMs: count,
});

export type HookTestResult = z.infer<typeof hookTestResultSchema>;
