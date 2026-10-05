// What the server does for watchlists: show each caller their own and the shared ones on the
// view, let only those who manage shared watchlists change a shared one, and count what matches
// each now by running its filter over its view. A shared lens is drawn over the staff view, so a
// requester, whose Documents are their own asks, sees none.

import { parseDocumentSearchParams } from "@/api/documents";
import type { WatchlistSummary } from "@/api/watchlists";
import type { Session, Watchlist, WatchlistScope, WatchlistView } from "@/domain/entities";
import { hasPermission } from "@/domain/permissions";
import type { StoredWatchlist } from "@/mocks/database";
import { database } from "@/mocks/database";
import { audienceOf, queryDocuments } from "@/mocks/documents";

const scopeOrder = ["shared", "personal"] as const satisfies readonly WatchlistScope[];

export function visibleWatchlists(
  session: Session,
  view: WatchlistView | null,
): WatchlistSummary[] {
  return database.watchlists
    .filter((watchlist) => isVisible(session, watchlist))
    .filter((watchlist) => view === null || watchlist.view === view)
    .toSorted((first, second) => scopeOrder.indexOf(first.scope) - scopeOrder.indexOf(second.scope))
    .map((watchlist) => ({
      ...publicWatchlistOf(watchlist),
      itemCount: itemCountOf(session, watchlist),
      isEditable: canChange(session, watchlist.scope),
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

// Anyone keeps their own; a shared one needs the permission, to create as much as to change.
export function canChange(session: Session, scope: WatchlistScope): boolean {
  if (scope === "personal") {
    return true;
  }

  return hasPermission(session, "watchlist.manage_shared");
}

export function publicWatchlistOf({ ownerId: _ownerId, ...watchlist }: StoredWatchlist): Watchlist {
  return watchlist;
}

function isVisible(session: Session, watchlist: StoredWatchlist): boolean {
  if (watchlist.scope === "shared") {
    return audienceOf(session) === "staff";
  }

  return watchlist.ownerId === session.user.id;
}

function itemCountOf(session: Session, watchlist: Watchlist): number {
  const filter = new URLSearchParams(watchlist.filter);
  return queryDocuments(session, parseDocumentSearchParams(filter), { cursor: null, limit: 1 })
    .total;
}
