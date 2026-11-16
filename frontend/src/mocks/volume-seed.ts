// The mock and backend apply seed extensions with the same keyed merge rules.
import { extendSeed } from "@vera/contract/seed-extends";
import { database } from "@/mocks/database";

type SeedRecord = Record<string, unknown>;

export function applyVolumeSeed(raw: SeedRecord): void {
  const merged = extendSeed({ collections: database as unknown as SeedRecord }, raw) as {
    collections: SeedRecord;
    fakes?: SeedRecord;
  };
  const collectionKeys = [
    "users",
    "userAccess",
    "categories",
    "documents",
    "iterations",
    "requests",
    "batches",
    "requestCustodies",
  ] as const;
  for (const key of collectionKeys) {
    const value = merged.collections[key];
    if (value !== undefined) Object.assign(database, { [key]: value });
  }
  const catalogRecords = merged.fakes?.catalogRecords;
  if (Array.isArray(catalogRecords)) {
    database.volumeCatalogRecords = catalogRecords as typeof database.volumeCatalogRecords;
  }
  console.info("Loaded volume seed", {
    documents: database.documents.length,
    iterations: database.iterations.length,
    requests: database.requests.length,
    catalogRecords: database.volumeCatalogRecords.length,
  });
}

export async function loadVolumeSeed(): Promise<void> {
  const response = await fetch("/seeds/volume.json");
  if (!response.ok) throw new Error(`Could not load volume seed (${response.status}).`);
  applyVolumeSeed((await response.json()) as SeedRecord);
}
