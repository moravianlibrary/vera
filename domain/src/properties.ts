// Properties: the facts VERA keeps about a document or one attempt beyond what identifies it
// (DOC-property). An admin defines each one; every value has a source with a tier, and the
// highest tier with a value is the one in use (DOC-property-values). A filter on a property and an
// intention's scope condition take the same condition (DOC-property-filter, PLAN-scope).

import { z } from "zod";
import type { DayRange, ValueRange } from "./value-range";
import { dayPresets, isWithinRange, resolveDayRange } from "./value-range";

const id = z.string().min(1);
const timestamp = z.iso.datetime();

// ---------------------------------------------------------------- definitions

// A name in each UI language.
export const localizedNameSchema = z.object({
  en: z.string().trim().min(1),
  cs: z.string().trim().min(1),
});
export type LocalizedName = z.infer<typeof localizedNameSchema>;

// A key never changes, and a deleted one is never defined again (DOC-property-delete).
export const propertyKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/, "Lower-case letters, digits and _, starting with a letter");
export type PropertyKey = z.infer<typeof propertyKeySchema>;

export const enumValueSchema = z.object({
  value: z.string().trim().min(1),
  names: localizedNameSchema,
});
export type EnumValue = z.infer<typeof enumValueSchema>;

// DOC-property-types; a list is any of these, with `isList`.
export const propertyTypeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text") }),
  z.object({ kind: z.literal("number"), unit: z.string().trim() }),
  z.object({ kind: z.literal("yesNo") }),
  z.object({ kind: z.literal("date") }),
  z.object({ kind: z.literal("enum"), values: z.array(enumValueSchema).min(1) }),
]);
export type PropertyType = z.infer<typeof propertyTypeSchema>;
export type PropertyTypeKind = PropertyType["kind"];
export const propertyTypeKinds = [
  "text",
  "number",
  "yesNo",
  "date",
  "enum",
] as const satisfies readonly PropertyTypeKind[];

export const propertyVisibilities = ["public", "staff"] as const;
export const propertyVisibilitySchema = z.enum(propertyVisibilities);
export type PropertyVisibility = z.infer<typeof propertyVisibilitySchema>;

// A document's size is true whatever attempt is made; an attempt's machine is chosen each time.
export const propertySubjects = ["document", "attempt"] as const;
export const propertySubjectSchema = z.enum(propertySubjects);
export type PropertySubject = z.infer<typeof propertySubjectSchema>;

// What an admin writes. The key is set once, on creation.
export const propertyDraftSchema = z.object({
  names: localizedNameSchema,
  visibility: propertyVisibilitySchema,
  type: propertyTypeSchema,
  isList: z.boolean(),
  about: propertySubjectSchema,
  // The tier a hand value gets, or null when it may not be entered by hand (DOC-property-hand).
  handTier: z.number().int().nonnegative().nullable(),
});
export type PropertyDraft = z.infer<typeof propertyDraftSchema>;

export const propertyDefinitionSchema = propertyDraftSchema.extend({
  key: propertyKeySchema,
  // DOC-property-predefined: edited, never deleted.
  isPredefined: z.boolean(),
  // A fact the catalog holds, which is never entered by hand, the page count apart
  // (DOC-property-hand). The server says so from what the catalog adapters declare.
  isCatalogFact: z.boolean(),
});
export type PropertyDefinition = z.infer<typeof propertyDefinitionSchema>;
export type StoredPropertyDefinition = Omit<PropertyDefinition, "isCatalogFact">;

// DOC-page-count: the one catalog fact entered by hand.
export const pageCountKey = "page_count";

export function mayBeEnteredByHand(definition: Pick<PropertyDefinition, "key" | "isCatalogFact">) {
  return !definition.isCatalogFact || definition.key === pageCountKey;
}

// TODO(rrandiak): the UI language comes with i18n; English until then.
export function propertyNameOf(definition: Pick<PropertyDefinition, "names">): string {
  return definition.names.en;
}

export function enumValueNameOf(definition: PropertyDefinition, value: string): string {
  if (definition.type.kind !== "enum") {
    return value;
  }

  return definition.type.values.find((candidate) => candidate.value === value)?.names.en ?? value;
}

// ---------------------------------------------------------------- values

export const scalarValueSchema = z.union([z.string(), z.number(), z.boolean()]);
export type ScalarValue = z.infer<typeof scalarValueSchema>;

