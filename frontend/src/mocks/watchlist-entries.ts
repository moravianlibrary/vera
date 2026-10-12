// Mock membership ledger. The production design uses change events and an outbox; the mock
// reconciles a watchlist when it is read, so local mutations can demonstrate the same entry and
// seen semantics without a running worker.

import { z } from "zod";

const storageKey = "vera.mock.watchlist-entries";
const baselineKey = "vera.mock.watchlist-baselines";
const entrySchema = z.object({
  userId: z.string(),
  watchlistId: z.string(),
  recordId: z.string(),
  enteredAt: z.string(),
  baseline: z.boolean(),
  filterVersion: z.number().int().positive().default(1),
});
export type MockWatchlistEntry = z.infer<typeof entrySchema>;
const storedSchema = z.array(entrySchema);

export function readWatchlistEntries(): MockWatchlistEntry[] {
  try {
    const parsed = storedSchema.safeParse(
      JSON.parse(window.localStorage.getItem(storageKey) ?? "[]"),
    );
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function storeWatchlistEntries(rows: MockWatchlistEntry[]): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(rows));
  } catch {
    // The mock still keeps rows in memory when storage is unavailable.
  }
}

export function readWatchlistBaselines(): string[] {
  try {
    const parsed = z
      .array(z.string())
      .safeParse(JSON.parse(window.localStorage.getItem(baselineKey) ?? "[]"));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function storeWatchlistBaselines(keys: string[]): void {
  try {
    window.localStorage.setItem(baselineKey, JSON.stringify(keys));
  } catch {
    // Memory remains authoritative for this visit.
  }
}
