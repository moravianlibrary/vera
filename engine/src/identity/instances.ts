import type { Engine } from "../engine";
import type { IdentityInstance } from "./plugin";

export function identityInstances(engine: Engine): IdentityInstance[] {
  return engine.db
    .query<
      {
        id: string;
        implementation_id: string;
        configuration: string;
        settings: string;
        versions: string;
      },
      []
    >(
      `SELECT i.id, i.implementation_id, i.configuration, i.settings, p.versions
     FROM plugin_instances i JOIN plugin_implementations p ON p.id = i.implementation_id
     WHERE i.is_enabled = 1 AND i.is_deleted = 0 ORDER BY i.rowid`,
    )
    .all()
    .flatMap((row) => {
      const raw = JSON.parse(row.settings ?? "null");
      if (raw?.kind !== "Identity") return [];
      const declares = JSON.parse(row.versions)[0]?.declares;
      return [
        {
          id: row.id,
          implementationId: row.implementation_id,
          entry: declares?.loginEntry === "Form" ? ("form" as const) : ("redirect" as const),
          configuration: JSON.parse(row.configuration),
          settings: {
            label: raw.label,
            order: raw.order,
            userIdClaim: raw.userIdClaim,
            defaultRoleId: raw.defaultRoleId ?? null,
            matchByEmail: raw.matchByEmail ?? false,
            mappings: raw.mappings ?? [],
          },
        },
      ];
    })
    .sort((a, b) => a.settings.order - b.settings.order);
}

export function identityInstance(engine: Engine, id: string): IdentityInstance | null {
  return identityInstances(engine).find((instance) => instance.id === id) ?? null;
}
