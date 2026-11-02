# Pages

What each page is for, its shape, and what can narrow it. Who sees each page is in
[access/views](../access/views.md); what can be done on it is in [access/acts](../access/acts.md).

#### UI-pages

| Page | For | Shape |
|---|---|---|
| Documents, My Documents | every document, or the person's own asks | a list with a record pane |
| Requests | the requests in the person's reach, and deciding the proposals | a list with a record pane |
| Documents Validations | ruling on defects and seeing what is forbidden | a list with a record pane |
| Digitization Lists | the lists, and building one | a list with a record pane; the editor is its own page |
| Projects | projects and how they stand | cards for proposed and active projects, tables for ended and rejected ones; each project has its own page |
| Categories | the tree, its custody and the selected mix | a tree with a record pane |
| Intentions | intentions and repeats, by state | a board; each intention's mix has its own page |
| Category mixes | mixes and their revisions | a list with a mix detail pane |
| Tasks | runs, running and past | a table; a run opens in a drawer |
| Schedules | what runs when | a timeline above a table |
| Users management | users, roles, groups and custodies, and what links them | four tabs, each a list with a record pane |
| Plugins | kinds, implementations and instances | a grouped table with drawers |
| Properties | the property definitions ([DOC-property](../model/documents.md#doc-property)) | a list with a record pane |
| Hooks | hooks and their deliveries | a list with a record pane |
| System watchlists | the system watchlists and their audiences; a person's own are in Preferences | a table |
| Preferences | notifications and personal settings | sections |

#### UI-filters

A page's filter bar has a search, a few fields on the bar itself, and the rest under
*+ Add filter*. Ranges are built in the advanced editor on notebook and large only, and shown as
removable chips everywhere. A field the person may not read is not offered
([PERM-absent-not-disabled](../access/permissions.md#perm-absent-not-disabled)).

#### UI-facets

Each filter value shows how many records it would find, counted over every other active filter,
so picking a value never hides its siblings.

#### UI-grouping

Grouping is presentation. It is never part of a filter or a watchlist.

#### UI-watchlist-tabs

A page with watchlists shows them as tabs above its list. Saving the current filter makes one.

The filter fields and groupings of each page, as the code declares them:

<!-- generated:page-filters -->
| Page | Watchlists | Filters | Groupings |
|---|---|---|---|
| Documents | `documents` | Status (on the bar) · Decision (on the bar) · Progress (on the bar) · Validation · Forbidden · Cancelled · Category · Project · Priority · Existing copy · Asked by · Pages (range) · Asked (range) · each property (by its type) | Group by batch · Group by project |
| My Documents | `my-documents` | Status (on the bar) · each property (by its type) | — |
| Requests | `requests` | Decision (on the bar) · Request custody (on the bar) · Material type · Project · Existing copy · Asked by · Batch · Askers · After the project's approval · Asked (range) · each property (by its type) | Group by batch · Group by requester |
| Documents Validations | `validations` | Review (on the bar) · Category (on the bar) · Forbidden · Defect · Priority · Project · Waiting since (range) · each property (by its type) | Group by category · Group by defect |
| Digitization Lists | `lists` | State (on the bar) · Needs attention · Runs (range) | — |
| Projects | `projects` | Decision (on the bar) · Period (on the bar) · Pace · Project dates (range) · Time elapsed (range) · Delivered (range) | — |
| Categories | `categories` | Kind (on the bar) · Custody · Needs attention · Documents (range) · Ready pages (range) | — |
| Category mixes | `mixes` | State (on the bar) · Primary · Proportions · Used by intentions (range) | — |
| Intentions | `intentions` | Type (on the bar) · State (on the bar) · Pace / attention (on the bar) · Repeat every · Mix · Project · Counting start (range) · Counting end (range) · Planned (range) · Delivered (range) · Time elapsed (range) | — |
| Tasks | `tasks` | State (on the bar) · Trigger (on the bar) · Plugin · Started by · Started (range) | — |
| Users management | no | Show (on the bar) | — |
| Plugins | no | Type (on the bar) · State (on the bar) | — |
| Hooks | no | Channel (on the bar) · State (on the bar) | — |
<!-- /generated:page-filters -->

## Lists

#### UI-columns

A page's list shows the columns its code declares, below. A list of records turns each row into a
card when it is narrower than 42rem, whatever the tier. A table declared per tier shows the set
of its tier ([UI-tiers](tiers.md#ui-tiers)); a tier it does not declare takes its neighbour's
towards notebook ([UI-notebook-first](tiers.md#ui-notebook-first)). A property is never a column
of its own accord ([DOC-property-filter](../model/documents.md#doc-property-filter)).

<!-- generated:page-columns -->
| List | Columns |
|---|---|
| Documents | Document · Status · Priority · Pages · Askers · Existing copy; a card per row when the list is narrow |
| My Documents | Document · Status · Copy · Asked; a card per row when the list is narrow |
| Requests | Document · Status · Askers · Pages · Asked · Existing copy; a card per row when the list is narrow |
| Documents Validations | Document · Status · Defects · Priority · Category · Since; a card per row when the list is narrow |
| Digitization Lists | List · State · Runs · Items · Pages · Delivered; a card per row when the list is narrow |
| List editor, pool and members | Document · Category · Priority · Pages; a card per row when the list is narrow |
| Projects, ended | large, notebook: Project · Period · Target · Planned · Delivered · Result<br>small: Project · Target · Planned · Delivered · Result<br>phone: Project · Target · Delivered · Result |
| Projects, rejected | large, notebook: Project · Period · Reason · Decided<br>small, phone: Project · Reason |
| Tasks, finished runs | large: What · Plugin · Trigger · Started · Took · State · Result<br>notebook: What · Trigger · Started · Took · Result<br>small, phone: What · Result |
| Schedules | large: What · Plugin · Runs · If still running · Last run · Next<br>notebook: What · Runs · Last run · Next<br>small, phone: What · Next |
| Plugins, instances | large: Instance · Configuration · Linked to · Runs · Last run<br>notebook: Instance · Configuration · Runs · Last run<br>small: Instance · Runs<br>phone: Instance |
| Properties | Property · Type · About · Visibility · Entered; a card per row when the list is narrow |
| Hooks | Hook · Fires on · 7 days · State; a card per row when the list is narrow |
<!-- /generated:page-columns -->

Projects shows its proposed and active projects as cards, and a table for the ended and the
rejected. Intentions is a board of cards, Categories a tree, and each of Users management's tabs a list.

## Record panes

#### UI-record-pane

A selected record opens beside its list ([UI-pane](tiers.md#ui-pane)): its heading, with its
acts beside it, a note on what stands out, its facts, then its cards in this order. What the
person may not read is absent, a card included
([PERM-absent-not-disabled](../access/permissions.md#perm-absent-not-disabled)).

| Page | Cards |
|---|---|
| Documents | Asked by · Existing copies · for the current attempt, Defects, Adding, Digitization and Earlier iterations · Catalog record · Properties · History |
| My Documents | Status, Asked and Read it as tiles · Why I asked · Properties, the public ones · What has happened |
| Requests | Decide · Asked by · Placed in · Existing copies · Catalog record · Properties · History |
| Documents Validations | Defects, as outstanding, denied and accepted · Forbidden, when it is · This attempt · Catalog record, with *Open in the catalog* · Properties · History |
| Digitization Lists | its state and figures as tiles · On this list · Counts towards · Mix · History |
| Categories | its figures as tiles · the shares of its children, or of the top level, in the selected mix · Needs attention, on *All categories* · Documents here, on a leaf · Custody |
| Tasks | a run, in a drawer that may open over any page: Run · What it changed · Items · Log |
| Plugins | an implementation, in a drawer: what it declares and supplies, its versions and instances; an instance: its configuration, what it supplies, when it runs, the hooks sending through it |
| Properties | a definition: Definition · its values, for an enum |
| Hooks | a hook: Subscription · What it sends · Deliveries |
| Users management | a user, role, group or custody, each with where it comes from ([ACCESS-provenance](../access/people.md#access-provenance)) |
| Projects | its own page: Against the target · About · Members · Proposals · Lists · What it funded |
| Intentions | the card itself, opened in place |
| Category mixes | a mix: Definition · Where used · Revisions and snapshots |

The Catalog record card gives the page count with each of its sources
([DOC-page-count](../model/documents.md#doc-page-count)), and the source of the title, type and
shelf mark ([DOC-property-predefined](../model/documents.md#doc-property-predefined)).

## What a page leaves out

#### UI-not-here

Each page leaves out what another page owns, so two pages never disagree about it:

| Page | Not here | Instead |
|---|---|---|
| Documents | deciding an ask | Requests ([VIEW-requests](../access/views.md#view-requests)) |
| Documents | ruling on a defect | Documents Validations ([VIEW-validations](../access/views.md#view-validations)) |
| Documents, Documents Validations | repairing a catalog fact other than the page count | the catalog, read again with *Recheck* ([DOC-manual-page-count](../model/documents.md#doc-manual-page-count)) |
| Documents | building a list | the list editor ([VIEW-lists](../access/views.md#view-lists)) |
| My Documents | staff properties, the internal half of a reason, who did a step | staff detail ([DOC-property-visibility](../model/documents.md#doc-property-visibility), [ACT-reason-two-texts](../access/acts.md#act-reason-two-texts), [LOG-public](../model/log.md#log-public)) |
| Requests | an approved request | Documents ([VIEW-requests](../access/views.md#view-requests)) |
| Digitization Lists | what a list counts towards, as a stored link | worked out from its members and its start ([REL-list-provenance](../model/relationships.md#rel-list-provenance)) |
| Projects | a target or a mix of the project's own | its intention ([LC-PROJ-own-intention](../lifecycles/project.md#lc-proj-own-intention)) |
| Users management | granting category custody | Categories ([ACCESS-grant-custody](../access/custody.md#access-grant-custody)) |
| Users management | project membership | the project ([ACCESS-project-members](../access/custody.md#access-project-members)) |
| Users management | system watchlists | Watchlists ([VIEW-watchlists](../access/views.md#view-watchlists)) |
| Plugins | editing a schedule | Schedules ([ACT-schedule-save](../access/acts.md#tasks-and-schedules)) |
| Hooks | a person's watchlist notifications | Preferences → Watchlists ([WATCH-delivery](../integrations/watchlists.md#watch-delivery)) |
