# Permissions

Role-based, with **ownership scope** on the grant rather than on the role.

Every `TODO(Permissions)` in this set resolves here. There were ten.

---

## 1. Roles attach to users; groups carry responsibility

```
user_roles       (user_id, role_id)          — capability: direct, or from the IdP mapping
group_members    (user_id, group_id)         — who I sit with
category_members / category_group_members    — what I am responsible for
project_members  / project_group_members     — what I am funded by
proposal_custody_members                     — which proposals I decide (§3, Requests)
```

```
effective roles = user_roles   (held directly, or mapped by the IdP plugin — §1.1)
```

**There are no group roles** (decided 2026-09-26). A group gives **custody and
project membership**, never capability.

**Three concepts, each earning its place:**

| | Answers | Why it is not one of the others |
|---|---|---|
| **Role** | *what may I do* | the unit of **change** — "what a curator may do" is defined once, not re-enumerated per team |
| **Group** | *who do I sit with* | the unit of **administration** — one act puts a colleague into a team's custody and projects |
| **Custody / project** | *what may I do it **to*** | the unit of **responsibility** — a subtree, a set of proposals, or a funded envelope |

**Why roles are not folded into groups.** If a group carried permissions
directly, *Periodicals Curators* and *Monographs Curators* would each hold their
own copy of the whole curator permission list. Changing what a curator may do
would mean editing every such group and missing one. A role is the thing you
edit when the job changes.

**Why groups do not grant roles.** Capability then reaches a person by exactly
one kind of act — a role held by them — and never as a side effect of joining a
team for another reason. What a team shares is its responsibility: the
branches it looks after, the proposals it decides, the projects it works on.

**Union, never intersection.** Holding two roles gives you both. There is no
deny rule, no precedence, and no order of evaluation to reason about — absence
is the only way to not have something.

### 1.1 Roles come through the IdP plugin

Users arrive through **Identity plugins** — Keycloak, VERA's own local
accounts, any OIDC or SAML provider — **several at once**, each declaring
which claim is its user id and its place on the login page ([[identity]]).
Each instance's settings decide which roles a user holds when they are not
set by hand:

| Setting | |
|---|---|
| **default role** | what a newly seen user gets: for example `guest`, `reader`, or none |
| **attribute mapping** | user attributes (an IdP group, a department, an email domain) → roles, re-evaluated at every login; hand-set roles are never touched |

A role mapped by the IdP and a role granted in VERA are both simply held; the
provenance says which (§6).

| | Owned by |
|---|---|
| users, and the attributes the mapping reads | the identity provider |
| roles a user holds | the IdP mapping, or VERA by hand |
| **what a role may do in VERA** | VERA — Keycloak has no notion of `validation.approve` |
| **groups, custody, proposal custody and project membership** | VERA — Keycloak has no notion of the category tree |

---

## 2. A grant is a permission **plus a scope**

```
role_permission
  role_id
  permission        — 'validation.approve'
  scope             — custody | project | managed | any   (none for a self-scoped permission)
```

| Scope | The subject must be | Resolved by |
|-------|--------------------|-------------|
| `custody` | in a category I hold — or, for a proposal, matched by a proposal custody I am a member of | effective custody, including via groups — [[relationships]] §5.2; proposal custody — §3 |
| `project` | funded by a project I am in | §5.3 |
| `managed` | a project whose manager I am — projects only | `project.manager_id` ([[projects]] §3) |
| `any` | — | always true |

### 2.1 Self-scoped permissions

Some permissions act on the actor's **own** records by definition. They still
need a **grant** — but they need no **scope**, because there is nothing to vary:
"my own" is not one option among four.

| Self-scoped permission | |
|---|---|
| `request.create` | raise a proposal |
| `request.read_own` | my requests, and the iterations they produced |
| `request.withdraw_own` | take back my own ask |
| `task.read_own` | the tasks I started — seeing them, and cancelling or re-running them |
| `watch` | anything I can already read |

These carry no scope column in §3 and no `@scope` suffix anywhere. Authorship
([[relationships]] §5.1) is how they resolve, not something a role chooses.

