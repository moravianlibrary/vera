// What the server does for watchlists (filtering.md §4.5, §5): show each caller their own and the
// shared ones whose audience reaches them, which stops at who may open the view and, on Documents,
// at staff, since a shared lens is drawn over the staff vocabulary; let only those who manage
// shared watchlists share or change a shared one; keep each person's own row for every watchlist
// they see; and count what matches each now by running its filter over its view. A filter is
// saved once among the watchlists a caller sees, so nobody keeps the same lens twice; someone
// else's personal watchlist is out of the caller's sight and never blocks theirs. Sharing warns
// rather than refuses: its reach says how many of the reached already keep the same filter.

import { parseCategorySearchParams } from "@/api/categories";
import { parseDocumentSearchParams } from "@/api/documents";
import { parseListSearchParams } from "@/api/lists";
import { parseProjectSearchParams } from "@/api/projects";
import { parseProposalSearchParams } from "@/api/proposal-review";
import { parseRunSearchParams } from "@/api/tasks";
import { parseValidationSearchParams } from "@/api/validations";
import type {
  WatchlistReach,
  WatchlistReachRequest,
  WatchlistSummary,
  WatchlistViewer,
} from "@/api/watchlists";
import { isSameWatchlistFilter } from "@/api/watchlists";
import { matchingCategoryIds } from "@/domain/category-filters";
import type { Session, Watchlist, WatchlistAudience, WatchlistView } from "@/domain/entities";
import { isShared } from "@/domain/entities";
import { hasPermission } from "@/domain/permissions";
import {
  matchingIntentions,
  parseIntentionsSearchParams,
} from "@/features/intentions/intentions-board-view";
import { canReadCategories, queryCategoryIndex } from "@/mocks/categories";
import type { StoredWatchlist } from "@/mocks/database";
import { database } from "@/mocks/database";
import { audienceOf, queryDocuments } from "@/mocks/documents";
import { canReadIntentions, queryIntentionIndex } from "@/mocks/intentions";
import { canReadLists, queryLists } from "@/mocks/lists";
import { canReadProjects, queryProjectIndex } from "@/mocks/projects";
import { canDecide, queryProposals } from "@/mocks/proposal-review";
import { sessionOf } from "@/mocks/session";
import { canReadRuns, queryRuns } from "@/mocks/tasks";
import { canReview, queryValidations } from "@/mocks/validations";
import { storeWatchlistViewers } from "@/mocks/watchlist-viewer-store";

export function visibleWatchlists(
  session: Session,
  view: WatchlistView | null,
): WatchlistSummary[] {
  return database.watchlists
    .filter((watchlist) => isVisible(session, watchlist))
    .filter((watchlist) => view === null || watchlist.view === view)
    .toSorted((first, second) => Number(isShared(second)) - Number(isShared(first)))
    .map((watchlist) => ({ watchlist, viewer: viewerOf(session.user.id, watchlist) }))
    .toSorted((first, second) => first.viewer.position - second.viewer.position)
    .map(({ watchlist, viewer }) => ({
      ...publicWatchlistOf(watchlist),
      itemCount: itemCountOf(session, watchlist),
      isEditable: canChange(session, watchlist.audience),
      viewer,
    }));
}

export function findVisibleWatchlist(
  session: Session,
  watchlistId: string,
): StoredWatchlist | null {
  return (
    database.watchlists.find(
      (watchlist) => watchlist.id === watchlistId && isVisible(session, watchlist),
    ) ?? null
  );
}

// The watchlist the caller sees on the same view with the same filter, other than the candidate.
export function findDuplicateWatchlist(
  session: Session,
  candidate: Pick<StoredWatchlist, "view" | "filter"> & { id: string | null },
): StoredWatchlist | null {
  return (
    database.watchlists.find(
      (watchlist) =>
        watchlist.id !== candidate.id &&
        watchlist.view === candidate.view &&
        isVisible(session, watchlist) &&
        isSameWatchlistFilter(watchlist.view, watchlist.filter, candidate.filter),
    ) ?? null
  );
}

// Anyone keeps their own; any other audience needs the permission, to set as much as to change.
// A group's members get no right to share with their own group (decided 2026-10-06).
export function canChange(session: Session, audience: WatchlistAudience): boolean {
  if (audience.kind === "personal") {
    return true;
  }

  return hasPermission(session, "watchlist.manage_shared");
}

export function publicWatchlistOf({ ownerId: _ownerId, ...watchlist }: StoredWatchlist): Watchlist {
  return watchlist;
}

// ---------------------------------------------------------------- who it reaches

// Whether the person may open the view at all, with the vocabulary a shared lens is drawn for.
function canOpenView(session: Session, view: WatchlistView): boolean {
  switch (view) {
    case "documents":
      return audienceOf(session) === "staff";
    case "proposals":
      return canDecide(session);
    case "validations":
      return canReview(session);
    case "lists":
      return canReadLists(session);
    case "projects":
      return canReadProjects(session);
    case "categories":
      return canReadCategories(session);
    case "intentions":
      return canReadIntentions(session);
    case "tasks":
      return canReadRuns(session);
  }
}

