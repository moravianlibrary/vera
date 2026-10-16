// An intention's conditions on properties (PLAN-scope): each takes what the property's filter
// takes (DOC-property-filter) — some of an enum's or yes/no's values, what a text contains,
// starts with or ends with, a range of numbers or days — and may also take *no value*. All of
// them hold for an item in scope.
// TODO(rrandiak): labels move to i18n.

import type { PropertyCondition, PropertyDefinition, TextMatch } from "@vera/domain/properties";
import {
  enumValueNameOf,
  isActiveCondition,
  propertyNameOf,
  textConditionOf,
  textMatches,
  textMatchLabels,
  textSummaryOf,
  withTextCondition,
  yesNoValues,
} from "@vera/domain/properties";
import { Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePropertiesQuery } from "@/features/properties/use-properties-query";

// "Machines: Zeutschel", "Size: A4 or no value", "Width: 20–40 cm", "Note: starts with “Rare”".
export function conditionTextOf(
  definition: PropertyDefinition | undefined,
  condition: PropertyCondition,
): string {
  if (definition === undefined) {
    return condition.key;
  }

  const range = (from: number | string | undefined, to: number | string | undefined) =>
    from !== undefined && to !== undefined
      ? `${from}–${to}`
      : from !== undefined
        ? `from ${from}`
        : `up to ${to}`;
  const parts = [
    condition.anyOf === undefined || condition.anyOf.length === 0
      ? null
      : condition.anyOf.map((value) => enumValueNameOf(definition, value)).join(", "),
    textSummaryOf(condition),
    condition.numberRange === undefined
      ? null
      : `${range(condition.numberRange.from, condition.numberRange.to)}${
          definition.type.kind === "number" && definition.type.unit !== ""
            ? ` ${definition.type.unit}`
            : ""
        }`,
    condition.dayRange === undefined || "preset" in condition.dayRange
      ? null
      : range(condition.dayRange.from, condition.dayRange.to),
    condition.hasNoValue === true ? "no value" : null,
  ].filter((part) => part !== null);
  return `${propertyNameOf(definition)}: ${parts.join(" or ")}`;
}

interface ScopeConditionsFieldProps {
  id: string;
  value: readonly PropertyCondition[];
  onChange: (conditions: PropertyCondition[]) => void;
}

