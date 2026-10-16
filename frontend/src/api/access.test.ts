// Users & Groups end to end against the mock server over HTTP: who reads it, the roles each
// person holds and how, and changing roles, holdings, groups, custodies, local accounts and
// identities under `access.manage`, never leaving nobody able to manage access. The acts change
// the mock's state, so they come last, and each test reads what it needs afresh.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { AccessIndex } from "@/api/access";
import {
  createCustody,
  createGroup,
  createLocalAccount,
  createRole,
  deleteCustody,
  deleteRole,
  getAccessIndex,
  getCustodyImpact,
  getRoleImpact,
  linkIdentity,
  restoreUser,
  saveCustody,
  saveRole,
  setCustodyMembers,
  setGroupMembers,
  setHandRoles,
  setUserGroups,
  suspendUser,
  unlinkIdentity,
} from "@/api/access";
import { ApiError } from "@/api/http";
import { getPluginIndex } from "@/api/plugins";
import { getSession } from "@/api/session";
import type { MockUserProfile } from "@/config/env";
import { heldRolesOf, managersOf } from "@/domain/access";
import { createHandlers } from "@/mocks/handlers";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function signInAs(profile: MockUserProfile): void {
  server.use(...createHandlers(profile));
}

async function refusalOf(
  call: Promise<unknown>,
): Promise<{ status: number; code?: string } | null> {
  try {
    await call;
    return null;
  } catch (error) {
    return error instanceof ApiError ? { status: error.status, code: error.problem?.code } : null;
  }
}

const userOf = (index: AccessIndex, userId: string) =>
  index.users.find((user) => user.id === userId);

describe("getAccessIndex", () => {
  it("is access.read's", async () => {
    signInAs("curator");

    expect(await refusalOf(getAccessIndex())).toMatchObject({ status: 403 });
  });

  it("says how each role is held: by hand, or mapped by an Identity instance from a claim", async () => {
    signInAs("admin");
    const index = await getAccessIndex();

    expect(heldRolesOf(userOf(index, "u3") ?? { handRoleIds: [], mappedRoles: [] })).toEqual([
      { roleId: "admin", ways: [{ by: "hand" }] },
      { roleId: "staff", ways: [{ by: "mapped", instanceId: "pi22", claim: "group mzk-staff" }] },
    ]);
    expect(userOf(index, "u10")).toMatchObject({ handRoleIds: [], mappedRoles: [] });
    expect(userOf(index, "a1")).toMatchObject({
      kind: "agent",
      entry: "Additions",
      identities: [],
    });
  });

  it("puts the fallback first, with what the rules placed in each custody", async () => {
    signInAs("admin");
    const { custodies } = await getAccessIndex();

    expect(custodies[0]).toMatchObject({ id: "pc0", isFallback: true, placedByIds: [] });
    expect(custodies.find((custody) => custody.id === "pc1")).toMatchObject({
      placedByIds: ["pi25"],
    });
    expect(custodies.every((custody) => custody.openCount >= 0)).toBe(true);
    expect(custodies.find((custody) => custody.id === "pc1")?.openCount).toBeGreaterThan(0);
  });

  it("names the identity providers and what they map", async () => {
    signInAs("admin");
    const { identityInstances } = await getAccessIndex();

    expect(identityInstances.map((instance) => instance.name)).toEqual([
      "MZK Keycloak",
      "eduID.cz",
      "Local accounts",
    ]);
    expect(identityInstances[1]).toMatchObject({ defaultRoleId: "reader" });
  });
});

