// Watchlists: saved filters over one view (filtering.md §4), the caller's own and the shared ones
// on the view. A listed watchlist carries how many records match it now and whether the caller
// may change it. Two watchlists on one view with the same filter are the same watchlist, whatever
// their names or scopes, and the server keeps only one of them among those a caller sees.

import { z } from "zod";
import { isSameDocumentQuery, parseDocumentSearchParams } from "@/api/documents";
import { deleteResource, getJson, patchJson, postJson } from "@/api/http";
import { isSameProposalQuery, parseProposalSearchParams } from "@/api/proposal-review";
import { apiRoutes, watchlistRoute } from "@/api/routes";
import { isSameValidationQuery, parseValidationSearchParams } from "@/api/validations";
import type { Watchlist, WatchlistView } from "@/domain/entities";
import { watchlistSchema } from "@/domain/entities";

export const watchlistDraftSchema = watchlistSchema.pick({
  name: true,
  view: true,
  scope: true,
  filter: true,
});
export type WatchlistDraft = z.infer<typeof watchlistDraftSchema>;

// A scope change shares a personal watchlist or takes a shared one back as the caller's own.
export const watchlistChangeSchema = watchlistDraftSchema
  .pick({ name: true, scope: true, filter: true })
  .partial();
export type WatchlistChange = z.infer<typeof watchlistChangeSchema>;

export const watchlistSummarySchema = watchlistSchema.extend({
  itemCount: z.number().int().nonnegative(),
  isEditable: z.boolean(),
});
export type WatchlistSummary = z.infer<typeof watchlistSummarySchema>;

export const watchlistViewParam = "view";

type Filter = Watchlist["filter"];

const filterComparers = {
  documents: (first, second) =>
    isSameDocumentQuery(
      parseDocumentSearchParams(new URLSearchParams(first)),
      parseDocumentSearchParams(new URLSearchParams(second)),
    ),
  proposals: (first, second) =>
    isSameProposalQuery(
      parseProposalSearchParams(new URLSearchParams(first)),
      parseProposalSearchParams(new URLSearchParams(second)),
    ),
  validations: (first, second) =>
    isSameValidationQuery(
      parseValidationSearchParams(new URLSearchParams(first)),
      parseValidationSearchParams(new URLSearchParams(second)),
    ),
} as const satisfies Record<WatchlistView, (first: Filter, second: Filter) => boolean>;

// True when the two filters of the view select the same records, however they are written.
export function isSameWatchlistFilter(view: WatchlistView, first: Filter, second: Filter): boolean {
  return filterComparers[view](first, second);
}

// Shared first, then the caller's own, each oldest first. Every view's when no view is named.
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
