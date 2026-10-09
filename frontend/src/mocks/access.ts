// What the server does for Users & Groups (view-catalog.md; permissions.md §1, §4; identity.md;
// proposal-custody.md §2, §7): with `access.read`, every user, role, group and proposal custody
// and what links them; with `access.manage`, changing them. It refuses whatever would leave
// nobody able to manage access, a grant at a scope its permission does not take, and a name or
// an identity already taken. Mapped roles are the providers' and are never written here. Deleting
// a custody places every open proposal again, which the mock does at once: a proposal it alone
// held lands in the fallback, and a rule still naming it names nothing.
// TODO(rrandiak): log these as `access` events (status-log.md §3) once the log has subjects other
// than documents; run the re-placing as a task on Tasks.

import type {
  AccessIndex,
  CustodyImpact,
  CustodyMembers,
  GroupMembers,
  HandRoles,
  IdentityLink,
  LocalAccount,
  RecordDraft,
  RoleDraft,
  RoleImpact,
  UserGroups,
} from "@/api/access";
import type { AccessGroup, AccessUser, CustodyRecord, Identity, Role } from "@/domain/access";
import { heldRoleIdsOf, holdersOf, managersOf, mappingsOf, roleNameOf } from "@/domain/access";
import type { Session } from "@/domain/entities";
import { isShared } from "@/domain/entities";
import { hasPermission, isAcceptedGrant } from "@/domain/permissions";
import { database } from "@/mocks/database";
import type { UserAccess } from "@/mocks/fixtures/access";
import type { StoredProposalCustody } from "@/mocks/fixtures/proposal-custodies";
import type { Outcome, Refusal } from "@/mocks/mutations";
import { custodyRules, identityInstances } from "@/mocks/plugin-instances";
import { openProposalPlacements } from "@/mocks/proposal-review";
import { accessUserOf } from "@/mocks/session";
import { mockNow } from "@/mocks/today";
import { audienceReachOf } from "@/mocks/watchlists";

export function canReadAccess(session: Session): boolean {
  return hasPermission(session, "access.read");
}

const mayNotManage: Refusal = { status: 403, message: "You may not change users, groups or roles" };

const lastManager: Refusal = {
  status: 409,
  code: "access.last_manager",
  message: "Nobody could manage access after this",
};

// ---------------------------------------------------------------- the page

function openProposalCountsByCustody(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const custodyId of openProposalPlacements().flat()) {
    counts.set(custodyId, (counts.get(custodyId) ?? 0) + 1);
  }

  return counts;
}

export function accessIndex(): AccessIndex {
  const openCounts = openProposalCountsByCustody();
  return {
    asOf: mockNow().toISOString(),
    users: database.users.map(accessUserOf),
    roles: database.roles,
    groups: database.groups,
    custodies: database.proposalCustodies
      .toSorted((first, second) => Number(second.isFallback) - Number(first.isFallback))
      .map((custody) => custodyRecordOf(custody, openCounts)),
    identityInstances: identityInstances(),
    categoryMemberships: Object.entries(database.categoryMembers).map(([categoryId, userIds]) => ({
      categoryId,
      userIds: [...userIds],
    })),
    projects: database.projects.map(({ id, name, managerId, memberIds, memberGroupIds }) => ({
      id,
      name,
      managerId,
      memberIds: [...memberIds],
      memberGroupIds: [...memberGroupIds],
    })),
    sharedWatchlists: database.watchlists.filter(isShared).map((watchlist) => {
      const { reachedIds, outOfViewIds } = audienceReachOf(watchlist.audience, watchlist.view);
      return { ...watchlist, reachedUserIds: reachedIds, outOfViewUserIds: outOfViewIds };
    }),
  };
}

function custodyRecordOf(
  custody: StoredProposalCustody,
  openCounts = openProposalCountsByCustody(),
): CustodyRecord {
  return {
    ...custody,
    memberIds: [...custody.memberIds],
    groupIds: [...custody.groupIds],
    openCount: openCounts.get(custody.id) ?? 0,
    placedByIds: custody.isFallback
      ? []
      : custodyRules()
          .filter((rule) => rule.names.includes(custody.name))
          .map(({ instanceId }) => instanceId),
  };
}

