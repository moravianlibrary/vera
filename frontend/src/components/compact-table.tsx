// A small comparison table inside a dialog or detail card; unlike DataTable, rows do not open.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CompactColumn<Row> {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  align?: "start" | "end";
  isHiddenOnPhone?: boolean;
}

export function CompactTable<Row>({
  rows,
  rowKey,
  columns,
  label,
  className,
}: {
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  columns: readonly CompactColumn<Row>[];
  label?: string;
  className?: string;
}) {
  return (
    <table aria-label={label} className={cn("w-full text-xs", className)}>
      <thead className="text-muted-foreground">
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              className={cn(
                "py-1.5 font-medium",
                column.align === "end" ? "text-right tabular-nums" : "text-left",
                column.isHiddenOnPhone && "hidden sm:table-cell",
              )}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} className="border-b last:border-0">
            {columns.map((column) => (
              <td
                key={column.key}
                className={cn(
                  "py-1.5",
                  column.align === "end" && "text-right tabular-nums",
                  column.isHiddenOnPhone && "hidden sm:table-cell",
                )}
              >
                {column.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
