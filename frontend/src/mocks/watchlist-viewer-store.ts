import { z } from "zod";
import { watchlistViewerSchema } from "@/api/watchlists";

const storageKey = "vera.mock.watchlist-viewers";
const storedSchema = z.array(
  watchlistViewerSchema.extend({ userId: z.string(), watchlistId: z.string() }),
);

export function readWatchlistViewers() {
  try {
    const parsed = storedSchema.safeParse(
      JSON.parse(window.localStorage.getItem(storageKey) ?? "[]"),
    );
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function storeWatchlistViewers(rows: z.infer<typeof storedSchema>): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(rows));
  } catch {
    /* Storage is unavailable; the mock keeps the rows until reload. */
  }
}
