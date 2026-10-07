// The Classifier plugin instances (plugins.md §4.13, a kind new on 2026-10-07, so not in the
// demo data), in tier order: the first suggestion wins. Each reads the proposal as a custody
// plugin does and answers a leaf with its reason, or nothing. Ids follow the demo's plugin
// instances.
// TODO(rrandiak): the instances move to the Plugins fixtures with step 10.

import type { DocumentType } from "@/domain/entities";

export interface ClassifierInstance {
  readonly id: string;
  readonly name: string;
  readonly plugin: string;
  readonly version: string;
  readonly isEnabled: boolean;
}

export const classifiers: readonly ClassifierInstance[] = [
  {
    id: "pi30",
    name: "Regional press",
    plugin: "PlaceOfPublication",
    version: "1.0.0",
    isEnabled: true,
  },
  { id: "pi31", name: "Material type", plugin: "MaterialType", version: "1.1.0", isEnabled: true },
];

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
