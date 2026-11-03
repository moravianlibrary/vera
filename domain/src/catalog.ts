// What a catalog adapter reads beyond the documents VERA already holds; a record of several
// volumes or issues lists them, and a barcode names one of them.

import type { DocumentType } from "./entities";

export interface CatalogRecord {
  catalogId: string;
  title: string;
  type: DocumentType;
  // Null for a record that is one document; otherwise the units the catalog enumerates.
  units: readonly string[] | null;
  // NBN, ISBN and ISSN that resolve to the record.
  identifiers: readonly string[];
  // Shelf mark to the unit the catalog says it is on, or null when it names no one unit
  // (DOC-units).
  shelfMarks: Readonly<Record<string, string | null>>;
  // Barcode to the unit it is on; a monograph's barcode names the whole record.
  barcodes: Readonly<Record<string, string | null>>;
}
