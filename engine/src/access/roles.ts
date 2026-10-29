// Role changes keep a person able to manage access (ACCESS-last-manager).
import { endpoints } from "@vera/contract/endpoints";
import { heldRoleIdsOf, holdersOf, managersOf, mappingsOf, roleNameOf } from "@vera/domain/access";
import { hasPermission, isAcceptedGrant, missingRequirementsOf } from "@vera/domain/permissions";
import { rolesOf } from "../access/session";
import type { Engine } from "../engine";
import { implement } from "../http/endpoint";
import { problem } from "../http/problem";
import { accessUser, requireCaller, requireManage } from "./index";

function managerExists(engine: Engine, roles = rolesOf(engine.db)) {
  const users = engine.db
    .query<{ id: string }, []>("SELECT id FROM users ORDER BY rowid")
    .all()
    .map(({ id }) => accessUser(engine, id))
    .filter((x): x is NonNullable<typeof x> => x !== null);
  return managersOf(users, roles).length > 0;
}
function refusalForGrants(grants: { permission: never; scope: never }[]) {
  const permissions = grants.map((g) => g.permission);
  if (new Set(permissions).size !== permissions.length)
    return problem(422, "Each permission is granted once, at one scope");
  const refused = grants.find((g) => !isAcceptedGrant(g));
  if (refused)
    return problem(
      422,
      refused.scope === null
        ? `${refused.permission} needs a scope`
        : `${refused.permission} does not take the scope ${refused.scope}`,
    );
  const missing = missingRequirementsOf(grants)[0];
  return missing
    ? problem(
        422,
        `${missing.grant.permission} needs ${missing.needs.permission}${missing.needs.scope === null ? "" : ` at ${missing.needs.scope}`}`,
        { code: "role.requires" },
      )
    : null;
}
function uniqueId(prefix: string, ids: string[]) {
  const n = Math.max(
    0,
    ...ids
      .filter((x) => x.startsWith(prefix))
      .map((x) => Number(x.slice(prefix.length)))
      .filter(Number.isInteger),
  );
  return `${prefix}${n + 1}`;
}
function taken(engine: Engine, name: string, except?: string) {
  return (
    engine.db.query("SELECT 1 FROM roles WHERE name=? AND id<>? ").get(name, except ?? "") !== null
  );
}
function role(engine: Engine, id: string) {
  return rolesOf(engine.db).find((r) => r.id === id) ?? null;
}

