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
  "request.read_ingest",
  "request.retry",
  "request.read_payload",
  "project.read",
  "project.create",
  "project.edit",
  "project.manage_members",
  "project.delete",
  "project.decide",
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
  "watchlist.manage_system",
  "list.read",
  "list.create",
  "list.edit",
  "list.delete",
  "intention.read",
  "intention.edit",
  "intention.repeat",
  "mix.read",
  "mix.edit",
  "mix.manage",
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

// My Documents opens with `request.read_own`, and for whoever manages system watchlists, who
// builds them over either Documents view (VIEW-own-label, WATCH-personal-system).
export function canOpenMyDocuments(holder: GrantHolder): boolean {
  return hasAnyPermission(holder, ["request.read_own", "watchlist.manage_system"]);
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
  "Planning",
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
  "request.read_ingest": { group: "Requests", scopes: custodyOrAny },
  "request.retry": { group: "Requests", scopes: custodyOrAny },
  "request.read_payload": { group: "Requests", scopes: anyOnly },
  "project.read": { group: "Requests", scopes: projectOrAny },
  "project.create": { group: "Requests", scopes: anyOnly },
  "project.edit": { group: "Requests", scopes: managedOrAny },
  "project.manage_members": { group: "Requests", scopes: managedOrAny },
  "project.decide": { group: "Requests", scopes: anyOnly },
  "project.delete": { group: "Requests", scopes: managedOrAny },
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
  "list.read": { group: "Planning", scopes: readScopes },
  "list.create": { group: "Planning", scopes: anyOnly },
  "list.edit": { group: "Planning", scopes: anyOnly },
  "list.delete": { group: "Planning", scopes: anyOnly },
  "intention.read": { group: "Planning", scopes: projectOrAny },
  "intention.edit": { group: "Planning", scopes: projectOrAny },
  "mix.read": { group: "Planning", scopes: anyOnly },
  "mix.edit": { group: "Planning", scopes: anyOnly },
  "mix.manage": { group: "Planning", scopes: anyOnly },
  "intention.repeat": { group: "Planning", scopes: anyOnly },
  "category.read": { group: "Categories", scopes: custodyOrAny },
  "category.edit": { group: "Categories", scopes: custodyOrAny },
  "category.grant_custody": { group: "Categories", scopes: custodyOrAny },
  watch: { group: "Watchlists", scopes: ownOnly },
  "watchlist.manage_system": { group: "Watchlists", scopes: anyOnly },
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

// ---------------------------------------------------------------- what a permission needs

// A permission another needs (PERM-requires). Held at a scope covering the grant's by default;
// `any` where the need is only met everywhere; `held` where any scope will do, as creating a
// project reaches no project yet. A self-scoped need is met by holding it.
export interface Requirement {
  readonly permission: Permission;
  readonly at?: "any" | "held";
}

const needs = (...permissions: Permission[]): Requirement[] =>
  permissions.map((permission) => ({ permission }));
const needsAtAny = (...permissions: Permission[]): Requirement[] =>
  permissions.map((permission) => ({ permission, at: "any" }));
const readsIterations = needs("iteration.read");
const readsProjects = needs("project.read");

export const permissionRequires: Partial<Record<Permission, readonly Requirement[]>> = {
  "request.create": needs("request.read_own"),
  "request.withdraw_own": needs("request.read_own"),
  "request.decide": needs("request.read"),
  "request.read_ingest": readsIterations,
  "request.retry": needs("request.read_ingest"),
  "request.read_payload": needs("request.read_ingest"),
  "project.create": [{ permission: "project.read", at: "held" }],
  "project.edit": readsProjects,
  "project.manage_members": readsProjects,
  "project.delete": readsProjects,
  "project.decide": needsAtAny("project.read"),
  "iteration.recheck": readsIterations,
  "iteration.classify": readsIterations,
  "validation.approve": readsIterations,
  "validation.deny": readsIterations,
  "validation.revoke": readsIterations,
  "restriction.overrule": readsIterations,
  "iteration.cancel": readsIterations,
  "iteration.resume": readsIterations,
  "iteration.publish": readsIterations,
  "list.read": readsIterations,
  "list.create": needsAtAny("list.read", "iteration.read"),
  "list.edit": needsAtAny("list.read", "iteration.read"),
  "list.delete": needsAtAny("list.read", "iteration.read"),
  "intention.edit": needs("intention.read", "mix.read"),
  "intention.repeat": needsAtAny("intention.edit"),
  "mix.edit": needs("mix.read"),
  "mix.manage": needs("mix.edit"),
  "category.edit": needs("category.read"),
  "category.grant_custody": needs("category.read"),
  "watchlist.manage_system": [{ permission: "watch" }, ...needsAtAny("iteration.read")],
  "task.cancel": needs("task.read"),
  "task.schedule": needs("task.read"),
  "plugin.configure": needs("plugin.read"),
  "plugin.run": needs("plugin.read"),
  "plugin.upload_code": needs("plugin.configure"),
  "hook.configure": needs("hook.read"),
  "access.manage": needs("access.read"),
};

// Whether a grant at `held` reaches everything one at `scope` does: `any` covers every scope,
// `project` covers `managed`, as a project's manager is on it.
export function coversScope(held: GrantScope, scope: GrantScope): boolean {
  return held === "any" || held === scope || (held === "project" && scope === "managed");
}

// The scope a requirement of a grant at `scope` must be held at, the narrowest that does.
export function requiredScopeOf(requirement: Requirement, scope: GrantScope): GrantScope {
  const { scopes } = permissionCatalog[requirement.permission] as PermissionEntry;
  if (scopes === null) {
    return null;
  }
  if (requirement.at === "any") {
    return "any";
  }
  const fits = (candidate: HeldScope) => requirement.at === "held" || coversScope(candidate, scope);
  return scopes.find(fits) ?? "any";
}

function meets(requirement: Requirement, scope: GrantScope, held: GrantScope | undefined): boolean {
  if (held === undefined) {
    return false;
  }
  const { scopes } = permissionCatalog[requirement.permission] as PermissionEntry;
  if (scopes === null || requirement.at === "held") {
    return true;
  }
  return coversScope(held, requirement.at === "any" ? "any" : scope);
}

export interface MissingRequirement {
  readonly grant: Grant;
  readonly needs: Grant;
}

// What a role's grants need and it does not grant, each at the scope it would take
// (PERM-requires).
export function missingRequirementsOf(grants: readonly Grant[]): MissingRequirement[] {
  const heldScopeOf = (permission: Permission) =>
    grants.find((grant) => grant.permission === permission)?.scope;
  return grants.flatMap((grant) =>
    (permissionRequires[grant.permission] ?? [])
      .filter(
        (requirement) => !meets(requirement, grant.scope, heldScopeOf(requirement.permission)),
      )
      .map((requirement) => ({
        grant,
        needs: {
          permission: requirement.permission,
          scope: requiredScopeOf(requirement, grant.scope),
        },
      })),
  );
}

// The grants with every need added or widened, transitively: what the role editor ticks with a
// permission (PERM-requires).
export function withRequirements(grants: readonly Grant[]): Grant[] {
  let next = [...grants];
  for (;;) {
    const [missing] = missingRequirementsOf(next);
    if (missing === undefined) {
      return next;
    }
    // A need already held at a scope that does not cover is widened to `any`, never narrowed.
    const held = next.find((grant) => grant.permission === missing.needs.permission);
    const needed = held === undefined ? missing.needs : { ...missing.needs, scope: "any" as const };
    next = [...next.filter((grant) => grant !== held), needed];
  }
}

// The catalogue's order: by heading, then as the heading lists them.
export function catalogOrderOf(permission: Permission): number {
  const entry = permissionCatalog[permission];
  return (
    permissionGroups.indexOf(entry.group) * permissionKeys.length +
    Object.keys(permissionCatalog).indexOf(permission)
  );
}
