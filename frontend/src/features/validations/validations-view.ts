// The Documents Validations view's declaration (component-interfaces.md §9.2): its filter in the
// URL, the watchlist comparer and its fields: Review and Category on the bar (the demo's Show and
// Category, page-validation.js), Forbidden (Yes / No, as in Documents, decided 2026-10-06),
// Defect (the plugin), Priority and Project as chips, and the day it started waiting as a range.
// TODO(rrandiak): groupings (component-interfaces.md §2.2 lists category and defect; the demo has
// none); labels move to i18n.

import { answers } from "@/api/documents";
import type { ValidationQuery } from "@/api/validations";
import {
  isSameValidationQuery,
  parseValidationSearchParams,
  toValidationSearchParams,
} from "@/api/validations";
import { answerLabels } from "@/components/filters/value-labels";
import type { Priority } from "@/domain/entities";
import { priorities } from "@/domain/entities";
import type { ReviewedState } from "@/domain/validations";
import { reviewedStates } from "@/domain/validations";
import type { ViewDefinition } from "@/lib/view-definition";
import { vocabulary } from "@/lib/view-definition";

export const reviewStateLabels = {
  Needed: "Review needed",
  Denied: "Denied in review",
  Approved: "Accepted",
} as const satisfies Record<ReviewedState, string>;

const priorityLabels = {
  Urgent: "Urgent",
  High: "High",
  Normal: "Normal",
  Low: "Low",
} as const satisfies Record<Priority, string>;

export const validationsView: ViewDefinition<ValidationQuery, never> = {
  view: "validations",
  toSearchParams: toValidationSearchParams,
  parseSearchParams: parseValidationSearchParams,
  isSameQuery: isSameValidationQuery,
  fields: [
    {
      key: "reviews",
      label: "Review",
      field: vocabulary(reviewedStates, reviewStateLabels),
      isQuick: true,
    },
    {
      key: "categoryIds",
      label: "Category",
      field: { kind: "reference", reference: "categories" },
      isQuick: true,
    },
    { key: "forbidden", label: "Forbidden", field: vocabulary(answers, answerLabels) },
    { key: "plugins", label: "Defect", field: { kind: "reference", reference: "defectPlugins" } },
    {
      key: "priorities",
      label: "Priority",
      field: vocabulary(priorities.toReversed(), priorityLabels),
    },
    { key: "projectIds", label: "Project", field: { kind: "reference", reference: "projects" } },
    { key: "waiting", label: "Waiting since", field: { kind: "dateRange" } },
  ],
  groupings: [],
  groupingParam: "group",
};