// A date is a calendar day, `2026-06-01`; an enum value its `value`.
export const propertyValueSchema = z.union([scalarValueSchema, z.array(scalarValueSchema)]);
export type PropertyValue = z.infer<typeof propertyValueSchema>;

// A person entering it by hand, or a plugin instance, the catalog adapter included.
export const propertySourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("hand") }),
  z.object({ kind: z.literal("plugin"), instanceId: id, instanceName: z.string() }),
]);
export type PropertySource = z.infer<typeof propertySourceSchema>;

export const sourcedValueSchema = z.object({
  source: propertySourceSchema,
  tier: z.number().int(),
  value: propertyValueSchema,
  observedAt: timestamp,
  // Who entered it; null for a plugin's.
  setBy: id.nullable(),
});
export type SourcedValue = z.infer<typeof sourcedValueSchema>;

// Every source of one property on one record, as the server keeps them.
export const propertyValuesSchema = z.object({
  key: propertyKeySchema,
  sources: z.array(sourcedValueSchema),
});
export type PropertyValues = z.infer<typeof propertyValuesSchema>;

// DOC-property-values: the highest tier that has a value wins.
export function valueInUseOf(values: PropertyValues | undefined): SourcedValue | null {
  return values?.sources.toSorted((first, second) => second.tier - first.tier)[0] ?? null;
}

// PLAN-scope: what was in use on a day, from the sources observed by then.
export function valueInUseAt(values: PropertyValues | undefined, at: string): SourcedValue | null {
  return valueInUseOf(
    values === undefined
      ? undefined
      : { ...values, sources: values.sources.filter((source) => source.observedAt <= at) },
  );
}

export function sourcesByTierOf(values: PropertyValues | undefined): SourcedValue[] {
  return values?.sources.toSorted((first, second) => second.tier - first.tier) ?? [];
}

export function valuesOf(
  properties: readonly PropertyValues[],
  key: string,
): PropertyValues | undefined {
  return properties.find((values) => values.key === key);
}

const scalarsOf = (value: PropertyValue): ScalarValue[] => (Array.isArray(value) ? value : [value]);

// "A4", "Zeutschel, Bookeye", "42 cm", "Yes", "1 Jun 2026".
export function formatPropertyValue(definition: PropertyDefinition, value: PropertyValue): string {
  const format = (scalar: ScalarValue): string => {
    switch (definition.type.kind) {
      case "yesNo":
        return scalar === true ? "Yes" : "No";
      case "enum":
        return enumValueNameOf(definition, String(scalar));
      case "number": {
        const number = Number(scalar).toLocaleString("en-GB");
        return definition.type.unit === "" ? number : `${number} ${definition.type.unit}`;
      }
      case "date":
      case "text":
        return String(scalar);
    }
  };

  return scalarsOf(value).map(format).join(", ");
}

// Whether a value is one the definition takes: its type, one or a list as it says.
export function isValueOf(definition: PropertyDefinition, value: PropertyValue): boolean {
  const scalars = scalarsOf(value);
  if (Array.isArray(value) !== definition.isList || scalars.length === 0) {
    return false;
  }

  return scalars.every((scalar) => isScalarOf(definition.type, scalar));
}

function isScalarOf(type: PropertyType, scalar: ScalarValue): boolean {
  switch (type.kind) {
    case "text":
      return typeof scalar === "string" && scalar.trim() !== "";
    case "number":
      return typeof scalar === "number" && Number.isFinite(scalar);
    case "yesNo":
      return typeof scalar === "boolean";
    case "date":
      return typeof scalar === "string" && /^\d{4}-\d{2}-\d{2}$/.test(scalar);
    case "enum":
      return type.values.some((candidate) => candidate.value === scalar);
  }
}

// ---------------------------------------------------------------- conditions

// DOC-property-filter, by type: text, what it contains, starts with or ends with; a number or a
// date, a range; an enum or yes/no, its values; a list, any of its values. Every one can also ask
// for *no value*; with both, either matches.
export interface PropertyCondition {
  readonly key: string;
  readonly hasNoValue?: boolean;
  readonly contains?: string;
  readonly startsWith?: string;
  readonly endsWith?: string;
  readonly numberRange?: ValueRange<number>;
  readonly dayRange?: DayRange;
  // Enum values, or `Yes` and `No`.
  readonly anyOf?: readonly string[];
}

