// The property definitions the mock starts with (DOC-property): the four predefined ones
// (DOC-property-predefined) and two an admin defined, a document's Size and the Machines an
// attempt is scanned on, with the values entered by hand so far. The title, material type and
// shelf mark hold the catalog adapter's values as any property holds its sources, and stay on the
// document as the catalog record shows them; the page count keeps its own sources
// (DOC-page-count).

import type { Document } from "@/domain/entities";
import type { Grant } from "@/domain/permissions";
import type { PropertyDefinition, PropertyValues } from "@/domain/properties";
import { editPermissionOf } from "@/domain/properties";

// What the store keeps; whether the catalog holds it is read from the adapters' declarations.
export type StoredPropertyDefinition = Omit<PropertyDefinition, "isCatalogFact">;

const names = (en: string, cs: string) => ({ en, cs });

export const propertyDefinitions: readonly StoredPropertyDefinition[] = [
  {
    key: "page_count",
    names: names("Page count", "Počet stran"),
    visibility: "staff",
    type: { kind: "number", unit: "pages" },
    isList: false,
    about: "document",
    // DOC-page-count: manual, tier 100.
    handTier: 100,
    isPredefined: true,
  },
  {
    key: "material_type",
    names: names("Material type", "Typ dokumentu"),
    visibility: "public",
    type: {
      kind: "enum",
      values: [
        { value: "Periodical", names: names("Periodical", "Periodikum") },
        { value: "Monograph", names: names("Monograph", "Monografie") },
        { value: "Manuscript", names: names("Manuscript", "Rukopis") },
        { value: "Map", names: names("Map", "Mapa") },
      ],
    },
    isList: false,
    about: "document",
    handTier: null,
    isPredefined: true,
  },
  {
    key: "shelf_mark",
    names: names("Shelf mark", "Signatura"),
    visibility: "staff",
    type: { kind: "text" },
    isList: false,
    about: "document",
    handTier: null,
    isPredefined: true,
  },
  {
    key: "title",
    names: names("Title", "Název"),
    visibility: "public",
    type: { kind: "text" },
    isList: false,
    about: "document",
    handTier: null,
    isPredefined: true,
  },
  {
    key: "size",
    names: names("Size", "Formát"),
    visibility: "public",
    type: {
      kind: "enum",
      values: [
        { value: "A5", names: names("A5", "A5") },
        { value: "A4", names: names("A4", "A4") },
        { value: "A3", names: names("A3", "A3") },
        { value: "A2", names: names("A2", "A2") },
        { value: "folio", names: names("Folio", "Folio") },
      ],
    },
    isList: false,
    about: "document",
    handTier: 100,
    isPredefined: false,
  },
  {
    key: "machines",
    names: names("Machines", "Skenery"),
    visibility: "staff",
    type: {
      kind: "enum",
      values: [
        { value: "zeutschel", names: names("Zeutschel", "Zeutschel") },
        { value: "treventus", names: names("Treventus", "Treventus") },
        { value: "bookeye", names: names("Bookeye", "Bookeye") },
        { value: "phase-one", names: names("Phase One", "Phase One") },
      ],
    },
    isList: true,
    about: "attempt",
    handTier: 100,
    isPredefined: false,
  },
];

// The per-property permissions the site's roles were given once the properties were defined
// (PERM-property-edit); the shipped roles hold none of them.
export const propertyGrants: Readonly<Record<string, readonly Grant[]>> = {
  "dig-curator": [
    { permission: editPermissionOf("size"), scope: "any" },
    { permission: editPermissionOf("machines"), scope: "any" },
  ],
  admin: [
    { permission: editPermissionOf("size"), scope: "any" },
    { permission: editPermissionOf("machines"), scope: "any" },
  ],
};

const byHand = (value: PropertyValues["sources"][number]["value"], setBy: string, at: string) => ({
  source: { kind: "hand" as const },
  tier: 100,
  value,
  observedAt: at,
  setBy,
});

