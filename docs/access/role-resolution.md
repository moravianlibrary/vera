# Role Resolution

How roles are resolved for a user: hand-set roles, mapped roles, provenance tracking,
and the effective permission set. Extracted from `frontend/src/domain/access.ts`.

## Two ways to hold a role

| Way | Set by | Can be removed by | Survives mapping change? |
|---|---|---|---|
| **hand** | An admin, via Users & Groups | Admin revoking it | Yes |
| **mapped** | An Identity plugin at login | Claim no longer matches | No (removed at next login) |

A user may hold the same role **both ways**. Removing the hand-set grant leaves the mapped
one — and vice versa.

## The data model

```ts
interface AccessUser {
  handRoleIds: string[];           // roles set by hand
  mappedRoles: MappedRole[];       // roles from identity mappings
  // each MappedRole: { roleId, instanceId, claim: string }
}

interface MappedRole {
  roleId: string;
  instanceId: string;
  claim: string;                   // "group mzk-curators" or "default role"
}
```

## Resolving effective roles

The `heldRolesOf()` function collects all roles a user holds with every way they reach them:

```ts
interface RoleWay {
  by: "hand"
} | {
  by: "mapped";
  instanceId: string;
  claim: string;
}

interface HeldRole {
  roleId: string;
  ways: RoleWay[];
}

function heldRolesOf(user: RoleHolder): HeldRole[] {
  // Collect hand-set roles first, then each mapping
  // Same role held both ways → two entries in ways[]
}
```

The result is a **deduplicated list** (by roleId) where each role carries all the ways
it reaches the user.

## Provenance

Provenance is part of the answer. Screens showing what someone may do show **how they
came to it**:

- "staff — mapped by MZK Keycloak from group mzk-staff"
- "curator — granted by admin on 2026-09-26"
- "custody of Periodicals — via Periodicals Curators group"
- "member of Project X — via Team A group"

## Finding role holders

`holdersOf()` finds all users who hold a specific role:

```ts
function holdersOf<User extends RoleHolder>(
  users: readonly User[],
  roleId: string,
): { user: User; ways: RoleWay[] }[] {
  // Returns users who hold this role, with how they got it
}
```

## Finding identity mappings

`mappingsOf()` finds all identity instances that grant a role:

```ts
function mappingsOf(
  instances: readonly IdentityInstance[],
  roleId: string,
): { instanceId: string; claim: string | null }[] {
  // Default role + claim→role mappings
}
```

## Who is a manager?

`managersOf()` finds users who can manage access (hold `access.manage`):

```ts
function managersOf<User extends RoleHolder>(
  users: readonly User[],
  roles: readonly Role[],
): User[]
```

This is used to protect against removing the last person with access management rights.
