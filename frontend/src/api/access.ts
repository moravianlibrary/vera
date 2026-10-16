// Calls the access endpoints; what they take and answer is in @vera/contract/access.

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
} from "@vera/contract/access";
import { accessIndexSchema, custodyImpactSchema, roleImpactSchema } from "@vera/contract/access";
import type { AccessRecordAction, AccessRecordKind } from "@vera/contract/routes";
import { accessRecordActionRoute, accessRecordRoute, apiRoutes } from "@vera/contract/routes";
import type { AccessGroup, AccessUser, CustodyRecord, Identity, Role } from "@vera/domain/access";
import {
  accessGroupSchema,
  accessUserSchema,
  custodyRecordSchema,
  identitySchema,
  roleSchema,
} from "@vera/domain/access";
import type { z } from "zod";
import { deleteResource, getJson, postJson, putJson } from "@/api/http";

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

export async function getRoleImpact(roleId: string): Promise<RoleImpact> {
  return getJson(accessRecordActionRoute("roles", roleId, "impact"), roleImpactSchema);
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

// ACCESS-link-identity: refused for their last one; the person and their history stay.
export async function unlinkIdentity({
  userId,
  identity,
}: {
  userId: string;
  identity: Pick<Identity, "instanceId" | "externalId">;
}): Promise<void> {
  return deleteResource(
    `${accessRecordActionRoute("users", userId, "identities")}/${encodeURIComponent(identity.instanceId)}/${encodeURIComponent(identity.externalId)}`,
  );
}

// ACCESS-suspend: login refused and roles inactive until restored; nothing else changes.
export async function suspendUser(userId: string): Promise<AccessUser> {
  return postJson(accessRecordActionRoute("users", userId, "suspend"), {}, accessUserSchema);
}

export async function restoreUser(userId: string): Promise<AccessUser> {
  return postJson(accessRecordActionRoute("users", userId, "restore"), {}, accessUserSchema);
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

// ---------------------------------------------------------------- request custodies

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

export async function getCustodyImpact(custodyId: string): Promise<CustodyImpact> {
  return getJson(accessRecordActionRoute("custodies", custodyId, "impact"), custodyImpactSchema);
}

// Every open proposal is placed again; those it alone held land in the fallback.
export async function deleteCustody(custodyId: string): Promise<void> {
  return deleteResource(accessRecordRoute("custodies", custodyId));
}
