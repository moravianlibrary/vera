// What the server does for properties (DOC-property): the definitions a caller may read, defining
// them with `property.define` (admin only), entering a value by hand with `property.<key>.edit`,
// and deleting a definition with everything that names it (DOC-property-delete). A key is never
// defined twice, a deleted one included; the predefined four are edited, never deleted
// (DOC-property-predefined).
// TODO(rrandiak): log definition changes once the log has subjects other than records.

import type {
  PropertyEntry,
  PropertyEntryResult,
  PropertyFacets,
  PropertyImpact,
  PropertyIndex,
  PropertyParams,
} from "@vera/contract/properties";
import { propertyParamKeyOf } from "@vera/contract/properties";
import {
  allPropertyDefinitions as queryAllPropertyDefinitions,
  filterablePropertiesOf as queryFilterablePropertiesOf,
  mayReadStaffProperties as queryMayReadStaffProperties,
  propertyFacetsOf as queryPropertyFacetsOf,
  propertyPredicatesOf as queryPropertyPredicatesOf,
  publicPropertyKeys as queryPublicPropertyKeys,
  readablePropertyDefinitions as queryReadablePropertyDefinitions,
  recordValueOf as queryRecordValueOf,
} from "@vera/contract/queries/properties";
import { currentIterationOf } from "@vera/domain/documents";
import type { Document, Intention, Iteration, Session, Watchlist } from "@vera/domain/entities";
import { isShared } from "@vera/domain/entities";
import { progressAfterGates } from "@vera/domain/iterations";
import { can, hasPermission } from "@vera/domain/permissions";
import type {
  PropertyDefinition,
  PropertyDraft,
  PropertyValue,
  PropertyValues,
} from "@vera/domain/properties";
import {
  editPermissionOf,
  isValueOf,
  mayBeEnteredByHand,
  meetsCondition,
  pageCountKey,
  valueInUseOf,
  valuesOf,
} from "@vera/domain/properties";
import { isFoundAfterScan, reviewStateOf } from "@vera/domain/validations";
import { formatPropertyValue, propertyNameOf } from "@/features/properties/property-names";
import { database, mockStore } from "@/mocks/database";
import type { StoredPropertyDefinition } from "@/mocks/fixtures/properties";
import { recordHookEvent } from "@/mocks/hooks";
import type { Outcome, Refusal } from "@/mocks/mutations";
import { progressNote, replaceIteration, writeLog } from "@/mocks/mutations";
import { mockNow } from "@/mocks/today";
import { noteSystemWatchlistChange } from "@/mocks/watchlist-delivery";
import { audienceReachOf } from "@/mocks/watchlists";

const mayNotDefine: Refusal = { status: 403, message: "You may not define properties" };

// ---------------------------------------------------------------- reading

function definitionOf(stored: StoredPropertyDefinition): PropertyDefinition {
  return { ...stored, isCatalogFact: mockStore().catalogPropertyKeys.has(stored.key) };
}

export function allPropertyDefinitions(): PropertyDefinition[] {
  return queryAllPropertyDefinitions(mockStore());
}

export function mayReadStaffProperties(session: Session): boolean {
  return queryMayReadStaffProperties(session);
}

export function readablePropertyDefinitions(session: Session): PropertyDefinition[] {
  return queryReadablePropertyDefinitions(mockStore(), session);
}

export function publicPropertyKeys(): Set<string> {
  return queryPublicPropertyKeys(mockStore());
}

function valueCountOf(key: string): number {
  return (
    database.documents.filter((document) => valuesOf(document.properties, key) !== undefined)
      .length +
    database.iterations.filter((iteration) => valuesOf(iteration.properties, key) !== undefined)
      .length
  );
}

export function propertyIndex(session: Session): PropertyIndex {
  return {
    definitions: readablePropertyDefinitions(session),
    deletedKeys: hasPermission(session, "property.define") ? [...database.deletedPropertyKeys] : [],
    valueCounts: Object.fromEntries(
      database.propertyDefinitions.map(({ key }) => [key, valueCountOf(key)]),
    ),
  };
}

// ---------------------------------------------------------------- defining

