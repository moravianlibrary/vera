// What the two Classifier plugins (plugins.md §4.13, a kind new on 2026-10-07, so not in the
// demo data) read a proposal by; the instances, in the order whose first suggestion wins, are
// Plugins' (fixtures/plugins.ts). Each answers a leaf with its reason, or nothing.

import type { DocumentType } from "@vera/domain/entities";

// What PlaceOfPublication reads a Moravian place by: the mock has no imprint, so the title
// stands in for it.
export const moravianPlaces = ["morav", "brn", "ostrav", "olomou", "znojm", "slovác"] as const;

// MaterialType's leaf for each material it knows, with its reason; a monograph or a manuscript is
// split by period, which the mock does not hold, so it suggests nothing for them.
export const materialLeaves: Readonly<
  Partial<Record<DocumentType, { categoryId: string; reason: string }>>
> = {
  Periodical: { categoryId: "c22", reason: "Periodical, national unless a place says otherwise" },
  Map: { categoryId: "c4", reason: "Map" },
};
