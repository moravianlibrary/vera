// What the mock catalog knows beyond the documents VERA already holds, after the demo's CAT
// table (docs/demos/shared/page-documents.js § propose). Every fixture document's catalog ID
// resolves too; the mock catalog reads those from the documents themselves. A record of several
// volumes or issues lists them, and a barcode names one of them.

import type { RegistryAnswer } from "@vera/contract/queries/proposals";
import type { CatalogBase } from "@vera/contract/queries/ways-in";
import type { CatalogRecord } from "@vera/domain/catalog";

// The catalog each Aleph the mock knows stands for: the base its record IDs start with, and where
// a person finds a record in it.
export const wayInCatalogs: Readonly<Record<string, CatalogBase>> = {
  "aleph.mzk.cz": { base: "MZK", opacUrl: "https://vufind.mzk.cz" },
  "aleph.vkol.cz": { base: "VKOL", opacUrl: "https://aleph.vkol.cz" },
  "aleph.nkp.cz": { base: "NKC", opacUrl: "https://aleph.nkp.cz" },
};

export type { CatalogRecord } from "@vera/domain/catalog";

export const catalogRecords: readonly CatalogRecord[] = [
  {
    catalogId: "MZK01-001277001",
    title: "Slovácké noviny",
    type: "Periodical",
    units: ["1936–1938", "1939", "1940"],
    identifiers: [],
    shelfMarks: {},
    barcodes: {},
  },
  {
    catalogId: "MZK03-000556300",
    title: "Brněnský kalendář",
    type: "Periodical",
    units: ["1901", "1902", "1903"],
    identifiers: [],
    shelfMarks: {},
    barcodes: {},
  },
  {
    catalogId: "MZK01-001622010",
    title: "Národní listy",
    type: "Periodical",
    units: ["1889", "1890"],
    identifiers: [],
    shelfMarks: {},
    barcodes: {},
  },
  {
    catalogId: "MZK03-000112877",
    title: "Kniha o Brně",
    type: "Monograph",
    units: null,
    identifiers: [],
    // Bound with Moravské kostely: one shelf mark, two records.
    shelfMarks: { "ST3-0880": null },
    barcodes: { "MZK-2801-000533": null },
  },
  {
    catalogId: "MZK01-001388120",
    title: "Selské noviny",
    type: "Periodical",
    units: ["1907–1911"],
    identifiers: ["cnb001388120"],
    shelfMarks: {},
    barcodes: {},
  },
  {
    catalogId: "MZK03-000778120",
    title: "Moravské kostely",
    type: "Monograph",
    units: null,
    identifiers: ["978-80-7325-456-8"],
    shelfMarks: { "ST3-0871": null, "ST3-0880": null },
    barcodes: {},
  },
  {
    catalogId: "MZK01-001520331",
    title: "Moravský hospodář",
    type: "Periodical",
    units: ["roč. 1", "roč. 2"],
    identifiers: ["1801-1233"],
    shelfMarks: { "ST2-0950": "roč. 1", "ST2-0951": "roč. 2", "ST2-095x": null },
    barcodes: {},
  },
  {
    catalogId: "MZK01-001452200",
    title: "Hlas Moravy",
    type: "Periodical",
    units: ["MZK-2801-000341"],
    identifiers: [],
    shelfMarks: {},
    barcodes: { "MZK-2801-000341": "MZK-2801-000341" },
  },
  {
    catalogId: "MZK01-001555012",
    title: "Brněnský deník",
    type: "Periodical",
    units: ["MZK-2801-000977", "MZK-2801-000412", "MZK-2801-000618"],
    identifiers: [],
    shelfMarks: {},
    barcodes: {
      "MZK-2801-000977": "MZK-2801-000977",
      "MZK-2801-000412": "MZK-2801-000412",
      "MZK-2801-000618": "MZK-2801-000618",
    },
  },
  {
    catalogId: "VKOL01-000456123",
    title: "Slovácké noviny",
    type: "Periodical",
    units: ["1941", "1942"],
    identifiers: [],
    shelfMarks: {},
    barcodes: {},
  },
  // The record D35 should have been linked to: its own ID answers nothing (IT19's defect), so
  // relinking it here is the fix.
  {
    catalogId: "MZK01-001502234",
    title: "Našinec",
    type: "Periodical",
    units: ["roč. 11", "roč. 12", "roč. 13"],
    identifiers: [],
    shelfMarks: {},
    barcodes: {},
  },
  {
    catalogId: "NKC01-002345678",
    title: "Zlatá Praha",
    type: "Periodical",
    units: ["roč. 12", "roč. 13"],
    identifiers: [],
    shelfMarks: {},
    barcodes: {},
  },
];

export const registryAnswers: Readonly<Record<string, readonly RegistryAnswer[]>> = {
  "MZK01-001277001|1939": [
    {
      registry: "Kramerius",
      state: "Published",
      link: "https://kramerius.mzk.cz/view/uuid:demo-new-volume",
    },
  ],
};

// What has been repaired in the catalog since VERA last read each record: catalog ID to the
// subjects (fields, or the record itself) a recheck no longer finds a defect on. Everything else
// is as VERA last read it, so a recheck finds the same defects again.
export const catalogRepairs: Readonly<Record<string, readonly string[]>> = {
  // Dějiny Velehradu: the bracket in 245$a is closed; 041$a is still missing.
  "MZK03-000445012": ["245$a"],
  // Kodex Gigas — fragment: 300$a now gives the leaves the scan has.
  "MZK05-000009901": ["300$a"],
};

// The catalog adapter plugin the mock stands in for, MZK's, with only what the frontend sees of
// it: where a record opens, for a curator to repair it (plugins.md §4.1 toLink).
export interface CatalogAdapterFixture {
  readonly name: string;
  readonly toLink?: (catalogId: string) => string;
}

export const catalogAdapter: CatalogAdapterFixture = {
  name: "MZK Aleph",
  toLink: (catalogId) => `https://vufind.mzk.cz/Record/${encodeURIComponent(catalogId)}`,
};
