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
} from "@/api/proposals";
import type { InputMode } from "@/domain/plugins";
import { knownCatalogRecords } from "@/mocks/catalog";
import type { StoredPluginInstance } from "@/mocks/fixtures/plugins";
import type { Outcome } from "@/mocks/mutations";
import { enabledInstancesOf, implementationOf } from "@/mocks/plugin-instances";

type WaysIn = Omit<ProposalSettings, "maxAtOnce">;

// The catalog each Aleph the mock knows stands for: the base its record IDs start with, and where
// a person finds a record in it.
const catalogs: Readonly<Record<string, { base: string; opacUrl: string }>> = {
  "aleph.mzk.cz": { base: "MZK", opacUrl: "https://vufind.mzk.cz" },
  "aleph.vkol.cz": { base: "VKOL", opacUrl: "https://aleph.vkol.cz" },
  "aleph.nkp.cz": { base: "NKC", opacUrl: "https://aleph.nkp.cz" },
};

function catalogOf(instance: StoredPluginInstance) {
  return catalogs[instance.configuration.base_url ?? ""] ?? null;
}

// A catalog adapter searches unless its configuration says not to.
function isSearchable(instance: StoredPluginInstance): boolean {
  return instance.configuration.search !== "off";
}

function hasInput(mode: InputMode): boolean {
  return enabledInstancesOf("Input").some(
    (instance) => implementationOf(instance)?.versions[0]?.declares.inputMode === mode,
  );
}

export function waysInOf(): WaysIn {
  const adapters = enabledInstancesOf("CatalogAdapter").filter(
    (instance) => catalogOf(instance) !== null,
  );
  return {
    canDetectTypes: hasInput("Text"),
    searchCatalogs: adapters.filter(isSearchable).map(({ id, name }) => ({ id, name })),
    linkCatalogs: adapters
      .filter((instance) => !isSearchable(instance))
      .map((instance) => ({
        id: instance.id,
        name: instance.name,
        opacUrl: catalogOf(instance)?.opacUrl ?? null,
      })),
    canScanWithCamera: hasInput("Camera"),
    canReadPhotos: hasInput("Photo"),
  };
}

// Records whose title or ID holds the query, in the searchable catalogs or the one asked for.
export function searchCatalogs(query: string, catalogId: string | null): CatalogHit[] {
  const needle = query.trim().toLowerCase();
  const searched = enabledInstancesOf("CatalogAdapter")
    .filter(isSearchable)
    .filter((instance) => catalogId === null || instance.id === catalogId);
  if (needle === "") {
    return [];
  }

  // A record VERA holds is known twice, from the catalog and from its documents; once is enough.
  const records = knownCatalogRecords().filter(
    (record, index, all) =>
      all.findIndex((candidate) => candidate.catalogId === record.catalogId) === index,
  );
  return searched.flatMap((instance) => {
    const base = catalogOf(instance)?.base;
    return records
      .filter(
        (record) =>
          base !== undefined &&
          record.catalogId.startsWith(base) &&
          (record.title.toLowerCase().includes(needle) ||
            record.catalogId.toLowerCase().includes(needle)),
      )
      .map((record) => ({
        catalogId: record.catalogId,
        title: record.title,
        units: [...(record.units ?? [])],
        catalog: { id: instance.id, name: instance.name },
      }));
  });
}

// A record's own ID, or its page's address: `…?doc_number=002345678&base=NKC01`, or
// `…/Record/NKC01-002345678`.
export function readRecordLink(link: RecordLink): Outcome<{ catalogId: string }> {
  const instance = enabledInstancesOf("CatalogAdapter").find(
    (candidate) => candidate.id === link.catalogInstanceId && !isSearchable(candidate),
  );
  const base = instance === undefined ? undefined : catalogOf(instance)?.base;
  if (base === undefined) {
    return { refusal: { status: 404, message: "No such catalog to read a link in" } };
  }

  const text = link.link.trim();
  const whole = text.match(new RegExp(`${base}\\d{2}-\\d{9}`))?.[0];
  const number = text.match(/doc_number=(\d{9})/)?.[1];
  const library = text.match(new RegExp(`base=(${base}\\d{2})`))?.[1] ?? `${base}01`;
  const catalogId = whole ?? (number === undefined ? undefined : `${library}-${number}`);
  return catalogId === undefined
    ? {
        refusal: {
          status: 422,
          code: "proposal.link_unread",
          message: `${instance?.name ?? "The catalog"} reads no record in that`,
        },
      }
    : { value: { catalogId } };
}

// What the photo Input reads, whatever the photo: a 1932 catalog card with no identifier on it,
// matched by its text.
export function readPhoto(): Outcome<PhotoReading> {
  if (!hasInput("Photo")) {
    return { refusal: { status: 404, message: "Nothing reads photos here" } };
  }

  const records = knownCatalogRecords();
  const titled = (title: string) => records.find((record) => record.title === title);
  const best = titled("Moravské kostely");
  const near = titled("Kniha o Brně");
  return {
    value: {
      seen: "a catalog card",
      read: [
        { label: "Author", value: "Kratochvíl, Josef", confidence: 0.94 },
        { label: "Title", value: "Moravské kostely", confidence: 0.97 },
        { label: "Published", value: "Brno : Moravský kraj, 1932", confidence: 0.71 },
        { label: "Shelf mark", value: "MB2-0433", confidence: 0.62 },
      ],
      hasIdentifiers: false,
      candidates: [
        ...(best === undefined
          ? []
          : [{ catalogId: best.catalogId, title: best.title, why: "title and author match" }]),
        ...(near === undefined
          ? []
          : [
              {
                catalogId: near.catalogId,
                title: near.title,
                why: "bound with it: the same shelf",
              },
            ]),
      ],
    },
  };
}

// The barcodes the catalog knows, each photo reading the next; an empty photo reads none.
let photographedCount = 0;

export function readBarcode(photo: File): Outcome<BarcodeReading> {
  if (!hasInput("Camera")) {
    return { refusal: { status: 404, message: "Nothing reads barcodes here" } };
  }

  if (photo.size === 0) {
    return { value: { code: null } };
  }

  const codes = knownCatalogRecords().flatMap((record) => Object.keys(record.barcodes));
  const code = codes[photographedCount % codes.length] ?? null;
  photographedCount += 1;
  return { value: { code } };
}
