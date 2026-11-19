# Acts

Everything a person can do that changes something: what it needs, when it is allowed, what it
writes, and what the server refuses. The tables follow the server, which decides every act again
([PERM-server-decides](permissions.md#perm-server-decides)). The page only leaves out an act the
person cannot do.

How to read a row:
- **Needs** is the permission and, where it matters, the scope it is checked against.
- **Allowed when** is the state the record must be in.
- **Writes** is what the act adds to the status log ([log](../model/log.md)) and the hook event
  it fires ([HOOK-events](../integrations/hooks.md#hook-events)).
- *(no log)* marks an act whose change the log does not record yet. Each one is a
  [ledger](../../ledger.md#l7-access-and-planning-changes-are-not-logged) entry.

## Rules for every act

#### ACT-refusal

A refused act answers with a status and a message the person can act on: 403 when they may not,
404 when the record is not within their reach, 409 when its state does not allow it, 422 when
the input is wrong, 429 when a limit is reached. Every refusal carries a code (`list.done`,
`access.last_manager`), or its status's own (`forbidden`, `not_found`) when nothing finer is
needed. The interface words a refusal by its code alone, in the person's language; the server's
message is English, for logs and developers, and is never shown
([DEC-0020](../../decisions/DEC-0020-refusals-are-worded-by-code.md)).

#### ACT-refusal-code

A refusal code is `<subject>.<condition>` in lowercase snake case: the entity the act is on and
the state that stops it, not the act (`list.done`, `list.already_started`,
`iteration.scanned`). A code and an event code never share a spelling
([EVENT-code](../model/events.md#event-code)). The problem's `type` is
`https://vera.mzk.cz/problems/<code>`. A published code is never renamed or given another
meaning, since the messages and every server key on it.

A 422 names each wrong field by a JSON Pointer into the body (`/endsOn`), each with a code of its
own in the same case: the schema's (`too_small`, `too_big`, `invalid_type`, `required`) or VERA's
(`ends_before_start`).

#### ACT-out-of-reach

A record outside the person's reach is *not found* (404), not *forbidden*, so a refusal does not
reveal what exists. The exception is a proposal outside the person's request custody: it is
refused (403), since it exists and somebody else decides it.

#### ACT-consequence-first

An act that ends, removes or switches off something others rely on first shows what it will
change, counted by the server: deleting a list, an intention, a role, a custody, a category or a
plugin instance; disabling an instance; marking a list Done; deciding a project.

#### ACT-reason-two-texts

An act that stops someone's request gives two texts:
- a **public** one, which every asker reads;
- an optional **internal** one, which only staff read.

The acts that do this are declining a proposal, cancelling an iteration, denying a validation,
rejecting a project, and marking an item not digitizable (that one has the public text only).

#### ACT-current-attempt

Acts on an iteration act on the document's current attempt only. An earlier attempt is history,
and an act on it is refused (409).

## Proposing

| ID | Act | Needs | Allowed when | Writes |
|---|---|---|---|---|
| `ACT-propose` | *Propose…*, or *Add…* for a holder of `request.decide` | `request.create` | at most the role's items per submission (422) and within its daily limit (429) ([ROLE-limits](roles.md#role-limits)); a project only if the person is on it and it is not Rejected (422) | one request per item, and one batch per submission, a single item included ([ENT-batch](../model/entities.md#ent-batch)); `request.created` per request, one cause for the submission; each new proposal's checks queued ([LC-REQ-checks-job](../lifecycles/request.md#lc-req-checks-job)) |
| `ACT-propose-approved` | *Add…* with *approve now* | `request.create` and `request.decide` | as above | each new item held while it is checked (`request.held`, why `checking`), then approved once its checks find no existing copy (`request.approved`); one with a copy stays Pending for review ([LC-REQ-approve-now](../lifecycles/request.md#lc-req-approve-now)) |
| `ACT-withdraw` | *Withdraw…*, on Documents and My Documents | `request.withdraw_own` | the person's own ask on the document is still Pending (409); there is at most one ([LC-REQ-check](../lifecycles/request.md#lc-req-check)) | that ask Withdrawn; others' asks stand; `request.withdrawn` |

#### ACT-ways-in

*Propose…* and *Add…* hold one list of items, filled by any of these ways and mixed freely. Each
item is checked as it lands, so the list says what submitting will do, with a preview of its
copy and restriction checks ([LC-REQ-preview](../lifecycles/request.md#lc-req-preview)).

| Way in | What it does | Needs |
|---|---|---|
| Type it | one identifier of a chosen type, a volume or issue, a reason | — |
| Catalog search | searches the catalogs that can be searched, and adds a result | a Catalog adapter that searches |
| Record link | the link to, or the ID of, a record in any catalog, searchable or not, found there | a Catalog adapter; a link, not only an ID, where it reads links |
| Paste list | one item per line: identifier, volume or issue, reason; each line read as the chosen type, or detected | detecting: an enabled Identifier instance ([PLG-api-kinds](../integrations/plugin-api.md#plg-api-kinds)) |
| File upload | a CSV or TXT file with the same columns | — |
| Barcode scan | continuous: each scan is added as it arrives, with nothing to click. A hardware scanner types like a keyboard; the camera reads codes too | the camera: an Input plugin that reads barcodes |
| Photo capture | a photo of a cover, title page or catalog card is read, identifiers or its text, and matched to catalog records; the candidates come back with why each matched, and nothing is added until the person picks one | an Input plugin that reads photos |

A way whose plugin is not enabled is absent, not disabled
([PERM-absent-not-disabled](permissions.md#perm-absent-not-disabled)).

The camera reads barcodes while the barcode-reading Input plugin is enabled. Where the browser can
read codes from the camera, scanning stays continuous. Where it cannot, or the camera does not
open in the page, the same way takes one photo per book and the plugin reads its code. Either way
each code lands in the scan as it is read, and a photo with no code read says so.

The catalog ways are one: the search over the catalogs that can be searched, then a field for a
record's link or ID in any catalog, with where to find a record in each. A link already copied
from a searchable catalog needs no search.

#### ACT-entry-link

An outside portal links to `/ask` to open *Propose…* with one item filled in
([DEC-0015](../../decisions/DEC-0015-public-requests-by-entry-link.md)):

| Parameter | Meaning |
|---|---|
| `record` | the catalog record's ID or link, read as *Record link* reads it; or |
| `identifier` and `type` | one identifier of a type, read as *Type it* reads it |
| `unit` | the volume or issue, optional |
| `reason` | the public reason, optional, at most the reason field's length |
| `source` | the key of an enabled `EntryLink` Input instance, optional |
| `return` | where *Back to …* goes after submitting, optional |

- The item lands and is checked like any other ([LC-REQ-check](../lifecycles/request.md#lc-req-check)),
  so a *mine*, *in VERA* or *which unit?* answer shows before anything is sent. The person
  confirms with *Propose*; the link alone submits nothing.
- A person signed out logs in first and comes back to the same link
  ([ACCESS-login-return](people.md#access-login-return)). One without `request.create` sees
  *You have no access yet*.
- The submission's batch keeps the source when `source` names an enabled instance; an unknown or
  disabled one is ignored, and the item still lands.
- *Back to …*, named after the source, shows only when `return` is on an origin that source's
  instance allows. Otherwise there is no way back, and never a redirect to an address the link
  carried.
- When `source` names an instance, that instance reads the link first, so a portal may use its
  own parameters ([PLG-api-entry](../integrations/plugin-api.md#plg-api-entry)).
- Anything the parameters cannot read lands as an item that says why, as a typed one would.

## Request review

| ID | Act | Needs | Allowed when | Writes |
|---|---|---|---|---|
| `ACT-approve` | *Approve…* | `request.decide`, the proposal in the person's custody | Pending; its checks have answered (409); a leaf category (422); a rescan note when a copy exists (422) | every open ask of the document approved; one iteration, which the oldest ask originates; `request.approved` per ask, one cause |
| `ACT-decline` | *Decline…* | `request.decide`, as above | Pending | every open ask declined, with the two texts; `request.declined` per ask, one cause |
| `ACT-approve-batch` | *Approve N…*, on the batch's header | `request.decide` | the open, checked proposals of a batch that need no rescan; some may be unticked | as *Approve…* for each; rescans and unchecked ones are left out and counted |
| `ACT-retry-batch` | *Retry failed* | `request.retry` | some of the batch failed to be added (409), and some of that within the grant's scope (403) | each failed item within the scope back to ingest with its attempt counted; log *Ingest retried* |

## Iterations

On Documents and Documents Validations. Each act needs its permission at the iteration's
category ([SCOPE-custody-category](scopes.md#scope-custody-category)).

| ID | Act | Needs | Allowed when | Writes |
|---|---|---|---|---|
| `ACT-reclassify` | *Reclassify — category, priority…* | `iteration.classify` | not scanned yet (409); a leaf category (422); something changed (422) | log *Reclassified*; outside the person's custody it is handed over; hook `iteration.reclassified` |
| `ACT-recheck` | *Recheck* | `iteration.recheck` | any time, after the scan too | the record is read from the catalog again, its title, material type and shelf mark recorded with the recheck's time ([DOC-property-predefined](../model/documents.md#doc-property-predefined)), and the checks rerun; defects no longer found are gone; log *Rechecked*; hook `document.property_changed` per catalog value that changed |
| `ACT-relink` | *Relink…*, on the document's drawer | `iteration.recheck`, at the current iteration's category, or any for a document with no iteration | a catalog id the catalog adapter reads (422); not the document's own (422); not another document's in VERA (409) | the document linked to that record ([DOC-relink](../model/documents.md#doc-relink)), then a recheck; `document.relinked`, and `document.property_changed` per catalog value that changed |
| `ACT-page-count` | *Enter page count…* | `iteration.recheck` | not scanned (409) | a manual page count above every other source, then a recheck; log *Page count entered* |
| `ACT-cancel` | *Cancel…* | `iteration.cancel` | not cancelled and not scanned (409) | held where it is with the two texts; taken off its list; log *Cancelled*; hook `iteration.cancelled` |
| `ACT-resume` | *Resume…* | `iteration.resume` | cancelled or not digitizable, and not scanned (409) | the hold lifted; off its list if it was on one; back to the pool, where the gates say whether it is Ready; log *Resumed* |
| `ACT-publish` | *Add link…* | `iteration.publish` | digitized (409); a web address, or a PID or viewer's address a Link instance reads, which it makes canonical (422); not already held (422) | the link added ([LC-ITER-links](../lifecycles/iteration.md#lc-iter-links)), primary if it is the first; the first makes progress Published; log *Published* or *Link added*; hook `iteration.published` for the first, `iteration.link_added` after |
| `ACT-link-replace` | *Replace link…* | `iteration.publish` | the link is held (404); the new one read as for *Add link…* (422) and not already held (422) | the address replaced in place, primary kept; log *Link changed* from what to what; hook `iteration.link_changed` |
| `ACT-link-primary` | *Make primary* | `iteration.publish` | the link is held and not primary (409) | it becomes primary; log *Primary link changed*; hook `iteration.link_made_primary` |
| `ACT-link-remove` | *Remove link…* | `iteration.publish` | the link is held (404); not the last (409) | removed, and if it was primary the oldest remaining one becomes primary; log *Link removed*; hook `iteration.link_removed` |
| `ACT-overrule` | *Overrule restriction…* | `restriction.overrule` | a restriction stands and is not overruled (409) | the overrule with a staff note, beside the rule's finding; gates move progress; log *Restriction overruled* |

*Cancel…* at `custody` covers an item already on a list: the curator is responsible for it, the
list's history records why it left, and `iteration.cancelled` lets a hook tell the planner.

## Validation verdicts

On Documents Validations. Each verdict names exactly the defects it rules on, which must be the
ones outstanding now (409 if they changed meanwhile). A forbidden item takes no verdict (409).

| ID | Act | Needs | Allowed when | Writes |
|---|---|---|---|---|
| `ACT-accept` | *Accept…* | `validation.approve` | Review needed | a verdict row; gates move progress; log *Validation approved*; hook `iteration.verdict_accepted` |
| `ACT-deny` | *Deny…* | `validation.deny` | Review needed | a verdict row with the two texts; log *Validation denied*; hook `iteration.verdict_denied` |
| `ACT-revoke` | *Revoke…* | `validation.revoke` | the defects are accepted now | a verdict row; back in review; log *Validation revoked*; hook `iteration.verdict_revoked` |

## Digitization lists

| ID | Act | Needs | Allowed when | Writes |
|---|---|---|---|---|
| `ACT-list-create` | *New list* / *Generate* | `list.create` | ends on or after it starts (422); every member is in the pool (409 `list.member_unavailable`) | log *Created*, *Generated — …*, *Listed* per member; hooks `list.created`, `iteration.listed` per member, and `list.started` when it starts today ([HOOK-list-transitions](../integrations/hooks.md#hook-list-transitions)) |
| `ACT-list-save` | *Edit* | `list.edit` | not Done (409 `list.done`); members on this list or in the pool | log *Dates moved*, *Renamed*, *Members moved*; *Taken off a list* per member removed; hooks `list.dates_moved` when the dates move, `iteration.listed` per member added |
| `ACT-list-start` | *Start now…* | `list.edit` | Planned: its start date is still ahead (409 `list.already_started`) | its start date becomes today, so it is In progress and its members move from Planned to In progress; log *Started early* with the old date; hooks `list.started_early`, `list.started` |
| `ACT-list-done` | *Mark Done…* | `list.edit` | In progress (409 `list.not_started`), not Done | every open member Digitized; dates fixed; log *Marked Done*; hooks `iteration.digitized` per member, `list.marked_done` |
| `ACT-list-not-digitizable` | *Could not be digitized…* | `list.edit` | In progress; the member neither scanned nor stopped (409 `iteration.stopped`) | cancelled as Not digitizable with a public message; log *Could not be digitized*; hook `iteration.not_digitizable` |
| `ACT-list-delete` | *Delete…* | `list.delete` | not Done (409 `list.done`) | members back to the pool or Enqueued; each keeps the list's name; log *List deleted*, *Deleted*; hook `list.deleted` |

## Projects

| ID | Act | Needs | Allowed when | Writes |
|---|---|---|---|---|
| `ACT-project-create` | *New project* | `project.create` | — | Proposed; the creator its manager and only member; its own intention; log *Created* |
| `ACT-project-save` | *Edit* | `project.edit` at the project | any state; on an Approved one, dates and target stay editable | the intention follows the dates and target; log *Dates or target changed*, *Details changed* |
| `ACT-project-members` | *Members…* | `project.manage_members` at the project | members are people, never agents (422) | log *Member added*, *Member removed*, *Manager changed* |
| `ACT-project-approve` | *Approve…* | `project.decide` | Proposed (409 `project.decided`) | priority set once; every pending proposal in it, except those with a copy, stays on Requests marked as after the project's approval, for a curator to place in a category ([LC-PROJ-decide](../lifecycles/project.md#lc-proj-decide)); log *Approved* |
| `ACT-project-reject` | *Reject…* | `project.decide` | Proposed (409) | its pending proposals declined with the reason; its intention archived; log *Rejected*; hook `request.declined` per proposal |
| `ACT-project-delete` | *Delete…* | `project.delete` at the project | nothing ever proposed into it (409 `project.has_proposals`) | the project and its intention removed; log *Deleted* |

## Intentions and repeats

| ID | Act | Needs | Allowed when | Writes |
|---|---|---|---|---|
| `ACT-intention-create` | *New intention* | `intention.edit` reaching its funding | a unique name (422 `intention.name`) | *(no log)* |
| `ACT-intention-save` | *Edit* | `intention.edit` at the intention | not archived (409); the counting start unchanged (422 `intention.counts_from`); not the project's own fields (409 `intention.project`); Overall keeps its shape (422) | *(no log)* |
| `ACT-intention-archive` | *Archive* | `intention.edit` at the intention | not Overall, not a project's own | preserved as it is, still counting *(no log)* |
| `ACT-intention-delete` | *Delete…* | `intention.edit` at the intention | not archived, not Overall, not a project's own | generated lists keep it as provenance *(no log)* |
| `ACT-repeat-save` | *Repeat…* | `intention.repeat` | a mix that is none, Primary, or an active shared mix and revision | from the next occurrence on *(no log)* |

## Categories

Each act needs its permission at the category it changes, or at the new parent when it moves.
At `custody` that is the person's own subtree; the top level needs `any`.

| ID | Act | Needs | Allowed when | Writes |
|---|---|---|---|---|
| `ACT-category-create` | *New category* | `category.edit` at the parent | the parent is not a leaf holding documents (409 `category.holds_documents`); a unique name beside it (409 `category.name_taken`) | no share in any mix *(no log)* |
| `ACT-category-save` | *Edit…*: rename or move | `category.edit` | not under itself (422); as create at the new parent | moved: its subtree goes along, it has no share in its new set, and its old share is unallocated *(no log)* |
| `ACT-category-refine` | *Refine…* | `category.edit` | a leaf (409 `category.has_children`) | a child that takes every document and the leaf's whole share; log *Reclassified* per document; hook `iteration.reclassified` per document |
| `ACT-category-delete` | *Delete…* | `category.edit` | no children (409); no documents (409); no intention or repeat scoped to it (409 `category.scope`) | its shares unallocated; custody on it removed *(no log)* |
| `ACT-category-custody` | *Grant custody…* | `category.grant_custody` | people and existing groups | the set of holders, written whole *(no log)* |

### Mixes

Mixes are managed on the Category mixes page ([VIEW-mixes-entry](views.md#view-mixes-entry)).
The Categories tree picker selects a mix to display.

| ID | Act | Needs | Allowed when | Writes |
|---|---|---|---|---|
| `ACT-mix-create` | *New mix* | `mix.edit` | a unique name (409) | *(no log)* |
| `ACT-mix-save` | *Edit proportions* | `mix.edit` | not archived (409); unchanged meanwhile (409 `mix.revision`) | a new revision *(no log)* |
| `ACT-mix-snapshot` | *Name snapshot* | `mix.edit` | the revision has no label yet (409) | *(no log)* |
| `ACT-mix-primary` | *Make Primary* | `mix.manage` | not archived (409) | *(no log)* |
| `ACT-mix-archive` | *Archive* | `mix.manage` | not the Primary mix (409) | *(no log)* |
| `ACT-mix-delete` | *Delete…* | `mix.manage` | not Primary and never used by an intention, repeat or generated list (409) | removes the mix and its revisions *(no log)* |

## Watchlists

| ID | Act | Needs | Allowed when | Writes |
|---|---|---|---|---|
| `ACT-watchlist-save` | *Save watchlist*, *Save new watchlist* or *Save a personal copy* | the person can open the view; `watch` for a personal one, `watchlist.manage_system` for any other audience | a filter valid for the view (422); no duplicate except an explicit personal copy of a visible system watchlist or a system copy of one's own personal watchlist (409); a second personal copy is refused | — |
| `ACT-watchlist-change` | rename, refilter, delete | their own personal one; `watchlist.manage_system` for a system one | — | — |

## Tasks and schedules

| ID | Act | Needs | Allowed when | Writes |
|---|---|---|---|---|
| `ACT-run-cancel` | *Cancel* | the person's own run with `task.read_own`, or `task.cancel` | Running (409 `task.not_running`) | Cancelled; what it did stays |
| `ACT-run-again` | *Run again* | the person's own run, or `plugin.run` | a failed or cancelled plugin run (409 `task.not_rerunnable`) | a new run, linked to the old; hook `run.finished` or `run.failed` when it ends |
| `ACT-retention` | *Keep runs…* | `task.schedule` | failed runs kept at least as long as the others (422) | — |
| `ACT-schedule-save` | *New schedule*, *Edit* | `task.schedule` | a plugin that can be scheduled (422); every 5 minutes at the most often (422) | — |
| `ACT-schedule-pause` | *Pause…*, *Resume* | `task.schedule` | not paused, or paused (409) | — |
| `ACT-schedule-run` | *Run now* | `plugin.run` | — | a run; hook `run.finished` or `run.failed` when it ends |

Whoever started a run may cancel it and run it again: they could start it, so stopping and
retrying it is the same right.

## Plugins

| ID | Act | Needs | Allowed when | Writes |
|---|---|---|---|---|
| `ACT-instance-create` | *New instance…* | `plugin.configure` | a unique name; every required configuration key, and no unknown one (422) | — |
| `ACT-instance-save` | *Edit configuration…* | `plugin.configure` | as create; an identity's user id claim unchanged once people logged in (409) | — |
| `ACT-instance-disable` | *Disable…*, *Enable* | `plugin.configure` | not the last enabled Identity (409 `plugin.last_identity`) | — |
| `ACT-instance-delete` | *Delete…* | `plugin.configure` | as disable | kept for its runs' sake; its schedules removed |
| `ACT-instance-run` | *Run now* | `plugin.run` | enabled, and runnable on demand (409) | a run; hook `run.finished` or `run.failed` when it ends |
| `ACT-plugin-reset` | *Reset…* on the instance’s drawer | `plugin.configure` (decided 2026-11-13) | its version declares `harvest`, `changes` or `sync` (409 `plugin.no_cursor`) | its cursors cleared; its mirror rebuilt on the next run ([PLG-api-mirror](../integrations/plugin-api.md#plg-api-mirror)); configuration `plugin_instance.reset` |
| `ACT-instance-upgrade` | *Move to v…* | `plugin.configure` | a newer installed version whose contract VERA runs (409) | the instance's version |
| `ACT-plugin-upload` | *Upload plugin code…* | `plugin.upload_code` | a package with a descriptor, for this implementation, of a version not yet installed (422, 409) | a new implementation or version; no instance moves |

## Properties

On the *Properties* page ([DOC-property](../model/documents.md#doc-property)).

| ID | Act | Needs | Allowed when | Writes |
|---|---|---|---|---|
| `ACT-property-create` | *New property…* | `property.define` | a key never used before, a deleted one included (409 `property.key_taken`); no hand entry for a fact the catalog holds, the page count apart (422) | the definition and its `property.<key>.edit` |
| `ACT-property-save` | *Edit…* | `property.define` | as create; the key unchanged | — |
| `ACT-property-enter` | *Enter…* on the record pane, *Enter a property…* on documents picked in Documents | `property.<key>.edit` | defined for hand entry, and no fact the catalog holds (422); an attempt property while its attempt is not scanned (409 `iteration.scanned`) | the hand value at its definition's tier; the checks rerun when a rule reads it; log *Property changed*; hook `document.property_changed` or `iteration.property_changed` |
| `ACT-property-delete` | *Delete…* | `property.define` | not predefined (409 `property.predefined`) | its values, grants, filters and conditions removed ([DOC-property-delete](../model/documents.md#doc-property-delete)) |

## Hooks

| ID | Act | Needs | Allowed when | Writes |
|---|---|---|---|---|
| `ACT-hook-save` | *New hook*, *Edit* | `hook.configure` | an enabled delivery channel (422); a valid recipient for the channel (422) | — |
| `ACT-hook-pause` | *Pause…*, *Resume* | `hook.configure` | active, or paused (409) | — |
| `ACT-hook-delete` | *Delete…* | `hook.configure` | — | — |
| `ACT-hook-send-now` | *Send now* | `hook.configure` | not paused, channel enabled (409) | the waiting deliveries sent |
| `ACT-delivery-retry` | *Retry*, *Retry all* | `hook.configure` | the delivery gave up (409); channel enabled (409) | a new attempt |
| `ACT-delivery-discard` | *Discard* | `hook.configure` | the delivery gave up (409) | — |

## Users & Groups

Every act needs `access.manage` and is refused when it would leave nobody able to manage access
([ACCESS-last-manager](people.md#access-last-manager)). None is logged yet.

| ID | Act | Allowed when |
|---|---|---|
| `ACT-role-save` | *New role*, *Edit role* | each permission once, at a scope it accepts (422); a unique name (409) |
| `ACT-role-delete` | *Delete role…* | — |
| `ACT-user-roles` | *Roles…* (hand-set) | existing roles |
| `ACT-user-groups` | *Groups…* | existing groups |
| `ACT-identity-link` | *Link identity…* | a person, not an agent (422); the identity not someone else's (409) |
| `ACT-identity-unlink` | *Unlink* on an identity | not their last identity (409) |
| `ACT-user-suspend` | *Suspend…* | a person, not an agent (422); not suspended already (409) |
| `ACT-user-restore` | *Restore* | suspended (409) |
| `ACT-local-account` | *New local account…* | local accounts enabled (422); a free username (409) |
| `ACT-identity-default-role` | *Default role…* on a way in | an enabled Identity instance (404); an existing role, or none (422) |
| `ACT-group-save` | *New group*, *Edit group*, *Members…* | a unique name (409) |
| `ACT-custody-save` | *New request custody set*, *Edit*, *Members…* | a unique name (409); the fallback keeps its name (422); members are people or groups |
| `ACT-custody-delete` | *Delete custody…* | not the fallback (422) |

## Messages

#### ACT-message

Each message act hands a conversation about a record to a Message plugin, named for who it
reaches ([MSG-recipients](../integrations/messaging.md#msg-recipients)): *Message askers…*, *Ask
to overrule…*, *Message manager…* and *Message list author…*. It needs only that the person can
see the record, and VERA keeps nothing of it
([MSG-keeps-nothing](../integrations/messaging.md#msg-keeps-nothing)).
