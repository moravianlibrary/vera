// The Documents view's declaration (component-interfaces.md §9.2): its filter in the URL, the
// watchlist comparer, its fields and its groupings. Staff filter on the stored dimensions a
// status is made from, Decision and Progress on the bar, and on the advanced ranges Pages and
// Asked (filtering.md §6); a requester has only the status of their own ask, in the public
// vocabulary, and the other fields do not exist for them.
// TODO(rrandiak): labels move to i18n.

import type { DocumentGrouping, DocumentQuery } from "@/api/documents";
import {
  answers,
  documentGroupingParam,
  isSameDocumentQuery,
  parseDocumentSearchParams,
  toDocumentSearchParams,
} from "@/api/documents";
import { answerLabels, existingCopyLabels } from "@/components/filters/value-labels";
import type { AskDecision } from "@/domain/documents";
import { askDecisions, existingCopyStates } from "@/domain/documents";
import type { Priority, Progress } from "@/domain/entities";
import { priorities, progressValues } from "@/domain/entities";
import type { PublicStatus, Validation } from "@/domain/status";
import { publicStatuses, validations } from "@/domain/status";
import type { ViewDefinition } from "@/lib/view-definition";
import { vocabulary } from "@/lib/view-definition";

const publicStatusLabels = {
  WaitingForReview: "Waiting for review",
  NotAccepted: "Not accepted",
  Withdrawn: "Withdrawn",
  BeingAdded: "Being added",
  BeingChecked: "Being checked",
  WaitingToBeScheduled: "Waiting to be scheduled",
  Scheduled: "Scheduled",
  Available: "Available",
  OnHold: "On hold",
  NotAvailable: "Not available",
} as const satisfies Record<PublicStatus, string>;

const decisionLabels = {
  Pending: "Pending",
  Approved: "Approved",
  Denied: "Denied",
  Withdrawn: "Withdrawn",
} as const satisfies Record<AskDecision, string>;

const progressLabels = {
  Enqueued: "Being added",
  IngestFailed: "Could not be added",
  Ready: "Ready",
  Planned: "Planned",
  InProgress: "In progress",
  Digitized: "Digitized",
  Published: "Published",
} as const satisfies Record<Progress, string>;

const validationLabels = {
  Needed: "Needed",
  Denied: "Denied",
  Approved: "Approved",
  NotRequired: "Not required",
} as const satisfies Record<Validation, string>;

const priorityLabels = {
  Urgent: "Urgent",
  High: "High",
  Normal: "Normal",
  Low: "Low",
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
      label: "Status",
      field: vocabulary(publicStatuses, publicStatusLabels),
      isQuick: true,
      audience: "public",
    },
    {
      key: "decisions",
      label: "Decision",
      field: vocabulary(askDecisions, decisionLabels),
      isQuick: true,
      audience: "staff",
    },
    {
      key: "progress",
      label: "Progress",
      field: vocabulary(progressValues, progressLabels),
      isQuick: true,
      audience: "staff",
    },
    {
      key: "validations",
      label: "Validation",
      field: vocabulary(validations, validationLabels),
      audience: "staff",
    },
    {
      key: "forbidden",
      label: "Forbidden",
      field: vocabulary(answers, answerLabels),
      audience: "staff",
    },
    {
      key: "cancelled",
      label: "Cancelled",
      field: vocabulary(answers, answerLabels),
      audience: "staff",
    },
    {
      key: "categoryIds",
      label: "Category",
      field: { kind: "reference", reference: "categories" },
      audience: "staff",
    },
    {
      key: "projectIds",
      label: "Project",
      field: { kind: "reference", reference: "projects" },
      audience: "staff",
    },
    {
      key: "priorities",
      label: "Priority",
      field: vocabulary(priorities.toReversed(), priorityLabels),
      audience: "staff",
    },
    {
      key: "existingCopies",
      label: "Existing copy",
      field: vocabulary(existingCopyStates.toReversed(), existingCopyLabels),
      audience: "staff",
    },
    {
      key: "askerIds",
      label: "Asked by",
      field: { kind: "reference", reference: "users" },
      audience: "staff",
    },
    {
      key: "pages",
      label: "Pages",
      field: {
        kind: "numberRange",
        unit: "pages",
        presets: [{ to: 99 }, { from: 100, to: 499 }, { from: 500, to: 999 }, { from: 1000 }],
      },
      audience: "staff",
    },
    {
      key: "asked",
      label: "Asked",
      field: { kind: "dateRange" },
      audience: "staff",
    },
  ],
  groupings: [
    { value: "batch", label: "Group by batch" },
    { value: "project", label: "Group by project" },
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