**Why they are grants and not simply a floor.** It is tempting to make them
unconditional — everyone signed in can obviously read their own requests — and
that is wrong for one reason: **it removes the configuration point.** With no
grant there is no way to express *this account sees nothing*, and more
importantly no way for a misconfiguration to be **visible**. A `guest` role
(§1.1) accidentally created empty should produce a user who lands on an empty
application, which somebody notices in a minute — not a user who still sees My
Documents because the page was unconditional, and whose real problem surfaces
weeks later.

**The system fails closed.** A user holding no roles at all sees nothing: no
sidebar entries, no Home, nothing to act on. That is correct. It is also why
the default role is an explicit IdP-plugin setting (§1.1) rather than
something the application assumes.

> This is the one place the model prefers a redundant-looking grant to an
> elegant absence. Elegance costs nothing when the configuration is right and
> hides the failure when it is not.

**What the scoped permissions in §3 govern is therefore exactly one thing:**
what I may do to **other people's** records. That is the whole of the
interesting question, and it is why `custody | project | any` is the complete
scope list — plus `managed`, which only the project permissions take.

**The scope is on the grant, not on the permission.** `validation.approve` at
`custody` is a curator; the same permission at `any` would be an administrator
who can approve anything. One permission, two roles, different reach — without
inventing `validation.approve_anywhere`.

**Grants union across roles.** Holding two roles gives you the wider scope of
each permission, never the narrower. There is no deny rule and no precedence
order: absence is the only way to not have something.

**Not every permission accepts every scope.** `addition.retry` accepts only
`any` — ingest is machinery, not anybody's subtree. Withdrawing is only ever
your own ask (`request.withdraw_own`): taking back someone else's ask is not a
thing; refusing it is, and that is `request.decide`. The allowed set is
declared per permission in §3 and is a property of the model, not of any role.

---

## 3. The permissions

Scopes listed are those the permission **accepts**. `✱` marks the scope the
shipped roles in §4 actually use.

### Requests

| Permission | Scopes | |
|---|---|---|
| `request.create` | **self-scoped** | §2.1 |
| `request.read_own` | **self-scoped** | §2.1 — what *My Documents* requires |
| `request.withdraw_own` | **self-scoped** | §2.1 |
| `request.read` | `custody` · `project` · `any ✱` | **other people's** asks and reasons; before approval, `custody` means proposal custody |
| `request.decide` | `custody ✱` · `any ✱` | approve / decline; sets category + priority; **includes approving a rescan**. At `custody`: through proposal custody, below |

> **Proposing many at once is `request.create`, once per item** — a batch is
> a way of submitting, not a power, and readers may do it: a researcher with a
> bibliography is the ordinary case. What differs is a **limit, not a grant**:
> without `request.decide`, a submission holds at most `propose.max_at_once`
> items (a deployment setting, 10 by default) — see [[view-map]] §2.1.

> **`request.decide@custody` resolves through proposal custody** (decided
> 2026-09-26). A proposal has no category until it is approved, so category
> custody cannot say whose it is. A **proposal custody** can: a name with
> members, users and groups, edited by admins — and which proposals are in it
> is a **property of the proposal, set by *Custody* plugins** (a jq rule, for
> example) that return a list of custody names ([[proposal-custody]]). A
> curator **sees and decides** the proposals in a custody they are a member of
> — `request.read@custody` and `request.decide@custody` both resolve through
> it (decided 2026-09-30) — and may approve into any category. The category chosen at
> approval is where category custody starts, for everything after it.
>
> **The fallback custody** catches what no other custody covers. There is
> exactly one, from installation; it cannot be deleted and no plugin names
> it. Its members decide those proposals at `custody`; with no members, only
> holders of `request.decide@any` see them. The row says *fallback*, so an
> admin can tell when a plugin's rule should reach further.

> **An addition is `request.create` plus `request.decide`**, not a permission
> of its own. *Approve now* on the propose form is shown only to somebody
> holding `request.decide`, and it is an intent the
> system applies after the checks — never to a request carrying an existing
> copy ([[status-model]] §2.8).

> **A rescan is `request.decide`, not a separate grant.** Approving a request
> that carries an existing copy is the ordinary question *should this be
> digitized*, with one more fact in front of the curator. It replaced two
> permissions — `eligibility.accept` and `addition.allow_new_iteration` — that
> turned out to be one act ([[status-model]] §2, *What eligibility used to
> hold*).

