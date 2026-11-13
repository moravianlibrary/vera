# Events

The one catalogue of what can happen in VERA. Three destinations take events from it, each only
the codes marked for it: a record's *History* (the [log](log.md)), [hooks](../integrations/hooks.md)
and the [Audit stream](../integrations/observability.md#obs-audit). No destination takes all of
them. Decided in [DEC-0018](../../decisions/DEC-0018-one-event-catalogue.md).

#### EVENT-catalogue

Every event VERA writes or sends has a code from this catalogue, and a code means the same in
every destination. A destination never invents a name of its own: a hook subscribes to the
codes, the log stores them, the Audit stream carries them.

#### EVENT-code

A code is `<subject>.<what_happened>`: lowercase snake case, past tense (`request.approved`,
`list.dates_moved`). Codes are never renamed or reused; a code that is no longer written stays
in the catalogue, marked *retired*.

#### EVENT-shape

An event holds its code, its subject (kind and id), when it happened (UTC), its actor
([LOG-actor](log.md#log-actor)), its correlation ID
([LOG-one-act-one-story](log.md#log-one-act-one-story)), its **data** and its **reason**. Data
is typed per code: ids, values from and to, counts, never a sentence. The reason is the two
texts the act took, public and internal ([ACT-reason-two-texts](../access/acts.md#act-reason-two-texts)),
or none.

*Why:* stored sentences cannot be translated, and the wording of one would differ between the
History card, a hook's email and an audit dashboard.

#### EVENT-wording

The client words an event from its code and data, in the reader's language. A code either has
a **public wording**, which a requester reads ([LOG-public](log.md#log-public)), or is never
shown to a requester.

#### EVENT-destinations

- **History** takes the codes about the records it is read on
  ([LOG-where-read](log.md#log-where-read)): requests, iterations, documents, lists and
  projects.
- **Hook** takes the codes a hook may subscribe to ([HOOK-events](../integrations/hooks.md#hook-events)).
- **Audit** takes every cause: every code except a derived one.

#### EVENT-derived

A **derived** code is sent when a date or another fact makes it true, with nobody acting. It
goes to hooks only: the log and the Audit stream record causes, never derivations
([LOG-cause](log.md#log-cause)). `list.started` on a list's start date is the only one.

## The catalogue

Columns: the code; its data besides the subject (reasons are not listed: every act that takes
the two texts puts them in `reason`); its public wording (— for none); and ✓ for each
destination that takes it.

### Requests (subject: `request`, one ask)

| Code | Data | Public | History | Hook | Audit |
|---|---|---|---|---|---|
| `request.created` | batch, source | *Asked* | ✓ | ✓ | ✓ |
| `request.approved` | iteration; rescan; batch size when bulk; the classifier's suggestion (category, instance, kept) or none | *Accepted* | ✓ | ✓ | ✓ |
| `request.declined` | batch size when bulk | *Not accepted* | ✓ | ✓ | ✓ |
| `request.held` | why: `copy_exists` \| `checking` | — | ✓ | ✓ | ✓ |
| `request.withdrawn` | — | *Withdrawn* | ✓ | – | ✓ |
| `request.ingest_retried` | attempt | — | ✓ | – | ✓ |

### Iterations (subject: `iteration`)

| Code | Data | Public | History | Hook | Audit |
|---|---|---|---|---|---|
| `iteration.ingested` | — | — | ✓ | ✓ | ✓ |
| `iteration.ingest_failed` | attempt; error ([LOG-ingest-detail](log.md#log-ingest-detail)) | — | ✓ | ✓ | ✓ |
| `iteration.rechecked` | by: `act` \| `catalog_change`; defects found, gone | — | ✓ | – | ✓ |
| `iteration.page_count_entered` | pages; the count it replaced | — | ✓ | – | ✓ |
| `iteration.verdict_accepted` | defects | — | ✓ | ✓ | ✓ |
| `iteration.verdict_denied` | defects | — | ✓ | ✓ | ✓ |
| `iteration.verdict_revoked` | defects | — | ✓ | ✓ | ✓ |
| `iteration.restricted` | rule (plugin instance); outcome: `forbidden` \| `restricted` | *Not available for digitization*, when forbidden | ✓ | ✓ | ✓ |
| `iteration.restriction_overruled` | rule | — | ✓ | – | ✓ |
| `iteration.reclassified` | category from, to; priority from, to | — | ✓ | ✓ | ✓ |
| `iteration.cancelled` | the list it left, if any | *On hold* | ✓ | ✓ | ✓ |
| `iteration.not_digitizable` | list | *Could not be digitized* | ✓ | ✓ | ✓ |
| `iteration.resumed` | — | — | ✓ | – | ✓ |
| `iteration.listed` | list | — | ✓ | ✓ | ✓ |
| `iteration.unlisted` | list; why: `edited` \| `cancelled` \| `list_deleted` | — | ✓ | – | ✓ |
| `iteration.digitized` | list, if any | *Digitized* | ✓ | ✓ | ✓ |
| `iteration.published` | link | *Available to read* | ✓ | ✓ | ✓ |
| `iteration.link_added` | link | — | ✓ | ✓ | ✓ |
| `iteration.link_changed` | link; from, to | — | ✓ | ✓ | ✓ |
| `iteration.link_made_primary` | link | — | ✓ | ✓ | ✓ |
| `iteration.link_removed` | link; the new primary, if it changed | — | ✓ | ✓ | ✓ |
| `iteration.copy_found` | registry, state | — | ✓ | – | ✓ |
| `iteration.property_changed` | key; from, to | — | ✓ | ✓ | ✓ |

### Documents (subject: `document`)

| Code | Data | Public | History | Hook | Audit |
|---|---|---|---|---|---|
| `document.relinked` | catalog record from, to | — | ✓ | ✓ | ✓ |
| `document.property_changed` | key; from, to | — | ✓ | ✓ | ✓ |
| `document.registry_changed` | registry; state from, to | — | ✓ | ✓ | ✓ |

### Lists (subject: `list`)

| Code | Data | Public | History | Hook | Audit |
|---|---|---|---|---|---|
| `list.created` | generator and its version, when generated; members | — | ✓ | ✓ | ✓ |
| `list.renamed` | from, to | — | ✓ | – | ✓ |
| `list.dates_moved` | starts from, to; ends from, to | — | ✓ | ✓ | ✓ |
| `list.members_changed` | added, removed | — | ✓ | – | ✓ |
| `list.started_early` | the start date it had | — | ✓ | ✓ | ✓ |
| `list.started` | — (derived, [EVENT-derived](#event-derived)) | — | – | ✓ | – |
| `list.marked_done` | members digitized | — | ✓ | ✓ | ✓ |
| `list.deleted` | members back in the pool | — | ✓ | ✓ | ✓ |

### Projects (subject: `project`)

| Code | Data | Public | History | Hook | Audit |
|---|---|---|---|---|---|
| `project.created` | — | — | ✓ | – | ✓ |
| `project.details_changed` | fields from, to | — | ✓ | – | ✓ |
| `project.dates_changed` | dates and target from, to | — | ✓ | – | ✓ |
| `project.member_added` | user | — | ✓ | – | ✓ |
| `project.member_removed` | user | — | ✓ | – | ✓ |
| `project.manager_changed` | from, to | — | ✓ | – | ✓ |
| `project.approved` | priority; proposals passed to Requests to be placed | — | ✓ | – | ✓ |
| `project.rejected` | proposals declined | — | ✓ | – | ✓ |
| `project.deleted` | — | — | ✓ | – | ✓ |

### Runs (subject: `run`)

A run is its own record with its own states ([ENT-run](entities.md#ent-run)); these codes exist
for hooks.

| Code | Data | Public | History | Hook | Audit |
|---|---|---|---|---|---|
| `run.finished` | instance, trigger, counts | — | – | ✓ | – |
| `run.failed` | instance, trigger, public error | — | – | ✓ | – |

### Configuration

What an admin changes goes to the Audit stream only: no History card and no hook. Every code
here carries what changed, field by field, from and to; a plugin secret is recorded as changed,
never its value.

| Subject | Codes |
|---|---|
| `user` | `created` (how: first login, sign-up, a local account made by an admin), `roles_changed`, `groups_changed`, `identity_linked`, `identity_unlinked`, `suspended`, `restored` |
| `group` | `created`, `changed`, `members_changed`, `deleted` |
| `role` | `created`, `permissions_changed` (added, removed, scope changed), `renamed`, `deleted` |
| `custody` | `created`, `changed`, `members_changed`, `deleted` |
| `category` | `created`, `renamed`, `moved`, `refined` (the new child), `custody_changed`, `deleted` |
| `intention` | `created`, `changed`, `archived`, `deleted` |
| `repeat` | `changed` |
| `mix` | `created`, `revised` (revision), `labelled`, `made_primary`, `archived`, `deleted` |
| `plugin` | `uploaded` (implementation, version) |
| `plugin_instance` | `created`, `configured`, `reset`, `disabled`, `enabled`, `upgraded`, `default_role_changed`, `deleted` |
| `hook` | `created`, `changed`, `paused`, `resumed`, `deleted` |
| `schedule` | `created`, `changed`, `paused`, `resumed`, `deleted` |
| `property` | `defined`, `changed`, `deleted` |

A code is the subject and the name joined: `plugin_instance.disabled`. `category.refined` also
writes `iteration.reclassified` for each document it moves, with the same correlation ID.
