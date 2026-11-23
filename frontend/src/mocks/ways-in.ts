// The ways in beyond typing, pasting and a file (ACT-ways-in): what the enabled plugins offer the
// propose dialog, searching the catalogs that can be searched, reading a record link in one that
// cannot, reading a photo, and reading the barcode on one. A hardware scanner needs no plugin; it
// types like a keyboard.

import type {
  BarcodeReading,
  CatalogHit,
  PhotoReading,
  ProposalSettings,
  RecordLink,
} from "@vera/contract/proposals";
import {
  barcodeAt,
  readPhoto as readPhotoShared,
  readRecordLink as readRecordLinkShared,
  searchCatalogs as searchCatalogsShared,
  waysInOf as waysInOfShared,
} from "@vera/contract/queries/ways-in";
import { database } from "@/mocks/database";
import { catalogRecords, wayInCatalogs } from "@/mocks/fixtures/catalog";
import { photoFake } from "@/mocks/fixtures/ways-in";
import type { Outcome } from "@/mocks/mutations";

type WaysIn = Omit<ProposalSettings, "maxAtOnce">;
function records() {
  return [...catalogRecords, ...database.volumeCatalogRecords];
}

export function waysInOf(): WaysIn {
  return waysInOfShared(database.pluginInstances, database.pluginImplementations, wayInCatalogs);
}

// Records whose title or ID holds the query, in the searchable catalogs or the one asked for.
export function searchCatalogs(query: string, catalogId: string | null): CatalogHit[] {
  return searchCatalogsShared(
    query,
    catalogId,
    database.pluginInstances,
    database.pluginImplementations,
    wayInCatalogs,
    records(),
  );
}

// A record's own ID, or its page's address: `…?doc_number=002345678&base=NKC01`, or
// `…/Record/NKC01-002345678`.
export function readRecordLink(link: RecordLink): Outcome<{ catalogId: string }> {
  return readRecordLinkShared(
    link,
    database.pluginInstances,
    database.pluginImplementations,
    wayInCatalogs,
  );
}

// What the photo Input reads, whatever the photo: a 1932 catalog card with no identifier on it,
// matched by its text.
export function readPhoto(readerId: string | null): Outcome<PhotoReading> {
  return readPhotoShared(
    database.pluginInstances,
    database.pluginImplementations,
    records(),
    photoFake,
    readerId,
  );
}

// The barcodes the catalog knows, each photo reading the next; an empty photo reads none.
let photographedCount = 0;
export function readBarcode(photo: File): Outcome<BarcodeReading> {
  const result = barcodeAt(
    records(),
    photographedCount,
    photo.size,
    database.pluginInstances,
    database.pluginImplementations,
  );
  if (photo.size !== 0 && result && "value" in result) photographedCount += 1;
  return result;
}
