// People, identities and role holdings are changed together so the access index stays coherent.
import { endpoints } from "@vera/contract/endpoints";
import { managersOf } from "@vera/domain/access";
import type { Engine } from "../engine";
import { actorOf, configurationOf, newCorrelationId, recordEvent } from "../events";
import { implement } from "../http/endpoint";
import { problem } from "../http/problem";
import { accessUser, groupsOf, identityInstancesOf, requireManage } from "./index";
import { rolesOf } from "./session";

export function nextUserId(engine: Engine) {
  const ids = engine.db
    .query<{ id: string }, []>("SELECT id FROM users")
    .all()
    .map((x) => x.id);
  return `u${Math.max(0, ...ids.map((x) => Number(x.slice(1))).filter(Number.isInteger)) + 1}`;
}
function manageUsers(engine: Engine) {
  return engine.db
    .query<{ id: string }, []>("SELECT id FROM users")
    .all()
    .map((x) => accessUser(engine, x.id))
    .filter((x): x is NonNullable<typeof x> => x !== null);
}
const unknown = (what: string) => problem(404, `No such ${what}`);

export const userEndpoints = [
  implement(endpoints.identityDefaultRole, ({ engine, caller, params, body }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const row = engine.db
      .query<{ id: string; settings: string }, [string]>(
        "SELECT i.id,i.settings FROM plugin_instances i JOIN plugin_implementations p ON p.id=i.implementation_id WHERE i.id=? AND i.is_deleted=0 AND i.is_enabled=1 AND p.kind='Identity'",
      )
      .get(params.id);
    if (!row) return unknown("Identity instance");
    if (body.roleId !== null && !rolesOf(engine.db).some((role) => role.id === body.roleId))
      return problem(422, "Choose an existing role", { code: "role.not_found" });
    const settings = JSON.parse(row.settings ?? "null");
    const oldSettings = settings;
    engine.db.transaction(() => {
      engine.db
        .query("UPDATE plugin_instances SET settings=? WHERE id=?")
        .run(JSON.stringify({ ...settings, defaultRoleId: body.roleId }), params.id);
      if (settings.defaultRoleId !== body.roleId)
        recordEvent(engine, {
          code: "plugin_instance.default_role_changed",
          subjectKind: "plugin_instance",
          subjectId: params.id,
          actor: actorOf(caller),
          correlationId: newCorrelationId(),
          data: configurationOf([
            { field: "defaultRoleId", from: oldSettings.defaultRoleId ?? null, to: body.roleId },
          ]),
        });
    })();
    const identityInstance = identityInstancesOf(engine).find(
      (instance) => instance.id === params.id,
    );
    return identityInstance ? { body: identityInstance } : unknown("Identity instance");
  }),
  implement(endpoints.localAccount, ({ engine, caller, body }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const local = engine.db
      .query<{ id: string }, []>(
        "SELECT i.id FROM plugin_instances i JOIN plugin_implementations p ON p.id=i.implementation_id WHERE p.kind='Identity' AND p.name='LocalAccounts' AND i.is_enabled=1 AND i.is_deleted=0 ORDER BY i.rowid",
      )
      .get();
    if (!local)
      return problem(422, "Local accounts are switched off", {
        code: "access.local_accounts_off",
      });
    if (
      engine.db
        .query("SELECT 1 FROM user_identities WHERE instance_id=? AND external_id=?")
        .get(local.id, body.username)
    )
      return problem(409, `${body.username} is taken`, { code: "access.identity_taken" });
    const roles = rolesOf(engine.db);
    if (body.roleIds.some((id) => !roles.some((role) => role.id === id))) return unknown("role");
    const id = nextUserId(engine);
    engine.db.transaction(() => {
      engine.db
        .query(
          "INSERT INTO users (id,name,kind,email,entry,suspended_at) VALUES (?,?, 'person', ?,NULL,NULL)",
        )
        .run(id, body.name, body.email || null);
      for (const roleId of [...new Set(body.roleIds)])
        engine.db
          .query("INSERT INTO user_hand_roles (user_id,role_id) VALUES (?,?)")
          .run(id, roleId);
      engine.db
        .query(
          "INSERT INTO user_identities (user_id,instance_id,external_id,last_login_at) VALUES (?,?,?,NULL)",
        )
        .run(id, local.id, body.username);
      recordEvent(engine, {
        code: "user.created",
        subjectKind: "user",
        subjectId: id,
        actor: actorOf(caller),
        correlationId: newCorrelationId(),
        data: configurationOf([
          { field: "how", from: null, to: "local_account" },
          { field: "roleIds", from: [], to: [...new Set(body.roleIds)] },
          { field: "instanceId", from: null, to: local.id },
        ]),
      });
    })();
    return { body: accessUser(engine, id) };
  }),
  implement(endpoints.userRoles, ({ engine, caller, params, body }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    if (!accessUser(engine, params.id)) return unknown("user");
    const roles = rolesOf(engine.db);
    if (body.roleIds.some((id) => !roles.some((role) => role.id === id))) return unknown("role");
    const changed = [...new Set(body.roleIds)];
    const before = accessUser(engine, params.id);
    if (!before) return unknown("user");
    const candidate = manageUsers(engine).map((u) =>
      u.id === params.id ? { ...u, handRoleIds: changed } : u,
    );
    if (managersOf(candidate, roles).length === 0)
      return problem(409, "Nobody could manage access after this", { code: "access.last_manager" });
    engine.db.transaction(() => {
      engine.db.query("DELETE FROM user_hand_roles WHERE user_id=?").run(params.id);
      for (const roleId of changed)
        engine.db
          .query("INSERT INTO user_hand_roles (user_id,role_id) VALUES (?,?)")
          .run(params.id, roleId);
      if (JSON.stringify([...before.handRoleIds].sort()) !== JSON.stringify([...changed].sort()))
        recordEvent(engine, {
          code: "user.roles_changed",
          subjectKind: "user",
          subjectId: params.id,
          actor: actorOf(caller),
          correlationId: newCorrelationId(),
          data: configurationOf([{ field: "handRoleIds", from: before.handRoleIds, to: changed }]),
        });
    })();
    return { body: accessUser(engine, params.id) };
  }),
  implement(endpoints.userGroups, ({ engine, caller, params, body }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    if (!accessUser(engine, params.id)) return unknown("user");
    const groups = groupsOf(engine);
    if (body.groupIds.some((id) => !groups.some((g) => g.id === id))) return unknown("group");
    const wanted = [...new Set(body.groupIds)];
    const before = accessUser(engine, params.id);
    if (!before) return unknown("user");
    engine.db.transaction(() => {
      engine.db.query("DELETE FROM group_members WHERE user_id=?").run(params.id);
      for (const groupId of wanted)
        engine.db
          .query("INSERT INTO group_members (group_id,user_id) VALUES (?,?)")
          .run(groupId, params.id);
      if (JSON.stringify([...before.groupIds].sort()) !== JSON.stringify([...wanted].sort()))
        recordEvent(engine, {
          code: "user.groups_changed",
          subjectKind: "user",
          subjectId: params.id,
          actor: actorOf(caller),
          correlationId: newCorrelationId(),
          data: configurationOf([{ field: "groupIds", from: before.groupIds, to: wanted }]),
        });
    })();
    return { body: accessUser(engine, params.id) };
  }),
  implement(endpoints.identityLink, ({ engine, caller, params, body }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const user = accessUser(engine, params.id);
    if (!user) return unknown("user");
    if (user.kind === "agent")
      return problem(422, "An agent never logs in", { code: "access.agent_no_login" });
    const instance = engine.db
      .query<{ id: string; name: string; settings: string }, [string]>(
        "SELECT i.id,i.name,i.settings FROM plugin_instances i JOIN plugin_implementations p ON p.id=i.implementation_id WHERE i.id=? AND i.is_deleted=0 AND p.kind='Identity'",
      )
      .get(body.instanceId);
    if (!instance) return unknown("identity provider");
    const holder = engine.db
      .query<{ user_id: string }, [string, string]>(
        "SELECT user_id FROM user_identities WHERE instance_id=? AND external_id=?",
      )
      .get(body.instanceId, body.externalId);
    if (holder)
      return problem(
        409,
        `${instance.name} ${body.externalId} is already ${accessUser(engine, holder.user_id)?.name ?? holder.user_id}`,
        { code: "access.identity_taken" },
      );
    engine.db.transaction(() => {
      engine.db
        .query(
          "INSERT INTO user_identities (user_id,instance_id,external_id,last_login_at) VALUES (?,?,?,NULL)",
        )
        .run(params.id, body.instanceId, body.externalId);
      recordEvent(engine, {
        code: "user.identity_linked",
        subjectKind: "user",
        subjectId: params.id,
        actor: actorOf(caller),
        correlationId: newCorrelationId(),
        data: configurationOf([{ field: "instanceId", from: null, to: body.instanceId }]),
      });
    })();
    return {
      body: { instanceId: body.instanceId, externalId: body.externalId, lastLoginAt: null },
    };
  }),
  implement(endpoints.identityUnlink, ({ engine, caller, params }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const user = accessUser(engine, params.id);
    if (!user) return unknown("user");
    const found = engine.db
      .query<{ user_id: string }, [string, string, string]>(
        "SELECT user_id FROM user_identities WHERE user_id=? AND instance_id=? AND external_id=?",
      )
      .get(params.id, params.instanceId, params.externalId);
    if (!found) return unknown("identity");
    const count =
      engine.db
        .query<{ count: number }, [string]>(
          "SELECT count(*) AS count FROM user_identities WHERE user_id=?",
        )
        .get(params.id)?.count ?? 0;
    if (count === 1)
      return problem(409, "It is their only way in; suspend them instead", {
        code: "access.last_identity",
      });
    engine.db.transaction(() => {
      engine.db
        .query("DELETE FROM user_identities WHERE user_id=? AND instance_id=? AND external_id=?")
        .run(params.id, params.instanceId, params.externalId);
      recordEvent(engine, {
        code: "user.identity_unlinked",
        subjectKind: "user",
        subjectId: params.id,
        actor: actorOf(caller),
        correlationId: newCorrelationId(),
        data: configurationOf([{ field: "instanceId", from: params.instanceId, to: null }]),
      });
    })();
    return { status: 204, body: undefined };
  }),
  implement(endpoints.userSuspend, ({ engine, caller, params }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const user = accessUser(engine, params.id);
    if (!user) return unknown("user");
    if (user.kind === "agent")
      return problem(422, "An agent never logs in", { code: "access.agent_no_login" });
    if (user.suspendedAt !== null)
      return problem(409, `${user.name} is suspended`, { code: "access.suspended" });
    const now = engine.clock.now().toISOString();
    const users = manageUsers(engine).map((u) =>
      u.id === params.id ? { ...u, suspendedAt: now } : u,
    );
    if (managersOf(users, rolesOf(engine.db)).length === 0)
      return problem(409, "Nobody could manage access after this", { code: "access.last_manager" });
    engine.db.transaction(() => {
      engine.db.query("UPDATE users SET suspended_at=? WHERE id=?").run(now, params.id);
      engine.db.query("DELETE FROM sessions WHERE user_id=?").run(params.id);
      recordEvent(engine, {
        code: "user.suspended",
        subjectKind: "user",
        subjectId: params.id,
        actor: actorOf(caller),
        correlationId: newCorrelationId(),
        data: configurationOf([{ field: "suspendedAt", from: null, to: now }]),
      });
    })();
    return { body: accessUser(engine, params.id) };
  }),
  implement(endpoints.userRestore, ({ engine, caller, params }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const user = accessUser(engine, params.id);
    if (!user) return unknown("user");
    if (user.suspendedAt === null)
      return problem(409, `${user.name} is not suspended`, { code: "access.not_suspended" });
    engine.db.transaction(() => {
      engine.db.query("UPDATE users SET suspended_at=NULL WHERE id=?").run(params.id);
      recordEvent(engine, {
        code: "user.restored",
        subjectKind: "user",
        subjectId: params.id,
        actor: actorOf(caller),
        correlationId: newCorrelationId(),
        data: configurationOf([{ field: "suspendedAt", from: user.suspendedAt, to: null }]),
      });
    })();
    return { body: accessUser(engine, params.id) };
  }),
];
