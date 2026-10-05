// Watchlists: saved filters over one view, kept on the account (filtering.md §4). A listed
// watchlist carries how many records match it now.

import { z } from "zod";
import { deleteResource, getJson, patchJson, postJson } from "@/api/http";
import { apiRoutes, watchlistRoute } from "@/api/routes";
import type { Watchlist, WatchlistView } from "@/domain/entities";
import { watchlistSchema } from "@/domain/entities";

export const watchlistDraftSchema = watchlistSchema.pick({ name: true, view: true, filter: true });
export type WatchlistDraft = z.infer<typeof watchlistDraftSchema>;

export const watchlistChangeSchema = watchlistDraftSchema
  .pick({ name: true, filter: true })
  .partial();
export type WatchlistChange = z.infer<typeof watchlistChangeSchema>;

export const watchlistSummarySchema = watchlistSchema.extend({
  itemCount: z.number().int().nonnegative(),
});
export type WatchlistSummary = z.infer<typeof watchlistSummarySchema>;

export const watchlistViewParam = "view";

// Oldest first, the order they were saved in. Every view's when no view is named.
export async function listWatchlists(view?: WatchlistView): Promise<WatchlistSummary[]> {
  const params = new URLSearchParams();
  if (view !== undefined) {
    params.set(watchlistViewParam, view);
  }

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

export async function deleteWatchlist(watchlistId: string): Promise<void> {
  return deleteResource(watchlistRoute(watchlistId));
}
