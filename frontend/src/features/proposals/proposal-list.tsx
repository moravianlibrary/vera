// The Proposals list on RecordList (components/lists/record-list.tsx), one row per document
// (page-proposals.js rowOf). Under each row one line says why it is here: a copy that makes
// approving a rescan, checks still running, the project, and the askers' reason verbatim, or how
// many reasons there are when they differ, so that no one asker's reason stands for the rest.
// TODO(rrandiak): labels move to i18n.

import type { ReactElement } from "react";
import { Fragment } from "react";
import type { ProposalGroup, ProposalGrouping } from "@/api/proposal-review";
import { Muted } from "@/components/detail-card";
import type { ColumnDefinition } from "@/components/lists/record-list";
import { RecordList } from "@/components/lists/record-list";
import { ToneBadge } from "@/components/status-badge";
import { documentIdentifierOf, effectivePageCount, existingCopiesOf } from "@/domain/documents";
import type { ExistingCopy, Project, ProposalCustody, User } from "@/domain/entities";
import type { ProposalRow } from "@/domain/proposal-review";
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
} from "@/domain/proposal-review";
import { ProposalGroupHeader } from "@/features/proposals/proposal-group-header";
import { ProposalStatusBadge } from "@/features/proposals/proposal-status";
import { proposalsView } from "@/features/proposals/proposals-view";
import type { PagedList } from "@/hooks/use-paged-list";
import { formatDay } from "@/lib/format-date";
import { plural } from "@/lib/plural";

export interface ProposalReferences {
  users: readonly User[];
  projects: readonly Project[];
  custodies: readonly ProposalCustody[];
}

interface ProposalListProps {
  items: ProposalRow[] | undefined;
  groups: readonly ProposalGroup[];
  total: number | undefined;
  askTotal: number | undefined;
  isLoading: boolean;
  paging: PagedList;
  grouping: ProposalGrouping | null;
  onGroupingChange: (grouping: ProposalGrouping | null) => void;
  references: ProposalReferences;
  // Absent where nothing may be approved in bulk.
  onBulkApprove?: (group: Extract<ProposalGroup, { kind: "batch" }>) => void;
  selectedId: string | null;
  onSelect: (documentId: string) => void;
}

export function ProposalList({
  items,
  groups,
  total,
  askTotal,
  isLoading,
  paging,
  grouping,
  onGroupingChange,
  references,
  onBulkApprove,
  selectedId,
  onSelect,
}: ProposalListProps) {
  const count =
    total === undefined || askTotal === undefined
      ? "Proposals"
      : `${plural(total, "document")} · ${plural(askTotal, "ask")}`;

  return (
    <RecordList
      rows={items}
      rowId={(row) => row.record.document.id}
      total={total}
      columns={columnsOf(references)}
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
            <ProposalStatusBadge row={row} />
            <span className="text-xs text-muted-foreground">
              {plural(askerIdsOf(row).length, "asker")}
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
          options: proposalsView.groupings,
          value: grouping,
          onChange: onGroupingChange,
        },
      }}
      groups={{
        items: groups,
        keyOf: (group) => (group.kind === "batch" ? (group.batch?.id ?? null) : group.userId),
        header: (group) => (
          <ProposalGroupHeader
            group={group}
            users={references.users}
            onBulkApprove={onBulkApprove}
          />
        ),
      }}
      paging={paging}
      isLoading={isLoading}
      selectedId={selectedId}
      onSelect={onSelect}
      loadingText="Loading proposals…"
      emptyText="Nothing is waiting for a decision."
      loadingMoreText="Loading more proposals…"
    />
  );
}

