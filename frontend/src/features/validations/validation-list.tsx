// The Documents Validations list on RecordList (components/lists/record-list.tsx), one row per
// iteration (page-validation.js rowOf). Under each row one line says why it is here: the rule
// that forbade it, the denial, what was accepted, or the defects still to rule on, verbatim when
// there is one and counted when there are several, so that no one of them stands for the rest.
// Grouped, a header opens each category or defect.

import type { ValidationGroup, ValidationGrouping } from "@vera/contract/validations";
import { severalInstances } from "@vera/contract/validations";
import { documentIdentifierOf } from "@vera/domain/documents";
import type { Category } from "@vera/domain/entities";
import { iterationStatusOf, outstandingDefects, statusFootnoteOf } from "@vera/domain/status";
import type { ReviewedState, ValidationRow } from "@vera/domain/validations";
import {
  acceptedDefectsOf,
  defectNameOf,
  deniedDefectsOf,
  isFoundAfterScan,
} from "@vera/domain/validations";
import type { ReactElement } from "react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { categoryLabelOf } from "@/components/classification-fields";
import { Muted } from "@/components/detail-card";
import { GroupHeader } from "@/components/lists/group-header";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { RecordList } from "@/components/lists/record-list";
import type { QueryFailure } from "@/components/query-state";
import { PriorityBadge, StatusWithFootnote } from "@/components/status-badge";
import { validationsView } from "@/features/validations/validations-view";
import type { PagedList } from "@/hooks/use-paged-list";
import { useReferenceLabels } from "@/hooks/use-reference-labels";
import { i18n } from "@/i18n";
import { formatDay } from "@/lib/format-date";

interface ValidationListProps {
  items: ValidationRow[] | undefined;
  // The headers of every loaded slice, in order; empty when not grouped.
  groups: readonly ValidationGroup[];
  grouping: ValidationGrouping | null;
  onGroupingChange: (grouping: ValidationGrouping | null) => void;
  total: number | undefined;
  outstandingTotal: number | undefined;
  isLoading: boolean;
  failure?: QueryFailure;
  paging: PagedList;
  categories: readonly Category[];
  // The review states the filter keeps, which the empty line speaks of.
  reviews: readonly ReviewedState[] | undefined;
  selectedId: string | null;
  onSelect: (iterationId: string) => void;
}

export function ValidationList({
  items,
  groups,
  grouping,
  onGroupingChange,
  total,
  outstandingTotal,
  isLoading,
  failure,
  paging,
  categories,
  reviews,
  selectedId,
  onSelect,
}: ValidationListProps) {
  const { t } = useTranslation("validations");
  const references = useReferenceLabels(["pluginInstances"]);
  const leafOf = (categoryId: string) =>
    categories.find((category) => category.id === categoryId)?.name ?? categoryId;
  const count =
    total === undefined
      ? t("page.title")
      : [
          t("count.document", { count: total }),
          outstandingTotal ? t("list.outstandingCount", { count: outstandingTotal }) : null,
        ]
          .filter((part) => part !== null)
          .join(" · ");

  return (
    <RecordList
      rows={items}
      rowId={(row) => row.iteration.id}
      total={total}
      columns={validationColumns(leafOf)}
      card={{
        eyebrow: (row) => (
          <>
            <span className="font-mono">{documentIdentifierOf(row.document)}</span> ·{" "}
            {leafOf(row.iteration.categoryId)}
          </>
        ),
        title: (row) => row.document.title,
        meta: (row) => {
          const outstanding = row.review === "Needed" ? outstandingDefects(row.iteration) : [];
          return (
            <>
              <IterationStatus row={row} />
              <PriorityBadge priority={row.iteration.priority} />
              {outstanding.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {t("list.outstandingCount", { count: outstanding.length })}
                </span>
              )}
            </>
          );
        },
      }}
      whyOf={(row) => <WhyLine row={row} instanceNameOf={references.pluginInstances} />}
      toolbar={{
        count,
        groupings: {
          options: validationsView.groupings,
          value: grouping,
          onChange: onGroupingChange,
        },
      }}
      groups={{
        items: groups,
        keyOf: groupKeyOf,
        header: (group) => (
          <ValidationGroupHeader
            group={group}
            categories={categories}
            instanceNameOf={references.pluginInstances}
          />
        ),
      }}
      paging={paging}
      isLoading={isLoading}
      failure={failure}
      selectedId={selectedId}
      onSelect={onSelect}
      loadingText={t("list.loading")}
      emptyText={emptyTextOf(reviews)}
      loadingMoreText={t("list.loadingMore")}
    />
  );
}

function groupKeyOf(group: ValidationGroup): string | null {
  return group.kind === "category" ? group.categoryId : group.instanceId;
}

// A category by its path; a defect by its instance, or the rows it cannot name one for.
function ValidationGroupHeader({
  group,
  categories,
  instanceNameOf,
}: {
  group: ValidationGroup;
  categories: readonly Category[];
  instanceNameOf: (id: string) => string;
}) {
  const { t } = useTranslation("validations");
  const title =
    group.kind === "category"
      ? categoryLabelOf(categories, group.categoryId)
      : group.instanceId === null
        ? t("group.nothing")
        : group.instanceId === severalInstances
          ? t("group.several")
          : instanceNameOf(group.instanceId);

  return (
    <GroupHeader
      title={<b className="font-semibold">{title}</b>}
      meta={t("count.document", { count: group.total })}
    />
  );
}

