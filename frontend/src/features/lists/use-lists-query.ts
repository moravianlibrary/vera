// Digitization lists within the caller's reach, a slice at a time, one list with its members,
// and the pool's size for whoever builds lists. Saving a list moves items in and out of the pool
// and changes what Documents shows of them, so it refetches all three.

import { skipToken, useQuery } from "@tanstack/react-query";
import type { ListQuery, PoolQuery } from "@/api/lists";
import { findList, listLists, listPool } from "@/api/lists";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { usePagedList } from "@/hooks/use-paged-list";

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

// What saving or acting on a list changes.
export const listInvalidations = [listsQueryKey, documentsQueryKey];
