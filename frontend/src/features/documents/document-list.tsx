// The Documents list on RecordList (components/lists/record-list.tsx): the columns each audience
// reads, and a header over each batch or project when grouped.
// TODO(rrandiak): the one-line reason under a row.

import type { DocumentGroup, DocumentGrouping } from "@vera/contract/documents";
import { categoryPathOf } from "@vera/domain/categories";
import type { Audience, DocumentRecord } from "@vera/domain/documents";
import {
  askersOf,
  currentIterationOf,
  documentIdentifierOf,
  effectivePageCount,
  latestPublicAskOf,
  publicRecordStatusOf,
  recordStatusOf,
  strongestRegistryRecord,
} from "@vera/domain/documents";
import type { Category } from "@vera/domain/entities";
import { statusFootnoteOf } from "@vera/domain/status";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Muted } from "@/components/detail-card";
import type { ColumnDefinition, RowPicking } from "@/components/lists/record-list";
import { RecordList } from "@/components/lists/record-list";
import type { QueryFailure } from "@/components/query-state";
import {
  PriorityBadge,
  RegistryBadge,
  StatusWithFootnote,
  ToneBadge,
} from "@/components/status-badge";
import { DocumentGroupHeader } from "@/features/documents/document-group-header";
import type { PagedList } from "@/hooks/use-paged-list";
import { useCategoriesQuery, useUsersQuery } from "@/hooks/use-reference-query";
import { i18n } from "@/i18n";
import { formatDay } from "@/lib/format-date";
import { formatCount } from "@/lib/format-number";
import type { ViewGroupingOption } from "@/lib/view-definition";

interface DocumentListProps {
  // Undefined until the first slice arrives.
  audience: Audience | undefined;
  items: DocumentRecord[] | undefined;
  // The headers of every loaded slice, in order; empty when not grouped.
  groups: readonly DocumentGroup[];
  total: number | undefined;
  isLoading: boolean;
  failure?: QueryFailure;
  paging: PagedList;
  // The groupings the caller may pick; none hides the picker.
  groupings: readonly ViewGroupingOption<DocumentGrouping>[];
  grouping: DocumentGrouping | null;
  onGroupingChange: (grouping: DocumentGrouping | null) => void;
  canRetryAdditions: boolean;
  canOpenProjects: boolean;
  userId: string;
  selectedId: string | null;
  onSelect: (documentId: string) => void;
  picking?: RowPicking;
  onLongPress?: (id: string) => void;
  // Picking rows and what is done to the picked ones.
  toolbarActions?: ReactNode;
  emptyText?: ReactNode;
  emptyAction?: ReactNode;
}

export function DocumentList({
  audience = "staff",
  items,
  groups,
  total,
  isLoading,
  failure,
  paging,
  groupings,
  grouping,
  onGroupingChange,
  canRetryAdditions,
  canOpenProjects,
  userId,
  selectedId,
  onSelect,
  picking,
  onLongPress,
  toolbarActions,
  emptyText,
  emptyAction,
}: DocumentListProps) {
  useTranslation("documents");
  const isPublic = audience === "public";
  const { data: categories = [] } = useCategoriesQuery({ isEnabled: !isPublic });
  const { data: users = [] } = useUsersQuery({ isEnabled: grouping === "batch" });
  const columns = isPublic ? publicDocumentColumns(userId) : staffDocumentColumns(categories);
  const statusOf = (record: DocumentRecord) => (
    <StatusCell record={record} isPublic={isPublic} userId={userId} />
  );

  return (
    <RecordList
      rows={items}
      rowId={(record) => record.document.id}
      total={total}
      columns={columns}
      card={{
        eyebrow: (record) => (
          <span className="font-mono">{documentIdentifierOf(record.document)}</span>
        ),
        title: (record) => record.document.title,
        meta: (record) => {
          const priority = currentIterationOf(record)?.priority;
          return (
            <>
              {statusOf(record)}
              {!isPublic && priority !== undefined && <PriorityBadge priority={priority} />}
            </>
          );
        },
      }}
      toolbar={{
        count:
          total === undefined
            ? i18n.t("list.title", { ns: "documents" })
            : i18n.t("list.count", { ns: "documents", count: total }),
        groupings: { options: groupings, value: grouping, onChange: onGroupingChange },
        actions: toolbarActions,
      }}
      groups={{
        items: groups,
        keyOf: groupKeyOf,
        header: (group) => (
          <DocumentGroupHeader
            group={group}
            users={users}
            canRetryAdditions={canRetryAdditions}
            canOpenProjects={canOpenProjects}
          />
        ),
      }}
      paging={paging}
      isLoading={isLoading}
      failure={failure}
      selectedId={selectedId}
      onSelect={onSelect}
      picking={picking}
      onLongPress={onLongPress}
      loadingText={i18n.t("list.loading", { ns: "documents" })}
      emptyText={
        <div className="flex flex-wrap items-center gap-x-2">
          <span>{emptyText ?? i18n.t("list.empty", { ns: "documents" })}</span>
          {emptyAction}
        </div>
      }
      loadingMoreText={i18n.t("list.loadingMore", { ns: "documents" })}
    />
  );
}

