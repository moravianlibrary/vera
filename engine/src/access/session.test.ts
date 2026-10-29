// GET /api/session against the minimal seed.

import { describe, expect, it } from "bun:test";
import { sessionSchema } from "@vera/domain/entities";
import { call, testEngine } from "../../test/engine";

const engine = testEngine();

describe("the session", () => {
  it("resolves roles, grants, groups and custody (ACCESS-role-ways, ACCESS-group)", async () => {
    const response = await call(engine, "GET", "/api/session", { as: "u1" });
    expect(response.status).toBe(200);
    expect(sessionSchema.parse(await response.json())).toEqual({
      user: { id: "u1", name: "Curator One", kind: "person", email: "curator@example.org" },
      roleIds: ["curator", "reader"],
      grants: [
        { permission: "request.create", scope: null },
        { permission: "request.read_mine", scope: null },
        { permission: "iteration.read", scope: "any" },
      ],
      custodyCategoryIds: ["c1", "c2"],
      groupIds: ["g1"],
    });
  });

  it("gives a person with no roles nothing", async () => {
    const response = await call(engine, "GET", "/api/session", { as: "u4" });
    const session = sessionSchema.parse(await response.json());
    expect(session.roleIds).toEqual([]);
    expect(session.grants).toEqual([]);
  });

  it("refuses a suspended person (ACCESS-suspend)", async () => {
    expect((await call(engine, "GET", "/api/session", { as: "u3" })).status).toBe(401);
  });

  it("knows nobody without a session, or with an unknown user", async () => {
    expect((await call(engine, "GET", "/api/session")).status).toBe(401);
    expect((await call(engine, "GET", "/api/session", { as: "u99" })).status).toBe(401);
  });

  it("does not open sessions outside development", async () => {
    const production = testEngine("minimal", false);
    expect((await call(production, "GET", "/api/session", { as: "u1" })).status).toBe(401);
  });
});
