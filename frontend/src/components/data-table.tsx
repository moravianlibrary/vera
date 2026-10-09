// A full-width table (component-interfaces.md §2.4; docs/demos/shared/vera.css .pj-table): the
// columns each tier declares, the dropped ones gone at that tier, and a row that opens its
// record anywhere it is clicked; a link or a button inside it is still itself. Used where
// records pile up for the audit that asks years later, such as the projects that ended or the
// runs that finished. A row may carry a note under it, full width (a failed run's red line with
// *Run again*), and on a phone the rows may become cards instead.
// Rows may be grouped, level within level (Plugins: kind → implementation → instance), each
// group a header row across the table. A level may collapse, which its header row toggles; a
// level may name its groups itself, so a group with no rows still shows, with a line saying so;
// and a group's header may open the group as a row opens its record (an implementation's
// contract).
// TODO(rrandiak): row actions and paging (§2.4) arrive with the first table that needs them.

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Fragment, useState } from "react";
import type { ColumnDefinition } from "@/components/lists/record-list";
import type { PerTier } from "@/hooks/use-tier";
import { useTier, valueForTier } from "@/hooks/use-tier";
import { cn } from "@/lib/utils";

export interface GroupLevel<Row> {
  keyOf: (row: Row) => string;
  // Across every column. A collapsible level's header is inside the button that toggles it, so
  // it holds no link or button of its own.
  header: (key: string, rows: readonly Row[]) => ReactNode;
  isCollapsible: boolean;
  // The groups to show, in order, within the group above (null at the top); without it, the
  // groups the rows fall into, in the order they come.
  keysWithin?: (parentKey: string | null) => readonly string[];
  // Under a group with no rows; only where `keysWithin` names one.
  emptyText?: (key: string) => ReactNode;
  // A click on the header opens the group's own record, by its key.
  isOpenable?: boolean;
  // A view may give each hierarchy level its own visual surface.
  rowClassName?: string;
}

export interface DataTableProps<Row> {
  rows: readonly Row[];
  rowId: (row: Row) => string;
  columns: PerTier<readonly ColumnDefinition<Row>[]>;
  onOpen?: (id: string) => void;
  emptyText: string;
  // A row, or an openable group, the URL points at, marked.
  focusedId?: string | null;
  // Under its row, across every column; null for none.
  noteOf?: (row: Row) => ReactNode;
  // On a phone, each row as a card instead of the table; its title opens it from the keyboard.
  cardOf?: (row: Row) => ReactNode;
  groupBy?: readonly GroupLevel<Row>[];
  stickyHeader?: boolean;
}

interface Group<Row> {
  readonly depth: number;
  readonly key: string;
  readonly rows: readonly Row[];
  // Null at the last level, whose groups hold rows.
  readonly groups: readonly Group<Row>[] | null;
}

export function groupsOf<Row>(
  rows: readonly Row[],
  levels: readonly GroupLevel<Row>[],
  depth = 0,
  parentKey: string | null = null,
): Group<Row>[] {
  const level = levels[depth];
  if (level === undefined) {
    return [];
  }

  const keys = level.keysWithin?.(parentKey) ?? [...new Set(rows.map(level.keyOf))];
  return keys.map((key) => {
    const inGroup = rows.filter((row) => level.keyOf(row) === key);
    return {
      depth,
      key,
      rows: inGroup,
      groups: depth + 1 < levels.length ? groupsOf(inGroup, levels, depth + 1, key) : null,
    };
  });
}

// Each level's header shade, the outer one the strongest.
const headerShades = ["bg-muted", "bg-muted/40"] as const;

