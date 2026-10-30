// The strip over a list: what it counts, and how its rows may be grouped
// (component-interfaces.md §2.2). It sticks to the top of the list's scroll box; the table
// header sticks under it, so it keeps its height of 2.5rem.
// Acts over the picked rows sit after the count (view-rules.md §1.2).

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
  // Picking rows and what is done to the picked ones: Documents' *Select*.
  actions?: ReactNode;
}

export function ListToolbar<Grouping extends string>({
  count,
  groupings,
  actions,
}: ListToolbarProps<Grouping>) {
  // Group labels may be keys or plain text; missing keys stay unchanged.
  const { t } = useTranslation("common");
  return (
    <div className="sticky top-0 z-20 flex h-10 items-center gap-2 border-b bg-background px-4">
      <span className="text-caption font-bold tracking-wider text-muted-foreground uppercase">
        {count}
      </span>

      {actions}

      {groupings !== undefined && groupings.options.length > 0 && (
        <select
          aria-label={t("filter.groupList")}
          className="ml-auto h-7 rounded-md border bg-background px-2 text-xs text-muted-foreground"
          value={groupings.value ?? ""}
          onChange={(event) =>
            groupings.onChange(
              groupings.options.find((option) => option.value === event.target.value)?.value ??
                null,
            )
          }
        >
          <option value="">{t("filter.noGrouping")}</option>
          {groupings.options.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.label)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
