// The Proposals list, one row per document (page-proposals.js rowOf). Like Documents it lays out
// by its own width: stacked cards when narrow, table rows on a subgrid once wide. Under each row
// one line says why it is here: a copy that makes approving a rescan, checks still running, the
// project, and the askers' reason verbatim, or how many reasons there are when they differ, so
// that no one asker's reason stands for the rest.
// TODO(rrandiak): render only the visible rows once lists run to thousands loaded; labels move
// to i18n.

import type { ReactElement, ReactNode } from "react";
import { Fragment } from "react";
import type { ProposalGroup, ProposalGrouping } from "@/api/proposal-review";
import { proposalGroupingSchema, proposalGroupings } from "@/api/proposal-review";
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
import { useLoadMore } from "@/hooks/use-load-more";
import { formatDay } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const columns = [
  { key: "document", label: "Document" },
  { key: "status", label: "Status" },
  { key: "askers", label: "Askers", isNumeric: true },
  { key: "pages", label: "Pages", isNumeric: true },
  { key: "asked", label: "Asked", isNumeric: true },
  { key: "copy", label: "Existing copy" },
] as const;

type ColumnKey = (typeof columns)[number]["key"];

// Literal, so Tailwind sees it. Its tracks match `columns` above.
const tableTemplate =
  "@2xl:grid-cols-[minmax(9rem,1fr)_fit-content(9rem)_max-content_max-content_max-content_fit-content(9rem)]";

const groupingLabels = {
  batch: "Group by batch",
  requester: "Group by requester",
} as const satisfies Record<ProposalGrouping, string>;

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
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  grouping: ProposalGrouping | null;
  onGroupingChange: (grouping: ProposalGrouping | null) => void;
  references: ProposalReferences;
  // Absent where nothing may be approved in bulk.
  onBulkApprove?: (group: Extract<ProposalGroup, { kind: "batch" }>) => void;
  selectedId: string | null;
  onSelect: (documentId: string) => void;
}