function emptyTextOf(reviews: readonly ReviewedState[] | undefined): string {
  const t = i18n.getFixedT(null, "validations");
  const [only] = reviews ?? [];
  if (reviews?.length === 1 && only === "Needed") {
    return t("list.emptyNeeded");
  }

  return t("list.emptyMatches");
}

export function validationColumns(
  leafOf: (categoryId: string) => string,
): ColumnDefinition<ValidationRow>[] {
  const t = i18n.getFixedT(null, "validations");
  return [
    {
      key: "document",
      header: t("column.document"),
      track: "minmax(9rem,1fr)",
      cell: (row) => (
        <>
          <span className="block text-ui leading-snug font-medium">{row.document.title}</span>
          <span className="mt-0.5 block truncate font-mono text-caption text-muted-foreground">
            {documentIdentifierOf(row.document)}
          </span>
        </>
      ),
    },
    {
      key: "status",
      header: t("column.status"),
      track: "fit-content(9rem)",
      cell: (row) => <IterationStatus row={row} />,
    },
    {
      key: "defects",
      header: t("column.defects"),
      track: "max-content",
      isNumeric: true,
      cell: (row) => {
        const count = row.review === "Needed" ? outstandingDefects(row.iteration).length : 0;
        return count === 0 ? <Muted>—</Muted> : count;
      },
    },
    {
      key: "priority",
      header: t("column.priority"),
      track: "fit-content(5rem)",
      cell: (row) => <PriorityBadge priority={row.iteration.priority} />,
    },
    {
      key: "category",
      header: t("column.category"),
      track: "fit-content(7rem)",
      cell: (row) => <Muted>{leafOf(row.iteration.categoryId)}</Muted>,
    },
    {
      key: "since",
      header: t("column.since"),
      track: "max-content",
      isNumeric: true,
      cell: (row) => <Muted>{formatDay(row.waitingSince)}</Muted>,
    },
  ];
}

export function IterationStatus({ row }: { row: ValidationRow }) {
  return (
    <StatusWithFootnote
      status={iterationStatusOf(row.iteration)}
      footnote={statusFootnoteOf(row.iteration)}
    />
  );
}

function WhyLine({
  row,
  instanceNameOf,
}: {
  row: ValidationRow;
  instanceNameOf: (id: string) => string;
}) {
  const { t } = useTranslation("validations");
  const { iteration } = row;

  if (row.review === "Forbidden" && iteration.restriction !== null) {
    return (
      <>
        <b className="font-semibold text-tone-red-foreground">
          {t("list.forbiddenBy", { rule: iteration.restriction.rule })}
        </b>{" "}
        {iteration.restriction.internalText ?? iteration.restriction.publicText}
      </>
    );
  }

  if (row.review === "Denied") {
    const denial = iteration.verdicts.findLast((verdict) => verdict.verdict === "Denied");
    return (
      <>
        <b className="font-semibold text-tone-red-foreground">{t("decision.denied")}:</b>{" "}
        {denial?.note || denial?.publicText || t("list.ruledSubstantial")}
        {" · "}
        {deniedDefectsOf(iteration)
          .map((defect) => defectNameOf(defect, instanceNameOf))
          .join(", ")}
      </>
    );
  }

  if (row.review === "Approved") {
    return (
      <>
        <b className="font-semibold">{t("review.accepted")}</b> —{" "}
        {t("count.defect", { count: iteration.defects.length })} {t("list.ruledTolerable")}
      </>
    );
  }

  const outstanding = outstandingDefects(iteration);
  const acceptedCount = acceptedDefectsOf(iteration).length;
  const [onlyDefect] = outstanding;
  const parts: ReactElement[] = [];
  if (isFoundAfterScan(iteration)) {
    parts.push(
      <b key="scanned" className="font-semibold text-tone-purple-foreground">
        {t("list.foundAfterDigitization")}
      </b>,
    );
  }

  parts.push(
    outstanding.length > 1 || onlyDefect === undefined ? (
      <span key="defects">
        <b className="font-semibold">{t("count.defect", { count: outstanding.length })}</b> —{" "}
        {outstanding.map((defect) => defectNameOf(defect, instanceNameOf)).join(", ")}
      </span>
    ) : (
      <span key="defects">
        <b className="font-semibold">{defectNameOf(onlyDefect, instanceNameOf)}</b> ·{" "}
        {onlyDefect.internalText ?? onlyDefect.publicText}
      </span>
    ),
  );

  if (acceptedCount > 0) {
    parts.push(<span key="accepted">{t("list.acceptedNotShown", { count: acceptedCount })}</span>);
  }

  return parts.map((part, index) => (
    <Fragment key={part.key}>
      {index > 0 && " · "}
      {part}
    </Fragment>
  ));
}
