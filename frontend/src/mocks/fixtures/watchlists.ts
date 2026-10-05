// Watchlists the emulated users start with, so the Documents tabs have something to show.
// Written by hand; the demos keep none. Filters are in the URL form of each view. The shared
// ones were saved by the administrator (u3) and are seen by all staff.

import type { StoredWatchlist } from "@/mocks/database";

const staffIds = ["u1", "u2", "u3", "u4", "u8", "u9"] as const;
const readerIds = ["u5", "u6", "u7"] as const;
const sharedOwnerId = "u3";

interface Lens {
  name: string;
  filter: Record<string, string>;
}

const sharedLenses = [
  { name: "Awaiting a decision", filter: { decision: "Pending" } },
  { name: "Restricted", filter: { restricted: "Yes" } },
] as const satisfies readonly Lens[];

const staffLenses = [
  { name: "Urgent, no copy", filter: { priority: "Urgent,High", copy: "None" } },
  { name: "Review needed", filter: { validation: "Needed" } },
  { name: "Could not be added", filter: { progress: "IngestFailed" } },
] as const satisfies readonly Lens[];

const readerLenses = [
  { name: "Ready to read", filter: { status: "Available" } },
] as const satisfies readonly Lens[];

export const watchlists: readonly StoredWatchlist[] = [
  ...sharedLenses.map((lens, index) => ({
    ...watchlistOf(lens),
    id: `W-shared-${index + 1}`,
    scope: "shared" as const,
    ownerId: sharedOwnerId,
  })),
  ...staffIds.flatMap((ownerId) => personalLensesFor(ownerId, staffLenses)),
  ...readerIds.flatMap((ownerId) => personalLensesFor(ownerId, readerLenses)),
];

function personalLensesFor(ownerId: string, lenses: readonly Lens[]): StoredWatchlist[] {
  return lenses.map((lens, index) => ({
    ...watchlistOf(lens),
    id: `W-${ownerId}-${index + 1}`,
    scope: "personal",
    ownerId,
  }));
}

function watchlistOf(lens: Lens) {
  return {
    name: lens.name,
    filter: { ...lens.filter },
    view: "documents" as const,
    createdAt: "2026-06-01T09:00:00Z",
  };
}
