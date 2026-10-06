// A view's filter bar, one line that wraps when narrow (filtering.md §3, §6), read left to right:
// the search, the quick fields, the view's own toggles, then the other fields as chips with
// "+ Add filter". The view declares its fields (lib/view-definition.ts); the bar builds the
// controls, their options with facet counts and their labels from the declaration.
// TODO(rrandiak): the Advanced editor and date ranges (filtering.md §3.3); the phone tier's
// single Filter button and sheet; labels move to i18n.

import { Search } from "lucide-react";
import type { ReactNode } from "react";
import type { FilterField } from "@/components/filters/filter-controls";
import {
  AddFilterMenu,
  byLabel,
  byOrderOf,
  FilterChip,
  optionsOf,
  QuickFilter,
} from "@/components/filters/filter-controls";
import { Input } from "@/components/ui/input";
import { useReferenceLabels } from "@/hooks/use-reference-labels";
import type { FilterableQuery, FilterFieldDefinition } from "@/lib/view-definition";

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
}

export function FilterBar<Query extends FilterableQuery>({
  fields,
  query,
  facets,
  onQueryChange,
  searchLabel,
  searchPlaceholder,
  extras,
}: FilterBarProps<Query>) {
  const labels = useReferenceLabels(
    fields.flatMap(({ field }) => (field.kind === "reference" ? [field.reference] : [])),
  );

  const filterFieldOf = ({ key, label, field }: FilterFieldDefinition<Query>): FilterField => {
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

  const quickFields = fields.filter((field) => field.isQuick === true).map(filterFieldOf);
  const chipFields = fields.filter((field) => field.isQuick !== true).map(filterFieldOf);
  const activeChipFields = chipFields.filter((field) => field.selected.length > 0);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:px-6">
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
    </div>
  );
}
