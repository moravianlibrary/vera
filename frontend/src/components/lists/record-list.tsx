// A list of records beside a pane (component-interfaces.md §2.2). Its layout follows the room it
// has, not the viewport, so opening the sidebar or the pane changes it: a narrow list stacks
// each row as a card, a wide one (42rem, `@2xl`) reads as a table whose columns line up down the
// list (docs/demos/shared/vera.css § the list as a TABLE). Every row is a subgrid of one grid,
// so a column is as wide as its widest cell. Under each row one line may say why it is there.
// Rows arrive a slice at a time; nearing the end of the loaded rows asks for the next slice.
// Grouped, a header row spanning every column opens each group; the server sorts by group first,
// so a group may run on into the next slice but never comes back after another.
// While rows are being picked (§9.4), a click picks or unpicks a row instead of opening it.
// TODO(rrandiak): render only the visible rows once lists run to thousands loaded; ↑ and ↓
// moving the selection (§9.9).

import { Check } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Fragment } from "react";
import type { ListToolbarProps } from "@/components/lists/list-toolbar";
import { ListToolbar } from "@/components/lists/list-toolbar";
import { useLoadMore } from "@/hooks/use-load-more";
import type { PagedList } from "@/hooks/use-paged-list";
import { cn } from "@/lib/utils";

export interface ColumnDefinition<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  // Its track in the shared grid: "minmax(9rem,1fr)", "max-content", "fit-content(9rem)".
  track: string;
  isNumeric?: boolean;
}

// The card a row becomes when the list is narrow: a small line on top, the title, then a line
// of badges.
export interface CardDefinition<Row> {
  eyebrow?: (row: Row) => ReactNode;
  title: (row: Row) => ReactNode;
  meta?: (row: Row) => ReactNode;
}

export interface GroupCounts {
  // How many of its slice's rows, next in order, fall into the group.
  readonly rowCount: number;
}

export interface ListGroups<Group extends GroupCounts> {
  // The headers of every loaded slice, in order.
  items: readonly Group[];
  // What makes two headers the same group, so one running on into the next slice opens once.
  keyOf: (group: Group) => string | null;
  header: (group: Group) => ReactNode;
}

// Rows picked for an act over several of them; absent while nothing is being picked.
export interface RowPicking {
  readonly pickedIds: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
}

export interface RecordListProps<Row, Group extends GroupCounts, Grouping extends string> {
  rows: readonly Row[] | undefined;
  rowId: (row: Row) => string;
  // Undefined until the first slice answers.
  total: number | undefined;
  columns: readonly ColumnDefinition<Row>[];
  card: CardDefinition<Row>;
  // The one line under each row that says why it is here (view-rules.md §1.1).
  whyOf?: (row: Row) => ReactNode;
  toolbar: ListToolbarProps<Grouping>;
  groups?: ListGroups<Group>;
  paging: PagedList;
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  picking?: RowPicking;
  loadingText: string;
  emptyText: string;
  loadingMoreText: string;
}

function PickMark({ isPicked, className }: { isPicked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-xs border bg-background",
        isPicked && "border-primary bg-primary text-primary-foreground",
        className,
      )}
    >
      {isPicked && <Check className="size-3" />}
    </span>
  );
}

