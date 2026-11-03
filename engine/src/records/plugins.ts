import type { RequestPlugins } from "@vera/contract/queries/requests";
import { baseIdOf } from "@vera/contract/queries/requests";
import { leafCategoriesOf } from "@vera/domain/categories";
import type { Engine } from "../engine";

const fake = <T>(engine: Engine, key: string, fallback: T): T => {
  const value = engine.db
    .query<{ value: string }, [string]>("SELECT value FROM seed_fakes WHERE key=?")
    .get(key)?.value;
  return value === undefined ? fallback : (JSON.parse(value) as T);
};

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
        .query<{ id: string; name: string; parent_id: string | null }, []>(
          "SELECT * FROM categories ORDER BY rowid",
        )
        .all()
        .map((c) => ({ id: c.id, name: c.name, parentId: c.parent_id })),
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
