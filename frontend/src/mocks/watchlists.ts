// What the server does for watchlists: keep each to its owner, and count what matches each one
// now by running its filter over its view.

import { parseDocumentSearchParams } from "@/api/documents";
import type { WatchlistSummary } from "@/api/watchlists";
import type { Session, Watchlist, WatchlistView } from "@/domain/entities";
import type { StoredWatchlist } from "@/mocks/database";
import { database } from "@/mocks/database";
import { queryDocuments } from "@/mocks/documents";

export function ownWatchlists(session: Session, view: WatchlistView | null): WatchlistSummary[] {
  return database.watchlists
    .filter((watchlist) => watchlist.ownerId === session.user.id)
    .filter((watchlist) => view === null || watchlist.view === view)
    .map((watchlist) => ({
      ...publicWatchlistOf(watchlist),
      itemCount: itemCountOf(session, watchlist),
    }));
}

export function findOwnWatchlist(session: Session, watchlistId: string): StoredWatchlist | null {
  return (
    database.watchlists.find(
      (watchlist) => watchlist.id === watchlistId && watchlist.ownerId === session.user.id,
    ) ?? null
  );
}

export function publicWatchlistOf({ ownerId: _ownerId, ...watchlist }: StoredWatchlist): Watchlist {
  return watchlist;
}

function itemCountOf(session: Session, watchlist: Watchlist): number {
  const filter = new URLSearchParams(watchlist.filter);
  return queryDocuments(session, parseDocumentSearchParams(filter), { cursor: null, limit: 1 })
    .total;
}
