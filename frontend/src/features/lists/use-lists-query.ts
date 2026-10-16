// Digitization lists within the caller's reach, a slice at a time, one list with its members,
// and the pool's size, the generators and the intentions to shape by for whoever builds lists.
// Saving a list moves items in and out of the pool, changes what Documents shows of them and
// what intentions count, so it refetches all of them.

import { skipToken, useQuery } from "@tanstack/react-query";
import type { ListQuery, ListReadingRequest, PoolQuery } from "@vera/contract/lists";
import { findList, listGenerators, listLists, listPool, listShapes, readList } from "@/api/lists";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { intentionsQueryKey } from "@/features/intentions/use-intentions-query";
import { usePagedList } from "@/hooks/use-paged-list";
import { watchlistsQueryKey } from "@/hooks/use-watchlists-query";

export const listsQueryKey = ["lists"] as const;

export function useListsQuery(query: ListQuery) {
  return usePagedList([...listsQueryKey, "list", query], (cursor) => listLists(query, { cursor }));
}

export function useListQuery(listId: string | null) {
  return useQuery({
    queryKey: [...listsQueryKey, "detail", listId],
    queryFn: listId === null ? skipToken : () => findList(listId),
  });
}

// What a list can take, a slice at a time.
export function usePoolQuery(query: PoolQuery) {
  return usePagedList([...listsQueryKey, "pool", query], (cursor) => listPool(query, { cursor }));
}

// Only its totals: how much is ready to list.
export function usePoolSizeQuery(isEnabled: boolean) {
  return useQuery({
    queryKey: [...listsQueryKey, "poolSize"],
    queryFn: isEnabled ? () => listPool({}, { limit: 1 }) : skipToken,
    select: (pool) => ({ total: pool.total, pages: pool.pages }),
  });
}

// The list generators running; none means no Generate. Only whoever builds lists may ask.
export function useListGeneratorsQuery({ isEnabled = true }: { isEnabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...listsQueryKey, "generators"],
    queryFn: isEnabled ? listGenerators : skipToken,
  });
}

// The intentions a draft can be shaped by.
export function useListShapesQuery() {
  return useQuery({ queryKey: [...listsQueryKey, "shapes"], queryFn: listShapes });
}

// What a draft counts towards and its fill against a mix, as the editor changes it; the last
// answer stays while the next is asked.
export function useListReadingQuery(request: ListReadingRequest) {
  return useQuery({
    queryKey: [...listsQueryKey, "reading", request],
    queryFn: () => readList(request),
    placeholderData: (previous) => previous,
  });
}

// What saving or acting on a list changes: what is on it moves in Documents, and the
// intentions it counts towards count it.
export const listInvalidations = [
  listsQueryKey,
  documentsQueryKey,
  intentionsQueryKey,
  watchlistsQueryKey,
];
