// Users, roles, groups and proposal custody as the server keeps them, and what follows from them
// (permissions.md §1, §4, §6; identity.md §2, §4; proposal-custody.md §2). A role is held by
// hand or mapped by an Identity instance from a claim, never through a group; a group gives
// category custody, proposal custody and project membership. Every answer keeps its provenance,
// since "how they came to it" is part of the answer (permissions.md §6). The mock resolves
// sessions with these, and Users & Groups shows them.

import { z } from "zod";
import { proposalCustodySchema, userSchema } from "@/domain/entities";
import type { Grant, GrantScope, Permission } from "@/domain/permissions";
import { catalogOrderOf, grantSchema } from "@/domain/permissions";

const id = z.string().min(1);
const timestamp = z.iso.datetime();

// ---------------------------------------------------------------- records

export const roleSchema = z.object({
  id,
  name: z.string().min(1),
  description: z.string(),
  // Came with VERA; editable all the same (decided 2026-09-26).
  isShipped: z.boolean(),
  grants: z.array(grantSchema),
});
export type Role = z.infer<typeof roleSchema>;

// A role an Identity instance gave at the person's last login, from one of their claims.
export const mappedRoleSchema = z.object({
  roleId: id,
  instanceId: id,
  // "group mzk-curators", or "default role".
  claim: z.string(),
});
export type MappedRole = z.infer<typeof mappedRoleSchema>;

// One way in: found by (instance, external id), never by a name (identity.md §2).
export const identitySchema = z.object({
  instanceId: id,
  externalId: z.string().min(1),
  lastLoginAt: timestamp.nullable(),
});
export type Identity = z.infer<typeof identitySchema>;

export const accessUserSchema = userSchema.extend({
  // Where an agent's proposals enter, which is why they go through review.
  entry: z.string().nullable(),
  handRoleIds: z.array(id),
  mappedRoles: z.array(mappedRoleSchema),
  groupIds: z.array(id),
  // None for an agent: it is created with its plugin and never logs in.
  identities: z.array(identitySchema),
});
export type AccessUser = z.infer<typeof accessUserSchema>;

export const accessGroupSchema = z.object({
  id,
  name: z.string().min(1),
  description: z.string(),
  memberIds: z.array(id),
  // Category custody the group holds; project membership is on the project.
  categoryIds: z.array(id),
});
export type AccessGroup = z.infer<typeof accessGroupSchema>;

export const custodyRecordSchema = proposalCustodySchema.extend({
  memberIds: z.array(id),
  groupIds: z.array(id),
  // Open proposals the Custody rules placed in it now, counted by document.
  openCount: z.number().int().nonnegative(),
  // The Custody instances whose rule can name it.
  placedByIds: z.array(id),
});
export type CustodyRecord = z.infer<typeof custodyRecordSchema>;

export const identityInstanceSchema = z.object({
  id,
  name: z.string(),
  // The claim it returns as the user id; fixed once users exist (identity.md §1).
  userIdClaim: z.string(),
  // What a user first seen through it gets: null gives nothing, and they see "no access yet".
  defaultRoleId: id.nullable(),
  mappings: z.array(z.object({ claim: z.string(), roleId: id })),
  isLocal: z.boolean(),
});
export type IdentityInstance = z.infer<typeof identityInstanceSchema>;

// Category custody held by people directly; a group's is on the group.
export const categoryMembershipSchema = z.object({
  categoryId: id,
  userIds: z.array(id),
});
export type CategoryMembership = z.infer<typeof categoryMembershipSchema>;

export const projectMembershipSchema = z.object({
  id,
  name: z.string(),
  managerId: id,
  memberIds: z.array(id),
  memberGroupIds: z.array(id),
});
export type ProjectMembership = z.infer<typeof projectMembershipSchema>;

// ---------------------------------------------------------------- roles and how they are held

export type RoleWay = { by: "hand" } | { by: "mapped"; instanceId: string; claim: string };

export interface HeldRole {
  roleId: string;
  ways: RoleWay[];
}

interface RoleHolder {
  readonly handRoleIds: readonly string[];
  readonly mappedRoles: readonly MappedRole[];
}

// Each role the person holds with every way it reaches them: by hand first, then each mapping.
// Held two ways is not a conflict; removing the hand-set one leaves the mapped one.
export function heldRolesOf(user: RoleHolder): HeldRole[] {
  const held = new Map<string, RoleWay[]>();
  const add = (roleId: string, way: RoleWay) =>
    held.set(roleId, [...(held.get(roleId) ?? []), way]);
  for (const roleId of user.handRoleIds) {
    add(roleId, { by: "hand" });
  }

  for (const mapped of user.mappedRoles) {
    add(mapped.roleId, { by: "mapped", instanceId: mapped.instanceId, claim: mapped.claim });
  }

  return [...held.entries()].map(([roleId, ways]) => ({ roleId, ways }));
}

