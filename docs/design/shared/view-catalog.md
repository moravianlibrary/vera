# View Catalog

One entry per sidebar destination: what it contains, what it does **not**, and
where anything excluded actually lives.

[[view-rules]] is the rules; [[view-map]] is which views exist and why;
[[navigation]] is the shell. This is the application of all three, and it is
what a demo is built from.

> **⚠ Behind [[view-map]] §2 for the document pages.** *My Requests* and
> *Documents* are one page now (*My Documents* for a reader), *Additions* is no
> longer a page — its failures are a status in Documents — and eligibility is
> retired ([[status-model]] §2). The sections below for those pages, and every
> *eligibility* column, predate that and are rewritten in the per-page layout
> pass. [[document-use-cases]] §7 is the current map.

How many **surfaces** each page is made of — index, detail, editors, wizards,
dialogs — and which have URLs, is [[page-composition]].

---

## 1. How to read an entry

| Field | Means |
|-------|-------|
| **Scope** | what the view can *never* show. Not filterable away ([[view-map]] §1) |
| **Opens on** | the default filter. Removable |
| **Row** | what exactly one row is — the question most often got wrong |
| **Columns** | per tier, against the [[view-rules]] §1.1 record budget |
| **Controls** | search, overview, facets, advanced, detail, actions |
| **Not here** | deliberately absent, and where it is instead |

**Every "not here" line has a reason in §2.** If something is excluded for no
reason beyond taste, it is not excluded — it is just missing.

---

## 2. Controls that exist in exactly one place

This table is why the catalog is short. Most of what a view "could" have is
owned by another view, and duplicating it is how two screens start disagreeing.

| Control | Lives in | Nowhere else, because |
|---------|----------|----------------------|
| **selection + bulk actions** | List Building | selection implies acting on a set; only list building acts on sets ([[view-rules]] §5.5) |
| **approve / decline a proposal** | Proposals | one decision point, or two curators decide the same thing differently |
| **approve / deny / revoke validation** | Documents Validations | same |
| **ingest, re-ingest, retry** | Additions | machinery belongs to the admin who can act on failure |
| **set category and priority** | Proposals (at approval), Validation (after) | the two moments a human classifies; nowhere else may overwrite it |
| **advanced filter builder** | `large` + `notebook`, any view | it is the only path to a watchlist ([[view-rules]] §2 rule 3) |
| **withdrawing a request** | My Requests | `request.withdraw_own` is self-scoped — your own or nobody's ([[permissions]] §2.1) |
| **generate against an intention** | Digitization Lists Generation | generation needs a target; only this view has one |
| **overriding a machine verdict** | Validation (Accept), Additions (Overrule) | two different weights, two different views ([[status-model]] §2) |
| **editing a mix's percentages** | Categories | shares are a property of the tree, edited where the tree is |

**Three things appear in every view and are never listed per-entry:** the
search box ([[view-rules]] §3 rule 6 — it is 1 point and scales to phone), the
status badge, and *Watch*.

---

## 3. The document pages

### 1 — My Requests

`/requests` · **MR** · actor `reader`, secondary `staff` · **row = one request**

| | |
|---|---|
| **Scope** | authorship — requests I raised ([[relationships]] §5.1) |
| **Opens on** | everything; nothing is hidden from a person about their own ask |

A row starts at the **proposal** stage, not the document stage. That is the
whole point of the view: the item never disappears between stages.

| Tier | Columns | Cost |
|------|---------|:----:|
| large | title · catalog ID · unit · status · registry · asked on · held by | 8 / 12 |
| notebook | title · unit · status · registry · held by | 6 / 8 |
| small | title · unit · status · registry | 5 / 6 |
| phone | title · unit · status · registry | 5 / 5 |

**Controls** — search (rules 1–5, 9–12); facets: status, registry state;
overview: collapsed, one chart; detail: transient, public texts only; actions:
*Propose*, *Withdraw*, *Watch*.

**Not here**

| | Instead |
|---|---|
| approve, decline, deny anything | Proposals / Validation — §2 |
| advanced filtering | nowhere for this actor: a reader has no watchlists to build |
| internal reason text | public wording only, always ([[view-rules]] §4.3) |
| priority, project, category | a curation concern; the requester does not set or see it |
| other people's requests | that is *Documents* |

