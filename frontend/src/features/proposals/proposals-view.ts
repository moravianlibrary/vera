// The Proposals view's declaration (component-interfaces.md §9.2): its filter in the URL, the
// watchlist comparer and its groupings.
// TODO(rrandiak): labels move to i18n.

import type { ProposalGrouping, ProposalQuery } from "@/api/proposal-review";
import {
  isSameProposalQuery,
  parseProposalSearchParams,
  proposalGroupingParam,
  toProposalSearchParams,
} from "@/api/proposal-review";
import type { ViewDefinition } from "@/lib/view-definition";

export const proposalsView: ViewDefinition<ProposalQuery, ProposalGrouping> = {
  view: "proposals",
  toSearchParams: toProposalSearchParams,
  parseSearchParams: parseProposalSearchParams,
  isSameQuery: isSameProposalQuery,
  groupings: [
    { value: "batch", label: "Group by batch" },
    { value: "requester", label: "Group by requester" },
  ],
  groupingParam: proposalGroupingParam,
};
