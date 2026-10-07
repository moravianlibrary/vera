// Watchlists the emulated users start with, so the Documents, Proposals and Validations tabs have
// something to show. Validations seeds Page counts and Denied in review (docs/demos/STATUS.md), and
// Review needed, the queue it opens on in the demo.
// Written by hand; the demos keep none. Filters are in the URL form of each view. The shared
// ones were saved by the administrator (u3): most for everyone who opens their view, Periodicals
// for the Periodicals Curators group and Page counts for the curator role (filtering.md §4.5).

import type { WatchlistAudience, WatchlistView } from "@/domain/entities";
import type { StoredWatchlist } from "@/mocks/database";

const staffIds = ["u1", "u2", "u3", "u4", "u8", "u9"] as const;
const readerIds = ["u5", "u6", "u7"] as const;
// Those who decide proposals.
const deciderIds = ["u1", "u3", "u8"] as const;
const sharedOwnerId = "u3";

interface Lens {
  name: string;
  filter: Record<string, string>;
  view?: WatchlistView;
  // Shared ones only; everyone who opens the view when absent.
  audience?: WatchlistAudience;
}

const sharedLenses: readonly Lens[] = [
  { name: "Awaiting a decision", filter: { decision: "Pending" } },
  { name: "Forbidden", filter: { forbidden: "Yes" } },
  { name: "Awaiting a decision", filter: { decision: "Pending" }, view: "proposals" },
  {
    name: "Periodicals",
    filter: { decision: "Pending", type: "Periodical" },
    view: "proposals",
    audience: { kind: "some", groupIds: ["g1"], roleIds: [] },
  },
  { name: "Review needed", filter: { review: "Needed" }, view: "validations" },
  {
    name: "Page counts",
    filter: { review: "Needed", defect: "PageCount" },
    view: "validations",
    audience: { kind: "some", groupIds: [], roleIds: ["curator"] },
  },
  { name: "Denied in review", filter: { review: "Denied" }, view: "validations" },
];

const staffLenses = [
  { name: "Urgent, no copy", filter: { priority: "Urgent,High", copy: "None" } },
  { name: "Review needed", filter: { validation: "Needed" } },
  { name: "Could not be added", filter: { progress: "IngestFailed" } },
] as const satisfies readonly Lens[];

const deciderLenses = [
  {
    name: "More than one asker",
    filter: { decision: "Pending", askers: "Several" },
    view: "proposals",
  },
] as const satisfies readonly Lens[];

const readerLenses = [
  { name: "Ready to read", filter: { status: "Available" } },
] as const satisfies readonly Lens[];

export const watchlists: readonly StoredWatchlist[] = [
  ...sharedLenses.map(
    (lens, index): StoredWatchlist => ({
      ...watchlistOf(lens),
      id: `W-shared-${index + 1}`,
      audience: lens.audience ?? { kind: "everyone" },
      ownerId: sharedOwnerId,
    }),
  ),
  ...staffIds.flatMap((ownerId) => personalLensesFor(ownerId, staffLenses)),
  ...deciderIds.flatMap((ownerId) => personalLensesFor(ownerId, deciderLenses, "proposals")),
  ...readerIds.flatMap((ownerId) => personalLensesFor(ownerId, readerLenses)),
];

function personalLensesFor(
  ownerId: string,
  lenses: readonly Lens[],
  view: WatchlistView = "documents",
): StoredWatchlist[] {
  return lenses.map((lens, index) => ({
    ...watchlistOf(lens),
    id: `W-${ownerId}-${view}-${index + 1}`,
    audience: { kind: "personal" },
    ownerId,
  }));
}

function watchlistOf(lens: Lens) {
  return {
    name: lens.name,
    filter: { ...lens.filter },
    view: lens.view ?? "documents",
    createdAt: "2026-06-01T09:00:00Z",
  };
}