function draftRefusal(draft: PropertyDraft, key: string): Refusal | null {
  if (draft.type.kind === "enum") {
    const values = draft.type.values.map(({ value }) => value);
    if (new Set(values).size !== values.length) {
      return {
        status: 422,
        code: "property.duplicate_value",
        message: "Each value is listed once",
      };
    }
  }

  // DOC-property-hand: a fact the catalog holds is never entered by hand, the page count apart.
  if (
    draft.handTier !== null &&
    !mayBeEnteredByHand({ key, isCatalogFact: mockStore().catalogPropertyKeys.has(key) })
  ) {
    return {
      status: 422,
      code: "property.catalog_fact",
      message: "The catalog holds it; it is repaired there, never entered by hand",
    };
  }

  return null;
}

export function createProperty(
  session: Session,
  key: string,
  draft: PropertyDraft,
): Outcome<PropertyDefinition> {
  if (!hasPermission(session, "property.define")) {
    return { refusal: mayNotDefine };
  }

  if (
    database.propertyDefinitions.some((definition) => definition.key === key) ||
    database.deletedPropertyKeys.includes(key)
  ) {
    return {
      refusal: {
        status: 409,
        code: "property.key_taken",
        message: "That key is or was in use; a key is never used twice",
      },
    };
  }

  const refusal = draftRefusal(draft, key);
  if (refusal !== null) {
    return { refusal };
  }

  const stored: StoredPropertyDefinition = { ...draft, key, isPredefined: false };
  database.propertyDefinitions.push(stored);
  return { value: definitionOf(stored) };
}

// DOC-property-fixed: values in use would no longer fit, so the type, the list and what it is
// about stay once a record holds a value, and an enum value in use stays.
function changeRefusal(stored: StoredPropertyDefinition, draft: PropertyDraft): Refusal | null {
  const isTypeChanged =
    stored.type.kind !== draft.type.kind ||
    stored.isList !== draft.isList ||
    stored.about !== draft.about ||
    (stored.type.kind === "number" &&
      draft.type.kind === "number" &&
      stored.type.unit !== draft.type.unit);
  if (isTypeChanged && (stored.isPredefined || valueCountOf(stored.key) > 0)) {
    return {
      status: 409,
      code: "property.in_use",
      message: "Records hold values of it; its type and what it is about stay",
    };
  }

  if (stored.type.kind === "enum" && draft.type.kind === "enum") {
    const kept = new Set(draft.type.values.map(({ value }) => value));
    const used = new Set(
      [...database.documents, ...database.iterations].flatMap((record) => {
        const value = valueInUseOf(valuesOf(record.properties, stored.key))?.value;
        return value === undefined ? [] : (Array.isArray(value) ? value : [value]).map(String);
      }),
    );
    if ([...used].some((value) => !kept.has(value))) {
      return {
        status: 409,
        code: "property.value_in_use",
        message: "A value records hold cannot be taken out",
      };
    }
  }

  return null;
}

export function saveProperty(
  session: Session,
  key: string,
  draft: PropertyDraft,
): Outcome<PropertyDefinition> {
  if (!hasPermission(session, "property.define")) {
    return { refusal: mayNotDefine };
  }

  const index = database.propertyDefinitions.findIndex((definition) => definition.key === key);
  const stored = database.propertyDefinitions[index];
  if (stored === undefined) {
    return { refusal: { status: 404, message: "No such property" } };
  }

  const refusal = draftRefusal(draft, key) ?? changeRefusal(stored, draft);
  if (refusal !== null) {
    return { refusal };
  }

  const saved: StoredPropertyDefinition = { ...stored, ...draft };
  database.propertyDefinitions.splice(index, 1, saved);
  return { value: definitionOf(saved) };
}

// What deleting would remove, counted by the server.
export function propertyImpact(session: Session, key: string): Outcome<PropertyImpact> {
  if (!hasPermission(session, "property.define")) {
    return { refusal: mayNotDefine };
  }

  const stored = database.propertyDefinitions.find((definition) => definition.key === key);
  if (stored === undefined) {
    return { refusal: { status: 404, message: "No such property" } };
  }

  const watchlists = database.watchlists.filter((watchlist) => namesProperty(watchlist, key));
  return {
    value: {
      valueCount: valueCountOf(key),
      roleNames: database.roles
        .filter((role) => role.grants.some((grant) => grant.permission === editPermissionOf(key)))
        .map((role) => role.name),
      watchlists: watchlists.map((watchlist) => ({
        name: watchlist.name,
        isShared: isShared(watchlist),
      })),
      intentionNames: [...database.intentions, ...database.intentionTemplates]
        .filter((intention) => namesCondition(intention, key))
        .map((intention) => ("name" in intention ? intention.name : intention.namePattern)),
    },
  };
}

