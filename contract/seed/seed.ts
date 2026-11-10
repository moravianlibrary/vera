// The complete on-disk seed format, shared by the engine and the backend loader.

import { hookRetrySchema } from "@vera/contract/hooks";
import { intentionRowSchema } from "@vera/contract/intentions";
import { mixTreeSchema } from "@vera/contract/mixes";
import { uploadReadingSchema } from "@vera/contract/plugins";
import { watchlistViewerSchema } from "@vera/contract/watchlists";
import {
  accessGroupSchema,
  identitySchema,
  mappedRoleSchema,
  roleSchema,
} from "@vera/domain/access";
import {
  batchSchema,
  categorySchema,
  digitizationListSchema,
  distributionSchema,
  documentSchema,
  intentionSchema,
  intentionTemplateSchema,
  iterationSchema,
  projectSchema,
  requestSchema,
  userSchema,
  watchlistSchema,
} from "@vera/domain/entities";
import { eventEntrySchema } from "@vera/domain/events";
import type { StoredPluginImplementation } from "@vera/domain/plugin-store";
import {
  declarationsSchema,
  instancePolicySchema,
  pluginKindSchema,
  pluginTriggerSchema,
} from "@vera/domain/plugins";
import { propertyDefinitionSchema } from "@vera/domain/properties";
import type { StoredRequestCustody } from "@vera/domain/request-custody";
import { cadenceSchema, overlapSchema } from "@vera/domain/schedules";
import { z } from "zod";

