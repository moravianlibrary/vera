// The Requests list on RecordList (components/lists/record-list.tsx), one row per document
// (page-proposals.js rowOf). Under each row one line says why it is here: a copy that makes
// approving a rescan, checks still running, the project, and the askers' reason verbatim, or how
// many reasons there are when they differ, so that no one asker's reason stands for the rest.

import type { RequestGroup, RequestGrouping } from "@vera/contract/requests";
import { documentIdentifierOf, effectivePageCount, existingCopiesOf } from "@vera/domain/documents";
import type { ExistingCopy, Project, RequestCustody, User } from "@vera/domain/entities";
import type { RequestRow } from "@vera/domain/requests";
import {
  askerIdsOf,
  asksOf,
  batchIdsOf,
  firstAskOf,
  isAfterProjectApproval,
  isBeingChecked,
  isRescan,
  projectIdsOf,
  reasonsOf,
} from "@vera/domain/requests";
import type { ReactElement } from "react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Muted } from "@/components/detail-card";
import { existingCopyLabels } from "@/components/filters/value-labels";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { RecordList } from "@/components/lists/record-list";
import type { QueryFailure } from "@/components/query-state";
import { ToneBadge } from "@/components/status-badge";
import { RequestGroupHeader } from "@/features/requests/request-group-header";
import { RequestStatusBadge } from "@/features/requests/request-status";
import { requestsView } from "@/features/requests/requests-view";
import type { PagedList } from "@/hooks/use-paged-list";
import { useIsShownBatch } from "@/hooks/use-reference-query";
import { i18n } from "@/i18n";
import { formatDay } from "@/lib/format-date";

export interface RequestReferences {
  users: readonly User[];
  projects: readonly Project[];
  custodies: readonly RequestCustody[];
}

interface RequestListProps {
  items: RequestRow[] | undefined;
  groups: readonly RequestGroup[];
  total: number | undefined;
  askTotal: number | undefined;
  isLoading: boolean;
  failure?: QueryFailure;
  paging: PagedList;
  grouping: RequestGrouping | null;
  onGroupingChange: (grouping: RequestGrouping | null) => void;
  references: RequestReferences;
  // Absent where nothing may be approved in bulk.
  onBulkApprove?: (group: Extract<RequestGroup, { kind: "batch" }>) => void;
  selectedId: string | null;
  onSelect: (documentId: string) => void;
}

export function RequestList({
  items,
  groups,
  total,
  askTotal,
  isLoading,
  failure,
  paging,
  grouping,
  onGroupingChange,
  references,
  onBulkApprove,
  selectedId,
  onSelect,
}: RequestListProps) {
  const { t } = useTranslation("requests");
  const count =
    total === undefined || askTotal === undefined
      ? t("page.title")
      : `${t("count.document", { count: total })} · ${t("count.ask", { count: askTotal })}`;

  return (
    <RecordList
      rows={items}
      rowId={(row) => row.record.document.id}
      total={total}
      columns={requestColumns(references)}
      card={{
        eyebrow: (row) => (
          <>
            <span className="font-mono">{documentIdentifierOf(row.record.document)}</span> ·{" "}
            {custodyNamesOf(row, references.custodies)}
          </>
        ),
        title: (row) => row.record.document.title,
        meta: (row) => (
          <>
            <RequestStatusBadge row={row} />
            <span className="text-xs text-muted-foreground">
              {t("count.asker", { count: askerIdsOf(row).length })}
            </span>
            {isRescan(row) && <CopyCell row={row} />}
          </>
        ),
      }}
      whyOf={(row) => (
        <WhyLine
          row={row}
          references={references}
          homeBatchId={grouping === "batch" ? (firstAskOf(row)?.batchId ?? null) : undefined}
        />
      )}
      toolbar={{
        count,
        groupings: {
          options: requestsView.groupings,
          value: grouping,
          onChange: onGroupingChange,
        },
      }}
      groups={{
        items: groups,
        keyOf: (group) => (group.kind === "batch" ? (group.batch?.id ?? null) : group.userId),
        header: (group) => (
          <RequestGroupHeader
            group={group}
            users={references.users}
            onBulkApprove={onBulkApprove}
          />
        ),
      }}
      paging={paging}
      isLoading={isLoading}
      failure={failure}
      selectedId={selectedId}
      onSelect={onSelect}
      loadingText={t("list.loading")}
      emptyText={t("list.empty")}
      loadingMoreText={t("list.loadingMore")}
    />
  );
}

