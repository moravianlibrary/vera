// A property definition's editor (DOC-property): its key, set once and never changed, a name in
// each UI language, what it is about, its type and whether it is a list, its visibility, and
// whether it may be entered by hand with the tier a hand value gets. A fact the catalog holds is
// never entered by hand, the page count apart (DOC-property-hand). The server refuses a key that
// is or was in use, and a type change once records hold values.

import type { NewProperty } from "@vera/contract/properties";
import type {
  EnumValue,
  PropertyDefinition,
  PropertyDraft,
  PropertyTypeKind,
} from "@vera/domain/properties";
import {
  mayBeEnteredByHand,
  propertyDraftSchema,
  propertyKeySchema,
  propertySubjects,
  propertyTypeKinds,
  propertyVisibilities,
} from "@vera/domain/properties";
import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { propertyNameOf } from "@/features/properties/property-names";
import type { ActionResult, Refusal } from "@/hooks/use-action-mutation";

export const typeLabels = {
  text: "properties:type.text",
  number: "properties:type.number",
  yesNo: "properties:type.yesNo",
  date: "properties:type.date",
  enum: "properties:type.enum",
} as const satisfies Record<PropertyTypeKind, string>;

export const subjectLabels = {
  document: "properties:subject.document",
  attempt: "properties:subject.attempt",
} as const;

export const visibilityLabels = {
  public: "properties:visibility.public",
  staff: "properties:visibility.staff",
} as const;

const visibilityHints = {
  public: "properties:visibilityHint.public",
  staff: "properties:visibilityHint.staff",
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

export const propertyRefusalTextsOf = (t: (key: string) => string) => ({
  "property.key_taken": t("editor.refusal.keyTaken"),
  "property.in_use": t("editor.refusal.inUse"),
  "property.value_in_use": t("editor.refusal.valueInUse"),
  "property.catalog_fact": t("editor.refusal.catalogFact"),
});

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
  const { t } = useTranslation("properties");
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
      title={isNew ? t("editor.new") : t("editor.edit", { name: propertyNameOf(definition) })}
      description={t("editor.description")}
      width="wide"
      isDirty
      refusal={refusal}
      primary={{
        label: isNew ? t("editor.create") : t("editor.save"),
        isPending,
        isDisabled: !isValid,
        onSelect: () => void save(),
      }}
    >
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            id={`${id}-key`}
            label={t("editor.key")}
            hint={t(isNew ? "editor.keyNeverChanges" : "editor.keyFixed")}
          >
            <Input
              id={`${id}-key`}
              className="font-mono"
              placeholder={t("editor.keyPlaceholder")}
              value={state.key}
              disabled={!isNew}
              onChange={(event) => setState({ ...state, key: event.target.value })}
            />
          </Field>
          <Field id={`${id}-name-en`} label={t("editor.nameEnglish")}>
            <Input
              id={`${id}-name-en`}
              value={state.draft.names.en}
              onChange={(event) =>
                setDraft({ names: { ...state.draft.names, en: event.target.value } })
              }
            />
          </Field>
          <Field id={`${id}-name-cs`} label={t("editor.nameCzech")}>
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
          <p className="-mt-2 text-xs text-destructive">{t("editor.keyFormat")}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Field id={`${id}-about`} label={t("editor.about")}>
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
                    {t(subjectLabels[subject])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id={`${id}-type`} label={t("editor.type")}>
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
                    {t(typeLabels[kind])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id={`${id}-visibility`} label={t("editor.visibility")}>
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
                    {t(visibilityLabels[visibility])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          {t("editor.aboutHelp", {
            about: t(
              state.draft.about === "document" ? "editor.documentHelp" : "editor.attemptHelp",
            ),
            visibility: t(visibilityLabels[state.draft.visibility]),
            hint: t(visibilityHints[state.draft.visibility]),
            fixed: isTypeFixed ? t("editor.fixedSuffix") : "",
          })}
        </p>

        <label htmlFor={`${id}-list`} className="flex items-center gap-2 text-sm">
          <Checkbox
            id={`${id}-list`}
            checked={state.draft.isList}
            disabled={isTypeFixed}
            onCheckedChange={(checked) => setDraft({ isList: checked === true })}
          />
          {t("editor.list")}
        </label>

        {state.draft.type.kind === "number" && (
          <Field id={`${id}-unit`} label={t("editor.unit")} hint={t("editor.unitHint")}>
            <Input
              id={`${id}-unit`}
              className="max-w-48"
              placeholder={t("editor.unitPlaceholder")}
              value={state.unit}
              disabled={isTypeFixed}
              onChange={(event) => setState({ ...state, unit: event.target.value })}
            />
          </Field>
        )}

        {state.draft.type.kind === "enum" && (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t("editor.values")}</legend>
            <div className="hidden grid-cols-[1fr_1fr_1fr_2rem] gap-2 text-xs text-muted-foreground sm:grid">
              <span>{t("editor.value")}</span>
              <span>{t("editor.nameEnglish")}</span>
              <span>{t("editor.nameCzech")}</span>
            </div>
            {state.enumValues.map((value, index) => (
              <div
                // Values are edited in place; their position is their identity while editing.
                // biome-ignore lint/suspicious/noArrayIndexKey: rows have no other identity yet
                key={index}
                className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_2rem]"
              >
                <Input
                  aria-label={t("editor.valueNumber", { index: index + 1 })}
                  className="font-mono"
                  value={value.value}
                  onChange={(event) => setEnumValue(index, { ...value, value: event.target.value })}
                />
                <Input
                  aria-label={t("editor.valueNameEnglish", { index: index + 1 })}
                  value={value.names.en}
                  onChange={(event) =>
                    setEnumValue(index, {
                      ...value,
                      names: { ...value.names, en: event.target.value },
                    })
                  }
                />
                <Input
                  aria-label={t("editor.valueNameCzech", { index: index + 1 })}
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
                  aria-label={t("editor.removeValue", { index: index + 1 })}
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
              {t("editor.addValue")}
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
            {t("editor.mayEnterByHand")}
          </label>
          {!isHandAllowed && (
            <p className="text-xs text-muted-foreground">{t("editor.catalogFactHelp")}</p>
          )}
          {state.draft.handTier !== null && (
            <div className="grid gap-1.5 sm:grid-cols-[minmax(0,10rem)_1fr] sm:items-center sm:gap-3">
              <Input
                id={`${id}-tier`}
                aria-label={t("editor.handValueTier")}
                type="number"
                min={0}
                step={1}
                value={state.draft.handTier}
                onChange={(event) => setDraft({ handTier: Number(event.target.value) })}
              />
              <p className="text-xs text-muted-foreground">{t("editor.handValueHelp")}</p>
            </div>
          )}
        </div>
      </div>
    </DialogShell>
  );
}
