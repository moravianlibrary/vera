# Document Use Cases

Everything a person — or a harvesting plugin — does with a document, from the
first ask to the published scan. This is the checklist the document pages are
designed against: **every row here has a place** (§7), and a page that serves
none of them should not exist.

Grouped by actor. The actors are the five shipped roles of [[permissions]] §4,
which are bundles rather than a ladder — each group assumes the grants of the
groups it builds on (reader and staff have the same grants; dig-curator covers
curator; admin holds everything). The permission column is what the use case requires, so a
page offering it can check it.

A word on the nouns. A **request** is one ask; *proposal* and *addition* are
names for where a request currently is, not other things ([[concepts]]
§Request) — and an addition is simply a proposal approved at the moment it is
made ([[status-model]] §2.8). An **iteration** is one attempt to digitize a
**document**, so every list that appears to show documents shows iterations
([[concepts]] §Document).

---

## 1. Anyone — reader

| # | Use case | Permission | Notes |
|---|---|---|---|
| R1 | See my proposals and my documents **as one thing** | `request.read_own` | one row per document, whatever stage it reached — the user does not care whether it is a proposal, an addition or a document ([[view-map]] §2.1) |
| R2 | Propose a document | `request.create` | down to the volume or issue, not just the catalog record ([[document-identity]]); starts from the **catalog** — any catalog with an adapter; one that cannot be searched from VERA is opened in a new tab and its record link pasted back — the record found gives the identifier, and VERA then checks whether it already has it, so R5 is found before it is asked |
| R2b | Propose **many at once** | `request.create` | one list, filled any way — typed, catalog search, pasted, file, barcode (**continuous**: a scanner types and presses Enter, so a shelf is scanned with no clicks), photo (camera scanning, photo, and auto-detect in a pasted list only with their *Input* plugin); each item checked as it lands. **Every submission is one batch**, a batch of one included; the batch carries the reason. The role's per-submission limit applies ([[view-map]] §2.1) |
| R3 | Withdraw my proposal | `request.withdraw_own` | the wrong volume has to be takeable back — `Withdrawn`, **only while it is undecided** ([[status-model]] §2) |
| R4 | See **why** | `request.read_own` | the public reason text of *Declined*, *Cancelled*, *Could not be digitized* ([[view-rules]] §4.3) |
| R5 | Propose something already asked for, in progress or done | `request.create` | not a *duplicate* error: I am attached to the live work and see its status ([[status-model]] §2.7); if it is already digitized, my request carries the existing copy and a curator decides whether to scan again |
| R6 | Open the published result | `request.read_own` | the outbound link on `Published` |
| R7 | Save a filter as a Watchlist | `watch` | [[navigation]] §5 |
| R8 | Propose into my project | `request.create` + project membership | while the project is *Proposed* the ask is covered by the project's decision; after it is *Approved* the ask is flagged *after the project's approval* and decided on its own; a *Rejected* project takes none. The project shows on my request; opening Projects also requires `project.read` or `project.decide` |

## 2. Library staff — staff

| # | Use case | Permission | Notes |
|---|---|---|---|
| S1 | Propose and follow their own requests | reader grants | the staff role grants the same actions as reader, with a higher daily proposal limit |

## 3. Curator — within custody

Every grant here is `@custody` in the shipped role: for a proposal, custody
is **proposal custody** — a name with members that *Custody* plugins put
proposals into, with one *fallback* catching what no plugin placed; after approval it is the **category** custody
of the item ([[permissions]] §3).

| # | Use case | Permission | Notes |
|---|---|---|---|
| C1 | Review proposals — approve or deny | `request.decide` | the proposals my proposal custodies match; approving **sets category and priority**, the only place a human classifies an item; one decision covers **every asker** of that document; bulk approve yes — **skipping rescans** — bulk deny no, a denial carries a reason ([[view-map]] §2.2) |
| C2 | Add documents directly, skipping review | `request.create` · `request.decide` | the propose form with **approve now** — an intent applied after the checks, never to an item with an existing copy ([[status-model]] §2.8) |
| C3 | Resolve validation defects — fix, accept, or deny | `validation.approve` · `validation.deny` | *accept* takes the outstanding defects **one by one or all at once**. Defects include **missing data** and **no catalog record** |
| C4 | Revoke a validation approval | `validation.revoke` | |
| C5 | **Approve a rescan** | `request.decide` | approving a request that carries an **existing copy** — *Kramerius: Published*, or VERA's own earlier scan. One item at a time; no shortcut makes it ([[status-model]] §2) |
| C6 | Reclassify after approval | `iteration.classify` | category and priority, from Documents or Validations; a new category outside my custody hands the item over |
| C7 | ~~Forbid an item~~ → see what is forbidden | — | **only rules forbid** (decided 2026-09-26). Validations has a *Forbidden* filter; a curator can message an admin about an item, and only an admin overrules (A2) |
| C8 | Cancel, or resume | `iteration.cancel` · `iteration.resume` | until digitized; reason required; separately grantable ([[status-model]] §2.5) |
| C9 | See why an approved item never arrived | `addition.read` | the batch and the failure text, **every action absent** — so the question to an admin is a specific one ([[permissions]] §3) |
| C10 | Handle a defect found **after** digitization | `validation.*` | shown as *Published · review needed*, never a badge that hides the outcome ([[status-model]] §4 rule 6) |
| C11 | Publish — set or change the link where the scan is available | `iteration.publish` | that is what makes it `Published` |
| C12 | Approve or reject a project | `project.decide` | ([[projects]] §2) the project's priority is set once, here, and never changes; approving picks the project's priority and approves its proposals so far, **skipping** any with an existing copy; rejecting rejects its requests — a document others asked for too stays theirs |
| C13 | See which list my item is on | — | its name and dates, without `list.read` |

