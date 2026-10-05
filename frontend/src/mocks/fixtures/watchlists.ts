// Watchlists the emulated users start with, so the Documents tabs have something to show.
// Written by hand; the demos keep none. Filters are in the URL form of each view.

import type { StoredWatchlist } from "@/mocks/database";

const staffIds = ["u1", "u2", "u3", "u4", "u8", "u9"] as const;
const readerIds = ["u5", "u6", "u7"] as const;

const staffLenses = [
  { name: "Urgent, no copy", filter: { priority: "Urgent,High", copy: "None" } },
  { name: "Review needed", filter: { validation: "Needed" } },
  { name: "Could not be added", filter: { progress: "IngestFailed" } },
] as const;

const readerLenses = [{ name: "Ready to read", filter: { status: "Available" } }] as const;

export const watchlists: readonly StoredWatchlist[] = [
  ...staffIds.flatMap((ownerId) => lensesFor(ownerId, staffLenses)),
  ...readerIds.flatMap((ownerId) => lensesFor(ownerId, readerLenses)),
];

function lensesFor(
  ownerId: string,
  lenses: readonly { name: string; filter: Record<string, string> }[],
): StoredWatchlist[] {
  return lenses.map((lens, index) => ({
    ...lens,
    filter: { ...lens.filter },
    id: `W-${ownerId}-${index + 1}`,
    view: "documents",
    ownerId,
    createdAt: "2026-06-01T09:00:00Z",
  }));
}