export function requestColumns(references: RequestReferences): ColumnDefinition<RequestRow>[] {
  return [
    {
      key: "document",
      header: "requests:column.document",
      track: "minmax(9rem,1fr)",
      cell: (row) => (
        <>
          <span className="block text-ui leading-snug font-medium">
            {row.record.document.title}
          </span>
          <span className="mt-0.5 block truncate text-caption text-muted-foreground">
            <span className="font-mono">{documentIdentifierOf(row.record.document)}</span> ·{" "}
            {custodyNamesOf(row, references.custodies)}
          </span>
        </>
      ),
    },
    {
      key: "status",
      header: "requests:column.status",
      track: "fit-content(9rem)",
      cell: (row) => <RequestStatusBadge row={row} />,
    },
    {
      key: "askers",
      header: "requests:column.askers",
      track: "max-content",
      isNumeric: true,
      cell: (row) => askerIdsOf(row).length,
    },
    {
      key: "pages",
      header: "requests:column.pages",
      track: "max-content",
      isNumeric: true,
      cell: (row) => {
        const pages = effectivePageCount(row.record.document);
        return pages === null ? <Muted>—</Muted> : pages.value.toLocaleString("en-US");
      },
    },
    {
      key: "asked",
      header: "requests:column.asked",
      track: "max-content",
      isNumeric: true,
      cell: (row) => {
        const first = firstAskOf(row);
        return first === undefined || first === null ? null : <Muted>{formatDay(first.at)}</Muted>;
      },
    },
    {
      key: "copy",
      header: "requests:column.existingCopy",
      track: "fit-content(9rem)",
      cell: (row) => <CopyCell row={row} />,
    },
  ];
}

function CopyCell({ row }: { row: RequestRow }) {
  const [copy] = existingCopiesOf(asksOf(row));
  return copy === undefined ? <Muted>—</Muted> : <CopyBadge copy={copy} />;
}

// The custodies it was placed in; the fallback says so.
export function custodyNamesOf(row: RequestRow, custodies: readonly RequestCustody[]): string {
  return row.custodyIds
    .map((custodyId) => {
      const custody = custodies.find((candidate) => candidate.id === custodyId);
      if (custody === undefined) {
        return custodyId;
      }

      return custody.isFallback ? i18n.t("requests:copy.fallback") : custody.name;
    })
    .join(", ");
}

// The copy's link lives in the pane: a row is one button, and holds nothing else to press.
function CopyBadge({ copy }: { copy: ExistingCopy }) {
  const { t } = useTranslation("common");
  const state = copy.state === "NotFound" ? copy.state : t(existingCopyLabels[copy.state]);
  return <ToneBadge tone="purple">{`${copy.source}: ${state}`}</ToneBadge>;
}

interface WhyLineProps {
  row: RequestRow;
  references: RequestReferences;
  // The batch the row is listed under when grouped by batch; undefined otherwise.
  homeBatchId: string | null | undefined;
}

function WhyLine({ row, references, homeBatchId }: WhyLineProps) {
  const { t } = useTranslation("requests");
  const first = firstAskOf(row);
  const isShownBatch = useIsShownBatch();
  if (row.decision === "Denied" && first?.decision === "Denied") {
    return (
      <>
        <b className="font-semibold text-tone-red-foreground">{t("list.declinedPrefix")}</b>{" "}
        {first.decline.publicText}
      </>
    );
  }

  if (row.decision === "Withdrawn" && first?.decision === "Withdrawn") {
    return (
      <>
        <b className="font-semibold">{t("status.withdrawn")}</b> {formatDay(first.withdrawnAt)}
        {first.reason !== null && ` — “${first.reason}”`}
      </>
    );
  }

  const parts: ReactElement[] = [];
  const [copy] = existingCopiesOf(asksOf(row));
  if (copy !== undefined) {
    parts.push(
      <b key="copy" className="font-semibold text-tone-purple-foreground">
        {t("list.copyAlreadyHas", { source: copy.source })}
      </b>,
    );
  } else if (isBeingChecked(row)) {
    parts.push(
      <b key="checking" className="font-semibold">
        {t("list.checksRunning")}
      </b>,
    );
  }

  for (const projectId of projectIdsOf(row)) {
    const project = references.projects.find((candidate) => candidate.id === projectId);
    if (project === undefined) {
      continue;
    }

    const note = isAfterProjectApproval(row)
      ? t("list.afterProjectApproval")
      : project.state === "Proposed"
        ? t("list.projectProposed")
        : null;
    parts.push(
      <span key={project.id}>
        <span className="font-medium text-foreground">{project.name}</span>
        {note !== null && ` ${note}`}
      </span>,
    );
  }

  const reasons = reasonsOf(row);
  const [onlyReason] = reasons;
  parts.push(
    reasons.length > 1 ? (
      <b key="reasons" className="font-semibold">
        {t("list.reasonCount", { count: reasons.length })}
      </b>
    ) : onlyReason !== undefined ? (
      <span key="reasons">“{onlyReason}”</span>
    ) : (
      <i key="reasons">{t("fact.noReason")}</i>
    ),
  );

  if (homeBatchId !== undefined) {
    const elsewhere = batchIdsOf(row).filter(
      (batchId) => batchId !== homeBatchId && isShownBatch(batchId),
    );
    if (elsewhere.length > 0) {
      parts.push(
        <span key="elsewhere">{t("list.askedElsewhere", { batches: elsewhere.join(", ") })}</span>,
      );
    }
  }

  return parts.map((part, index) => (
    <Fragment key={part.key}>
      {index > 0 && " · "}
      {part}
    </Fragment>
  ));
}
