// The Plugins resource (plugins.md §1–§2, §4; STATUS "Plugins"; permissions.md §3, `plugin.*`):
// every implementation with the versions installed and what each declares, and every instance
// with its configuration, VERA's settings on it, when it runs (its triggers, and its schedules,
// which only Schedules edits), its recent runs and its last. Making and editing an instance,
// enabling and disabling it and deleting it are `plugin.configure`'s, and Disable and Delete first
// ask the server what stops; *Run now* is `plugin.run`'s. Uploading code is `plugin.upload_code`'s:
// the server reads the package's descriptor before anything is installed, and an instance moves to
// a newer version only when asked, after the difference is shown (§2.6).

import { z } from "zod";
import { deleteResource, getJson, postForm, postJson, putJson } from "@/api/http";
import {
  apiRoutes,
  pluginInstanceActionRoute,
  pluginInstanceRoute,
  pluginUploadInstallRoute,
} from "@/api/routes";
import type { Run } from "@/api/tasks";
import { runSchema } from "@/api/tasks";
import {
  configFieldSchema,
  declarationsSchema,
  declaredNameKinds,
  instancePolicySchema,
  pluginKindSchema,
  pluginTriggerSchema,
} from "@/domain/plugins";
import { cadenceSchema } from "@/domain/schedules";

const id = z.string().min(1);
const timestamp = z.iso.datetime();
const day = z.iso.date();
const count = z.number().int().nonnegative();

// ---------------------------------------------------------------- the page

// One installed version: what it was built against and what it declares.
export const pluginVersionSchema = z.object({
  version: z.string(),
  contractVersion: z.string(),
  installedAt: day,
  installedBy: id,
  triggers: z.array(pluginTriggerSchema),
  declares: declarationsSchema,
  configFields: z.array(configFieldSchema),
});
export type PluginVersion = z.infer<typeof pluginVersionSchema>;

export const pluginImplementationSchema = z.object({
  id,
  // Stable across versions: "cz.mzk.vera.catalog-validity".
  descriptorId: z.string(),
  name: z.string(),
  kind: pluginKindSchema,
  description: z.string(),
  // Newest first; a new instance runs the newest.
  versions: z.array(pluginVersionSchema).min(1),
});
export type PluginImplementation = z.infer<typeof pluginImplementationSchema>;

// VERA's settings on an instance, owned by VERA and edited beside the configuration (§2.2).
export const identitySettingsSchema = z.object({
  kind: z.literal("Identity"),
  // The login page's button, in this order.
  label: z.string().trim().min(1, "The login page shows it on a button."),
  order: z.number().int().positive(),
  // Fixed once users exist (identity.md §1).
  userIdClaim: z.string(),
  // Null gives a user first seen here nothing: they see "no access yet".
  defaultRoleId: id.nullable(),
  matchByEmail: z.boolean(),
  // Applied at each login: a claim gives a role while it holds.
  mappings: z.array(z.object({ claim: z.string().trim().min(1), roleId: id })),
});
export type IdentitySettings = z.infer<typeof identitySettingsSchema>;

export const instanceSettingsSchema = z.discriminatedUnion("kind", [
  identitySettingsSchema,
  // ACCESS-custody-by-plugins: the one request custody its condition places into, bound by id so
  // a rename changes nothing (ACCESS-custody-rename); a deleted one's id stays and places nothing
  // until another is picked (ACCESS-custody-delete). The condition is its configuration.
  z.object({ kind: z.literal("Custody"), custodyId: id }),
  // Which the Message… dialog offers first.
  z.object({ kind: z.literal("Message"), order: z.number().int().positive() }),
  // The first suggestion wins (§4.13).
  z.object({ kind: z.literal("Classifier"), order: z.number().int().positive() }),
  // DOC-lines: the first that recognises a value gives its type.
  z.object({ kind: z.literal("Identifier"), order: z.number().int().positive() }),
]);
export type InstanceSettings = z.infer<typeof instanceSettingsSchema>;

export const pluginInstanceDetailSchema = z.object({
  id,
  name: z.string(),
  implementationId: id,
  kind: pluginKindSchema,
  // The installed version it runs.
  version: z.string(),
  isEnabled: z.boolean(),
  // Without the secrets, which are never sent back: only whether each is set.
  configuration: z.record(z.string(), z.string()),
  secretsSet: z.array(z.string()),
  // The category subtree it serves; null for all of them.
  linkedCategoryId: id.nullable(),
  // Its own triggers; when it runs by itself is its schedules.
  triggers: z.array(pluginTriggerSchema),
  settings: instanceSettingsSchema.nullable(),
  // DOC-identifiers: shipped with VERA; edited, never deleted.
  isPredefined: z.boolean(),
  // Its tiers, copy states and agent (PLG-upgrade).
  policy: instancePolicySchema,
  createdBy: id,
  createdAt: day,
  schedules: z.array(
    z.object({ id, name: z.string(), cadence: cadenceSchema, isPaused: z.boolean() }),
  ),
  // Hooks tied to this Delivery channel, including paused subscriptions.
  hooks: z.array(z.object({ id, name: z.string(), state: z.enum(["active", "paused"]) })),
  // The latest few on Tasks, newest first.
  recentRuns: z.array(
    runSchema.pick({
      id: true,
      what: true,
      state: true,
      startedAt: true,
      errorCount: true,
      changes: true,
    }),
  ),
  runCount: count,
  // Its last run, or login, or send, even once the run has expired from Tasks.
  lastRunAt: timestamp.nullable(),
});
export type PluginInstanceDetail = z.infer<typeof pluginInstanceDetailSchema>;

