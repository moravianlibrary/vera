// Watchlists: saved filters over one view (filtering.md §4, §5), the caller's own and the shared
// ones whose audience reaches them. A listed watchlist carries how many records match it now,
// whether the caller may change it, and the caller's own row for it (seen, place, delivery),
// since those are each person's even on a shared one. Two watchlists on one view with the same
// filter are the same watchlist, whatever their names or audiences, and the server keeps only one
// of them among those a caller sees, except an explicit personal copy of a system one; sharing one that reaches somebody who keeps the same filter
// warns instead (decided 2026-10-06), which is what the reach says before it is saved.

import type { Watchlist, WatchlistView } from "@vera/domain/entities";
import { watchlistAudienceSchema, watchlistSchema } from "@vera/domain/entities";
import { z } from "zod";
import { isSameCategoryQuery, parseCategorySearchParams } from "./categories";
import { isSameDocumentQuery, parseDocumentSearchParams } from "./documents";
import { isSameIntentionsQuery, parseIntentionsSearchParams } from "./intention-filters";
import { isSameListQuery, parseListSearchParams } from "./lists";
import { isSameMixQuery, parseMixSearchParams } from "./mix-filters";
import { isSameProjectQuery, parseProjectSearchParams } from "./projects";
import { isSameRequestQuery, parseRequestSearchParams } from "./requests";
import { isSameRunQuery, parseRunSearchParams } from "./tasks";
import { isSameValidationQuery, parseValidationSearchParams } from "./validations";

// Some groups and roles means at least one of either.
const audienceSchema = watchlistAudienceSchema.refine(
  (audience) => audience.kind !== "some" || audience.groupIds.length + audience.roleIds.length > 0,
  "Pick a group or a role",
);

export const watchlistDraftSchema = watchlistSchema
  .pick({ names: true, view: true, filter: true })
  .extend({ audience: audienceSchema, copyOf: z.string().optional() });

export type WatchlistDraft = z.infer<typeof watchlistDraftSchema>;

// An audience change updates who a system watchlist reaches. Changing between personal and
// system requires creating a separate copy.
export const watchlistChangeSchema = watchlistDraftSchema
  .pick({ names: true, audience: true, filter: true })
  .partial();

export type WatchlistChange = z.infer<typeof watchlistChangeSchema>;

export const watchlistChangeResponseSchema = watchlistSchema.extend({
  filterVersion: z.number().int().positive(),
});

// WATCH-delivery: every enabled Delivery channel instance that can reach a person, named by the
// instance's name even when it is the only one of its kind; browser push is VERA's own.
export const pushChannelId = "push";

export const watchlistChannelSchema = z.object({
  // The instance's id.
  id: z.string(),
  name: z.string(),
  // How it reaches the person (PLG-declares): the account's email, or a handle from a claim.
  reach: z.discriminatedUnion("by", [
    z.object({ by: z.literal("email") }),
    z.object({ by: z.literal("claim"), claim: z.string() }),
  ]),
  // Whether it can reach this person: an email on the account, or the claim at their last login.
  canReach: z.boolean(),
});

export type WatchlistChannel = z.infer<typeof watchlistChannelSchema>;

// One channel on one watchlist: off until switched on, and what entered since then.
export const viewerChannelSchema = z.object({
  isOn: z.boolean(),
  since: z.iso.datetime().nullable(),
});

// What is the person's own about a watchlist they see (filtering.md §5 `watchlist_viewer`).
export const watchlistViewerSchema = z.object({
  seenAt: z.iso.datetime().nullable(),
  position: z.number().int().nonnegative(),
  // WATCH-delivery: on for every watchlist, pushed once the person allows the site's
  // notifications in a browser.
  push: z.boolean().default(true),
  pushSince: z.iso.datetime().nullable().default(null),
  // By channel instance id; a channel absent here is off.
  channels: z.record(z.string(), viewerChannelSchema).default({}),
  confirmedFilter: z.string().nullable().default(null),
});

export type WatchlistViewer = z.infer<typeof watchlistViewerSchema>;

export const watchlistViewerChangeSchema = watchlistViewerSchema
  .pick({
    position: true,
    push: true,
    confirmedFilter: true,
  })
  .extend({
    // The channels it switches, by instance id; the others stay as they are.
    channels: z.record(z.string(), z.boolean()),
  })
  .partial();

export type WatchlistViewerChange = z.infer<typeof watchlistViewerChangeSchema>;

export function isChannelOn(viewer: WatchlistViewer, channelId: string): boolean {
  return viewer.channels[channelId]?.isOn === true;
}

export const watchlistSummarySchema = watchlistSchema.extend({
  itemCount: z.number().int().nonnegative(),
  newCount: z.number().int().nonnegative(),
  createdBy: z.string(),
  subscriberCount: z.number().int().nonnegative(),
  filterVersion: z.number().int().positive(),
  isEditable: z.boolean(),
  viewer: watchlistViewerSchema,
});

export type WatchlistSummary = z.infer<typeof watchlistSummarySchema>;

export const watchlistViewParam = "view";

export const watchlistModeParam = "mode";

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
  "my-documents": (first, second) =>
    isSameDocumentQuery(
      parseDocumentSearchParams(new URLSearchParams(first)),
      parseDocumentSearchParams(new URLSearchParams(second)),
    ),
  requests: (first, second) =>
    isSameRequestQuery(
      parseRequestSearchParams(new URLSearchParams(first)),
      parseRequestSearchParams(new URLSearchParams(second)),
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
  mixes: (first, second) =>
    isSameMixQuery(
      parseMixSearchParams(new URLSearchParams(first)),
      parseMixSearchParams(new URLSearchParams(second)),
    ),
  intentions: (first, second) =>
    isSameIntentionsQuery(
      parseIntentionsSearchParams(new URLSearchParams(first)),
      parseIntentionsSearchParams(new URLSearchParams(second)),
    ),
  tasks: (first, second) =>
    isSameRunQuery(
      parseRunSearchParams(new URLSearchParams(first)),
      parseRunSearchParams(new URLSearchParams(second)),
    ),
} as const satisfies Record<WatchlistView, (first: Filter, second: Filter) => boolean>;

// True when the two filters of the view select the same records, however they are written.
export function isSameWatchlistFilter(view: WatchlistView, first: Filter, second: Filter): boolean {
  return filterComparers[view](first, second);
}
