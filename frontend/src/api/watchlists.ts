// Watchlists: saved filters over one view (filtering.md §4, §5), the caller's own and the shared
// ones whose audience reaches them. A listed watchlist carries how many records match it now,
// whether the caller may change it, and the caller's own row for it (seen, badge, hidden, place),
// since those are each person's even on a shared one. Two watchlists on one view with the same
// filter are the same watchlist, whatever their names or audiences, and the server keeps only one
// of them among those a caller sees; sharing one that reaches somebody who keeps the same filter
// warns instead (decided 2026-10-06), which is what the reach says before it is saved.

import { z } from "zod";
import { isSameCategoryQuery, parseCategorySearchParams } from "@/api/categories";
import { isSameDocumentQuery, parseDocumentSearchParams } from "@/api/documents";
import { deleteResource, getJson, patchJson, postJson } from "@/api/http";
import { isSameListQuery, parseListSearchParams } from "@/api/lists";
import { isSameProjectQuery, parseProjectSearchParams } from "@/api/projects";
import { isSameProposalQuery, parseProposalSearchParams } from "@/api/proposal-review";
import { apiRoutes, watchlistRoute } from "@/api/routes";
import { isSameValidationQuery, parseValidationSearchParams } from "@/api/validations";
import type { Watchlist, WatchlistView } from "@/domain/entities";
import { watchlistAudienceSchema, watchlistSchema } from "@/domain/entities";

// Some groups and roles means at least one of either.
const audienceSchema = watchlistAudienceSchema.refine(
  (audience) => audience.kind !== "some" || audience.groupIds.length + audience.roleIds.length > 0,
  "Pick a group or a role",
);

export const watchlistDraftSchema = watchlistSchema
  .pick({ name: true, view: true, filter: true })
  .extend({ audience: audienceSchema });
export type WatchlistDraft = z.infer<typeof watchlistDraftSchema>;

// An audience change shares a personal watchlist, changes who a shared one reaches, or takes it
// back as the caller's own.
export const watchlistChangeSchema = watchlistDraftSchema
  .pick({ name: true, audience: true, filter: true })
  .partial();
export type WatchlistChange = z.infer<typeof watchlistChangeSchema>;

// What is the person's own about a watchlist they see (filtering.md §5 `watchlist_viewer`).
export const watchlistViewerSchema = z.object({
  seenAt: z.iso.datetime().nullable(),
  hasBadge: z.boolean(),
  // Shared ones only: hidden from their tabs, kept in Preferences.
  isHidden: z.boolean(),
  position: z.number().int().nonnegative(),
});
export type WatchlistViewer = z.infer<typeof watchlistViewerSchema>;

export const watchlistSummarySchema = watchlistSchema.extend({
  itemCount: z.number().int().nonnegative(),
  isEditable: z.boolean(),
  viewer: watchlistViewerSchema,
});
export type WatchlistSummary = z.infer<typeof watchlistSummarySchema>;

export const watchlistViewParam = "view";

// Who an audience would reach for a watchlist, before it is saved: the people who would see it,
// those in the audience who cannot open the view, and how many of the reached already keep the
// same filter as their own.
export const watchlistReachRequestSchema = watchlistDraftSchema
  .pick({ view: true, filter: true, audience: true })
  .extend({ watchlistId: z.string().nullable() });
export type WatchlistReachRequest = z.infer<typeof watchlistReachRequestSchema>;

export const watchlistReachSchema = z.object({
  userCount: z.number().int().nonnegative(),
  outOfViewCount: z.number().int().nonnegative(),
  duplicateCount: z.number().int().nonnegative(),
});
export type WatchlistReach = z.infer<typeof watchlistReachSchema>;

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
  lists: (first, second) =>
    isSameListQuery(
      parseListSearchParams(new URLSearchParams(first)),
      parseListSearchParams(new URLSearchParams(second)),
    ),
  projects: (first, second) =>
    isSameProjectQuery(
      parseProjectSearchParams(new URLSearchParams(first)),
      parseProjectSearchParams(new URLSearchParams(second)),
    ),
  categories: (first, second) =>
    isSameCategoryQuery(
      parseCategorySearchParams(new URLSearchParams(first)),
      parseCategorySearchParams(new URLSearchParams(second)),
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

export async function getWatchlistReach(request: WatchlistReachRequest): Promise<WatchlistReach> {
  return postJson(apiRoutes.watchlistReach, request, watchlistReachSchema);
}

export async function deleteWatchlist(watchlistId: string): Promise<void> {
  return deleteResource(watchlistRoute(watchlistId));
}
