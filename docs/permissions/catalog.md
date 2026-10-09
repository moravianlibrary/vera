# Permission Catalog

Every permission key, its group, and the scopes it accepts. This is the source of truth
for what a role can grant — the role editor only offers these, and the server refuses any
other. Extracted from `frontend/src/domain/permissions.ts`.

## Self-scoped permissions

These act on the actor's own records by definition. They still need a **grant** — but no
**scope**, because there is nothing to vary.

| Permission | Group | Resolves against |
|---|---|---|
| `request.create` | Requests | The user's own: anyone who holds it may propose |
| `request.read_own` | Requests | The user's own requests and their iterations |
| `request.withdraw_own` | Requests | The user's own pending requests |
| `task.read_own` | Administration | The tasks the user started |
| `watch` | Watchlists | Anything the user can already read |

## Scoped permissions

For each, the accepted scopes are listed. `✱` marks scopes used by the shipped roles.

### Requests

| Permission | Accepted scopes | What it gates |
|---|---|---|
| `request.read` | `custody` · `project` · `any` ✱ | Other people's asks and reasons |
| `request.decide` | `custody` ✱ · `any` ✱ | Approve / decline, set category + priority |

### Iterations

| Permission | Accepted scopes | What it gates |
|---|---|---|
| `iteration.read` | `custody` · `project` · `any` ✱ | Other people's iterations |
| `iteration.recheck` | `custody` ✱ · `any` ✱ | Re-read from catalog, rerun checks |
| `iteration.classify` | `custody` ✱ · `any` ✱ | Change category and priority after approval |
| `validation.approve` | `custody` ✱ · `any` ✱ | Accept the outstanding defect set |
| `validation.deny` | `custody` ✱ · `any` ✱ | Deny with reason |
| `validation.revoke` | `custody` ✱ · `any` ✱ | Revoke an acceptance |
| `restriction.overrule` | `any` ✱ | Lift a rule-based prohibition |
| `iteration.cancel` | `custody` ✱ · `any` ✱ | Stop work on an iteration |
| `iteration.resume` | `custody` ✱ · `any` ✱ | Restart a cancelled iteration |
| `iteration.publish` | `custody` ✱ · `any` ✱ | Set or change the published link |

### Additions

| Permission | Accepted scopes | What it gates |
|---|---|---|
| `addition.read` | `custody` ✱ · `any` ✱ | Ingest detail: batch, failure text |
| `addition.retry` | `any` ✱ | Retry ingest (per item or per batch) |
| `addition.read_payload` | `any` ✱ | Raw ingest responses |

### Lists and planning

| Permission | Accepted scopes | What it gates |
|---|---|---|
| `list.read` | `custody` · `project` · `any` ✱ | See digitization lists |
| `list.create` | `any` ✱ | Create lists, run generators |
| `list.edit` | `any` ✱ | Edit membership, dates, Mark Done |
| `list.delete` | `any` ✱ | Delete lists, return items to pool |
| `intention.read` | `project` · `any` ✱ | See intentions |
| `intention.edit` | `project` · `any` ✱ | Edit intentions, their mixes |
| `intention.edit_overall` | `any` ✱ | Edit the Overall mix |
| `intention.repeat` | `any` ✱ | Repeat intentions |
| `mix.read` | `any` ✱ | See a distribution's shares |
| `mix.edit` | `any` ✱ | Edit a distribution |
| `mix.manage` | `any` ✱ | Manage distributions |
| `project.read` | `project` · `any` ✱ | See projects |
| `project.create` | `any` ✱ | Create projects (becomes manager) |
| `project.edit` | `managed` · `any` ✱ | Edit project details, dates |
| `project.manage_members` | `managed` · `any` ✱ | Add/remove members, hand over |
| `project.decide` | `any` ✱ | Approve or reject projects |
| `project.delete` | `managed` · `any` ✱ | Delete empty projects |

### Categories

| Permission | Accepted scopes | What it gates |
|---|---|---|
| `category.read` | `custody` · `any` ✱ | See categories |
| `category.edit` | `custody` ✱ · `any` ✱ | Rename, reparent, refine a leaf |
| `category.grant_custody` | `custody` ✱ · `any` ✱ | Assign custody within subtree |

### Watchlists

| Permission | Accepted scopes | What it gates |
|---|---|---|
| `watchlist.manage_shared` | `any` ✱ | Create, edit, delete shared watchlists and set audience |

### Administration

| Permission | Accepted scopes | What it gates |
|---|---|---|
| `plugin.read` | `any` ✱ | See plugins |
| `plugin.configure` | `any` ✱ | Configure plugins |
| `plugin.upload_code` | `any` ✱ | Upload plugin code |
| `plugin.run` | `any` ✱ | Run plugins |
| `hook.read` | `any` ✱ | See hooks |
| `hook.configure` | `any` ✱ | Configure hooks, act on deliveries |
| `task.read` | `any` ✱ | See other people's tasks |
| `task.cancel` | `any` ✱ | Cancel other people's runs |
| `task.schedule` | `any` ✱ | Create, edit, pause, delete schedules |
| `access.read` | `any` ✱ | See users, groups, roles, custody |
| `access.manage` | `any` ✱ | Manage users, groups, roles, custody |

## Total

**60 permissions** across 7 groups. The shipped roles use **44 of them** (reader starts with
5, admin holds all 60).