describe("roles", () => {
  it("refuses without access.manage", async () => {
    signInAs("staff");

    expect(
      await refusalOf(
        createRole({
          name: "maps",
          description: "",
          grants: [],
          proposalBatchLimit: 10,
          proposalDailyLimit: 300,
        }),
      ),
    ).toMatchObject({ status: 403 });
  });

  it("refuses a scope the permission does not take", async () => {
    signInAs("admin");

    expect(
      await refusalOf(
        createRole({
          name: "maps-curator",
          description: "",
          proposalBatchLimit: 10,
          proposalDailyLimit: 300,
          grants: [{ permission: "restriction.overrule", scope: "custody" }],
        }),
      ),
    ).toMatchObject({ status: 422 });
    expect(
      await refusalOf(
        createRole({
          name: "maps-curator",
          description: "",
          proposalBatchLimit: 10,
          proposalDailyLimit: 300,
          grants: [{ permission: "watch", scope: "any" }],
        }),
      ),
    ).toMatchObject({ status: 422 });
  });

  it("refuses a role that grants a permission without what it needs (PERM-requires)", async () => {
    signInAs("admin");

    expect(
      await refusalOf(
        createRole({
          name: "maps-curator",
          description: "",
          proposalBatchLimit: 10,
          proposalDailyLimit: 300,
          grants: [
            { permission: "iteration.publish", scope: "custody" },
            { permission: "iteration.read", scope: "project" },
          ],
        }),
      ),
    ).toMatchObject({ status: 422, code: "role.requires" });
  });

  it("names a new role the way shipped ones are named, once", async () => {
    signInAs("admin");
    const role = await createRole({
      name: "Maps Curator",
      description: "Maps only.",
      proposalBatchLimit: 10,
      proposalDailyLimit: 300,
      grants: [{ permission: "iteration.read", scope: "custody" }],
    });

    expect(role).toMatchObject({ id: "maps-curator", name: "maps-curator", isShipped: false });
    const unlimited = await saveRole({
      roleId: role.id,
      draft: { ...role, proposalBatchLimit: null, proposalDailyLimit: null },
    });
    expect(unlimited).toMatchObject({ proposalBatchLimit: null, proposalDailyLimit: null });
    expect(
      await refusalOf(
        createRole({
          name: "maps curator",
          description: "",
          grants: [],
          proposalBatchLimit: 10,
          proposalDailyLimit: 300,
        }),
      ),
    ).toMatchObject({ status: 409, code: "access.name_taken" });
  });

  it("says first what deleting a role takes from each holder, and which mappings stop", async () => {
    signInAs("admin");

    expect(await getRoleImpact("curator")).toEqual({
      holders: [
        { userId: "u1", keptRoleIds: [] },
        { userId: "u8", keptRoleIds: ["staff"] },
      ],
      mappings: [{ instanceId: "pi22", claim: "group mzk-curators" }],
      leavesNoManager: false,
    });
    expect((await getRoleImpact("admin")).leavesNoManager).toBe(true);
  });

  it("refuses to leave nobody able to manage access", async () => {
    signInAs("admin");
    const { roles } = await getAccessIndex();
    const admin = roles.find((role) => role.id === "admin");
    if (admin === undefined) {
      throw new Error("no admin role");
    }

    const without = admin.grants.filter((grant) => grant.permission !== "access.manage");
    expect(
      await refusalOf(saveRole({ roleId: "admin", draft: { ...admin, grants: without } })),
    ).toMatchObject({ status: 409, code: "access.last_manager" });
    expect(await refusalOf(deleteRole("admin"))).toMatchObject({
      status: 409,
      code: "access.last_manager",
    });
    expect(await refusalOf(setHandRoles({ recordId: "u3", body: { roleIds: [] } }))).toMatchObject({
      status: 409,
      code: "access.last_manager",
    });
  });

  it("changes what its holders may do on their next request", async () => {
    signInAs("curator");
    expect((await getSession()).grants).not.toContainEqual({
      permission: "list.read",
      scope: "any",
    });

    signInAs("admin");
    const { roles } = await getAccessIndex();
    const curator = roles.find((role) => role.id === "curator");
    if (curator === undefined) {
      throw new Error("no curator role");
    }

    await saveRole({
      roleId: "curator",
      draft: { ...curator, grants: [...curator.grants, { permission: "list.read", scope: "any" }] },
    });

    signInAs("curator");
    expect((await getSession()).grants).toContainEqual({ permission: "list.read", scope: "any" });
  });

  it("deletes a role from everyone who held it, keeping the rest", async () => {
    signInAs("admin");
    await setHandRoles({ recordId: "u6", body: { roleIds: ["reader", "maps-curator"] } });
    await deleteRole("maps-curator");
    const index = await getAccessIndex();

    expect(index.roles.some((role) => role.id === "maps-curator")).toBe(false);
    expect(userOf(index, "u6")?.handRoleIds).toEqual(["reader"]);
  });
});