function namesCondition(intention: Pick<Intention, "scopeConditions">, key: string): boolean {
  return (intention.scopeConditions ?? []).some((condition) => condition.key === key);
}

// A watchlist's filter names a property by its parameters (propertyParamsOf in api/properties).
function namesProperty(watchlist: Watchlist, key: string): boolean {
  return Object.keys(watchlist.filter).some((param) => propertyParamKeyOf(param) === key);
}

function withoutProperty(filter: Watchlist["filter"], key: string): Watchlist["filter"] {
  return Object.fromEntries(
    Object.entries(filter).filter(([param]) => propertyParamKeyOf(param) !== key),
  );
}

// DOC-property-delete: its values, its permission in every role, and every filter and condition
// naming it go; a system watchlist that loses a condition is refiltered and pauses until each
// recipient confirms (WATCH-system-change). The key is never defined again.
export function deleteProperty(session: Session, key: string): Outcome<null> {
  if (!hasPermission(session, "property.define")) {
    return { refusal: mayNotDefine };
  }

  const stored = database.propertyDefinitions.find((definition) => definition.key === key);
  if (stored === undefined) {
    return { refusal: { status: 404, message: "No such property" } };
  }

  if (stored.isPredefined) {
    return {
      refusal: {
        status: 409,
        code: "property.predefined",
        message: "A predefined property is edited, never deleted",
      },
    };
  }

  database.propertyDefinitions = database.propertyDefinitions.filter(
    (definition) => definition.key !== key,
  );
  database.deletedPropertyKeys.push(key);
  database.documents = database.documents.map((document) => ({
    ...document,
    properties: document.properties.filter((values) => values.key !== key),
  }));
  database.iterations = database.iterations.map((iteration) => ({
    ...iteration,
    properties: iteration.properties.filter((values) => values.key !== key),
  }));
  const permission = editPermissionOf(key);
  database.roles = database.roles.map((role) => ({
    ...role,
    grants: role.grants.filter((grant) => grant.permission !== permission),
  }));
  database.watchlists = database.watchlists.map((watchlist) => {
    if (!namesProperty(watchlist, key)) {
      return watchlist;
    }

    const filter = withoutProperty(watchlist.filter, key);
    if (!isShared(watchlist)) {
      return { ...watchlist, filter };
    }

    noteSystemWatchlistChange(
      watchlist.id,
      "filter_changed",
      audienceReachOf(watchlist.audience, watchlist.view).reachedIds,
    );
    return { ...watchlist, filter, filterVersion: (watchlist.filterVersion ?? 1) + 1 };
  });
  // An intention that had a condition on it counts more from then on (PLAN-scope).
  const withoutConditions = <Scoped extends Pick<Intention, "scopeConditions">>(scoped: Scoped) =>
    namesCondition(scoped, key)
      ? {
          ...scoped,
          scopeConditions: (scoped.scopeConditions ?? []).filter(
            (condition) => condition.key !== key,
          ),
        }
      : scoped;
  database.intentions = database.intentions.map(withoutConditions);
  database.intentionTemplates = database.intentionTemplates.map(withoutConditions);
  return { value: null };
}

// ---------------------------------------------------------------- entering values

// The rules that read a property: what a Validation version declares each rule reads.
function isReadByRules(key: string): boolean {
  return database.pluginImplementations
    .filter((implementation) => implementation.kind === "Validation")
    .flatMap((implementation) => implementation.versions)
    .some((version) => version.declares.rules.some((rule) => rule.reads?.includes(key)));
}

function replaceDocument(document: Document): void {
  const index = database.documents.findIndex((candidate) => candidate.id === document.id);
  database.documents.splice(index, 1, document);
}

function withHandValue(
  properties: readonly PropertyValues[],
  key: string,
  entry: PropertyEntry,
  tier: number,
  session: Session,
): PropertyValues[] {
  const held = valuesOf(properties, key);
  const others = held?.sources.filter((source) => source.source.kind !== "hand") ?? [];
  const sources =
    entry.value === null
      ? others
      : [
          ...others,
          {
            source: { kind: "hand" as const },
            tier,
            value: entry.value,
            observedAt: mockNow().toISOString(),
            setBy: session.user.id,
          },
        ];
  const rest = properties.filter((values) => values.key !== key);
  return sources.length === 0 ? rest : [...rest, { key, sources }];
}

