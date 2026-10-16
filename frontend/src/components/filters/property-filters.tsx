// A view's filters on properties (DOC-property-filter), on the same bar as its own fields. An enum
// or yes/no property, a list of them included, is a field of values like any other, each with
// how many records it finds, and *No value*. A text, number or date property is a chip of its
// own, reading "any" until it is given a range, or text it contains, starts with or ends with; it
// too takes *No value*.
// Each property the person may read is offered under "+ Add filter".
// TODO(rrandiak): labels move to i18n.

import type { PropertyFacets, PropertyParams } from "@vera/contract/properties";
import { conditionsOf, withCondition, withoutCondition } from "@vera/contract/properties";
import type { PropertyCondition, PropertyDefinition, TextMatch } from "@vera/domain/properties";
import {
  enumValueNameOf,
  propertyNameOf,
  textConditionOf,
  textMatches,
  textMatchLabels,
  textSummaryOf,
  withTextCondition,
  yesNoValues,
} from "@vera/domain/properties";
import type { DayRange, ValueRange } from "@vera/domain/value-range";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { FilterField } from "@/components/filters/filter-controls";
import {
  AddFilterMenu,
  byOrderOf,
  FilterChip,
  optionsOf,
} from "@/components/filters/filter-controls";
import { RangeEditor, rangeSummaryOf } from "@/components/filters/range-filter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { RangeFieldDefinition } from "@/lib/view-definition";

export interface PropertyFilterProps {
  // The properties the page shows that the person may read, in the order they are offered.
  readonly definitions: readonly PropertyDefinition[];
  readonly params: PropertyParams | undefined;
  readonly facets: PropertyFacets | undefined;
  readonly onChange: (params: PropertyParams | undefined) => void;
}

// The option *No value* stands for in a field of values.
const noValueOption = "\u0000none";
const noValueLabel = "No value";

export function isValuedProperty(definition: PropertyDefinition): boolean {
  return definition.type.kind === "enum" || definition.type.kind === "yesNo";
}

const fieldKeyOf = (definition: PropertyDefinition) => `p.${definition.key}`;

// The enum and yes/no properties as fields of values, *No value* last.
export function propertyListFieldsOf(
  { definitions, params, facets, onChange }: PropertyFilterProps,
  offersEvery: boolean,
): FilterField[] {
  const conditions = conditionsOf(params, definitions);
  return definitions.filter(isValuedProperty).map((definition) => {
    const condition = conditions.find((candidate) => candidate.key === definition.key);
    const facet = facets?.[definition.key];
    const known =
      definition.type.kind === "enum"
        ? definition.type.values.map(({ value }) => value)
        : [...yesNoValues];
    const selected = [
      ...(condition?.anyOf ?? []),
      ...(condition?.hasNoValue === true ? [noValueOption] : []),
    ];
    const options = optionsOf(
      facet?.values,
      condition?.anyOf,
      (value) => enumValueNameOf(definition, value),
      offersEvery ? known : [],
    ).toSorted(byOrderOf(known));
    return {
      key: fieldKeyOf(definition),
      label: propertyNameOf(definition),
      options: [
        ...options,
        { value: noValueOption, label: noValueLabel, count: facet?.noValue ?? null },
      ],
      selected,
      onChange: (values: string[]) =>
        onChange(
          withCondition(params, {
            key: definition.key,
            hasNoValue: values.includes(noValueOption) || undefined,
            anyOf: values.filter((value) => known.includes(value)),
          }),
        ),
    };
  });
}

// ---------------------------------------------------------------- text, number and date

function rangeFieldOf(definition: PropertyDefinition): RangeFieldDefinition<object> {
  const label = propertyNameOf(definition);
  return definition.type.kind === "date"
    ? ({ key: fieldKeyOf(definition), label, field: { kind: "dateRange" } } as never)
    : ({
        key: fieldKeyOf(definition),
        label,
        field: {
          kind: "numberRange",
          unit: definition.type.kind === "number" ? definition.type.unit : "",
        },
      } as never);
}

