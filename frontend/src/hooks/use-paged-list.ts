// A list that arrives a slice at a time (component-interfaces.md §9.3). The first slice also
// carries what describes the whole list: its totals, groups and facet counts. A new query keeps
// the previous rows on screen until its first slice answers.

import type { QueryKey } from "@tanstack/react-query";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

export interface Slice<Item> {
  readonly items: readonly Item[];
  // Null on the last slice.
  readonly nextCursor: string | null;
}

// What a list needs to ask for its next slice.
export interface PagedList {
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

export interface PagedListResult<Page extends Slice<unknown>> {
  // Every loaded slice, in order, for what each carries beside its rows (group headers).
  slices: readonly Page[] | undefined;
  // The first slice, which describes the whole list.
  summary: Page | undefined;
  items: Page["items"][number][] | undefined;
  paging: PagedList;
  isLoading: boolean;
  // True while the rows on screen are the previous query's.
  isPlaceholderData: boolean;
}

export function usePagedList<Page extends Slice<unknown>>(
  queryKey: QueryKey,
  fetchSlice: (cursor: string | null) => Promise<Page>,
): PagedListResult<Page> {
  const list = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchSlice(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
  });
  const slices = list.data?.pages;

  const onLoadMore = () => {
    if (list.hasNextPage && !list.isFetchingNextPage) {
      void list.fetchNextPage();
    }
  };

  return {
    slices,
    summary: slices?.[0],
    items: slices?.flatMap((slice) => slice.items),
    paging: { hasMore: list.hasNextPage, isLoadingMore: list.isFetchingNextPage, onLoadMore },
    isLoading: list.isLoading,
    isPlaceholderData: list.isPlaceholderData,
  };
}
