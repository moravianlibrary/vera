// The caller's watchlists on one view, and the changes to them. A change refetches every
// watchlist query, since the counts are the server's to recompute.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WatchlistChange, WatchlistViewerChange } from "@vera/contract/watchlists";
import type { WatchlistView } from "@vera/domain/entities";
import {
  createWatchlist,
  deleteWatchlist,
  listWatchlists,
  markWatchlistSeen,
  updateWatchlist,
  updateWatchlistViewer,
} from "@/api/watchlists";

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
    updateViewer: useMutation({
      mutationFn: ({
        watchlistId,
        change,
      }: {
        watchlistId: string;
        change: WatchlistViewerChange;
      }) => updateWatchlistViewer(watchlistId, change),
      onSuccess,
    }),
    markSeen: useMutation({ mutationFn: markWatchlistSeen, onSuccess }),
  };
}
