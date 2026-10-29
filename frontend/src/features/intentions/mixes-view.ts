import type { MixQuery } from "@vera/contract/mix-filters";
import {
  isSameMixQuery,
  mixPrimaries,
  mixProportions,
  mixStates,
  parseMixSearchParams,
  toMixSearchParams,
} from "@vera/contract/mix-filters";
import type { ViewDefinition } from "@/lib/view-definition";
import { vocabulary } from "@/lib/view-definition";

export const mixesView: ViewDefinition<MixQuery> = {
  view: "mixes",
  parseSearchParams: parseMixSearchParams,
  toSearchParams: toMixSearchParams,
  isSameQuery: isSameMixQuery,
  fields: [
    {
      key: "states",
      label: "State",
      field: vocabulary(mixStates, { Active: "Active", Archived: "Archived" }),
      isQuick: true,
    },
    {
      key: "primaries",
      label: "Primary",
      field: vocabulary(mixPrimaries, { Primary: "Primary", Other: "Other mixes" }),
    },
    {
      key: "proportions",
      label: "Proportions",
      field: vocabulary(mixProportions, {
        Complete: "Fully allocated",
        Unallocated: "Has unallocated proportions",
      }),
    },
    {
      key: "intentions",
      label: "Used by intentions",
      field: { kind: "numberRange", unit: "intentions" },
    },
  ],
  groupings: [],
  groupingParam: "group",
};
