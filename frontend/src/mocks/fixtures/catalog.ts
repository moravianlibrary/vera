// What the mock catalog knows beyond the documents VERA already holds, after the demo's CAT
// table (docs/demos/shared/page-documents.js § propose). Every fixture document's catalog ID
// resolves too; the mock catalog reads those from the documents themselves. A record of several
// volumes or issues lists them, and a barcode names one of them.

import type { DocumentType } from "@/domain/entities";

export interface CatalogRecord {
  catalogId: string;
  title: string;
  type: DocumentType;
  // Null for a record that is one document; otherwise the units the catalog enumerates.
  units: readonly string[] | null;
  // CNB, ISBN and ISSN that resolve to the record.
  identifiers: readonly string[];
  // Barcode to the unit it is on; a monograph's barcode names the whole record.
  barcodes: Readonly<Record<string, string | null>>;
}

export const catalogRecords: readonly CatalogRecord[] = [
  {
    catalogId: "MZK01-001277001",
    title: "Slovácké noviny",
    type: "Periodical",
    units: ["1936–1938", "1939", "1940"],
    identifiers: [],
    barcodes: {},
  },
  {
    catalogId: "MZK03-000556300",
    title: "Brněnský kalendář",
    type: "Periodical",
    units: ["1901", "1902", "1903"],
    identifiers: [],
    barcodes: {},
  },
  {
    catalogId: "MZK01-001622010",
    title: "Národní listy",
    type: "Periodical",
    units: ["1889", "1890"],
    identifiers: [],
    barcodes: {},
  },
  {
    catalogId: "MZK03-000112877",
    title: "Kniha o Brně",
    type: "Monograph",
    units: null,
    identifiers: [],
    barcodes: { "MZK-2801-000533": null },
  },
  {
    catalogId: "MZK01-001388120",
    title: "Selské noviny",
    type: "Periodical",
    units: ["1907–1911"],
    identifiers: ["cnb001388120"],
    barcodes: {},
  },
  {
    catalogId: "MZK03-000778120",
    title: "Moravské kostely",
    type: "Monograph",
    units: null,
    identifiers: ["978-80-7325-456-3"],
    barcodes: {},
  },
  {
    catalogId: "MZK01-001520331",
    title: "Moravský hospodář",
    type: "Periodical",
    units: ["roč. 1", "roč. 2"],
    identifiers: ["1801-1234"],
    barcodes: {},
  },
  {
    catalogId: "MZK01-001452200",
    title: "Hlas Moravy",
    type: "Periodical",
    units: ["MZK-2801-000341"],
    identifiers: [],
    barcodes: { "MZK-2801-000341": "MZK-2801-000341" },
  },
  {
    catalogId: "MZK01-001555012",
    title: "Brněnský deník",
    type: "Periodical",
    units: ["MZK-2801-000977", "MZK-2801-000412", "MZK-2801-000618"],
    identifiers: [],
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
    barcodes: {},
  },
  {
    catalogId: "NKC01-002345678",
    title: "Zlatá Praha",
    type: "Periodical",
    units: ["roč. 12", "roč. 13"],
    identifiers: [],
    barcodes: {},
  },
];
