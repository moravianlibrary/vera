// What a list view declares once, so the parts that read its state agree on it: how its filter
// is written in the URL, when two filters are the same (the watchlist comparer), the fields its
// filter bar offers and how its rows may be grouped (frontend/component-interfaces.md §9.2,
// §3.1). The URL hook, the filter bar, the watchlist tabs and the list read it.

import type { Audience } from "@/domain/documents";
import type { WatchlistView } from "@/domain/entities";
import type { ReferenceKind } from "@/hooks/use-reference-labels";
import type { DayPreset, DayRange, ValueRange } from "@/lib/value-range";

// A filter's query: a search, and fields that are each a list of values matching any of them.
export interface FilterableQuery {
  readonly search?: string;
}

// The query's fields that hold a list of values.
export type ListFieldOf<Query> = {
  [Key in keyof Query]-?: NonNullable<Query[Key]> extends readonly string[] ? Key : never;
}[keyof Query] &
  string;

// The query's fields that hold a range of counts, and of days.
export type NumberRangeFieldOf<Query> = {
  [Key in keyof Query]-?: NonNullable<Query[Key]> extends ValueRange<number> ? Key : never;
}[keyof Query] &
  string;

export type DateRangeFieldOf<Query> = {
  [Key in keyof Query]-?: NonNullable<Query[Key]> extends DayRange ? Key : never;
}[keyof Query] &
  string;

// Where a list field's values come from: a closed vocabulary, in its own order, or records named
// by id, by name.
export type ListFieldKind =
  | {
      readonly kind: "vocabulary";
      readonly values: readonly string[];
      readonly labels: Readonly<Record<string, string>>;
    }
  | { readonly kind: "reference"; readonly reference: ReferenceKind };

// A closed vocabulary whose labels name every value.
export function vocabulary<Value extends string>(
  values: readonly Value[],
  labels: Readonly<Record<Value, string>>,
): ListFieldKind {
  return { kind: "vocabulary", values, labels };
}

interface FilterFieldBase {
  readonly label: string;
  // The one audience that has the field; absent, both have it.
  readonly audience?: Audience;
}

export interface ListFieldDefinition<Query> extends FilterFieldBase {
  readonly key: ListFieldOf<Query>;
  readonly field: ListFieldKind;
  // On the bar itself, reading "any" when empty; otherwise a
  // chip once a value is picked, under "+ Add filter".
  readonly isQuick?: boolean;
}

// A range is advanced (filtering.md §3.3, §6): only the Advanced editor builds it, at notebook
// and large; every tier shows it as a chip that can be removed (view-rules.md §2, rule 1).
export interface NumberRangeFieldDefinition<Query> extends FilterFieldBase {
  readonly key: NumberRangeFieldOf<Query>;
  // "pages", after the numbers; the ranges offered before two ends are typed.
  readonly field: {
    readonly kind: "numberRange";
    readonly unit: string;
    readonly presets?: readonly ValueRange<number>[];
  };
}

export interface DateRangeFieldDefinition<Query> extends FilterFieldBase {
  readonly key: DateRangeFieldOf<Query>;
  readonly field: { readonly kind: "dateRange"; readonly presets?: readonly DayPreset[] };
}

export type RangeFieldDefinition<Query> =
  | NumberRangeFieldDefinition<Query>
  | DateRangeFieldDefinition<Query>;

export type FilterFieldDefinition<Query> = ListFieldDefinition<Query> | RangeFieldDefinition<Query>;

export function isRangeField<Query>(
  definition: FilterFieldDefinition<Query>,
): definition is RangeFieldDefinition<Query> {
  return definition.field.kind === "numberRange" || definition.field.kind === "dateRange";
}

export interface ViewGroupingOption<Grouping extends string> {
  readonly value: Grouping;
  readonly label: string;
}

export interface ViewDefinition<Query, Grouping extends string = never> {
  // The watchlists saved over it; a view without watchlists has none.
  readonly view?: WatchlistView;
  readonly toSearchParams: (query: Query) => URLSearchParams;
  // Unknown or malformed values are dropped, so a stale link still opens the view.
  readonly parseSearchParams: (params: URLSearchParams) => Query;
  readonly isSameQuery: (first: Query, second: Query) => boolean;
  // In the order the bar and the picker list them.
  readonly fields: readonly FilterFieldDefinition<Query>[];
  // Its records show properties, so it filters on each one the person may read
  // (DOC-property-filter), after its own fields.
  readonly filtersProperties?: boolean;
  // Every grouping the view knows; a page offers those the caller may use. Grouping is
  // presentation, never part of the filter or of a watchlist (filtering.md §3.4).
  readonly groupings: readonly ViewGroupingOption<Grouping>[];
  readonly groupingParam: string;
}

// The grouping the URL names, or null when it names none the view knows.
export function parseGrouping<Grouping extends string>(
  definition: Pick<ViewDefinition<unknown, Grouping>, "groupings" | "groupingParam">,
  params: URLSearchParams,
): Grouping | null {
  const raw = params.get(definition.groupingParam);
  return definition.groupings.find((option) => option.value === raw)?.value ?? null;
}