### 2 — Documents

`/documents` · **Do** · actor `staff`+ · **row = one iteration**

| | |
|---|---|
| **Scope** | every iteration the actor may read — custody, or global for admin |
| **Opens on** | nothing filtered |

The one **reference** view: you come to look something up, not to move work
along, which is why it sits among the stage views without being one.

| Tier | Columns | Cost |
|------|---------|:----:|
| large | title · catalog ID · unit · status · registry · category · priority · pages · updated | 10.5 / 12 |
| notebook | title · unit · status · registry · category · priority | 7.5 / 8 |
| small | title · unit · status · registry · expand | 6 / 6 |
| phone | title · unit · status · registry | 5 / 5 |

**Controls** — search (all rules); facets: status, registry, category,
priority, project; advanced: full, `large` + `notebook`; overview: up to 3
charts; detail: docked at `large`, transient below; actions: *Propose*,
*Watch*, *Relink catalog record* (staff+).

**Not here**

| | Instead |
|---|---|
| approve / deny / revoke | Validation — this view is read-mostly by design |
| selection and bulk actions | List Building — §2 |
| add to list | List Building |

### 3 — Documents Validations

`/review/documents` · **DV** · actor `curator`, secondary `staff` ·
**row = one iteration**

| | |
|---|---|
| **Scope** | iterations in categories under my custody ([[relationships]] §5.2) |
| **Opens on** | `validation = Needed` |

| Tier | Columns | Cost |
|------|---------|:----:|
| large | title · catalog ID · unit · status · defects · category · priority · pages · registry | 11 / 12 |
| notebook | title · status · defects · priority | 5 / 8 |
| small | title · unit · status · defects | 5.5 / 6 |
| phone | title · status · defects | 4 / 5 |

`defects` is a chip group showing **`D \ A`** — what is outstanding, never what
was already accepted ([[status-model]] §2).

**Controls** — facets: status, priority, project, category, defect rule;
advanced: ranges, negation, absence; detail: docked at `large`, full defect
list with per-defect verdicts; actions: **Approve** (primary), *Deny (reason)*,
*Revoke*, *Forbid (reason)*, *Accept* an ineligibility, edit category /
priority / catalog link, *Cancel (reason)*.

**Not here**

| | Instead |
|---|---|
| proposals awaiting review | Proposals — separate route, one workflow per view ([[view-map]] §5) |
| selection and bulk approve | Validation decisions are per-item and carry reasons |
| ingest retry | Additions |
| items outside my custody | not filterable in — that is the scope |

### 4 — Digitization Lists Generation

`/lists/new` · **DG** · actor `dig-curator` · **row = one iteration**

| | |
|---|---|
| **Scope** | `Ready` ∧ not already on a list ([[status-model]] §3) |
| **Opens on** | nothing filtered |

The **only** view with selection. Two ways to build: pick rows, or generate
against an intention ([[intentions]] §4).

| Tier | Columns | Cost |
|------|---------|:----:|
| large | ☐ · title · catalog ID · unit · priority · pages · category · registry · project | 10 / 12 |
| notebook | ☐ · title · priority · pages · category | 6.5 / 8 |
| small | ☐ · title · pages · priority | 5.5 / 6 |
| phone | title · pages · priority | 4.5 / 5 |

**Controls** — facets: category, priority, project, page count band; advanced:
full; overview: 2 charts at `large` — the *Generate* CTA takes the third
chart's points ([[view-rules]] §1.4); actions: **Generate list** (primary),
*New list from selection*, *Add to existing list*, *Export selection*.

Generation shows **what it could not fill, per category**, before the list is
created — never after ([[intentions]] §4).

**Not here**

| | Instead |
|---|---|
| items still in validation | they have not passed the gates; showing them invites scheduling work that cannot start |
| approve / deny | Validation |
| editing an existing list | Digitization Lists |
| long-press bulk on phone | at most 2 bulk actions on phone ([[view-rules]] §5 rule 5); generation is not one of them |

### 5 — Proposals

