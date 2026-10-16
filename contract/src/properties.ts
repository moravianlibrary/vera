// The Properties resource (DOC-property): the definitions the caller may read, defining them with
// `property.define`, what deleting one would remove, and entering a value by hand with
// `property.<key>.edit`, on one record or on a selection (DOC-property-hand). A property filter is
// written in a page's URL as `p.<key>`, with `.starts`, `.ends` or `.none` after it for some
// (DOC-property-filter).

import { apiRoutes, documentRoute } from "@vera/contract/routes";
import type { PropertyCondition, PropertyDefinition } from "@vera/domain/properties";
import {
  propertyDefinitionSchema,
  propertyDraftSchema,
  propertyKeySchema,
  propertyValueSchema,
} from "@vera/domain/properties";
import type { DayRange } from "@vera/domain/value-range";
import { formatDayRange, formatRange, parseDayRange, parseRange } from "@vera/domain/value-range";
import { z } from "zod";
import { facetCountsOf } from "./facets";

const id = z.string().min(1);

// ---------------------------------------------------------------- the page

export const propertyIndexSchema = z.object({
  definitions: z.array(propertyDefinitionSchema),
  // Never defined again (DOC-property-delete); sent to those who define properties.
  deletedKeys: z.array(z.string()),
  // How many records hold a value of each, by key.
  valueCounts: z.record(z.string(), z.number().int().nonnegative()),
});

export type PropertyIndex = z.infer<typeof propertyIndexSchema>;

export const newPropertySchema = z.object({ key: propertyKeySchema, draft: propertyDraftSchema });

export type NewProperty = z.infer<typeof newPropertySchema>;

// What deleting a definition removes, counted by the server.
export const propertyImpactSchema = z.object({
  valueCount: z.number().int().nonnegative(),
  roleNames: z.array(z.string()),
  watchlists: z.array(z.object({ name: z.string(), isShared: z.boolean() })),
  // Intentions and repeats whose scope names it; they count more without the condition.
  intentionNames: z.array(z.string()),
});

export type PropertyImpact = z.infer<typeof propertyImpactSchema>;

// ---------------------------------------------------------------- hand entry

// A value, or null to take one's hand value away and leave the other sources.
export const propertyEntrySchema = z.object({ value: propertyValueSchema.nullable() });

export type PropertyEntry = z.infer<typeof propertyEntrySchema>;

export const propertyEntryResultSchema = z.object({
  // The checks ran again, since a rule reads the property.
  isRechecked: z.boolean(),
});

export type PropertyEntryResult = z.infer<typeof propertyEntryResultSchema>;

export const bulkPropertyEntrySchema = propertyEntrySchema.extend({
  documentIds: z.array(id).min(1),
});

export type BulkPropertyEntry = z.infer<typeof bulkPropertyEntrySchema>;

export const bulkPropertyEntryResultSchema = z.object({
  enteredCount: z.number().int().nonnegative(),
  // Each document refused, as an attempt already scanned is.
  refusals: z.array(z.object({ documentId: id, message: z.string() })),
});

export type BulkPropertyEntryResult = z.infer<typeof bulkPropertyEntryResultSchema>;

// ---------------------------------------------------------------- routes

export function propertyRoute(key: string): string {
  return `${apiRoutes.properties}/${encodeURIComponent(key)}`;
}

export function propertyImpactRoute(key: string): string {
  return `${propertyRoute(key)}/impact`;
}

export function documentPropertyRoute(documentId: string, key: string): string {
  return `${documentRoute(documentId)}/properties/${encodeURIComponent(key)}`;
}

export function bulkPropertyRoute(key: string): string {
  return `${apiRoutes.documents}/properties/${encodeURIComponent(key)}`;
}

// ---------------------------------------------------------------- facets

// An enum or yes/no property's values with how many records each finds, and how many hold no
// value, counted over every other active filter (UI-facets).
export const propertyFacetSchema = z.object({
  values: facetCountsOf(z.string()),
  noValue: z.number().int().nonnegative(),
});

export type PropertyFacet = z.infer<typeof propertyFacetSchema>;

// By property key.
export const propertyFacetsSchema = z.record(z.string(), propertyFacetSchema);

export type PropertyFacets = z.infer<typeof propertyFacetsSchema>;

// ---------------------------------------------------------------- conditions in a URL

// `p.size=A4,A5`, `p.title=noviny`, `p.pages=100..499`, `p.scanned=last-30-days`,
// `p.title.starts=Lidové` and `p.title.ends=noviny` for text, and `p.size.none=1` for *no value*. The key says which property; its definition says how the value
// reads, so a condition is parsed once the definitions are known.
const conditionPrefix = "p.";

const noValueSuffix = ".none";

const startsSuffix = ".starts";

const endsSuffix = ".ends";

const suffixes = [noValueSuffix, startsSuffix, endsSuffix];

const noValue = "1";

const listSeparator = ",";