describe("users", () => {
  it("sets roles by hand and leaves mapped ones as the provider gave them", async () => {
    signInAs("admin");
    const user = await setHandRoles({ recordId: "u4", body: { roleIds: ["curator"] } });

    expect(heldRolesOf(user).map(({ roleId }) => roleId)).toEqual(["curator", "staff"]);
    expect(user.mappedRoles).toHaveLength(1);
  });

  it("puts a person in groups and takes them out of the others", async () => {
    signInAs("admin");
    const user = await setUserGroups({ recordId: "u9", body: { groupIds: ["g3"] } });

    expect(user.groupIds).toEqual(["g3"]);
  });

  it("links a second identity, refusing one somebody already has", async () => {
    signInAs("admin");

    expect(
      await refusalOf(
        linkIdentity({ userId: "u1", link: { instanceId: "pi24", externalId: "akolar" } }),
      ),
    ).toMatchObject({ status: 409, code: "access.identity_taken" });
    expect(
      await refusalOf(
        linkIdentity({ userId: "a1", link: { instanceId: "pi24", externalId: "sweep" } }),
      ),
    ).toMatchObject({ status: 422 });
    expect(
      await linkIdentity({ userId: "u1", link: { instanceId: "pi23", externalId: "jana@mzk.cz" } }),
    ).toEqual({ instanceId: "pi23", externalId: "jana@mzk.cz", lastLoginAt: null });
  });

  it("unlinks an identity, never the last one (ACCESS-link-identity)", async () => {
    signInAs("admin");
    await linkIdentity({ userId: "u2", link: { instanceId: "pi23", externalId: "u2@mzk.cz" } });
    const before = userOf(await getAccessIndex(), "u2");
    const [first, second] = before?.identities ?? [];
    if (first === undefined || second === undefined) {
      throw new Error("u2 has two identities after the link");
    }

    expect(
      await refusalOf(
        unlinkIdentity({ userId: "u2", identity: { instanceId: "pi23", externalId: "nobody" } }),
      ),
    ).toMatchObject({ status: 404 });
    await unlinkIdentity({ userId: "u2", identity: first });
    expect(userOf(await getAccessIndex(), "u2")?.identities).toEqual([second]);
    expect(await refusalOf(unlinkIdentity({ userId: "u2", identity: second }))).toMatchObject({
      status: 409,
      code: "access.last_identity",
    });
  });

  it("suspends a person: login refused, roles kept, until restored (ACCESS-suspend)", async () => {
    signInAs("admin");
    const suspended = await suspendUser("u4");

    expect(suspended.suspendedAt).not.toBeNull();
    expect(suspended.handRoleIds).not.toHaveLength(0);
    expect(await refusalOf(suspendUser("u4"))).toMatchObject({
      status: 409,
      code: "access.suspended",
    });
    expect(await refusalOf(suspendUser("a1"))).toMatchObject({ status: 422 });

    signInAs("staff");
    expect(await refusalOf(getSession())).toMatchObject({ status: 401 });

    signInAs("admin");
    const restored = await restoreUser("u4");
    expect(restored.suspendedAt).toBeNull();
    expect(restored.handRoleIds).toEqual(suspended.handRoleIds);
    expect(await refusalOf(restoreUser("u4"))).toMatchObject({
      status: 409,
      code: "access.not_suspended",
    });

    signInAs("staff");
    expect((await getSession()).grants).not.toHaveLength(0);
  });

  it("refuses to suspend the last person able to manage access (ACCESS-last-manager)", async () => {
    signInAs("admin");
    const index = await getAccessIndex();
    const others = managersOf(index.users, index.roles).filter((user) => user.id !== "u3");
    for (const user of others) {
      await suspendUser(user.id);
    }

    expect(await refusalOf(suspendUser("u3"))).toMatchObject({
      status: 409,
      code: "access.last_manager",
    });
    for (const user of others) {
      await restoreUser(user.id);
    }
  });

  it("creates a local account, refusing a username already taken", async () => {
    signInAs("admin");
    const user = await createLocalAccount({
      name: "Hana Malá",
      username: "hmala",
      email: "",
      roleIds: ["reader"],
    });

    expect(user).toMatchObject({ kind: "person", email: null, handRoleIds: ["reader"] });
    expect(user.identities).toEqual([
      { instanceId: "pi24", externalId: "hmala", lastLoginAt: null },
    ]);
    expect(
      await refusalOf(
        createLocalAccount({ name: "Hana", username: "hmala", email: "", roleIds: [] }),
      ),
    ).toMatchObject({ status: 409 });
  });
});

