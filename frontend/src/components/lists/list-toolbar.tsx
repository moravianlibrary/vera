// The strip over a list: what it counts, and how its rows may be grouped
// (component-interfaces.md §2.2). It sticks to the top of the list's scroll box; the table
// header sticks under it, so it keeps its height of 2.5rem.
// TODO(rrandiak): actions over the picked rows (view-rules.md §1.2); labels move to i18n.

import type { ViewGroupingOption } from "@/lib/view-definition";

export interface ListGroupings<Grouping extends string> {
  // Those the caller may use; none hides the picker.
  options: readonly ViewGroupingOption<Grouping>[];
  value: Grouping | null;
  onChange: (grouping: Grouping | null) => void;
}

export interface ListToolbarProps<Grouping extends string> {
  // "34 documents · 41 asks".
  count: string;
  groupings?: ListGroupings<Grouping>;
}

export function ListToolbar<Grouping extends string>({
  count,
  groupings,
}: ListToolbarProps<Grouping>) {
  return (
    <div className="sticky top-0 z-20 flex h-10 items-center gap-2 border-b bg-background px-4">
      <span className="text-[0.6875rem] font-bold tracking-wider text-muted-foreground uppercase">
        {count}
      </span>

      {groupings !== undefined && groupings.options.length > 0 && (
        <select
          aria-label="Group the list"
          className="ml-auto h-7 rounded-md border bg-background px-2 text-xs text-muted-foreground"
          value={groupings.value ?? ""}
          onChange={(event) =>
            groupings.onChange(
              groupings.options.find((option) => option.value === event.target.value)?.value ??
                null,
            )
          }
        >
          <option value="">No grouping</option>
          {groupings.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