// ---------------------------------------------------------------- shared checks

function guard(session: Session): Refusal | null {
  return hasPermission(session, "access.manage") ? null : mayNotManage;
}

// Whether somebody could still manage access with these roles and these holdings.
function keepsManager(
  roles: readonly Role[],
  access: Readonly<Record<string, UserAccess>>,
): boolean {
  const holders = database.users.map((user) => ({
    handRoleIds: access[user.id]?.handRoleIds ?? [],
    mappedRoles: access[user.id]?.mappedRoles ?? [],
  }));
  return managersOf(holders, roles).length > 0;
}

function grantsRefusal(draft: RoleDraft): Refusal | null {
  const permissions = draft.grants.map((grant) => grant.permission);
  if (new Set(permissions).size !== permissions.length) {
    return { status: 422, message: "Each permission is granted once, at one scope" };
  }

  const refused = draft.grants.find((grant) => !isAcceptedGrant(grant));
  if (refused !== undefined) {
    return {
      status: 422,
      message:
        refused.scope === null
          ? `${refused.permission} needs a scope`
          : `${refused.permission} does not take the scope ${refused.scope}`,
    };
  }

  return null;
}

function nameTaken(name: string): Refusal {
  return { status: 409, code: "access.name_taken", message: `There is already one called ${name}` };
}

const unknownRecord = (what: string): Refusal => ({ status: 404, message: `No such ${what}` });

function nextIdOf(prefix: string, ids: readonly string[]): string {
  const numbers = ids
    .filter((candidate) => candidate.startsWith(prefix))
    .map((candidate) => Number(candidate.slice(prefix.length)))
    .filter(Number.isInteger);
  return `${prefix}${Math.max(0, ...numbers) + 1}`;
}

// ---------------------------------------------------------------- roles

export function createRole(session: Session, draft: RoleDraft): Outcome<Role> {
  const refusal = guard(session) ?? grantsRefusal(draft);
  if (refusal !== null) {
    return { refusal };
  }

  const name = roleNameOf(draft.name);
  if (database.roles.some((role) => role.name === name)) {
    return { refusal: nameTaken(name) };
  }

  const role: Role = {
    id: database.roles.some((candidate) => candidate.id === name)
      ? nextIdOf(
          `${name}-`,
          database.roles.map(({ id }) => id),
        )
      : name,
    name,
    description: draft.description,
    isShipped: false,
    grants: draft.grants,
    proposalBatchLimit: draft.proposalBatchLimit,
    proposalDailyLimit: draft.proposalDailyLimit,
  };
  database.roles = [...database.roles, role];
  return { value: role };
}

export function saveRole(session: Session, roleId: string, draft: RoleDraft): Outcome<Role> {
  const refusal = guard(session) ?? grantsRefusal(draft);
  if (refusal !== null) {
    return { refusal };
  }

  const stored = database.roles.find((role) => role.id === roleId);
  if (stored === undefined) {
    return { refusal: unknownRecord("role") };
  }

  const name = roleNameOf(draft.name);
  if (database.roles.some((role) => role.id !== roleId && role.name === name)) {
    return { refusal: nameTaken(name) };
  }

  const role: Role = {
    ...stored,
    name,
    description: draft.description,
    grants: draft.grants,
    proposalBatchLimit: draft.proposalBatchLimit,
    proposalDailyLimit: draft.proposalDailyLimit,
  };
  const roles = database.roles.map((candidate) => (candidate.id === roleId ? role : candidate));
  if (!keepsManager(roles, database.userAccess)) {
    return { refusal: lastManager };
  }

  database.roles = roles;
  return { value: role };
}

function withoutRole(roleId: string) {
  return {
    roles: database.roles.filter((role) => role.id !== roleId),
    access: Object.fromEntries(
      Object.entries(database.userAccess).map(([userId, held]) => [
        userId,
        {
          ...held,
          handRoleIds: held.handRoleIds.filter((id) => id !== roleId),
          mappedRoles: held.mappedRoles.filter((mapped) => mapped.roleId !== roleId),
        },
      ]),
    ),
  };
}