function isInAudience(session: Session, audience: WatchlistAudience): boolean {
  switch (audience.kind) {
    case "personal":
      return false;
    case "everyone":
      return true;
    case "some":
      return (
        audience.groupIds.some((groupId) => session.groupIds.includes(groupId)) ||
        audience.roleIds.some((roleId) => session.roleIds.includes(roleId))
      );
  }
}

function isVisible(session: Session, watchlist: StoredWatchlist): boolean {
  // Mix-based watchlists cannot be read without permission to see the selected mix.
  if (
    watchlist.view === "categories" &&
    (watchlist.filter.attention !== undefined || watchlist.filter.mix !== undefined) &&
    !hasPermission(session, "intention.read")
  ) {
    return false;
  }

  if (!isShared(watchlist)) {
    return watchlist.ownerId === session.user.id;
  }

  return isInAudience(session, watchlist.audience) && canOpenView(session, watchlist.view);
}

// Everyone an audience names, split by whether they may open the view.
export function audienceReachOf(
  audience: WatchlistAudience,
  view: WatchlistView,
): { reachedIds: string[]; outOfViewIds: string[] } {
  const reachedIds: string[] = [];
  const outOfViewIds: string[] = [];
  for (const user of database.users) {
    const session = sessionOf(user.id);
    if (session === null || !isInAudience(session, audience)) {
      continue;
    }

    (canOpenView(session, view) ? reachedIds : outOfViewIds).push(user.id);
  }

  return { reachedIds, outOfViewIds };
}

export function watchlistReachOf(request: WatchlistReachRequest): WatchlistReach {
  const { reachedIds, outOfViewIds } = audienceReachOf(request.audience, request.view);
  const duplicateCount = reachedIds.filter((userId) =>
    database.watchlists.some(
      (watchlist) =>
        watchlist.id !== request.watchlistId &&
        !isShared(watchlist) &&
        watchlist.ownerId === userId &&
        watchlist.view === request.view &&
        isSameWatchlistFilter(watchlist.view, watchlist.filter, request.filter),
    ),
  ).length;
  return { userCount: reachedIds.length, outOfViewCount: outOfViewIds.length, duplicateCount };
}

// ---------------------------------------------------------------- each person's own row

export interface StoredWatchlistViewer extends WatchlistViewer {
  readonly watchlistId: string;
  readonly userId: string;
}

// Made the first time the person sees the watchlist, and kept when the audience lapses, so
// coming back brings their settings back.
export function viewerOf(userId: string, watchlist: StoredWatchlist): WatchlistViewer {
  const stored = database.watchlistViewers.find(
    (viewer) => viewer.watchlistId === watchlist.id && viewer.userId === userId,
  );
  if (stored !== undefined) {
    const { watchlistId: _watchlistId, userId: _userId, ...viewer } = stored;
    return viewer;
  }

  const viewer: WatchlistViewer = {
    seenAt: null,
    hasBadge: true,
    isHidden: false,
    position: database.watchlistViewers.filter((candidate) => candidate.userId === userId).length,
  };
  database.watchlistViewers.push({ ...viewer, watchlistId: watchlist.id, userId });
  storeWatchlistViewers(database.watchlistViewers);
  return viewer;
}

// ---------------------------------------------------------------- what matches

const counters = {
  documents: (session, filter) =>
    queryDocuments(session, parseDocumentSearchParams(filter), { cursor: null, limit: 1 }).total,
  // Without `request.decide` the view does not exist for the caller, and nothing matches.
  proposals: (session, filter) =>
    canDecide(session)
      ? queryProposals(session, parseProposalSearchParams(filter), { cursor: null, limit: 1 }).total
      : 0,
  validations: (session, filter) =>
    canReview(session)
      ? queryValidations(session, parseValidationSearchParams(filter), { cursor: null, limit: 1 })
          .total
      : 0,
  lists: (session, filter) =>
    canReadLists(session)
      ? queryLists(session, parseListSearchParams(filter), { cursor: null, limit: 1 }).total
      : 0,
  projects: (session, filter) =>
    canReadProjects(session)
      ? queryProjectIndex(session, parseProjectSearchParams(filter)).total
      : 0,
  categories: (session, filter) =>
    canReadCategories(session)
      ? matchingCategoryIds(
          database.categories,
          queryCategoryIndex(session, parseCategorySearchParams(filter).mixId),
          parseCategorySearchParams(filter),
        ).size
      : 0,
  intentions: (session, filter) => {
    if (!canReadIntentions(session)) return 0;
    const matching = matchingIntentions(
      queryIntentionIndex(session),
      parseIntentionsSearchParams(filter),
    );
    return matching.rows.length + matching.templates.length;
  },
  tasks: (session, filter) => {
    if (!canReadRuns(session)) return 0;
    const index = queryRuns(session, parseRunSearchParams(filter));
    return index.running.length + index.finished.length;
  },
} as const satisfies Record<WatchlistView, (session: Session, filter: URLSearchParams) => number>;

function itemCountOf(session: Session, watchlist: Watchlist): number {
  return counters[watchlist.view](session, new URLSearchParams(watchlist.filter));
}
