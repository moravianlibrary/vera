// Resolves the emulated user into a session the way the server would: roles held by hand or
// mapped by an Identity plugin, grants as the union of those roles, and category custody from
// groups plus direct membership (permissions.md §1, §4). Read afresh on every request, so a role
// changed on Users & Groups reaches the next one.

import type { MockUserProfile } from "@/config/env";
import type { AccessUser } from "@/domain/access";
import { grantsOf, heldRoleIdsOf } from "@/domain/access";
import type { Session } from "@/domain/entities";
import type { Permission } from "@/domain/permissions";
import { database } from "@/mocks/database";

const userIdsByProfile = {
  admin: "u3",
  curator: "u8",
  digitization: "u2",
  staff: "u4",
  reader: "u5",
  "no-access": "u10",
} as const satisfies Record<MockUserProfile, string>;

export function resolveSession(profile: MockUserProfile): Session {
  const userId = userIdsByProfile[profile];
  const user = database.users.find((candidate) => candidate.id === userId);
  if (user === undefined) {
    throw new Error(`Mock profile "${profile}" points at unknown user "${userId}"`);
  }

  const roleIds = roleIdsOf(userId);
  return {
    user,
    roleIds,
    grants: grantsOf(database.roles, roleIds),
    custodyCategoryIds: custodyOf(userId),
    groupIds: database.groups
      .filter((group) => group.memberIds.includes(userId))
      .map(({ id }) => id),
  };
}

// The roles a person holds now, however they hold them; none for somebody never given one.
export function roleIdsOf(userId: string): string[] {
  const access = database.userAccess[userId];
  return access === undefined ? [] : heldRoleIdsOf(access);
}

// Everyone holding the permission through some role, at any scope.
export function holdersOfPermission(permission: Permission): string[] {
  return database.users
    .filter((user) =>
      grantsOf(database.roles, roleIdsOf(user.id)).some((grant) => grant.permission === permission),
    )
    .map(({ id }) => id);
}

// A user as Users & Groups shows them: who they are, how they hold their roles and sign in.
export function accessUserOf(user: Session["user"]): AccessUser {
  const access = database.userAccess[user.id];
  return {
    ...user,
    entry: access?.entry ?? null,
    handRoleIds: [...(access?.handRoleIds ?? [])],
    mappedRoles: [...(access?.mappedRoles ?? [])],
    groupIds: database.groups
      .filter((group) => group.memberIds.includes(user.id))
      .map(({ id }) => id),
    identities: [...(access?.identities ?? [])],
  };
}

function custodyOf(userId: string): string[] {
  const viaGroups = database.groups
    .filter((group) => group.memberIds.includes(userId))
    .flatMap((group) => group.categoryIds);
  const direct = Object.entries(database.categoryMembers)
    .filter(([, memberIds]) => memberIds.includes(userId))
    .map(([categoryId]) => categoryId);
  return [...new Set([...viaGroups, ...direct])];
}