`/review/proposals` · **Pr** · actor `curator` · **row = one document**

| | |
|---|---|
| **Scope** | proposals in categories under my custody |
| **Opens on** | `decision = Pending` — `Declined` and `Withdrawn` are one filter away |

**One row per document, not per proposal** — because the **decision** is
per-document. A curator cannot approve for one asker and deny for another:
there would be one iteration either way. Five rows for one title would imply
five independent decisions, and four of them would vanish mid-session when the
decision propagates ([[status-model]] §2.7).

**But the reasons are per-asker, and they are the row's most important
content.** `request.reason` is the one decision-relevant thing a curator learns
that no plugin can supply, and several asks mean several reasons. The row is
the decision unit; the reasons are the evidence inside it.

| Tier | Columns | Cost |
|------|---------|:----:|
| large | title · catalog ID · unit · reason · askers · asked on · eligibility · registry | 10 / 12 |
| notebook | title · unit · reason · askers · eligibility | 6.5 / 8 |
| small | title · askers · eligibility · registry | 5.5 / 6 |
| phone | title · eligibility · registry | 4 / 5 |

- **`reason`** shows the single ask's words, or *"3 reasons"* when there are
  several — never a truncated pick of one, which would silently privilege
  whichever asker happened to be first.
- **`askers`** is real demand, not decoration: it is the count that drives
  priority, and it concentrates what duplicate rows would scatter.
- **`registry`** is why this view earns its keep — *Kramerius: Published* at
  review time is the cheapest moment to avoid duplicated work
  ([[registry-status]] §9).

At `small` and `phone` the reason moves into the detail; `askers` survives,
because a count of *how many people want this* is the part that changes a
decision at a glance.

**Controls** — facets: decision, category, requester kind (person / agent);
**detail: every asker, their reason and their date**, plus registry evidence;
actions: **Approve** (primary, sets category + priority), *Decline (reason)*.
**Bulk approve is allowed; bulk decline is not.**

> **A decline reason is read by everyone who asked** — including people whose
> own reason the curator never opened. So it must be about the **document**
> (*too fragile to scan*, *already published in Kramerius*) and never about a
> motive (*your exhibition is not a priority*). This is a wording constraint
> that only exists because decisions propagate, and it is the one place
> one-row-per-document costs something.

**Not here**

| | Instead |
|---|---|
| documents already ingested | Validation |
| `Duplicate` requests | resolved without review; visible in *Documents*, never queued here |
| priority editing after approval | Validation |

### 6 — Additions

`/additions` · **Ad** · actor `admin` · **row = one addition**, grouped by batch

| | |
|---|---|
| **Scope** | global — an admin is not custody-scoped |
| **Opens on** | batches with failures first |

The only document view about **machinery** rather than judgement.

| Tier | Columns | Cost |
|------|---------|:----:|
| large | title · catalog ID · batch · progress · attempts · added by · added on | 7 / 12 |
| notebook | title · batch · progress · attempts | 4 / 8 |
| small | title · progress · attempts | 3 / 6 |
| phone | title · progress | 2.5 / 5 |

The failure text is a **footnote**, not a column — it is the thing the admin
acts on and it is exempt from the budget ([[view-rules]] §1.1).

**Controls** — grouped by batch by default; facets: progress, batch, eligibility
failure kind; actions: *Ingest*, *Re-ingest*, *Overrule* a prohibition,
*Allow new iteration*, *Delete*, *View raw payload*.

**Not here**

| | Instead |
|---|---|
| curatorial decisions | Proposals / Validation |
| category and priority | set at approval, before this view sees it |

> **This view has a read-only shape.** A curator holding `addition.read@custody`
> and nothing else sees their own batches and the failure text, with every
> action absent ([[permissions]] §3). That is the curator who approved a
> proposal and is wondering why it never arrived.

---

## 4. The other pages

Reference and administration. You come here to *set something up*. None carries
a count ([[navigation]] §2 rule 3).

### Projects · `/projects` · **Pj** · `dig-curator`

Funded envelopes. Rows: name, period, target pages, **planned** and
**delivered** as two columns that are never summed ([[intentions]] §6). Detail:
member users and groups, intentions, the iterations it funded.