describe("groups and custodies", () => {
  it("creates a group with no members, custody or projects, and sets its members", async () => {
    signInAs("admin");
    const group = await createGroup({ name: "Maps Curators", description: "" });

    expect(group).toMatchObject({ memberIds: [], categoryIds: [] });
    expect(
      await setGroupMembers({ recordId: group.id, body: { userIds: ["u1", "u4"] } }),
    ).toMatchObject({ memberIds: ["u1", "u4"] });
  });

  it("keeps the fallback's name and the fallback itself", async () => {
    signInAs("admin");

    expect(
      await refusalOf(saveCustody({ custodyId: "pc0", draft: { name: "Other", description: "" } })),
    ).toMatchObject({ status: 422, code: "access.fallback" });
    expect(await refusalOf(deleteCustody("pc0"))).toMatchObject({ status: 422 });
  });

  it("takes people only as members of a custody", async () => {
    signInAs("admin");

    expect(
      await refusalOf(
        setCustodyMembers({ recordId: "pc2", body: { userIds: ["a2"], groupIds: [] } }),
      ),
    ).toMatchObject({ status: 404 });
  });

  it("holds nothing in a new custody until a rule names it", async () => {
    signInAs("admin");
    const custody = await createCustody({ name: "Maps", description: "Cartographic material." });

    expect(custody).toMatchObject({ openCount: 0, placedByIds: [], isFallback: false });
  });

  it("keeps a renamed custody's rule placing into it (ACCESS-custody-rename)", async () => {
    signInAs("admin");
    const countOf = async () =>
      (await getAccessIndex()).custodies.find((custody) => custody.id === "pc2");
    const before = await countOf();
    await saveCustody({
      custodyId: "pc2",
      draft: { name: "Prints 1800–1899", description: "Anything published 1800–1899." },
    });

    expect(await countOf()).toMatchObject({
      name: "Prints 1800–1899",
      placedByIds: ["pi34"],
      openCount: before?.openCount,
    });
  });

  it("places a deleted custody's proposals in the fallback", async () => {
    signInAs("admin");
    const impact = await getCustodyImpact("pc1");
    expect(impact.ruleIds).toEqual(["pi25"]);
    expect(impact.toFallbackCount).toBeGreaterThan(0);
    expect(impact.toFallbackCount).toBeLessThan(impact.openCount);

    const before = await getAccessIndex();
    const countOf = (index: AccessIndex, custodyId: string) =>
      index.custodies.find((custody) => custody.id === custodyId)?.openCount ?? 0;
    await deleteCustody("pc1");
    const after = await getAccessIndex();

    expect(after.custodies.some((custody) => custody.id === "pc1")).toBe(false);
    expect(countOf(after, "pc0")).toBe(countOf(before, "pc0") + impact.toFallbackCount);
    // ACCESS-custody-delete: its rule still names it, and places nothing until another is picked.
    const rule = (await getPluginIndex()).instances.find((instance) => instance.id === "pi25");
    expect(rule?.settings).toEqual({ kind: "Custody", custodyId: "pc1" });
  });
});