export function DataTable<Row>({
  rows,
  rowId,
  columns,
  onOpen,
  emptyText,
  focusedId = null,
  noteOf,
  cardOf,
  groupBy = [],
  stickyHeader = false,
}: DataTableProps<Row>) {
  const tier = useTier();
  const shown = valueForTier(columns, tier);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const groups = groupsOf(rows, groupBy);
  const isGrouped = groupBy.length > 0;

  if (isGrouped ? groups.length === 0 : rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  // A click on a link or a button inside a row is that control's, not the row's.
  const openFrom = (id: string, target: EventTarget) => {
    if (onOpen === undefined || (target as Element).closest("a, button")) {
      return;
    }

    onOpen(id);
  };

  const collapseKeyOf = (group: Group<Row>) => `${group.depth}:${group.key}`;
  const toggle = (group: Group<Row>) => {
    const key = collapseKeyOf(group);
    const next = new Set(collapsed);
    if (!next.delete(key)) {
      next.add(key);
    }

    setCollapsed(next);
  };

  // The header's content: inside the toggle when the level collapses.
  const headerOf = (group: Group<Row>, level: GroupLevel<Row>) => {
    const content = level.header(group.key, group.rows);
    if (!level.isCollapsible) {
      return content;
    }

    const isCollapsed = collapsed.has(collapseKeyOf(group));
    const Chevron = isCollapsed ? ChevronRightIcon : ChevronDownIcon;
    return (
      <button
        type="button"
        aria-expanded={!isCollapsed}
        className="flex w-full items-center gap-2 text-left"
        onClick={() => toggle(group)}
      >
        <Chevron className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">{content}</span>
      </button>
    );
  };

  const isShut = (group: Group<Row>) =>
    groupBy[group.depth]?.isCollapsible === true && collapsed.has(collapseKeyOf(group));

  const emptyLineOf = (group: Group<Row>) =>
    group.rows.length === 0 && group.groups === null
      ? (groupBy[group.depth]?.emptyText?.(group.key) ?? null)
      : null;

  if (tier === "phone" && cardOf !== undefined) {
    const cards = (list: readonly Row[]) =>
      list.map((row) => {
        const id = rowId(row);
        return (
          // biome-ignore lint/a11y/useKeyWithClickEvents: a card's title is the button that opens it; the rest of the card is a larger target for the pointer.
          <li
            key={id}
            data-focused={id === focusedId || undefined}
            className={cn(
              "scroll-mt-4 rounded-lg border bg-card px-3.5 py-3 text-[0.8125rem]",
              onOpen !== undefined && "cursor-pointer hover:bg-muted",
              id === focusedId && "border-ring bg-tone-blue",
            )}
            onClick={(event) => openFrom(id, event.target)}
          >
            {cardOf(row)}
          </li>
        );
      });
    const groupCards = (list: readonly Group<Row>[]): ReactNode[] =>
      list.map((group) => {
        const level = groupBy[group.depth];
        const empty = emptyLineOf(group);
        return (
          <Fragment key={collapseKeyOf(group)}>
            {level !== undefined && (
              // biome-ignore lint/a11y/useKeyWithClickEvents: an openable header holds the link that opens it from the keyboard.
              <li
                data-focused={group.key === focusedId || undefined}
                className={cn(
                  "rounded-md px-2 py-1.5 text-xs",
                  headerShades[group.depth] ?? headerShades[1],
                  level.isOpenable === true && "cursor-pointer",
                  level.rowClassName,
                  group.key === focusedId && "ring-1 ring-ring",
                )}
                onClick={
                  level.isOpenable === true
                    ? (event) => openFrom(group.key, event.target)
                    : undefined
                }
              >
                {headerOf(group, level)}
              </li>
            )}
            {!isShut(group) && (
              <>
                {empty !== null && <li className="px-2 text-xs text-muted-foreground">{empty}</li>}
                {group.groups === null ? cards(group.rows) : groupCards(group.groups)}
              </>
            )}
          </Fragment>
        );
      });
    return <ul className="grid gap-2">{isGrouped ? groupCards(groups) : cards(rows)}</ul>;
  }

  const rowsOf = (list: readonly Row[]) =>
    list.map((row) => {
      const id = rowId(row);
      const note = noteOf?.(row) ?? null;
      return (
        <Fragment key={id}>
          <tr
            data-focused={id === focusedId || undefined}
            className={cn(
              "scroll-mt-4 border-t",
              onOpen !== undefined && "cursor-pointer hover:bg-muted",
              id === focusedId && "bg-tone-blue",
            )}
            onClick={(event) => openFrom(id, event.target)}
          >
            {shown.map((column) => (
              <td
                key={column.key}
                className={cn(
                  "px-3 py-2.25 align-top",
                  column.isNumeric && "text-right tabular-nums",
                )}
              >
                {column.cell(row)}
              </td>
            ))}
          </tr>
          {note !== null && (
            <tr>
              <td colSpan={shown.length} className="px-3 pb-2.5">
                {note}
              </td>
            </tr>
          )}
        </Fragment>
      );
    });

  const groupRows = (list: readonly Group<Row>[]): ReactNode[] =>
    list.map((group) => {
      const level = groupBy[group.depth];
      const empty = emptyLineOf(group);
      const isOpenable = level?.isOpenable === true && onOpen !== undefined;
      return (
        <Fragment key={collapseKeyOf(group)}>
          {level !== undefined && (
            <tr
              data-focused={group.key === focusedId || undefined}
              className={cn(
                "scroll-mt-4 border-t",
                headerShades[group.depth] ?? headerShades[1],
                isOpenable && "cursor-pointer hover:bg-muted",
                level?.rowClassName,
                group.key === focusedId && "bg-tone-blue",
              )}
              onClick={isOpenable ? (event) => openFrom(group.key, event.target) : undefined}
            >
              <td colSpan={shown.length} className="px-3 py-2">
                {headerOf(group, level)}
              </td>
            </tr>
          )}
          {!isShut(group) && (
            <>
              {empty !== null && (
                <tr className="border-t">
                  <td colSpan={shown.length} className="px-3 py-2 text-xs text-muted-foreground">
                    {empty}
                  </td>
                </tr>
              )}
              {group.groups === null ? rowsOf(group.rows) : groupRows(group.groups)}
            </>
          )}
        </Fragment>
      );
    });

  return (
    <div className={cn("rounded-lg border", stickyHeader ? "overflow-visible" : "overflow-hidden")}>
      <table className="w-full border-collapse text-[0.8125rem]">
        <thead className={stickyHeader ? "sticky top-0 z-10" : undefined}>
          <tr className="bg-muted">
            {shown.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-3 py-2 text-left text-xs font-medium text-muted-foreground",
                  column.isNumeric && "text-right",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{isGrouped ? groupRows(groups) : rowsOf(rows)}</tbody>
      </table>
    </div>
  );
}
