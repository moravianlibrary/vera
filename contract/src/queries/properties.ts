// Property readers of the mock.

import { countValues } from "@vera/domain/arrangement";
import type { Document, Iteration, Session } from "@vera/domain/entities";
import { hasPermission } from "@vera/domain/permissions";
import type { PropertyDefinition, PropertyValue } from "@vera/domain/properties";
import {
  facetValueOf,
  isActiveCondition,
  meetsCondition,
  pageCountKey,
  valueInUseAt,
  valueInUseOf,
  valuesOf,
} from "@vera/domain/properties";
import type { RecordStore } from "@vera/domain/store";
import type { PropertyFacets, PropertyParams } from "../properties";
import { conditionsOf } from "../properties";

export function allPropertyDefinitions(store: RecordStore): PropertyDefinition[] {
  return store.propertyDefinitions.map((definition) => ({
    ...definition,
    isCatalogFact: store.catalogPropertyKeys.has(definition.key),
  }));
}

// DOC-property-visibility: staff properties are read in staff detail only, with `iteration.read`.
export function mayReadStaffProperties(session: Session): boolean {
  return hasPermission(session, "iteration.read");
}

// Whoever defines properties, or gives their permissions, reads every definition.
export function readablePropertyDefinitions(
  store: RecordStore,
  session: Session,
): PropertyDefinition[] {
  const readsStaff =
    mayReadStaffProperties(session) ||
    hasPermission(session, "property.define") ||
    hasPermission(session, "access.manage");
  return allPropertyDefinitions(store).filter(
    (definition) => readsStaff || definition.visibility === "public",
  );
}

export function publicPropertyKeys(store: RecordStore): Set<string> {
  return new Set(
    store.propertyDefinitions
      .filter((definition) => definition.visibility === "public")
      .map(({ key }) => key),
  );
}

// What a record is, for a property: its document, and the attempt a page shows it by.
export interface PropertySubjectRecord {
  readonly document: Document;
  readonly iteration: Iteration | null;
}

// The value in use a record holds; the predefined four read the document's own fields
// (DOC-property-predefined). A day given reads what was in use then (PLAN-scope).
export function recordValueOf(
  { document, iteration }: PropertySubjectRecord,
  definition: PropertyDefinition,
  at?: string,
): PropertyValue | null {
  switch (definition.key) {
    case pageCountKey: {
      const sources = document.pageSources.filter(
        (source) => at === undefined || source.observedAt <= at,
      );
      return sources.toSorted((first, second) => second.tier - first.tier)[0]?.value ?? null;
    }
    case "material_type":
      return document.type;
    case "shelf_mark":
      return document.shelfMark;
    case "title":
      return document.title;
  }
  const properties = definition.about === "document" ? document.properties : iteration?.properties;
  const values = valuesOf(properties ?? [], definition.key);
  return (at === undefined ? valueInUseOf(values) : valueInUseAt(values, at))?.value ?? null;
}

export interface PropertyPredicate {
  readonly key: string;
  readonly matches: (record: PropertySubjectRecord) => boolean;
}

// DOC-property-filter: one predicate per condition on a property the caller may read here.
export function propertyPredicatesOf(
  store: RecordStore,
  params: PropertyParams | undefined,
  definitions: readonly PropertyDefinition[],
): PropertyPredicate[] {
  return conditionsOf(params, definitions)
    .filter(isActiveCondition)
    .flatMap((condition) => {
      const definition = definitions.find((candidate) => candidate.key === condition.key);
      return definition === undefined
        ? []
        : [
            {
              key: condition.key,
              matches: (record: PropertySubjectRecord) =>
                meetsCondition(condition, recordValueOf(record, definition), store.today),
            },
          ];
    });
}

// UI-facets: an enum's or a yes/no's values, and no value, over the records every other filter
// leaves.
export function propertyFacetsOf(
  definitions: readonly PropertyDefinition[],
  matchingAllBut: (key: string) => readonly PropertySubjectRecord[],
): PropertyFacets {
  return Object.fromEntries(
    definitions
      .filter((definition) => definition.type.kind === "enum" || definition.type.kind === "yesNo")
      .map((definition) => {
        const values = matchingAllBut(definition.key).map((record) =>
          recordValueOf(record, definition),
        );
        return [
          definition.key,
          {
            values: countValues(
              values.flatMap((value) =>
                value === null ? [] : (Array.isArray(value) ? value : [value]).map(facetValueOf),
              ),
            ),
            noValue: values.filter((value) => value === null).length,
          },
        ];
      }),
  );
}

// The properties a page filters on: what the caller may read, for its audience, the page count
// apart, which has its own Pages filter.
export function filterablePropertiesOf(
  store: RecordStore,
  session: Session,
  isPublic: boolean,
): PropertyDefinition[] {
  return readablePropertyDefinitions(store, session).filter(
    (definition) =>
      definition.key !== pageCountKey &&
      (!isPublic || definition.visibility === "public") &&
      (isPublic || mayReadStaffProperties(session) || definition.visibility === "public"),
  );
}
