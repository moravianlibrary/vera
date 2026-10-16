// Calls the watchlists endpoints; what they take and answer is in @vera/contract/watchlists.

import {
  apiRoutes,
  watchlistRoute,
  watchlistSeenRoute,
  watchlistViewerRoute,
} from "@vera/contract/routes";
import type {
  WatchlistChange,
  WatchlistChannel,
  WatchlistDraft,
  WatchlistReach,
  WatchlistReachRequest,
  WatchlistSummary,
  WatchlistViewer,
  WatchlistViewerChange,
} from "@vera/contract/watchlists";
import {
  watchlistChannelSchema,
  watchlistModeParam,
  watchlistReachSchema,
  watchlistSummarySchema,
  watchlistViewerSchema,
  watchlistViewParam,
} from "@vera/contract/watchlists";
import type { Watchlist, WatchlistView } from "@vera/domain/entities";
import { watchlistSchema } from "@vera/domain/entities";
import { z } from "zod";
import { deleteResource, getJson, patchJson, postJson } from "@/api/http";

export async function listWatchlistChannels(): Promise<WatchlistChannel[]> {
  return getJson(apiRoutes.watchlistChannels, z.array(watchlistChannelSchema));
}

// Shared first, then the caller's own, each oldest first. Every view's when no view is named.
export async function listWatchlists(
  view?: WatchlistView,
  mode: "visible" | "manage-system" = "visible",
): Promise<WatchlistSummary[]> {
  const params = new URLSearchParams();
  if (view !== undefined) {
    params.set(watchlistViewParam, view);
  }
  if (mode === "manage-system") params.set(watchlistModeParam, mode);

  return getJson(apiRoutes.watchlists, z.array(watchlistSummarySchema), params);
}

export async function createWatchlist(draft: WatchlistDraft): Promise<Watchlist> {
  return postJson(apiRoutes.watchlists, draft, watchlistSchema);
}

export async function updateWatchlist(
  watchlistId: string,
  change: WatchlistChange,
): Promise<Watchlist> {
  return patchJson(watchlistRoute(watchlistId), change, watchlistSchema);
}

export async function getWatchlistReach(request: WatchlistReachRequest): Promise<WatchlistReach> {
  return postJson(apiRoutes.watchlistReach, request, watchlistReachSchema);
}

export async function deleteWatchlist(watchlistId: string): Promise<void> {
  return deleteResource(watchlistRoute(watchlistId));
}

export async function updateWatchlistViewer(
  watchlistId: string,
  change: WatchlistViewerChange,
): Promise<WatchlistViewer> {
  return patchJson(watchlistViewerRoute(watchlistId), change, watchlistViewerSchema);
}

export async function markWatchlistSeen(watchlistId: string): Promise<WatchlistViewer> {
  return postJson(watchlistSeenRoute(watchlistId), {}, watchlistViewerSchema);
}
