// The ways in beyond typing, pasting and a file (ACT-ways-in): what enabled plugins offer Propose.

import type { CatalogRecord } from "@vera/domain/catalog";
import type { Document } from "@vera/domain/entities";
import type {
  IdentifierRecogniser,
  IdentifierType,
  IdentifierTypeRule,
} from "@vera/domain/identifiers";
import {
  identifierChecksums,
  identifierTypeSchema,
  identifierTypes,
  normalisationSteps,
} from "@vera/domain/identifiers";
import type { StoredPluginImplementation, StoredPluginInstance } from "@vera/domain/plugin-store";
import type { PluginKind } from "@vera/domain/plugins";
import type { PropertyValues } from "@vera/domain/properties";
import type {
  BarcodeReading,
  CatalogHit,
  PhotoReading,
  ProposalSettings,
  RecordLink,
} from "../proposals";
import type { QueryOutcome } from "./outcome";
import { enabledInstancesOf, implementationOf } from "./plugin-instances";

export interface CatalogBase {
  base: string;
  opacUrl: string;
}
export interface PhotoFake {
  seen: string;
  read: PhotoReading["read"];
  best: string;
  near: string;
}
export interface CatalogReadingFake {
  source: PropertyValues["sources"][number]["source"];
  tier: number;
}
export type WayInRefusal =
  | {
      status: 404;
      code: "proposal.no_photo_reader" | "proposal.no_barcode_reader";
      message: string;
    }
  | { status: 404; message: string }
  | { status: 422; code: "proposal.link_unread"; message: string };
export type WayInOutcome<Value> = QueryOutcome<Value, WayInRefusal>;
export type ProposalPluginInstance = Pick<
  StoredPluginInstance,
  "id" | "name" | "implementationId" | "isEnabled" | "isDeleted" | "settings" | "configuration"
>;
export type ProposalPluginImplementation = Pick<
  StoredPluginImplementation,
  "id" | "name" | "kind" | "versions"
>;
type Instance = ProposalPluginInstance;
type Implementation = ProposalPluginImplementation;
type WaysIn = Omit<ProposalSettings, "maxAtOnce">;

function catalogOf(instance: Instance, catalogs: Readonly<Record<string, CatalogBase>>) {
  return catalogs[instance.configuration.base_url ?? ""] ?? null;
}
// PLG-api-capabilities and PLG-api-mirror: search or sync offers search unless this instance switches it off.
function isSearchable(instance: Instance, implementations: readonly Implementation[]): boolean {
  const operations = implementationOf(implementations, instance)?.versions[0]?.declares.operations;
  return (
    (operations?.includes("search") === true || operations?.includes("sync") === true) &&
    instance.configuration.search !== "off"
  );
}
function hasInput(
  instances: readonly Instance[],
  implementations: readonly Implementation[],
  operation: "readBarcode" | "readPhoto",
) {
  return enabledInstancesOf(implementations, instances, "Input").some((instance) =>
    implementationOf(implementations, instance)?.versions[0]?.declares.operations?.includes(
      operation,
    ),
  );
}

