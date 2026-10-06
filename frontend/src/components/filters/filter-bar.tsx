// A view's filter bar, one line that wraps when narrow (filtering.md §3, §6), read left to right:
// the search, the quick fields, the view's own toggles, then the other fields as chips with
// "+ Add filter", then the ranges with "Advanced…". The view declares its fields
// (lib/view-definition.ts); the bar builds the controls, their options with facet counts and
// their labels from the declaration. Its depth follows the tier (component-interfaces.md §3.2):
// the Advanced editor is a panel under the bar at large and a dialog at notebook; at small a
// range is a chip that only reads and can be removed; a phone keeps the search and one Filter
// button, and the rest opens as a sheet (filter-sheet.tsx).
// TODO(rrandiak): labels move to i18n.

import { Search, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  AdvancedFilter,
  RangeChip,
  rangeOf,
  rangeSummaryOf,
} from "@/components/filters/advanced-filter";
import type { FilterField } from "@/components/filters/filter-controls";
import {
  AddFilterMenu,
  byLabel,
  byOrderOf,
  FilterChip,
  optionsOf,
  QuickFilter,
} from "@/components/filters/filter-controls";
import { FilterSheet } from "@/components/filters/filter-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useReferenceLabels } from "@/hooks/use-reference-labels";
import { useTier } from "@/hooks/use-tier";
import type {
  FilterableQuery,
  FilterFieldDefinition,
  ListFieldDefinition,
} from "@/lib/view-definition";
import { isRangeField } from "@/lib/view-definition";

export interface FacetCount {
  readonly value: string;
  readonly count: number;
}

// Each field's values with a match, counted over every other active filter.
export type Facets = Readonly<Partial<Record<string, readonly FacetCount[]>>>;

interface FilterBarProps<Query extends FilterableQuery> {
  // The fields of the view the caller has, in order.
  fields: readonly FilterFieldDefinition<Query>[];
  query: Query;
  // From the list's first slice; undefined until it answers.
  facets: Facets | undefined;
  onQueryChange: (query: Query) => void;
  searchLabel: string;
  searchPlaceholder: string;
  // Toggles that are not fields, after the quick fields: Documents' "Mine".
  extras?: ReactNode;
  // How many of those toggles are on, for the phone's Filter (n).
  activeExtraCount?: number;
}

export function FilterBar<Query extends FilterableQuery>({
  fields,
  query,
  facets,
  onQueryChange,
  searchLabel,
  searchPlaceholder,
  extras,
  activeExtraCount = 0,
}: FilterBarProps<Query>) {
  const tier = useTier();
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const listDefinitions = fields.filter(
    (field): field is ListFieldDefinition<Query> => !isRangeField(field),
  );
  const rangeDefinitions = fields.filter(isRangeField);
  const labels = useReferenceLabels(
    listDefinitions.flatMap(({ field }) => (field.kind === "reference" ? [field.reference] : [])),
  );

  const filterFieldOf = ({ key, label, field }: ListFieldDefinition<Query>): FilterField => {
    const selected = (query[key] as readonly string[] | undefined) ?? [];
    const counts = facets?.[key];
    const change = (values: string[]) => onQueryChange({ ...query, [key]: values });

    if (field.kind === "reference") {
      return {
        key,
        label,
        options: optionsOf(counts, selected, labels[field.reference]).toSorted(byLabel),
        selected,
        onChange: change,
      };
    }

    return {
      key,
      label,
      options: optionsOf(counts, selected, (value) => field.labels[value] ?? value).toSorted(
        byOrderOf(field.values),
      ),
      selected,
      // A stale value outside the vocabulary is dropped on the next pick.
      onChange: (values) => change(values.filter((value) => field.values.includes(value))),
    };
  };

  const quickFields = listDefinitions.filter((field) => field.isQuick === true).map(filterFieldOf);
  const chipFields = listDefinitions.filter((field) => field.isQuick !== true).map(filterFieldOf);
  const activeChipFields = chipFields.filter((field) => field.selected.length > 0);

  const canBuildRanges = tier === "notebook" || tier === "large";
  const activeRanges = rangeDefinitions.flatMap((field) => {
    const range = rangeOf(query, field);
    return range === undefined ? [] : [{ field, range }];
  });
  const rangeChips = activeRanges.map(({ field, range }) => (
    <RangeChip
      key={field.key}
      label={field.label}
      summary={rangeSummaryOf(field, range)}
      onRemove={() => onQueryChange({ ...query, [field.key]: undefined })}
      onOpen={canBuildRanges ? () => setIsAdvancedOpen(true) : undefined}
    />
  ));

  const search = (
    <div className="relative max-w-88 min-w-44 flex-1">
      <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label={searchLabel}
        className="h-8 pl-8"
        placeholder={searchPlaceholder}
        defaultValue={query.search}
        onChange={(event) => onQueryChange({ ...query, search: event.target.value })}
      />
    </div>
  );

  if (tier === "phone") {
    const activeCount =
      [...quickFields, ...chipFields].filter((field) => field.selected.length > 0).length +
      activeRanges.length +
      activeExtraCount;
    const clearFields = () =>
      onQueryChange({
        ...query,
        ...Object.fromEntries(fields.map((field) => [field.key, undefined])),
      });

    return (
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5">
        {search}
        <Button
          variant={activeCount > 0 ? "secondary" : "outline"}
          size="sm"
          className="shrink-0"
          onClick={() => setIsSheetOpen(true)}
        >
          <SlidersHorizontal />
          Filter
          {activeCount > 0 && <b className="tabular-nums">{activeCount}</b>}
        </Button>
        <FilterSheet
          isOpen={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          quickFields={quickFields}
          chipFields={chipFields}
          extras={extras}
          rangeChips={rangeChips}
          onClear={clearFields}
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:px-6">
        {search}

        {quickFields.map((field) => (
          <QuickFilter key={field.key} field={field} />
        ))}

        {extras}

        {chipFields.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeChipFields.map((field) => (
              <FilterChip key={field.key} field={field} />
            ))}
            <AddFilterMenu fields={chipFields} />
          </div>
        )}

        {(rangeChips.length > 0 || (canBuildRanges && rangeDefinitions.length > 0)) && (
          <div className="flex flex-wrap items-center gap-2">
            {rangeChips}
            {canBuildRanges && rangeDefinitions.length > 0 && (
              <AdvancedButton
                isPressed={tier === "large" && isAdvancedOpen}
                onSelect={() => setIsAdvancedOpen((isOpen) => !isOpen || tier !== "large")}
              />
            )}
          </div>
        )}
      </div>

      {canBuildRanges && isAdvancedOpen && (
        <AdvancedFilter
          presentation={tier === "large" ? "panel" : "dialog"}
          onClose={() => setIsAdvancedOpen(false)}
          fields={rangeDefinitions}
          query={query}
          onApply={onQueryChange}
        />
      )}
    </>
  );
}

function AdvancedButton({ isPressed, onSelect }: { isPressed: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={isPressed}
      onClick={onSelect}
      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-muted aria-pressed:text-foreground"
    >
      <SlidersHorizontal className="size-3.5" />
      Advanced…
    </button>
  );
}
