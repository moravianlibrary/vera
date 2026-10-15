# Views

Which pages a person sees, and what each page shows, by what they hold. What they can *do* on a
page is in [acts](acts.md).

## The sidebar

#### VIEW-entry-requires

Each sidebar entry names the permissions that reveal it. The entry is shown when the person
holds any of them, at any scope. An entry they cannot open is absent, never disabled
([PERM-absent-not-disabled](permissions.md#perm-absent-not-disabled)).

#### VIEW-own-label

Documents comes in two pages, each its own entry, one per detail:
- **Documents**, with `iteration.read`: the approved work in staff detail;
- **My Documents**, with `request.read_mine`: what the person asked for, or their projects asked
  for, in public detail.

Someone holding both has both entries. **Tasks** becomes *My Tasks* without `task.read`.


#### VIEW-mixes-entry

*Mixes* has its own entry only for a person who cannot open Categories; everyone else reaches
mixes from the Categories mix picker. The page stays at `/mixes` for anyone holding `mix.read`.

#### VIEW-gate

Every page, nested pages included, is gated by its entry's permissions. A person who opens a
page they cannot see is sent to their landing page. The nested pages are:
- the list editor (`/lists/new`, `/lists/:id/edit`);
- a project's page (`/projects/:id`);
- an intention's mix (`/intentions/:id/mix`);
- a mix (`/mixes/:id`).

#### VIEW-landing

`/` opens the first sidebar entry the person holds. A person who holds none sees *No access
yet* ([ACCESS-no-access-yet](people.md#access-no-access-yet)).

There is no Home page: it would carry the counts the flat navigation leaves out
([DEC-0007](../../decisions/DEC-0007-flat-navigation.md)), and Watchlists already say what is new.

The entries in sidebar order, and what each shipped role sees when it is the only role held. An
empty cell means the entry is absent.

<!-- generated:sidebar -->
| Entry | Path | Shown with any of | `reader` | `staff` | `project-user` | `curator` | `dig-curator` | `admin` |
|---|---|---|---|---|---|---|---|---|
| My Documents | `/my-documents` | `request.read_mine` | My Documents | My Documents | My Documents | My Documents | My Documents | My Documents |
| Documents | `/documents` | `iteration.read` |  |  |  | Documents | Documents | Documents |
| Proposals | `/review/proposals` | `request.decide` |  |  |  | Proposals | Proposals | Proposals |
| Documents Validations | `/review/documents` | `validation.approve` · `validation.deny` · `validation.revoke` |  |  |  | Documents Validations | Documents Validations | Documents Validations |
| Digitization Lists | `/lists` | `list.read` |  |  |  |  | Digitization Lists | Digitization Lists |
| Projects | `/projects` | `project.read` |  |  | Projects | Projects | Projects | Projects |
| Categories | `/categories` | `category.read` |  |  |  | Categories | Categories | Categories |
| Intentions | `/intentions` | `intention.read` |  |  | Intentions |  | Intentions | Intentions |
| Mixes | `/mixes` | `mix.read` |  |  |  |  |  |  |
| Tasks | `/tasks` | `task.read_own` · `task.read` |  |  |  | My Tasks | My Tasks | Tasks |
| Schedules | `/schedules` | `task.read` |  |  |  |  |  | Schedules |
| Users management | `/access` | `access.read` |  |  |  |  |  | Users management |
| Plugins | `/plugins` | `plugin.read` |  |  |  |  |  | Plugins |
| Hooks | `/hooks` | `hook.read` |  |  |  |  |  | Hooks |
| Watchlists | `/watchlists` | `watch` · `watchlist.manage_system` | Watchlists | Watchlists | Watchlists | Watchlists | Watchlists | Watchlists |
<!-- /generated:sidebar -->

## What a page shows, by what you hold

#### VIEW-documents-audience

Which documents a person sees comes from a grant's scope; how much of each, from which permission
grants it ([VIEW-own-label](#view-own-label)):
- **staff**, on Documents, with `iteration.read`: approved work, a document with an iteration,
  until it is published or cancelled, with its full record. At `custody`, those whose current
  iteration is in the person's category custody
  ([SCOPE-custody-category](scopes.md#scope-custody-category)); at `project`, those asked for or
  funded through a project they are on ([SCOPE-project](scopes.md#scope-project)); at `any`,
  every one; at each, also the person's own. Undecided and declined asks are on Requests;
- **public**, on My Documents, with `request.read_mine`: at `own`, what the person asked for; at
  `project`, also what other members asked for in the projects they are on. Each with the asks
  it reaches and the public half of every reason.

In the public audience, the history shows only the steps that move a request forward or hold it
(accepted, not accepted, not available, on hold, digitized, available to read). A person who did
one is never named, and no reason detail is shown
([LOG-public](../model/log.md#log-public)).


#### VIEW-ingest-detail

The ingest failure text and the *Batch* grouping on Documents need `request.read_ingest`. Without it,
a failed addition shows only that it failed.

#### VIEW-proposals

Proposals shows the proposals in the person's proposal custodies, or every proposal at
`request.decide@any`, with the custodies each one is in.

> **Open — [L1](../../ledger.md#l1-requestread-opens-requests).** `request.read` is to open the
> page read-only, for the requests in its reach; `request.decide` adds the decision acts.

#### VIEW-validations

Documents Validations and its entry open with any of `validation.approve`, `validation.deny` or
`validation.revoke`. It lists the current iterations that are held for review or forbidden, in
the person's category custody, or everywhere at `any`.

#### VIEW-lists

Digitization Lists shows the lists within `list.read`'s reach
([SCOPE-list](scopes.md#scope-list)). The pool of items ready to list, and Generate, need
`list.create` or `list.edit`.

#### VIEW-projects

Projects shows the projects the person is on at `project.read@project`, and every project at
`project.read@any`. Deciding shows nothing by itself
([PERM-requires](permissions.md#perm-requires)).

#### VIEW-categories-mix

Categories shows the tree to anyone with `category.read`. The mix figures, and the shares in the
impact of a change, need `mix.read`.

#### VIEW-intentions

Intentions shows the intentions within `intention.read`'s reach:
- intentions funded by a project the person is on, at `project`;
- every intention at `any`.

A project's own intention is listed only once the project is decided. Repeats are listed at
`any` only.

#### VIEW-tasks

Tasks shows a person their own runs with `task.read_own`, and everybody's with `task.read`.
Schedules needs `task.read`.

#### VIEW-plugins-hooks

On Plugins, a delivery channel lists the hooks that send through it only to a person holding
`hook.read`.

#### VIEW-watchlists

The Watchlists entry shows with `watch` or `watchlist.manage_system`. A watchlist over a page
appears only to people who can open that page
([WATCH-audience](../integrations/watchlists.md#watch-audience)).
