// One iteration beside the Documents Validations list (page-validation.js render): its heading,
// what holds it and the record behind it.
// TODO(rrandiak): the defect cards, accepted defects and fixes in place; labels move to i18n.

import type { ValidationDetail } from "@/api/validations";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import { categoryLabelOf } from "@/components/classification-fields";
import { visibleNavigation } from "@/components/layout/navigation";
import { RecordHeading } from "@/components/record-cards";
import { documentIdentifierOf } from "@/domain/documents";
import type { Session } from "@/domain/entities";
import { useCategoriesQuery } from "@/hooks/use-reference-query";

interface ValidationDetailPaneProps {
  detail: ValidationDetail;
  session: Session;
}

export function ValidationDetailPane({ detail, session }: ValidationDetailPaneProps) {
  const { row } = detail;
  const { document, iteration } = row;
  const { data: categories = [] } = useCategoriesQuery();
  const documents = visibleNavigation(session).find((entry) => entry.id === "documents");

  const headingActions: ViewAction[] = [];
  if (documents !== undefined) {
    headingActions.push({
      id: "documents",
      label: `Open in ${documents.visibleLabel} →`,
      href: `${documents.path}?id=${encodeURIComponent(document.id)}`,
    });
  }

  return (
    <article className="@container max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-x-4">
        <RecordHeading
          title={document.title}
          identifier={documentIdentifierOf(document)}
          details={[categoryLabelOf(categories, iteration.categoryId)]}
        />
        <ActionBar actions={headingActions} className="mb-4" />
      </div>
    </article>
  );
}