export const pluginIndexSchema = z.object({
  asOf: timestamp,
  // In kind order, then by name.
  implementations: z.array(pluginImplementationSchema),
  instances: z.array(pluginInstanceDetailSchema),
});
export type PluginIndex = z.infer<typeof pluginIndexSchema>;

export async function getPluginIndex(): Promise<PluginIndex> {
  return getJson(apiRoutes.plugins, pluginIndexSchema);
}

// ---------------------------------------------------------------- an instance

// Secrets left out keep their value; one sent empty is cleared.
export const instanceDraftSchema = z.object({
  name: z.string().trim().min(1, "An instance needs a name: its runs are listed under it."),
  configuration: z.record(z.string(), z.string()),
  linkedCategoryId: id.nullable(),
  settings: instanceSettingsSchema.nullable(),
  // Left out, a new instance takes its version's defaults and a saved one keeps its own.
  policy: instancePolicySchema.optional(),
});
export type InstanceDraft = z.infer<typeof instanceDraftSchema>;

export const newInstanceSchema = instanceDraftSchema.extend({ implementationId: id });
export type NewInstance = z.infer<typeof newInstanceSchema>;

export async function createPluginInstance(draft: NewInstance): Promise<PluginInstanceDetail> {
  return postJson(apiRoutes.pluginInstances, draft, pluginInstanceDetailSchema);
}

export async function savePluginInstance(
  instanceId: string,
  draft: InstanceDraft,
): Promise<PluginInstanceDetail> {
  return putJson(pluginInstanceRoute(instanceId), draft, pluginInstanceDetailSchema);
}

export async function enablePluginInstance(instanceId: string): Promise<PluginInstanceDetail> {
  return postJson(pluginInstanceActionRoute(instanceId, "enable"), {}, pluginInstanceDetailSchema);
}

export async function disablePluginInstance(instanceId: string): Promise<PluginInstanceDetail> {
  return postJson(pluginInstanceActionRoute(instanceId, "disable"), {}, pluginInstanceDetailSchema);
}

// What stops while it is off or once it is gone, said before either (STATUS "Plugins").
export const pluginImpactSchema = z.object({
  kind: pluginKindSchema,
  // Others of its kind still enabled; for an input, others offering the same way in.
  otherEnabledCount: count,
  scheduleCount: count,
  runCount: count,
  // An identity: who signs in through it.
  userCount: count,
  // A custody rule: the open proposals it places now.
  openProposalCount: count,
  // A Delivery channel: active hooks whose sending stops while it is off, counted for anyone and
  // named for whoever may read hooks (PLG-delivery-hooks).
  hookCount: count,
  hooks: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type PluginImpact = z.infer<typeof pluginImpactSchema>;

export async function getPluginImpact(instanceId: string): Promise<PluginImpact> {
  return getJson(pluginInstanceActionRoute(instanceId, "impact"), pluginImpactSchema);
}

// Its schedules go with it; its runs stay under retention.
export async function deletePluginInstance(instanceId: string): Promise<void> {
  return deleteResource(pluginInstanceRoute(instanceId));
}

// By hand, now, as a run on Tasks.
export async function runPluginInstance(instanceId: string): Promise<Run> {
  return postJson(pluginInstanceActionRoute(instanceId, "run"), {}, runSchema);
}

// ---------------------------------------------------------------- versions

export const declaredNameSchema = z.object({
  kind: z.enum(declaredNameKinds),
  name: z.string(),
  label: z.string().nullable(),
});

export const declarationDifferenceSchema = z.object({
  added: z.array(declaredNameSchema),
  retired: z.array(declaredNameSchema),
  configAdded: z.array(z.string()),
  configDropped: z.array(z.string()),
});

// Moving an instance to its implementation's newest version: what changes, said first.
export const instanceUpgradeSchema = z.object({
  fromVersion: z.string(),
  toVersion: z.string(),
  difference: declarationDifferenceSchema,
  // Approvals under a retired rule code, which then cover nothing.
  coveredApprovalCount: count,
});
export type InstanceUpgrade = z.infer<typeof instanceUpgradeSchema>;

export async function getInstanceUpgrade(instanceId: string): Promise<InstanceUpgrade> {
  return getJson(pluginInstanceActionRoute(instanceId, "upgrade"), instanceUpgradeSchema);
}

export async function upgradePluginInstance(instanceId: string): Promise<PluginInstanceDetail> {
  return postJson(pluginInstanceActionRoute(instanceId, "upgrade"), {}, pluginInstanceDetailSchema);
}

// What the server read from an uploaded package, before anything is installed (§2.1, §2.6).
export const uploadReadingSchema = z.object({
  id,
  fileName: z.string(),
  descriptorId: z.string(),
  name: z.string(),
  kind: pluginKindSchema,
  description: z.string(),
  version: pluginVersionSchema.omit({ installedAt: true, installedBy: true }),
  // The implementation it is a new version of; null for a new one.
  implementationId: id.nullable(),
  // Against that implementation's newest version.
  currentVersion: z.string().nullable(),
  difference: declarationDifferenceSchema.nullable(),
  // Built against another major contract version: installable, never enabled.
  isRunnable: z.boolean(),
});
export type UploadReading = z.infer<typeof uploadReadingSchema>;

// From an implementation's drawer, the package must be a version of it.
export async function uploadPluginPackage(
  file: File,
  implementationId: string | null,
): Promise<UploadReading> {
  const form = new FormData();
  form.set("file", file);
  if (implementationId !== null) {
    form.set("implementationId", implementationId);
  }

  return postForm(apiRoutes.pluginUploads, form, uploadReadingSchema);
}

export async function installPluginUpload(uploadId: string): Promise<PluginImplementation> {
  return postJson(pluginUploadInstallRoute(uploadId), {}, pluginImplementationSchema);
}
