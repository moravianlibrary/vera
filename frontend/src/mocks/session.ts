// Resolves the emulated user into a session the way the server would: roles held directly or
// mapped by an Identity plugin, grants as the union of those roles, and category custody from
// groups plus direct membership (permissions.md §1, §4).

import type { MockUserProfile } from "@/config/env";
import type { Session } from "@/domain/entities";
import type { Grant } from "@/domain/permissions";
import { database } from "@/mocks/database";
import { directCustody, groups, roleAssignments, roles } from "@/mocks/fixtures/access";

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

  const roleIds = roleAssignments[userId] ?? [];
  return {
    user,
    roleIds: [...roleIds],
    grants: grantsOf(roleIds),
    custodyCategoryIds: custodyOf(userId),
    groupIds: groups.filter((group) => group.memberIds.includes(userId)).map(({ id }) => id),
  };
}

// The same permission held at several scopes stays several grants; the widest one wins later.
function grantsOf(roleIds: readonly string[]): Grant[] {
  const held = roles.filter((role) => roleIds.includes(role.id)).flatMap((role) => role.grants);
  const unique = new Map(held.map((grant) => [`${grant.permission}@${grant.scope}`, grant]));
  return [...unique.values()];
}

function custodyOf(userId: string): string[] {
  const viaGroups = groups
    .filter((group) => group.memberIds.includes(userId))
    .flatMap((group) => group.categoryIds);
  return [...new Set([...viaGroups, ...(directCustody[userId] ?? [])])];
}
