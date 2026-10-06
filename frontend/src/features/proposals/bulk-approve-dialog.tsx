// Approving a batch at once (page-proposals.js openBulk; status-model.md §2.8): one category and
// one priority for what the batch can take, each item untickable so it is decided on its own.
// A rescan and an item still being checked are listed as left out, never dropped silently, and
// the server leaves out again whatever changed meanwhile.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import { useId, useState } from "react";
import type { BulkApprovalResult, ProposalGroup } from "@/api/proposal-review";
import {
  CategorySelect,
  categoryLabelOf,
  Field,
  PrioritySelect,
} from "@/components/classification-fields";
import { ToneBadge } from "@/components/status-badge";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { documentIdentifierOf, existingCopiesOf } from "@/domain/documents";
import type { Priority } from "@/domain/entities";
import type { ProposalRow } from "@/domain/proposal-review";
import { askerIdsOf, asksOf, isBulkApprovable, isRescan } from "@/domain/proposal-review";
import {
  useBatchProposalsQuery,
  useDecisionMutations,
} from "@/features/proposals/use-proposals-query";
import { useCategoriesQuery } from "@/hooks/use-reference-query";
import { plural } from "@/lib/plural";

type BatchGroup = Extract<ProposalGroup, { kind: "batch" }>;

const skipReasonLabels = {
  rescan: "a rescan",
  beingChecked: "still being checked",
  decided: "decided meanwhile",
  outOfReach: "outside your proposal custody",
} as const satisfies Record<BulkApprovalResult["skipped"][number]["reason"], string>;

interface BulkApproveDialogProps {
  // The batch to approve; null closes the dialog.
  group: BatchGroup | null;
  onClose: () => void;
}

export function BulkApproveDialog({ group, onClose }: BulkApproveDialogProps) {
  const isOpen = group !== null && group.batch !== null;
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-2xl">
        {/* Remounted on every open, so each batch starts afresh. */}
        {isOpen && group.batch !== null && (
          <BulkApproval batchId={group.batch.id} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BulkApproval({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const fieldId = useId();
  const { data: categories = [] } = useCategoriesQuery();
  // Every open row the batch asked for, wherever its earliest ask was.
  const { data, isLoading } = useBatchProposalsQuery(batchId);
  const { bulkApprove } = useDecisionMutations();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>("Normal");
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set());
  const [result, setResult] = useState<BulkApprovalResult | null>(null);

  const rows = data?.items ?? [];
  const take = rows.filter(isBulkApprovable);
  const leftOut = rows.filter((row) => !isBulkApprovable(row));
  const picked = take.filter((row) => !unticked.has(row.record.document.id));
  const titleOf = (documentId: string) =>
    rows.find((row) => row.record.document.id === documentId)?.record.document.title ?? documentId;

  const toggle = (documentId: string, isChecked: boolean) => {
    const next = new Set(unticked);
    if (isChecked) {
      next.delete(documentId);
    } else {
      next.add(documentId);
    }

    setUnticked(next);
  };

  const submit = () => {
    if (categoryId === null || picked.length === 0) {
      return;
    }

    bulkApprove.mutate(
      { documentIds: picked.map((row) => row.record.document.id), categoryId, priority },
      { onSuccess: setResult },
    );
  };

  if (result !== null) {
    const approvedCount = result.approvedIds.length;
    return (
      <>
        <DialogHeader>
          <DialogTitle>
            Approved — <span className="font-mono">{batchId}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">What the bulk approve did</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 content-start gap-3 overflow-y-auto text-sm">
          <StatusNote tone="green" title={`${approvedCount} approved`}>
            {categoryId === null ? "" : categoryLabelOf(categories, categoryId)} · {priority}
          </StatusNote>
          {result.skipped.length > 0 && (
            <ItemList title={`Left out — ${result.skipped.length}`}>
              {result.skipped.map((skip) => (
                <Item key={skip.documentId} title={titleOf(skip.documentId)}>
                  <ToneBadge tone="slate">{skipReasonLabels[skip.reason]}</ToneBadge>
                </Item>
              ))}
            </ItemList>
          )}
          {leftOut.length + unticked.size > 0 && (
            <p className="text-xs text-muted-foreground">
              What was left out stays in Proposals, to be decided on its own.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Approve — <span className="font-mono">{batchId}</span>
        </DialogTitle>
        <DialogDescription className="sr-only">
          Approve what the batch asked for at once
        </DialogDescription>
      </DialogHeader>

      <div className="-mx-6 grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 overflow-y-auto px-6 text-sm">
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field id={`${fieldId}-category`} label="Category" hint={`for all ${picked.length}`}>
            <CategorySelect
              id={`${fieldId}-category`}
              value={categoryId}
              onChange={setCategoryId}
            />
          </Field>
          <Field id={`${fieldId}-priority`} label="Priority">
            <PrioritySelect id={`${fieldId}-priority`} value={priority} onChange={setPriority} />
          </Field>
        </div>

        {isLoading && <p className="text-muted-foreground">Loading the batch…</p>}

        {take.length > 0 && (
          <ItemList
            title={`${picked.length} of ${take.length} to approve`}
            hint="untick any to decide on its own"
          >
            {take.map((row) => {
              const documentId = row.record.document.id;
              const checkboxId = `${fieldId}-${documentId}`;
              return (
                <Item key={documentId} title={row.record.document.title} row={row}>
                  <Checkbox
                    id={checkboxId}
                    aria-label={`Approve ${row.record.document.title}`}
                    checked={!unticked.has(documentId)}
                    onCheckedChange={(isChecked) => toggle(documentId, isChecked === true)}
                  />
                </Item>
              );
            })}
          </ItemList>
        )}

        {leftOut.length > 0 && (
          <ItemList title={`Left out — ${leftOut.length}`}>
            {leftOut.map((row) => (
              <Item key={row.record.document.id} title={row.record.document.title} row={row}>
                <LeftOutBadge row={row} />
              </Item>
            ))}
          </ItemList>
        )}

        {bulkApprove.isError && (
          <p className="text-xs text-destructive">The batch could not be approved. Try again.</p>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="sm:mr-auto">
          Cancel
        </Button>
        <Button
          disabled={bulkApprove.isPending || categoryId === null || picked.length === 0}
          title={categoryId === null ? "Choose a category" : undefined}
          onClick={submit}
        >
          Approve {picked.length}
        </Button>
      </DialogFooter>
    </>
  );
}

function LeftOutBadge({ row }: { row: ProposalRow }) {
  const [copy] = existingCopiesOf(asksOf(row));
  if (isRescan(row) && copy !== undefined) {
    return <ToneBadge tone="purple">{copy.source} has it — a rescan</ToneBadge>;
  }

  return <ToneBadge tone="slate">still being checked</ToneBadge>;
}

function ItemList({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
        <span className="font-semibold">{title}</span>
        {hint !== undefined && <span className="text-muted-foreground">{hint}</span>}
      </div>
      <ul className="divide-y rounded-lg border">{children}</ul>
    </section>
  );
}

function Item({ title, row, children }: { title: string; row?: ProposalRow; children: ReactNode }) {
  const askerCount = row === undefined ? 0 : askerIdsOf(row).length;
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="min-w-0 flex-1">
        <b className="font-medium">{title}</b>
        {row !== undefined && (
          <span className="block truncate text-xs text-muted-foreground">
            <span className="font-mono">{documentIdentifierOf(row.record.document)}</span>
            {askerCount > 1 && ` · ${plural(askerCount, "asker")}`}
          </span>
        )}
      </span>
      <span className="shrink-0">{children}</span>
    </li>
  );
}
