// Groups connect people to each other and to category custody.
import { endpoints } from "@vera/contract/endpoints";
import { actorOf, configurationOf, newCorrelationId, recordEvent } from "../events";
import { implement } from "../http/endpoint";
import { problem } from "../http/problem";
import { groupsOf, requireManage } from "./index";

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
export const groupEndpoints = [
  implement(endpoints.groupCreate, ({ engine, caller, body }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const groups = groupsOf(engine);
    if (groups.some((g) => g.name === body.name)) return nameTaken(body.name);
    const id = nextId(
      groups.map((g) => g.id),
      "g",
    );
    const value = { id, ...body, memberIds: [], categoryIds: [] };
    engine.db.transaction(() => {
      engine.db
        .query("INSERT INTO groups (id,name,description) VALUES (?,?,?)")
        .run(id, body.name, body.description);
      recordEvent(engine, {
        code: "group.created",
        subjectKind: "group",
        subjectId: id,
        actor: actorOf(caller),
        correlationId: newCorrelationId(),
        data: configurationOf([
          { field: "name", from: null, to: body.name },
          { field: "description", from: null, to: body.description },
        ]),
      });
    })();
    return { body: value };
  }),
  implement(endpoints.groupSave, ({ engine, caller, params, body }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const old = groupsOf(engine).find((g) => g.id === params.id);
    if (!old) return problem(404, "No such group");
    if (groupsOf(engine).some((g) => g.id !== params.id && g.name === body.name))
      return nameTaken(body.name);
    const value = { ...old, ...body };
    engine.db.transaction(() => {
      engine.db
        .query("UPDATE groups SET name=?,description=? WHERE id=?")
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
          code: "group.changed",
          subjectKind: "group",
          subjectId: params.id,
          actor: actorOf(caller),
          correlationId: newCorrelationId(),
          data: configurationOf(changes),
        });
    })();
    return { body: value };
  }),
  implement(endpoints.groupMembers, ({ engine, caller, params, body }) => {
    const auth = requireManage(engine, caller?.userId ?? null);
    if (!auth.ok) return auth.response;
    const old = groupsOf(engine).find((g) => g.id === params.id);
    if (!old) return problem(404, "No such group");
    if (body.userIds.some((id) => !engine.db.query("SELECT 1 FROM users WHERE id=?").get(id)))
      return problem(404, "No such user");
    const members = [...new Set(body.userIds)];
    const before = old.memberIds;
    engine.db.transaction(() => {
      engine.db.query("DELETE FROM group_members WHERE group_id=?").run(params.id);
      for (const id of members)
        engine.db
          .query("INSERT INTO group_members (group_id,user_id) VALUES (?,?)")
          .run(params.id, id);
      if (JSON.stringify([...before].sort()) !== JSON.stringify([...members].sort()))
        recordEvent(engine, {
          code: "group.members_changed",
          subjectKind: "group",
          subjectId: params.id,
          actor: actorOf(caller),
          correlationId: newCorrelationId(),
          data: configurationOf([{ field: "memberIds", from: before, to: members }]),
        });
    })();
    return { body: { ...old, memberIds: members } };
  }),
];