export function propertyParamKeyOf(param: string): string | null {
  if (!param.startsWith(conditionPrefix)) {
    return null;
  }

  const rest = param.slice(conditionPrefix.length);
  const suffix = suffixes.find((candidate) => rest.endsWith(candidate));
  const key = suffix === undefined ? rest : rest.slice(0, -suffix.length);
  return propertyKeySchema.safeParse(key).success ? key : null;
}

// The raw parameters of every property condition, as the URL holds them: kept as written until
// the definitions read them.
export type PropertyParams = Readonly<Record<string, string>>;

export function propertyParamsOf(params: URLSearchParams): PropertyParams | undefined {
  const entries = [...params].filter(([param]) => propertyParamKeyOf(param) !== null);
  return entries.length === 0 ? undefined : Object.fromEntries(entries);
}

export function writePropertyParams(
  params: URLSearchParams,
  propertyParams: PropertyParams | undefined,
): void {
  for (const [param, value] of Object.entries(propertyParams ?? {})) {
    if (value !== "") {
      params.set(param, value);
    }
  }
}

export function conditionParamsOf(condition: PropertyCondition): Record<string, string> {
  const params: Record<string, string> = {};
  const param = `${conditionPrefix}${condition.key}`;
  if (condition.hasNoValue === true) {
    params[`${param}${noValueSuffix}`] = noValue;
  }

  if (condition.startsWith?.trim()) {
    params[`${param}${startsSuffix}`] = condition.startsWith.trim();
  }

  if (condition.endsWith?.trim()) {
    params[`${param}${endsSuffix}`] = condition.endsWith.trim();
  }

  const value =
    condition.contains?.trim() ||
    formatRange(condition.numberRange) ||
    formatDayRange(condition.dayRange) ||
    (condition.anyOf !== undefined && condition.anyOf.length > 0
      ? condition.anyOf.join(listSeparator)
      : null);
  if (value) {
    params[param] = value;
  }

  return params;
}

const parseNumber = (raw: string) => (/^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : null);

// Each condition the parameters hold for a property the caller may read; the others are dropped,
// so a stale link still opens the view.
export function conditionsOf(
  propertyParams: PropertyParams | undefined,
  definitions: readonly PropertyDefinition[],
): PropertyCondition[] {
  return definitions.flatMap((definition) => {
    const param = `${conditionPrefix}${definition.key}`;
    const raw = propertyParams?.[param];
    const hasNoValue = propertyParams?.[`${param}${noValueSuffix}`] === noValue;
    const startsWith = propertyParams?.[`${param}${startsSuffix}`]?.trim();
    const endsWith = propertyParams?.[`${param}${endsSuffix}`]?.trim();
    const isText = definition.type.kind === "text";
    const condition: PropertyCondition = {
      key: definition.key,
      ...(hasNoValue ? { hasNoValue } : {}),
      ...(raw === undefined ? {} : conditionValueOf(definition, raw)),
      ...(isText && startsWith ? { startsWith } : {}),
      ...(isText && endsWith ? { endsWith } : {}),
    };
    return hasNoValue || Object.keys(condition).length > 1 ? [condition] : [];
  });
}

function conditionValueOf(
  definition: PropertyDefinition,
  raw: string,
): Omit<PropertyCondition, "key"> {
  switch (definition.type.kind) {
    case "text":
      return raw.trim() === "" ? {} : { contains: raw.trim() };
    case "number": {
      const numberRange = parseRange(raw, parseNumber);
      return numberRange === undefined ? {} : { numberRange };
    }
    case "date": {
      const dayRange: DayRange | undefined = parseDayRange(raw);
      return dayRange === undefined ? {} : { dayRange };
    }
    case "yesNo":
    case "enum": {
      const known =
        definition.type.kind === "enum"
          ? definition.type.values.map(({ value }) => value)
          : ["Yes", "No"];
      const anyOf = [...new Set(raw.split(listSeparator).map((value) => value.trim()))].filter(
        (value) => known.includes(value),
      );
      return anyOf.length === 0 ? {} : { anyOf };
    }
  }
}

// The same conditions however their values are ordered, for the watchlist comparer.
export function canonicalPropertyParams(propertyParams: PropertyParams | undefined): string {
  return Object.entries(propertyParams ?? {})
    .filter(([, value]) => value !== "")
    .map(
      ([param, value]) => `${param}=${value.split(listSeparator).toSorted().join(listSeparator)}`,
    )
    .toSorted()
    .join("&");
}

export function withCondition(
  propertyParams: PropertyParams | undefined,
  condition: PropertyCondition,
): PropertyParams | undefined {
  const rest = Object.entries(propertyParams ?? {}).filter(
    ([param]) => propertyParamKeyOf(param) !== condition.key,
  );
  const next = { ...Object.fromEntries(rest), ...conditionParamsOf(condition) };
  return Object.keys(next).length === 0 ? undefined : next;
}

export function withoutCondition(
  propertyParams: PropertyParams | undefined,
  key: string,
): PropertyParams | undefined {
  return withCondition(propertyParams, { key });
}
