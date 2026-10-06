// The mock catalog: the records it knows beyond VERA (fixtures/catalog.ts), and every document
// VERA already holds, which answers for its own catalog ID, units and barcodes. Proposing checks
// an identifier against it.

import type { Document } from "@/domain/entities";
import { database } from "@/mocks/database";
import type { CatalogRecord } from "@/mocks/fixtures/catalog";
import { catalogRecords } from "@/mocks/fixtures/catalog";

export function knownCatalogRecords(): CatalogRecord[] {
  return [...catalogRecords, ...heldCatalogRecords()];
}

// The document VERA holds for a catalog ID and unit, which together are unique
// (document-identity.md).
export function findDocumentByIdentity(catalogId: string, unit: string | null): Document | null {
  return (
    database.documents.find(
      (document) => document.catalogId === catalogId && (document.unit?.value ?? null) === unit,
    ) ?? null
  );
}

// What kind of unit a value is, by its shape: a barcode and a volume number are recognisable, a
// volume name is anything else (document-identity.md, Unit ID forms).
export function unitTypeOf(unit: string): NonNullable<Document["unit"]>["type"] {
  if (/^MZK-\d{4}-\d{6}$/.test(unit)) {
    return "barcode";
  }

  return /^(roč\.|sv\.|vol\.)\s*\d+/.test(unit) ? "volume-number" : "volume-name";
}

function heldCatalogRecords(): CatalogRecord[] {
  const byCatalogId = new Map<string, Document[]>();
  for (const document of database.documents) {
    byCatalogId.set(document.catalogId, [...(byCatalogId.get(document.catalogId) ?? []), document]);
  }

  return [...byCatalogId].map(([catalogId, documents]) => {
    const units = documents.flatMap((document) =>
      document.unit === null ? [] : [document.unit.value],
    );
    const barcodes = documents.flatMap((document) =>
      document.unit?.type === "barcode" ? [[document.unit.value, document.unit.value]] : [],
    );
    const [first] = documents;
    return {
      catalogId,
      title: first?.title ?? catalogId,
      type: first?.type ?? "Monograph",
      units: units.length === 0 ? null : units,
      identifiers: [],
      barcodes: Object.fromEntries(barcodes),
    };
  });
}
