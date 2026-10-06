// The Documents Validations list on RecordList (components/lists/record-list.tsx), one row per
// iteration (page-validation.js rowOf). Under each row one line says why it is here: the rule
// that forbade it, the denial, what was accepted, or the defects still to rule on, verbatim when
// there is one and counted when there are several, so that no one of them stands for the rest.
// Grouped, a header opens each category or defect.
// TODO(rrandiak): labels move to i18n.

import type { ReactElement } from "react";
import { Fragment } from "react";
import type { ValidationGroup, ValidationGrouping } from "@/api/validations";
import { severalPlugins } from "@/api/validations";
import { categoryLabelOf } from "@/components/classification-fields";
import { Muted } from "@/components/detail-card";
import { GroupHeader } from "@/components/lists/group-header";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { RecordList } from "@/components/lists/record-list";
import { PriorityBadge, StatusWithFootnote } from "@/components/status-badge";
import { documentIdentifierOf } from "@/domain/documents";
import type { Category } from "@/domain/entities";
import { iterationStatusOf, outstandingDefects, statusFootnoteOf } from "@/domain/status";
import type { ReviewedState, ValidationRow } from "@/domain/validations";
import {
  acceptedDefectsOf,
  defectNameOf,
  deniedDefectsOf,
  isFoundAfterScan,
} from "@/domain/validations";
import { validationsView } from "@/features/validations/validations-view";
import type { PagedList } from "@/hooks/use-paged-list";
import { formatDay } from "@/lib/format-date";
import { plural } from "@/lib/plural";

interface ValidationListProps {
  items: ValidationRow[] | undefined;
  // The headers of every loaded slice, in order; empty when not grouped.
  groups: readonly ValidationGroup[];
  grouping: ValidationGrouping | null;
  onGroupingChange: (grouping: ValidationGrouping | null) => void;
  total: number | undefined;
  outstandingTotal: number | undefined;
  isLoading: boolean;
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
  paging,
  categories,
  reviews,
  selectedId,
  onSelect,
}: ValidationListProps) {
  const leafOf = (categoryId: string) =>
    categories.find((category) => category.id === categoryId)?.name ?? categoryId;
  const count =
    total === undefined
      ? "Documents"
      : [plural(total, "document"), outstandingTotal ? `${outstandingTotal} outstanding` : null]
          .filter((part) => part !== null)
          .join(" · ");

  return (
    <RecordList
      rows={items}
      rowId={(row) => row.iteration.id}
      total={total}
      columns={columnsOf(leafOf)}
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
                  {outstanding.length} outstanding
                </span>
              )}
            </>
          );
        },
      }}
      whyOf={(row) => <WhyLine row={row} />}
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
        header: (group) => <ValidationGroupHeader group={group} categories={categories} />,
      }}
      paging={paging}
      isLoading={isLoading}
      selectedId={selectedId}
      onSelect={onSelect}
      loadingText="Loading what waits for review…"
      emptyText={emptyTextOf(reviews)}
      loadingMoreText="Loading more…"
    />
  );
}

function groupKeyOf(group: ValidationGroup): string | null {
  return group.kind === "category" ? group.categoryId : group.plugin;
}

// A category by its path; a defect by its plugin, or the rows it cannot name one for.
function ValidationGroupHeader({
  group,
  categories,
}: {
  group: ValidationGroup;
  categories: readonly Category[];
}) {
  const title =
    group.kind === "category"
      ? categoryLabelOf(categories, group.categoryId)
      : group.plugin === null
        ? "Nothing left to rule on"
        : group.plugin === severalPlugins
          ? "Defects of several kinds"
          : group.plugin;

  return (
    <GroupHeader
      title={<b className="font-semibold">{title}</b>}
      meta={plural(group.total, "document")}
    />
  );
}

function emptyTextOf(reviews: readonly ReviewedState[] | undefined): string {
  const [only] = reviews ?? [];
  if (reviews?.length === 1 && only === "Needed") {
    return "Nothing needs review in your custody.";
  }

  return "Nothing in your custody matches.";
}

function columnsOf(leafOf: (categoryId: string) => string): ColumnDefinition<ValidationRow>[] {
  return [
    {
      key: "document",
      header: "Document",
      track: "minmax(9rem,1fr)",
      cell: (row) => (
        <>
          <span className="block text-[0.8125rem] leading-snug font-medium">
            {row.document.title}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[0.6875rem] text-muted-foreground">
            {documentIdentifierOf(row.document)}
          </span>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      track: "fit-content(9rem)",
      cell: (row) => <IterationStatus row={row} />,
    },
    {
      key: "defects",
      header: "Defects",
      track: "max-content",
      isNumeric: true,
      cell: (row) => {
        const count = row.review === "Needed" ? outstandingDefects(row.iteration).length : 0;
        return count === 0 ? <Muted>—</Muted> : count;
      },
    },
    {
      key: "priority",
      header: "Priority",
      track: "fit-content(5rem)",
      cell: (row) => <PriorityBadge priority={row.iteration.priority} />,
    },
    {
      key: "category",
      header: "Category",
      track: "fit-content(7rem)",
      cell: (row) => <Muted>{leafOf(row.iteration.categoryId)}</Muted>,
    },
    {
      key: "since",
      header: "Since",
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

function WhyLine({ row }: { row: ValidationRow }) {
  const { iteration } = row;

  if (row.review === "Forbidden" && iteration.restriction !== null) {
    return (
      <>
        <b className="font-semibold text-tone-red-foreground">
          Forbidden by {iteration.restriction.rule}:
        </b>{" "}
        {iteration.restriction.internalText ?? iteration.restriction.publicText}
      </>
    );
  }

  if (row.review === "Denied") {
    const denial = iteration.verdicts.findLast((verdict) => verdict.verdict === "Denied");
    return (
      <>
        <b className="font-semibold text-tone-red-foreground">Denied:</b>{" "}
        {denial?.note || denial?.publicText || "ruled substantial"}
        {" · "}
        {deniedDefectsOf(iteration).map(defectNameOf).join(", ")}
      </>
    );
  }

  if (row.review === "Approved") {
    return (
      <>
        <b className="font-semibold">Accepted</b> — {plural(iteration.defects.length, "defect")}{" "}
        ruled tolerable
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
        Found after digitization
      </b>,
    );
  }

  parts.push(
    outstanding.length > 1 || onlyDefect === undefined ? (
      <span key="defects">
        <b className="font-semibold">{plural(outstanding.length, "defect")}</b> —{" "}
        {outstanding.map(defectNameOf).join(", ")}
      </span>
    ) : (
      <span key="defects">
        <b className="font-semibold">{defectNameOf(onlyDefect)}</b> ·{" "}
        {onlyDefect.internalText ?? onlyDefect.publicText}
      </span>
    ),
  );

  if (acceptedCount > 0) {
    parts.push(<span key="accepted">{acceptedCount} already accepted, not shown again</span>);
  }

  return parts.map((part, index) => (
    <Fragment key={part.key}>
      {index > 0 && " · "}
      {part}
    </Fragment>
  ));
}
