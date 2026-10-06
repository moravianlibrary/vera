// Two panes and the thing being built above them (component-interfaces.md §1.3, view-map.md
// §2.4): what is on it, and what it could take. Rows are picked by their checkbox, moved one at a
// time or picked together, and nothing is saved until Save. Side by side from notebook up, each
// pane a table where it has the width; stacked below, the target over the source, so the moves
// read up and down. Leaving with changes asks first (LeaveGuard).
// TODO(rrandiak): the phone's long-press to start picking (view-rules.md §5.5); labels move to
// i18n.

import type { CSSProperties, ReactNode } from "react";
import { Fragment } from "react";
import type { ViewAction } from "@/components/actions/action-bar";
import { ActionBar } from "@/components/actions/action-bar";
import { LeaveGuard } from "@/components/leave-guard";
import type { CardDefinition, ColumnDefinition } from "@/components/lists/record-list";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Draft } from "@/hooks/use-draft";
import { useLoadMore } from "@/hooks/use-load-more";
import type { PagedList } from "@/hooks/use-paged-list";
import { usePicked } from "@/hooks/use-picked";
import { useTier } from "@/hooks/use-tier";
import { cn } from "@/lib/utils";

export type TransferSide = "target" | "source";

export interface TransferPane<Item> {
  // "On this list".
  title: string;
  // "3 items · 2,540 pp".
  summary: string;
  items: readonly Item[] | undefined;
  columns: readonly ColumnDefinition<Item>[];
  card: CardDefinition<Item>;
  // A head action, e.g. "Generate…" on the target; absent without a generator.
  action?: ViewAction;
  // The pane's own filter: category and search.
  filter?: ReactNode;
  // The line under a row: "generated — reason", "Taken off — back to Ready when you save".
  whyOf?: (item: Item) => ReactNode;
  // Below the rows: "12 more in Periodicals are waiting in review".
  footnote?: ReactNode;
  emptyText: ReactNode;
  // What the pane shows changes: its picks are forgotten.
  resetKey?: unknown;
  paging?: PagedList;
}

