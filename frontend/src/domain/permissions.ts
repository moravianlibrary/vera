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
  "iteration.edit_descriptive",
  "iteration.classify",
  "iteration.relink",
  "validation.approve",
  "validation.deny",
  "validation.revoke",
  "restriction.overrule",
  "iteration.cancel",
  "iteration.resume",
  "iteration.publish",
  "watch",
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
