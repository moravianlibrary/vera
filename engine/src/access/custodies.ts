// Request custodies are stored here; step 3 owns proposal placement and impacts.
import { endpoints } from "@vera/contract/endpoints";
import { custodyImpactOf } from "@vera/contract/queries/custodies";
import { hasPermission } from "@vera/domain/permissions";
import { actorOf, configurationOf, newCorrelationId, recordEvent } from "../events";
import { implement } from "../http/endpoint";
import { problem } from "../http/problem";
import { engineRequestPlugins } from "../records/plugins";
import { engineStore } from "../records/store";
import { custodiesOf, engineCustodyRules, groupsOf, requireCaller, requireManage } from "./index";

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
    engine.db.transaction(() => {
      engine.db
        .query("INSERT INTO request_custodies (id,name,description,is_fallback) VALUES (?,?,?,0)")
        .run(id, body.name, body.description);
      recordEvent(engine, {
        code: "custody.created",
        subjectKind: "custody",
        subjectId: id,
        actor: actorOf(caller),
        correlationId: newCorrelationId(),
        data: configurationOf([
          { field: "name", from: null, to: body.name },
          { field: "description", from: null, to: body.description },
        ]),
      });
    })();
    const created = custodiesOf(engine).find((custody) => custody.id === id);
    if (!created) return problem(500, "The custody was not stored");
    return { body: created };
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
    engine.db.transaction(() => {
      engine.db
        .query("UPDATE request_custodies SET name=?,description=? WHERE id=?")
        .run(body.name, body.description, params.id);
      const changes = ["name", "description"].flatMap((field) =>
        old[field as "name" | "description"] === body[field as "name" | "description"]
          ? []
          : [
              {
                field,
                from: old[field as "name" | "description"],
                to: body[field as "name" | "description"],
              },
            ],
      );
      if (changes.length)
        recordEvent(engine, {
          code: "custody.changed",
          subjectKind: "custody",
          subjectId: params.id,
          actor: actorOf(caller),
          correlationId: newCorrelationId(),
          data: configurationOf(changes),
        });
    })();
    const saved = custodiesOf(engine).find((custody) => custody.id === params.id);
    if (!saved) return problem(500, "The custody was not stored");
    return { body: saved };
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
    const beforeUsers = old.memberIds,
      beforeGroups = old.groupIds;
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
      if (
        JSON.stringify([...beforeUsers].sort()) !== JSON.stringify([...users].sort()) ||
        JSON.stringify([...beforeGroups].sort()) !== JSON.stringify([...groupIds].sort())
      )
        recordEvent(engine, {
          code: "custody.members_changed",
          subjectKind: "custody",
          subjectId: params.id,
          actor: actorOf(caller),
          correlationId: newCorrelationId(),
          data: configurationOf([
            { field: "memberIds", from: beforeUsers, to: users },
            { field: "groupIds", from: beforeGroups, to: groupIds },
          ]),
        });
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
      recordEvent(engine, {
        code: "custody.deleted",
        subjectKind: "custody",
        subjectId: params.id,
        actor: actorOf(caller),
        correlationId: newCorrelationId(),
        data: configurationOf([{ field: "name", from: old.name, to: null }]),
      });
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
    return {
      body: custodyImpactOf(
        engineStore(engine),
        engineRequestPlugins(engine),
        params.id,
        engineCustodyRules(engine),
      ),
    };
  }),
];
