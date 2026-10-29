// Groups connect people to each other and to category custody.
import { endpoints } from "@vera/contract/endpoints";
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
    engine.db.transaction(() =>
      engine.db
        .query("INSERT INTO groups (id,name,description) VALUES (?,?,?)")
        .run(id, body.name, body.description),
    )();
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
    engine.db.transaction(() =>
      engine.db
        .query("UPDATE groups SET name=?,description=? WHERE id=?")
        .run(body.name, body.description, params.id),
    )();
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
    engine.db.transaction(() => {
      engine.db.query("DELETE FROM group_members WHERE group_id=?").run(params.id);
      for (const id of members)
        engine.db
          .query("INSERT INTO group_members (group_id,user_id) VALUES (?,?)")
          .run(params.id, id);
    })();
    return { body: { ...old, memberIds: members } };
  }),
];
