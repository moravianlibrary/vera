// Generated once from docs/demos/shared/vera-data.js so the mock API serves the same coherent
// dataset the demos were designed against; edit by hand from here on. The demo's "today" is
// 2026-06-25: list dates and relative observations were resolved against it. Date-only demo
// values became 09:00 UTC.

import type { AccessGroup, Identity, MappedRole, Role } from "@vera/domain/access";

// The six shipped roles (ROLE-shipped): bundles, not a ladder, each named by its id.
const shippedRoles: readonly Omit<Role, "name" | "isShipped">[] = [
  {
    id: "reader",
    proposalBatchLimit: 10,
    proposalDailyLimit: 100,
    description: "Proposes and follows their own requests. Holds only self-scoped grants.",
    grants: [
      {
        permission: "request.create",
        scope: null,
      },
      {
        permission: "request.read_mine",
        scope: null,
      },
      {
        permission: "request.withdraw_own",
        scope: null,
      },
      {
        permission: "watch",
        scope: null,
      },
    ],
  },
  {
    id: "staff",
    proposalBatchLimit: 10,
    proposalDailyLimit: 300,
    description: "Library staff: the reader grants with a higher daily proposal limit.",
    grants: [
      {
        permission: "request.create",
        scope: null,
      },
      {
        permission: "request.read_mine",
        scope: null,
      },
      {
        permission: "request.withdraw_own",
        scope: null,
      },
      {
        permission: "watch",
        scope: null,
      },
    ],
  },
  // ROLE-shipped: runs projects with the staff limits; reads the documents of the projects they
  // are on in public detail (VIEW-documents-audience), and their intentions.
  {
    id: "project-user",
    proposalBatchLimit: 10,
    proposalDailyLimit: 300,
    description:
      "Starts projects and runs those they manage; follows the documents and intentions of the projects they are on.",
    grants: [
      { permission: "request.create", scope: null },
      { permission: "request.read_mine", scope: "project" },
      { permission: "request.withdraw_own", scope: null },
      { permission: "watch", scope: null },
      { permission: "project.read", scope: "project" },
      { permission: "project.create", scope: "any" },
      { permission: "project.edit", scope: "managed" },
      { permission: "project.manage_members", scope: "managed" },
      { permission: "project.delete", scope: "managed" },
      { permission: "intention.read", scope: "project" },
    ],
  },
  {
    id: "curator",
    proposalBatchLimit: null,
    proposalDailyLimit: null,
    description:
      "Decides proposals in their request custody; validates, classifies and publishes inside their category custody; decides projects.",
    grants: [
      {
        permission: "request.create",
        scope: null,
      },
      {
        permission: "request.read_mine",
        scope: null,
      },
      {
        permission: "request.withdraw_own",
        scope: null,
      },
      {
        permission: "watch",
        scope: null,
      },
      {
        permission: "task.read_own",
        scope: null,
      },
      {
        permission: "project.create",
        scope: "any",
      },
      {
        permission: "project.read",
        scope: "any",
      },
      {
        permission: "project.edit",
        scope: "managed",
      },
      {
        permission: "project.manage_members",
        scope: "managed",
      },
      {
        permission: "project.delete",
        scope: "managed",
      },
      {
        permission: "iteration.read",
        scope: "any",
      },
      {
        permission: "request.read",
        scope: "custody",
      },
      {
        permission: "iteration.recheck",
        scope: "custody",
      },
      {
        permission: "category.read",
        scope: "any",
      },
      {
        permission: "request.decide",
        scope: "custody",
      },
      {
        permission: "validation.approve",
        scope: "custody",
      },
      {
        permission: "validation.deny",
        scope: "custody",
      },
      {
        permission: "validation.revoke",
        scope: "custody",
      },
      {
        permission: "iteration.classify",
        scope: "custody",
      },
      {
        permission: "iteration.cancel",
        scope: "custody",
      },
      {
        permission: "iteration.resume",
        scope: "custody",
      },
      {
        permission: "iteration.publish",
        scope: "custody",
      },
      {
        permission: "request.read_ingest",
        scope: "custody",
      },
      {
        permission: "request.retry",
        scope: "custody",
      },
      {
        permission: "category.edit",
        scope: "custody",
      },
      {
        permission: "category.grant_custody",
        scope: "custody",
      },
      {
        permission: "project.decide",
        scope: "any",
      },
    ],
  },
  {
    id: "dig-curator",
    proposalBatchLimit: null,
    proposalDailyLimit: null,
    description: "Plans the work: lists, intentions, projects.",
    grants: [
      {
        permission: "request.create",
        scope: null,
      },
      {
        permission: "request.read_mine",
        scope: null,
      },
      {
        permission: "request.withdraw_own",
        scope: null,
      },
      {
        permission: "watch",
        scope: null,
      },
      {
        permission: "task.read_own",
        scope: null,
      },
      {
        permission: "iteration.read",
        scope: "any",
      },
      {
        permission: "request.read",
        scope: "any",
      },
      {
        permission: "category.read",
        scope: "any",
      },
      {
        permission: "list.read",
        scope: "any",
      },
      {
        permission: "list.create",
        scope: "any",
      },
      {
        permission: "list.edit",
        scope: "any",
      },
      {
        permission: "list.delete",
        scope: "any",
      },
      {
        permission: "intention.read",
        scope: "any",
      },
      {
        permission: "intention.edit",
        scope: "any",
      },
      { permission: "mix.read", scope: "any" },
      { permission: "mix.edit", scope: "any" },
      { permission: "request.decide", scope: "custody" },
      { permission: "validation.approve", scope: "custody" },
      { permission: "validation.deny", scope: "custody" },
      { permission: "validation.revoke", scope: "custody" },
      { permission: "iteration.recheck", scope: "custody" },
      { permission: "iteration.classify", scope: "custody" },
      { permission: "iteration.publish", scope: "custody" },
      { permission: "request.read_ingest", scope: "custody" },
      { permission: "request.retry", scope: "custody" },
      { permission: "category.edit", scope: "custody" },
      { permission: "category.grant_custody", scope: "custody" },
      { permission: "project.decide", scope: "any" },
      {
        permission: "project.read",
        scope: "any",
      },
      {
        permission: "project.create",
        scope: "any",
      },
      {
        permission: "project.edit",
        scope: "any",
      },
      {
        permission: "project.manage_members",
        scope: "any",
      },
      {
        permission: "project.delete",
        scope: "any",
      },
      {
        permission: "iteration.cancel",
        scope: "any",
      },
      {
        permission: "iteration.resume",
        scope: "any",
      },
    ],
  },
  {
    id: "admin",
    proposalBatchLimit: null,
    proposalDailyLimit: null,
    description: "Everything, at any scope.",
    grants: [
      {
        permission: "request.create",
        scope: null,
      },
      {
        permission: "request.read_mine",
        scope: null,
      },
      {
        permission: "request.withdraw_own",
        scope: null,
      },
      {
        permission: "request.read",
        scope: "any",
      },
      {
        permission: "request.decide",
        scope: "any",
      },
      {
        permission: "iteration.read",
        scope: "any",
      },
      {
        permission: "iteration.recheck",
        scope: "any",
      },
      {
        permission: "iteration.classify",
        scope: "any",
      },
      {
        permission: "validation.approve",
        scope: "any",
      },
      {
        permission: "validation.deny",
        scope: "any",
      },
      {
        permission: "validation.revoke",
        scope: "any",
      },
      {
        permission: "restriction.overrule",
        scope: "any",
      },
      {
        permission: "iteration.cancel",
        scope: "any",
      },
      {
        permission: "iteration.resume",
        scope: "any",
      },
      {
        permission: "iteration.publish",
        scope: "any",
      },
      {
        permission: "watch",
        scope: null,
      },
      {
        permission: "watchlist.manage_system",
        scope: "any",
      },
      {
        permission: "request.read_ingest",
        scope: "any",
      },
      {
        permission: "request.retry",
        scope: "any",
      },
      {
        permission: "request.read_payload",
        scope: "any",
      },
      {
        permission: "list.read",
        scope: "any",
      },
      {
        permission: "list.create",
        scope: "any",
      },
      {
        permission: "list.edit",
        scope: "any",
      },
      {
        permission: "list.delete",
        scope: "any",
      },
      {
        permission: "intention.read",
        scope: "any",
      },
      {
        permission: "intention.edit",
        scope: "any",
      },
      { permission: "mix.read", scope: "any" },
      { permission: "mix.edit", scope: "any" },
      { permission: "mix.manage", scope: "any" },
      {
        permission: "intention.repeat",
        scope: "any",
      },
      {
        permission: "project.read",
        scope: "any",
      },
      {
        permission: "project.create",
        scope: "any",
      },
      {
        permission: "project.edit",
        scope: "any",
      },
      {
        permission: "project.manage_members",
        scope: "any",
      },
      {
        permission: "project.delete",
        scope: "any",
      },
      {
        permission: "project.decide",
        scope: "any",
      },
      {
        permission: "category.read",
        scope: "any",
      },
      {
        permission: "category.edit",
        scope: "any",
      },
      {
        permission: "category.grant_custody",
        scope: "any",
      },
      {
        permission: "task.read_own",
        scope: null,
      },
      {
        permission: "task.read",
        scope: "any",
      },
      {
        permission: "task.cancel",
        scope: "any",
      },
      {
        permission: "task.schedule",
        scope: "any",
      },
      {
        permission: "plugin.read",
        scope: "any",
      },
      {
        permission: "plugin.configure",
        scope: "any",
      },
      {
        permission: "plugin.upload_code",
        scope: "any",
      },
      {
        permission: "plugin.run",
        scope: "any",
      },
      {
        permission: "hook.read",
        scope: "any",
      },
      {
        permission: "hook.configure",
        scope: "any",
      },
      {
        permission: "property.define",
        scope: "any",
      },
      {
        permission: "access.read",
        scope: "any",
      },
      {
        permission: "access.manage",
        scope: "any",
      },
    ],
  },
];

