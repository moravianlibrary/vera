// Users & Groups over HTTP (view-catalog.md *Users & Groups*; permissions.md §1, §4, §6;
// identity.md; proposal-custody.md). The page reads one index, `access.read`, holding every
// user, role, group and request custody with the relations between them, and works out the
// provenance from it (domain/access.ts). Everything written here is `access.manage`'s: roles and
// their grants, the roles a person holds by hand, groups and their members, request custodies
// and theirs, local accounts and linked identities, and a person suspended and restored. Mapped
// roles follow the provider and are never written here; category custody is written on
// Categories, which rules place a proposal on Plugins.

import {
  accessGroupSchema,
  accessUserSchema,
  categoryMembershipSchema,
  custodyRecordSchema,
  identityInstanceSchema,
  identitySchema,
  projectMembershipSchema,
  roleSchema,
} from "@vera/domain/access";
import { categorySchema, watchlistSchema } from "@vera/domain/entities";
import { grantSchema } from "@vera/domain/permissions";
import { z } from "zod";

export const accessProposalSchema = z.object({
  id: z.string(),
  title: z.string(),
  custodyIds: z.array(z.string()),
});

export type AccessProposal = z.infer<typeof accessProposalSchema>;

// Shared watchlists are managed in Preferences; kept in the response while the old editor
// endpoints are migrated away from this resource.
export const sharedWatchlistSchema = watchlistSchema.extend({
  ownerId: z.string(),
  reachedUserIds: z.array(z.string()),
  outOfViewUserIds: z.array(z.string()),
});

export type SharedWatchlist = z.infer<typeof sharedWatchlistSchema>;

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
  categories: z.array(categorySchema),
  proposals: z.array(accessProposalSchema),
  projects: z.array(projectMembershipSchema),
  sharedWatchlists: z.array(sharedWatchlistSchema),
  // Every property, each bringing its own permission to the role editor (PERM-property-edit).
  properties: z.array(z.object({ key: z.string(), name: z.string() })),
});

export type AccessIndex = z.infer<typeof accessIndexSchema>;

const nameField = z.string().trim().min(1, "Give it a name");

export const roleDraftSchema = z.object({
  name: nameField,
  description: z.string().trim(),
  grants: z.array(grantSchema),
  proposalBatchLimit: z.number().int().nonnegative().nullable(),
  proposalDailyLimit: z.number().int().nonnegative().nullable(),
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

export const identityDefaultRoleSchema = z.object({ roleId: z.string().nullable() });
export type IdentityDefaultRole = z.infer<typeof identityDefaultRoleSchema>;

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

// What deleting a role does, as the server counts it.
export const roleImpactSchema = z.object({
  holders: z.array(z.object({ userId: z.string(), keptRoleIds: z.array(z.string()) })),
  // Identity mappings that name it, which stop giving anything.
  mappings: z.array(z.object({ instanceId: z.string(), claim: z.string().nullable() })),
  leavesNoManager: z.boolean(),
});

export type RoleImpact = z.infer<typeof roleImpactSchema>;

// What deleting a custody does: its open proposals placed again, some into the fallback.
export const custodyImpactSchema = z.object({
  openCount: z.number().int().nonnegative(),
  toFallbackCount: z.number().int().nonnegative(),
  // The rules still naming it, which then name nothing.
  ruleIds: z.array(z.string()),
});

export type CustodyImpact = z.infer<typeof custodyImpactSchema>;