// ---------------------------------------------------------------- columns

// Staff read the machinery; a requester is not shown it.
export function staffDocumentColumns(
  categories: readonly Category[],
): ColumnDefinition<DocumentRecord>[] {
  return [
    {
      key: "document",
      header: i18n.t("list.document", { ns: "documents" }),
      track: "minmax(9rem,1fr)",
      cell: (record) => <DocumentCell record={record} categories={categories} />,
    },
    {
      key: "status",
      header: i18n.t("field.status", { ns: "documents" }),
      track: "fit-content(8.5rem)",
      cell: (record) => <StatusCell record={record} isPublic={false} userId={null} />,
    },
    {
      key: "priority",
      header: i18n.t("field.priority", { ns: "documents" }),
      track: "max-content",
      cell: (record) => {
        const priority = currentIterationOf(record)?.priority;
        return priority === undefined ? null : <PriorityBadge priority={priority} />;
      },
    },
    {
      key: "pages",
      header: i18n.t("field.pages", { ns: "documents" }),
      track: "max-content",
      isNumeric: true,
      cell: (record) => {
        const pages = effectivePageCount(record.document);
        return pages === null ? <Muted>—</Muted> : formatCount(pages.value);
      },
    },
    {
      key: "askers",
      header: i18n.t("list.askers", { ns: "documents" }),
      track: "max-content",
      isNumeric: true,
      cell: (record) => askersOf(record).length,
    },
    {
      key: "copy",
      header: i18n.t("field.existingCopy", { ns: "documents" }),
      track: "fit-content(9rem)",
      cell: (record) => {
        const registry = strongestRegistryRecord(record.document);
        return registry === null ? <Muted>—</Muted> : <RegistryBadge record={registry} />;
      },
    },
  ];
}

export function publicDocumentColumns(userId: string): ColumnDefinition<DocumentRecord>[] {
  return [
    {
      key: "document",
      header: i18n.t("list.document", { ns: "documents" }),
      track: "minmax(9rem,1fr)",
      cell: (record) => <DocumentCell record={record} categories={[]} />,
    },
    {
      key: "status",
      header: i18n.t("field.status", { ns: "documents" }),
      track: "fit-content(8.5rem)",
      cell: (record) => <StatusCell record={record} isPublic userId={userId} />,
    },
    {
      key: "copy",
      header: i18n.t("list.copy", { ns: "documents" }),
      track: "fit-content(9rem)",
      cell: (record) => {
        const readable = record.document.registryRecords.find(
          (entry) => entry.linkKind === "content",
        );
        return readable === undefined ? (
          <Muted>—</Muted>
        ) : (
          <ToneBadge tone="purple" className="px-2 py-0.5 text-xs">
            {i18n.t("list.readItIn", { ns: "documents", registry: readable.registry })}
          </ToneBadge>
        );
      },
    },
    {
      key: "asked",
      header: i18n.t("field.asked", { ns: "documents" }),
      track: "max-content",
      isNumeric: true,
      cell: (record) => {
        const latestAsk = latestPublicAskOf(record, userId);
        return latestAsk === undefined ? null : <Muted>{formatDay(latestAsk.at)}</Muted>;
      },
    },
  ];
}

interface DocumentCellProps {
  record: DocumentRecord;
  categories: readonly Category[];
}

function DocumentCell({ record, categories }: DocumentCellProps) {
  const { document } = record;
  const categoryId = currentIterationOf(record)?.categoryId;
  const categoryName =
    categoryId === undefined ? null : (categoryPathOf(categories, categoryId).at(-1)?.name ?? null);

  return (
    <>
      <span className="block text-ui leading-snug font-medium">{document.title}</span>
      <span className="mt-0.5 block truncate text-caption text-muted-foreground">
        <span className="font-mono">{documentIdentifierOf(document)}</span>
        {categoryName !== null && ` · ${categoryName}`}
      </span>
    </>
  );
}

interface StatusCellProps {
  record: DocumentRecord;
  isPublic: boolean;
  // The requester whose ask a public status describes; null for staff.
  userId: string | null;
}

function StatusCell({ record, isPublic, userId }: StatusCellProps) {
  const status =
    isPublic && userId !== null ? publicRecordStatusOf(record, userId) : recordStatusOf(record);
  if (status === null) {
    return null;
  }

  const current = currentIterationOf(record);
  const footnote = isPublic || current === null ? null : statusFootnoteOf(current);
  return <StatusWithFootnote status={status} footnote={footnote} />;
}

function groupKeyOf(group: DocumentGroup): string | null {
  return group.kind === "batch" ? (group.batch?.id ?? null) : (group.project?.id ?? null);
}