// DOC-property-hand: `property.<key>.edit` at `any`, for a property defined for hand entry. A
// document property is set on the document, an attempt property on its current attempt, never
// once that is scanned. The change is logged and fires its event; a rule that reads the property
// runs the checks again.
export function enterPropertyValue(
  session: Session,
  documentId: string,
  key: string,
  entry: PropertyEntry,
): Outcome<PropertyEntryResult> {
  const stored = database.propertyDefinitions.find((candidate) => candidate.key === key);
  const document = database.documents.find((candidate) => candidate.id === documentId);
  if (stored === undefined || document === undefined || !mayReadStaffProperties(session)) {
    return { refusal: { status: 404, message: "No such property or document" } };
  }

  const definition = definitionOf(stored);
  if (!can(session, editPermissionOf(key), { kind: "unscoped" })) {
    return { refusal: { status: 403, message: "You may not enter this property" } };
  }

  if (definition.handTier === null || key === pageCountKey || !mayBeEnteredByHand(definition)) {
    return {
      refusal: {
        status: 422,
        code: "property.not_by_hand",
        message: "This property is not entered by hand here",
      },
    };
  }

  if (entry.value !== null && !isValueOf(definition, entry.value)) {
    return {
      refusal: {
        status: 422,
        code: "property.value_not_allowed",
        message: "That is not a value this property takes",
      },
    };
  }

  const iterations = database.iterations
    .filter((iteration) => iteration.documentId === documentId)
    .toSorted((first, second) => first.attempt - second.attempt);
  const iteration = currentIterationOf({ document, iterations, requests: [] });
  const before =
    definition.about === "document"
      ? valueInUseOf(valuesOf(document.properties, key))
      : iteration === null
        ? null
        : valueInUseOf(valuesOf(iteration.properties, key));

  if (definition.about === "attempt") {
    if (iteration === null) {
      return {
        refusal: {
          status: 409,
          code: "property.no_attempt",
          message: "There is no attempt to set it on yet",
        },
      };
    }

    if (isFoundAfterScan(iteration)) {
      return {
        refusal: {
          status: 409,
          code: "iteration.scanned",
          message: "This attempt is scanned; what it was scanned with stays",
        },
      };
    }

    replaceIteration({
      ...iteration,
      properties: withHandValue(iteration.properties, key, entry, definition.handTier, session),
    });
  } else {
    replaceDocument({
      ...document,
      properties: withHandValue(document.properties, key, entry, definition.handTier, session),
    });
  }

  const after = valueInUseOf(
    valuesOf(
      definition.about === "document"
        ? (database.documents.find((candidate) => candidate.id === documentId)?.properties ?? [])
        : (database.iterations.find((candidate) => candidate.id === iteration?.id)?.properties ??
            []),
      key,
    ),
  );
  const text = (value: typeof after) =>
    value === null ? "no value" : formatPropertyValue(definition, value.value);
  const name = propertyNameOf(definition);
  const detail = `${name}: ${text(before)} → ${text(after)}, by hand.`;
  const logSubject =
    definition.about === "attempt" && iteration !== null
      ? { subjectKind: "iteration" as const, subjectId: iteration.id }
      : { subjectKind: "document" as const, subjectId: document.id };
  const isRechecked = iteration !== null && isReadByRules(key);
  if (isRechecked && iteration !== null) {
    recheckFor(
      session,
      iteration,
      key,
      {
        from: before?.value ?? null,
        to: after?.value ?? null,
      },
      detail,
    );
  } else {
    writeLog({
      ...logSubject,
      at: mockNow().toISOString(),
      actor: { kind: "user", userId: session.user.id },
      correlationId: crypto.randomUUID(),
      code:
        logSubject.subjectKind === "document"
          ? "document.property_changed"
          : "iteration.property_changed",
      data: { key, value: { from: before?.value ?? null, to: after?.value ?? null } },
      reason: { public: null, internal: "Changed by hand." },
    });
  }

  recordHookEvent(
    definition.about === "document" ? "document.property_changed" : "iteration.property_changed",
    logSubject.subjectId,
    "",
    `${document.title}: ${detail}`,
  );
  return { value: { isRechecked } };
}