export function heldRoleIdsOf(user: RoleHolder): string[] {
  return heldRolesOf(user).map(({ roleId }) => roleId);
}

export function isMappedOnly(ways: readonly RoleWay[]): boolean {
  return ways.every((way) => way.by === "mapped");
}

export function holdersOf<User extends RoleHolder>(
  users: readonly User[],
  roleId: string,
): { user: User; ways: RoleWay[] }[] {
  return users.flatMap((user) => {
    const held = heldRolesOf(user).find((candidate) => candidate.roleId === roleId);
    return held === undefined ? [] : [{ user, ways: held.ways }];
  });
}

// The Identity instances that give the role: as their default, or from a claim.
export function mappingsOf(
  instances: readonly IdentityInstance[],
  roleId: string,
): { instanceId: string; claim: string | null }[] {
  return instances.flatMap((instance) => [
    ...(instance.defaultRoleId === roleId ? [{ instanceId: instance.id, claim: null }] : []),
    ...instance.mappings
      .filter((mapping) => mapping.roleId === roleId)
      .map((mapping) => ({ instanceId: instance.id, claim: mapping.claim })),
  ]);
}

// ---------------------------------------------------------------- what they may do

// Grants union across roles: the same permission held at several scopes stays several grants,
// and the widest one wins where it is checked.
export function grantsOf(roles: readonly Role[], roleIds: readonly string[]): Grant[] {
  const held = roles.filter((role) => roleIds.includes(role.id)).flatMap((role) => role.grants);
  const unique = new Map(held.map((grant) => [`${grant.permission}@${grant.scope}`, grant]));
  return [...unique.values()];
}

const scopeRanks = { custody: 1, project: 1, managed: 1, any: 2 } as const;

function rankOf(scope: GrantScope): number {
  return scope === null ? 0 : scopeRanks[scope];
}

export interface EffectivePermission {
  permission: Permission;
  // The widest the person holds it at; null when self-scoped.
  scope: GrantScope;
  // Every held role that gives it.
  roleIds: string[];
}

// What the person may do, each permission once at its widest, with the roles it comes from.
export function effectivePermissionsOf(
  roles: readonly Role[],
  roleIds: readonly string[],
): EffectivePermission[] {
  const effective = new Map<Permission, EffectivePermission>();
  for (const role of roles.filter((candidate) => roleIds.includes(candidate.id))) {
    for (const grant of role.grants) {
      const held = effective.get(grant.permission);
      if (held === undefined) {
        effective.set(grant.permission, { ...grant, roleIds: [role.id] });
        continue;
      }

      held.roleIds.push(role.id);
      if (rankOf(grant.scope) > rankOf(held.scope)) {
        held.scope = grant.scope;
      }
    }
  }

  return [...effective.values()].toSorted(
    (first, second) => catalogOrderOf(first.permission) - catalogOrderOf(second.permission),
  );
}

// Who could still manage access: refused when an act would leave nobody (view-catalog.md).
export function managersOf<User extends RoleHolder>(
  users: readonly User[],
  roles: readonly Role[],
): User[] {
  return users.filter((user) =>
    grantsOf(roles, heldRoleIdsOf(user)).some((grant) => grant.permission === "access.manage"),
  );
}

// A role includes another when it holds every grant of it at least as wide. Only the nearest are
// named: admin includes curator and dig-curator, not also staff and reader under them.
export function includedRolesOf(roles: readonly Role[], role: Role): Role[] {
  const covers = (wider: Role, narrower: Role) =>
    wider.id !== narrower.id &&
    narrower.grants.length > 0 &&
    narrower.grants.every((grant) =>
      wider.grants.some(
        (held) =>
          held.permission === grant.permission &&
          (held.scope === grant.scope || rankOf(held.scope) > rankOf(grant.scope)),
      ),
    );
  const included = roles.filter((other) => covers(role, other));
  return included.filter(
    (other) => !included.some((between) => between.id !== other.id && covers(between, other)),
  );
}

// What a proposal custody's member can do with its proposals, through their roles: decide, only
// see, or nothing at all, since membership is not capability (proposal-custody.md §2).
export type ProposalReach = "decides" | "sees" | null;

export function proposalReachOf(roles: readonly Role[], roleIds: readonly string[]): ProposalReach {
  const grants = grantsOf(roles, roleIds);
  const reaches = (permission: Permission) =>
    grants.some(
      (grant) =>
        grant.permission === permission && (grant.scope === "custody" || grant.scope === "any"),
    );
  if (reaches("request.decide")) {
    return "decides";
  }

  return reaches("request.read") ? "sees" : null;
}

// ---------------------------------------------------------------- what they are responsible for

// Directly, or via a group (its id).
export type Via = string | null;