const id = z.string().min(1);
const userAccess = z.strictObject({
  handRoleIds: z.array(id),
  mappedRoles: z.array(mappedRoleSchema),
  identities: z.array(identitySchema),
  entry: z.string().nullable(),
  suspendedAt: z.iso.datetime().nullable().optional(),
});
const objectMap = <T extends z.ZodType>(value: T) => z.record(id, value);
const project = projectSchema;
const storedPluginVersion = z.strictObject({
  version: z.string(),
  contractVersion: z.string(),
  installedAt: z.string(),
  installedBy: id,
  triggers: z.array(pluginTriggerSchema),
  declares: declarationsSchema,
  configFields: z.array(
    z.strictObject({ key: z.string(), isSecret: z.boolean(), isRequired: z.boolean() }),
  ),
});
const storedPluginImplementation = z.strictObject({
  id,
  descriptorId: z.string(),
  name: z.string(),
  kind: pluginKindSchema,
  description: z.string(),
  versions: z.array(storedPluginVersion),
}) satisfies z.ZodType<StoredPluginImplementation>;
const settings = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("Identity"),
    label: z.string(),
    order: z.number(),
    userIdClaim: z.string(),
    defaultRoleId: id.nullable(),
    matchByEmail: z.boolean(),
    mappings: z.array(z.strictObject({ claim: z.string(), roleId: id })),
  }),
  z.strictObject({ kind: z.literal("Custody"), custodyId: id }),
  z.strictObject({ kind: z.enum(["Message", "Classifier", "Identifier"]), order: z.number() }),
]);
const storedPluginInstance = z.strictObject({
  id,
  name: z.string(),
  implementationId: id,
  version: z.string().optional(),
  isEnabled: z.boolean(),
  configuration: z.record(z.string(), z.string()),
  linkedCategoryId: id.nullable().optional(),
  triggers: z.array(pluginTriggerSchema),
  settings: settings.nullable().optional(),
  policy: instancePolicySchema.optional(),
  createdBy: id.optional(),
  createdAt: z.string(),
  lastRunAt: z.string().nullable().optional(),
  isDeleted: z.boolean().optional(),
  isPredefined: z.boolean().optional(),
});
const storedRequestCustody = z.strictObject({
  id,
  name: z.string(),
  description: z.string(),
  isFallback: z.boolean(),
  memberIds: z.array(id),
  groupIds: z.array(id),
}) satisfies z.ZodType<StoredRequestCustody>;
const seedCollections = z.strictObject({
  users: z.array(userSchema),
  roles: z.array(roleSchema),
  // How each person signs in and holds their roles, as the mock's fixtures keep it.
  userAccess: objectMap(userAccess),
  categories: z.array(categorySchema),
  groups: z.array(accessGroupSchema),
  categoryMembers: objectMap(z.array(id)),
  projects: z.array(project).optional(),
  intentions: z.array(intentionSchema).optional(),
  archivedIntentionRows: objectMap(intentionRowSchema).optional(),
  archivedIntentionMixes: objectMap(mixTreeSchema).optional(),
  archivedIntentionCategories: objectMap(z.array(categorySchema)).optional(),
  distributions: z.array(distributionSchema).optional(),
  intentionTemplates: z.array(intentionTemplateSchema).optional(),
  lists: z
    .array(
      z
        .object({
          id,
          name: z.string(),
          startsOn: z.string(),
          endsOn: z.string(),
          targetPages: z.number().nullable(),
          generated: digitizationListSchema.shape.generated,
          createdBy: id,
          createdAt: z.iso.datetime(),
          done: digitizationListSchema.shape.done,
        })
        .strict(),
    )
    .optional(),
  batches: z.array(batchSchema.omit({ size: true })).optional(),
  requestCustodies: z.array(storedRequestCustody).optional(),
  documents: z.array(documentSchema).optional(),
  iterations: z.array(iterationSchema).optional(),
  requests: z.array(requestSchema).optional(),
  statusLog: z.array(eventEntrySchema).optional(),
  watchlists: z
    .array(
      watchlistSchema
        .extend({ ownerId: id, filterVersion: z.number().optional(), copiedFrom: id.optional() })
        .strict(),
    )
    .optional(),
  watchlistViewers: z
    .array(z.strictObject({ userId: id, watchlistId: id, ...watchlistViewerSchema.shape }))
    .optional(),
  watchlistEntries: z
    .array(
      z.strictObject({
        userId: id,
        watchlistId: id,
        recordId: id,
        enteredAt: z.string(),
        baseline: z.boolean(),
        filterVersion: z.number().int().positive().optional(),
        deliveredAt: z.record(z.string(), z.iso.datetime()).optional(),
        pushDeliveredAt: z.iso.datetime().nullable().optional(),
      }),
    )
    .optional(),
  watchlistBaselines: z.array(id).optional(),
  pluginImplementations: z.array(storedPluginImplementation).optional(),
  pluginInstances: z.array(storedPluginInstance).optional(),
  hooks: z
    .array(
      z.strictObject({
        id,
        name: z.string(),
        event: z.string(),
        filter: z.string(),
        channelId: id,
        recipient: z.string(),
        message: z.string(),
        batch: z
          .strictObject({
            waitMinutes: z.number(),
            maxMinutes: z.number(),
            by: z.enum(["recipient", "all"]),
          })
          .nullable(),
        retry: hookRetrySchema,
        state: z.enum(["active", "paused"]),
        createdBy: id,
        createdAt: z.string(),
        pause: z.object({ by: id, at: z.string(), reason: z.string() }).nullable(),
        recipientPreference: z
          .object({ label: z.string(), defaultEnabled: z.boolean() })
          .nullable()
          .optional(),
      }),
    )
    .optional(),
  hookDeliveries: z
    .array(
      z.strictObject({
        id,
        hookId: id,
        recipient: z.string(),
        subjects: z.array(id),
        event: z.string(),
        publicText: z.string(),
        state: z.enum(["waiting", "gave_up", "sent", "discarded", "suppressed"]),
        firstAt: z.string(),
        lastAt: z.string(),
        sendAt: z.string().nullable(),
        attempts: z.number().int(),
        lastError: z.string().nullable(),
      }),
    )
    .optional(),
  hookAttempts: z
    .array(
      z.strictObject({
        id,
        deliveryId: id,
        at: z.string(),
        result: z.enum(["sent", "failed"]),
        detail: z.string(),
        durationMs: z.number().int(),
      }),
    )
    .optional(),
  pluginUploads: z.array(uploadReadingSchema).optional(),
  runs: z
    .array(
      z.strictObject({
        ending: z
          .object({
            state: z.enum(["Done", "Failed", "Cancelled", "Skipped"]),
            finishedAt: z.string(),
            doneCount: z.number(),
          })
          .nullable(),
        failure: z.string().nullable(),
        note: z.string().nullable(),
        cancelledBy: id.nullable(),
        rerunOf: id.nullable(),
        id,
        what: z.string(),
        instanceId: id.nullable(),
        coreName: z.string().nullable(),
        trigger: z.discriminatedUnion("kind", [
          z.strictObject({ kind: z.literal("schedule"), scheduleId: id, cadence: cadenceSchema }),
          z.strictObject({
            kind: z.literal("manual"),
            from: z.strictObject({ label: z.string(), path: z.string() }),
          }),
          z.strictObject({
            kind: z.literal("approval"),
            from: z.strictObject({ label: z.string(), path: z.string() }),
          }),
          z.strictObject({
            kind: z.literal("repeat"),
            templateId: id,
            name: z.string(),
            cadence: cadenceSchema,
          }),
        ]),
        startedBy: id.nullable(),
        startedAt: z.string(),
        itemCount: z.number(),
        doneCount: z.number().optional(),
        itemsPerMinute: z.number().nullable(),
        errors: z.array(
          z.object({ iterationId: id, message: z.string(), atItem: z.number() }).strict(),
        ),
        changes: z.array(z.strictObject({ label: z.string(), path: z.string() })),
      }),
    )
    .optional(),
  schedules: z
    .array(
      z.strictObject({
        id,
        instanceId: id,
        name: z.string(),
        cadence: cadenceSchema,
        overlap: overlapSchema,
        pause: z.object({ pausedBy: id, pausedAt: z.string(), reason: z.string() }).nullable(),
        createdBy: id,
        since: z.string(),
      }),
    )
    .optional(),
  propertyDefinitions: z.array(propertyDefinitionSchema.omit({ isCatalogFact: true })).optional(),
  deletedPropertyKeys: z.array(id).optional(),
  taskRetention: z.strictObject({ days: z.number(), failedDays: z.number() }).optional(),
});
// Data the fake plugins answer from: the catalog's records and the like.
const fakesSchema = z.strictObject({
  // engineRequestPlugins reads placement answers.
  custodyPlacements: objectMap(z.array(id)).optional(),
  // engineRequestPlugins reads the custody fallback rules.
  custodyRules: z
    .array(
      z
        .object({ custodyId: id, documentType: z.string().optional(), projectId: id.optional() })
        .strict(),
    )
    .optional(),
  // engineRequestPlugins reads classification explanations by document type.
  materialLeaves: objectMap(z.strictObject({ categoryId: id, reason: z.string() })).optional(),
  // engineRequestPlugins reads place names for periodical suggestions.
  moravianPlaces: z.array(z.string()).optional(),
  // engineProposalPlugins reads catalog lookup records.
  catalogRecords: z
    .array(
      z
        .object({
          catalogId: id,
          title: z.string(),
          type: z.string(),
          units: z.array(z.string()).nullable(),
          identifiers: z.array(z.string()),
          shelfMarks: z.record(z.string(), z.string().nullable()),
          barcodes: z.record(z.string(), z.string().nullable()),
        })
        .strict(),
    )
    .optional(),
  // engineProposalPlugins reads catalog record prefixes and OPAC links.
  catalogBases: objectMap(z.strictObject({ base: z.string(), opacUrl: z.url() })).optional(),
  // frontend/src/mocks/catalog.ts reads the mock catalog adapter's link name.
  catalogAdapter: z.strictObject({ name: z.string() }).optional(),
  // frontend/src/mocks/catalog.ts reads repairs by catalog ID.
  catalogRepairs: objectMap(z.array(z.string())).optional(),
  // engineProposalPlugins reads the photo reader's returned sample.
  photo: z
    .strictObject({
      seen: z.string(),
      read: z.array(
        z.object({ label: z.string(), value: z.string(), confidence: z.number() }).strict(),
      ),
      best: z.string(),
      near: z.string(),
    })
    .optional(),
  // engineProposalPlugins reads the catalog property source and tier.
  catalogReading: z
    .strictObject({
      source: z.strictObject({
        kind: z.literal("plugin"),
        instanceId: id,
        instanceName: z.string(),
      }),
      tier: z.number(),
    })
    .optional(),
  // BK4g: backend fake plugin answers for documents that have not been seeded as held records.
  ingest: objectMap(
    z.strictObject({
      registryRecords: z
        .array(
          z.strictObject({
            instanceId: id,
            identifiers: z.array(z.string()),
            rawState: z.string(),
            link: z.string().nullable(),
          }),
        )
        .optional(),
      properties: z
        .array(
          z.strictObject({
            key: z.string(),
            value: z.unknown(),
            tier: z.number(),
            instanceId: id,
          }),
        )
        .optional(),
      defects: z
        .array(
          z.strictObject({
            instanceId: id,
            rule: z.string(),
            field: z.string(),
            detail: z.string(),
          }),
        )
        .optional(),
      restriction: z
        .strictObject({
          rule: z.string(),
          forbidden: z.boolean(),
          until: z.string().nullable(),
          why: z.string(),
        })
        .nullable()
        .optional(),
      // Each kind is named only when a test seed makes it fail.
      faults: z
        .partialRecord(
          z.enum(["registry", "propertySource", "validation", "restriction", "listGenerator"]),
          z.enum(["unavailable", "malformed", "timeout"]),
        )
        .optional(),
    }),
  ).optional(),
  // frontend/src/mocks/list-generation.ts reads recommendation reasons.
  advisorReasons: objectMap(z.string()).optional(),
  // frontend/src/mocks/messages.ts and watchlist-channels.ts read account handles.
  slackHandles: objectMap(z.string()).optional(),
  // frontend/src/mocks/messages.ts reads the Slack workspace name.
  slackWorkspace: z.string().optional(),
  // engine/src/seed.ts reads these accounts into fake_identity_accounts.
  identityAccounts: objectMap(
    z.array(
      z
        .object({
          externalId: id,
          name: z.string(),
          email: z.string().nullable(),
          emailVerified: z.boolean(),
          claims: z.array(z.string()),
        })
        .strict(),
    ),
  ).optional(),
});
const seedShape = {
  name: z.string().min(1),
  // Child rows append or replace by id; keyed collections and fakes merge by key, with child values winning.
  extends: z.string().optional(),
  now: z.iso.datetime(),
  collections: seedCollections,
  fakes: fakesSchema.optional(),
};
export const seedSchema = z.strictObject(seedShape);
export const seedPatchSchema = z.strictObject({
  name: z.string().min(1).optional(),
  // Child rows append or replace by id; keyed collections and fakes merge by key, with child values winning.
  extends: z.string().optional(),
  now: z.iso.datetime().optional(),
  collections: seedCollections.partial().optional(),
  fakes: fakesSchema.partial().optional(),
});
export type Seed = z.infer<typeof seedSchema>;
