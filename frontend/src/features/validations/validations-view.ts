// The Documents Validations view's declaration (component-interfaces.md §9.2): its filter in the
// URL, the watchlist comparer and its fields: Review and Category on the bar (the demo's Show and
// Category, page-validation.js), Forbidden (Yes / No, as in Documents, decided 2026-10-06),
// Defect (the plugin), Priority and Project as chips, and the day it started waiting as a range.
// Grouped by category or by defect (component-interfaces.md §2.2, decided 2026-10-06).

import { answers } from "@vera/contract/documents";
import type { ValidationGrouping, ValidationQuery } from "@vera/contract/validations";
import {
  isSameValidationQuery,
  parseValidationSearchParams,
  toValidationSearchParams,
  validationGroupingParam,
} from "@vera/contract/validations";
import type { Priority } from "@vera/domain/entities";
import { priorities } from "@vera/domain/entities";
import type { ReviewedState } from "@vera/domain/validations";
import { reviewedStates } from "@vera/domain/validations";
import { answerLabels } from "@/components/filters/value-labels";
import type { ViewDefinition } from "@/lib/view-definition";
import { vocabulary } from "@/lib/view-definition";

export const reviewStateLabels = {
  Needed: "validations:review.needed",
  Denied: "validations:review.denied",
  Approved: "validations:review.accepted",
} as const satisfies Record<ReviewedState, string>;

const priorityLabels = {
  Urgent: "validations:priority.urgent",
  High: "validations:priority.high",
  Normal: "validations:priority.normal",
  Low: "validations:priority.low",
} as const satisfies Record<Priority, string>;

export const validationsView: ViewDefinition<ValidationQuery, ValidationGrouping> = {
  view: "validations",
  toSearchParams: toValidationSearchParams,
  parseSearchParams: parseValidationSearchParams,
  isSameQuery: isSameValidationQuery,
  filtersProperties: true,
  fields: [
    {
      key: "reviews",
      label: "validations:filter.review",
      field: vocabulary(reviewedStates, reviewStateLabels),
      isQuick: true,
    },
    {
      key: "categoryIds",
      label: "validations:filter.category",
      field: { kind: "reference", reference: "categories" },
      isQuick: true,
    },
    {
      key: "forbidden",
      label: "validations:filter.forbidden",
      field: vocabulary(answers, answerLabels),
    },
    {
      key: "instances",
      label: "validations:filter.defect",
      field: { kind: "reference", reference: "pluginInstances" },
    },
    {
      key: "priorities",
      label: "validations:filter.priority",
      field: vocabulary(priorities.toReversed(), priorityLabels),
    },
    {
      key: "projectIds",
      label: "validations:filter.project",
      field: { kind: "reference", reference: "projects" },
    },
    { key: "waiting", label: "validations:filter.waitingSince", field: { kind: "dateRange" } },
  ],
  groupings: [
    { value: "category", label: "validations:group.category" },
    { value: "defect", label: "validations:group.defect" },
  ],
  groupingParam: validationGroupingParam,
};