### Iterations

| Permission | Scopes | |
|---|---|---|
| `iteration.read` | `custody` · `project` · `any ✱` | **other people's** |
| `iteration.edit_descriptive` | `custody` · `any ✱` | |
| `iteration.classify` | `custody ✱` · `any ✱` | category and priority, after approval |
| `iteration.relink` | `custody` · `any ✱` | catalog record |
| `validation.approve` | `custody ✱` · `any ✱` | accepts the outstanding defect set |
| `validation.deny` | `custody ✱` · `any ✱` | with reason |
| `validation.revoke` | `custody ✱` · `any ✱` | |
| `restriction.overrule` | `any ✱` | lifts a restriction — see below |
| `iteration.cancel` | `custody ✱` · `any ✱` | with reason |
| `iteration.resume` | `custody ✱` · `any ✱` | separately grantable — see below |
| `iteration.publish` | `custody ✱` · `any ✱` | sets or changes the link where the scan is available — that is what makes it *Published* |

> **Overruling a restriction is `any`-only, deliberately.** It says *a rule
> said never and I am saying anyway* ([[status-model]] §2). A permission that
> could be granted at `custody` would let a curator quietly lift prohibitions
> inside their own subtree, which is exactly the act that should require
> someone outside it. **Setting one is never a person's act**: only rules
> (plugins) forbid (decided 2026-09-26). A curator who sees a forbidden item —
> Validations has a *Forbidden* filter — can message an admin, not act on it.

> **Cancel and resume are separately grantable** because they are different
> powers: stopping work someone else scheduled, and restarting work someone
> deliberately stopped. The shipped roles happen to hold both, but a deployment
> that wants an operator who can halt a runaway batch without being able to
> restart anything can express that.

### Additions

| Permission | Scopes | |
|---|---|---|
| `addition.read` | `custody ✱` · `any ✱` | the ingest detail — batch, failure text — in Documents |
| `addition.retry` | `any ✱` | ingest, re-ingest — per item or per batch |
| `addition.read_payload` | `any ✱` | raw responses |

> **Read and act are two permissions**, which answers [[view-map]] §5. The
> curator who approved a proposal and is wondering why it never arrived holds
> `addition.read` at `custody` and nothing else: they see the batch, they see
> the failure text, and every action is **absent** rather than disabled
> ([[view-rules]] §5 rule 1). They can then ask an admin a specific question
> instead of a vague one.
>
> *Addition* survives as the name of these permissions because it is still the
> name of the phase — an approved request whose ingest has not finished — even
> though it is no longer a page ([[navigation]] §1.1).
>
> **There is no deleting an addition** (decided 2026-09-26): a failed ingest
> is retried. `addition.delete` is gone.

### Lists and planning

| Permission | Scopes | |
|---|---|---|
| `list.read` | `custody` · `project` · `any ✱` | |
| `list.create` | `any ✱` | includes running a list generator — generating is building a list, not operating a plugin |
| `list.edit` | `any ✱` | membership, dates, *Mark Done*, *Could not be digitized* per item |
| `list.delete` | `any ✱` | returns members to the pool |
| `intention.read` / `.edit` | `project` · `any ✱` | `.edit` includes the intention's mix — its own, or which intention it tracks |
| `intention.edit_overall` | `any ✱` | the Overall intention's mix — nearly every intention tracks it. Admin only in the shipped roles ([[intentions]] §2.5) |
| `intention.repeat` | `any ✱` | repeating intentions — held by admin only in the shipped roles |
| `project.read` | `project` · `any ✱` | |
| `project.create` | `any ✱` | starting a project, which starts *Proposed*; the creator becomes its manager |
| `project.edit` / `.manage_members` | `managed` · `any ✱` | the manager's acts: details, description, dates, target, members, handing over |
| `project.decide` | `any ✱` | approve (picking its priority) or reject (with a reason) a Proposed project ([[projects]] §2); **implies `project.read@any`** |
| `project.delete` | `managed` · `any ✱` | only a project with no proposals |

