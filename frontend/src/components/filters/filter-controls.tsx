// The controls of a view's filter bar: quick fields on the bar itself (filtering.md §3.1), and
// the chips with their "+ Add filter" picker (§3.2). A view declares its fields; each is a list
// of values the rows may match, any of them. A quick field always shows and reads "any" when
// empty. Any other field becomes a chip once a value is picked; clicking the chip reopens its
// values, and × strikes the whole field off.
// Ranges, the advanced depth, are advanced-filter.tsx.
// TODO(rrandiak): labels move to i18n.

import { ChevronDown, Plus, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  // Rows that would match, counted over the other filters; null when not counted.
  count: number | null;
}

export interface FilterField {
  key: string;
  label: string;
  options: readonly FilterOption[];
  selected: readonly string[];
  onChange: (values: string[]) => void;
}

interface QuickFilterProps {
  field: FilterField;
}

export function QuickFilter({ field }: QuickFilterProps) {
  const isActive = field.selected.length > 0;
  const summary = isActive ? selectedLabelsOf(field) : "any";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-7 max-w-72 items-center gap-1 rounded-md border px-2 text-xs outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50",
          isActive
            ? "bg-secondary text-secondary-foreground"
            : "bg-background text-muted-foreground",
        )}
      >
        <span className="truncate">
          {field.label}: <b className={cn(isActive && "font-semibold")}>{summary}</b>
        </span>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <FilterOptionItems field={field} />
        {isActive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => field.onChange([])} className="text-xs">
              Any {field.label.toLowerCase()}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface FilterChipProps {
  field: FilterField;
}

export function FilterChip({ field }: FilterChipProps) {
  return (
    <span className="inline-flex h-7 items-center rounded-md border bg-secondary text-xs text-secondary-foreground">
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-full max-w-72 items-center gap-1 rounded-l-md pr-1 pl-2 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <span className="truncate">
            {field.label} <b className="font-semibold">{selectedLabelsOf(field)}</b>
          </span>
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
          <FilterOptionItems field={field} />
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        onClick={() => field.onChange([])}
        aria-label={`Remove the ${field.label} filter`}
        title="Remove this filter"
        className="grid h-full place-items-center rounded-r-md px-1.5 text-muted-foreground outline-none hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

interface AddFilterMenuProps {
  // Every field of the view, those already on the bar included.
  fields: readonly FilterField[];
}

export function AddFilterMenu({ fields }: AddFilterMenuProps) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed px-2 text-xs text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <Plus className="size-3.5" />
        Add filter
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {fields.map((field) => (
          <DropdownMenuSub key={field.key}>
            <DropdownMenuSubTrigger disabled={field.options.length === 0} className="text-xs">
              {field.label}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
              <FilterOptionItems field={field} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------- options

interface FacetCount<Value extends string> {
  value: Value;
  count: number;
}

// The values with a match, plus any picked value that no longer has one, so its chip still reads.
export function optionsOf<Value extends string>(
  counts: readonly FacetCount<Value>[] | undefined,
  selected: readonly Value[] | undefined,
  labelOf: (value: Value) => string,
): FilterOption[] {
  const counted = counts ?? [];
  const unmatched = (selected ?? [])
    .filter((value) => !counted.some((entry) => entry.value === value))
    .map((value) => ({ value, count: 0 }));

  return [...counted, ...unmatched].map(({ value, count }) => ({
    value,
    label: labelOf(value),
    count,
  }));
}

export function byLabel(first: FilterOption, second: FilterOption): number {
  return first.label.localeCompare(second.label);
}

export function byOrderOf(order: readonly string[]) {
  return (first: FilterOption, second: FilterOption): number =>
    order.indexOf(first.value) - order.indexOf(second.value);
}

// ---------------------------------------------------------------- labels

function selectedLabelsOf(field: FilterField): string {
  const labelOf = (value: string) =>
    field.options.find((option) => option.value === value)?.label ?? value;
  return field.selected.map(labelOf).join(", ");
}

interface FilterOptionItemsProps {
  field: FilterField;
}

// Several values can be picked in one go, so a pick keeps the menu open.
function FilterOptionItems({ field }: FilterOptionItemsProps) {
  const toggle = (value: string, isChecked: boolean) => {
    const rest = field.selected.filter((selected) => selected !== value);
    field.onChange(isChecked ? [...rest, value] : rest);
  };

  return (
    <>
      {field.options.map((option) => (
        <DropdownMenuCheckboxItem
          key={option.value}
          checked={field.selected.includes(option.value)}
          onCheckedChange={(isChecked) => toggle(option.value, isChecked)}
          onSelect={(event) => event.preventDefault()}
          className="text-xs"
        >
          <span className="min-w-0 flex-1 truncate">{option.label}</span>
          {option.count !== null && (
            <span className="ml-3 text-muted-foreground tabular-nums">{option.count}</span>
          )}
        </DropdownMenuCheckboxItem>
      ))}
    </>
  );
}
