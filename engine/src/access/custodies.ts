// Request custodies are stored here; step 3 owns proposal placement and impacts.
import { endpoints } from "@vera/contract/endpoints";
import { hasPermission } from "@vera/domain/permissions";
import { implement } from "../http/endpoint";
import { problem } from "../http/problem";
import { custodiesOf, groupsOf, requireCaller, requireManage } from "./index";

const nextId = (ids: string[], prefix: string) =>
  `${prefix}${
    Math.max(
      0,
      ...ids
        .filter((x) => x.startsWith(prefix))
        .map((x) => Number(x.slice(prefix.length)))
        .filter(Number.isInteger),
    ) + 1
  }`;
const nameTaken = (name: string) =>
  problem(409, `There is already one called ${name}`, { code: "access.name_taken" });
export const custodyEndpoints = [
  implement(endpoints.custodyCreate, ({ engine, caller, body }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const records = custodiesOf(engine);
    if (records.some((c) => c.name === body.name)) return nameTaken(body.name);
    const id = nextId(
      records.map((c) => c.id),
      "pc",
    );
    const value = {
      id,
      ...body,
      isFallback: false,
      memberIds: [],
      groupIds: [],
      openCount: 0,
      placedByIds: [],
    };
    engine.db.transaction(() =>
      engine.db
        .query("INSERT INTO request_custodies (id,name,description,is_fallback) VALUES (?,?,?,0)")
        .run(id, body.name, body.description),
    )();
    return { body: value };
  }),
  implement(endpoints.custodySave, ({ engine, caller, params, body }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const records = custodiesOf(engine);
    const old = records.find((c) => c.id === params.id);
    if (!old) return problem(404, "No such custody");
    if (old.isFallback && body.name !== old.name)
      return problem(422, "The fallback keeps its name", { code: "access.fallback" });
    if (records.some((c) => c.id !== params.id && c.name === body.name))
      return nameTaken(body.name);
    engine.db.transaction(() =>
      engine.db
        .query("UPDATE request_custodies SET name=?,description=? WHERE id=?")
        .run(body.name, body.description, params.id),
    )();
    return { body: { ...old, ...body } };
  }),
  implement(endpoints.custodyMembers, ({ engine, caller, params, body }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const old = custodiesOf(engine).find((c) => c.id === params.id);
    if (!old) return problem(404, "No such custody");
    if (
      body.userIds.some(
        (id) =>
          engine.db.query<{ kind: string }, [string]>("SELECT kind FROM users WHERE id=?").get(id)
            ?.kind !== "person",
      )
    )
      return problem(404, "No such person");
    const groups = groupsOf(engine);
    if (body.groupIds.some((id) => !groups.some((g) => g.id === id)))
      return problem(404, "No such group");
    const users = [...new Set(body.userIds)],
      groupIds = [...new Set(body.groupIds)];
    engine.db.transaction(() => {
      engine.db.query("DELETE FROM request_custody_members WHERE custody_id=?").run(params.id);
      engine.db.query("DELETE FROM request_custody_groups WHERE custody_id=?").run(params.id);
      for (const id of users)
        engine.db
          .query("INSERT INTO request_custody_members (custody_id,user_id) VALUES (?,?)")
          .run(params.id, id);
      for (const id of groupIds)
        engine.db
          .query("INSERT INTO request_custody_groups (custody_id,group_id) VALUES (?,?)")
          .run(params.id, id);
    })();
    return { body: { ...old, memberIds: users, groupIds } };
  }),
  implement(endpoints.custodyDelete, ({ engine, caller, params }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const old = custodiesOf(engine).find((c) => c.id === params.id);
    if (!old) return problem(404, "No such custody");
    if (old.isFallback)
      return problem(422, "The fallback cannot be deleted", { code: "access.fallback" });
    engine.db.transaction(() => {
      engine.db.query("DELETE FROM request_custody_members WHERE custody_id=?").run(params.id);
      engine.db.query("DELETE FROM request_custody_groups WHERE custody_id=?").run(params.id);
      engine.db.query("DELETE FROM request_custodies WHERE id=?").run(params.id);
    })();
    return { status: 204, body: undefined };
  }),
  implement(endpoints.custodyImpact, ({ engine, caller, params }) => {
    const auth = requireCaller(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    if (!hasPermission(auth.session, "access.read"))
      return problem(403, "You may not read users, groups or roles");
    const record = custodiesOf(engine).find((c) => c.id === params.id);
    if (!record) return problem(404, "No such custody");
    const ruleIds = engine.db
      .query<{ id: string; settings: string }, []>(
        "SELECT id,settings FROM plugin_instances WHERE is_enabled=1 AND is_deleted=0 ORDER BY rowid",
      )
      .all()
      .flatMap((i) => {
        const s = JSON.parse(i.settings ?? "null");
        return s?.kind === "Custody" && s.custodyId === params.id ? [i.id] : [];
      });
    return { body: { openCount: 0, toFallbackCount: 0, ruleIds } };
  }),
];