> **Distributions are not a permission any more** (decided 2026-09-26). The
> mix belongs to an intention, so editing it is `intention.edit`; a shared
> mix is edited on the intention that owns it, with its trackers listed
> first; unticked ones detach ([[intentions]] §2.3, §2.5).
>
> **Members propose into their project** with `request.create` — membership
> is what offers the project on the propose form, not a separate grant.

### Categories

| Permission | Scopes | |
|---|---|---|
| `category.read` | `custody` · `any ✱` | |
| `category.edit` | `custody ✱` · `any ✱` | rename, reparent, refine a leaf — at `custody`, moves stay inside my own subtree |
| `category.grant_custody` | `custody ✱` · `any ✱` | see below |

> **`category.grant_custody` at `custody` means *within my own subtree***, which
> answers [[view-map]] §3. A curator holding *Periodicals* may bring somebody
> onto *Periodicals / Regional* without an administrator, and cannot touch
> *Monographs*. Because custody inherits downward ([[relationships]] §5.2), the
> grant they make is itself bounded by the grant they hold — delegation cannot
> widen. Granting at a root stays `any`.

### Administration

| Permission | Scopes | |
|---|---|---|
| `plugin.read` / `.configure` / `.upload_code` / `.run` | `any ✱` | |
| `hook.read` / `.configure` | `any ✱` | `.configure` also covers acting on deliveries: retry, discard, send now |
| `task.read_own` | **self-scoped** | the tasks I started — and cancelling or re-running them |
| `task.read` / `.cancel` | `any ✱` | **other people's** |
| `task.schedule` | `any ✱` | create, edit, pause and delete schedules, and set how long runs are kept |
| `access.read` / `.manage` | `any ✱` | users, groups, roles, proposal custody |

---

## 4. The five shipped roles

[[view-rules]] §4 calls its five actors *bundles, not a ladder*. They are
literally bundles: named sets of grants, editable, with nothing structural
distinguishing them from a role somebody adds next year.

| Role | Holds |
|------|-------|
| **reader** | `request.create` · `request.read_own` · `request.withdraw_own` · `watch` — four of the self-scoped grants, and nothing else |
| **staff** | reader + `task.read_own` · `project.create` · `project.edit@managed` · `project.manage_members@managed` · `project.delete@managed` · `iteration.read@any` · `request.read@any` · `iteration.edit_descriptive@any` · `iteration.relink@any` · `category.read@any` |
| **curator** | staff + everything else `@custody`: `request.decide` (proposal custody) · `validation.*` · `iteration.classify` · `iteration.cancel` · `iteration.resume` · `iteration.publish` · `addition.read` · `category.edit` · `category.grant_custody` · `project.decide@any` |
| **dig-curator** | staff + `list.*@any` · `intention.read@any` · `intention.edit@any` · `project.*@any` · `iteration.cancel@any` · `iteration.resume@any` |
| **admin** | everything at `any`, including `restriction.overrule` and `access.manage` |

**`reader` holds only self-scoped grants**, nothing that touches another
person's records — and not `task.read_own`, because a reader starts no runs
(decided 2026-09-26), so a reader has exactly one entry, *My Documents*.
Somebody from outside the library holds reader, with no custody and no project
membership, so every scope in §2 resolves empty ([[view-rules]] §4). A user is
a person or an agent; **guest is a role**, not a kind of user — a deployment
may add one and make it the IdP plugin's default (§1.1).

**A role must actually be held.** A user with no role is not a reader; they
are somebody who sees an empty application (§2.1). That is the intended
failure, and the reason the IdP plugin's default role is a setting rather than
an assumption.

---

## 5. What the sidebar is built from

This answers [[navigation]] §2 rule 2. **Each entry declares what it requires;
the entry is visible when the user holds it at any scope.**

| Entry | Requires |
|-------|----------|
| Documents | `request.read_own` **or** `iteration.read` — labelled *My Documents* with the first alone |
| Proposals | `request.decide` |
| Documents Validations | `validation.approve` |
| Digitization Lists | `list.read` — *New list* needs `list.create`, *Edit* needs `list.edit`, both absent otherwise |
| Projects | `project.read` |
| Categories | `category.read` |
| Intentions | `intention.read` |
| Tasks | `task.read_own` or `task.read` — labelled *My Tasks* without `task.read` |
| Schedules | `task.read` — *New schedule*, *Edit* and *Pause* need `task.schedule`, *Run now* needs `plugin.run` |
| Users & Groups | `access.read` |
| Plugins | `plugin.read` |
| Hooks | `hook.read` |