export const propertyConditionSchema: z.ZodType<PropertyCondition, PropertyCondition> = z.object({
  key: propertyKeySchema,
  hasNoValue: z.boolean().optional(),
  contains: z.string().optional(),
  startsWith: z.string().optional(),
  endsWith: z.string().optional(),
  numberRange: z.object({ from: z.number().optional(), to: z.number().optional() }).optional(),
  dayRange: z
    .union([
      z.object({ from: z.string().optional(), to: z.string().optional() }),
      z.object({ preset: z.enum(dayPresets) }),
    ])
    .optional(),
  anyOf: z.array(z.string()).optional(),
});

export const yesNoValues = ["Yes", "No"] as const;

// How a text condition matches, and the field each way is kept in.
export const textMatches = ["contains", "startsWith", "endsWith"] as const;
export type TextMatch = (typeof textMatches)[number];

export const textMatchLabels = {
  contains: "Contains",
  startsWith: "Starts with",
  endsWith: "Ends with",
} as const satisfies Record<TextMatch, string>;

const hasText = (text: string | undefined) => text !== undefined && text.trim() !== "";

// The way a text condition matches and what it matches; *contains* when it asks for no text.
export function textConditionOf(condition: PropertyCondition | undefined): {
  match: TextMatch;
  text: string;
} {
  const match = textMatches.find((candidate) => hasText(condition?.[candidate])) ?? "contains";
  return { match, text: condition?.[match] ?? "" };
}

// The condition asking for the text one way, and no other; as written, so typing keeps its spaces.
export function withTextCondition(
  condition: PropertyCondition,
  match: TextMatch,
  text: string,
): PropertyCondition {
  const { contains: _contains, startsWith: _startsWith, endsWith: _endsWith, ...rest } = condition;
  return text.trim() === "" ? rest : { ...rest, [match]: text };
}

// "contains “noviny”", "starts with “Lidové”".
export function textSummaryOf(condition: PropertyCondition): string | null {
  const { match, text } = textConditionOf(condition);
  return hasText(text) ? `${textMatchLabels[match].toLocaleLowerCase()} “${text.trim()}”` : null;
}

// The facet value of a scalar: an enum's value, or `Yes` and `No`.
export function facetValueOf(scalar: ScalarValue): string {
  return typeof scalar === "boolean" ? (scalar ? "Yes" : "No") : String(scalar);
}

// Whether the condition asks for anything; an empty one filters nothing.
export function isActiveCondition(condition: PropertyCondition): boolean {
  return (
    condition.hasNoValue === true ||
    textMatches.some((match) => hasText(condition[match])) ||
    condition.numberRange !== undefined ||
    condition.dayRange !== undefined ||
    (condition.anyOf !== undefined && condition.anyOf.length > 0)
  );
}

// Whether a value in use meets the condition; a list meets it when any of its values does.
export function meetsCondition(
  condition: PropertyCondition,
  value: PropertyValue | null,
  today: Date,
): boolean {
  if (value === null) {
    return condition.hasNoValue === true;
  }

  const scalars = scalarsOf(value);
  const textAsk = (match: TextMatch) => {
    const text = condition[match];
    if (text === undefined || !hasText(text)) {
      return null;
    }

    const wanted = text.trim().toLocaleLowerCase();
    return (scalar: ScalarValue) => {
      const written = String(scalar).toLocaleLowerCase();
      return match === "contains"
        ? written.includes(wanted)
        : match === "startsWith"
          ? written.startsWith(wanted)
          : written.endsWith(wanted);
    };
  };
  const asks = [
    ...textMatches.map(textAsk),
    condition.numberRange === undefined
      ? null
      : (scalar: ScalarValue) =>
          typeof scalar === "number" && isWithinRange(scalar, condition.numberRange ?? {}),
    condition.dayRange === undefined
      ? null
      : (scalar: ScalarValue) =>
          typeof scalar === "string" &&
          isWithinRange(scalar, resolveDayRange(condition.dayRange as DayRange, today)),
    condition.anyOf === undefined || condition.anyOf.length === 0
      ? null
      : (scalar: ScalarValue) => (condition.anyOf ?? []).includes(facetValueOf(scalar)),
  ].filter((ask) => ask !== null);

  return asks.length > 0 && asks.every((ask) => scalars.some(ask));
}

// ---------------------------------------------------------------- permissions

// PERM-property-edit: each property's own permission.
export type PropertyEditPermission = `property.${string}.edit`;

export function editPermissionOf(key: string): PropertyEditPermission {
  return `property.${key}.edit`;
}

export function propertyKeyOfPermission(permission: string): string | null {
  return /^property\.([a-z][a-z0-9_]*)\.edit$/.exec(permission)?.[1] ?? null;
}
