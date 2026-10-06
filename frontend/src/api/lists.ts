// The Digitization Lists resource (view-map.md §2.4): the lists within the caller's reach with
// what is on them, one list with its members and history, the pool a list draws from, and saving
// what the editor built. A list's state and its members' progress are the server's to work out
// from the dates (flows.md L1, L2); the client only shows them. The bare `/lists` stays the
// reference data other views name a list by.

import { z } from "zod";
import { findJson, getJson, postJson, putJson } from "@/api/http";
import { apiRoutes, digitizationListRoute } from "@/api/routes";
import {
  digitizationListSchema,
  documentSchema,
  existingCopySchema,
  iterationSchema,
  statusLogEntrySchema,
} from "@/domain/entities";
import type { ListState } from "@/domain/lists";
import { listStateSchema, memberBlockerSchema } from "@/domain/lists";

// ---------------------------------------------------------------- query

export interface ListQuery {
  readonly search?: string;
  readonly states?: readonly ListState[];
}

export type ListListField = "states";

// Query-string names; the same names address the filter in the page URL.
export const listQueryParams = {
  search: "q",
  states: "state",
} as const satisfies Record<keyof ListQuery, string>;

const listSeparator = ",";

export function toListSearchParams(query: ListQuery): URLSearchParams {
  const params = new URLSearchParams();
  const search = query.search?.trim();
  if (search) {
    params.set(listQueryParams.search, search);
  }

  if (query.states !== undefined && query.states.length > 0) {
    params.set(listQueryParams.states, query.states.join(listSeparator));
  }

  return params;
}

// Unknown or malformed values are dropped, so a stale link still opens the view.
export function parseListSearchParams(params: URLSearchParams): ListQuery {
  const raw = params.get(listQueryParams.states) ?? "";
  const states = raw.split(listSeparator).flatMap((value) => {
    const parsed = listStateSchema.safeParse(value.trim());
    return parsed.success ? [parsed.data] : [];
  });

  return {
    search: params.get(listQueryParams.search)?.trim() || undefined,
    states: states.length === 0 ? undefined : [...new Set(states)],
  };
}

// True when the two name the same filter, however their lists are ordered.
export function isSameListQuery(first: ListQuery, second: ListQuery): boolean {
  const canonical = (query: ListQuery) => {
    const params = toListSearchParams({ ...query, states: query.states?.toSorted() });
    params.sort();
    return params.toString();
  };

  return canonical(first) === canonical(second);
}

// ---------------------------------------------------------------- slices

export const listSliceParams = { cursor: "cursor", limit: "limit" } as const;
export const listSliceSize = 50;
export const maximumListSliceSize = 200;

export function parseListSliceParams(params: URLSearchParams): {
  cursor: string | null;
  limit: number;
} {
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(maximumListSliceSize)
    .safeParse(params.get(listSliceParams.limit) ?? undefined);
  return {
    cursor: params.get(listSliceParams.cursor) || null,
    limit: limit.success ? limit.data : listSliceSize,
  };
}

// ---------------------------------------------------------------- responses

function facetCountsOf<Value extends z.ZodType>(value: Value) {
  return z.array(z.object({ value, count: z.number().int() }));
}

const count = z.number().int().nonnegative();

// One list as the browse rows and the pane's head read it. Pages are each member's page count
// in use (document-properties.md §4); a member without one counts nothing.
export const listRowSchema = z.object({
  list: digitizationListSchema,
  state: listStateSchema,
  // Past its end and not marked Done.
  isOverdue: z.boolean(),
  itemCount: count,
  pages: count,
  // Digitized or published: what was delivered.
  scannedItemCount: count,
  scannedPages: count,
  // Members a gate stopped after listing (flows.md L11).
  blockedCount: count,
  // Members with a copy elsewhere that appeared after approval (flows.md L17).
  lateCopyCount: count,
  // Scanned members a new defect holds in review (flows.md P2).
  reviewNeededCount: count,
  notDigitizableCount: count,
  cancelledCount: count,
});
export type ListRow = z.infer<typeof listRowSchema>;

