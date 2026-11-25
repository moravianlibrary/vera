// The Plugins resource (plugins.md §1–§2, §4; STATUS "Plugins"; permissions.md §3, `plugin.*`):
// every implementation with the versions installed and what each declares, and every instance
// with its configuration, VERA's settings on it, when it runs (its triggers, and its schedules,
// which only Schedules edits), its recent runs and its last. Making and editing an instance,
// enabling and disabling it and deleting it are `plugin.configure`'s, and Disable and Delete first
// ask the server what stops; *Run now* is `plugin.run`'s. Uploading code is `plugin.upload_code`'s:
// the server reads the package's descriptor before anything is installed, and an instance moves to
// a newer version only when asked, after the difference is shown (§2.6).

import {
  configFieldSchema,
  declarationsSchema,
  declaredNameKinds,
  instancePolicySchema,
  pluginKindSchema,
  pluginTriggerSchema,
} from "@vera/domain/plugins";
import { cadenceSchema } from "@vera/domain/schedules";
import { z } from "zod";
import { runSchema } from "./tasks";
import { namesSchema } from "./user-settings";

const id = z.string().min(1);

const timestamp = z.iso.datetime();

const day = z.iso.date();

const count = z.number().int().nonnegative();

// ---------------------------------------------------------------- the page

// One installed version: what it was built against and what it declares.
export const pluginVersionSchema = z.object({
  version: z.string(),
  contractVersion: z.string(),
  signer: z.string(),
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

// PLG-bases: a catalog base as a catalog ID begins, `MZK01`.
export const catalogBaseSchema = z
  .string()
  .regex(/^[A-Z]{3,4}\d{2}$/, "A base is three or four capital letters and two digits: MZK01.");

// PLG-bases: the kinds that read a record's catalog data, and so may be limited to some bases.
export const baseLimitedKinds = [
  "PropertySource",
  "Validation",
  "Restriction",
  "Classifier",
  "Custody",
] as const;

// PLG-api-session: at most so many requests in so many minutes; an instance with none set has
// VERA's default.
export const requestLimitSchema = z.object({
  requests: z.number().int().positive().max(100_000),
  minutes: z.number().int().positive().max(1440),
});

export type RequestLimit = z.infer<typeof requestLimitSchema>;

export const defaultRequestLimit: RequestLimit = { requests: 300, minutes: 5 };

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
  names: namesSchema,
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
  // PLG-bases: the catalog bases whose records it reads; none for every record.
  catalogBases: z.array(catalogBaseSchema),
  // PLG-api-session; null for VERA's default.
  requestLimit: requestLimitSchema.nullable(),
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
    z.object({
      id,
      name: z.string(),
      names: namesSchema,
      cadence: cadenceSchema,
      isPaused: z.boolean(),
    }),
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
  // PLG-api-mirror: only versions declaring sync keep a mirror.
  mirror: z.object({ syncedAt: timestamp.nullable(), records: count }).nullable(),
  canReset: z.boolean(),
});

export type PluginInstanceDetail = z.infer<typeof pluginInstanceDetailSchema>;

export const pluginIndexSchema = z.object({
  asOf: timestamp,
  // In kind order, then by name.
  implementations: z.array(pluginImplementationSchema),
  instances: z.array(pluginInstanceDetailSchema),
});

export type PluginIndex = z.infer<typeof pluginIndexSchema>;

// ---------------------------------------------------------------- an instance

// Secrets left out keep their value; one sent empty is cleared.
export const instanceDraftSchema = z.object({
  names: namesSchema,
  configuration: z.record(z.string(), z.string()),
  linkedCategoryId: id.nullable(),
  // PLG-bases; left out, a new instance reads every base and a saved one keeps its own.
  catalogBases: z.array(catalogBaseSchema).optional(),
  // PLG-api-session; null for VERA's default; left out, a saved one keeps its own.
  requestLimit: requestLimitSchema.nullable().optional(),
  settings: instanceSettingsSchema.nullable(),
  // Left out, a new instance takes its version's defaults and a saved one keeps its own.
  policy: instancePolicySchema.optional(),
});

export type InstanceDraft = z.infer<typeof instanceDraftSchema>;

export const newInstanceSchema = instanceDraftSchema.extend({ implementationId: id });

export type NewInstance = z.infer<typeof newInstanceSchema>;

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
