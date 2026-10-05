// The tab a view was last left on, per person and per view, so the view reopens where they
// work: a curator who reviews from "Awaiting a decision" lands there, one who browses lands on
// "All". Kept in this browser; a person on another device starts from "All".
// TODO(rrandiak): keep it with the person's settings on the server once user settings exist.

import { useState } from "react";
import type { WatchlistView } from "@/domain/entities";

// What is stored for "All", which is no watchlist.
const allValue = "all";

function storageKeyOf(userId: string, view: WatchlistView): string {
  return `vera.watchlist.${userId}.${view}`;
}

// Undefined when nothing is stored or storage is unavailable; null for "All".
function readRemembered(userId: string, view: WatchlistView): string | null | undefined {
  try {
    const value = window.localStorage.getItem(storageKeyOf(userId, view));
    return value === null ? undefined : value === allValue ? null : value;
  } catch {
    return undefined;
  }
}

function storeRemembered(userId: string, view: WatchlistView, watchlistId: string | null): void {
  try {
    window.localStorage.setItem(storageKeyOf(userId, view), watchlistId ?? allValue);
  } catch {
    // Storage is blocked: the view reopens on "All".
  }
}

export function useRememberedWatchlist(userId: string, view: WatchlistView) {
  const [rememberedId] = useState(() => readRemembered(userId, view));
  return {
    // The watchlist to reopen, null for "All", undefined when there is nothing to go on.
    rememberedId,
    remember: (watchlistId: string | null) => storeRemembered(userId, view, watchlistId),
  };
}
