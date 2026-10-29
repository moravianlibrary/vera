// Users & Groups: the index and shared projections read from the same tables every act writes.

import { accessIndexSchema } from "@vera/contract/access";
import { endpoints } from "@vera/contract/endpoints";
import type { AccessGroup, AccessUser, CustodyRecord, Role } from "@vera/domain/access";
import { hasPermission } from "@vera/domain/permissions";
import { rolesOf, sessionOf } from "../access/session";
import type { Engine } from "../engine";
import { implement } from "../http/endpoint";
import { problem } from "../http/problem";

export function accessUser(engine: Engine, id: string): AccessUser | null {
  const user = engine.db
    .query<
      {
        id: string;
        name: string;
        kind: "person" | "agent";
        email: string | null;
        entry: string | null;
        suspended_at: string | null;
      },
      [string]
    >("SELECT * FROM users WHERE id = ?")
    .get(id);
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    kind: user.kind,
    email: user.email,
    entry: user.entry,
    handRoleIds: engine.db
      .query<{ role_id: string }, [string]>(
        "SELECT role_id FROM user_hand_roles WHERE user_id = ? ORDER BY rowid",
      )
      .all(id)
      .map((x) => x.role_id),
    mappedRoles: engine.db
      .query<{ role_id: string; instance_id: string; claim: string }, [string]>(
        "SELECT role_id, instance_id, claim FROM user_mapped_roles WHERE user_id = ? ORDER BY rowid",
      )
      .all(id)
      .map((x) => ({ roleId: x.role_id, instanceId: x.instance_id, claim: x.claim })),
    groupIds: engine.db
      .query<{ group_id: string }, [string]>(
        "SELECT group_id FROM group_members WHERE user_id = ? ORDER BY rowid",
      )
      .all(id)
      .map((x) => x.group_id),
    identities: engine.db
      .query<{ instance_id: string; external_id: string; last_login_at: string | null }, [string]>(
        "SELECT instance_id, external_id, last_login_at FROM user_identities WHERE user_id = ? ORDER BY rowid",
      )
      .all(id)
      .map((x) => ({
        instanceId: x.instance_id,
        externalId: x.external_id,
        lastLoginAt: x.last_login_at,
      })),
    suspendedAt: user.suspended_at,
  };
}

export function groupsOf(engine: Engine): AccessGroup[] {
  return engine.db
    .query<{ id: string; name: string; description: string }, []>(
      "SELECT * FROM groups ORDER BY rowid",
    )
    .all()
    .map((g) => ({
      ...g,
      memberIds: engine.db
        .query<{ user_id: string }, [string]>(
          "SELECT user_id FROM group_members WHERE group_id = ? ORDER BY rowid",
        )
        .all(g.id)
        .map((x) => x.user_id),
      categoryIds: engine.db
        .query<{ category_id: string }, [string]>(
          "SELECT category_id FROM group_categories WHERE group_id = ? ORDER BY rowid",
        )
        .all(g.id)
        .map((x) => x.category_id),
    }));
}

export function custodiesOf(engine: Engine): CustodyRecord[] {
  return engine.db
    .query<{ id: string; name: string; description: string; is_fallback: number }, []>(
      "SELECT * FROM request_custodies ORDER BY is_fallback DESC, rowid",
    )
    .all()
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      isFallback: c.is_fallback === 1,
      memberIds: engine.db
        .query<{ user_id: string }, [string]>(
          "SELECT user_id FROM request_custody_members WHERE custody_id = ? ORDER BY rowid",
        )
        .all(c.id)
        .map((x) => x.user_id),
      groupIds: engine.db
        .query<{ group_id: string }, [string]>(
          "SELECT group_id FROM request_custody_groups WHERE custody_id = ? ORDER BY rowid",
        )
        .all(c.id)
        .map((x) => x.group_id),
      // Step 3 owns proposal placement counts.
      openCount: 0,
      // Step 3 owns rule placement references.
      placedByIds: [],
    }));
}

export function requireCaller(engine: Engine, userId: string | null) {
  if (userId === null)
    return { ok: false as const, response: problem(401, "Nobody is signed in.") };
  const session = sessionOf(engine.db, userId);
  return session === null
    ? { ok: false as const, response: problem(401, "Nobody is signed in.") }
    : { ok: true as const, session };
}

export function requireManage(engine: Engine, userId: string | null) {
  const result = requireCaller(engine, userId);
  if (!result.ok) return result;
  return hasPermission(result.session, "access.manage")
    ? result
    : { ok: false as const, response: problem(403, "You may not change users, groups or roles") };
}

export const accessIndexEndpoint = implement(endpoints.accessIndex, ({ engine, caller }) => {
  const auth = requireCaller(engine, caller?.userId ?? null);
  if (!auth.ok) return auth.response;
  if (!hasPermission(auth.session, "access.read"))
    return problem(403, "You may not read users, groups or roles");
  const users = engine.db
    .query<{ id: string }, []>("SELECT id FROM users ORDER BY rowid")
    .all()
    .flatMap((x) => {
      const u = accessUser(engine, x.id);
      return u ? [u] : [];
    });
  const roles: Role[] = rolesOf(engine.db);
  const groupRecords = groupsOf(engine);
  const custodies = custodiesOf(engine);
  const identityInstances = engine.db
    .query<
      { id: string; name: string; implementation_id: string; settings: string; versions: string },
      []
    >(
      "SELECT i.id,i.name,i.implementation_id,i.settings,p.versions FROM plugin_instances i JOIN plugin_implementations p ON p.id=i.implementation_id WHERE i.is_deleted=0 ORDER BY i.rowid",
    )
    .all()
    .flatMap((i) => {
      const settings = JSON.parse(i.settings ?? "null");
      if (settings?.kind !== "Identity") return [];
      const entry = JSON.parse(i.versions)[0]?.declares?.loginEntry;
      return [
        {
          id: i.id,
          name: i.name,
          userIdClaim: settings.userIdClaim,
          defaultRoleId: settings.defaultRoleId ?? null,
          mappings: settings.mappings ?? [],
          isLocal: entry === "Form",
        },
      ];
    });
  const categoryMemberships = engine.db
    .query<{ id: string }, []>(
      "SELECT c.id FROM categories c WHERE EXISTS (SELECT 1 FROM category_members cm WHERE cm.category_id=c.id) ORDER BY c.rowid",
    )
    .all()
    .map((c) => ({
      categoryId: c.id,
      userIds: engine.db
        .query<{ user_id: string }, [string]>(
          "SELECT user_id FROM category_members WHERE category_id=? ORDER BY rowid",
        )
        .all(c.id)
        .map((x) => x.user_id),
    }));
  const categories = engine.db
    .query<{ id: string; name: string; parent_id: string | null }, []>(
      "SELECT * FROM categories ORDER BY rowid",
    )
    .all()
    .map((c) => ({ id: c.id, name: c.name, parentId: c.parent_id }));
  const result = {
    asOf: engine.clock.now().toISOString(),
    users,
    roles,
    groups: groupRecords,
    custodies,
    identityInstances,
    categoryMemberships,
    categories,
    // Step 3 owns proposal rows and placement answers.
    proposals: [],
    // Step 4 owns project membership.
    projects: [],
    // Step 7 owns shared watchlists.
    sharedWatchlists: [],
    // Step 6 owns property definitions.
    properties: [],
  };
  return { body: accessIndexSchema.parse(result) };
});