// DOC-property-predefined: what the catalog adapter read, as MZK Aleph at the tier its version
// declares.
const catalogAdapter = { kind: "plugin" as const, instanceId: "pi1", instanceName: "MZK Aleph" };
const catalogTier = 50;

export function catalogPropertyValuesOf(
  document: Pick<Document, "title" | "type" | "shelfMark">,
  observedAt: string,
): PropertyValues[] {
  const read = (key: string, value: string | null): PropertyValues[] =>
    value === null
      ? []
      : [
          {
            key,
            sources: [
              { source: catalogAdapter, tier: catalogTier, value, observedAt, setBy: null },
            ],
          },
        ];
  return [
    ...read("title", document.title),
    ...read("material_type", document.type),
    ...read("shelf_mark", document.shelfMark),
  ];
}

// DOC-property-predefined: a recheck's reading replaces the adapter's earlier one, and keeps every
// other source of the three.
export function withCatalogReading(
  document: Pick<Document, "title" | "type" | "shelfMark" | "properties">,
  observedAt: string,
): PropertyValues[] {
  const reading = catalogPropertyValuesOf(document, observedAt);
  const isAdapter = (source: PropertyValues["sources"][number]) =>
    source.source.kind === "plugin" && source.source.instanceId === catalogAdapter.instanceId;
  const kept = document.properties.map((values) => {
    const fresh = reading.find((read) => read.key === values.key);
    return fresh === undefined
      ? values
      : { ...values, sources: [...fresh.sources, ...values.sources.filter((s) => !isAdapter(s))] };
  });
  return [...kept, ...reading.filter((read) => !kept.some((values) => values.key === read.key))];
}

// Document properties by document, beyond the predefined four.
export const documentPropertyValues: Readonly<Record<string, readonly PropertyValues[]>> = {
  D1: [{ key: "size", sources: [byHand("A2", "u2", "2026-05-12T09:00:00Z")] }],
  D2: [{ key: "size", sources: [byHand("A2", "u2", "2026-05-12T09:10:00Z")] }],
  D3: [{ key: "size", sources: [byHand("A3", "u8", "2026-06-02T10:00:00Z")] }],
  D4: [{ key: "size", sources: [byHand("A4", "u2", "2026-06-03T11:00:00Z")] }],
  D6: [{ key: "size", sources: [byHand("folio", "u8", "2026-06-10T08:30:00Z")] }],
  D9: [{ key: "size", sources: [byHand("A2", "u2", "2026-06-11T14:00:00Z")] }],
  D10: [{ key: "size", sources: [byHand("A5", "u2", "2026-06-12T09:00:00Z")] }],
  D36: [{ key: "size", sources: [byHand("A4", "u2", "2026-04-02T09:00:00Z")] }],
  D46: [{ key: "size", sources: [byHand("A5", "u8", "2026-06-15T09:00:00Z")] }],
  D47: [{ key: "size", sources: [byHand("A4", "u8", "2026-06-15T09:05:00Z")] }],
};

// Attempt properties by iteration: the machines chosen for that scan.
export const iterationPropertyValues: Readonly<Record<string, readonly PropertyValues[]>> = {
  IT1: [{ key: "machines", sources: [byHand(["zeutschel"], "u2", "2026-06-01T09:00:00Z")] }],
  IT5: [
    { key: "machines", sources: [byHand(["bookeye", "zeutschel"], "u2", "2026-06-20T09:00:00Z")] },
  ],
  IT12: [{ key: "machines", sources: [byHand(["phase-one"], "u2", "2026-06-05T09:00:00Z")] }],
  IT20: [{ key: "machines", sources: [byHand(["zeutschel"], "u2", "2026-04-10T09:00:00Z")] }],
  IT21: [{ key: "machines", sources: [byHand(["treventus"], "u8", "2026-06-22T09:00:00Z")] }],
};
