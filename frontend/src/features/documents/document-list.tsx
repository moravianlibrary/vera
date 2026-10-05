// The Documents list. Its layout follows the room it has, not the viewport, so opening the
// sidebar or the record beside it changes it: a narrow list stacks each document as a card, a
// wide one reads as a table whose columns line up down the list (docs/demos/shared/vera.css
// § the list as a TABLE). Every row is a subgrid of one grid, so a column is as wide as its
// widest cell.
// Rows arrive a slice at a time; nearing the end of the loaded rows asks for the next slice.
// Grouped, a header row spanning every column opens each group; the server sorts by group first,
// so a group may run on into the next slice but never comes back after another.
// TODO(rrandiak): render only the visible rows once lists run to thousands loaded; the one-line
// reason under a row; labels move to i18n.

import type { ReactNode } from "react";
import { Fragment } from "react";
import type { DocumentGroup, DocumentGrouping } from "@/api/documents";
import { documentGroupingSchema } from "@/api/documents";
import { PriorityBadge, RegistryBadge, StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { categoryPathOf } from "@/domain/categories";
import type { Audience, DocumentRecord } from "@/domain/documents";
import {
  askersOf,
  currentIterationOf,
  documentIdentifierOf,
  effectivePageCount,
  publicRecordStatusOf,
  recordStatusOf,
  requestsBy,
  strongestRegistryRecord,
} from "@/domain/documents";
import type { StatusFootnote } from "@/domain/status";
import { statusFootnoteOf } from "@/domain/status";
import { DocumentGroupHeader } from "@/features/documents/document-group-header";
import { useLoadMore } from "@/hooks/use-load-more";
import { useCategoriesQuery, useUsersQuery } from "@/hooks/use-reference-query";
import { cn } from "@/lib/utils";

// The columns each audience reads; a requester is not shown the staff machinery.
const columns = {
  staff: [
    { key: "document", label: "Document" },
    { key: "status", label: "Status" },
    { key: "priority", label: "Priority" },
    { key: "pages", label: "Pages", isNumeric: true },
    { key: "askers", label: "Askers", isNumeric: true },
    { key: "copy", label: "Existing copy" },
  ],
  public: [
    { key: "document", label: "Document" },
    { key: "status", label: "Status" },
    { key: "copy", label: "Copy" },
    { key: "asked", label: "Asked", isNumeric: true },
  ],
} as const;

type ColumnKey = (typeof columns)[keyof typeof columns][number]["key"];

// Literal, so Tailwind sees them. Their tracks match `columns` above.
const tableTemplates = {
  staff:
    "@2xl:grid-cols-[minmax(9rem,1fr)_fit-content(8.5rem)_max-content_max-content_max-content_fit-content(9rem)]",
  public: "@2xl:grid-cols-[minmax(9rem,1fr)_fit-content(8.5rem)_fit-content(9rem)_max-content]",
} as const;

const footnoteLabels = {
  ReviewNeeded: "review needed",
  ValidationDenied: "denied in review",
} as const satisfies Record<StatusFootnote, string>;

const groupingLabels = {
  batch: "Group by batch",
  project: "Group by project",
} as const satisfies Record<DocumentGrouping, string>;

const askedFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

interface DocumentListProps {
  // Undefined until the first slice arrives.
  audience: Audience | undefined;
  items: DocumentRecord[] | undefined;
  // The headers of every loaded slice, in order; empty when not grouped.
  groups: readonly DocumentGroup[];
  total: number | undefined;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  // The groupings the caller may pick; none hides the picker.
  groupings: readonly DocumentGrouping[];
  grouping: DocumentGrouping | null;
  onGroupingChange: (grouping: DocumentGrouping | null) => void;
  canRetryAdditions: boolean;
  canOpenProjects: boolean;
  userId: string;
  selectedId: string | null;
  onSelect: (documentId: string) => void;
}

export function DocumentList({
  audience = "staff",
  items = [],
  groups,
  total,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  groupings,
  grouping,
  onGroupingChange,
  canRetryAdditions,
  canOpenProjects,
  userId,
  selectedId,
  onSelect,
}: DocumentListProps) {
  const isPublic = audience === "public";
  const { data: categories = [] } = useCategoriesQuery({ isEnabled: !isPublic });
  const { data: users = [] } = useUsersQuery({ isEnabled: grouping === "batch" });
  const count = total === undefined ? "Documents" : `${total} documents`;
  const groupStarts = groupStartsOf(groups);

  const sentinelRef = useLoadMore(hasMore, isLoadingMore, onLoadMore);

  const categoryNameOf = (record: DocumentRecord) => {
    const categoryId = currentIterationOf(record)?.categoryId;
    return categoryId === undefined
      ? null
      : (categoryPathOf(categories, categoryId).at(-1)?.name ?? null);
  };

  const statusOf = (record: DocumentRecord) => {
    const status = isPublic ? publicRecordStatusOf(record, userId) : recordStatusOf(record);
    if (status === null) {
      return null;
    }

    const current = currentIterationOf(record);
    const footnote = isPublic || current === null ? null : statusFootnoteOf(current);
    return (
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <StatusBadge status={status} />
        {footnote !== null && (
          <span className="text-[0.6875rem] text-muted-foreground">
            · {footnoteLabels[footnote]}
          </span>
        )}
      </span>
    );
  };

  const cellsOf = (record: DocumentRecord): Partial<Record<ColumnKey, ReactNode>> => {
    const { document } = record;
    const categoryName = categoryNameOf(record);
    const documentCell = (
      <>
        <span className="block text-[0.8125rem] leading-snug font-medium">{document.title}</span>
        <span className="mt-0.5 block truncate text-[0.6875rem] text-muted-foreground">
          <span className="font-mono">{documentIdentifierOf(document)}</span>
          {categoryName !== null && ` · ${categoryName}`}
        </span>
      </>
    );

    if (isPublic) {
      const readable = document.registryRecords.find((entry) => entry.linkKind === "content");
      const latestAsk = requestsBy(record, userId)[0];
      return {
        document: documentCell,
        status: statusOf(record),
        copy:
          readable === undefined ? (
            <Muted>—</Muted>
          ) : (
            <Badge className="border-transparent bg-tone-purple text-tone-purple-foreground">
              Read it in {readable.registry}
            </Badge>
          ),
        asked:
          latestAsk === undefined ? null : (
            <Muted>{askedFormat.format(new Date(latestAsk.at))}</Muted>
          ),
      };
    }

    const priority = currentIterationOf(record)?.priority;
    const pages = effectivePageCount(document);
    const registry = strongestRegistryRecord(document);
    return {
      document: documentCell,
      status: statusOf(record),
      priority: priority === undefined ? null : <PriorityBadge priority={priority} />,
      pages: pages === null ? <Muted>—</Muted> : pages.value.toLocaleString("en-US"),
      askers: askersOf(record).length,
      copy: registry === null ? <Muted>—</Muted> : <RegistryBadge record={registry} />,
    };
  };

  return (
    <>
      <div className="sticky top-0 z-20 flex h-10 items-center gap-2 border-b bg-background px-4">
        <span className="text-[0.6875rem] font-bold tracking-wider text-muted-foreground uppercase">
          {count}
        </span>
        {groupings.length > 0 && (
          <select
            aria-label="Group the list"
            className="ml-auto h-7 rounded-md border bg-background px-2 text-xs text-muted-foreground"
            value={grouping ?? ""}
            onChange={(event) => {
              const picked = documentGroupingSchema.safeParse(event.target.value);
              onGroupingChange(picked.success ? picked.data : null);
            }}
          >
            <option value="">No grouping</option>
            {groupings.map((option) => (
              <option key={option} value={option}>
                {groupingLabels[option]}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading documents…</p>}

      {total === 0 && (
        <p className="p-4 text-sm text-muted-foreground">
          Nothing matches. Clear a filter to see more.
        </p>
      )}

      {items.length > 0 && (
        <div className={cn("@2xl:grid @2xl:content-start", tableTemplates[audience])}>
          <div
            aria-hidden
            className="sticky top-10 z-10 hidden border-b bg-muted text-[0.6875rem] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase @2xl:col-span-full @2xl:grid @2xl:grid-cols-subgrid"
          >
            {columns[audience].map((column) => (
              <span
                key={column.label}
                className={cn(
                  "px-2.5 py-2 first:pl-4 last:pr-4",
                  "isNumeric" in column && "text-right",
                )}
              >
                {column.label}
              </span>
            ))}
          </div>

          {items.map((record, index) => {
            const isSelected = record.document.id === selectedId;
            const priority = currentIterationOf(record)?.priority;
            const cells = cellsOf(record);
            const groupStart = groupStarts.get(index);
            return (
              <Fragment key={record.document.id}>
                {groupStart !== undefined && (
                  <DocumentGroupHeader
                    group={groupStart}
                    users={users}
                    canRetryAdditions={canRetryAdditions}
                    canOpenProjects={canOpenProjects}
                  />
                )}
                <button
                  type="button"
                  onClick={() => onSelect(record.document.id)}
                  aria-current={isSelected || undefined}
                  className={cn(
                    "block w-full border-b px-4 py-3 text-left hover:bg-muted",
                    "@2xl:col-span-full @2xl:grid @2xl:grid-cols-subgrid @2xl:items-center @2xl:px-0 @2xl:py-0",
                    isSelected && "bg-secondary shadow-[inset_3px_0_0_var(--primary)]",
                  )}
                >
                  <span className="block @2xl:hidden">
                    <span className="block font-mono text-xs text-muted-foreground">
                      {documentIdentifierOf(record.document)}
                    </span>
                    <span className="mt-0.5 mb-1.5 block text-sm leading-snug font-medium">
                      {record.document.title}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {statusOf(record)}
                      {!isPublic && priority !== undefined && <PriorityBadge priority={priority} />}
                    </span>
                  </span>

                  <span className="hidden @2xl:contents">
                    {columns[audience].map((column) => (
                      <span
                        key={column.label}
                        className={cn(
                          "min-w-0 px-2.5 py-2.5 text-[0.8125rem] first:pl-4 last:pr-4 [&_[data-slot=badge]]:rounded-md [&_[data-slot=badge]]:whitespace-normal",
                          "isNumeric" in column && "text-right tabular-nums",
                        )}
                      >
                        {cells[column.key]}
                      </span>
                    ))}
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>
      )}

      <div ref={sentinelRef} aria-hidden />
      {isLoadingMore && (
        <p className="p-4 text-center text-xs text-muted-foreground">Loading more documents…</p>
      )}
    </>
  );
}

// The row index each group starts at. A group running on from the previous slice comes back
// with the next one's headers, and opens no second header.
function groupStartsOf(groups: readonly DocumentGroup[]): Map<number, DocumentGroup> {
  const starts = new Map<number, DocumentGroup>();
  let rowIndex = 0;
  let previousKey: string | null | undefined;
  for (const group of groups) {
    const key = groupKeyOf(group);
    if (key !== previousKey) {
      starts.set(rowIndex, group);
    }

    previousKey = key;
    rowIndex += group.rowCount;
  }

  return starts;
}

function groupKeyOf(group: DocumentGroup): string | null {
  return group.kind === "batch" ? (group.batch?.id ?? null) : (group.project?.id ?? null);
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
