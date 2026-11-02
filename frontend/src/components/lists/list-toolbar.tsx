// The strip over a list: what it counts, and how its rows may be grouped
// (component-interfaces.md §2.2). It sticks to the top of the list's scroll box; the table
// header sticks under it, so it keeps its height of 2.5rem.
// Acts over the picked rows sit after the count (view-rules.md §1.2).

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        <Select
          value={groupings.value ?? "none"}
          onValueChange={(value) =>
            groupings.onChange(
              value === "none"
                ? null
                : (groupings.options.find((option) => option.value === value)?.value ?? null),
            )
          }
        >
          <SelectTrigger
            aria-label={t("filter.groupList")}
            className="ml-auto text-muted-foreground"
            size="sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("filter.noGrouping")}</SelectItem>
            {groupings.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