// The mock's check run: a defect on the property is gone once a value is entered.
function recheckFor(
  session: Session,
  iteration: Iteration,
  key: string,
  value: { from: unknown; to: unknown },
  detail: string,
): void {
  const current =
    database.iterations.find((candidate) => candidate.id === iteration.id) ?? iteration;
  const rechecked = {
    ...current,
    defects: current.defects.filter((defect) => defect.subject !== key),
  };
  const progress = isFoundAfterScan(current) ? current.progress : progressAfterGates(rechecked);
  replaceIteration({ ...rechecked, progress });
  reviewStateOf({ ...rechecked, progress });
  writeLog({
    subjectKind: "iteration",
    subjectId: iteration.id,
    at: mockNow().toISOString(),
    actor: { kind: "user", userId: session.user.id },
    correlationId: crypto.randomUUID(),
    code: "iteration.property_changed",
    data: { key, value },
    reason: {
      public: null,
      internal:
        [detail, "The checks ran again.", progressNote(current.progress, progress)]
          .filter((sentence) => sentence !== null)
          .join(" ") || null,
    },
  });
}

// For the documents a bulk entry names, one by one: what each refused.
export function enterPropertyValues(
  session: Session,
  documentIds: readonly string[],
  key: string,
  entry: PropertyEntry,
): Outcome<{ enteredCount: number; refusals: { documentId: string; message: string }[] }> {
  const outcomes = documentIds.map((documentId) => ({
    documentId,
    outcome: enterPropertyValue(session, documentId, key, entry),
  }));
  const first = outcomes[0]?.outcome;
  if (
    first !== undefined &&
    "refusal" in first &&
    outcomes.every(
      ({ outcome }) => "refusal" in outcome && outcome.refusal.status === first.refusal.status,
    ) &&
    (first.refusal.status === 403 || first.refusal.status === 404 || first.refusal.status === 422)
  ) {
    return first;
  }

  return {
    value: {
      enteredCount: outcomes.filter(({ outcome }) => "value" in outcome).length,
      refusals: outcomes.flatMap(({ documentId, outcome }) =>
        "refusal" in outcome ? [{ documentId, message: outcome.refusal.message }] : [],
      ),
    },
  };
}

// ---------------------------------------------------------------- filtering

export type { PropertyPredicate, PropertySubjectRecord } from "@vera/contract/queries/properties";

import type { PropertySubjectRecord } from "@vera/contract/queries/properties";
export function recordValueOf(
  record: PropertySubjectRecord,
  definition: PropertyDefinition,
  at?: string,
): PropertyValue | null {
  return queryRecordValueOf(record, definition, at);
}
export function propertyPredicatesOf(
  params: PropertyParams | undefined,
  definitions: readonly PropertyDefinition[],
) {
  return queryPropertyPredicatesOf(mockStore(), params, definitions);
}
export function propertyFacetsOf(
  definitions: readonly PropertyDefinition[],
  matchingAllBut: (key: string) => readonly PropertySubjectRecord[],
): PropertyFacets {
  return queryPropertyFacetsOf(definitions, matchingAllBut);
}
export function filterablePropertiesOf(session: Session, isPublic: boolean): PropertyDefinition[] {
  return queryFilterablePropertiesOf(mockStore(), session, isPublic);
}

// PLAN-scope: an item meets every condition its intention's scope adds, a document property on
// its document and an attempt property on the item, read as it was on the item's digitized date
// once it is digitized, so a later change does not move what was counted. A condition on a
// property that no longer exists is gone with it (DOC-property-delete).
export function meetsScopeConditions(
  intention: Pick<Intention, "scopeConditions">,
  iteration: Iteration,
): boolean {
  const conditions = intention.scopeConditions ?? [];
  if (conditions.length === 0) {
    return true;
  }

  const document = database.documents.find((candidate) => candidate.id === iteration.documentId);
  if (document === undefined) {
    return false;
  }

  const definitions = queryAllPropertyDefinitions(mockStore());
  const at = iteration.digitizedAt ?? undefined;
  return conditions.every((condition) => {
    const definition = definitions.find((candidate) => candidate.key === condition.key);
    return (
      definition === undefined ||
      meetsCondition(
        condition,
        queryRecordValueOf({ document, iteration }, definition, at),
        mockStore().today,
      )
    );
  });
}
