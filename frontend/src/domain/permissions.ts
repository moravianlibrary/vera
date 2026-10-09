// Permission vocabulary and grant checks.
// Keys and accepted scopes follow docs/design/shared/entities/permissions.md §3. The shell and
// views ask these helpers whether an entry or action exists; a missing grant hides it.

import { z } from "zod";

export const permissionKeys = [
  "request.create",
  "request.read_own",
  "request.withdraw_own",
  "request.read",
  "request.decide",
  "iteration.read",
  "iteration.recheck",
  "iteration.classify",
  "validation.approve",
  "validation.deny",
  "validation.revoke",
  "restriction.overrule",
  "iteration.cancel",
  "iteration.resume",
  "iteration.publish",
  "watch",
  "watchlist.manage_shared",
  "addition.read",
  "addition.retry",
  "addition.read_payload",
  "list.read",
  "list.create",
  "list.edit",
  "list.delete",
  "intention.read",
  "intention.edit",
  "intention.edit_overall",
  "intention.repeat",
  "mix.read",
  "mix.edit",
  "mix.manage",
  "project.read",
  "project.create",
  "project.edit",
  "project.manage_members",
  "project.delete",
  "project.decide",
  "category.read",
  "category.edit",
  "category.grant_custody",
  "task.read_own",
  "task.read",
  "task.cancel",
  "task.schedule",
  "plugin.read",
  "plugin.configure",
  "plugin.upload_code",
  "plugin.run",
  "hook.read",
  "hook.configure",
  "access.read",
  "access.manage",
] as const;

export const permissionSchema = z.enum(permissionKeys);
export type Permission = z.infer<typeof permissionSchema>;

// `null` is a self-scoped grant: it reaches only the holder's own records.
export const grantScopeSchema = z.enum(["custody", "project", "managed", "any"]).nullable();
export type GrantScope = z.infer<typeof grantScopeSchema>;

export const grantSchema = z.object({
  permission: permissionSchema,
  scope: grantScopeSchema,
});
export type Grant = z.infer<typeof grantSchema>;

export interface GrantHolder {
  readonly grants: readonly Grant[];
}

export function hasPermission(holder: GrantHolder, permission: Permission): boolean {
  return holder.grants.some((grant) => grant.permission === permission);
}

export function hasAnyPermission(holder: GrantHolder, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => hasPermission(holder, permission));
}

export function scopesOf(holder: GrantHolder, permission: Permission): GrantScope[] {
  return holder.grants
    .filter((grant) => grant.permission === permission)
    .map((grant) => grant.scope);
}

// ---------------------------------------------------------------- scope against a record

// What a pane's action is about, as far as a grant's scope can tell (permissions.md §2).
export type ScopedRecord =
  | { readonly kind: "proposal"; readonly askerIds: readonly string[] }
  // Root first, so custody of any ancestor holds.
  | { readonly kind: "iteration"; readonly categoryPathIds: readonly string[] }
  // A category itself, root first: custody of it or of anything above it holds (permissions.md
  // §3, Categories). The root of the tree, which is no category, is `unscoped`.
  | { readonly kind: "category"; readonly categoryPathIds: readonly string[] }
  | {
      readonly kind: "project";
      readonly managerId: string;
      readonly memberIds: readonly string[];
      readonly memberGroupIds: readonly string[];
    }
  | { readonly kind: "run"; readonly startedById: string }
  // A record no narrower scope reaches, such as an intention no project funds: only `any` holds.
  | { readonly kind: "unscoped" };

export interface ScopeHolder extends GrantHolder {
  readonly user: { readonly id: string };
  readonly custodyCategoryIds: readonly string[];
  // The groups the holder is in: a project's group is a membership too.
  readonly groupIds: readonly string[];
}

// Whether the holder may do this to this record, scope included. Only hides what the person
// cannot do: the server decides again. Without a record it asks whether they hold it at all.
export function can(holder: ScopeHolder, permission: Permission, record?: ScopedRecord): boolean {
  const scopes = scopesOf(holder, permission);
  if (record === undefined) {
    return scopes.length > 0;
  }

  return scopes.some((scope) => isWithinScope(holder, scope, record));
}

function isWithinScope(holder: ScopeHolder, scope: GrantScope, record: ScopedRecord): boolean {
  const userId = holder.user.id;
  switch (scope) {
    case "any":
      return true;
    case null:
      return isOwnedBy(record, userId);
    case "custody":
      return isInCustody(holder, record);
    case "project":
      return (
        record.kind === "project" &&
        ([record.managerId, ...record.memberIds].includes(userId) ||
          record.memberGroupIds.some((groupId) => holder.groupIds.includes(groupId)))
      );
    case "managed":
      return record.kind === "project" && record.managerId === userId;
  }
}

function isOwnedBy(record: ScopedRecord, userId: string): boolean {
  switch (record.kind) {
    case "proposal":
      return record.askerIds.includes(userId);
    case "run":
      return record.startedById === userId;
    case "project":
      return record.managerId === userId;
    case "iteration":
    case "category":
    case "unscoped":
      return false;
  }
}

function isInCustody(holder: ScopeHolder, record: ScopedRecord): boolean {
  switch (record.kind) {
    // Before approval custody is proposal custody, and the server lists a decider only the
    // proposals in their proposal custodies (permissions.md §3, Requests).
    case "proposal":
      return true;
    case "iteration":
    case "category":
      return record.categoryPathIds.some((id) => holder.custodyCategoryIds.includes(id));
    case "project":
    case "run":
    case "unscoped":
      return false;
  }
}

