// The derivations Users & Groups shows and the mock resolves sessions with: roles and how they
// are held, permissions at their widest with the roles they come from, which roles include
// which, and who a role's change reaches, against the shipped fixtures.

import type { AccessGroup, Role } from "@vera/domain/access";
import {
  custodyMembersOf,
  effectivePermissionsOf,
  grantChangeOf,
  heldRolesOf,
  includedRolesOf,
  projectsOf,
  requestReachOf,
  roleChangeReachOf,
  roleNameOf,
} from "@vera/domain/access";
import { isAcceptedGrant, missingRequirementsOf, withRequirements } from "@vera/domain/permissions";
import { describe, expect, it } from "vitest";
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
    expect(includedRolesOf(roles, roleOf("staff")).map(({ id }) => id)).toEqual([]);
    expect(includedRolesOf(roles, roleOf("reader")).map(({ id }) => id)).toEqual([]);
    expect(includedRolesOf(roles, roleOf("curator")).map(({ id }) => id)).toEqual([
      "reader",
      "staff",
    ]);
    expect(includedRolesOf(roles, roleOf("project-user")).map(({ id }) => id)).toEqual([
      "reader",
      "staff",
    ]);
    expect(includedRolesOf(roles, roleOf("dig-curator")).map(({ id }) => id)).toEqual(["curator"]);
    expect(includedRolesOf(roles, roleOf("admin")).map(({ id }) => id)).toEqual(["dig-curator"]);
  });
});

describe("requestReachOf", () => {
  it("decides with request.decide, sees with request.read, and nothing with neither", () => {
    expect(requestReachOf(roles, ["curator"])).toBe("decides");
    expect(requestReachOf(roles, ["staff"])).toBeNull();
    expect(requestReachOf(roles, ["reader"])).toBeNull();
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
  it("keeps every manager, direct member, and group route", () => {
    const projects = [
      { id: "p1", name: "One", managerId: "u2", memberIds: ["u2", "u1"], memberGroupIds: [] },
      { id: "p2", name: "Two", managerId: "u2", memberIds: [], memberGroupIds: ["g1"] },
    ];

    expect(projectsOf("u2", groups, projects).map(({ via }) => via)).toEqual([
      "manager",
      "member",
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

describe("PERM-requires", () => {
  it("holds for every shipped role", () => {
    expect(
      roles.flatMap((role) =>
        missingRequirementsOf(role.grants).map(
          ({ grant, needs }) => `${role.id}: ${grant.permission} needs ${needs.permission}`,
        ),
      ),
    ).toEqual([]);
  });

  it("asks for a need at a scope covering the grant's, project covering managed", () => {
    expect(
      missingRequirementsOf([
        { permission: "iteration.recheck", scope: "custody" },
        { permission: "iteration.read", scope: "project" },
        { permission: "project.edit", scope: "managed" },
        { permission: "project.read", scope: "project" },
      ]),
    ).toEqual([
      {
        grant: { permission: "iteration.recheck", scope: "custody" },
        needs: { permission: "iteration.read", scope: "custody" },
      },
    ]);
  });

  it("asks for any where marked, and is met by a self-scoped need held at all", () => {
    expect(
      missingRequirementsOf([
        { permission: "watchlist.manage_system", scope: "any" },
        { permission: "watch", scope: null },
        { permission: "iteration.read", scope: "custody" },
      ]).map(({ needs }) => needs),
    ).toEqual([
      { permission: "request.read_mine", scope: null },
      { permission: "iteration.read", scope: "any" },
    ]);
  });

  it("lets request.read_mine at project cover a need at own", () => {
    expect(
      missingRequirementsOf([
        { permission: "request.create", scope: null },
        { permission: "request.read_mine", scope: "project" },
      ]),
    ).toEqual([]);
  });

  it("lets project.create stand on project.read at any scope", () => {
    expect(
      missingRequirementsOf([
        { permission: "project.create", scope: "any" },
        { permission: "project.read", scope: "project" },
      ]),
    ).toEqual([]);
  });

  it("ticks what is needed, transitively, widening and never narrowing", () => {
    expect(
      withRequirements([
        { permission: "intention.repeat", scope: "any" },
        { permission: "validation.deny", scope: "custody" },
        { permission: "iteration.read", scope: "project" },
      ]),
    ).toEqual([
      { permission: "intention.repeat", scope: "any" },
      { permission: "validation.deny", scope: "custody" },
      { permission: "intention.edit", scope: "any" },
      { permission: "iteration.read", scope: "any" },
      { permission: "intention.read", scope: "any" },
      { permission: "mix.read", scope: "any" },
    ]);
  });
});