// An iteration as a list or the pool shows it: on a list, or one it could take.
export const listItemSchema = z.object({
  iteration: iterationSchema,
  document: documentSchema,
  pages: count.nullable(),
  // When its originating request was made: the fair tie-break after priority.
  askedAt: z.iso.datetime(),
  blocker: memberBlockerSchema.nullable(),
  // A copy that appeared after approval: nobody decided over it.
  lateCopy: existingCopySchema.nullable(),
});
export type ListItem = z.infer<typeof listItemSchema>;

export const listPageSchema = z.object({
  items: z.array(listRowSchema),
  // Rows matching the whole filter.
  total: z.number().int(),
  nextCursor: z.string().nullable(),
  facets: z.object({ states: facetCountsOf(listStateSchema) }),
});
export type ListPage = z.infer<typeof listPageSchema>;

export const listDetailSchema = z.object({
  row: listRowSchema,
  // Highest priority first, then the oldest ask.
  members: z.array(listItemSchema),
  // Newest first.
  log: z.array(statusLogEntrySchema),
});
export type ListDetail = z.infer<typeof listDetailSchema>;

// ---------------------------------------------------------------- the pool

// Every gate passed, Ready and on no list (status-model.md §3). A category matches its subtree.
export interface PoolQuery {
  readonly search?: string;
  readonly categoryId?: string;
}

export const poolQueryParams = { search: "q", categoryId: "category" } as const satisfies Record<
  keyof PoolQuery,
  string
>;

export function toPoolSearchParams(query: PoolQuery): URLSearchParams {
  const params = new URLSearchParams();
  const search = query.search?.trim();
  if (search) {
    params.set(poolQueryParams.search, search);
  }

  if (query.categoryId) {
    params.set(poolQueryParams.categoryId, query.categoryId);
  }

  return params;
}

export function parsePoolSearchParams(params: URLSearchParams): PoolQuery {
  return {
    search: params.get(poolQueryParams.search)?.trim() || undefined,
    categoryId: params.get(poolQueryParams.categoryId) || undefined,
  };
}

export const poolPageSchema = z.object({
  items: z.array(listItemSchema),
  // Matching the whole filter: how many, and their pages.
  total: z.number().int(),
  pages: count,
  nextCursor: z.string().nullable(),
  // What review still holds back, so a short pool explains itself (decided 2026-09-26): approved
  // items a defect holds, by top-level category, and documents nobody has decided on yet.
  inReview: z.array(z.object({ categoryId: z.string(), itemCount: count, pages: count })),
  undecidedCount: count,
  // Ready but cancelled: not offered until someone resumes it.
  cancelledCount: count,
});
export type PoolPage = z.infer<typeof poolPageSchema>;

// ---------------------------------------------------------------- saving

// What the editor saves, the whole of it at once: the members are the set as it should be.
// No start date means it starts now.
export const listDraftSchema = z
  .object({
    name: z.string().trim().min(1, "Name the list"),
    startsOn: z.iso.date().nullable(),
    endsOn: z.iso.date(),
    targetPages: z.number().int().positive().nullable(),
    memberIds: z.array(z.string().min(1)),
  })
  .refine((draft) => draft.startsOn === null || draft.endsOn >= draft.startsOn, {
    message: "It cannot end before it starts",
    path: ["endsOn"],
  });
export type ListDraft = z.infer<typeof listDraftSchema>;

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

export async function createList(draft: ListDraft): Promise<ListDetail> {
  return postJson(apiRoutes.digitizationLists, draft, listDetailSchema);
}

export async function saveList(listId: string, draft: ListDraft): Promise<ListDetail> {
  return putJson(digitizationListRoute(listId), draft, listDetailSchema);
}