// Whoever held it keeps their other roles; a mapping still naming it gives nothing until the
// Identity instance is changed on Plugins.
export function deleteRole(session: Session, roleId: string): Outcome<null> {
  const refusal = guard(session);
  if (refusal !== null) {
    return { refusal };
  }

  if (!database.roles.some((role) => role.id === roleId)) {
    return { refusal: unknownRecord("role") };
  }

  const { roles, access } = withoutRole(roleId);
  if (!keepsManager(roles, access)) {
    return { refusal: lastManager };
  }

  database.roles = roles;
  database.userAccess = access;
  return { value: null };
}

// What deleting the role does: what each holder keeps, the mappings that stop giving anything,
// and whether it would leave nobody able to manage access.
export function roleImpact(session: Session, roleId: string): Outcome<RoleImpact> {
  if (!canReadAccess(session)) {
    return { refusal: mayNotManage };
  }

  if (!database.roles.some((role) => role.id === roleId)) {
    return { refusal: unknownRecord("role") };
  }

  const outcome = withoutRole(roleId);
  return {
    value: {
      holders: holdersOf(database.users.map(accessUserOf), roleId).map(({ user }) => ({
        userId: user.id,
        keptRoleIds: heldRoleIdsOf(outcome.access[user.id] ?? user),
      })),
      mappings: mappingsOf(identityInstances(), roleId),
      leavesNoManager: !keepsManager(outcome.roles, outcome.access),
    },
  };
}

// ---------------------------------------------------------------- users

function accessOf(userId: string): UserAccess {
  return (
    database.userAccess[userId] ?? { handRoleIds: [], mappedRoles: [], identities: [], entry: null }
  );
}

function findUser(userId: string): AccessUser | null {
  const user = database.users.find((candidate) => candidate.id === userId);
  return user === undefined ? null : accessUserOf(user);
}

export function setHandRoles(
  session: Session,
  userId: string,
  body: HandRoles,
): Outcome<AccessUser> {
  const refusal = guard(session);
  if (refusal !== null) {
    return { refusal };
  }

  if (findUser(userId) === null) {
    return { refusal: unknownRecord("user") };
  }

  if (body.roleIds.some((roleId) => !database.roles.some((role) => role.id === roleId))) {
    return { refusal: unknownRecord("role") };
  }

  const access = {
    ...database.userAccess,
    [userId]: { ...accessOf(userId), handRoleIds: [...new Set(body.roleIds)] },
  };
  if (!keepsManager(database.roles, access)) {
    return { refusal: lastManager };
  }

  database.userAccess = access;
  return { value: findUser(userId) as AccessUser };
}

export function setUserGroups(
  session: Session,
  userId: string,
  body: UserGroups,
): Outcome<AccessUser> {
  const refusal = guard(session);
  if (refusal !== null) {
    return { refusal };
  }

  if (findUser(userId) === null) {
    return { refusal: unknownRecord("user") };
  }

  if (body.groupIds.some((groupId) => !database.groups.some((group) => group.id === groupId))) {
    return { refusal: unknownRecord("group") };
  }

  database.groups = database.groups.map((group) => {
    const others = group.memberIds.filter((id) => id !== userId);
    return { ...group, memberIds: body.groupIds.includes(group.id) ? [...others, userId] : others };
  });
  return { value: findUser(userId) as AccessUser };
}

function identityHolder(instanceId: string, externalId: string): AccessUser | null {
  const holder = database.users.find((user) =>
    accessOf(user.id).identities.some(
      (identity) => identity.instanceId === instanceId && identity.externalId === externalId,
    ),
  );
  return holder === undefined ? null : accessUserOf(holder);
}