export const roles: readonly Role[] = shippedRoles.map((role) => ({
  ...role,
  name: role.id,
  isShipped: true,
}));

export const groups: readonly AccessGroup[] = [
  {
    id: "g1",
    name: "Periodicals Curators",
    description: "Curators of the periodicals collection.",
    categoryIds: ["c2"],
    memberIds: ["u1", "u8"],
  },
  {
    id: "g2",
    name: "Digitization Office",
    description: "Plans lists and runs the funded projects.",
    categoryIds: [],
    memberIds: ["u2", "u9"],
  },
  {
    id: "g3",
    name: "Reading Room",
    description: "Reading-room staff.",
    categoryIds: [],
    memberIds: ["u4"],
  },
];

// How each person signs in and holds their roles (docs/demos/shared/vera-data.js `users`): roles
// set by hand, and those the Identity instances mapped at their last login, from a claim
// (identity.md §4). Agents have no identity and hold what they were created with. Adam Kolář
// logged in through Local accounts, whose default role is none, and holds nothing yet.
export interface UserAccess {
  readonly handRoleIds: readonly string[];
  readonly mappedRoles: readonly MappedRole[];
  readonly identities: readonly Identity[];
  readonly entry: string | null;
  // ACCESS-suspend: absent or null while they may log in.
  readonly suspendedAt?: string | null;
}

