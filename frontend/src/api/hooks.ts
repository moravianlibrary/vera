// Hooks' HTTP contract: subscriptions, channel-backed delivery and public previews
// (STATUS "Hooks"; plugins.md §4.12; permissions.md §3).

import { z } from "zod";
import { deleteResource, getJson, postJson, putJson } from "@/api/http";
import { apiRoutes } from "@/api/routes";

const id = z.string().min(1);
const timestamp = z.iso.datetime({ offset: true });
const count = z.number().int().nonnegative();

export const hookGroups = ["Requests", "Documents", "Records", "Lists", "Tasks"] as const;
export const hookEventSchema = z.enum([
  "request.created",
  "request.decided",
  "request.held",
  "iteration.ingested",
  "iteration.ingest_failed",
  "iteration.validated",
  "iteration.restricted",
  "iteration.cancelled",
  "iteration.listed",
  "iteration.digitized",
  "iteration.published",
  "iteration.classified",
  "document.relinked",
  "document.property_changed",
  "iteration.property_changed",
  "document.registry_changed",
  "list.created",
  "list.dates_changed",
  "list.deleted",
  "task.failed",
  "task.finished",
]);
export type HookEvent = z.infer<typeof hookEventSchema>;
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
  event: hookEventSchema,
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
  event: hookEventSchema,
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
  event: hookEventSchema,
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

const hookPath = (hookId: string) => `${apiRoutes.hooks}/${encodeURIComponent(hookId)}`;
const hookAction = (hookId: string, action: string) => `${hookPath(hookId)}/${action}`;

export const getHookIndex = (): Promise<HookIndex> => getJson(apiRoutes.hooks, hookIndexSchema);
export const getNotificationHooks = (): Promise<NotificationHook[]> =>
  getJson(apiRoutes.notificationHooks, z.array(notificationHookSchema));
export const createHook = (draft: HookDraft): Promise<Hook> =>
  postJson(apiRoutes.hooks, draft, hookSchema);
export const saveHook = (id: string, draft: HookDraft): Promise<Hook> =>
  putJson(hookPath(id), draft, hookSchema);
export const deleteHook = (id: string): Promise<void> => deleteResource(hookPath(id));
export const pauseHook = (id: string, reason: string): Promise<Hook> =>
  postJson(hookAction(id, "pause"), { reason }, hookSchema);
export const resumeHook = (id: string): Promise<Hook> =>
  postJson(hookAction(id, "resume"), {}, hookSchema);
export const retryDelivery = (id: string): Promise<HookDelivery> =>
  postJson(`${apiRoutes.hooks}/deliveries/${encodeURIComponent(id)}/retry`, {}, hookDeliverySchema);
export const discardDelivery = (id: string): Promise<HookDelivery> =>
  postJson(
    `${apiRoutes.hooks}/deliveries/${encodeURIComponent(id)}/discard`,
    {},
    hookDeliverySchema,
  );
export const retryHookDeliveries = (id: string): Promise<HookDelivery[]> =>
  postJson(hookAction(id, "retry"), {}, z.array(hookDeliverySchema));
export const sendHookNow = (id: string): Promise<HookDelivery[]> =>
  postJson(hookAction(id, "send-now"), {}, z.array(hookDeliverySchema));
export const previewHook = (draft: HookDraft): Promise<HookPreview> =>
  postJson(apiRoutes.hookPreview, draft, hookPreviewSchema);
export const sendHookTest = (draft: HookDraft): Promise<HookTestResult> =>
  postJson(`${apiRoutes.hooks}/test`, draft, hookTestResultSchema);
