// The Requests view's declaration (component-interfaces.md §9.2): its filter in the URL, the
// watchlist comparer, its fields (Decision and Request custody on the bar, the rest as chips,
// and the advanced range Asked, filtering.md §6) and its groupings.

import { answers } from "@vera/contract/documents";
import type { AskerCount, RequestGrouping, RequestQuery } from "@vera/contract/requests";
import {
  askerCounts,
  isSameRequestQuery,
  parseRequestSearchParams,
  requestGroupingParam,
  toRequestSearchParams,
} from "@vera/contract/requests";
import { existingCopyStates } from "@vera/domain/documents";
import type { DocumentType } from "@vera/domain/entities";
import { documentTypeSchema } from "@vera/domain/entities";
import type { ProposalDecision } from "@vera/domain/requests";
import { proposalDecisions } from "@vera/domain/requests";
import { answerLabels, existingCopyLabels } from "@/components/filters/value-labels";
import type { ViewDefinition } from "@/lib/view-definition";
import { vocabulary } from "@/lib/view-definition";

const proposalDecisionLabels = {
  Pending: "requests:status.awaitingDecision",
  Denied: "requests:status.declined",
  Withdrawn: "requests:status.withdrawn",
} as const satisfies Record<ProposalDecision, string>;

const documentTypeLabels = {
  Periodical: "requests:material.periodical",
  Monograph: "requests:material.monograph",
  Manuscript: "requests:material.manuscript",
  Map: "requests:material.map",
} as const satisfies Record<DocumentType, string>;

const askerCountLabels = {
  One: "requests:askerCount.one",
  Several: "requests:askerCount.several",
} as const satisfies Record<AskerCount, string>;

export const requestsView: ViewDefinition<RequestQuery, RequestGrouping> = {
  view: "requests",
  toSearchParams: toRequestSearchParams,
  parseSearchParams: parseRequestSearchParams,
  isSameQuery: isSameRequestQuery,
  filtersProperties: true,
  fields: [
    {
      key: "decisions",
      label: "requests:filter.decision",
      field: vocabulary(proposalDecisions, proposalDecisionLabels),
      isQuick: true,
    },
    {
      key: "custodyIds",
      label: "requests:filter.custody",
      field: { kind: "reference", reference: "requestCustodies" },
      isQuick: true,
    },
    {
      key: "documentTypes",
      label: "requests:filter.materialType",
      field: vocabulary(documentTypeSchema.options, documentTypeLabels),
    },
    {
      key: "projectIds",
      label: "requests:filter.project",
      field: { kind: "reference", reference: "projects" },
    },
    {
      key: "existingCopies",
      label: "requests:filter.existingCopy",
      field: vocabulary(existingCopyStates.toReversed(), existingCopyLabels),
    },
    {
      key: "askerIds",
      label: "requests:filter.askedBy",
      field: { kind: "reference", reference: "users" },
    },
    {
      key: "batchIds",
      label: "requests:filter.batch",
      field: { kind: "reference", reference: "batches" },
    },
    {
      key: "askerCounts",
      label: "requests:filter.askers",
      field: vocabulary(askerCounts, askerCountLabels),
    },
    {
      key: "afterProjectApproval",
      label: "requests:filter.afterApproval",
      field: vocabulary(answers, answerLabels),
    },
    { key: "asked", label: "requests:filter.asked", field: { kind: "dateRange" } },
  ],
  groupings: [
    { value: "batch", label: "requests:group.batch" },
    { value: "requester", label: "requests:group.requester" },
  ],
  groupingParam: requestGroupingParam,
};
