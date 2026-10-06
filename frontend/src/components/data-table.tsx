// A full-width table (component-interfaces.md §2.4; docs/demos/shared/vera.css .pj-table): the
// columns each tier declares, the dropped ones gone at that tier, and a row that opens its
// record anywhere it is clicked; a link inside it is still a link. Used where records pile up
// for the audit that asks years later, such as the projects that ended or were rejected.
// TODO(rrandiak): grouping, note rows, row actions and paging (§2.4) arrive with Tasks and
// Plugins (plan.md steps 8 and 10), the first tables that need them.

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
}

export function DataTable<Row>({
  rows,
  rowId,
  columns,
  onOpen,
  emptyText,
  focusedId = null,
}: DataTableProps<Row>) {
  const shown = valueForTier(columns, useTier());

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
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
            return (
              <tr
                key={id}
                data-focused={id === focusedId || undefined}
                className={cn(
                  "scroll-mt-4 border-t",
                  onOpen !== undefined && "cursor-pointer hover:bg-muted",
                  id === focusedId && "bg-tone-blue",
                )}
                onClick={(event) => {
                  if (onOpen === undefined || (event.target as Element).closest("a, button")) {
                    return;
                  }

                  onOpen(id);
                }}
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