// The identifier types the propose settings carry (DOC-identifiers): each enabled Identifier
// instance in its order, a Pattern instance with its recogniser read from its configuration; then
// every type no instance is enabled for, which is read only when chosen and checked with the
// catalog lookup (DOC-lines).
export function identifierRules(
  instances: readonly Instance[],
  implementations: readonly Implementation[],
): IdentifierTypeRule[] {
  // The names of a type no instance names.
  const typeLabels: Record<IdentifierType, IdentifierTypeRule["labels"]> = {
    catalogId: { en: "Catalog ID", cs: "Systémové číslo" },
    nbn: { en: "NBN", cs: "ČNB" },
    isbn: { en: "ISBN", cs: "ISBN" },
    issn: { en: "ISSN", cs: "ISSN" },
    barcode: { en: "Barcode", cs: "Čárový kód" },
    shelfMark: { en: "Shelf mark", cs: "Signatura" },
  };
  const listOf = (value: string | undefined) =>
    (value ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  const isPattern = (instance: Instance) =>
    implementationOf(implementations, instance)?.name === "Pattern";
  const typeOf = (instance: Instance): IdentifierType | null => {
    const parsed = identifierTypeSchema.safeParse(instance.configuration.type);
    return parsed.success ? parsed.data : null;
  };
  const recogniserOf = (configuration: Readonly<Record<string, string>>): IdentifierRecogniser => {
    const checksum = identifierChecksums.find((each) => each === configuration.checksum);
    return {
      pattern: configuration.pattern ?? "",
      normalisation: normalisationSteps.filter((step) =>
        listOf(configuration.normalisation).includes(step),
      ),
      checksum: checksum ?? null,
    };
  };
  const named = enabledInstancesOf(implementations, instances, "Identifier").flatMap(
    (instance): IdentifierTypeRule[] => {
      const type = typeOf(instance);
      return type === null
        ? []
        : [
            {
              type,
              labels: {
                en: instance.configuration.label_en || typeLabels[type].en,
                cs: instance.configuration.label_cs || typeLabels[type].cs,
              },
              // A check plugin code makes is the catalog lookup's to report.
              recogniser: isPattern(instance) ? recogniserOf(instance.configuration) : null,
            },
          ];
    },
  );
  const unnamed = identifierTypes
    .filter((type) => !named.some((rule) => rule.type === type))
    .map((type): IdentifierTypeRule => ({ type, labels: typeLabels[type], recogniser: null }));
  return [...named, ...unnamed];
}

export function waysInOf(
  instances: readonly Instance[],
  implementations: readonly Implementation[],
  catalogs: Readonly<Record<string, CatalogBase>>,
): WaysIn {
  const enabled = (kind: PluginKind) => enabledInstancesOf(implementations, instances, kind);
  const adapters = enabled("CatalogAdapter").filter(
    (instance) => catalogOf(instance, catalogs) !== null,
  );
  return {
    canDetectTypes: enabled("Identifier").length > 0,
    searchCatalogs: adapters
      .filter((instance) => isSearchable(instance, implementations))
      .map(({ id, name }) => ({ id, name })),
    linkCatalogs: adapters.map((instance) => ({
      id: instance.id,
      name: instance.name,
      opacUrl: catalogOf(instance, catalogs)?.opacUrl ?? null,
    })),
    entrySources: enabled("Input")
      .filter((instance) =>
        implementationOf(implementations, instance)?.versions[0]?.declares.operations?.includes(
          "entry",
        ),
      )
      .map(({ id, name, configuration }) => ({
        id,
        name,
        allowedOrigins: (configuration.allowed_origins ?? "").split(/\s+/).filter(Boolean),
      })),
    canScanWithCamera: hasInput(instances, implementations, "readBarcode"),
    canReadPhotos: hasInput(instances, implementations, "readPhoto"),
    identifierTypes: identifierRules(instances, implementations),
  };
}

// Records whose title or ID holds the query, in the searchable catalogs or the one asked for.
export function searchCatalogs(
  query: string,
  catalogId: string | null,
  instances: readonly Instance[],
  implementations: readonly Implementation[],
  catalogs: Readonly<Record<string, CatalogBase>>,
  records: readonly CatalogRecord[],
): CatalogHit[] {
  const needle = query.trim().toLowerCase();
  const searched = enabledInstancesOf(implementations, instances, "CatalogAdapter")
    .filter((instance) => isSearchable(instance, implementations))
    .filter((instance) => catalogId === null || instance.id === catalogId);
  if (needle === "") return [];
  // A record VERA holds is known twice, from the catalog and from its documents; once is enough.
  const unique = records.filter(
    (record, index, all) =>
      all.findIndex((candidate) => candidate.catalogId === record.catalogId) === index,
  );
  return searched.flatMap((instance) => {
    const base = catalogOf(instance, catalogs)?.base;
    return unique
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
export function readRecordLink(
  link: RecordLink,
  instances: readonly Instance[],
  implementations: readonly Implementation[],
  catalogs: Readonly<Record<string, CatalogBase>>,
): WayInOutcome<{ catalogId: string }> {
  const instance = enabledInstancesOf(implementations, instances, "CatalogAdapter").find(
    (candidate) => candidate.id === link.catalogInstanceId,
  );
  const base = instance === undefined ? undefined : catalogOf(instance, catalogs)?.base;
  if (base === undefined)
    return { refusal: { status: 404, message: "No such catalog to read a link in" } };
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

export function readPhoto(
  instances: readonly Instance[],
  implementations: readonly Implementation[],
  records: readonly CatalogRecord[],
  fake: PhotoFake,
): WayInOutcome<PhotoReading> {
  if (!hasInput(instances, implementations, "readPhoto"))
    return {
      refusal: {
        status: 404,
        code: "proposal.no_photo_reader",
        message: "Nothing reads photos here",
      },
    };
  const best = records.find(({ title }) => title === fake.best);
  const near = records.find(({ title }) => title === fake.near);
  return {
    value: {
      seen: fake.seen,
      read: fake.read,
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
export function barcodeAt(
  records: readonly CatalogRecord[],
  count: number,
  photoSize: number,
  instances: readonly Instance[],
  implementations: readonly Implementation[],
): WayInOutcome<BarcodeReading> {
  if (!hasInput(instances, implementations, "readBarcode"))
    return {
      refusal: {
        status: 404,
        code: "proposal.no_barcode_reader",
        message: "Nothing reads barcodes here",
      },
    };
  if (photoSize === 0) return { value: { code: null } };
  const codes = records.flatMap((record) => Object.keys(record.barcodes));
  return { value: { code: codes[count % codes.length] ?? null } };
}

export function catalogPropertyValuesOf(
  document: Pick<Document, "title" | "type" | "shelfMark">,
  observedAt: string,
  fake: CatalogReadingFake,
): PropertyValues[] {
  const read = (key: string, value: string | null): PropertyValues[] =>
    value === null
      ? []
      : [
          {
            key,
            sources: [{ source: fake.source, tier: fake.tier, value, observedAt, setBy: null }],
          },
        ];
  return [
    ...read("title", document.title),
    ...read("material_type", document.type),
    ...read("shelf_mark", document.shelfMark),
  ];
}