export const roleEndpoints = [
  implement(endpoints.roleCreate, ({ engine, caller, body }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const invalid = refusalForGrants(body.grants as never[]);
    if (invalid) return invalid;
    const name = roleNameOf(body.name);
    if (taken(engine, name))
      return problem(409, `There is already one called ${name}`, { code: "access.name_taken" });
    const roles = rolesOf(engine.db);
    const id = roles.some((r) => r.id === name)
      ? uniqueId(
          `${name}-`,
          roles.map((r) => r.id),
        )
      : name;
    const value = {
      id,
      name,
      description: body.description,
      isShipped: false,
      grants: body.grants,
      proposalBatchLimit: body.proposalBatchLimit,
      proposalDailyLimit: body.proposalDailyLimit,
    };
    engine.db.transaction(() =>
      engine.db
        .query(
          "INSERT INTO roles (id,name,description,is_shipped,grants,proposal_batch_limit,proposal_daily_limit) VALUES (?,?,?,?,?,?,?)",
        )
        .run(
          id,
          name,
          value.description,
          0,
          JSON.stringify(value.grants),
          value.proposalBatchLimit,
          value.proposalDailyLimit,
        ),
    )();
    return { body: value };
  }),
  implement(endpoints.roleSave, ({ engine, caller, params, body }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const old = role(engine, params.id);
    if (!old) return problem(404, "No such role");
    const invalid = refusalForGrants(body.grants as never[]);
    if (invalid) return invalid;
    const name = roleNameOf(body.name);
    if (taken(engine, name, params.id))
      return problem(409, `There is already one called ${name}`, { code: "access.name_taken" });
    const updated = {
      ...old,
      name,
      description: body.description,
      grants: body.grants,
      proposalBatchLimit: body.proposalBatchLimit,
      proposalDailyLimit: body.proposalDailyLimit,
    };
    const next = rolesOf(engine.db).map((r) => (r.id === params.id ? updated : r));
    if (!managerExists(engine, next))
      return problem(409, "Nobody could manage access after this", { code: "access.last_manager" });
    engine.db.transaction(() =>
      engine.db
        .query(
          "UPDATE roles SET name=?,description=?,grants=?,proposal_batch_limit=?,proposal_daily_limit=? WHERE id=?",
        )
        .run(
          name,
          updated.description,
          JSON.stringify(updated.grants),
          updated.proposalBatchLimit,
          updated.proposalDailyLimit,
          params.id,
        ),
    )();
    return { body: updated };
  }),
  implement(endpoints.roleDelete, ({ engine, caller, params }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const old = role(engine, params.id);
    if (!old) return problem(404, "No such role");
    const next = rolesOf(engine.db).filter((r) => r.id !== params.id);
    const users = engine.db
      .query<{ id: string }, []>("SELECT id FROM users ORDER BY rowid")
      .all()
      .map(({ id }) => accessUser(engine, id))
      .filter((u): u is NonNullable<typeof u> => u !== null)
      .map((u) => ({
        ...u,
        handRoleIds: u.handRoleIds.filter((x) => x !== params.id),
        mappedRoles: u.mappedRoles.filter((x) => x.roleId !== params.id),
      }));
    if (managersOf(users, next).length === 0)
      return problem(409, "Nobody could manage access after this", { code: "access.last_manager" });
    engine.db.transaction(() => {
      engine.db.query("DELETE FROM user_hand_roles WHERE role_id=?").run(params.id);
      engine.db.query("DELETE FROM user_mapped_roles WHERE role_id=?").run(params.id);
      engine.db.query("DELETE FROM roles WHERE id=?").run(params.id);
    })();
    return { status: 204, body: undefined };
  }),
  implement(endpoints.roleImpact, ({ engine, caller, params }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    if (!hasPermission(auth.session, "access.read"))
      return problem(403, "You may not read users, groups or roles");
    const target = role(engine, params.id);
    if (!target) return problem(404, "No such role");
    const roles = rolesOf(engine.db).filter((r) => r.id !== params.id);
    const before = engine.db
      .query<{ id: string }, []>("SELECT id FROM users ORDER BY rowid")
      .all()
      .map(({ id }) => accessUser(engine, id))
      .filter((u): u is NonNullable<typeof u> => u !== null);
    const users = before.map((u) => ({
      ...u,
      handRoleIds: u.handRoleIds.filter((x) => x !== params.id),
      mappedRoles: u.mappedRoles.filter((x) => x.roleId !== params.id),
    }));
    const holders = holdersOf(before, params.id);
    const instances = engine.db
      .query<{ id: string; name: string; settings: string; versions: string }, []>(
        "SELECT i.id,i.name,i.settings,p.versions FROM plugin_instances i JOIN plugin_implementations p ON p.id=i.implementation_id WHERE i.is_deleted=0 ORDER BY i.rowid",
      )
      .all()
      .flatMap((row) => {
        const settings = JSON.parse(row.settings ?? "null");
        if (settings?.kind !== "Identity") return [];
        return [
          {
            id: row.id,
            name: row.name,
            userIdClaim: settings.userIdClaim,
            defaultRoleId: settings.defaultRoleId ?? null,
            mappings: settings.mappings ?? [],
            isLocal: JSON.parse(row.versions)[0]?.declares?.loginEntry === "Form",
          },
        ];
      });
    return {
      body: {
        holders: holders.map(({ user }) => ({
          userId: user.id,
          keptRoleIds: heldRoleIdsOf(users.find((u) => u.id === user.id) ?? user),
        })),
        mappings: mappingsOf(instances, params.id),
        leavesNoManager: managersOf(users, roles).length === 0,
      },
    };
  }),
];
