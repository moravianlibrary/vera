// Users & Groups over HTTP (view-catalog.md *Users & Groups*; permissions.md §1, §4, §6;
// identity.md; proposal-custody.md). The page reads one index, `access.read`, holding every
// user, role, group and proposal custody with the relations between them, and works out the
// provenance from it (domain/access.ts). Everything written here is `access.manage`'s: roles and
// their grants, the roles a person holds by hand, groups and their members, proposal custodies
// and theirs, local accounts and linked identities. Mapped roles follow the provider and are
// never written here; category custody is written on Categories, which rules place a proposal
// on Plugins.

import { z } from "zod";
import { deleteResource, getJson, postJson, putJson } from "@/api/http";
import type { AccessRecordAction, AccessRecordKind } from "@/api/routes";
import { accessRecordActionRoute, accessRecordRoute, apiRoutes } from "@/api/routes";
import type { AccessGroup, AccessUser, CustodyRecord, Identity, Role } from "@/domain/access";
import {
  accessGroupSchema,
  accessUserSchema,
  categoryMembershipSchema,
  custodyRecordSchema,
  identityInstanceSchema,
  identitySchema,
  projectMembershipSchema,
  roleSchema,
} from "@/domain/access";
import { grantSchema } from "@/domain/permissions";

export const accessIndexSchema = z.object({
  // The server's moment, which a last login is worded against.
  asOf: z.iso.datetime(),
  users: z.array(accessUserSchema),
  roles: z.array(roleSchema),
  groups: z.array(accessGroupSchema),
  // The fallback first.
  custodies: z.array(custodyRecordSchema),
  identityInstances: z.array(identityInstanceSchema),
  categoryMemberships: z.array(categoryMembershipSchema),
  projects: z.array(projectMembershipSchema),
});
export type AccessIndex = z.infer<typeof accessIndexSchema>;

const nameField = z.string().trim().min(1, "Give it a name");

export const roleDraftSchema = z.object({
  name: nameField,
  description: z.string().trim(),
  grants: z.array(grantSchema),
});
export type RoleDraft = z.infer<typeof roleDraftSchema>;

export const recordDraftSchema = z.object({
  name: nameField,
  description: z.string().trim(),
});
export type RecordDraft = z.infer<typeof recordDraftSchema>;

export const handRolesSchema = z.object({ roleIds: z.array(z.string()) });
export type HandRoles = z.infer<typeof handRolesSchema>;

export const userGroupsSchema = z.object({ groupIds: z.array(z.string()) });
export type UserGroups = z.infer<typeof userGroupsSchema>;

export const groupMembersSchema = z.object({ userIds: z.array(z.string()) });
export type GroupMembers = z.infer<typeof groupMembersSchema>;

export const custodyMembersSchema = z.object({
  userIds: z.array(z.string()),
  groupIds: z.array(z.string()),
});
export type CustodyMembers = z.infer<typeof custodyMembersSchema>;

export const identityLinkSchema = identitySchema.pick({ instanceId: true }).extend({
  externalId: z.string().trim().min(1, "Their id there"),
});
export type IdentityLink = z.infer<typeof identityLinkSchema>;

// Somebody with no institutional account: a username on Local accounts, and the roles they
// start with by hand. They set a password at first login.
export const localAccountSchema = z.object({
  name: nameField,
  username: z.string().trim().min(1, "Give them a username"),
  email: z.string().trim(),
  roleIds: z.array(z.string()),
});
export type LocalAccount = z.infer<typeof localAccountSchema>;

export async function getAccessIndex(): Promise<AccessIndex> {
  return getJson(apiRoutes.access, accessIndexSchema);
}

// ---------------------------------------------------------------- roles

export async function createRole(draft: RoleDraft): Promise<Role> {
  return postJson(apiRoutes.accessRoles, draft, roleSchema);
}

export async function saveRole({ roleId, draft }: { roleId: string; draft: RoleDraft }) {
  return putJson(accessRecordRoute("roles", roleId), draft, roleSchema);
}

export async function deleteRole(roleId: string): Promise<void> {
  return deleteResource(accessRecordRoute("roles", roleId));
}

// ---------------------------------------------------------------- users

export async function createLocalAccount(account: LocalAccount): Promise<AccessUser> {
  return postJson(apiRoutes.accessUsers, account, accessUserSchema);
}

const putOn =
  <Body, Value>(kind: AccessRecordKind, action: AccessRecordAction, schema: z.ZodType<Value>) =>
  ({ recordId, body }: { recordId: string; body: Body }): Promise<Value> =>
    putJson(accessRecordActionRoute(kind, recordId, action), body, schema);

export const setHandRoles = putOn<HandRoles, AccessUser>("users", "roles", accessUserSchema);
export const setUserGroups = putOn<UserGroups, AccessUser>("users", "groups", accessUserSchema);

export async function linkIdentity({
  userId,
  link,
}: {
  userId: string;
  link: IdentityLink;
}): Promise<Identity> {
  return postJson(accessRecordActionRoute("users", userId, "identities"), link, identitySchema);
}

// ---------------------------------------------------------------- groups

export async function createGroup(draft: RecordDraft): Promise<AccessGroup> {
  return postJson(apiRoutes.accessGroups, draft, accessGroupSchema);
}

export async function saveGroup({ groupId, draft }: { groupId: string; draft: RecordDraft }) {
  return putJson(accessRecordRoute("groups", groupId), draft, accessGroupSchema);
}

export const setGroupMembers = putOn<GroupMembers, AccessGroup>(
  "groups",
  "members",
  accessGroupSchema,
);

// ---------------------------------------------------------------- proposal custodies

export async function createCustody(draft: RecordDraft): Promise<CustodyRecord> {
  return postJson(apiRoutes.accessCustodies, draft, custodyRecordSchema);
}

export async function saveCustody({ custodyId, draft }: { custodyId: string; draft: RecordDraft }) {
  return putJson(accessRecordRoute("custodies", custodyId), draft, custodyRecordSchema);
}

export const setCustodyMembers = putOn<CustodyMembers, CustodyRecord>(
  "custodies",
  "members",
  custodyRecordSchema,
);

// Every open proposal is placed again; those it alone held land in the fallback.
export async function deleteCustody(custodyId: string): Promise<void> {
  return deleteResource(accessRecordRoute("custodies", custodyId));
}
