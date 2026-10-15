// The mock catalog: the records it knows beyond VERA (fixtures/catalog.ts), and every document
// VERA already holds, which answers for its own catalog ID, units and barcodes. Proposing checks
// an identifier against it; a recheck reads what has been repaired in it.

import type { Document } from "@/domain/entities";
import { database } from "@/mocks/database";
import type { CatalogRecord } from "@/mocks/fixtures/catalog";
import { catalogAdapter, catalogRecords, catalogRepairs } from "@/mocks/fixtures/catalog";

// Where the record opens in the library's catalog, for a curator to repair it there: the catalog
// adapter's toLink (plugins.md §4.1), null when it gives none.
export function catalogLinkOf(catalogId: string): string | null {
  return catalogAdapter.toLink?.(catalogId) ?? null;
}

// The subjects a recheck of the record no longer finds a defect on.
export function repairedSubjectsOf(catalogId: string): readonly string[] {
  return catalogRepairs[catalogId] ?? [];
}

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
    // A shelf mark on one unit names it; one shared by several units names none (DOC-units).
    const shelfMarks = new Map<string, string | null>();
    for (const document of documents) {
      if (document.shelfMark !== null) {
        const unit = document.unit?.value ?? null;
        shelfMarks.set(document.shelfMark, shelfMarks.has(document.shelfMark) ? null : unit);
      }
    }
    const [first] = documents;
    return {
      catalogId,
      title: first?.title ?? catalogId,
      type: first?.type ?? "Monograph",
      units: units.length === 0 ? null : units,
      identifiers: [],
      shelfMarks: Object.fromEntries(shelfMarks),
      barcodes: Object.fromEntries(barcodes),
    };
  });
}
