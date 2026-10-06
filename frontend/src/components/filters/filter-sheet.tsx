// A view's filter on a phone (component-interfaces.md §3.2; filtering.md §3.3): the bar keeps
// the search and one Filter button counting what is set, and the rest opens as a sheet from the
// bottom. Each field is a list of its values with their counts, the quick ones and those in use
// open; each range is a section with the same editor as the bar's chip (range-filter.tsx). Every
// pick applies at once, so the sheet only needs closing.
// TODO(rrandiak): Back closes the sheet (navigation.md §3.1); labels move to i18n.

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useId } from "react";
import type { FilterField } from "@/components/filters/filter-controls";
import type { AnyRange } from "@/components/filters/range-filter";
import { RangeEditor, rangeOf, rangeSummaryOf } from "@/components/filters/range-filter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { RangeFieldDefinition } from "@/lib/view-definition";

interface FilterSheetProps<Query> {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  quickFields: readonly FilterField[];
  // Every other list field, those in use and not.
  chipFields: readonly FilterField[];
  // The view's toggles that are not fields: Documents' "Mine".
  extras?: ReactNode;
  rangeFields: readonly RangeFieldDefinition<Query>[];
  query: Query;
  onRangeChange: (key: string, range: AnyRange | undefined) => void;
  onClear: () => void;
}

export function FilterSheet<Query>({
  isOpen,
  onOpenChange,
  quickFields,
  chipFields,
  extras,
  rangeFields,
  query,
  onRangeChange,
  onClear,
}: FilterSheetProps<Query>) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-xl p-0">
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle>Filter</SheetTitle>
          <SheetDescription className="sr-only">
            Choose the values each field matches; every pick applies at once.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {Boolean(extras) && (
            <div className="flex flex-wrap items-center gap-2 pb-3">{extras}</div>
          )}
          {quickFields.map((field) => (
            <FieldSection key={field.key} field={field} isOpenAtFirst />
          ))}
          {chipFields.map((field) => (
            <FieldSection key={field.key} field={field} isOpenAtFirst={field.selected.length > 0} />
          ))}
          {rangeFields.map((field) => (
            <RangeSection
              key={field.key}
              field={field}
              range={rangeOf(query, field)}
              onChange={(range) => onRangeChange(field.key, range)}
            />
          ))}
        </div>

        <SheetFooter className="flex-row border-t px-5 py-3">
          <Button variant="outline" className="flex-1" onClick={onClear}>
            Clear all
          </Button>
          <Button className="flex-1" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FieldSection({ field, isOpenAtFirst }: { field: FilterField; isOpenAtFirst: boolean }) {
  const id = useId();
  const toggle = (value: string, isChecked: boolean) => {
    const rest = field.selected.filter((selected) => selected !== value);
    field.onChange(isChecked ? [...rest, value] : rest);
  };
  const summary = field.selected
    .map((value) => field.options.find((option) => option.value === value)?.label ?? value)
    .join(", ");

  return (
    <Collapsible defaultOpen={isOpenAtFirst} className="group border-b last:border-b-0">
      <CollapsibleTrigger className="flex w-full items-center gap-2 py-3 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <span className="font-medium">{field.label}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{summary || "any"}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-0.5 pb-3">
        {field.options.length === 0 && (
          <p className="py-1 text-xs text-muted-foreground">Nothing to choose here.</p>
        )}
        {field.options.map((option) => {
          const optionId = `${id}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className="flex min-h-9 items-center gap-3 rounded-md px-1 text-sm"
            >
              <Checkbox
                id={optionId}
                checked={field.selected.includes(option.value)}
                onCheckedChange={(state) => toggle(option.value, state === true)}
              />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.count !== null && (
                <span className="text-xs text-muted-foreground tabular-nums">{option.count}</span>
              )}
            </label>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface RangeSectionProps<Query> {
  field: RangeFieldDefinition<Query>;
  range: AnyRange | undefined;
  onChange: (range: AnyRange | undefined) => void;
}

function RangeSection<Query>({ field, range, onChange }: RangeSectionProps<Query>) {
  return (
    <Collapsible defaultOpen={range !== undefined} className="group border-b last:border-b-0">
      <CollapsibleTrigger className="flex w-full items-center gap-2 py-3 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <span className="font-medium">{field.label}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {range === undefined ? "any" : rangeSummaryOf(field, range)}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-2 pb-3">
        {/* Keyed by the range, so a preset picked or a range applied starts the ends afresh. */}
        <RangeEditor key={JSON.stringify(range)} field={field} range={range} onApply={onChange} />
        {range !== undefined && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-self-start"
            onClick={() => onChange(undefined)}
          >
            Any {field.label.toLowerCase()}
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