const keycloak = "pi22";
const eduId = "pi23";
const localAccounts = "pi24";

function loginAt(month: number, day: number, hours = 9, minutes = 0): string {
  return new Date(2026, month - 1, day, hours, minutes).toISOString();
}

function person(
  handRoleIds: readonly string[],
  mappedRoles: readonly MappedRole[],
  identities: readonly Identity[],
): UserAccess {
  return { handRoleIds, mappedRoles, identities, entry: null };
}

const mapped = (roleId: string, claim: string, instanceId = keycloak): MappedRole => ({
  roleId,
  instanceId,
  claim,
});

export const userAccess: Readonly<Record<string, UserAccess>> = {
  u1: person(
    [],
    [mapped("curator", "group mzk-curators")],
    [{ instanceId: keycloak, externalId: "jnovakova", lastLoginAt: loginAt(6, 25, 8, 12) }],
  ),
  u2: person(
    [],
    [mapped("dig-curator", "group mzk-digitization")],
    [{ instanceId: keycloak, externalId: "msvoboda", lastLoginAt: loginAt(6, 25, 7, 55) }],
  ),
  u3: person(
    ["admin"],
    [mapped("staff", "group mzk-staff")],
    [
      { instanceId: keycloak, externalId: "pdvorak", lastLoginAt: loginAt(6, 25, 9, 1) },
      { instanceId: localAccounts, externalId: "admin", lastLoginAt: loginAt(6, 2) },
    ],
  ),
  u4: person(
    [],
    [mapped("staff", "group mzk-staff")],
    [{ instanceId: keycloak, externalId: "ehorakova", lastLoginAt: loginAt(6, 24, 16, 20) }],
  ),
  u8: person(
    ["curator"],
    [mapped("staff", "group mzk-staff")],
    [{ instanceId: keycloak, externalId: "knovotna", lastLoginAt: loginAt(6, 19) }],
  ),
  u9: person(
    ["project-user"],
    [mapped("staff", "group mzk-staff")],
    [{ instanceId: keycloak, externalId: "rsimek", lastLoginAt: loginAt(6, 21) }],
  ),
  u5: person(
    [],
    [mapped("reader", "default role", eduId)],
    [{ instanceId: eduId, externalId: "marek@muni.cz", lastLoginAt: loginAt(6, 18) }],
  ),
  u6: person(
    ["reader"],
    [],
    [{ instanceId: localAccounts, externalId: "lbenesova", lastLoginAt: loginAt(6, 12) }],
  ),
  u7: person(
    ["reader"],
    [],
    [{ instanceId: localAccounts, externalId: "okrejci", lastLoginAt: loginAt(5, 3) }],
  ),
  u10: person(
    [],
    [],
    [{ instanceId: localAccounts, externalId: "akolar", lastLoginAt: loginAt(6, 25, 8, 40) }],
  ),
  a1: { handRoleIds: ["reader"], mappedRoles: [], identities: [], entry: "Additions" },
  a2: { handRoleIds: ["reader"], mappedRoles: [], identities: [], entry: "Proposals" },
  a3: { handRoleIds: ["reader"], mappedRoles: [], identities: [], entry: null },
};

// Custody granted to people directly, by category (the demo's `categoryMembers`); groups carry
// theirs on the group. The mock database starts from both, and Grant custody… writes there.
export const categoryMembers: Readonly<Record<string, readonly string[]>> = {
  c4: ["u8"],
};
