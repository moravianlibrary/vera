# Groups

What groups are, what they carry, and how they differ from roles. Extracted from
`frontend/src/domain/access.ts` and `docs/design/shared/entities/permissions.md`.

## What groups are

Groups are **administrative containers** that carry **custody and project membership** —
**never roles**. A group answers "who do I sit with", not "what may I do".

```ts
interface AccessGroup {
  id: string;
  name: string;
  description: string;
  memberIds: string[];          // users in this group
  categoryIds: string[];        // category custody the group holds
}
```

## Why groups don't grant roles

If a group carried permissions directly, *Periodicals Curators* and *Monographs Curators*
would each hold their own copy of the whole curator permission list. Changing what a curator
may do would mean editing every such group. A role is the thing you edit when the job
changes.

## What groups DO carry

A group is a vehicle for three things:

### 1. Category custody

The group's `categoryIds` are categories where members have custody responsibility.

```ts
// Category custody a user has — directly or via group
function categoryCustodyOf(
  userId: string,
  groups: readonly AccessGroup[],
  memberships: readonly CategoryMembership[],
): { categoryId: string; via: string | null }[]
```

Result: `[{ categoryId: "periodicals", via: null }]` or
`[{ categoryId: "periodicals", via: "mzk-periodicals-group" }]`.

### 2. Proposal custody

Groups can be members of proposal custodies (in addition to individual users).

```ts
// Proposal custody a user has — directly or via group
function proposalCustodyOf(
  userId: string,
  groups: readonly AccessGroup[],
  custodies: readonly CustodyMembers[],
): { custodyId: string; via: string | null }[]
```

### 3. Project membership

A project's `memberGroupIds` makes group members project members.

```ts
// Projects a user participates in — as manager, member, or via group
function projectsOf(
  userId: string,
  groups: readonly AccessGroup[],
  projects: readonly ProjectMembership[],
): ProjectPlace[]
```

Result: `[{ projectId: "x", via: "manager" }]` or
`[{ projectId: "x", via: { groupId: "team-a" } }]`.

## The three concepts

| | Answers | Why it is not one of the others |
|---|---|---|
| **Role** | *what may I do* | The unit of **change** — "what a curator may do" is defined once |
| **Group** | *who do I sit with* | The unit of **administration** — one act puts a colleague in a team |
| **Custody / project** | *what may I do it **to*** | The unit of **responsibility** — a subtree, a set of proposals, or a funded envelope |

## Provenance

Every screen showing what someone may do shows **how** they came to it:

- "custody of Periodicals — **via** Periodicals Curators"
- "member of Project X — **via** Team A"

The `via` field is `null` for direct membership and the group id for indirect.

## What holding a group confers

A group's detail screen shows **what holding it gives**: the custody, proposal custody, and
projects it brings. This makes the consequence of adding somebody visible at the moment of
adding them.