export function ScopeConditionsField({ id, value, onChange }: ScopeConditionsFieldProps) {
  const { data: index } = usePropertiesQuery();
  const definitions = index?.definitions ?? [];
  const unused = definitions.filter(
    (definition) => !value.some((condition) => condition.key === definition.key),
  );
  const replace = (at: number, condition: PropertyCondition) =>
    onChange(value.map((candidate, index) => (index === at ? condition : candidate)));

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">
        Properties <span className="font-normal text-muted-foreground">— optional</span>
      </legend>
      {value.map((condition, at) => {
        const definition = definitions.find((candidate) => candidate.key === condition.key);
        return (
          <div key={condition.key} className="grid gap-2 rounded-md border p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {definition === undefined ? condition.key : propertyNameOf(definition)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Remove the condition on ${definition === undefined ? condition.key : propertyNameOf(definition)}`}
                onClick={() => onChange(value.filter((_, index) => index !== at))}
              >
                <X />
              </Button>
            </div>
            {definition !== undefined && (
              <ConditionInput
                id={`${id}-${condition.key}`}
                definition={definition}
                condition={condition}
                onChange={(next) => replace(at, next)}
              />
            )}
          </div>
        );
      })}
      {unused.length > 0 && (
        <Select value="" onValueChange={(key) => onChange([...value, { key }])}>
          <SelectTrigger
            aria-label="Add a condition on a property"
            size="sm"
            className="w-fit gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            <SelectValue placeholder="Only items whose property…" />
          </SelectTrigger>
          <SelectContent>
            {unused.map((definition) => (
              <SelectItem key={definition.key} value={definition.key}>
                {propertyNameOf(definition)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          All of them hold for an item it counts. A digitized item is read as it was on its
          digitized date, so a later change does not move what was counted.
          {value.some((condition) => !isActiveCondition(condition)) &&
            " A condition with nothing chosen yet is not saved."}
        </p>
      )}
    </fieldset>
  );
}

function ConditionInput({
  id,
  definition,
  condition,
  onChange,
}: {
  id: string;
  definition: PropertyDefinition;
  condition: PropertyCondition;
  onChange: (condition: PropertyCondition) => void;
}) {
  const { type } = definition;
  const noValue = (
    <label htmlFor={`${id}-none`} className="flex items-center gap-2 text-xs">
      <Checkbox
        id={`${id}-none`}
        checked={condition.hasNoValue === true}
        onCheckedChange={(checked) =>
          onChange({ ...condition, hasNoValue: checked === true || undefined })
        }
      />
      Or no value
    </label>
  );

  if (type.kind === "enum" || type.kind === "yesNo") {
    const values = type.kind === "enum" ? type.values.map(({ value }) => value) : [...yesNoValues];
    const picked = condition.anyOf ?? [];
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {values.map((value) => (
          <label key={value} htmlFor={`${id}-${value}`} className="flex items-center gap-2 text-xs">
            <Checkbox
              id={`${id}-${value}`}
              checked={picked.includes(value)}
              onCheckedChange={(checked) =>
                onChange({
                  ...condition,
                  anyOf:
                    checked === true
                      ? [...picked, value]
                      : picked.filter((candidate) => candidate !== value),
                })
              }
            />
            {type.kind === "enum" ? enumValueNameOf(definition, value) : value}
          </label>
        ))}
        {noValue}
      </div>
    );
  }

  if (type.kind === "text") {
    return (
      <TextConditionInput definition={definition} condition={condition} onChange={onChange}>
        {noValue}
      </TextConditionInput>
    );
  }

  const isDate = type.kind === "date";
  const ends = isDate
    ? condition.dayRange !== undefined && !("preset" in condition.dayRange)
      ? condition.dayRange
      : {}
    : (condition.numberRange ?? {});
  const setEnd = (end: "from" | "to", raw: string) => {
    const next = { ...ends, [end]: raw === "" ? undefined : isDate ? raw : Number(raw) };
    const isEmpty = next.from === undefined && next.to === undefined;
    onChange(
      isDate
        ? { ...condition, dayRange: isEmpty ? undefined : (next as { from?: string; to?: string }) }
        : {
            ...condition,
            numberRange: isEmpty ? undefined : (next as { from?: number; to?: number }),
          },
    );
  };
  const unit = type.kind === "number" && type.unit !== "" ? type.unit : null;
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Input
          aria-label={`${propertyNameOf(definition)} from`}
          type={isDate ? "date" : "number"}
          className="h-8 w-36"
          value={ends.from ?? ""}
          onChange={(event) => setEnd("from", event.target.value)}
        />
        –
        <Input
          aria-label={`${propertyNameOf(definition)} to`}
          type={isDate ? "date" : "number"}
          className="h-8 w-36"
          value={ends.to ?? ""}
          onChange={(event) => setEnd("to", event.target.value)}
        />
        {unit}
      </div>
      {noValue}
    </div>
  );
}

// The way chosen is kept while the text is empty, so the first letter goes where it was meant.
function TextConditionInput({
  definition,
  condition,
  onChange,
  children,
}: {
  definition: PropertyDefinition;
  condition: PropertyCondition;
  onChange: (condition: PropertyCondition) => void;
  children: ReactNode;
}) {
  const written = textConditionOf(condition);
  const [chosen, setChosen] = useState<TextMatch>(written.match);
  const match = written.text === "" ? chosen : written.match;
  const name = propertyNameOf(definition);
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <Select
          value={match}
          onValueChange={(value) => {
            setChosen(value as TextMatch);
            onChange(withTextCondition(condition, value as TextMatch, written.text));
          }}
        >
          <SelectTrigger aria-label={`How ${name} matches`} size="sm" className="w-fit shrink-0">
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
          aria-label={`${name} ${textMatchLabels[match].toLocaleLowerCase()}`}
          className="h-8"
          value={written.text}
          onChange={(event) => onChange(withTextCondition(condition, match, event.target.value))}
        />
      </div>
      {children}
    </div>
  );
}

// Only the conditions that ask for something are saved.
export function savedConditionsOf(conditions: readonly PropertyCondition[]): PropertyCondition[] {
  return conditions.filter(isActiveCondition);
}