**Not here:** the mix — that belongs to an intention. Project has no link
to category ([[relationships]] §4).

### Categories · `/categories` · **Ca** · `curator`, `dig-curator`

The tree, and the **only** place a mix's percentages are edited: the mix of
one intention, picked in the topbar (`?i=`, Overall by default). A sibling
set is edited and saved **as a set**, under a lock, and the editor shows
unallocated remainder and zero-share children explicitly ([[intentions]] §1.1).
A mix others track lists them before saving; a tracker shows its owner's mix
and offers *Detach* ([[intentions]] §2.3–§2.4).

Also where custody is granted, and where a leaf is refined into children —
which moves its documents in the same action ([[intentions]] §1.2).

**Not here:** documents. A category shows its counts and links into *Documents*
filtered; it does not become a second document browser.

### Intentions · `/intentions` · **In** · `dig-curator`

Two columns of cards, *Targets* and *Tracking* (derived: with or without a
page target). A card: scope, window, its mix (*own* or *tracks Overall*),
progress or drift, and *Edit mix* into Categories. The form picks the mix:
track an owner, or own a copy ([[intentions]] §2.1).

**Not here:** documents — an intention is a target, not a selection
([[concepts]]). Selecting is List Building's job.

### Digitization Lists · `/lists` · **DL** · `dig-curator`, `admin`

Browse and edit existing lists: membership, dates, attached intentions,
capacity against page counts. Deleting one returns its members to the pool
([[status-model]] §2.6).

**Not here:** building a new list — that is `DG`. Two verbs, two routes.

### Tasks · `/tasks` · **Ta** · `admin`, and every staff role as *My Tasks*

Scheduled and running plugin executions ([[registry-status]] §8): what ran,
when, what it changed, what failed. The source of truth behind the *Running
tasks* indicator ([[navigation]] §6).

Running runs on top, then finished ones. Anyone holding `task.read_own` gets
the page as *My Tasks*, showing the runs they started; `task.read` widens it
to every run ([[page-composition]] §5).

### Schedules · `/schedules` · **Sc** · `admin`

What runs by itself, and when: a timeline (24 h / 7 days / month), then every
schedule — plugin schedules, and intention repeats listed read-only. The only
place a schedule is edited. Needs `task.read`; editing needs `task.schedule`.

### Users & Groups · `/access` · **UG** · `admin`

Users, groups, roles, category custody and proposal custody — separate things
([[relationships]] §1), which is why the page exists at all.

**One view, three linked columns, the user in the middle** — Roles · Users ·
Groups and proposal custodies — with the selected record underneath
(layout decided 2026-09-26, redrawn 2026-10-01 once groups stopped giving
roles). Selecting anything lights up what it is connected to and draws the
links. The left side answers *what may this person do*: each role is held
**by hand** or **mapped** by an Identity instance from a claim (a dashed
line). The right side answers *what are they responsible for*: their groups
and the proposal custodies they are in, directly or via a group.

| Column | Shows, when selected |
|-------|-------|
| **Roles** | who holds it and how (by hand, or mapped by which Identity instance from which claim), the mappings that give it, and its (permission, scope) grants |
| **Users** | roles **and how**; how they sign in (each linked identity: instance, external id, last login); groups; category custody, proposal custody and projects, directly or via which group; every permission with the role it comes from. A user with no role says *No access yet*, and the header counts them |
| **Groups** | members, the categories, proposal custodies and projects it holds, and *adding somebody here gives them …* — never a role |
| **Proposal custodies** | members, direct or via a group, each with what they can do (*decides*, *sees only*, *no role reaches it*); the Custody rules that name it; open proposals. The fallback is marked and cannot be deleted |

**Users come from Identity plugins** ([[identity]]): somebody with an
institutional account appears the first time they log in. The page creates
only **local accounts**, and links a second identity to an existing user.
Agents are created with their plugin.

A user is a **person or an agent**, nothing else — an agent is a plugin acting
as a user and carries a badge. **Roles are editable**, shipped ones included:
the editor sets a scope per permission and says who a change reaches before it
is saved, and refuses to leave nobody able to manage access.

