# Plugin API

> Decided in [DEC-0019](../../decisions/DEC-0019-plugin-api-and-capabilities.md) (2026-10-30
> and 2026-10-31). Built in the mock, the backend and the client ([L73](../../ledger.md#built-2026-11-18)).

What VERA asks of each plugin kind ([PLG-kinds](plugins.md#plg-kinds)), and how a plugin says
which of it it can do. This is the plugin contract 1.x
([PLG-contract](plugins.md#plg-contract)): the mock's fakes implement it in TypeScript, and the
backend's `plugin-api` module in Java ([B6](../../develop/backend.md#b6-plugins-a-plugin-api-and-one-class-loader-per-version)).
Both are written from this page and from the types in `domain/src/plugin-api/`.

#### PLG-api-call

Every call gets the instance's **context**: its configuration, its secrets, an HTTP client, a
logger and the clock ([B6](../../develop/backend.md#b6-plugins-a-plugin-api-and-one-class-loader-per-version)).
`LocalAccounts` can check a password through `localPasswords()`, scoped to its own instance; the
check is read-only and does not expose the stored hash.
A plugin reaches the outside world only through that client, so its calls are timed out, traced
and recorded the same way. A call never writes to VERA's database and never calls another plugin:
VERA gives it what it needs and writes what it answers. The one thing it reads on its own is its
instance's mirror ([PLG-api-mirror](#plg-api-mirror)), through the context, read-only.

#### PLG-api-outcome

A call ends in one of three outcomes:
- **answered**, with the kind's answer;
- **unavailable**: the outside system did not answer, or the timeout passed. VERA tries again
  later, by the kind's rule; nothing is written;
- **refused**: the outside system answered, and the answer is that this cannot be done (no such
  record, a malformed link). It is not tried again. A refusal carries a code from the kind's
  closed list and the outside system's text, which staff may read and a requester never does.

A plugin that throws, or answers what its types do not allow, is *unavailable* and logged as a
plugin fault.

#### PLG-api-capabilities

A kind has **required operations**, which every implementation has, and **optional ones**,
which a version declares among its declarations ([PLG-declares](plugins.md#plg-declares)) as
`operations`. VERA reads them from the version's declarations file, without running its code,
so Plugins, upload and the dialogs know what a version can do before it is loaded.

When a version is loaded, the declared operations must be exactly the optional interfaces its
class implements; a version where they differ is refused at upload and never runs.

An **instance may narrow** what its version declares, never widen it: an administrator can
switch search off for one catalog, not on for a catalog that cannot search. What VERA offers is
what the version declares and the instance keeps, among enabled instances
([PERM-absent-not-disabled](../access/permissions.md#perm-absent-not-disabled)).

*Why:* the propose dialog's ways in already depend on what a plugin can do ("a Catalog adapter
that searches", "an Input plugin that reads barcodes",
[ACT-ways-in](../access/acts.md#act-ways-in)). Without a declaration, VERA would have to call a
plugin to find out, or trust an instance setting the code may not honour.

#### PLG-api-kinds

Each kind's operations. *Optional* operations are declared in `operations`; the others are
required. Inputs and answers are named here; their fields are in `domain/src/plugin-api/`.

| Kind | Operation | Takes | Answers | Refusals |
|---|---|---|---|---|
| Identity | `begin` | the fixed absolute callback URL and this login's state | a redirect and up to 4 KiB of per-login flow data, or nothing for a form entry | — |
| | `complete` | every callback query parameter, the flow data, fixed callback URL and user id claim; or the form's username, password and user id claim | the external id, email and whether the provider verified it, name, and claims as strings | `wrong_credentials`, `suspended`, `not_allowed` |
| Input | `readBarcode` *(optional)* | a photo | the code read, or none | `unreadable` |
| | `readPhoto` *(optional)* | a photo | what was seen, the values read with confidence, candidate records with why | `unreadable` |
| | `entry` *(optional; EntryLink)* | an incoming `/ask` request: its parameters and the portal's page, which may be null | `{ item: catalogId | identifier | null, unit, reason, origin }`, each nullable; null `item` means VERA reads its own parameters | `origin_not_allowed`, `unreadable` |
| Identifier | `recognise` | a value | whether it is this type, and its normal form | `checksum` |
| Harvester | `harvest` | its cursor ([PLG-api-cursor](#plg-api-cursor)) | new catalog IDs or typed identifiers to propose, and the next cursor | — |
| Catalog adapter | `read` | a catalog id | the record: fields, units, issuance type, the reading's date | `not_found` |
| | `readLink` *(optional)* | a record link or id as pasted | the catalog id | `not_this_catalog`, `malformed` |
| | `search` *(optional)* | a text query | hits: catalog id, title, units | — |
| | `changes` *(optional)* | its cursor | catalog ids changed since, ids replaced by another (old, new), and the next cursor | — |
| | `sync` *(optional)* | its cursor | a page of records to keep, ids to drop and ids replaced by another (old, new), the next cursor, and whether more follow | — |
| Property source | `values` | the record and its iteration | values for the properties it declares, each with its tier | — |
| Registry | `lookup` | the record's identifiers | the raw state and its link, per record found | — |
| Validation | `check` | the record and its properties | defects: rule, field, detail | — |
| Restriction | `check` | the record and its properties | a finding per rule: forbidden or not, until when, why | — |
| Custody | `place` | the request and its document, and the request custody picked for this instance (nullable); the request includes `projectName` | the request custodies that take it | — |
| Classifier | `suggest` | the request (including `projectName`) and its document | a category and why, or none | — |
| List generator | `generate` | the shaping intention, its leaves and shares in scope, the pool, the current members, the pages, the top categories, a correcting allocation | the picks and why each, how many were spread, and each short leaf with its cause | — |
| Link | `canonical` | a pasted PID or viewer address | the canonical link and where it is | `not_this_registry`, `malformed` |
| Publication detector | `detect` | digitized and published iterations | links found | — |
| Message | `handOff` | recipients, subject, text, and the sender (optional) | an address to open (mailto, a chat link), or *sent* | — |
| Delivery channel | `send` | the recipient, the payload or text | sent | `recipient_rejected` |
| | `test` | the recipient | sent, with the time it took | `recipient_rejected` |

An Input instance's ways in are the operations its version declares; it has no `inputMode`. One
Input may read barcodes and photos both, and the propose dialog lays out what the enabled
instances offer.

**Detecting a pasted line's type is not an Input operation.** VERA asks every enabled Identifier
instance's `recognise`: a line one instance recognises gets its type, a line several recognise
asks the person which, and a line none recognises lands as unread. *Paste list* detects types
whenever an Identifier instance is enabled.

**A catalog adapter without `readLink`** takes only its catalog's own ids in *Record link*: VERA
passes what was pasted to `read` as it is, and a link lands as unread. With `readLink`, a pasted
link or id is taken apart first.

#### PLG-api-entry

An outside portal's link reaches VERA at `/ask` ([ACT-entry-link](../access/acts.md#act-entry-link)).
When the link names a `source`, that `EntryLink` instance reads it first: `entry` takes the link's
parameters and the portal's page it came from, and answers the item to land (a catalog id or an
identifier with its type), unit, reason and return origin. Each field may be null; null `item`
means VERA reads its own parameters. So each portal links the way
it can: with VERA's own parameters, or with its own (a record id under another name, its page
address), which its instance takes apart. VERA then checks the item as any other and never
redirects to an origin outside the instance's configured list. Without a `source`, or when the
instance answers nothing, VERA reads its own parameters itself. Which portal hosts a link does not
change the mechanism: each is one more instance.

#### PLG-api-cursor

A call that goes on where the last one stopped (`harvest`, `changes`, `sync`) takes a **cursor**
and answers the next one. VERA keeps the cursor per instance and operation, and stores the next
one in the same transaction as what the call answered, so a run that fails leaves the cursor
where it was and the next run reads the same again. The cursor is the plugin's own text; VERA
never reads it. *Reset* on the instance's drawer clears it, so the next run starts from the
beginning.

#### PLG-api-record-change

A catalog's changes reach VERA on the instance's **schedules**, which an administrator sets
([ENT-schedule](../model/entities.md#ent-schedule)): each scheduled run calls `sync` when the
version declares it, else `changes`. Every changed id that names a document VERA holds runs
that document's *on record change* triggers (the checks, the property sources), as *Recheck*
does. A replaced id relinks its document ([DOC-relink](../model/documents.md#doc-relink)); a
dropped one marks it *No longer in the catalog*. A catalog adapter that declares neither has no
record-change runs; its records are read again only on *Recheck* and at ingest.

#### PLG-api-mirror

A catalog adapter that declares `sync` keeps a **mirror**: VERA stores the records it hands over,
per instance, and keeps them as `sync` says (a page of records to keep, ids to drop). The first
scheduled run fetches the whole catalog page by page; later runs fetch what changed. VERA stores
each page in its own transaction with the cursor ([PLG-api-cursor](#plg-api-cursor)), so a long
first fetch resumes where it stopped.

A mirrored record holds its catalog id, title, units, identifiers, the text to search and the
record itself as the plugin gave it, with the moment it was fetched.
- **Search:** VERA searches the mirror itself, by text and by identifier, so an instance with a
  mirror offers Catalog search ([ACT-ways-in](../access/acts.md#act-ways-in)) even when its
  version does not declare `search` and its catalog cannot be searched.
- **Read:** the plugin reads its own mirror through the context, so `read` may answer from it
  without calling the catalog; the reading's date is then the moment the record was fetched.
- **Freshness:** the instance's drawer says when the mirror was last synced and how many records
  it holds.

Deleting the instance drops its mirror; *Reset* clears the cursor and rebuilds the mirror on the
next run.

#### PLG-api-version

The contract's minor versions only add: a new optional operation, a new refusal code, a new
field in an answer or input. Contract 1.2 adds the optional sender to the Message `handOff` input;
1.3 adds redirect identity callback details and per-login flow data. A plugin built for 1.2 runs on 1.4; one built for 1.4 declares an operation
1.2 does not know and is refused on a VERA running 1.2
([PLG-contract](plugins.md#plg-contract)).

The entry answer shape changed while no plugin implements `entry`; no contract version moved.
