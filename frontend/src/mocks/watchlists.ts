// What the server does for watchlists (filtering.md §4.5, §5): show each caller their own and the
// shared ones whose audience reaches them, which stops at who may open the view and, on Documents,
// at staff, since a shared lens is drawn over the staff vocabulary; let only those who manage
// shared watchlists share or change a shared one; keep each person's own row for every watchlist
// they see; and count what matches each now by running its filter over its view. A filter is
// saved once among the watchlists a caller sees, so nobody keeps the same lens twice; someone
// else's personal watchlist is out of the caller's sight and never blocks theirs. Sharing warns
// rather than refuses: its reach says how many of the reached already keep the same filter.

import { parseCategorySearchParams } from "@/api/categories";
import { documentQueryParams, parseDocumentSearchParams } from "@/api/documents";
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
import { publicStatuses } from "@/domain/status";
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
import { storeWatchlistBaselines, storeWatchlistEntries } from "@/mocks/watchlist-entries";

export function visibleWatchlists(
  session: Session,
  view: WatchlistView | null,
  mode: "visible" | "manage-system" = "visible",
): WatchlistSummary[] {
  return database.watchlists
    .filter((watchlist) =>
      mode === "manage-system"
        ? hasPermission(session, "watchlist.manage_shared") && isShared(watchlist)
        : isVisible(session, watchlist),
    )
    .filter((watchlist) => view === null || watchlist.view === view)
    .toSorted((first, second) => Number(isShared(second)) - Number(isShared(first)))
    .map((watchlist) => ({ watchlist, viewer: viewerOf(session.user.id, watchlist) }))
    .toSorted((first, second) => first.viewer.position - second.viewer.position)
    .map(({ watchlist, viewer }) => ({
      ...publicWatchlistOf(watchlist),
      itemCount: itemCountOf(session, watchlist),
      newCount:
        mode === "visible" || isVisible(session, watchlist)
          ? newCountOf(session, watchlist, viewer.seenAt)
          : 0,
      createdBy: watchlist.ownerId,
      subscriberCount: database.watchlistViewers.filter(
        (candidate) =>
          candidate.watchlistId === watchlist.id && (candidate.email || candidate.chat),
      ).length,
      filterVersion: watchlist.filterVersion ?? 1,
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

export function findChangeableWatchlist(
  session: Session,
  watchlistId: string,
): StoredWatchlist | null {
  return (
    database.watchlists.find(
      (watchlist) =>
        watchlist.id === watchlistId &&
        (isShared(watchlist)
          ? hasPermission(session, "watchlist.manage_shared")
          : watchlist.ownerId === session.user.id),
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

// The two Documents perspectives use different filter vocabularies. Reject a
// filter that the target view would silently ignore.
export function isValidWatchlistFilter(
  view: WatchlistView,
  filter: Record<string, string>,
): boolean {
  if (view === "documents") {
    return Object.keys(filter).every((key) => key !== documentQueryParams.statuses);
  }
  if (view !== "my-documents") return true;
  const allowed = new Set<string>([documentQueryParams.search, documentQueryParams.statuses]);
  if (!Object.keys(filter).every((key) => allowed.has(key))) return false;
  const statuses = filter[documentQueryParams.statuses];
  return (
    statuses === undefined ||
    (statuses.length > 0 &&
      statuses.split(",").every((status) => publicStatuses.some((valid) => valid === status)))
  );
}

export function publicWatchlistOf({ ownerId: _ownerId, ...watchlist }: StoredWatchlist): Watchlist {
  return watchlist;
}

// ---------------------------------------------------------------- who it reaches

// Whether the person may open the view at all, with the vocabulary a shared lens is drawn for.
export function canOpenView(session: Session, view: WatchlistView): boolean {
  switch (view) {
    case "documents":
      return audienceOf(session) === "staff";
    case "my-documents":
      return hasPermission(session, "request.read_own");
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
  // Managers always belong to a system watchlist's effective audience. This does not
  // grant the source-view or record permissions needed to open its matches.
  if (audience.kind !== "personal" && hasPermission(session, "watchlist.manage_shared")) {
    return true;
  }
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
  if (!canOpenView(session, watchlist.view)) return false;
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
    position: database.watchlistViewers.filter((candidate) => candidate.userId === userId).length,
    email: false,
    chat: false,
    emailSince: null,
    chatSince: null,
    confirmedFilter: null,
  };
  database.watchlistViewers.push({ ...viewer, watchlistId: watchlist.id, userId });
  storeWatchlistViewers(database.watchlistViewers);
  return viewer;
}

// ---------------------------------------------------------------- what matches

const counters = {
  documents: (session, filter) =>
    queryDocuments(session, parseDocumentSearchParams(filter), { cursor: null, limit: 1 }).total,
  "my-documents": (session, filter) =>
    hasPermission(session, "request.read_own")
      ? queryDocuments(
          session,
          parseDocumentSearchParams(filter),
          { cursor: null, limit: 1 },
          null,
          "public",
        ).total
      : 0,
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

function matchingIdsOf(session: Session, watchlist: Watchlist): string[] {
  const filter = new URLSearchParams(watchlist.filter);
  const all = { cursor: null, limit: Number.MAX_SAFE_INTEGER };
  switch (watchlist.view) {
    case "documents":
      return queryDocuments(session, parseDocumentSearchParams(filter), all).items.map(
        (row) => row.document.id,
      );
    case "my-documents":
      return hasPermission(session, "request.read_own")
        ? queryDocuments(session, parseDocumentSearchParams(filter), all, null, "public").items.map(
            (row) => row.document.id,
          )
        : [];
    case "proposals":
      return canDecide(session)
        ? queryProposals(session, parseProposalSearchParams(filter), all).items.map(
            (row) => row.record.document.id,
          )
        : [];
    case "validations":
      return canReview(session)
        ? queryValidations(session, parseValidationSearchParams(filter), all).items.map(
            (row) => row.iteration.id,
          )
        : [];
    case "lists":
      return canReadLists(session)
        ? queryLists(session, parseListSearchParams(filter), all).items.map((row) => row.list.id)
        : [];
    case "projects":
      return canReadProjects(session)
        ? queryProjectIndex(session, parseProjectSearchParams(filter)).rows.map(
            (row) => row.project.id,
          )
        : [];
    case "categories":
      return canReadCategories(session)
        ? [
            ...matchingCategoryIds(
              database.categories,
              queryCategoryIndex(session, parseCategorySearchParams(filter).mixId),
              parseCategorySearchParams(filter),
            ),
          ]
        : [];
    case "intentions": {
      if (!canReadIntentions(session)) return [];
      const matching = matchingIntentions(
        queryIntentionIndex(session),
        parseIntentionsSearchParams(filter),
      );
      return [
        ...matching.rows.map((row) => row.intention.id),
        ...matching.templates.map((row) => row.template.id),
      ];
    }
    case "tasks": {
      if (!canReadRuns(session)) return [];
      const matching = queryRuns(session, parseRunSearchParams(filter));
      return [...matching.running, ...matching.finished].map((run) => run.id);
    }
  }
}

function newCountOf(session: Session, watchlist: StoredWatchlist, seenAt: string | null): number {
  const key = `${session.user.id}:${watchlist.id}:${watchlist.filterVersion ?? 1}`;
  const version = watchlist.filterVersion ?? 1;
  const isBaseline = !database.watchlistBaselines.includes(key);
  const current = new Set(matchingIdsOf(session, watchlist));
  const before = database.watchlistEntries.filter(
    (entry) =>
      entry.userId === session.user.id &&
      entry.watchlistId === watchlist.id &&
      entry.filterVersion === version,
  );
  const retained = before.filter((entry) => current.has(entry.recordId));
  const known = new Set(retained.map((entry) => entry.recordId));
  const enteredAt = new Date().toISOString();
  const added = [...current]
    .filter((recordId) => !known.has(recordId))
    .map((recordId) => ({
      userId: session.user.id,
      watchlistId: watchlist.id,
      recordId,
      enteredAt,
      baseline: isBaseline,
      filterVersion: version,
      emailDeliveredAt: null,
      chatDeliveredAt: null,
    }));
  if (isBaseline || retained.length !== before.length || added.length > 0) {
    database.watchlistEntries = database.watchlistEntries
      .filter((entry) => entry.userId !== session.user.id || entry.watchlistId !== watchlist.id)
      .concat(retained, added);
    storeWatchlistEntries(database.watchlistEntries);
  }
  if (isBaseline) {
    database.watchlistBaselines.push(key);
    storeWatchlistBaselines(database.watchlistBaselines);
  }
  return [...retained, ...added].filter(
    (entry) => !entry.baseline && (seenAt === null || entry.enteredAt > seenAt),
  ).length;
}
