// Calls the hooks endpoints; what they take and answer is in @vera/contract/hooks.

import type {
  Hook,
  HookDelivery,
  HookDraft,
  HookIndex,
  HookPreview,
  HookTestResult,
  NotificationHook,
} from "@vera/contract/hooks";
import {
  hookDeliverySchema,
  hookIndexSchema,
  hookPreviewSchema,
  hookSchema,
  hookTestResultSchema,
  notificationHookSchema,
} from "@vera/contract/hooks";
import { apiRoutes } from "@vera/contract/routes";
import { z } from "zod";
import { deleteResource, getJson, postJson, putJson } from "@/api/http";

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
