// The Documents view's declaration (component-interfaces.md §9.2): its filter in the URL, the
// watchlist comparer and its groupings.
// TODO(rrandiak): labels move to i18n.

import type { DocumentGrouping, DocumentQuery } from "@/api/documents";
import {
  documentGroupingParam,
  isSameDocumentQuery,
  parseDocumentSearchParams,
  toDocumentSearchParams,
} from "@/api/documents";
import type { ViewDefinition } from "@/lib/view-definition";

export const documentsView: ViewDefinition<DocumentQuery, DocumentGrouping> = {
  view: "documents",
  toSearchParams: toDocumentSearchParams,
  parseSearchParams: parseDocumentSearchParams,
  isSameQuery: isSameDocumentQuery,
  groupings: [
    { value: "batch", label: "Group by batch" },
    { value: "project", label: "Group by project" },
  ],
  groupingParam: documentGroupingParam,
};