## 4. Digitization curator

| # | Use case | Permission | Notes |
|---|---|---|---|
| G1 | Build a digitization list — by selecting, or by **generating** | `list.create` | the pool is every item that passed every gate, and says what review is still holding back. *Generate* opens a dialog over a configured generator plugin, rule-based or AI-based — pages required, categories optional, and one intention to shape by — its scope and mix, Overall unless another is picked; absent when none is configured. What the list counts towards is derived afterwards, never attached ([[intentions]] §5). It pre-fills a draft, each pick with its reason, and reports what it could not fill, per category ([[intentions]] §4). An item that gained an existing copy after approval carries a warning ([[registry-status]] §10). Also started from Intentions: a **correcting** list from a tracking card out of band, a **catch-up** list from a target behind pace ([[intentions]] §4.4) |
| G2 | Take an item off a list | `list.edit` | in the list editor; it returns to the pool as `Ready` — not a cancellation, no reason needed ([[status-model]] §2.5). An item that gained a blocker stays on the list **flagged** until taken off. Stopping the work is C8, also offered on the list |
| G3 | Delete a list | `list.delete` | its items return to the pool — lists are deleted, not cancelled; **a Done list cannot be deleted** ([[status-model]] §2.6) |
| G4 | Mark a list **Done** | `list.edit` | every member not marked *could not be digitized* becomes `Digitized` ([[status-model]] §2) |
| G5 | Mark an item *could not be digitized* | `list.edit` | per item on its list, with the message the requester reads |
| G6 | Move a list's dates | `list.edit` | warns before Save when the list would stop counting towards an intention |

## 5. Admin

**The ingest actions stay admin-only.** A curator sees an addition (C9) and
cannot act on it. Ingest is machinery rather than judgement, and that is the
split [[permissions]] §3 makes — decided again here, on purpose.

| # | Use case | Permission | Notes |
|---|---|---|---|
| A1 | Retry ingest — per item, or per batch | `addition.retry` | a batch is the unit an admin retries |
| A2 | Overrule a **restriction** | `restriction.overrule@any` | *a rule said never and I am saying anyway* — `any`-only, so a curator cannot lift prohibitions inside their own subtree ([[status-model]] §2) |
| A3 | ~~Allow a new iteration — a rescan~~ | — | **merged into C5.** Allowing a rescan and accepting *already digitized* were one act under two permissions |
| A4 | ~~Delete an addition~~ | — | **removed** (decided 2026-09-26): a failed ingest is retried |
| A6 | Manage proposal custody — custodies and members, including the fallback's (Users & Groups); the rules that place proposals (Plugins) | `access.manage` · `plugin.configure` | |
| A5 | Read what the source actually returned | `addition.read_payload` | raw responses |

## 6. Everyone, and nobody in particular

| # | Use case | Notes |
|---|---|---|
| X1 | History — who did what to this item, and when | the [[status-log]]; provenance lives there, not in the record — including *approved after checks* and *held: a copy exists* |
| X2 | One document, **several iterations** | scanned in 2019, rescanned in 2029 — one document, two attempts ([[concepts]] §Document); the earlier ones live in the detail pane |
| X3 | Items a plugin found | the plugin's agent is the requester — *ISSN harvester* — and enters at proposals or, approved on arrival, at ingest, by the plugin's one entry-point setting ([[view-map]] §6); an arrival with an existing copy is held for review like C2 |

---

## 7. Where each one lands

The four views of [[view-map]] §2 — Digitization Lists absorbed
*Digitization Lists Generation*, so building a list and looking after it are
one page:

| View | Use cases |
|---|---|
| **Documents** — *My Documents* for a reader | R1–R8 · S1–S3 · C2 (the propose form) · C6 · C8 · C9 · C11 · C13 · A1 · A2 · A5 · X1–X3 |
| **Proposal Review** | C1 · C5 |
| **Validation** | C3 · C4 · C6 · C7 (the *Forbidden* filter) · C8 · C10 |
| **Digitization Lists** — browse, and the list editor | G1–G6 · C8 (cancel from a list) |
| **Projects** | R8 (the project's side) · C12 |
| **Users & Groups** | A6 |

C6 and C8 are on both Documents and Validation — they are acts on a record,
not a queue. A2 sits on the record wherever a restriction is shown.

**Decided on the way here:**

- **eligibility is retired** — prohibition, defect and existing copy are three
  different things ([[status-model]] §2)
- **a rescan is a curator's decision**, and the only one no shortcut makes
  ([[status-model]] §2.8)
- **failed additions are a status in Documents**, grouped by batch, not a page
- **My Requests and Documents are one page**, labelled by reach
  ([[navigation]] §1.1)

## Related

- [[view-map]] — the four views these use cases fall into
- [[permissions]] — the grants named above
- [[status-model]] — the axes every use case moves
- [[concepts]] — request, iteration, document