// Another way in for the same person: their record, roles and history stay one (identity.md §2).
export function linkIdentity(
  session: Session,
  userId: string,
  link: IdentityLink,
): Outcome<Identity> {
  const refusal = guard(session);
  if (refusal !== null) {
    return { refusal };
  }

  const user = findUser(userId);
  if (user === null) {
    return { refusal: unknownRecord("user") };
  }

  if (user.kind === "agent") {
    return { refusal: { status: 422, message: "An agent never logs in" } };
  }

  const instance = identityInstances().find((candidate) => candidate.id === link.instanceId);
  if (instance === undefined) {
    return { refusal: unknownRecord("identity provider") };
  }

  const holder = identityHolder(link.instanceId, link.externalId);
  if (holder !== null) {
    return {
      refusal: {
        status: 409,
        code: "access.identity_taken",
        message: `${instance.name} ${link.externalId} is already ${holder.name}`,
      },
    };
  }

  const identity: Identity = { ...link, lastLoginAt: null };
  const held = accessOf(userId);
  database.userAccess = {
    ...database.userAccess,
    [userId]: { ...held, identities: [...held.identities, identity] },
  };
  return { value: identity };
}

// Somebody with no institutional account; everyone else appears at their first login.
export function createLocalAccount(session: Session, account: LocalAccount): Outcome<AccessUser> {
  const refusal = guard(session);
  if (refusal !== null) {
    return { refusal };
  }

  const local = identityInstances().find((instance) => instance.isLocal);
  if (local === undefined) {
    return { refusal: { status: 422, message: "Local accounts are switched off" } };
  }

  if (identityHolder(local.id, account.username) !== null) {
    return {
      refusal: {
        status: 409,
        code: "access.identity_taken",
        message: `${account.username} is taken`,
      },
    };
  }

  if (account.roleIds.some((roleId) => !database.roles.some((role) => role.id === roleId))) {
    return { refusal: unknownRecord("role") };
  }

  const id = nextIdOf(
    "u",
    database.users.map((user) => user.id),
  );
  database.users = [
    ...database.users,
    { id, name: account.name, kind: "person", email: account.email === "" ? null : account.email },
  ];
  database.userAccess = {
    ...database.userAccess,
    [id]: {
      handRoleIds: [...new Set(account.roleIds)],
      mappedRoles: [],
      identities: [{ instanceId: local.id, externalId: account.username, lastLoginAt: null }],
      entry: null,
    },
  };
  return { value: findUser(id) as AccessUser };
}

// ---------------------------------------------------------------- groups

export function createGroup(session: Session, draft: RecordDraft): Outcome<AccessGroup> {
  const refusal = guard(session);
  if (refusal !== null) {
    return { refusal };
  }

  if (database.groups.some((group) => group.name === draft.name)) {
    return { refusal: nameTaken(draft.name) };
  }

  const group: AccessGroup = {
    id: nextIdOf(
      "g",
      database.groups.map(({ id }) => id),
    ),
    ...draft,
    memberIds: [],
    categoryIds: [],
  };
  database.groups = [...database.groups, group];
  return { value: group };
}

export function saveGroup(
  session: Session,
  groupId: string,
  draft: RecordDraft,
): Outcome<AccessGroup> {
  const refusal = guard(session);
  if (refusal !== null) {
    return { refusal };
  }

  const stored = database.groups.find((group) => group.id === groupId);
  if (stored === undefined) {
    return { refusal: unknownRecord("group") };
  }

  if (database.groups.some((group) => group.id !== groupId && group.name === draft.name)) {
    return { refusal: nameTaken(draft.name) };
  }

  const group = { ...stored, ...draft };
  database.groups = database.groups.map((candidate) =>
    candidate.id === groupId ? group : candidate,
  );
  return { value: group };
}

export function setGroupMembers(
  session: Session,
  groupId: string,
  body: GroupMembers,
): Outcome<AccessGroup> {
  const refusal = guard(session);
  if (refusal !== null) {
    return { refusal };
  }

  const stored = database.groups.find((group) => group.id === groupId);
  if (stored === undefined) {
    return { refusal: unknownRecord("group") };
  }

  if (body.userIds.some((userId) => findUser(userId) === null)) {
    return { refusal: unknownRecord("user") };
  }

  const group = { ...stored, memberIds: [...new Set(body.userIds)] };
  database.groups = database.groups.map((candidate) =>
    candidate.id === groupId ? group : candidate,
  );
  return { value: group };
}

// ---------------------------------------------------------------- proposal custodies

