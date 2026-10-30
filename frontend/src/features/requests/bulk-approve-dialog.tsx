// Approving a batch at once (page-proposals.js openBulk; status-model.md §2.8): one category and
// one priority for what the batch can take, each item untickable so it is decided on its own.
// A rescan and an item still being checked are listed as left out, never dropped silently. Each
// item names the leaf a classifier suggested, and the one category overrides the others. The
// server approves the batch whole, however many it asked for, but what was unticked, and leaves
// out again whatever changed meanwhile; the list here arrives a slice at a time as it scrolls.
// Unlike the demo, the left out are listed in place among the rest rather than after them: with
// the list in slices, a section after it would only be complete once every slice is loaded.

import type { BulkApprovalResult, RequestGroup } from "@vera/contract/requests";
import { documentIdentifierOf, existingCopiesOf } from "@vera/domain/documents";
import type { Category, Priority } from "@vera/domain/entities";
import type { RequestRow } from "@vera/domain/requests";
import { askerIdsOf, asksOf, isBulkApprovable, isRescan } from "@vera/domain/requests";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { bulkApproveProposals } from "@/api/requests";
import {
  CategorySelect,
  categoryLabelOf,
  Field,
  PrioritySelect,
} from "@/components/classification-fields";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { Checkbox } from "@/components/ui/checkbox";
import {
  decisionInvalidations,
  useBatchProposalsQuery,
} from "@/features/requests/use-requests-query";
import type { Refusal } from "@/hooks/use-action-mutation";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useLoadMore } from "@/hooks/use-load-more";
import { useCategoriesQuery } from "@/hooks/use-reference-query";

type BatchGroup = Extract<RequestGroup, { kind: "batch" }>;

interface BulkApproveDialogProps {
  // The batch to approve; null closes the dialog.
  group: BatchGroup | null;
  onClose: () => void;
}

export function BulkApproveDialog({ group, onClose }: BulkApproveDialogProps) {
  if (group === null || group.batch === null) {
    return null;
  }

  // Keyed, so each batch starts afresh.
  return <BulkApproval key={group.batch.id} group={group} onClose={onClose} />;
}

interface Classification {
  categoryId: string;
  priority: Priority;
}

function BulkApproval({ group, onClose }: { group: BatchGroup; onClose: () => void }) {
  const { t } = useTranslation("requests");
  const fieldId = useId();
  const batchId = group.batch?.id ?? "";
  const { data: categories = [] } = useCategoriesQuery();
  const batch = useBatchProposalsQuery(batchId);
  const approve = useActionMutation({
    call: ({ categoryId, priority, excludedIds }: Classification & { excludedIds: string[] }) =>
      bulkApproveProposals(batchId, { categoryId, priority, excludedIds }),
    invalidates: decisionInvalidations,
    refusalTexts: { 409: t("bulk.nothingLeft") },
  });
  const sentinelRef = useLoadMore(
    batch.paging.hasMore,
    batch.paging.isLoadingMore,
    batch.paging.onLoadMore,
  );
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>("Normal");
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set());
  const [result, setResult] = useState<BulkApprovalResult | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  // Counted by the server over the whole batch, not over the slices loaded here.
  const takeCount = group.approvableCount;
  const leftOutCount = group.rescanCount + group.checkingCount;
  const pickedCount = takeCount - unticked.size;
  const rows = batch.items ?? [];
  const title = (verb: string) => (
    <>
      {verb} — <span className="font-mono">{batchId}</span>
    </>
  );

  const toggle = (documentId: string, isChecked: boolean) => {
    const next = new Set(unticked);
    if (isChecked) {
      next.delete(documentId);
    } else {
      next.add(documentId);
    }

    setUnticked(next);
  };

  const submit = async () => {
    if (categoryId === null || pickedCount <= 0) {
      return;
    }

    const outcome = await approve.run({ categoryId, priority, excludedIds: [...unticked] });
    if (outcome.isDone) {
      setResult(outcome.value);
      return;
    }

    setRefusal(outcome.refusal);
  };

  if (result !== null) {
    const stayCount = result.rescanCount + result.checkingCount + unticked.size;
    return (
      <DialogShell
        isOpen
        onClose={onClose}
        title={title(t("bulk.approved"))}
        description={t("bulk.resultDescription")}
        cancelLabel={null}
        primary={{ label: t("bulk.done"), onSelect: onClose }}
      >
        <div className="grid gap-3">
          <StatusNote tone="green" title={t("bulk.approvedCount", { count: result.approvedCount })}>
            {categoryId === null ? "" : categoryLabelOf(categories, categoryId)} ·{" "}
            {t(`priority.${priority.toLowerCase()}`)}
          </StatusNote>
          <p className="text-xs text-muted-foreground">
            {t("bulk.resultSummary", { count: result.approvedCount })}
            {stayCount > 0 && ` ${t("bulk.staySummary", { count: stayCount })}`}
          </p>
        </div>
      </DialogShell>
    );
  }

  return (
    <DialogShell
      isOpen
      onClose={onClose}
      title={title(t("bulk.approve"))}
      description={t("bulk.description")}
      isDirty={categoryId !== null || unticked.size > 0}
      refusal={refusal}
      primary={{
        label: t("bulk.approveCount", { count: pickedCount }),
        isPending: approve.isPending,
        isDisabled: categoryId === null || pickedCount <= 0,
        onSelect: () => void submit(),
      }}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field
            id={`${fieldId}-category`}
            label={t("bulk.category")}
            hint={t("bulk.forAll", { count: pickedCount })}
          >
            <CategorySelect
              id={`${fieldId}-category`}
              value={categoryId}
              onChange={setCategoryId}
            />
          </Field>
          <Field id={`${fieldId}-priority`} label={t("bulk.priority")}>
            <PrioritySelect id={`${fieldId}-priority`} value={priority} onChange={setPriority} />
          </Field>
        </div>

        <SuggestionSummary
          group={group}
          categories={categories}
          categoryId={categoryId}
          untickedRows={rows.filter((row) => unticked.has(row.record.document.id))}
        />

        <ItemList
          title={t(leftOutCount > 0 ? "bulk.toApproveWithLeftOut" : "bulk.toApprove", {
            pickedCount,
            takeCount,
            leftOutCount,
          })}
          hint={t("bulk.untickHint")}
        >
          {rows.map((row) => {
            const documentId = row.record.document.id;
            return (
              <Item key={documentId} row={row}>
                {isBulkApprovable(row) ? (
                  <Checkbox
                    aria-label={t("bulk.approveDocument", { title: row.record.document.title })}
                    checked={!unticked.has(documentId)}
                    onCheckedChange={(isChecked) => toggle(documentId, isChecked === true)}
                  />
                ) : (
                  <LeftOutBadge row={row} />
                )}
              </Item>
            );
          })}
        </ItemList>
        <div ref={sentinelRef} aria-hidden />
        {(batch.isLoading || batch.paging.isLoadingMore) && (
          <p className="text-muted-foreground">{t("bulk.loading")}</p>
        )}

        {leftOutCount > 0 && (
          <p className="text-xs text-muted-foreground">{t("bulk.rescanNote")}</p>
        )}
      </div>
    </DialogShell>
  );
}

