// The Requests view's declaration (component-interfaces.md §9.2): its filter in the URL, the
// watchlist comparer, its fields (Decision and Request custody on the bar, the rest as chips,
// and the advanced range Asked, filtering.md §6) and its groupings.
// TODO(rrandiak): labels move to i18n.

import { answers } from "@/api/documents";
import type { AskerCount, RequestGrouping, RequestQuery } from "@/api/requests";
import {
  askerCounts,
  isSameRequestQuery,
  parseRequestSearchParams,
  requestGroupingParam,
  toRequestSearchParams,
} from "@/api/requests";
import { answerLabels, existingCopyLabels } from "@/components/filters/value-labels";
import { existingCopyStates } from "@/domain/documents";
import type { DocumentType } from "@/domain/entities";
import { documentTypeSchema } from "@/domain/entities";
import type { ProposalDecision } from "@/domain/requests";
import { proposalDecisions } from "@/domain/requests";
import type { ViewDefinition } from "@/lib/view-definition";
import { vocabulary } from "@/lib/view-definition";

const proposalDecisionLabels = {
  Pending: "Awaiting a decision",
  Denied: "Declined",
  Withdrawn: "Withdrawn",
} as const satisfies Record<ProposalDecision, string>;

const documentTypeLabels = {
  Periodical: "Periodical",
  Monograph: "Monograph",
  Manuscript: "Manuscript",
  Map: "Map",
} as const satisfies Record<DocumentType, string>;

const askerCountLabels = {
  One: "One",
  Several: "More than one",
} as const satisfies Record<AskerCount, string>;

export const requestsView: ViewDefinition<RequestQuery, RequestGrouping> = {
  view: "requests",
  toSearchParams: toRequestSearchParams,
  parseSearchParams: parseRequestSearchParams,
  isSameQuery: isSameRequestQuery,
  fields: [
    {
      key: "decisions",
      label: "Decision",
      field: vocabulary(proposalDecisions, proposalDecisionLabels),
      isQuick: true,
    },
    {
      key: "custodyIds",
      label: "Request custody",
      field: { kind: "reference", reference: "requestCustodies" },
      isQuick: true,
    },
    {
      key: "documentTypes",
      label: "Material type",
      field: vocabulary(documentTypeSchema.options, documentTypeLabels),
    },
    { key: "projectIds", label: "Project", field: { kind: "reference", reference: "projects" } },
    {
      key: "existingCopies",
      label: "Existing copy",
      field: vocabulary(existingCopyStates.toReversed(), existingCopyLabels),
    },
    { key: "askerIds", label: "Asked by", field: { kind: "reference", reference: "users" } },
    { key: "batchIds", label: "Batch", field: { kind: "reference", reference: "batches" } },
    { key: "askerCounts", label: "Askers", field: vocabulary(askerCounts, askerCountLabels) },
    {
      key: "afterProjectApproval",
      label: "After the project's approval",
      field: vocabulary(answers, answerLabels),
    },
    { key: "asked", label: "Asked", field: { kind: "dateRange" } },
  ],
  groupings: [
    { value: "batch", label: "Group by batch" },
    { value: "requester", label: "Group by requester" },
  ],
  groupingParam: requestGroupingParam,
};