export function categoryCustodyOf(
  userId: string,
  groups: readonly AccessGroup[],
  memberships: readonly CategoryMembership[],
): { categoryId: string; via: Via }[] {
  return [
    ...memberships
      .filter((membership) => membership.userIds.includes(userId))
      .map((membership) => ({ categoryId: membership.categoryId, via: null })),
    ...groups
      .filter((group) => group.memberIds.includes(userId))
      .flatMap((group) => group.categoryIds.map((categoryId) => ({ categoryId, via: group.id }))),
  ];
}

type CustodyMembers = Pick<CustodyRecord, "id" | "memberIds" | "groupIds">;

export function proposalCustodyOf(
  userId: string,
  groups: readonly AccessGroup[],
  custodies: readonly CustodyMembers[],
): { custodyId: string; via: Via }[] {
  const groupIds = groups.filter((group) => group.memberIds.includes(userId)).map(({ id }) => id);
  return custodies.flatMap((custody) => [
    ...(custody.memberIds.includes(userId) ? [{ custodyId: custody.id, via: null }] : []),
    ...custody.groupIds
      .filter((groupId) => groupIds.includes(groupId))
      .map((groupId) => ({ custodyId: custody.id, via: groupId })),
  ]);
}

// Everyone a custody reaches, each with every way: directly (null) and through which groups.
export function custodyMembersOf(
  custody: CustodyMembers,
  groups: readonly AccessGroup[],
): { userId: string; via: Via[] }[] {
  const members = new Map<string, Via[]>();
  for (const userId of custody.memberIds) {
    members.set(userId, [null]);
  }

  for (const group of groups.filter((candidate) => custody.groupIds.includes(candidate.id))) {
    for (const userId of group.memberIds) {
      members.set(userId, [...(members.get(userId) ?? []), group.id]);
    }
  }

  return [...members.entries()].map(([userId, via]) => ({ userId, via }));
}

export type ProjectVia = "manager" | "member" | { groupId: string };

export interface ProjectPlace {
  projectId: string;
  via: ProjectVia;
}

export function projectsOf(
  userId: string,
  groups: readonly AccessGroup[],
  projects: readonly ProjectMembership[],
): ProjectPlace[] {
  const groupIds = groups.filter((group) => group.memberIds.includes(userId)).map(({ id }) => id);
  return projects.flatMap((project): ProjectPlace[] => {
    if (project.managerId === userId) {
      return [{ projectId: project.id, via: "manager" }];
    }

    if (project.memberIds.includes(userId)) {
      return [{ projectId: project.id, via: "member" }];
    }

    return project.memberGroupIds
      .filter((groupId) => groupIds.includes(groupId))
      .map((groupId) => ({ projectId: project.id, via: { groupId } }));
  });
}

// ---------------------------------------------------------------- changing a role

export interface GrantChange {
  // Granted where it was not, or at another scope.
  added: Grant[];
  removed: Grant[];
}

export function grantChangeOf(before: readonly Grant[], after: readonly Grant[]): GrantChange {
  const scopeIn = (grants: readonly Grant[], permission: Permission) =>
    grants.find((grant) => grant.permission === permission)?.scope;
  return {
    added: after.filter((grant) => scopeIn(before, grant.permission) !== grant.scope),
    removed: before.filter((grant) => scopeIn(after, grant.permission) === undefined),
  };
}

export interface PersonReached<User> {
  user: User;
  ways: RoleWay[];
  // What they hold after the change and did not, or hold narrower; and what they no longer hold
  // through any role.
  gains: EffectivePermission[];
  loses: EffectivePermission[];
}

// Who a role's new grants reach, and what each of them actually gains or loses once their other
// roles are counted: an admin who also holds curator loses nothing when curator narrows.
export function roleChangeReachOf<User extends RoleHolder>(
  users: readonly User[],
  roles: readonly Role[],
  roleId: string,
  grants: readonly Grant[],
): PersonReached<User>[] {
  const changed = roles.map((role) =>
    role.id === roleId ? { ...role, grants: [...grants] } : role,
  );
  return holdersOf(users, roleId).map(({ user, ways }) => {
    const held = heldRoleIdsOf(user);
    const before = effectivePermissionsOf(roles, held);
    const after = effectivePermissionsOf(changed, held);
    const scopeIn = (permissions: readonly EffectivePermission[], permission: Permission) =>
      permissions.find((candidate) => candidate.permission === permission)?.scope;
    return {
      user,
      ways,
      gains: after.filter(
        (permission) =>
          scopeIn(before, permission.permission) === undefined ||
          rankOf(permission.scope) > rankOf(scopeIn(before, permission.permission) ?? null),
      ),
      loses: before.filter((permission) => scopeIn(after, permission.permission) === undefined),
    };
  });
}

// Shipped roles are lower-case words joined by hyphens; a new one is named the same way.
export function roleNameOf(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, "-");
}
