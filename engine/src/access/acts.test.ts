// Users & Groups acts against the engine, signed in as the same people as the mock tests.
import { describe, expect, it } from "bun:test";
import { accessRecordActionRoute, accessRecordRoute, apiRoutes } from "@vera/contract/routes";
import { call, sessionCookieOf, testEngine } from "../../test/engine";

const api = (path: string) => `/api${path}`;
const roleDraft = {
  name: "New reader",
  description: "",
  grants: [{ permission: "iteration.read", scope: "custody" }],
  proposalBatchLimit: 10,
  proposalDailyLimit: 300,
};
const json = (response: Response) => response.json() as Promise<Record<string, unknown>>;

describe("access acts", () => {
  it("ACT-role-save: creates and names a new role", async () => {
    const engine = testEngine("base");
    const created = await call(engine, "POST", api(apiRoutes.accessRoles), {
      as: "u3",
      body: roleDraft,
    });
    expect(created.status).toBe(200);
    const role = (await json(created)) as { id: string; name: string; isShipped: boolean };
    expect(role).toMatchObject({ id: "new-reader", name: "new-reader", isShipped: false });
    engine.close();
  });

  it("ACT-role-save: refuses a taken role name (access.name_taken)", async () => {
    const engine = testEngine("base");
    await call(engine, "POST", api(apiRoutes.accessRoles), { as: "u3", body: roleDraft });
    expect(
      (await call(engine, "POST", api(apiRoutes.accessRoles), { as: "u3", body: roleDraft }))
        .status,
    ).toBe(409);
    engine.close();
  });

  it("ACT-role-save: refuses a missing permission requirement (role.requires)", async () => {
    const engine = testEngine("base");
    expect(
      (
        await call(engine, "POST", api(apiRoutes.accessRoles), {
          as: "u3",
          body: {
            ...roleDraft,
            name: "invalid",
            grants: [{ permission: "iteration.publish", scope: "custody" }],
          },
        })
      ).status,
    ).toBe(422);
    engine.close();
  });

  it("ACT-role-save: updates a role", async () => {
    const engine = testEngine("base");
    const created = await call(engine, "POST", api(apiRoutes.accessRoles), {
      as: "u3",
      body: roleDraft,
    });
    const role = (await json(created)) as { id: string };
    const saved = await call(engine, "PUT", api(accessRecordRoute("roles", role.id)), {
      as: "u3",
      body: { ...roleDraft, name: "Renamed" },
    });
    expect((await json(saved)).name).toBe("renamed");
    engine.close();
  });

  it("ACT-role-save: refuses a change without access.manage (403)", async () => {
    const engine = testEngine("base");
    expect(
      (await call(engine, "POST", api(apiRoutes.accessRoles), { as: "u5", body: roleDraft }))
        .status,
    ).toBe(403);
    engine.close();
  });

  it("ACT-role-delete: removes a role", async () => {
    const engine = testEngine("base");
    const created = await call(engine, "POST", api(apiRoutes.accessRoles), {
      as: "u3",
      body: roleDraft,
    });
    const role = (await json(created)) as { id: string };
    expect(
      (await call(engine, "DELETE", api(accessRecordRoute("roles", role.id)), { as: "u3" })).status,
    ).toBe(204);
    engine.close();
  });

  it("ACT-role-delete: refuses to remove the last access manager (access.last_manager)", async () => {
    const engine = testEngine("base");
    const deleteDraft = {
      ...roleDraft,
      name: "Admin replacement",
      grants: [
        { permission: "access.read", scope: "any" },
        { permission: "access.manage", scope: "any" },
      ],
    };
    const adminRole = await call(engine, "POST", api(apiRoutes.accessRoles), {
      as: "u3",
      body: deleteDraft,
    });
    expect(adminRole.status).toBe(200);
    expect(
      (await call(engine, "DELETE", api(accessRecordRoute("roles", "admin")), { as: "u3" })).status,
    ).toBe(409);
    engine.close();
  });

  it("ACT-role-save: refuses a change that removes the last access manager (access.last_manager)", async () => {
    const engine = testEngine("base");
    const response = await call(engine, "PUT", api(accessRecordRoute("roles", "admin")), {
      as: "u3",
      body: {
        name: "Admin",
        description: "",
        grants: [{ permission: "access.read", scope: "any" }],
        proposalBatchLimit: null,
        proposalDailyLimit: null,
      },
    });
    expect(response.status).toBe(409);
    engine.close();
  });

  it("ACT-user-roles: sets hand roles without changing mapped roles", async () => {
    const engine = testEngine("base");
    const roleResponse = await call(
      engine,
      "PUT",
      api(accessRecordActionRoute("users", "u4", "roles")),
      { as: "u3", body: { roleIds: ["reader"] } },
    );
    expect((await json(roleResponse)).mappedRoles).toEqual([
      { roleId: "staff", instanceId: "pi22", claim: "group mzk-staff" },
    ]);
    engine.close();
  });

  it("ACT-user-roles: refuses to remove the last access manager (access.last_manager)", async () => {
    const engine = testEngine("base");
    expect(
      (
        await call(engine, "PUT", api(accessRecordActionRoute("users", "u3", "roles")), {
          as: "u3",
          body: { roleIds: [] },
        })
      ).status,
    ).toBe(409);
    engine.close();
  });

  it("ACT-user-groups: replaces a person's group memberships", async () => {
    const engine = testEngine("base");
    expect(
      (
        await call(engine, "PUT", api(accessRecordActionRoute("users", "u9", "groups")), {
          as: "u3",
          body: { groupIds: ["g3"] },
        })
      ).status,
    ).toBe(200);
    engine.close();
  });

  it("ACT-identity-link: links an identity to a person", async () => {
    const engine = testEngine("base");
    expect(
      (
        await call(engine, "POST", api(accessRecordActionRoute("users", "u1", "identities")), {
          as: "u3",
          body: { instanceId: "pi23", externalId: "one-off" },
        })
      ).status,
    ).toBe(200);
    engine.close();
  });

  it("ACT-identity-link: refuses an identity already linked to another user (access.identity_taken)", async () => {
    const engine = testEngine("base");
    expect(
      (
        await call(engine, "POST", api(accessRecordActionRoute("users", "u1", "identities")), {
          as: "u3",
          body: { instanceId: "pi23", externalId: "one-off" },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call(engine, "POST", api(accessRecordActionRoute("users", "u2", "identities")), {
          as: "u3",
          body: { instanceId: "pi23", externalId: "one-off" },
        })
      ).status,
    ).toBe(409);
    engine.close();
  });

  it("ACT-identity-unlink: removes an identity", async () => {
    const engine = testEngine("base");
    await call(engine, "POST", api(accessRecordActionRoute("users", "u1", "identities")), {
      as: "u3",
      body: { instanceId: "pi23", externalId: "one-off" },
    });
    expect(
      (
        await call(
          engine,
          "DELETE",
          api(`${accessRecordActionRoute("users", "u1", "identities")}/pi23/one-off`),
          { as: "u3" },
        )
      ).status,
    ).toBe(204);
    engine.close();
  });

  it("ACT-identity-unlink: refuses the last identity (access.last_identity)", async () => {
    const engine = testEngine("base");
    await call(engine, "POST", api(accessRecordActionRoute("users", "u1", "identities")), {
      as: "u3",
      body: { instanceId: "pi23", externalId: "one-off" },
    });
    await call(
      engine,
      "DELETE",
      api(`${accessRecordActionRoute("users", "u1", "identities")}/pi23/one-off`),
      { as: "u3" },
    );
    expect(
      (
        await call(
          engine,
          "DELETE",
          api(`${accessRecordActionRoute("users", "u1", "identities")}/pi22/jnovakova`),
          { as: "u3" },
        )
      ).status,
    ).toBe(409);
    engine.close();
  });

  it("ACT-user-suspend: suspends a person and ends their open sessions", async () => {
    const engine = testEngine("base");
    const session = await engine.fetch(
      new Request("http://engine.test/_engine/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "u4" }),
      }),
    );
    const cookie = sessionCookieOf(session);
    expect(cookie).not.toBeNull();
    expect(
      (
        await call(engine, "POST", api(accessRecordActionRoute("users", "u4", "suspend")), {
          as: "u3",
          body: {},
        })
      ).status,
    ).toBe(200);
    const signedOut = await engine.fetch(
      new Request("http://engine.test/api/session/account", {
        headers: { Cookie: `vera_session=${cookie}` },
      }),
    );
    expect(signedOut.status).toBe(401);
    engine.close();
  });

  it("ACT-user-suspend: refuses a suspended person (access.suspended)", async () => {
    const engine = testEngine("base");
    await call(engine, "POST", api(accessRecordActionRoute("users", "u4", "suspend")), {
      as: "u3",
      body: {},
    });
    expect(
      (
        await call(engine, "POST", api(accessRecordActionRoute("users", "u4", "suspend")), {
          as: "u3",
          body: {},
        })
      ).status,
    ).toBe(409);
    engine.close();
  });

  it("ACT-user-suspend: refuses to suspend the last access manager (access.last_manager)", async () => {
    const engine = testEngine("base");
    expect(
      (
        await call(engine, "POST", api(accessRecordActionRoute("users", "u3", "suspend")), {
          as: "u3",
          body: {},
        })
      ).status,
    ).toBe(409);
    engine.close();
  });

  it("ACT-user-restore: restores a suspended person", async () => {
    const engine = testEngine("base");
    await call(engine, "POST", api(accessRecordActionRoute("users", "u4", "suspend")), {
      as: "u3",
      body: {},
    });
    expect(
      (
        await call(engine, "POST", api(accessRecordActionRoute("users", "u4", "restore")), {
          as: "u3",
          body: {},
        })
      ).status,
    ).toBe(200);
    engine.close();
  });

  it("ACT-user-restore: refuses a person who is not suspended (access.not_suspended)", async () => {
    const engine = testEngine("base");
    expect(
      (
        await call(engine, "POST", api(accessRecordActionRoute("users", "u4", "restore")), {
          as: "u3",
          body: {},
        })
      ).status,
    ).toBe(409);
    engine.close();
  });

  it("ACT-local-account: creates a local account", async () => {
    const engine = testEngine("base");
    const account = await call(engine, "POST", api(apiRoutes.accessUsers), {
      as: "u3",
      body: { name: "Hana Malá", username: "hmala", email: "", roleIds: ["reader"] },
    });
    expect((await json(account)).identities).toEqual([
      { instanceId: "pi24", externalId: "hmala", lastLoginAt: null },
    ]);
    engine.close();
  });

  it("ACT-local-account: refuses a taken local username (access.identity_taken)", async () => {
    const engine = testEngine("base");
    await call(engine, "POST", api(apiRoutes.accessUsers), {
      as: "u3",
      body: { name: "Hana", username: "hmala", email: "", roleIds: [] },
    });
    expect(
      (
        await call(engine, "POST", api(apiRoutes.accessUsers), {
          as: "u3",
          body: { name: "Hana", username: "hmala", email: "", roleIds: [] },
        })
      ).status,
    ).toBe(409);
    engine.close();
  });

  it("ACT-group-save: creates a group without members or category custody", async () => {
    const engine = testEngine("base");
    const groupResponse = await call(engine, "POST", api(apiRoutes.accessGroups), {
      as: "u3",
      body: { name: "Maps", description: "" },
    });
    const group = (await json(groupResponse)) as { id: string; memberIds: string[] };
    expect(group.memberIds).toEqual([]);
    engine.close();
  });

  it("ACT-group-save: saves a group", async () => {
    const engine = testEngine("base");
    const created = await call(engine, "POST", api(apiRoutes.accessGroups), {
      as: "u3",
      body: { name: "Maps", description: "" },
    });
    const group = (await json(created)) as { id: string };
    expect(
      (
        await call(engine, "PUT", api(accessRecordRoute("groups", group.id)), {
          as: "u3",
          body: { name: "Maps team", description: "Team" },
        })
      ).status,
    ).toBe(200);
    engine.close();
  });

  it("ACT-group-save: sets group members", async () => {
    const engine = testEngine("base");
    const created = await call(engine, "POST", api(apiRoutes.accessGroups), {
      as: "u3",
      body: { name: "Maps", description: "" },
    });
    const group = (await json(created)) as { id: string };
    expect(
      (
        await call(engine, "PUT", api(accessRecordActionRoute("groups", group.id, "members")), {
          as: "u3",
          body: { userIds: ["u1"] },
        })
      ).status,
    ).toBe(200);
    engine.close();
  });

  it("ACT-custody-save: creates a custody", async () => {
    const engine = testEngine("base");
    const custodyResponse = await call(engine, "POST", api(apiRoutes.accessCustodies), {
      as: "u3",
      body: { name: "Maps", description: "" },
    });
    expect(await json(custodyResponse)).toMatchObject({
      isFallback: false,
      openCount: 0,
      placedByIds: [],
    });
    engine.close();
  });

  it("ACT-custody-save: saves a custody", async () => {
    const engine = testEngine("base");
    const created = await call(engine, "POST", api(apiRoutes.accessCustodies), {
      as: "u3",
      body: { name: "Maps", description: "" },
    });
    const custody = (await json(created)) as { id: string };
    expect(
      (
        await call(engine, "PUT", api(accessRecordRoute("custodies", custody.id)), {
          as: "u3",
          body: { name: "Map custody", description: "" },
        })
      ).status,
    ).toBe(200);
    engine.close();
  });

  it("ACT-custody-save: sets members", async () => {
    const engine = testEngine("base");
    const group = await call(engine, "POST", api(apiRoutes.accessGroups), {
      as: "u3",
      body: { name: "Maps group", description: "" },
    });
    const groupId = ((await json(group)) as { id: string }).id;
    const created = await call(engine, "POST", api(apiRoutes.accessCustodies), {
      as: "u3",
      body: { name: "Maps custody", description: "" },
    });
    const custodyId = ((await json(created)) as { id: string }).id;
    expect(
      (
        await call(engine, "PUT", api(accessRecordActionRoute("custodies", custodyId, "members")), {
          as: "u3",
          body: { userIds: ["u1"], groupIds: [groupId] },
        })
      ).status,
    ).toBe(200);
    engine.close();
  });

  it("ACT-custody-save: refuses an agent as a member (404 unknown person)", async () => {
    const engine = testEngine("base");
    const created = await call(engine, "POST", api(apiRoutes.accessCustodies), {
      as: "u3",
      body: { name: "Maps custody", description: "" },
    });
    const custodyId = ((await json(created)) as { id: string }).id;
    expect(
      (
        await call(engine, "PUT", api(accessRecordActionRoute("custodies", custodyId, "members")), {
          as: "u3",
          body: { userIds: ["a1"], groupIds: [] },
        })
      ).status,
    ).toBe(404);
    engine.close();
  });

  it("ACT-custody-save: keeps the fallback's name (access.fallback)", async () => {
    const engine = testEngine("base");
    expect(
      (
        await call(engine, "PUT", api(accessRecordRoute("custodies", "pc0")), {
          as: "u3",
          body: { name: "Changed", description: "" },
        })
      ).status,
    ).toBe(422);
    engine.close();
  });

  it("ACT-custody-delete: refuses to delete the fallback (access.fallback)", async () => {
    const engine = testEngine("base");
    expect(
      (await call(engine, "DELETE", api(accessRecordRoute("custodies", "pc0")), { as: "u3" }))
        .status,
    ).toBe(422);
    engine.close();
  });

  it("ACT-custody-delete: deletes a custody", async () => {
    const engine = testEngine("base");
    const created = await call(engine, "POST", api(apiRoutes.accessCustodies), {
      as: "u3",
      body: { name: "Maps custody", description: "" },
    });
    const custodyId = ((await json(created)) as { id: string }).id;
    expect(
      (await call(engine, "DELETE", api(accessRecordRoute("custodies", custodyId)), { as: "u3" }))
        .status,
    ).toBe(204);
    engine.close();
  });

  it("settings: merges lastOpenedWatchlists by key and preserves unrelated settings", async () => {
    const engine = testEngine("base");
    const first = await call(engine, "PATCH", api(apiRoutes.userSettings), {
      as: "u3",
      body: { lastOpenedWatchlists: { documents: "mine" }, language: "cs" },
    });
    expect(await json(first)).toMatchObject({
      lastOpenedWatchlists: { documents: "mine" },
      language: "cs",
    });
    const second = await call(engine, "PATCH", api(apiRoutes.userSettings), {
      as: "u3",
      body: { lastOpenedWatchlists: { requests: "open" } },
    });
    expect(await json(second)).toMatchObject({
      lastOpenedWatchlists: { documents: "mine", requests: "open" },
      language: "cs",
    });
    expect((await call(engine, "GET", api(apiRoutes.userSettings), { as: "u3" })).status).toBe(200);
    engine.close();
  });
});
