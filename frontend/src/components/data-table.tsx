// A full-width table (component-interfaces.md §2.4; docs/demos/shared/vera.css .pj-table): the
// columns each tier declares, the dropped ones gone at that tier, and a row that opens its
// record anywhere it is clicked; a link or a button inside it is still itself. Used where
// records pile up for the audit that asks years later, such as the projects that ended or the
// runs that finished. A row may carry a note under it, full width (a failed run's red line with
// *Run again*), and on a phone the rows may become cards instead.
// TODO(rrandiak): grouping, row actions and paging (§2.4) arrive with Plugins (plan.md step 10),
// the first table that needs them.

import type { ReactNode } from "react";
import { Fragment } from "react";
import type { ColumnDefinition } from "@/components/lists/record-list";
import type { PerTier } from "@/hooks/use-tier";
import { useTier, valueForTier } from "@/hooks/use-tier";
import { cn } from "@/lib/utils";

export interface DataTableProps<Row> {
  rows: readonly Row[];
  rowId: (row: Row) => string;
  columns: PerTier<readonly ColumnDefinition<Row>[]>;
  onOpen?: (id: string) => void;
  emptyText: string;
  // A row the URL points at, marked.
  focusedId?: string | null;
  // Under its row, across every column; null for none.
  noteOf?: (row: Row) => ReactNode;
  // On a phone, each row as a card instead of the table; its title opens it from the keyboard.
  cardOf?: (row: Row) => ReactNode;
}

export function DataTable<Row>({
  rows,
  rowId,
  columns,
  onOpen,
  emptyText,
  focusedId = null,
  noteOf,
  cardOf,
}: DataTableProps<Row>) {
  const tier = useTier();
  const shown = valueForTier(columns, tier);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  // A click on a link or a button inside a row is that control's, not the row's.
  const openFrom = (id: string, target: EventTarget) => {
    if (onOpen === undefined || (target as Element).closest("a, button")) {
      return;
    }

    onOpen(id);
  };

  if (tier === "phone" && cardOf !== undefined) {
    return (
      <ul className="grid gap-2">
        {rows.map((row) => {
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
        })}
      </ul>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full border-collapse text-[0.8125rem]">
        <thead>
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
        <tbody>
          {rows.map((row) => {
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
          })}
        </tbody>
      </table>
    </div>
  );
}