**Everything is shown with its provenance** ([[permissions]] §6). *"Jana:
curator"* is not enough; *"curator — mapped from the IdP group
mzk-curators"* is. *"Custody of Periodicals — via Periodicals Curators"* says
the same for responsibility.

**Proposal custody is edited here** (`access.manage`): the custodies, their
names and members, and the *fallback* custody's members. Which proposals are
in each is a Custody rule's answer, edited on Plugins.

The **Groups** index shows what membership confers, so the consequence of adding
somebody is visible while adding them rather than discoverable later.

**Custody is shown here and edited only in *Categories*** (decided 2026-09-26),
from the branch. A user's and a group's custody appear read-only, linking to the
node.

**Not here:** the permission *check* itself. This page edits grants; whether a
particular button appears is decided in the view that owns the button
([[permissions]] §7).

### Plugins · `/plugins` · **Pl** · `admin`

Installed plugins, their configuration, their **tiers** for the properties they
supply ([[document-properties]] §4), their registry mappings
([[registry-status]] §3.2), their agent names and entry points
([[view-map]] §6), and when they run — shown here, scheduled only on *Schedules*.

**One data table grouped twice** (decided 2026-09-26): **type** (the job —
catalog adapter, registry, property source, harvester, validation, input, list
generator, custody, identity, message) → **implementation** (the code and its declared contract) →
**instance** (a configured copy that runs). An implementation row opens its
contract; an instance row opens its configuration, when it runs, its recent
runs, and Run now / Edit / Disable / Delete — each saying what stops before it
happens. **Delivery channels** — where hooks send — are a plugin type of their
own, with an interface (email, chat, webhook, file) per implementation.

**List generators** are a plugin kind of their own, in two classes —
**rule-based** and **AI-based** ([[intentions]] §4). Their configuration here
is what makes the *Generate* button exist in the list editor at all: none
configured, no button. An AI generator's configuration states what it is sent
about the pool, because that is metadata leaving VERA.

> `TODO(Plugins):` most of this page is the plugin contract, which is not
> written. It is the largest single undrawn view.

### Hooks · `/hooks` · **Ho** · `admin`

**Master–detail** (decided 2026-09-26). Hooks on the left, grouped by what their
event is about — *Requests, Documents, Records, Lists, Tasks* (status-log §3, plus
task runs). The selected hook on the right, and **at the top of it, the deliveries
that gave up** (retry / discard) and those **waiting to send**.

- **A hook sends something out** — email, chat (Slack, Teams), a webhook, a file.
  Reacting *inside* VERA is a plugin trigger, on Plugins; there are no data hooks.
- **Where it sends is a plugin** — a *delivery channel*. An implementation
  provides one interface (email, chat, webhook, file): SMTP and Mailgun are two
  implementations of email, each instance with its own configuration. The hook
  says which channel and to whom.
- **Timing:** send each at once, or **wait for more** — the wait restarts with
  each new event, up to a limit, then sends them together, one per recipient or
  as one message. A curator deciding a shelf sends each requester one mail.
- **Retries are per hook** (attempts, fixed or growing wait). After the last
  one the delivery waits on its hook until retried or discarded.
- Derived conditions (behind pace, out of band) are not events; a watchlist is
  the tool for those.

---

## 5. What no view has

- **A disabled control.** Absent, not greyed ([[view-rules]] §5 rule 1).
- **A `—` for something the actor may not read.** Absent
  ([[view-rules]] §4 rule 4). The exception is status: the *fact* is always
  visible, only the *reason* is graded.
- **More than one primary action per phone screen**, two on small, three above
  ([[view-rules]] §5 rule 2).
- **A second provenance box.** History is the [[status-log]], everywhere.
- **A column a plugin added by itself** ([[document-properties]] §7).
- **More than one badge per row**, except a `Digitized`/`Published` item with a
  new defect, which carries validation as a footnote ([[status-model]] §2).

## Related

- [[view-rules]] — the budgets and the declaration format this fills in
- [[view-map]] — why these views and not others
- [[navigation]] — the sidebar they hang from
- [[concepts]] — what the rows actually are