export function RecordList<Row, Group extends GroupCounts, Grouping extends string>({
  rows = [],
  rowId,
  total,
  columns,
  card,
  whyOf,
  toolbar,
  groups,
  paging,
  isLoading,
  selectedId,
  onSelect,
  picking,
  loadingText,
  emptyText,
  loadingMoreText,
}: RecordListProps<Row, Group, Grouping>) {
  const sentinelRef = useLoadMore(paging.hasMore, paging.isLoadingMore, paging.onLoadMore);
  const groupStarts = groups === undefined ? new Map<number, Group>() : groupStartsOf(groups);
  const hasWhyLine = whyOf !== undefined;
  // While picking, the mark has a track of its own, so the columns keep their place under
  // their headers.
  const tracks = {
    "--record-list-tracks": [...(picking === undefined ? [] : ["2.25rem"]), ...columns]
      .map((column) => (typeof column === "string" ? column : column.track))
      .join(" "),
  };

  return (
    <>
      <ListToolbar {...toolbar} />

      {isLoading && <p className="p-4 text-sm text-muted-foreground">{loadingText}</p>}

      {total === 0 && <p className="p-4 text-sm text-muted-foreground">{emptyText}</p>}

      {rows.length > 0 && (
        <div
          className="@2xl:grid @2xl:grid-cols-(--record-list-tracks) @2xl:content-start"
          style={tracks as CSSProperties}
        >
          <div
            aria-hidden
            className="sticky top-10 z-10 hidden border-b bg-muted text-caption font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase @2xl:col-span-full @2xl:grid @2xl:grid-cols-subgrid"
          >
            {picking !== undefined && <span />}
            {columns.map((column) => (
              <span
                key={column.key}
                className={cn("px-2.5 py-2 first:pl-4 last:pr-4", column.isNumeric && "text-right")}
              >
                {column.header}
              </span>
            ))}
          </div>

          {rows.map((row, index) => {
            const id = rowId(row);
            const isSelected = picking === undefined && id === selectedId;
            const isPicked = picking?.pickedIds.has(id) ?? false;
            const groupStart = groupStarts.get(index);
            return (
              <Fragment key={id}>
                {groupStart !== undefined && groups?.header(groupStart)}

                <button
                  type="button"
                  data-slot="record-list-row"
                  onClick={() => (picking === undefined ? onSelect(id) : picking.onToggle(id))}
                  aria-current={isSelected || undefined}
                  aria-pressed={picking === undefined ? undefined : isPicked}
                  className={cn(
                    "block w-full border-b px-4 py-3 text-left hover:bg-muted",
                    "@2xl:col-span-full @2xl:grid @2xl:grid-cols-subgrid @2xl:items-center @2xl:px-0",
                    hasWhyLine ? "@2xl:pt-0 @2xl:pb-2.5" : "@2xl:py-0",
                    isSelected && "bg-primary/8 shadow-mark hover:bg-primary/12",
                  )}
                >
                  <span className="block @2xl:hidden">
                    {card.eyebrow !== undefined && (
                      <span className="block text-xs text-muted-foreground">
                        {card.eyebrow(row)}
                      </span>
                    )}
                    <span className="mt-0.5 mb-1.5 flex items-start gap-2 text-sm leading-snug font-medium">
                      {picking !== undefined && <PickMark isPicked={isPicked} className="mt-px" />}
                      <span className="min-w-0">{card.title(row)}</span>
                    </span>
                    {card.meta !== undefined && (
                      <span className="flex flex-wrap items-center gap-1.5">{card.meta(row)}</span>
                    )}
                  </span>

                  <span className="hidden @2xl:contents">
                    {picking !== undefined && (
                      <span
                        className={cn(
                          "flex justify-end pl-4",
                          hasWhyLine ? "pt-2.5 pb-1" : "py-2.5",
                        )}
                      >
                        <PickMark isPicked={isPicked} />
                      </span>
                    )}
                    {columns.map((column) => (
                      <span
                        key={column.key}
                        className={cn(
                          "min-w-0 px-2.5 text-ui first:pl-4 last:pr-4 [&_[data-slot=badge]]:rounded-md [&_[data-slot=badge]]:whitespace-normal",
                          hasWhyLine ? "pt-2.5 pb-1" : "py-2.5",
                          column.isNumeric && "text-right tabular-nums",
                        )}
                      >
                        {column.cell(row)}
                      </span>
                    ))}
                  </span>

                  {hasWhyLine && (
                    <span className="mt-1.5 block text-xs leading-snug text-muted-foreground @2xl:col-span-full @2xl:mt-0 @2xl:px-4">
                      {whyOf(row)}
                    </span>
                  )}
                </button>
              </Fragment>
            );
          })}
        </div>
      )}

      <div ref={sentinelRef} aria-hidden />
      {paging.isLoadingMore && (
        <p className="p-4 text-center text-xs text-muted-foreground">{loadingMoreText}</p>
      )}
    </>
  );
}

// The row index each group starts at. A group running on from the previous slice comes back
// with the next one's headers, and opens no second header.
function groupStartsOf<Group extends GroupCounts>({
  items,
  keyOf,
}: ListGroups<Group>): Map<number, Group> {
  const starts = new Map<number, Group>();
  let rowIndex = 0;
  let previousKey: string | null | undefined;
  for (const group of items) {
    const key = keyOf(group);
    if (key !== previousKey) {
      starts.set(rowIndex, group);
    }

    previousKey = key;
    rowIndex += group.rowCount;
  }

  return starts;
}
