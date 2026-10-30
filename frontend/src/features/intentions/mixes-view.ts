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
      label: "intentions:mixFilter.state",
      field: vocabulary(mixStates, {
        Active: "intentions:mixState.active",
        Archived: "intentions:mixState.archived",
      }),
      isQuick: true,
    },
    {
      key: "primaries",
      label: "intentions:mixFilter.primary",
      field: vocabulary(mixPrimaries, {
        Primary: "intentions:mixPrimary.primary",
        Other: "intentions:mixPrimary.other",
      }),
    },
    {
      key: "proportions",
      label: "intentions:mixFilter.proportions",
      field: vocabulary(mixProportions, {
        Complete: "intentions:mixProportion.complete",
        Unallocated: "intentions:mixProportion.unallocated",
      }),
    },
    {
      key: "intentions",
      label: "intentions:mixFilter.usedBy",
      field: { kind: "numberRange", unit: "intentions:unit.intentions" },
    },
  ],
  groupings: [],
  groupingParam: "group",
};