export interface TransferEditorProps<Item> {
  // The strip on top: name, dates, target, mix, notes.
  header: ReactNode;
  // What the editor started from and what it holds now; the editor counts the change.
  draft: Draft<ReadonlySet<string>>;
  // Other edits held beside the members, such as the name: Discard and leaving ask about them too.
  isOtherwiseDirty: boolean;
  rowId: (item: Item) => string;
  target: TransferPane<Item>;
  source: TransferPane<Item>;
  // What a new draft says before anything is in it: "new — not saved".
  unchangedText: string;
  canSave: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function TransferEditor<Item>({
  header,
  draft,
  isOtherwiseDirty,
  rowId,
  target,
  source,
  unchangedText,
  canSave,
  isSaving,
  onSave,
  onDiscard,
}: TransferEditorProps<Item>) {
  const tier = useTier();
  const isStacked = tier === "phone" || tier === "small";
  const added = [...draft.current].filter((id) => !draft.original.has(id)).length;
  const removed = [...draft.original].filter((id) => !draft.current.has(id)).length;
  const isDirty = draft.isDirty || isOtherwiseDirty;

  const move = (ids: readonly string[], to: TransferSide) => {
    const next = new Set(draft.current);
    for (const id of ids) {
      if (to === "target") {
        next.add(id);
      } else {
        next.delete(id);
      }
    }

    draft.set(next);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LeaveGuard isDirty={isDirty && !isSaving} />
      <section className="shrink-0 border-b px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          {/* Where the two do not fit side by side, the header takes the width and Save sits above. */}
          <div className="min-w-0 flex-[1_1_28rem]">{header}</div>
          <div className="flex shrink-0 items-center gap-2 max-sm:order-first max-sm:w-full max-sm:justify-end">
            <span className="text-xs text-muted-foreground tabular-nums">
              {added > 0 || removed > 0 ? (
                <>
                  <b className="font-semibold text-tone-green-foreground">+{added}</b>{" "}
                  <b className="font-semibold text-tone-red-foreground">−{removed}</b> since opened
                </>
              ) : isDirty ? (
                "unsaved changes"
              ) : (
                unchangedText
              )}
            </span>
            <Button variant="outline" size="sm" onClick={onDiscard}>
              Discard
            </Button>
            <Button size="sm" disabled={!canSave || isSaving} onClick={onSave}>
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </section>

      <div
        className={cn(
          "min-h-0 flex-1",
          isStacked ? "overflow-y-auto" : "grid grid-cols-2 divide-x overflow-hidden",
        )}
      >
        <PaneColumn
          pane={target}
          side="target"
          rowId={rowId}
          isStacked={isStacked}
          onMove={(ids) => move(ids, "source")}
        />
        <PaneColumn
          pane={source}
          side="source"
          rowId={rowId}
          isStacked={isStacked}
          onMove={(ids) => move(ids, "target")}
        />
      </div>
    </div>
  );
}

// The words on a move: across to the other pane, or up and down when they are stacked.
function moveLabelOf(side: TransferSide, isStacked: boolean, count: number | null): string {
  const counted = count === null ? "" : ` ${count}`;
  if (side === "target") {
    return `Take off${counted} ${isStacked ? "↓" : "→"}`;
  }

  return `${isStacked ? "↑" : "←"} Add${counted}`;
}

interface PaneColumnProps<Item> {
  pane: TransferPane<Item>;
  side: TransferSide;
  rowId: (item: Item) => string;
  isStacked: boolean;
  onMove: (ids: readonly string[]) => void;
}

function PaneColumn<Item>({ pane, side, rowId, isStacked, onMove }: PaneColumnProps<Item>) {
  const items = pane.items ?? [];
  const ids = items.map(rowId);
  const picked = usePicked(ids, pane.resetKey ?? null);
  const pickedIds = ids.filter((id) => picked.ids.has(id));
  const isAllPicked = ids.length > 0 && pickedIds.length === ids.length;
  const sentinelRef = useLoadMore(
    pane.paging?.hasMore ?? false,
    pane.paging?.isLoadingMore ?? false,
    pane.paging?.onLoadMore ?? (() => undefined),
  );
  const tracks = {
    "--transfer-tracks": [
      "2.25rem",
      ...pane.columns.map((column) => column.track),
      "max-content",
    ].join(" "),
  };

  const moveAll = () => {
    onMove(pickedIds);
    picked.clear();
  };

  return (
    <section
      aria-label={pane.title}
      className={cn("@container flex min-h-0 flex-col", isStacked ? "min-h-64 border-b" : "")}
    >
      <div
        className={cn(
          "flex shrink-0 flex-wrap items-center gap-2 border-b bg-background px-4 py-2",
          // Stacked, the page scrolls both panes: each head stays in reach with its move.
          isStacked && "sticky top-0 z-20",
        )}
      >
        <div className="mr-auto min-w-0">
          <b className="text-sm font-semibold">{pane.title}</b>{" "}
          <span className="text-xs text-muted-foreground">{pane.summary}</span>
        </div>
        {pane.filter}
        {pane.action !== undefined && <ActionBar actions={[pane.action]} />}
        <Button variant="outline" size="sm" disabled={pickedIds.length === 0} onClick={moveAll}>
          {moveLabelOf(side, isStacked, pickedIds.length === 0 ? null : pickedIds.length)}
        </Button>
      </div>

      <div className={cn(!isStacked && "min-h-0 flex-1 overflow-y-auto")}>
        {pane.items !== undefined && items.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">{pane.emptyText}</div>
        )}

        {items.length > 0 && (
          <div
            className="@2xl:grid @2xl:grid-cols-(--transfer-tracks) @2xl:content-start"
            style={tracks as CSSProperties}
          >
            <div
              className={cn(
                "z-10 hidden border-b bg-muted text-[0.6875rem] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase @2xl:col-span-full @2xl:grid @2xl:grid-cols-subgrid @2xl:items-center",
                !isStacked && "sticky top-0",
              )}
            >
              <span className="pl-4">
                <Checkbox
                  aria-label={`Pick every row in ${pane.title}`}
                  checked={isAllPicked}
                  onCheckedChange={(state) => picked.setMany(ids, state === true)}
                />
              </span>
              {pane.columns.map((column) => (
                <span
                  key={column.key}
                  className={cn("px-2.5 py-2", column.isNumeric && "text-right")}
                >
                  {column.header}
                </span>
              ))}
              <span className="pr-4" />
            </div>

            {items.map((item) => {
              const id = rowId(item);
              const isPicked = picked.ids.has(id);
              const why = pane.whyOf?.(item);
              return (
                <Fragment key={id}>
                  <div
                    className={cn(
                      "flex items-start gap-3 border-b px-4 py-2.5",
                      "@2xl:col-span-full @2xl:grid @2xl:grid-cols-subgrid @2xl:items-center @2xl:gap-0 @2xl:px-0",
                      isPicked && "bg-secondary",
                    )}
                  >
                    <span className="pt-0.5 @2xl:pt-0 @2xl:pl-4">
                      <Checkbox
                        aria-label={`Pick ${id}`}
                        checked={isPicked}
                        onClick={(event) => {
                          event.preventDefault();
                          picked.toggle(id, event.shiftKey);
                        }}
                      />
                    </span>

                    <span className="min-w-0 flex-1 @2xl:hidden">
                      {pane.card.eyebrow !== undefined && (
                        <span className="block text-xs text-muted-foreground">
                          {pane.card.eyebrow(item)}
                        </span>
                      )}
                      <span className="block text-sm leading-snug font-medium">
                        {pane.card.title(item)}
                      </span>
                      {pane.card.meta !== undefined && (
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          {pane.card.meta(item)}
                        </span>
                      )}
                      {why !== undefined && why !== null && (
                        <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                          {why}
                        </span>
                      )}
                    </span>

                    {pane.columns.map((column) => (
                      <span
                        key={column.key}
                        className={cn(
                          "hidden min-w-0 px-2.5 text-[0.8125rem] @2xl:block",
                          column.isNumeric && "text-right tabular-nums",
                        )}
                      >
                        {column.cell(item)}
                      </span>
                    ))}

                    <span className="shrink-0 @2xl:pr-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          onMove([id]);
                          picked.setMany([id], false);
                        }}
                      >
                        {moveLabelOf(side, isStacked, null)}
                      </Button>
                    </span>

                    {why !== undefined && why !== null && (
                      <span className="hidden pb-2 text-xs leading-snug text-muted-foreground @2xl:col-span-full @2xl:-mt-1 @2xl:block @2xl:px-4 @2xl:pl-[3.25rem]">
                        {why}
                      </span>
                    )}
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}

        <div ref={sentinelRef} aria-hidden />
        {pane.paging?.isLoadingMore === true && (
          <p className="p-4 text-center text-xs text-muted-foreground">Loading more…</p>
        )}
        {pane.footnote !== undefined && (
          <div className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            {pane.footnote}
          </div>
        )}
      </div>
    </section>
  );
}
