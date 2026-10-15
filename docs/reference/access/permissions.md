# Permissions

What a person may do is the set of **grants** their roles give them. A grant is a permission
and a scope. This file defines the permissions and the scopes each one accepts. How a scope
reaches a record is in [scopes](scopes.md); the roles that ship with VERA are in
[roles](roles.md).

## The rules

#### PERM-grant

A grant is a permission plus a scope: `validation.approve@custody`. The scope is on the grant,
not on the permission, so the same permission at `any` is a wider role, not another permission.

#### PERM-self-scoped

A self-scoped permission (`request.create`, `request.read_own`, `request.withdraw_own`,
`task.read_own`, `watch`) acts on the holder's own records and takes no scope. It is still a
grant and has to be given.

*Why:* without the grant, an account given nothing would still see its own documents, and a
misconfigured empty role would go unnoticed. VERA fails closed: a person with no roles sees an
empty application, and somebody notices within a minute.

#### PERM-accepted-scopes

Each permission accepts a fixed set of scopes, listed in the catalog below. The set is part of
the model, not of a role. The role editor offers only these, and the server refuses a grant at
any other scope.

#### PERM-once-per-role

A role grants each permission at most once, at one scope.

#### PERM-requires

Some permissions need another: managing a project needs reading it. A role that grants one must
also grant what it needs, at a scope that covers it (`any` covers every scope and `project`
covers `managed`; otherwise the same scope). The role editor ticks what is needed when a permission is ticked, and the server
refuses a role that misses one (422).

*Why:* the check is on the role, not the person. A union of roles that each hold what they need
holds what it needs, so a person can never end up able to act on what they cannot see.

In the table, `@any` marks a need met only at `any`, and *any scope* one met at whatever scope it
is held, as creating a project reaches no project yet. A self-scoped need is met by holding it.
Nothing reads implicitly: deciding projects shows them only through `project.read@any`.

<!-- generated:permission-requires -->
| Permission | Needs |
|---|---|
| `request.create`, `request.withdraw_own` | `request.read_own` |
| `request.decide` | `request.read` |
| `request.read_ingest`, `iteration.recheck`, `iteration.classify`, `validation.approve`, `validation.deny`, `validation.revoke`, `restriction.overrule`, `iteration.cancel`, `iteration.resume`, `iteration.publish`, `list.read` | `iteration.read` |
| `request.retry`, `request.read_payload` | `request.read_ingest` |
| `project.create` | `project.read` (any scope) |
| `project.edit`, `project.manage_members`, `project.delete` | `project.read` |
| `project.decide` | `project.read@any` |
| `watchlist.manage_system` | `watch`, `iteration.read@any` |
| `list.create`, `list.edit`, `list.delete` | `list.read@any`, `iteration.read@any` |
| `intention.edit` | `intention.read`, `mix.read` |
| `intention.repeat` | `intention.edit@any` |
| `mix.edit` | `mix.read` |
| `mix.manage` | `mix.edit` |
| `category.edit`, `category.grant_custody` | `category.read` |
| `task.cancel`, `task.schedule` | `task.read` |
| `plugin.configure`, `plugin.run` | `plugin.read` |
| `plugin.upload_code` | `plugin.configure` |
| `hook.configure` | `hook.read` |
| `access.manage` | `access.read` |
<!-- /generated:permission-requires -->

#### PERM-absent-not-disabled

An act whose permission the person lacks is absent from the page, never shown disabled. A field
they may not read is absent, not blanked, and a property they may not read cannot be filtered on.

*Why:* a filter on something you cannot read works as an oracle for probing records.

#### PERM-server-decides

The frontend only hides what a person cannot do. The server checks every request again,
scope included, and refuses with 403.

## The catalog

`own` marks a self-scoped permission. The headings are the groups the role editor shows.

<!-- generated:permission-catalog -->
### Requests

| Permission | Scopes | What it lets you do |
|---|---|---|
| `request.create` | own | raise a proposal |
| `request.read_own` | own | my requests and what they became |
| `request.withdraw_own` | own | take back my own ask |
| `request.read` | `custody` · `project` · `any` | other people's requests |
| `request.decide` | `custody` · `any` | approve or decline a proposal, rescans included; custody is proposal custody |
| `request.read_ingest` | `custody` · `any` | ingest detail: batch, failure text |
| `request.retry` | `custody` · `any` | ingest again |
| `request.read_payload` | `any` | raw responses |
| `project.read` | `project` · `any` | see projects |
| `project.create` | `any` | start a project; it starts Proposed |
| `project.edit` | `managed` · `any` | edit a project |
| `project.manage_members` | `managed` · `any` | who is on a project, and its manager |
| `project.delete` | `managed` · `any` | delete a project with no proposals |
| `project.decide` | `any` | approve or reject a project |

### Iterations

| Permission | Scopes | What it lets you do |
|---|---|---|
| `iteration.read` | `custody` · `project` · `any` | other people's documents |
| `iteration.recheck` | `custody` · `any` | read the record from the catalog again and rerun the checks |
| `iteration.classify` | `custody` · `any` | category and priority, after approval |
| `validation.approve` | `custody` · `any` | accept the outstanding defects |
| `validation.deny` | `custody` · `any` | refuse, with a reason |
| `validation.revoke` | `custody` · `any` | take an approval back |
| `restriction.overrule` | `any` | lift a restriction; never custody |
| `iteration.cancel` | `custody` · `any` | stop work, with a reason |
| `iteration.resume` | `custody` · `any` | restart stopped work |
| `iteration.publish` | `custody` · `any` | set the link where the scan is available |

### Planning

| Permission | Scopes | What it lets you do |
|---|---|---|
| `list.read` | `custody` · `project` · `any` | see digitization lists |
| `list.create` | `any` | build a list, generators included |
| `list.edit` | `any` | membership and dates |
| `list.delete` | `any` | return a list's members to the pool |
| `intention.read` | `project` · `any` | see intentions |
| `intention.edit` | `project` · `any` | create and edit intentions, and their mix |
| `intention.repeat` | `any` | repeating intentions |
| `mix.read` | `any` | see mixes and their revisions |
| `mix.edit` | `any` | create mixes and edit their proportions |
| `mix.manage` | `any` | archive mixes and choose the Primary mix |

### Categories

| Permission | Scopes | What it lets you do |
|---|---|---|
| `category.read` | `custody` · `any` | see the tree |
| `category.edit` | `custody` · `any` | rename, move, refine |
| `category.grant_custody` | `custody` · `any` | bring somebody onto a branch |

### Watchlists

| Permission | Scopes | What it lets you do |
|---|---|---|
| `watch` | own | save watchlists over what I can read |
| `watchlist.manage_system` | `any` | create, change and remove system watchlists, and set who sees them |

### Administration

| Permission | Scopes | What it lets you do |
|---|---|---|
| `task.read_own` | own | the tasks I started, and cancelling them |
| `task.read` | `any` | everybody's tasks, and Schedules |
| `task.cancel` | `any` | cancel somebody else's run |
| `task.schedule` | `any` | edit schedules and retention |
| `plugin.read` | `any` | see plugins |
| `plugin.configure` | `any` | configure instances |
| `plugin.upload_code` | `any` | install plugin code |
| `plugin.run` | `any` | run a plugin now |
| `hook.read` | `any` | see hooks |
| `hook.configure` | `any` | edit hooks |
| `access.read` | `any` | see users, groups and roles |
| `access.manage` | `any` | change them, roles included |
<!-- /generated:permission-catalog -->
