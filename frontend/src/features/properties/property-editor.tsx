// A property definition's editor (DOC-property): its key, set once and never changed, a name in
// each UI language, what it is about, its type and whether it is a list, its visibility, and
// whether it may be entered by hand with the tier a hand value gets. A fact the catalog holds is
// never entered by hand, the page count apart (DOC-property-hand). The server refuses a key that
// is or was in use, and a type change once records hold values.
// TODO(rrandiak): labels move to i18n.

import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import type { NewProperty } from "@/api/properties";
import { Field } from "@/components/classification-fields";
import { DialogShell } from "@/components/dialogs/dialog-shell";
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
import type {
  EnumValue,
  PropertyDefinition,
  PropertyDraft,
  PropertyTypeKind,
} from "@/domain/properties";
import {
  mayBeEnteredByHand,
  propertyDraftSchema,
  propertyKeySchema,
  propertySubjects,
  propertyTypeKinds,
  propertyVisibilities,
} from "@/domain/properties";
import type { ActionResult, Refusal } from "@/hooks/use-action-mutation";

export const typeLabels = {
  text: "Text",
  number: "Number",
  yesNo: "Yes / no",
  date: "Date",
  enum: "One of a set of values",
} as const satisfies Record<PropertyTypeKind, string>;

export const subjectLabels = {
  document: "The document",
  attempt: "One attempt",
} as const;

export const visibilityLabels = {
  public: "Public",
  staff: "Staff",
} as const;

const visibilityHints = {
  public: "read wherever its record is, My Documents included",
  staff: "read in staff detail only",
} as const;

// The tier a hand value gets unless the admin says otherwise: the page count's manual tier, above
// every plugin's (DOC-page-count).
const defaultHandTier = 100;

const emptyValue: EnumValue = { value: "", names: { en: "", cs: "" } };

interface EditorState {
  key: string;
  draft: PropertyDraft;
  // Kept while the type is switched away from enum and back.
  enumValues: EnumValue[];
  unit: string;
}

function initialState(definition: PropertyDefinition | null): EditorState {
  if (definition === null) {
    return {
      key: "",
      draft: {
        names: { en: "", cs: "" },
        visibility: "staff",
        type: { kind: "text" },
        isList: false,
        about: "document",
        handTier: defaultHandTier,
      },
      enumValues: [{ ...emptyValue }],
      unit: "",
    };
  }

  const { key, isPredefined: _, isCatalogFact: __, ...draft } = definition;
  return {
    key,
    draft,
    enumValues:
      definition.type.kind === "enum" ? definition.type.values.map((value) => ({ ...value })) : [],
    unit: definition.type.kind === "number" ? definition.type.unit : "",
  };
}

function draftOf(state: EditorState): PropertyDraft {
  const kind = state.draft.type.kind;
  const type =
    kind === "enum"
      ? { kind, values: state.enumValues }
      : kind === "number"
        ? { kind, unit: state.unit.trim() }
        : { kind };
  return { ...state.draft, type };
}

export const propertyRefusalTexts = {
  "property.key_taken": "That key is or was in use. A key is never used twice.",
  "property.in_use": "Records hold values of it, so its type and what it is about stay.",
  "property.value_in_use": "A value records hold cannot be taken out.",
  "property.catalog_fact": "The catalog holds it: it is repaired there, never entered by hand.",
};

interface PropertyEditorProps {
  // Null for a new property.
  definition: PropertyDefinition | null;
  // Values held, for saying what may still change.
  valueCount: number;
  onClose: () => void;
  onSave: (property: NewProperty) => Promise<ActionResult<PropertyDefinition>>;
  onSaved: (definition: PropertyDefinition) => void;
}

