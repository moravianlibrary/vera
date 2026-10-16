// Calls the mix-catalog endpoints; what they take and answer is in @vera/contract/mix-catalog.

import type {
  MixDraft,
  MixRecord,
  MixSetChange,
  MixSnapshotDraft,
} from "@vera/contract/mix-catalog";
import { mixRecordSchema } from "@vera/contract/mix-catalog";
import { apiRoutes, mixRoute } from "@vera/contract/routes";
import { z } from "zod";
import { getJson, postJson, putJson } from "@/api/http";

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
