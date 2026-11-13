import type { ProposalPlugins, RegistryAnswer } from "@vera/contract/queries/proposals";
import type { RequestPlugins } from "@vera/contract/queries/requests";
import { baseIdOf } from "@vera/contract/queries/requests";
import {
  catalogPropertyValuesOf,
  type ProposalPluginImplementation,
  type ProposalPluginInstance,
  waysInOf,
} from "@vera/contract/queries/ways-in";
import type { CatalogRecord } from "@vera/domain/catalog";
import { leafCategoriesOf } from "@vera/domain/categories";
import type { StoredPluginImplementation, StoredPluginInstance } from "@vera/domain/plugin-store";
import type { Engine } from "../engine";

const fake = <T>(engine: Engine, key: string, fallback: T): T => {
  const value = engine.db
    .query<{ value: string }, [string]>("SELECT value FROM seed_fakes WHERE key=?")
    .get(key)?.value;
  return value === undefined ? fallback : (JSON.parse(value) as T);
};

export function engineProposalPlugins(engine: Engine): ProposalPlugins {
  return engineProposalContext(engine).plugins;
}

export function engineProposalContext(engine: Engine) {
  const records = fake<CatalogRecord[]>(engine, "catalogRecords", []);
  const registryAnswers = fake<Record<string, RegistryAnswer[]>>(engine, "registryAnswers", {});
  const catalogReading = fake<import("@vera/contract/queries/ways-in").CatalogReadingFake>(
    engine,
    "catalogReading",
    { source: { kind: "plugin", instanceId: "", instanceName: "" }, tier: 50 },
  );
  const { implementations, instances, catalogs } = enginePluginTables(engine);
  const plugins: ProposalPlugins = {
    catalogRecords: () => records,
    registryLookup: (record, unit) => registryAnswers[`${record.catalogId}|${unit ?? ""}`] ?? [],
    catalogPropertyValuesOf: (read, at) => catalogPropertyValuesOf(read, at, catalogReading),
    waysIn: () => waysInOf(instances, implementations, catalogs),
  };
  const photo = fake<import("@vera/contract/queries/ways-in").PhotoFake>(engine, "photo", {
    seen: "",
    read: [],
    best: "",
    near: "",
  });
  return { plugins, tables: { implementations, instances, catalogs }, records, photo };
}

export function enginePluginTables(engine: Engine) {
  // Tables omit descriptorId and description on implementations, and version, linkedCategoryId,
  // triggers, createdBy, createdAt, lastRunAt, policy, and isPredefined on instances. The shared
  // queries read only the projected fields below, so no substitute values are needed.
  const implementations: ProposalPluginImplementation[] = engine.db
    .query<{ id: string; name: string; kind: string; versions: string }, []>(
      "SELECT id,name,kind,versions FROM plugin_implementations ORDER BY rowid",
    )
    .all()
    .map((row) => ({
      ...row,
      kind: row.kind as StoredPluginImplementation["kind"],
      versions: JSON.parse(row.versions) as StoredPluginImplementation["versions"],
    }));
  const instances: ProposalPluginInstance[] = engine.db
    .query<
      {
        id: string;
        name: string;
        implementation_id: string;
        configuration: string;
        settings: string | null;
        is_enabled: number;
        is_deleted: number;
      },
      []
    >(
      "SELECT id,name,implementation_id,configuration,settings,is_enabled,is_deleted FROM plugin_instances ORDER BY rowid",
    )
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      implementationId: row.implementation_id,
      configuration: JSON.parse(row.configuration) as Record<string, string>,
      settings: JSON.parse(row.settings ?? "null") as StoredPluginInstance["settings"],
      isEnabled: row.is_enabled === 1,
      isDeleted: row.is_deleted === 1,
    }));
  const catalogs = fake<Record<string, import("@vera/contract/queries/ways-in").CatalogBase>>(
    engine,
    "catalogBases",
    {},
  );
  return { implementations, instances, catalogs };
}

export function engineRequestPlugins(engine: Engine): RequestPlugins {
  const placements = fake<Record<string, string[]>>(engine, "custodyPlacements", {});
  const rules = fake<{ custodyId: string; documentType?: string; projectId?: string }[]>(
    engine,
    "custodyRules",
    [],
  );
  const material = fake<Record<string, { categoryId: string; reason: string }>>(
    engine,
    "materialLeaves",
    {},
  );
  const places = fake<string[]>(engine, "moravianPlaces", []);
  const leaves = new Set(
    leafCategoriesOf(
      engine.db
        .query<{ id: string; name: string; names: string; parent_id: string | null }, []>(
          "SELECT * FROM categories ORDER BY rowid",
        )
        .all()
        .map((c) => ({
          id: c.id,
          name: c.name,
          names: JSON.parse(c.names),
          parentId: c.parent_id,
        })),
    ).map((c) => c.id),
  );
  const instances = engine.db
    .query<{ id: string; name: string; implementation: string; settings: string | null }, []>(
      "SELECT i.id,i.name,p.name AS implementation,i.settings FROM plugin_instances i JOIN plugin_implementations p ON p.id=i.implementation_id WHERE i.is_enabled=1 AND i.is_deleted=0 AND p.kind='Classifier' ORDER BY i.rowid",
    )
    .all()
    .toSorted((first, second) => {
      const order = (settings: string | null) => {
        const value = JSON.parse(settings ?? "null")?.order;
        return typeof value === "number" ? value : 0;
      };
      return order(first.settings) - order(second.settings);
    });
  return {
    placementsOf(request, document) {
      const base = baseIdOf(request.id);
      if (placements[base] !== undefined) return placements[base];
      return rules
        .filter(
          (rule) =>
            (rule.documentType === undefined || rule.documentType === document.type) &&
            (rule.projectId === undefined || rule.projectId === request.projectId),
        )
        .map((rule) => rule.custodyId);
    },
    suggestionFor(ask, document) {
      if (ask.checkedAt === null) return null;
      for (const instance of instances) {
        const answer =
          instance.implementation === "PlaceOfPublication" &&
          document.type === "Periodical" &&
          places.some((place) => document.title.toLocaleLowerCase("cs").includes(place))
            ? { categoryId: "c21", reason: "Periodical, Moravian place of publication" }
            : instance.implementation === "MaterialType"
              ? (material[document.type] ?? null)
              : null;
        if (answer && leaves.has(answer.categoryId))
          return { ...answer, classifier: { id: instance.id, name: instance.name } };
      }
      return null;
    },
  };
}