export function ProposalList({
  items = [],
  groups,
  total,
  askTotal,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  grouping,
  onGroupingChange,
  references,
  onBulkApprove,
  selectedId,
  onSelect,
}: ProposalListProps) {
  const sentinelRef = useLoadMore(hasMore, isLoadingMore, onLoadMore);
  const groupStarts = groupStartsOf(groups);
  const count =
    total === undefined || askTotal === undefined
      ? "Proposals"
      : `${plural(total, "document")} · ${plural(askTotal, "ask")}`;

  return (
    <>
      <div className="sticky top-0 z-20 flex h-10 items-center gap-2 border-b bg-background px-4">
        <span className="text-[0.6875rem] font-bold tracking-wider text-muted-foreground uppercase">
          {count}
        </span>
        <select
          aria-label="Group the list"
          className="ml-auto h-7 rounded-md border bg-background px-2 text-xs text-muted-foreground"
          value={grouping ?? ""}
          onChange={(event) => {
            const picked = proposalGroupingSchema.safeParse(event.target.value);
            onGroupingChange(picked.success ? picked.data : null);
          }}
        >
          <option value="">No grouping</option>
          {proposalGroupings.map((option) => (
            <option key={option} value={option}>
              {groupingLabels[option]}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading proposals…</p>}

      {total === 0 && (
        <p className="p-4 text-sm text-muted-foreground">Nothing is waiting for a decision.</p>
      )}

      {items.length > 0 && (
        <div className={cn("@2xl:grid @2xl:content-start", tableTemplate)}>
          <div
            aria-hidden
            className="sticky top-10 z-10 hidden border-b bg-muted text-[0.6875rem] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase @2xl:col-span-full @2xl:grid @2xl:grid-cols-subgrid"
          >
            {columns.map((column) => (
              <span
                key={column.key}
                className={cn(
                  "px-2.5 py-2 first:pl-4 last:pr-4",
                  "isNumeric" in column && "text-right",
                )}
              >
                {column.label}
              </span>
            ))}
          </div>

          {items.map((row, index) => {
            const documentId = row.record.document.id;
            const isSelected = documentId === selectedId;
            const groupStart = groupStarts.get(index);
            const homeBatchId =
              grouping === "batch" ? (firstAskOf(row)?.batchId ?? null) : undefined;
            const cells = cellsOf(row, references);
            return (
              <Fragment key={documentId}>
                {groupStart !== undefined && (
                  <ProposalGroupHeader
                    group={groupStart}
                    users={references.users}
                    onBulkApprove={onBulkApprove}
                  />
                )}
                <button
                  type="button"
                  onClick={() => onSelect(documentId)}
                  aria-current={isSelected || undefined}
                  className={cn(
                    "block w-full border-b px-4 py-3 text-left hover:bg-muted",
                    "@2xl:col-span-full @2xl:grid @2xl:grid-cols-subgrid @2xl:items-center @2xl:px-0 @2xl:pt-0 @2xl:pb-2.5",
                    isSelected && "bg-secondary shadow-[inset_3px_0_0_var(--primary)]",
                  )}
                >
                  <span className="block @2xl:hidden">
                    <span className="block text-xs text-muted-foreground">
                      <span className="font-mono">{documentIdentifierOf(row.record.document)}</span>{" "}
                      · {custodyNamesOf(row, references.custodies)}
                    </span>
                    <span className="mt-0.5 mb-1.5 block text-sm leading-snug font-medium">
                      {row.record.document.title}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <ProposalStatusBadge row={row} />
                      <span className="text-xs text-muted-foreground">
                        {plural(askerIdsOf(row).length, "asker")}
                      </span>
                      {isRescan(row) && cells.copy}
                    </span>
                  </span>

                  <span className="hidden @2xl:contents">
                    {columns.map((column) => (
                      <span
                        key={column.key}
                        className={cn(
                          "min-w-0 px-2.5 pt-2.5 pb-1 text-[0.8125rem] first:pl-4 last:pr-4 [&_[data-slot=badge]]:rounded-md [&_[data-slot=badge]]:whitespace-normal",
                          "isNumeric" in column && "text-right tabular-nums",
                        )}
                      >
                        {cells[column.key]}
                      </span>
                    ))}
                  </span>

                  <span className="mt-1.5 block text-xs leading-snug text-muted-foreground @2xl:col-span-full @2xl:mt-0 @2xl:px-4">
                    <WhyLine row={row} references={references} homeBatchId={homeBatchId} />
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>
      )}

      <div ref={sentinelRef} aria-hidden />
      {isLoadingMore && (
        <p className="p-4 text-center text-xs text-muted-foreground">Loading more proposals…</p>
      )}
    </>
  );
}

function cellsOf(row: ProposalRow, references: ProposalReferences): Record<ColumnKey, ReactNode> {
  const { document } = row.record;
  const pages = effectivePageCount(document);
  const first = firstAskOf(row);
  const [copy] = existingCopiesOf(asksOf(row));
  return {
    document: (
      <>
        <span className="block text-[0.8125rem] leading-snug font-medium">{document.title}</span>
        <span className="mt-0.5 block truncate text-[0.6875rem] text-muted-foreground">
          <span className="font-mono">{documentIdentifierOf(document)}</span> ·{" "}
          {custodyNamesOf(row, references.custodies)}
        </span>
      </>
    ),
    status: <ProposalStatusBadge row={row} />,
    askers: askerIdsOf(row).length,
    pages: pages === null ? <Muted>—</Muted> : pages.value.toLocaleString("en-US"),
    asked: first === undefined || first === null ? null : <Muted>{formatDay(first.at)}</Muted>,
    copy: copy === undefined ? <Muted>—</Muted> : <CopyBadge copy={copy} />,
  };
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

// The row index each group starts at. A group running on from the previous slice comes back
// with the next one's headers, and opens no second header.
function groupStartsOf(groups: readonly ProposalGroup[]): Map<number, ProposalGroup> {
  const starts = new Map<number, ProposalGroup>();
  let rowIndex = 0;
  let previousKey: string | null | undefined;
  for (const group of groups) {
    const key = group.kind === "batch" ? (group.batch?.id ?? null) : group.userId;
    if (key !== previousKey) {
      starts.set(rowIndex, group);
    }

    previousKey = key;
    rowIndex += group.rowCount;
  }

  return starts;
}

export function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
