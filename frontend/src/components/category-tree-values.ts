// What a category tree's rows can carry and how they are named (STATUS "Categories"): the three
// that read a mix, and the three that count what a subtree holds. A page offers the ones it has:
// Categories all six with Overall's mix and the counts alone without it, an intention's Mix the
// three of the mix. The pick is remembered per viewer and falls back to the first one offered.

import type { MixTree } from "@vera/contract/mixes";
import type { CategoryTreeValue } from "@vera/domain/categories";

export const categoryTreeValueLabels = {
  share: "common:categoryTreeValue.share",
  whole: "common:categoryTreeValue.whole",
  mix: "common:categoryTreeValue.mix",
  documents: "common:categoryTreeValue.documents",
  pages: "common:categoryTreeValue.pages",
  ready: "common:categoryTreeValue.ready",
} as const satisfies Record<CategoryTreeValue, string>;

export const mixTreeValues = ["share", "whole", "mix"] as const satisfies CategoryTreeValue[];
export const countTreeValues = [
  "documents",
  "pages",
  "ready",
] as const satisfies CategoryTreeValue[];

export function isMixValue(value: CategoryTreeValue): boolean {
  return mixTreeValues.some((mixValue) => mixValue === value);
}

// The pick in effect: the one remembered, Share of parent before any, and never one the page does
// not offer.
export function treeValueOf(
  remembered: CategoryTreeValue | undefined,
  offered: readonly CategoryTreeValue[],
): CategoryTreeValue {
  const value = remembered ?? "share";
  return offered.includes(value) ? value : (offered[0] ?? value);
}

// "House mix", "Periodicals push": a mix is its own record, named (PLAN-mix).
export function mixNameOf(mix: Pick<MixTree, "mixName">): string {
  return mix.mixName;
}