Two consequences worth seeing:

- **`request.read_own` and `iteration.read` are different permissions**, not one
  permission at two scopes — which is what removes the old "wider than `own`"
  qualification. They reveal **one entry** between them, because the rows are
  the same kind of thing and only the reach differs; the label says which reach
  you have ([[navigation]] §1.1). Documents is the one entry with two ways in.
- **An empty role produces an empty sidebar**, visibly. Every entry requires a
  grant, including the first one, so a misconfigured `guest` is noticed by the
  person it happens to rather than months later.
- The counterexample that shaped [[navigation]] §8 is expressible exactly:
  somebody holding `reader` plus `project.read@project` sees *My Documents* and
  *Projects* — two entries, so `/` is a card page rather than a redirect. A
  reader alone holds one entry, and `/` redirects to *My Documents*.

---

## 6. Provenance is part of the answer

**Every screen showing what somebody may do shows how they came to it.** A
role is held *directly* or *mapped by the IdP* — and then by which attribute;
custody and project membership are held *directly* or *via a group*. Not
*"Jana: Periodicals"* but *"custody of Periodicals — via Periodicals
Curators"*.

The failure this guards against — somebody quietly responsible for a branch
because of a group they joined for another reason — is invisible in a list of
reach and obvious in a list of reasons.

The same applies in reverse: a group's detail shows **what holding it confers**
— the custody, proposal custody and projects it brings — so the consequence of
adding somebody is visible at the moment of adding them rather than
discoverable afterwards.

---

## 7. Where it is enforced

1. **Actions**: an action whose permission the actor lacks is **absent**, never
   disabled ([[view-rules]] §5 rule 1).
2. **Rows**: a view's scope is an intersection of its own fixed scope
   ([[view-map]] §1) with the actor's grant scope. A curator's *Validation*
   is `custody` because the grant is, not because the view says so.
3. **Properties**: a field the actor may not read is absent, not blanked
   ([[view-rules]] §4 rule 4).
4. **Filters**: a property the actor may not read is not filterable — otherwise
   a filter becomes an oracle for probing records they cannot see
   ([[view-rules]] §2 rule 5). This rule existed already and was unenforceable
   until now.
5. **Reason text**: public or internal per [[view-rules]] §4.3. The grade is a
   property of the actor's role, and it is the one place a permission controls
   *wording* rather than access.

---

## 8. Open

- ~~**Which side owns users, groups and role assignment**~~ — **answered**
  (2026-09-26): users come from the IdP plugin; roles are held by hand or
  mapped from the IdP's attributes; groups, custody and project membership are
  VERA's (§1.1).
- ~~**Which permission approves or rejects a project**~~ — **answered**
  (2026-10-01): `project.decide@any`, held by curator and admin.
- ~~**The project manager's scope**~~ — **answered** (2026-10-01): a new
  scope, `managed`; staff hold `project.edit@managed` and
  `project.manage_members@managed` ([[projects]] §3).
- ~~**Overall's mix**~~ — **answered** (2026-10-01): `intention.edit_overall`,
  admin only.
- **Does `iteration.cancel@custody` cover an iteration already on a list?** The
  list belongs to a dig-curator's plan; the document belongs to a curator's
  subtree. Both have a claim. Erring toward *yes, with the cancellation visible
  on the list* is the suggested reading — the alternative makes a curator ask
  permission to stop work on their own material.
- **Role editing is itself `access.manage`**, which means an admin can grant
  themselves anything. That is normally accepted, but it is worth deciding
  whether the status log treats a self-grant differently from any other.

## Related

- [[relationships]] — §2 where roles and groups attach, §5 the three scopes
- [[view-rules]] — §4 the actors these roles formalise, §5 the action matrix
- [[navigation]] — §2, the sidebar §5 above builds
- [[status-model]] — §2 restriction and rescan, §2.5 cancel and resume, §2.8 automatic approval
