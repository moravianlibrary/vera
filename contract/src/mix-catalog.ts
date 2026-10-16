// Independent mixes: proportions, revisions, snapshots, Primary designation and lifecycle.

import { distributionSchema } from "@vera/domain/entities";
import { z } from "zod";

export const mixRecordSchema = distributionSchema.extend({
  usageCount: z.number().int().nonnegative(),
  followers: z.array(z.object({ id: z.string(), name: z.string(), isArchived: z.boolean() })),
});

export type MixRecord = z.infer<typeof mixRecordSchema>;

export const mixDraftSchema = z.object({
  name: z.string().trim().min(1),
  fromMixId: z.string().nullable(),
  fromRevision: z.number().int().positive().nullable(),
});

export type MixDraft = z.infer<typeof mixDraftSchema>;

export const mixSetChangeSchema = z.object({
  parentId: z.string().nullable(),
  shares: z.record(z.string(), z.number().min(0).max(100).nullable()),
  revision: z.number().int().positive(),
});

export type MixSetChange = z.infer<typeof mixSetChangeSchema>;

export const mixSnapshotDraftSchema = z.object({
  revision: z.number().int().positive(),
  label: z.string().trim().min(1),
});

export type MixSnapshotDraft = z.infer<typeof mixSnapshotDraftSchema>;