function summaryOf(definition: PropertyDefinition, condition: PropertyCondition | undefined) {
  if (condition === undefined) {
    return null;
  }

  const parts = [
    textSummaryOf(condition),
    condition.numberRange === undefined
      ? null
      : rangeSummaryOf(rangeFieldOf(definition), condition.numberRange),
    condition.dayRange === undefined
      ? null
      : rangeSummaryOf(rangeFieldOf(definition), condition.dayRange),
    condition.hasNoValue === true ? "no value" : null,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(" or ");
}

interface PropertyChipProps {
  definition: PropertyDefinition;
  condition: PropertyCondition | undefined;
  isOpenAtFirst: boolean;
  onChange: (condition: PropertyCondition) => void;
  onRemove: () => void;
}

export function PropertyChip({
  definition,
  condition,
  isOpenAtFirst,
  onChange,
  onRemove,
}: PropertyChipProps) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState(() => textConditionOf(condition).text);
  const [match, setMatch] = useState<TextMatch>(() => textConditionOf(condition).match);
  const summary = summaryOf(definition, condition);
  const label = propertyNameOf(definition);
  const key = definition.key;
  const hasNoValue = condition?.hasNoValue === true;
  useEffect(() => {
    if (!isOpenAtFirst) {
      return;
    }

    const frame = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [isOpenAtFirst]);

  return (
    <span
      className={cn(
        "inline-flex h-7 max-w-72 items-center rounded-md border text-xs",
        summary !== null
          ? "bg-secondary text-secondary-foreground"
          : "bg-background text-muted-foreground",
      )}
    >
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger className="inline-flex h-full min-w-0 items-center gap-1 rounded-l-md pr-1 pl-2 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <span className="truncate">
            {label} <b className={cn(summary !== null && "font-semibold")}>{summary ?? "any"}</b>
          </span>
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-3">
          <div className="grid gap-3 text-sm">
            {definition.type.kind === "text" ? (
              <form
                className="grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  onChange(
                    withTextCondition(
                      { key, hasNoValue: hasNoValue || undefined },
                      match,
                      text.trim(),
                    ),
                  );
                  setIsOpen(false);
                }}
              >
                <Select value={match} onValueChange={(value) => setMatch(value as TextMatch)}>
                  <SelectTrigger aria-label={`How ${label} matches`} size="sm" className="w-fit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {textMatches.map((candidate) => (
                      <SelectItem key={candidate} value={candidate}>
                        {textMatchLabels[candidate]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id={`${id}-text`}
                  aria-label={`${label} ${textMatchLabels[match].toLocaleLowerCase()}`}
                  className="h-8"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                />
                <Button
                  type="submit"
                  size="sm"
                  className="justify-self-start"
                  disabled={text.trim() === ""}
                >
                  Apply
                </Button>
              </form>
            ) : (
              <RangeEditor
                field={rangeFieldOf(definition)}
                range={condition?.numberRange ?? condition?.dayRange}
                onApply={(range) => {
                  onChange({
                    key,
                    hasNoValue: hasNoValue || undefined,
                    ...(definition.type.kind === "date"
                      ? { dayRange: range as DayRange }
                      : { numberRange: range as ValueRange<number> }),
                  });
                  setIsOpen(false);
                }}
              />
            )}
            <label htmlFor={`${id}-none`} className="flex items-center gap-2 border-t pt-3 text-xs">
              <Checkbox
                id={`${id}-none`}
                checked={hasNoValue}
                onCheckedChange={(checked) =>
                  onChange({ ...(condition ?? { key }), hasNoValue: checked === true || undefined })
                }
              />
              Or no value
            </label>
          </div>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove the ${label} filter`}
        title="Remove this filter"
        className="grid h-full place-items-center rounded-r-md px-1.5 text-muted-foreground outline-none hover:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

// The text, number and date properties on the bar: those with a condition, and those just added.
export function usePropertyChips(properties: PropertyFilterProps | undefined) {
  const [addedKeys, setAddedKeys] = useState<readonly string[]>([]);
  const [openedKey, setOpenedKey] = useState<string | null>(null);
  if (properties === undefined) {
    return { chips: [], addable: [], add: () => {}, activeCount: 0 };
  }

  const { definitions, params, onChange } = properties;
  const conditions = conditionsOf(params, definitions);
  const chipDefinitions = definitions.filter((definition) => !isValuedProperty(definition));
  const onBar = chipDefinitions.filter(
    (definition) =>
      conditions.some((condition) => condition.key === definition.key) ||
      addedKeys.includes(definition.key),
  );
  const chips = onBar.map((definition) => (
    <PropertyChip
      key={definition.key}
      definition={definition}
      condition={conditions.find((condition) => condition.key === definition.key)}
      isOpenAtFirst={definition.key === openedKey}
      onChange={(condition) => onChange(withCondition(params, condition))}
      onRemove={() => {
        setAddedKeys((keys) => keys.filter((key) => key !== definition.key));
        onChange(withoutCondition(params, definition.key));
      }}
    />
  ));
  return {
    chips,
    addable: chipDefinitions.map((definition) => ({
      key: fieldKeyOf(definition),
      label: propertyNameOf(definition),
      isOnBar: onBar.includes(definition),
    })),
    add: (fieldKey: string) => {
      const key = fieldKey.slice("p.".length);
      setAddedKeys((keys) => [...keys, key]);
      setOpenedKey(key);
    },
    activeCount: conditions.filter((condition) =>
      chipDefinitions.some((definition) => definition.key === condition.key),
    ).length,
  };
}

// The property filters alone, for a filter that is not a view's bar: the list editor's pool.
export function PropertyFilterControls({ properties }: { properties: PropertyFilterProps }) {
  const chips = usePropertyChips(properties);
  const fields = propertyListFieldsOf(properties, false);
  if (fields.length === 0 && chips.addable.length === 0) {
    return null;
  }

  return (
    <>
      {fields
        .filter((field) => field.selected.length > 0)
        .map((field) => (
          <FilterChip key={field.key} field={field} />
        ))}
      {chips.chips}
      <AddFilterMenu fields={fields} ranges={chips.addable} onAddRange={chips.add} />
    </>
  );
}
