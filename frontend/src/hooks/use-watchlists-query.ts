// The caller's watchlists on one view, and the changes to them. A change refetches every
// watchlist query, since the counts are the server's to recompute.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WatchlistChange } from "@/api/watchlists";
import {
  createWatchlist,
  deleteWatchlist,
  listWatchlists,
  updateWatchlist,
} from "@/api/watchlists";
import type { WatchlistView } from "@/domain/entities";

export const watchlistsQueryKey = ["watchlists"] as const;

interface WatchlistsQueryOptions {
  // Off where the caller may not keep watchlists.
  isEnabled?: boolean;
}

export function useWatchlistsQuery(
  view: WatchlistView,
  { isEnabled = true }: WatchlistsQueryOptions = {},
) {
  return useQuery({
    queryKey: [...watchlistsQueryKey, view],
    queryFn: () => listWatchlists(view),
    enabled: isEnabled,
  });
}

export function useWatchlistMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: watchlistsQueryKey });

  return {
    create: useMutation({ mutationFn: createWatchlist, onSuccess }),
    update: useMutation({
      mutationFn: ({ watchlistId, change }: { watchlistId: string; change: WatchlistChange }) =>
        updateWatchlist(watchlistId, change),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: deleteWatchlist, onSuccess }),
  };
}
