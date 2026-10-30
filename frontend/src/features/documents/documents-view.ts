// The Documents view's declaration (component-interfaces.md §9.2): its filter in the URL, the
// watchlist comparer, its fields and its groupings. Staff filter on the stored dimensions a
// status is made from, Decision and Progress on the bar, and on the advanced ranges Pages and
// Asked (filtering.md §6); a requester has only the status of their own ask, in the public
// vocabulary, and the other fields do not exist for them.

import type { DocumentGrouping, DocumentQuery } from "@vera/contract/documents";
import {
  answers,
  documentGroupingParam,
  isSameDocumentQuery,
  parseDocumentSearchParams,
  toDocumentSearchParams,
} from "@vera/contract/documents";
import type { AskDecision } from "@vera/domain/documents";
import { askDecisions, existingCopyStates } from "@vera/domain/documents";
import type { Priority, Progress } from "@vera/domain/entities";
import { priorities, progressValues } from "@vera/domain/entities";
import type { PublicStatus, Validation } from "@vera/domain/status";
import { publicStatuses, validations } from "@vera/domain/status";
import { answerLabels, existingCopyLabels } from "@/components/filters/value-labels";
import type { ViewDefinition } from "@/lib/view-definition";
import { vocabulary } from "@/lib/view-definition";

const publicStatusLabels = {
  WaitingForReview: "documents:status.WaitingForReview",
  NotAccepted: "documents:status.NotAccepted",
  Withdrawn: "documents:status.Withdrawn",
  BeingAdded: "documents:status.BeingAdded",
  BeingChecked: "documents:status.BeingChecked",
  WaitingToBeScheduled: "documents:status.WaitingToBeScheduled",
  Scheduled: "documents:status.Scheduled",
  Available: "documents:status.Available",
  OnHold: "documents:status.OnHold",
  NotAvailable: "documents:status.NotAvailable",
} as const satisfies Record<PublicStatus, string>;

const decisionLabels = {
  Pending: "documents:decision.Pending",
  Approved: "documents:decision.Approved",
  Denied: "documents:decision.Denied",
  Withdrawn: "documents:decision.Withdrawn",
} as const satisfies Record<AskDecision, string>;

const progressLabels = {
  Enqueued: "documents:progress.Enqueued",
  IngestFailed: "documents:progress.IngestFailed",
  Ready: "documents:progress.Ready",
  Planned: "documents:progress.Planned",
  InProgress: "documents:progress.InProgress",
  Digitized: "documents:progress.Digitized",
  Published: "documents:progress.Published",
} as const satisfies Record<Progress, string>;

const validationLabels = {
  Needed: "documents:validation.Needed",
  Denied: "documents:validation.Denied",
  Approved: "documents:validation.Approved",
  NotRequired: "documents:validation.NotRequired",
} as const satisfies Record<Validation, string>;

const priorityLabels = {
  Urgent: "documents:priority.Urgent",
  High: "documents:priority.High",
  Normal: "documents:priority.Normal",
  Low: "documents:priority.Low",
} as const satisfies Record<Priority, string>;

export const documentsView: ViewDefinition<DocumentQuery, DocumentGrouping> = {
  view: "documents",
  toSearchParams: toDocumentSearchParams,
  parseSearchParams: parseDocumentSearchParams,
  isSameQuery: isSameDocumentQuery,
  filtersProperties: true,
  fields: [
    {
      key: "statuses",
      label: "documents:field.status",
      field: vocabulary(publicStatuses, publicStatusLabels),
      isQuick: true,
      audience: "public",
    },
    {
      key: "decisions",
      label: "documents:field.decision",
      field: vocabulary(askDecisions, decisionLabels),
      isQuick: true,
      audience: "staff",
    },
    {
      key: "progress",
      label: "documents:field.progress",
      field: vocabulary(progressValues, progressLabels),
      isQuick: true,
      audience: "staff",
    },
    {
      key: "validations",
      label: "documents:field.validation",
      field: vocabulary(validations, validationLabels),
      audience: "staff",
    },
    {
      key: "forbidden",
      label: "documents:field.forbidden",
      field: vocabulary(answers, answerLabels),
      audience: "staff",
    },
    {
      key: "cancelled",
      label: "documents:field.cancelled",
      field: vocabulary(answers, answerLabels),
      audience: "staff",
    },
    {
      key: "categoryIds",
      label: "documents:field.category",
      field: { kind: "reference", reference: "categories" },
      audience: "staff",
    },
    {
      key: "projectIds",
      label: "documents:field.project",
      field: { kind: "reference", reference: "projects" },
      audience: "staff",
    },
    {
      key: "priorities",
      label: "documents:field.priority",
      field: vocabulary(priorities.toReversed(), priorityLabels),
      audience: "staff",
    },
    {
      key: "existingCopies",
      label: "documents:field.existingCopy",
      field: vocabulary(existingCopyStates.toReversed(), existingCopyLabels),
      audience: "staff",
    },
    {
      key: "askerIds",
      label: "documents:field.askedBy",
      field: { kind: "reference", reference: "users" },
      audience: "staff",
    },
    {
      key: "pages",
      label: "documents:field.pages",
      field: {
        kind: "numberRange",
        unit: "pages",
        presets: [{ to: 99 }, { from: 100, to: 499 }, { from: 500, to: 999 }, { from: 1000 }],
      },
      audience: "staff",
    },
    {
      key: "asked",
      label: "documents:field.asked",
      field: { kind: "dateRange" },
      audience: "staff",
    },
  ],
  groupings: [
    { value: "batch", label: "documents:grouping.batch" },
    { value: "project", label: "documents:grouping.project" },
  ],
  groupingParam: documentGroupingParam,
};

// A requester's public properties are filtered on too; the server reads only those.
const requesterQuery = ({ search, statuses, properties }: DocumentQuery): DocumentQuery => ({
  search,
  statuses,
  properties,
});

export const myDocumentsView: ViewDefinition<DocumentQuery, DocumentGrouping> = {
  view: "my-documents",
  toSearchParams: (query) => toDocumentSearchParams(requesterQuery(query)),
  parseSearchParams: (params) => requesterQuery(parseDocumentSearchParams(params)),
  isSameQuery: isSameDocumentQuery,
  filtersProperties: true,
  fields: documentsView.fields.filter((field) => field.audience === "public"),
  groupings: [],
  groupingParam: documentGroupingParam,
};