export function createCustody(session: Session, draft: RecordDraft): Outcome<CustodyRecord> {
  const refusal = guard(session);
  if (refusal !== null) {
    return { refusal };
  }

  if (database.proposalCustodies.some((custody) => custody.name === draft.name)) {
    return { refusal: nameTaken(draft.name) };
  }

  const custody: StoredProposalCustody = {
    id: nextIdOf(
      "pc",
      database.proposalCustodies.map(({ id }) => id),
    ),
    ...draft,
    isFallback: false,
    memberIds: [],
    groupIds: [],
  };
  database.proposalCustodies = [...database.proposalCustodies, custody];
  return { value: custodyRecordOf(custody) };
}

// Renamed, the rules still returning the old name stop placing proposals in it until changed.
export function saveCustody(
  session: Session,
  custodyId: string,
  draft: RecordDraft,
): Outcome<CustodyRecord> {
  const refusal = guard(session);
  if (refusal !== null) {
    return { refusal };
  }

  const stored = database.proposalCustodies.find((custody) => custody.id === custodyId);
  if (stored === undefined) {
    return { refusal: unknownRecord("custody") };
  }

  if (stored.isFallback && draft.name !== stored.name) {
    return {
      refusal: { status: 422, code: "access.fallback", message: "The fallback keeps its name" },
    };
  }

  if (
    database.proposalCustodies.some(
      (custody) => custody.id !== custodyId && custody.name === draft.name,
    )
  ) {
    return { refusal: nameTaken(draft.name) };
  }

  const custody = { ...stored, ...draft };
  replaceCustody(custody);
  return { value: custodyRecordOf(custody) };
}

export function setCustodyMembers(
  session: Session,
  custodyId: string,
  body: CustodyMembers,
): Outcome<CustodyRecord> {
  const refusal = guard(session);
  if (refusal !== null) {
    return { refusal };
  }

  const stored = database.proposalCustodies.find((custody) => custody.id === custodyId);
  if (stored === undefined) {
    return { refusal: unknownRecord("custody") };
  }

  // People only: an agent never decides.
  if (body.userIds.some((userId) => findUser(userId)?.kind !== "person")) {
    return { refusal: unknownRecord("person") };
  }

  if (body.groupIds.some((groupId) => !database.groups.some((group) => group.id === groupId))) {
    return { refusal: unknownRecord("group") };
  }

  const custody = {
    ...stored,
    memberIds: [...new Set(body.userIds)],
    groupIds: [...new Set(body.groupIds)],
  };
  replaceCustody(custody);
  return { value: custodyRecordOf(custody) };
}

// What deleting the custody does: its open proposals are placed again, and those it alone held
// land in the fallback.
export function custodyImpact(session: Session, custodyId: string): Outcome<CustodyImpact> {
  if (!canReadAccess(session)) {
    return { refusal: mayNotManage };
  }

  const custody = database.proposalCustodies.find((candidate) => candidate.id === custodyId);
  if (custody === undefined) {
    return { refusal: unknownRecord("custody") };
  }

  const placements = openProposalPlacements().filter((placed) => placed.includes(custodyId));
  return {
    value: {
      openCount: placements.length,
      toFallbackCount: placements.filter((placed) => placed.length === 1).length,
      ruleIds: custodyRecordOf(custody).placedByIds,
    },
  };
}

export function deleteCustody(session: Session, custodyId: string): Outcome<null> {
  const refusal = guard(session);
  if (refusal !== null) {
    return { refusal };
  }

  const stored = database.proposalCustodies.find((custody) => custody.id === custodyId);
  if (stored === undefined) {
    return { refusal: unknownRecord("custody") };
  }

  if (stored.isFallback) {
    return {
      refusal: { status: 422, code: "access.fallback", message: "The fallback cannot be deleted" },
    };
  }

  database.proposalCustodies = database.proposalCustodies.filter(
    (custody) => custody.id !== custodyId,
  );
  return { value: null };
}

function replaceCustody(custody: StoredProposalCustody): void {
  database.proposalCustodies = database.proposalCustodies.map((candidate) =>
    candidate.id === custody.id ? custody : candidate,
  );
}
