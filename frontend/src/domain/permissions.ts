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
  | {
      readonly kind: "project";
      readonly managerId: string;
      readonly memberIds: readonly string[];
    }
  | { readonly kind: "run"; readonly startedById: string };

export interface ScopeHolder extends GrantHolder {
  readonly user: { readonly id: string };
  readonly custodyCategoryIds: readonly string[];
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
      return record.kind === "project" && [record.managerId, ...record.memberIds].includes(userId);
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
      return record.categoryPathIds.some((id) => holder.custodyCategoryIds.includes(id));
    case "project":
    case "run":
      return false;
  }
}