// ---------------------------------------------------------------- the catalogue

// What a role is built from (permissions.md §3): each permission's heading and the scopes it
// accepts, `null` for a self-scoped one, which takes none. A property of the model, not of any
// role: the role editor offers only these, and the server refuses any other.
export const permissionGroups = [
  "Requests",
  "Iterations",
  "Additions",
  "Lists and planning",
  "Categories",
  "Watchlists",
  "Administration",
] as const;
export type PermissionGroup = (typeof permissionGroups)[number];

export type HeldScope = Exclude<GrantScope, null>;

export interface PermissionEntry {
  readonly group: PermissionGroup;
  readonly scopes: readonly HeldScope[] | null;
}

const ownOnly = null;
const custodyOrAny = ["custody", "any"] as const;
const readScopes = ["custody", "project", "any"] as const;
const anyOnly = ["any"] as const;
const managedOrAny = ["managed", "any"] as const;
const projectOrAny = ["project", "any"] as const;

export const permissionCatalog = {
  "request.create": { group: "Requests", scopes: ownOnly },
  "request.read_own": { group: "Requests", scopes: ownOnly },
  "request.withdraw_own": { group: "Requests", scopes: ownOnly },
  "request.read": { group: "Requests", scopes: readScopes },
  "request.decide": { group: "Requests", scopes: custodyOrAny },
  "iteration.read": { group: "Iterations", scopes: readScopes },
  "iteration.recheck": { group: "Iterations", scopes: custodyOrAny },
  "iteration.classify": { group: "Iterations", scopes: custodyOrAny },
  "validation.approve": { group: "Iterations", scopes: custodyOrAny },
  "validation.deny": { group: "Iterations", scopes: custodyOrAny },
  "validation.revoke": { group: "Iterations", scopes: custodyOrAny },
  "restriction.overrule": { group: "Iterations", scopes: anyOnly },
  "iteration.cancel": { group: "Iterations", scopes: custodyOrAny },
  "iteration.resume": { group: "Iterations", scopes: custodyOrAny },
  "iteration.publish": { group: "Iterations", scopes: custodyOrAny },
  "addition.read": { group: "Additions", scopes: custodyOrAny },
  "addition.retry": { group: "Additions", scopes: anyOnly },
  "addition.read_payload": { group: "Additions", scopes: anyOnly },
  "list.read": { group: "Lists and planning", scopes: readScopes },
  "list.create": { group: "Lists and planning", scopes: anyOnly },
  "list.edit": { group: "Lists and planning", scopes: anyOnly },
  "list.delete": { group: "Lists and planning", scopes: anyOnly },
  "intention.read": { group: "Lists and planning", scopes: projectOrAny },
  "intention.edit": { group: "Lists and planning", scopes: projectOrAny },
  "intention.edit_overall": { group: "Lists and planning", scopes: anyOnly },
  "mix.read": { group: "Lists and planning", scopes: anyOnly },
  "mix.edit": { group: "Lists and planning", scopes: anyOnly },
  "mix.manage": { group: "Lists and planning", scopes: anyOnly },
  "intention.repeat": { group: "Lists and planning", scopes: anyOnly },
  "project.read": { group: "Lists and planning", scopes: projectOrAny },
  "project.create": { group: "Lists and planning", scopes: anyOnly },
  "project.edit": { group: "Lists and planning", scopes: managedOrAny },
  "project.manage_members": { group: "Lists and planning", scopes: managedOrAny },
  "project.decide": { group: "Lists and planning", scopes: anyOnly },
  "project.delete": { group: "Lists and planning", scopes: managedOrAny },
  "category.read": { group: "Categories", scopes: custodyOrAny },
  "category.edit": { group: "Categories", scopes: custodyOrAny },
  "category.grant_custody": { group: "Categories", scopes: custodyOrAny },
  watch: { group: "Watchlists", scopes: ownOnly },
  "watchlist.manage_shared": { group: "Watchlists", scopes: anyOnly },
  "task.read_own": { group: "Administration", scopes: ownOnly },
  "task.read": { group: "Administration", scopes: anyOnly },
  "task.cancel": { group: "Administration", scopes: anyOnly },
  "task.schedule": { group: "Administration", scopes: anyOnly },
  "plugin.read": { group: "Administration", scopes: anyOnly },
  "plugin.configure": { group: "Administration", scopes: anyOnly },
  "plugin.upload_code": { group: "Administration", scopes: anyOnly },
  "plugin.run": { group: "Administration", scopes: anyOnly },
  "hook.read": { group: "Administration", scopes: anyOnly },
  "hook.configure": { group: "Administration", scopes: anyOnly },
  "access.read": { group: "Administration", scopes: anyOnly },
  "access.manage": { group: "Administration", scopes: anyOnly },
} as const satisfies Record<Permission, PermissionEntry>;

// Whether the permission takes the grant's scope: none for a self-scoped one, one of its own
// otherwise.
export function isAcceptedGrant({ permission, scope }: Grant): boolean {
  const { scopes } = permissionCatalog[permission] as PermissionEntry;
  return scopes === null ? scope === null : scope !== null && scopes.includes(scope);
}

// The catalogue's order: by heading, then as the heading lists them.
export function catalogOrderOf(permission: Permission): number {
  const entry = permissionCatalog[permission];
  return (
    permissionGroups.indexOf(entry.group) * permissionKeys.length +
    Object.keys(permissionCatalog).indexOf(permission)
  );
}
