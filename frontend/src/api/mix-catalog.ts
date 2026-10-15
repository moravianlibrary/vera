// Independent mixes: proportions, revisions, snapshots, Primary designation and lifecycle.

import { z } from "zod";
import { getJson, postJson, putJson } from "@/api/http";
import { apiRoutes, mixRoute } from "@/api/routes";
import { distributionSchema } from "@/domain/entities";

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

export async function listMixes(): Promise<MixRecord[]> {
  return getJson(apiRoutes.mixes, z.array(mixRecordSchema));
}

export async function getMix(mixId: string): Promise<MixRecord> {
  return getJson(mixRoute(mixId), mixRecordSchema);
}

export async function createMix(draft: MixDraft): Promise<MixRecord> {
  return postJson(apiRoutes.mixes, draft, mixRecordSchema);
}

export async function saveMixSetById(mixId: string, change: MixSetChange): Promise<MixRecord> {
  return putJson(`${mixRoute(mixId)}/sets`, change, mixRecordSchema);
}

export async function snapshotMix(mixId: string, draft: MixSnapshotDraft): Promise<MixRecord> {
  return postJson(`${mixRoute(mixId)}/snapshots`, draft, mixRecordSchema);
}

export async function makePrimaryMix(mixId: string): Promise<MixRecord> {
  return postJson(`${mixRoute(mixId)}/primary`, {}, mixRecordSchema);
}

export async function archiveMix(mixId: string): Promise<MixRecord> {
  return postJson(`${mixRoute(mixId)}/archive`, {}, mixRecordSchema);
}
