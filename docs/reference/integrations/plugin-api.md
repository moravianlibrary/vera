# Plugin API

> **Proposal — [DEC-0019](../../decisions/DEC-0019-plugin-api-and-capabilities.md).** Drafted on
> 2026-10-30, not settled. The questions marked **Open** are for the product owner.

What VERA asks of each plugin kind ([PLG-kinds](plugins.md#plg-kinds)), and how a plugin says
which of it it can do. This is the plugin contract 1.x
([PLG-contract](plugins.md#plg-contract)): the engine's fakes implement it in TypeScript, and the
backend's `plugin-api` module in Java ([B6](../../develop/backend.md#b6-plugins-a-plugin-api-and-one-class-loader-per-version)).
Both are written from this page and from the types in `domain/src/plugin-api/`.

#### PLG-api-call

Every call gets the instance's **context**: its configuration, its secrets, an HTTP client, a
logger and the clock ([B6](../../develop/backend.md#b6-plugins-a-plugin-api-and-one-class-loader-per-version)).
A plugin reaches the outside world only through that client, so its calls are timed out, traced
and recorded the same way. A call never touches VERA's database and never calls another plugin:
VERA gives it what it needs and writes what it answers.

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
that searches", "an Input plugin that detects types",
[ACT-ways-in](../access/acts.md#act-ways-in)). Without a declaration, VERA would have to call a
plugin to find out, or trust an instance setting the code may not honour.

#### PLG-api-kinds

Each kind's operations. *Optional* operations are declared in `operations`; the others are
required. Inputs and answers are named here; their fields are in `domain/src/plugin-api/`.

| Kind | Operation | Takes | Answers | Refusals |
|---|---|---|---|---|
| Identity | `begin` | where to return | a redirect, or nothing for a form entry | — |
| | `complete` | the provider's callback, or the form's username and password | the external id, email, name and claims | `wrong_credentials`, `suspended`, `not_allowed` |
| Input | `detectTypes` *(optional)* | pasted lines | each line's identifier type, or none | — |
| | `readBarcode` *(optional)* | a photo | the code read, or none | `unreadable` |
| | `readPhoto` *(optional)* | a photo | what was seen, the values read with confidence, candidate records with why | `unreadable` |
| | `entry` *(optional; EntryLink)* | an incoming `/ask` request | the item, and the origin to return to | `origin_not_allowed` |
| Identifier | `recognise` | a value | whether it is this type, and its normal form | `checksum` |
| Harvester | `harvest` | what it read last time (its cursor) | new items to propose, and the next cursor | — |
| Catalog adapter | `read` | a catalog id | the record: fields, units, issuance type, the reading's date | `not_found` |
| | `readLink` | a record link or id as pasted | the catalog id | `not_this_catalog`, `malformed` |
| | `search` *(optional)* | a text query | hits: catalog id, title, units | — |
| | `changedSince` *(optional)* | a moment | catalog ids changed since then | — |
| Property source | `values` | the record and its iteration | values for the properties it declares, each with its tier | — |
| Registry | `lookup` | the record's identifiers | the raw state and its link, per record found | — |
| Validation | `check` | the record and its properties | defects: rule, field, detail | — |
| Restriction | `check` | the record and its properties | a finding per rule: forbidden or not, until when, why | — |
| Custody | `place` | the request and its document | the request custodies that take it | — |
| Classifier | `suggest` | the request and its document | a category and why, or none | — |
| List generator | `generate` | the intention, its mix, the pool, the page budget | the picked iterations and why each, and what was short | — |
| Link | `canonical` | a pasted PID or viewer address | the canonical link and where it is | `not_this_registry`, `malformed` |
| Publication detector | `detect` | published iterations without a link here | links found | — |
| Message | `handOff` | recipients, subject, text | an address to open (mailto, a chat link), or *sent* | — |
| Delivery channel | `send` | the recipient, the payload or text | sent | `recipient_rejected` |
| | `test` | the recipient | sent, with the time it took | `recipient_rejected` |

**Open:**
1. Is `changedSince` the way *on record change* is triggered, or does VERA keep polling `read`?
2. Does `harvest` hold its own cursor in VERA (given back on each call, as above), or in the
   outside system?
3. Is Input's `inputMode` replaced by these operations (one Input may then read barcodes and
   photos both), or kept beside them for the dialog's layout?

#### PLG-api-version

The contract's minor versions only add: a new optional operation, a new refusal code, a new
field in an answer. A plugin built for 1.2 runs on 1.4; one built for 1.4 declares an operation
1.2 does not know and is refused on a VERA running 1.2
([PLG-contract](plugins.md#plg-contract)).
