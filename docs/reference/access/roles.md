# Roles

A role is a named bundle of grants ([permissions](permissions.md)), with two proposal limits.
VERA ships five roles. They are ordinary roles: editable, deletable, and nothing marks them
apart from roles created later except that they came with the installation.

## The rules

#### ROLE-bundle

A role is a set of grants. Roles are bundles, not a ladder: one does not stand above another,
and a person holding two holds both.

*Why:* the role is the unit of change. What a curator may do is defined once, and changing it
reaches every curator.

#### ROLE-held-by-people

Roles are held by people: by hand, or mapped by an Identity instance at login
([ACCESS-role-ways](people.md#access-role-ways)). A group never gives a role.

#### ROLE-union

A person's grants are the union of their roles' grants, each permission at its widest scope
([SCOPE-widest](scopes.md#scope-widest)).

#### ROLE-shipped-editable

The shipped roles can be edited and deleted like any other. Their names are their IDs.

#### ROLE-name

A role's name is lower-case words joined by hyphens (`dig-curator`), and unique. A name typed
otherwise is normalised: trimmed, lower-cased, spaces become hyphens.

#### ROLE-limits

A role sets two limits on proposing:
- the items per submission;
- the accepted items per person per calendar day.

`null` means unlimited. Among the person's roles that grant `request.create`, the highest
number applies to each limit, or unlimited if any of them sets `null`. Roles without
`request.create` do not count.

#### ROLE-library-day

The daily limit counts by the library's calendar day, in the library's time zone
(`Europe/Prague`).

#### ROLE-includes

A role includes another when it holds every grant of the other at least as wide. Users & Groups
names only the nearest included roles: *admin includes dig-curator*, not every role below it.

#### ROLE-delete

Deleting a role takes it from everyone who held it; they keep their other roles. A mapping that
still names it gives nothing until its Identity instance is changed on Plugins. The impact is
shown before deleting: the holders and what they keep, the mappings, and whether anyone could
still manage access.

## The shipped roles

#### ROLE-shipped

VERA installs `reader`, `staff`, `curator`, `dig-curator` and `admin` with the grants and
limits below.

> **Open — [L47](../../ledger.md#l47-the-project-user-role).** A sixth shipped role,
> `project-user`, is decided: the reader's grants plus starting and running projects, with the
> staff limits. It follows
> [L2](../../ledger.md#l2-documents-follows-the-scope-of-iterationread).

<!-- generated:role-limits -->
| Role | Description | Items per submission | Accepted items per day |
|---|---|---|---|
| `reader` | Proposes and follows their own requests. Holds only self-scoped grants. | 10 | 100 |
| `staff` | Library staff: the reader grants with a higher daily proposal limit. | 10 | 300 |
| `curator` | Decides proposals in their proposal custody; validates, classifies and publishes inside their category custody; decides projects. | unlimited | unlimited |
| `dig-curator` | Plans the work: lists, intentions, projects. | unlimited | unlimited |
| `admin` | Everything, at any scope. | unlimited | unlimited |
<!-- /generated:role-limits -->

Grants, by scope; an empty cell is not granted.

<!-- generated:role-grants -->
| Permission | `reader` | `staff` | `curator` | `dig-curator` | `admin` |
|---|---|---|---|---|---|
| **Requests** | | | | | |
| `request.create` | own | own | own | own | own |
| `request.read_own` | own | own | own | own | own |
| `request.withdraw_own` | own | own | own | own | own |
| `request.read` |  |  | any | any | any |
| `request.decide` |  |  | custody | custody | any |
| `request.read_ingest` |  |  | custody | custody | any |
| `request.retry` |  |  | custody | custody | any |
| `request.read_payload` |  |  |  |  | any |
| `project.read` |  |  | any | any | any |
| `project.create` |  |  | any | any | any |
| `project.edit` |  |  | managed | any | any |
| `project.manage_members` |  |  | managed | any | any |
| `project.delete` |  |  | managed | any | any |
| `project.decide` |  |  | any | any | any |
| **Iterations** | | | | | |
| `iteration.read` |  |  | any | any | any |
| `iteration.recheck` |  |  | custody | custody | any |
| `iteration.classify` |  |  | custody | custody | any |
| `validation.approve` |  |  | custody | custody | any |
| `validation.deny` |  |  | custody | custody | any |
| `validation.revoke` |  |  | custody | custody | any |
| `restriction.overrule` |  |  |  |  | any |
| `iteration.cancel` |  |  | custody | any | any |
| `iteration.resume` |  |  | custody | any | any |
| `iteration.publish` |  |  | custody | custody | any |
| **Planning** | | | | | |
| `list.read` |  |  |  | any | any |
| `list.create` |  |  |  | any | any |
| `list.edit` |  |  |  | any | any |
| `list.delete` |  |  |  | any | any |
| `intention.read` |  |  |  | any | any |
| `intention.edit` |  |  |  | any | any |
| `intention.repeat` |  |  |  |  | any |
| `mix.read` |  |  |  | any | any |
| `mix.edit` |  |  |  | any | any |
| `mix.manage` |  |  |  |  | any |
| **Categories** | | | | | |
| `category.read` |  |  | any | any | any |
| `category.edit` |  |  | custody | custody | any |
| `category.grant_custody` |  |  | custody | custody | any |
| **Watchlists** | | | | | |
| `watch` | own | own | own | own | own |
| `watchlist.manage_system` |  |  |  |  | any |
| **Administration** | | | | | |
| `task.read_own` |  |  | own | own | own |
| `task.read` |  |  |  |  | any |
| `task.cancel` |  |  |  |  | any |
| `task.schedule` |  |  |  |  | any |
| `plugin.read` |  |  |  |  | any |
| `plugin.configure` |  |  |  |  | any |
| `plugin.upload_code` |  |  |  |  | any |
| `plugin.run` |  |  |  |  | any |
| `hook.read` |  |  |  |  | any |
| `hook.configure` |  |  |  |  | any |
| `access.read` |  |  |  |  | any |
| `access.manage` |  |  |  |  | any |
<!-- /generated:role-grants -->

What each one is for:
- **`reader`** — external users (researchers, patrons): propose and follow their own requests.
  Their only sidebar entry is *My Documents*.
- **`staff`** — library staff: the same grants as `reader` with a higher daily limit.
- **`curator`** — decides proposals in their proposal custody; validates, classifies, cancels,
  publishes and retries failed additions in their category custody; decides projects, and runs
  those they manage.
- **`dig-curator`** — plans the work: digitization lists, intentions, mixes and every project.
  In their custody it has the curator's acts too, and it cancels and resumes anywhere.
- **`admin`** — everything at `any`, including what no other role has: overruling restrictions,
  reading ingest payloads, archiving mixes, repeats, system watchlists, tasks, plugins, hooks and
  access.
