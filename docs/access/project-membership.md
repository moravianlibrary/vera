# Project Membership

How users participate in projects: as manager, member, or via group. Extracted from
`frontend/src/domain/access.ts` and `docs/design/shared/entities/projects.md`.

## The entity

```ts
interface ProjectMembership {
  id: string;
  name: string;
  managerId: string;            // the project's manager
  memberIds: string[];          // direct members (manager among them)
  memberGroupIds: string[];     // groups whose members are members
}
```

## Where membership is resolved

A project is a project membership — it carries its own member list. The `projectsOf()`
function resolves a user's place in each project:

```ts
type ProjectVia = "manager" | "member" | { groupId: string };

interface ProjectPlace {
  projectId: string;
  via: ProjectVia;
}

function projectsOf(
  userId: string,
  groups: readonly AccessGroup[],
  projects: readonly ProjectMembership[],
): ProjectPlace[]
```

Returns:
- `{ projectId: "x", via: "manager" }` — the user is the manager
- `{ projectId: "x", via: "member" }` — the user is a direct member
- `{ projectId: "x", via: { groupId: "team-a" } }` — via a group membership

## What membership enables

- **Proposing into their project** with `request.create` — membership puts the project
  on the propose form, not a separate grant.
- **`project`-scoped permissions** — `project.read@project`, `intention.read@project`,
  `intention.edit@project` resolve against projects the user is in.
- **`managed`-scoped permissions** — only the **manager** can `project.edit@managed`,
  `project.manage_members@managed`, and `project.delete@managed`.

## The new `managed` scope

`managed` was added to answer the project manager's scope. It is narrower than `project`:

| Scope | Applies to | Who |
|---|---|---|
| `project` | Any project the user is in | Members + manager |
| `managed` | Projects the user manages | Manager only |
| `any` | All projects | Anyone holding `@any` |

The shipped roles:
- **staff** has no project grants; membership alone does not grant project access
- **curator** holds `project.read@project`, `project.edit@managed`,
  `project.manage_members@managed`, `project.delete@managed`, and
  `project.decide@any` (approve/reject projects)
- **dig-curator** has wider project grants at `any`
- **admin** holds all project permissions at `any`

## Where it appears

| Surface | What |
|---|---|
| **Projects** | Manager displayed, members listed, "Add member" button |
| **Project detail** | Members, group members, manager handover |
| **User record** | Projects they participate in, their role (manager/member/via group) |
| **Propose form** | Projects the user is a member of appear as project choices |

## Project lifecycle

A project has a state machine separate from its membership:

```
Proposed → Approved (terminal)
Proposed → Rejected (terminal)
Any → Deleted (terminal, only when empty)
```

Membership changes don't affect the project state, and vice versa. The manager can
hand over to another member (`project.manage_members`), which changes the `managerId`.