export function PropertyEditor({
  definition,
  valueCount,
  onClose,
  onSave,
  onSaved,
}: PropertyEditorProps) {
  const id = useId();
  const [state, setState] = useState(() => initialState(definition));
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [isPending, setIsPending] = useState(false);
  const isNew = definition === null;
  // DOC-property-hand: never by hand, the page count apart.
  const isHandAllowed = definition === null || mayBeEnteredByHand(definition);
  // The server keeps the type once records hold values; the editor says so up front.
  const isTypeFixed = definition !== null && (definition.isPredefined || valueCount > 0);
  const draft = draftOf(state);
  const isKeyValid = !isNew || propertyKeySchema.safeParse(state.key).success;
  const isValid = isKeyValid && propertyDraftSchema.safeParse(draft).success;
  const setDraft = (change: Partial<PropertyDraft>) =>
    setState((current) => ({ ...current, draft: { ...current.draft, ...change } }));
  const setEnumValue = (index: number, value: EnumValue) =>
    setState((current) => ({
      ...current,
      enumValues: current.enumValues.map((candidate, at) => (at === index ? value : candidate)),
    }));

  const save = async () => {
    setIsPending(true);
    const result = await onSave({ key: state.key.trim(), draft });
    setIsPending(false);
    if (result.isDone) {
      onSaved(result.value);
    } else {
      setRefusal(result.refusal);
    }
  };

  return (
    <DialogShell
      isOpen
      onClose={onClose}
      title={isNew ? "New property" : `Edit ${definition.names.en}`}
      description="A property's definition"
      width="wide"
      isDirty
      refusal={refusal}
      primary={{
        label: isNew ? "Create property" : "Save",
        isPending,
        isDisabled: !isValid,
        onSelect: () => void save(),
      }}
    >
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id={`${id}-key`} label="Key" hint={isNew ? "never changes" : "fixed"}>
            <Input
              id={`${id}-key`}
              className="font-mono"
              placeholder="e.g. size"
              value={state.key}
              disabled={!isNew}
              onChange={(event) => setState({ ...state, key: event.target.value })}
            />
          </Field>
          <Field id={`${id}-name-en`} label="Name in English">
            <Input
              id={`${id}-name-en`}
              value={state.draft.names.en}
              onChange={(event) =>
                setDraft({ names: { ...state.draft.names, en: event.target.value } })
              }
            />
          </Field>
          <Field id={`${id}-name-cs`} label="Name in Czech">
            <Input
              id={`${id}-name-cs`}
              value={state.draft.names.cs}
              onChange={(event) =>
                setDraft({ names: { ...state.draft.names, cs: event.target.value } })
              }
            />
          </Field>
        </div>
        {isNew && !isKeyValid && state.key !== "" && (
          <p className="-mt-2 text-xs text-destructive">
            Lower-case letters, digits and _, starting with a letter.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Field id={`${id}-about`} label="About">
            <Select
              value={state.draft.about}
              disabled={isTypeFixed}
              onValueChange={(about) => setDraft({ about: about as PropertyDraft["about"] })}
            >
              <SelectTrigger id={`${id}-about`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {propertySubjects.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subjectLabels[subject]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id={`${id}-type`} label="Type">
            <Select
              value={state.draft.type.kind}
              disabled={isTypeFixed}
              onValueChange={(kind) => {
                const typeKind = kind as PropertyTypeKind;
                setState((current) => ({
                  ...current,
                  draft: {
                    ...current.draft,
                    type:
                      typeKind === "enum"
                        ? { kind: typeKind, values: current.enumValues }
                        : typeKind === "number"
                          ? { kind: typeKind, unit: current.unit }
                          : { kind: typeKind },
                  },
                  enumValues:
                    current.enumValues.length === 0 ? [{ ...emptyValue }] : current.enumValues,
                }));
              }}
            >
              <SelectTrigger id={`${id}-type`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {propertyTypeKinds.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {typeLabels[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id={`${id}-visibility`} label="Visibility">
            <Select
              value={state.draft.visibility}
              onValueChange={(visibility) =>
                setDraft({ visibility: visibility as PropertyDraft["visibility"] })
              }
            >
              <SelectTrigger id={`${id}-visibility`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {propertyVisibilities.map((visibility) => (
                  <SelectItem key={visibility} value={visibility}>
                    {visibilityLabels[visibility]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          {state.draft.about === "document"
            ? "True of the document whatever attempt is made, such as its size."
            : "Chosen for one attempt, such as the machine it is scanned on."}{" "}
          {visibilityLabels[state.draft.visibility]}: {visibilityHints[state.draft.visibility]}.
          {isTypeFixed && " Records hold values of it, so what it is about and its type stay."}
        </p>

        <label htmlFor={`${id}-list`} className="flex items-center gap-2 text-sm">
          <Checkbox
            id={`${id}-list`}
            checked={state.draft.isList}
            disabled={isTypeFixed}
            onCheckedChange={(checked) => setDraft({ isList: checked === true })}
          />
          A list: a record may hold several values
        </label>

        {state.draft.type.kind === "number" && (
          <Field id={`${id}-unit`} label="Unit" hint="shown after the number">
            <Input
              id={`${id}-unit`}
              className="max-w-48"
              placeholder="e.g. cm"
              value={state.unit}
              disabled={isTypeFixed}
              onChange={(event) => setState({ ...state, unit: event.target.value })}
            />
          </Field>
        )}

        {state.draft.type.kind === "enum" && (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Values</legend>
            <div className="hidden grid-cols-[1fr_1fr_1fr_2rem] gap-2 text-xs text-muted-foreground sm:grid">
              <span>Value</span>
              <span>Name in English</span>
              <span>Name in Czech</span>
            </div>
            {state.enumValues.map((value, index) => (
              <div
                // Values are edited in place; their position is their identity while editing.
                // biome-ignore lint/suspicious/noArrayIndexKey: rows have no other identity yet
                key={index}
                className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_2rem]"
              >
                <Input
                  aria-label={`Value ${index + 1}`}
                  className="font-mono"
                  value={value.value}
                  onChange={(event) => setEnumValue(index, { ...value, value: event.target.value })}
                />
                <Input
                  aria-label={`Value ${index + 1} in English`}
                  value={value.names.en}
                  onChange={(event) =>
                    setEnumValue(index, {
                      ...value,
                      names: { ...value.names, en: event.target.value },
                    })
                  }
                />
                <Input
                  aria-label={`Value ${index + 1} in Czech`}
                  value={value.names.cs}
                  onChange={(event) =>
                    setEnumValue(index, {
                      ...value,
                      names: { ...value.names, cs: event.target.value },
                    })
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove value ${index + 1}`}
                  disabled={state.enumValues.length === 1}
                  onClick={() =>
                    setState({
                      ...state,
                      enumValues: state.enumValues.filter((_, at) => at !== index),
                    })
                  }
                >
                  <X />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() =>
                setState({ ...state, enumValues: [...state.enumValues, { ...emptyValue }] })
              }
            >
              <Plus />
              Add a value
            </Button>
          </fieldset>
        )}

        <div className="grid gap-2 border-t pt-4">
          <label htmlFor={`${id}-hand`} className="flex items-center gap-2 text-sm">
            <Checkbox
              id={`${id}-hand`}
              checked={state.draft.handTier !== null}
              disabled={!isHandAllowed}
              onCheckedChange={(checked) =>
                setDraft({ handTier: checked === true ? defaultHandTier : null })
              }
            />
            May be entered by hand
          </label>
          {!isHandAllowed && (
            <p className="text-xs text-muted-foreground">
              The catalog holds it. A mistake is repaired in the catalog and read again with
              Recheck.
            </p>
          )}
          {state.draft.handTier !== null && (
            <div className="grid gap-1.5 sm:grid-cols-[minmax(0,10rem)_1fr] sm:items-center sm:gap-3">
              <Input
                id={`${id}-tier`}
                aria-label="Tier of a hand value"
                type="number"
                min={0}
                step={1}
                value={state.draft.handTier}
                onChange={(event) => setDraft({ handTier: Number(event.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                The tier a hand value gets. The highest tier with a value is the one in use, so
                above a plugin's tier a hand value wins over it. Each property has its own
                permission to enter it, given on Users management.
              </p>
            </div>
          )}
        </div>
      </div>
    </DialogShell>
  );
}