function columnsOf(references: ProposalReferences): ColumnDefinition<ProposalRow>[] {
  return [
    {
      key: "document",
      header: "Document",
      track: "minmax(9rem,1fr)",
      cell: (row) => (
        <>
          <span className="block text-[0.8125rem] leading-snug font-medium">
            {row.record.document.title}
          </span>
          <span className="mt-0.5 block truncate text-[0.6875rem] text-muted-foreground">
            <span className="font-mono">{documentIdentifierOf(row.record.document)}</span> ·{" "}
            {custodyNamesOf(row, references.custodies)}
          </span>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      track: "fit-content(9rem)",
      cell: (row) => <ProposalStatusBadge row={row} />,
    },
    {
      key: "askers",
      header: "Askers",
      track: "max-content",
      isNumeric: true,
      cell: (row) => askerIdsOf(row).length,
    },
    {
      key: "pages",
      header: "Pages",
      track: "max-content",
      isNumeric: true,
      cell: (row) => {
        const pages = effectivePageCount(row.record.document);
        return pages === null ? <Muted>—</Muted> : pages.value.toLocaleString("en-US");
      },
    },
    {
      key: "asked",
      header: "Asked",
      track: "max-content",
      isNumeric: true,
      cell: (row) => {
        const first = firstAskOf(row);
        return first === undefined || first === null ? null : <Muted>{formatDay(first.at)}</Muted>;
      },
    },
    {
      key: "copy",
      header: "Existing copy",
      track: "fit-content(9rem)",
      cell: (row) => <CopyCell row={row} />,
    },
  ];
}

function CopyCell({ row }: { row: ProposalRow }) {
  const [copy] = existingCopiesOf(asksOf(row));
  return copy === undefined ? <Muted>—</Muted> : <CopyBadge copy={copy} />;
}

// The custodies it was placed in; the fallback says so.
export function custodyNamesOf(row: ProposalRow, custodies: readonly ProposalCustody[]): string {
  return row.custodyIds
    .map((custodyId) => {
      const custody = custodies.find((candidate) => candidate.id === custodyId);
      if (custody === undefined) {
        return custodyId;
      }

      return custody.isFallback ? "fallback" : custody.name;
    })
    .join(", ");
}

// The copy's link lives in the pane: a row is one button, and holds nothing else to press.
function CopyBadge({ copy }: { copy: ExistingCopy }) {
  return <ToneBadge tone="purple">{`${copy.source}: ${copy.state}`}</ToneBadge>;
}

interface WhyLineProps {
  row: ProposalRow;
  references: ProposalReferences;
  // The batch the row is listed under when grouped by batch; undefined otherwise.
  homeBatchId: string | null | undefined;
}

function WhyLine({ row, references, homeBatchId }: WhyLineProps) {
  const first = firstAskOf(row);
  if (row.decision === "Denied" && first?.decision === "Denied") {
    return (
      <>
        <b className="font-semibold text-tone-red-foreground">Declined:</b>{" "}
        {first.decline.publicText}
      </>
    );
  }

  if (row.decision === "Withdrawn" && first?.decision === "Withdrawn") {
    return (
      <>
        <b className="font-semibold">Withdrawn</b> {formatDay(first.withdrawnAt)}
        {first.reason !== null && ` — “${first.reason}”`}
      </>
    );
  }

  const parts: ReactElement[] = [];
  const [copy] = existingCopiesOf(asksOf(row));
  if (copy !== undefined) {
    parts.push(
      <b key="copy" className="font-semibold text-tone-purple-foreground">
        {copy.source} already has it
      </b>,
    );
  } else if (isBeingChecked(row)) {
    parts.push(
      <b key="checking" className="font-semibold">
        Checks still running
      </b>,
    );
  }

  for (const projectId of projectIdsOf(row)) {
    const project = references.projects.find((candidate) => candidate.id === projectId);
    if (project === undefined) {
      continue;
    }

    const note = isAfterProjectApproval(row)
      ? "after the project's approval"
      : project.state === "Proposed"
        ? "project proposed"
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
        {reasons.length} reasons
      </b>
    ) : onlyReason !== undefined ? (
      <span key="reasons">“{onlyReason}”</span>
    ) : (
      <i key="reasons">no reason given</i>
    ),
  );

  if (homeBatchId !== undefined) {
    const elsewhere = batchIdsOf(row).filter((batchId) => batchId !== homeBatchId);
    if (elsewhere.length > 0) {
      parts.push(<span key="elsewhere">also asked in {elsewhere.join(", ")}</span>);
    }
  }

  return parts.map((part, index) => (
    <Fragment key={part.key}>
      {index > 0 && " · "}
      {part}
    </Fragment>
  ));
}
