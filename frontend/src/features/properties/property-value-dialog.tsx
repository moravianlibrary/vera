// Entering a property's value by hand (DOC-property-hand), on one record's pane or on a selection
// in Documents. The input follows the type: a line of text, a number in its unit, yes or no, a
// day, one of the values, or for a list several of them. The hand value goes in at the
// definition's tier; taking it away leaves the other sources. The server checks
// `property.<key>.edit` again, refuses an attempt already scanned (409), and runs the checks
// again when a rule reads the property.
// TODO(rrandiak): labels move to i18n.

import type { BulkPropertyEntryResult, PropertyEntryResult } from "@vera/contract/properties";
import type { PropertyDefinition, PropertyValue, ScalarValue } from "@vera/domain/properties";
import { isValueOf, propertyNameOf } from "@vera/domain/properties";
import { useId, useState } from "react";
import { enterPropertyValue, enterPropertyValues } from "@/api/properties";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { documentsQueryKey } from "@/features/documents/use-documents-query";
import { propertiesQueryKey } from "@/features/properties/use-properties-query";
import { validationsQueryKey } from "@/features/validations/use-validations-query";
import type { Refusal } from "@/hooks/use-action-mutation";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { plural } from "@/lib/plural";

const invalidations = [documentsQueryKey, validationsQueryKey, propertiesQueryKey] as const;

const refusalTexts = {
  "iteration.scanned": "This attempt is scanned; what it was scanned with stays.",
  403: "You may no longer enter this property.",
};

// What is typed, before it is read as the type: the scalars as strings.
type Typed = readonly string[];

function typedOf(value: PropertyValue | null): Typed {
  if (value === null) {
    return [];
  }

  return (Array.isArray(value) ? value : [value]).map((scalar) =>
    typeof scalar === "boolean" ? (scalar ? "Yes" : "No") : String(scalar),
  );
}

function scalarOf(definition: PropertyDefinition, typed: string): ScalarValue {
  switch (definition.type.kind) {
    case "number":
      return Number(typed);
    case "yesNo":
      return typed === "Yes";
    default:
      return typed.trim();
  }
}

function enteredValueOf(definition: PropertyDefinition, typed: Typed): PropertyValue | null {
  const scalars = typed
    .filter((entry) => entry.trim() !== "")
    .map((entry) => scalarOf(definition, entry));
  if (scalars.length === 0) {
    return null;
  }

  return definition.isList ? scalars : (scalars[0] ?? null);
}

interface PropertyValueDialogProps {
  definition: PropertyDefinition;
  // One document's, or the selection's.
  documentIds: readonly string[];
  // Entered as a selection, one document included, so the result says which refused.
  isBulk?: boolean;
  // The hand value one record holds, which may be taken away.
  handValue: PropertyValue | null;
  onClose: () => void;
  onEntered: (result: PropertyEntryResult | BulkPropertyEntryResult) => void;
}

export function PropertyValueDialog({
  definition,
  documentIds,
  isBulk = documentIds.length > 1,
  handValue,
  onClose,
  onEntered,
}: PropertyValueDialogProps) {
  const id = useId();
  const [typed, setTyped] = useState<Typed>(() => typedOf(handValue));
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const one = useActionMutation({
    call: enterPropertyValue,
    invalidates: invalidations,
    refusalTexts,
  });
  const many = useActionMutation({
    call: enterPropertyValues,
    invalidates: invalidations,
    refusalTexts,
  });
  const value = enteredValueOf(definition, typed);
  const isValid = value !== null && isValueOf(definition, value);
  const name = propertyNameOf(definition);

  const enter = async (entered: PropertyValue | null) => {
    const [first] = documentIds;
    if (first === undefined) {
      return;
    }

    const result = isBulk
      ? await many.run({
          key: definition.key,
          entry: { value: entered, documentIds: [...documentIds] },
        })
      : await one.run({ documentId: first, key: definition.key, entry: { value: entered } });
    if (result.isDone) {
      onEntered(result.value);
    } else {
      setRefusal(result.refusal);
    }
  };

  return (
    <DialogShell
      isOpen
      onClose={onClose}
      title={
        isBulk ? `Enter ${name} for ${plural(documentIds.length, "document")}` : `Enter ${name}`
      }
      description={`Enter ${name} by hand`}
      isDirty={typed.join() !== typedOf(handValue).join()}
      refusal={refusal}
      secondary={
        handValue === null || isBulk
          ? undefined
          : {
              label: "Take the hand value away",
              isDestructive: true,
              onSelect: () => void enter(null),
            }
      }
      primary={{
        label: "Enter",
        isPending: one.isPending || many.isPending,
        isDisabled: !isValid,
        onSelect: () => void enter(value),
      }}
    >
      <div className="grid gap-3">
        <ValueInput id={id} definition={definition} typed={typed} onChange={setTyped} />
        <p className="text-xs text-muted-foreground">
          {definition.about === "attempt"
            ? "Set on the current attempt. Once it is scanned the value stays."
            : "Set on the document, whatever attempt is made."}{" "}
          A hand value has tier {definition.handTier}; the highest tier with a value is the one in
          use, and every source stays visible.
          {isBulk && " Documents that refuse it are listed afterwards."}
        </p>
      </div>
    </DialogShell>
  );
}

function ValueInput({
  id,
  definition,
  typed,
  onChange,
}: {
  id: string;
  definition: PropertyDefinition;
  typed: Typed;
  onChange: (typed: Typed) => void;
}) {
  const { type } = definition;
  const name = propertyNameOf(definition);
  const options =
    type.kind === "enum"
      ? type.values.map((value) => ({ value: value.value, label: value.names.en }))
      : type.kind === "yesNo"
        ? [
            { value: "Yes", label: "Yes" },
            { value: "No", label: "No" },
          ]
        : null;

  if (options !== null && definition.isList) {
    return (
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-sm font-medium">{name}</legend>
        {options.map((option) => (
          <label
            key={option.value}
            htmlFor={`${id}-${option.value}`}
            className="flex items-center gap-2 text-sm"
          >
            <Checkbox
              id={`${id}-${option.value}`}
              checked={typed.includes(option.value)}
              onCheckedChange={(checked) =>
                onChange(
                  checked === true
                    ? [...typed, option.value]
                    : typed.filter((value) => value !== option.value),
                )
              }
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    );
  }

  if (options !== null) {
    return (
      <Select value={typed[0] ?? ""} onValueChange={(value) => onChange([value])}>
        <SelectTrigger aria-label={name} className="w-full">
          <SelectValue placeholder={`Choose ${name.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const inputType = type.kind === "number" ? "number" : type.kind === "date" ? "date" : "text";
  const unit = type.kind === "number" && type.unit !== "" ? type.unit : null;
  if (definition.isList) {
    return (
      <div className="grid gap-1.5">
        <Textarea
          aria-label={name}
          rows={4}
          value={typed.join("\n")}
          onChange={(event) => onChange(event.target.value.split("\n"))}
        />
        <p className="text-xs text-muted-foreground">One value per line{unit && `, in ${unit}`}.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label={name}
        type={inputType}
        value={typed[0] ?? ""}
        onChange={(event) => onChange([event.target.value])}
      />
      {unit !== null && <span className="text-sm text-muted-foreground">{unit}</span>}
    </div>
  );
}
