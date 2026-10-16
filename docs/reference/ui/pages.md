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
| Mixes | mixes and their revisions | a list with a mix page |
| Tasks | runs, running and past | a list with a record pane |
| Schedules | what runs when | a timeline |
| Users management | users, roles, groups and custodies, and what links them | linked columns |
| Plugins | kinds, implementations and instances | a grouped table with drawers |
| Properties | the property definitions ([DOC-property](../model/documents.md#doc-property)) | a table with drawers |
| Hooks | hooks and their deliveries | a table with drawers |
| Watchlists | every watchlist the person sees, and notifications | one table per page |
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
| Documents | `documents` | Status (on the bar) · Decision (on the bar) · Progress (on the bar) · Validation · Forbidden · Cancelled · Category · Project · Priority · Existing copy · Asked by · Pages (range) · Asked (range) | Group by batch · Group by project |
| My Documents | `my-documents` | Status (on the bar) | — |
| Requests | `requests` | Decision (on the bar) · Request custody (on the bar) · Material type · Project · Existing copy · Asked by · Batch · Askers · After the project's approval · Asked (range) | Group by batch · Group by requester |
| Documents Validations | `validations` | Review (on the bar) · Category (on the bar) · Forbidden · Defect · Priority · Project · Waiting since (range) | Group by category · Group by defect |
| Digitization Lists | `lists` | State (on the bar) · Needs attention · Runs (range) | — |
| Projects | `projects` | Decision (on the bar) · Period (on the bar) · Pace · Project dates (range) · Time elapsed (range) · Delivered (range) | — |
| Categories | `categories` | Kind (on the bar) · Custody · Needs attention · Documents (range) · Ready pages (range) | — |
| Intentions | `intentions` | Type (on the bar) · State (on the bar) · Pace / attention (on the bar) · Repeat every · Mix · Project · Counting start (range) · Counting end (range) · Planned (range) · Delivered (range) · Time elapsed (range) | — |
| Tasks | `tasks` | State (on the bar) · Trigger (on the bar) · Plugin · Started by · Started (range) | — |
| Users management | no | Show (on the bar) | — |
| Plugins | no | Type (on the bar) · State (on the bar) | — |
| Hooks | no | Channel (on the bar) · State (on the bar) | — |
<!-- /generated:page-filters -->

> **Open — [L36](../../ledger.md#l36-pages-reference).** This page is a first cut. The columns of
> each list, what each record pane shows, and what each page deliberately leaves out (the old
> `view-catalog.md`) are still to be written down from the code.
