// The tab a view was last left on, per person and per view, so the view reopens where they
// work: a curator who reviews from "Awaiting a decision" lands there, one who browses lands on
// "All" (filtering.md §4.2). Kept with the person's settings on the server, so it follows them
// to another device.
// TODO(rrandiak): a fixed opening tab per view, chosen in Preferences → Display.

import type { WatchlistView } from "@/domain/entities";
import { useUserSettingsMutation, useUserSettingsQuery } from "@/hooks/use-user-settings-query";

export function useRememberedWatchlist(view: WatchlistView) {
  const { data: settings, isPending } = useUserSettingsQuery();
  const { mutate } = useUserSettingsMutation();

  return {
    // False until the settings have answered, or failed to.
    isSettled: !isPending,
    // The watchlist to reopen, null for "All", undefined when there is nothing to go on.
    rememberedId: settings?.lastOpenedWatchlists[view],
    remember: (watchlistId: string | null) =>
      mutate({ lastOpenedWatchlists: { [view]: watchlistId } }),
  };
}
