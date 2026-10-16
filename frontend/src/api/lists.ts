// Calls the lists endpoints; what they take and answer is in @vera/contract/lists.

import type {
  DeletionDryRun,
  GenerationDraft,
  GenerationRequest,
  ListDetail,
  ListDraft,
  ListGenerator,
  ListPage,
  ListQuery,
  ListReading,
  ListReadingRequest,
  ListShape,
  MarkDoneDryRun,
  NotDigitizableRequest,
  PoolPage,
  PoolQuery,
} from "@vera/contract/lists";
import {
  deletionDryRunSchema,
  generationDraftSchema,
  listDetailSchema,
  listGeneratorSchema,
  listPageSchema,
  listReadingSchema,
  listShapeSchema,
  listSliceParams,
  listSliceSize,
  markDoneDryRunSchema,
  poolPageSchema,
  toListSearchParams,
  toPoolSearchParams,
} from "@vera/contract/lists";
import {
  apiRoutes,
  digitizationListMemberRoute,
  digitizationListRoute,
} from "@vera/contract/routes";
import { z } from "zod";
import { deleteResource, findJson, getJson, postJson, putJson } from "@/api/http";

// ---------------------------------------------------------------- calls

interface SliceOptions {
  readonly cursor?: string | null;
  readonly limit?: number;
}

function withSlice(
  params: URLSearchParams,
  { cursor = null, limit = listSliceSize }: SliceOptions,
) {
  if (cursor !== null) {
    params.set(listSliceParams.cursor, cursor);
  }

  params.set(listSliceParams.limit, String(limit));
  return params;
}

export async function listLists(query: ListQuery, slice: SliceOptions = {}): Promise<ListPage> {
  return getJson(
    apiRoutes.digitizationLists,
    listPageSchema,
    withSlice(toListSearchParams(query), slice),
  );
}

// Null when the list does not exist or lies outside the caller's reach.
export async function findList(listId: string): Promise<ListDetail | null> {
  return findJson(digitizationListRoute(listId), listDetailSchema);
}

export async function listPool(query: PoolQuery, slice: SliceOptions = {}): Promise<PoolPage> {
  return getJson(
    apiRoutes.digitizationListPool,
    poolPageSchema,
    withSlice(toPoolSearchParams(query), slice),
  );
}

export async function listGenerators(): Promise<ListGenerator[]> {
  return getJson(apiRoutes.listGenerators, z.array(listGeneratorSchema));
}

export async function listShapes(): Promise<ListShape[]> {
  return getJson(apiRoutes.listShapes, z.array(listShapeSchema));
}

export async function readList(request: ListReadingRequest): Promise<ListReading> {
  return postJson(apiRoutes.listReading, request, listReadingSchema);
}

export async function generateDraft(request: GenerationRequest): Promise<GenerationDraft> {
  return postJson(apiRoutes.listGeneration, request, generationDraftSchema);
}

export async function createList(draft: ListDraft): Promise<ListDetail> {
  return postJson(apiRoutes.digitizationLists, draft, listDetailSchema);
}

export async function saveList(listId: string, draft: ListDraft): Promise<ListDetail> {
  return putJson(digitizationListRoute(listId), draft, listDetailSchema);
}

// A Planned list started early: its start date becomes today (ACT-list-start, LC-LIST-start-now).
export async function startList(listId: string): Promise<ListDetail> {
  return postJson(`${digitizationListRoute(listId)}/start`, {}, listDetailSchema);
}

export async function previewMarkDone(listId: string): Promise<MarkDoneDryRun> {
  return getJson(`${digitizationListRoute(listId)}/done`, markDoneDryRunSchema);
}

export async function markDone(listId: string): Promise<ListDetail> {
  return postJson(`${digitizationListRoute(listId)}/done`, {}, listDetailSchema);
}

export async function previewDeletion(listId: string): Promise<DeletionDryRun> {
  return getJson(`${digitizationListRoute(listId)}/deletion`, deletionDryRunSchema);
}

export async function deleteList(listId: string): Promise<void> {
  return deleteResource(digitizationListRoute(listId));
}

export async function markNotDigitizable(
  listId: string,
  iterationId: string,
  request: NotDigitizableRequest,
): Promise<ListDetail> {
  return postJson(
    `${digitizationListMemberRoute(listId, iterationId)}/not-digitizable`,
    request,
    listDetailSchema,
  );
}
