# Shipped Roles

The five roles that come with VERA. They are **bundles of grants**, editable, with nothing
structural distinguishing them from a role created later. They are "bundles, not a ladder" —
one role is not "above" another; they overlap and extend differently.

Extracted from `frontend/src/domain/permissions.ts` and `docs/design/shared/entities/permissions.md`.

## Grant coverage in the shipped roles

```
admin
 └── dig-curator
      └── curator
           ├── reader
           └── staff
```

An arrow here means the upper role has strictly wider grants. Reader and staff
have identical grants; their daily proposal limits differ. Grant coverage is
not automatic role assignment: people hold roles directly or through identity
mappings. `project-user` is not a shipped role.

Both `reader` and `staff` can propose at most 10 items per submission by default.
Curator, dig-curator and admin roles explicitly set `null` (unlimited).

Each role also sets a **daily limit** on accepted proposals. The shipped reader and staff
roles set 100 and 300 items per calendar day respectively; curator, dig-curator and admin explicitly set
`null` (unlimited). The mock uses the library's Europe/Prague day. Among roles
granting `request.create`, the highest numeric limit applies for each setting,
or unlimited if one sets `null`. `request.decide` itself affects neither limit.

## The five shipped roles

### reader

Only self-scoped grants. A reader can propose items and see their own documents. Nothing
else — no sidebar entries beyond "My Documents." Readers are typically external users
(researchers, patrons). They are **limited in how many items they can propose at once**
(10 by default) to prevent abuse.

| Permission | Scope |
|---|---|
| `request.create` | (self-scoped) |
| `request.read_own` | (self-scoped) |
| `request.withdraw_own` | (self-scoped) |
| `watch` | (self-scoped) |

**Sidebar**: "My Documents" (one entry, so `/` redirects there).

**Proposal limit**: `maxAtOnce` (default 10). External users are capped to prevent
queue flooding.

**Daily limit**: 100 accepted items per calendar day by default. The remaining count
is displayed in the propose dialog.

### staff

The same grants as reader, with a higher daily proposal limit. Staff have no
project, category, or task access from this role.

| Permission | Scope |
|---|---|
| *(all reader grants)* | |

**Sidebar**: My Documents.

**Proposal limit**: Same 10 items per submission as readers by default. A higher staff
batch limit is not implemented.

**Daily limit**: 300 accepted items per calendar day through the staff role. Another
held role may raise that limit or set it to unlimited.

### curator

Reader/staff grants plus project and category permissions. The main operational role. Can propose, approve,
decline, validate, reclassify, cancel, resume, publish, edit categories, and manage
categories. Its proposal limits are explicitly unlimited.

| Permission | Scope |
|---|---|
| *(reader/staff grants)* | |
| `task.read_own` | (self-scoped) |
| `project.create` | `any` |
| `project.read` | `project` |
| `project.edit` | `managed` |
| `project.manage_members` | `managed` |
| `project.delete` | `managed` |
| `iteration.read` | `any` |
| `request.read` | `any` |
| `category.read` | `any` |
| `request.decide` | `custody` |
| `iteration.recheck` | `custody` |
| `iteration.classify` | `custody` |
| `validation.approve` | `custody` |
| `validation.deny` | `custody` |
| `validation.revoke` | `custody` |
| `iteration.cancel` | `custody` |
| `iteration.resume` | `custody` |
| `iteration.publish` | `custody` |
| `addition.read` | `custody` |
| `category.edit` | `custody` |
| `category.grant_custody` | `custody` |
| `project.decide` | `any` |

**Sidebar**: Documents, Proposals, Documents Validations, Projects,
Categories, Tasks.

**Includes**: all reader and staff grants.

**Daily limit**: Unlimited because this role sets its limit to `null`. Editing the role
to a number applies that limit even while it grants `request.decide`.

### dig-curator

Curator + list/intention/project permissions and broader cancellation/resume. The digitization planner.
Can create and manage lists, edit intentions, manage projects at `any`, and cancel/resume
at `any`.

| Permission | Scope |
|---|---|
| *(all curator grants)* | |
| `list.read` | `any` |
| `list.create` | `any` |
| `list.edit` | `any` |
| `list.delete` | `any` |
| `intention.read` | `any` |
| `intention.edit` | `any` |
| `project.read` | `any` |
| `project.edit` | `any` |
| `project.manage_members` | `any` |
| `project.delete` | `any` |
| `project.decide` | `any` (already in curator) |
| `mix.read` / `mix.edit` | `any` |
| `iteration.cancel` | `any` |
| `iteration.resume` | `any` |

**Sidebar**: Documents, Proposals, Documents Validations, Digitization Lists,
Projects, Intentions, Categories, Tasks.

**Daily limit**: Unlimited because this role sets its limit to `null`.

### admin

Everything at `any`. Can manage access, configure plugins, manage hooks, schedule tasks.

| Permission | Scope |
|---|---|
| *(all other roles)* | |
| `restriction.overrule` | `any` |
| `access.manage` | `any` |
| *(every plugin, hook, task permission at `any`)* | |

**Sidebar**: Everything — all entries visible.

**Daily limit**: Unlimited because this role sets its limit to `null`.

## Project user as a custom role

Reader grants + `project.read@project` would make a role for an external
project member. This is more access than reader alone: project membership
defines *which* project, and this grant permits reading it. No `project-user`
role exists in the shipped fixtures. Staff has no `project.read` grant; curator
has `project.read@project`.

| Permission | Scope |
|---|---|
| *(all reader grants)* | |
| `project.read` | `project` |

**Sidebar**: My Documents, Projects (only projects the user is a member of).

The creator of this role would set its per-submission and daily proposal limits.

## How they interact

- **Union, never intersection.** A person holding two roles gets the wider scope of each
  permission. There is no deny rule and no precedence order.
- **A person can hold multiple shipped roles.** For example, someone with both `curator`
  and `dig-curator` gets the union: all custody-scoped permissions plus all list/intention
  permissions.
- **An empty role produces an empty sidebar.** A user with no role at all sees nothing —
  no sidebar entries, no Home, no content. This is the intended failure mode.
