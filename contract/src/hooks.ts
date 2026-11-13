// Hooks' HTTP contract: subscriptions, channel-backed delivery and public previews
// (STATUS "Hooks"; plugins.md §4.12; permissions.md §3).

import { watchlistSchema } from "@vera/domain/entities";
import { hookEventCodes } from "@vera/domain/events";
import { z } from "zod";

import { parseDocumentSearchParams, toDocumentSearchParams } from "./documents";
import { parseListSearchParams, toListSearchParams } from "./lists";
import { parseRequestSearchParams, toRequestSearchParams } from "./requests";
import { parseRunSearchParams, toRunSearchParams } from "./tasks";

const id = z.string().min(1);

const timestamp = z.iso.datetime({ offset: true });

const count = z.number().int().nonnegative();

export const hookGroups = ["Requests", "Documents", "Records", "Lists", "Tasks"] as const;

export const hookEventSchema = z.enum(hookEventCodes);

export type HookEvent = z.infer<typeof hookEventSchema>;

// HOOK-payload; HOOK-event-id; HOOK-cause; HOOK-subject-data; HOOK-private.
const hookPayloadActorSchema = z.object({
  kind: z.enum(["person", "agent", "system"]),
  id: id.nullable(),
  name: z.string().nullable(),
});

const hookPayloadDocumentSchema = z.object({
  catalogId: id,
  unit: z.string().nullable(),
  title: z.string(),
  type: id,
  shelfMark: z.string().nullable(),
  identifiers: z.array(z.object({ type: id, value: z.string() })),
  pages: z.number().int().nonnegative().nullable(),
  properties: z.record(z.string(), z.unknown()),
  iteration: z
    .object({
      id,
      progress: id,
      category: id,
      priority: id,
      project: id.nullable(),
      list: id.nullable(),
      link: z.string().nullable(),
      links: z.array(z.object({ url: z.string(), where: z.string(), primary: z.boolean() })),
    })
    .optional(),
});

const hookPayloadEventSchema = z
  .object({
    id,
    type: hookEventSchema,
    occurredAt: timestamp,
    correlationId: id,
    subject: z.object({ kind: id, id, url: z.string().url() }),
    changes: z.array(z.object({ field: id, from: z.unknown().optional(), to: z.unknown() })),
    cause: z.object({
      kind: z.enum(["act", "job", "date"]),
      act: id.nullable(),
      run: z.object({ id, instance: z.object({ id, name: z.string() }) }).nullable(),
      actor: hookPayloadActorSchema,
      reason: z.object({
        public: z.string().nullable(),
        internal: z.string().optional(),
      }),
    }),
    document: hookPayloadDocumentSchema.optional(),
    list: z
      .object({
        id,
        name: z.string(),
        starts: z.iso.date(),
        ends: z.iso.date(),
        pages: count.nullable(),
      })
      .optional(),
    documents: z.array(hookPayloadDocumentSchema).optional(),
    run: z
      .object({
        id,
        instance: z.object({ id, name: z.string() }),
        trigger: z.unknown(),
        state: id,
        error: z.string().nullable(),
        items: count,
        done: count,
      })
      .optional(),
    error: z.string().optional(),
    askers: z.array(z.object({ id, name: z.string() })).optional(),
  })
  .passthrough();

export const hookPayloadSchema = z.object({
  schema: z.literal("vera.hook/1"),
  hook: z.object({ id, name: z.string() }),
  delivery: z.object({ id, attempt: z.number().int().positive() }),
  events: z.array(hookPayloadEventSchema).min(1),
});

export type HookPayload = z.infer<typeof hookPayloadSchema>;

export function hookGroupOfEvent(event: HookEvent): (typeof hookGroups)[number] {
  if (event.startsWith("request.")) return "Requests";
  if (event.startsWith("list.")) return "Lists";
  if (event.startsWith("run.")) return "Tasks";
  if (event.startsWith("document.")) return "Records";
  if (event === "iteration.property_changed") return "Records";
  return "Documents";
}

// HOOK-condition: the page listing the event's subject owns its condition.
export function subjectKindOfEvent(event: HookEvent): HookSubjectKind {
  if (event.startsWith("request.")) return "requests";
  if (event.startsWith("list.")) return "lists";
  if (event.startsWith("run.")) return "tasks";
  return "documents";
}

const conditionParsers = {
  requests: (params: URLSearchParams) => toRequestSearchParams(parseRequestSearchParams(params)),
  documents: (params: URLSearchParams) => toDocumentSearchParams(parseDocumentSearchParams(params)),
  lists: (params: URLSearchParams) => toListSearchParams(parseListSearchParams(params)),
  tasks: (params: URLSearchParams) => toRunSearchParams(parseRunSearchParams(params)),
};

export type HookSubjectKind = keyof typeof conditionParsers;

const conditionSchema = watchlistSchema.shape.filter;
export const hookConditionsSchema = z.strictObject({
  requests: conditionSchema.optional(),
  documents: conditionSchema.optional(),
  lists: conditionSchema.optional(),
  tasks: conditionSchema.optional(),
});

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

export const hookDraftSchema = z
  .object({
    name: z.string().trim().min(1),
    events: z
      .array(hookEventSchema)
      .min(1)
      .refine((events) => new Set(events).size === events.length, {
        message: "Pick each event once",
      }),
    conditions: hookConditionsSchema,
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
  })
  .superRefine((draft, ctx) => {
    const kinds = new Set(draft.events.map(subjectKindOfEvent));
    for (const [kind, filter] of Object.entries(draft.conditions)) {
      if (filter === undefined) continue;
      const subjectKind = kind as HookSubjectKind;
      if (!kinds.has(subjectKind)) {
        ctx.addIssue({
          code: "custom",
          path: ["conditions", kind],
          message: "Pick an event for this page before adding its condition",
          params: { code: "hook.condition_kind" },
        });
        continue;
      }
      // Page parsers tolerate stale links. Conditions must not silently lose a value.
      const parse = conditionParsers[subjectKind];
      const canonical = parse(new URLSearchParams(filter));
      const normalize = (value: string) =>
        [...new Set(value.split(",").map((part) => part.trim()))].sort().join(",");
      if (
        Object.entries(filter).some(([key, value]) => {
          const parsed = canonical.get(key);
          return parsed === null || normalize(parsed) !== normalize(value);
        })
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["conditions", kind],
          message: "Use valid filter values for this page",
          params: { code: "hook.condition_invalid" },
        });
      }
    }
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

export const hookSchema = hookDraftSchema.safeExtend({
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
