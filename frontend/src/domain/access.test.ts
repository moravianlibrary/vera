// The derivations Users & Groups shows and the mock resolves sessions with: roles and how they
// are held, permissions at their widest with the roles they come from, which roles include
// which, and who a role's change reaches, against the shipped fixtures.

import { describe, expect, it } from "vitest";
import type { AccessGroup, Role } from "@/domain/access";
import {
  custodyMembersOf,
  effectivePermissionsOf,
  grantChangeOf,
  heldRolesOf,
  includedRolesOf,
  projectsOf,
  proposalReachOf,
  roleChangeReachOf,
  roleNameOf,
} from "@/domain/access";
import { isAcceptedGrant } from "@/domain/permissions";
import { roles } from "@/mocks/fixtures/access";

const roleOf = (roleId: string): Role => {
  const role = roles.find((candidate) => candidate.id === roleId);
  if (role === undefined) {
    throw new Error(`no role ${roleId}`);
  }

  return role;
};

const groups: AccessGroup[] = [
  { id: "g1", name: "Periodicals", description: "", memberIds: ["u1", "u8"], categoryIds: ["c2"] },
];

describe("heldRolesOf", () => {
  it("merges a role held by hand and mapped into one, by hand first", () => {
    expect(
      heldRolesOf({
        handRoleIds: ["staff"],
        mappedRoles: [{ roleId: "staff", instanceId: "pi22", claim: "group mzk-staff" }],
      }),
    ).toEqual([
      {
        roleId: "staff",
        ways: [{ by: "hand" }, { by: "mapped", instanceId: "pi22", claim: "group mzk-staff" }],
      },
    ]);
  });
});

describe("effectivePermissionsOf", () => {
  it("keeps each permission once, at its widest, with every role that gives it", () => {
    const permissions = effectivePermissionsOf(roles, ["curator", "dig-curator"]);
    const cancel = permissions.find((held) => held.permission === "iteration.cancel");

    expect(cancel).toEqual({
      permission: "iteration.cancel",
      scope: "any",
      roleIds: ["curator", "dig-curator"],
    });
    expect(permissions[0]?.permission).toBe("request.create");
  });
});

describe("includedRolesOf", () => {
  it("names only the nearest roles a role holds all of", () => {
    expect(includedRolesOf(roles, roleOf("staff")).map(({ id }) => id)).toEqual(["reader"]);
    expect(includedRolesOf(roles, roleOf("curator")).map(({ id }) => id)).toEqual(["staff"]);
    expect(includedRolesOf(roles, roleOf("admin")).map(({ id }) => id)).toEqual([
      "curator",
      "dig-curator",
    ]);
  });
});

describe("proposalReachOf", () => {
  it("decides with request.decide, sees with request.read, and nothing with neither", () => {
    expect(proposalReachOf(roles, ["curator"])).toBe("decides");
    expect(proposalReachOf(roles, ["staff"])).toBe("sees");
    expect(proposalReachOf(roles, ["reader"])).toBeNull();
  });
});

describe("custodyMembersOf", () => {
  it("names each member once, with every way they are in", () => {
    expect(custodyMembersOf({ id: "pc1", memberIds: ["u8"], groupIds: ["g1"] }, groups)).toEqual([
      { userId: "u8", via: [null, "g1"] },
      { userId: "u1", via: ["g1"] },
    ]);
  });
});

describe("projectsOf", () => {
  it("says manager, member or via which group", () => {
    const projects = [
      { id: "p1", name: "One", managerId: "u2", memberIds: ["u2", "u1"], memberGroupIds: [] },
      { id: "p2", name: "Two", managerId: "u2", memberIds: [], memberGroupIds: ["g1"] },
    ];

    expect(projectsOf("u2", groups, projects).map(({ via }) => via)).toEqual([
      "manager",
      "manager",
    ]);
    expect(projectsOf("u1", groups, projects)).toEqual([
      { projectId: "p1", via: "member" },
      { projectId: "p2", via: { groupId: "g1" } },
    ]);
  });
});

describe("roleChangeReachOf", () => {
  const users = [
    { id: "u1", handRoleIds: ["curator"], mappedRoles: [] },
    { id: "u3", handRoleIds: ["admin", "curator"], mappedRoles: [] },
  ];

  it("says what each holder actually gains or loses, once their other roles count", () => {
    const narrowed = roleOf("curator").grants.filter(
      (grant) => grant.permission !== "project.decide",
    );
    const reached = roleChangeReachOf(users, roles, "curator", narrowed);

    expect(
      reached.map(({ user, loses }) => [user.id, loses.map((held) => held.permission)]),
    ).toEqual([
      ["u1", ["project.decide"]],
      ["u3", []],
    ]);
  });

  it("lists a grant widened as added", () => {
    const before = [{ permission: "iteration.read" as const, scope: "custody" as const }];
    const after = [{ permission: "iteration.read" as const, scope: "any" as const }];

    expect(grantChangeOf(before, after)).toEqual({ added: after, removed: [] });
  });
});

describe("the catalogue", () => {
  it("accepts every shipped grant", () => {
    expect(roles.flatMap((role) => role.grants).every(isAcceptedGrant)).toBe(true);
  });

  it("names a role in lower case, words joined by hyphens", () => {
    expect(roleNameOf("  Maps  Curator ")).toBe("maps-curator");
  });
});