interface SuggestionSummaryProps {
  group: BatchGroup;
  categories: readonly Category[];
  categoryId: string | null;
  // Loaded, since only a loaded item can be unticked.
  untickedRows: readonly RequestRow[];
}

// One category for the batch overrides every suggestion for another leaf, and the form says how
// many (plugins.md §4.13); each is logged as overridden.
function SuggestionSummary({
  group,
  categories,
  categoryId,
  untickedRows,
}: SuggestionSummaryProps) {
  const { t } = useTranslation("requests");
  const suggested = group.suggestedCounts.toSorted((first, second) => second.count - first.count);
  if (suggested.length === 0) {
    return null;
  }

  if (categoryId === null) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("bulk.suggestedForThem")}{" "}
        {suggested
          .map(({ value, count }) => `${categoryLabelOf(categories, value)} ×${count}`)
          .join(", ")}
        .
      </p>
    );
  }

  const untickedOverrides = untickedRows.filter(
    (row) => row.suggestion !== null && row.suggestion.categoryId !== categoryId,
  ).length;
  const overrideCount =
    suggested
      .filter(({ value }) => value !== categoryId)
      .reduce((sum, { count }) => sum + count, 0) - untickedOverrides;
  return overrideCount === 0 ? (
    <p className="text-xs text-muted-foreground">{t("bulk.matchesEverySuggestion")}</p>
  ) : (
    <p className="text-xs font-medium text-tone-amber-foreground">
      {t("bulk.overrides", { count: overrideCount })}
    </p>
  );
}

function LeftOutBadge({ row }: { row: RequestRow }) {
  const { t } = useTranslation("requests");
  const [copy] = existingCopiesOf(asksOf(row));
  if (isRescan(row) && copy !== undefined) {
    return <ToneBadge tone="purple">{t("bulk.rescanBadge", { source: copy.source })}</ToneBadge>;
  }

  return <ToneBadge tone="slate">{t("bulk.stillChecking")}</ToneBadge>;
}

function ItemList({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
        <span className="font-semibold">{title}</span>
        <span className="text-muted-foreground">{hint}</span>
      </div>
      <ul className="divide-y rounded-lg border">{children}</ul>
    </section>
  );
}

function Item({ row, children }: { row: RequestRow; children: ReactNode }) {
  const { t } = useTranslation("requests");
  const { data: categories = [] } = useCategoriesQuery();
  const askerCount = askerIdsOf(row).length;
  // The leaf alone, so the line fits a phone; the summary above names the whole path.
  const suggestion = row.suggestion;
  const suggestedName =
    suggestion === null
      ? null
      : (categories.find((category) => category.id === suggestion.categoryId)?.name ?? null);
  const isLeftOut = !isBulkApprovable(row);
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="min-w-0 flex-1">
        <b className={isLeftOut ? "font-medium text-muted-foreground" : "font-medium"}>
          {row.record.document.title}
        </b>
        <span className="block truncate text-xs text-muted-foreground">
          <span className="font-mono">{documentIdentifierOf(row.record.document)}</span>
          {askerCount > 1 && ` · ${t("count.asker", { count: askerCount })}`}
          {suggestedName !== null && ` · ${t("bulk.suggested", { name: suggestedName })}`}
        </span>
      </span>
      <span className="shrink-0">{children}</span>
    </li>
  );
}
