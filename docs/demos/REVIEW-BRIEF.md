# Review brief: the notebook demo and the current design

Instructions for a **fresh session**. Read this whole file before opening anything
else. Written 2026-09-26.

You are reviewing VERA, the Moravian Library's digitization planning system. It is
being redesigned as static HTML demos plus design documents. The goal of this
session is **a fresh, outside view**: map what the design *is* as a set of
connected graphs, and point out where the parts do not fit together.

---

## 0. Hard rules: read-only

**Do not write anything.** In practice:

- **Do not create, edit, move or delete any file.** That includes this brief,
  `STATUS.md`, the docs and the demos. It also covers "small fixes" and typos:
  report them, do not fix them.
- **No git commands that change state**: no commit, add, stash, checkout,
  reset or branch. Read-only `git log` / `git show` are fine.
- **Do not run `tools/shots.js`, `tools/render-check.js` or `tools/palette.js`.**
  They write into `tools/shots/`. If you need to *see* a page, screenshot it into
  your scratchpad directory, outside the repository, or just read the page script.
  Reading the JS is usually enough.
- **Do not publish artifacts, create documents or post anywhere** unless the user
  asks in this session.
- **Do not save memories** about this review.
- Everything you produce goes **in the conversation**, as text and Mermaid
  diagrams. If the user then wants a file, they will say so and where.

If a step seems to need writing, stop and ask.

---

## 1. What the current design is

Read the files in this order. Anything not listed is out of scope.

### 1.1 Source priority when things disagree

1. `docs/demos/STATUS.md`, the section **Decisions to trust**. These are the
   user's decisions, dated. An item marked *not confirmed* or *my choice* is a
   proposal still waiting on the user.
2. `docs/demos/rework.md`. The user's own document; `>` blocks are answers
   written back into it.
3. The design docs marked **current** below.
4. **The notebook demo**, meaning the built pages.
5. The docs marked **partly behind** or **behind** below. Use them for
   background only.

A conflict between two of these is a **finding**. Report it and do not resolve it.

### 1.2 Design documents (`docs/design/shared/`)

| File | State |
|---|---|
| `entities/concepts.md` | current: **start here** |
| `entities/status-model.md` | current: four axes plus the cancellation flag; eligibility is retired |
| `entities/permissions.md` | current: grants = permission + scope, the five shipped roles, what the sidebar is built from |
| `entities/relationships.md` | current |
| `entities/intentions.md` | current: scope + objective, derived counting, repeats |
| `entities/status-log.md`, `document-identity.md`, `document-properties.md`, `identifier-types.md`, `priority-levels.md` | current |
| `entities/registry-status.md` | mostly current: read "feeds eligibility" as "existing copy" |
| `document-use-cases.md` | current: every use case and the page it lands on (§7) |
| `view-map.md` | current: page / view / lens; the four document views |
| `navigation.md` | current: the **12** sidebar entries, rail codes, watchlists, running-tasks panel, user menu |
| `view-rules.md` | partly behind: the rules hold; page names and §1.4 budgets predate the re-cut |
| `view-catalog.md` | **mixed**: the Tasks, Schedules, Users & Groups, Plugins and Hooks sections were rewritten 2026-09-26 and are current; the rest still describes My Requests, Additions, Generation and eligibility, so treat it as **behind** |
| `page-composition.md` | behind, except §5 Tasks / Schedules (current) |
| `docs/design/manifest.yaml` | an index of the docs above, not a source of decisions |

**Behind, background only:** `docs/README.md`, `docs/demos/BUILD.md`.
**The user's raw notebook:** `docs/demos/notes.md`. Struck-through items are done.

### 1.3 The notebook demo (`docs/demos/`)

The pages under review are `notebook/*.html`. Each one is a thin shell that calls
a shared page script with the tier:

| Sidebar entry | Page | Script |
|---|---|---|
| Documents / *My Documents* | `notebook/documents.html` | `shared/page-documents.js` |
| Proposals | `notebook/proposals.html` | `shared/page-proposals.js` |
| Documents Validations | `notebook/validation.html` | `shared/page-validation.js` |
| Digitization Lists | `notebook/lists.html` | `shared/page-lists.js` |
| Projects | `notebook/projects.html` | `shared/page-projects.js` |
| Categories | `notebook/categories.html` | `shared/page-categories.js` |
| Intentions | `notebook/intentions.html` | `shared/page-intentions.js` |
| Tasks / *My Tasks* | `notebook/tasks.html` | `shared/page-tasks.js` |
| Schedules | `notebook/schedules.html` | `shared/page-tasks.js` (`'schedules'`) |
| Users & Groups | `notebook/access.html` | `shared/page-access.js` |
| Plugins | `notebook/plugins.html` | `shared/page-plugins.js` |
| Hooks | `notebook/hooks.html` | `shared/page-hooks.js` |

Shared by all of them:

- `shared/vera-data.js`: **the one dataset**. Every page is a view over it.
  - It holds users, groups, roles and permissions (`PERMISSIONS`, `roles`),
    categories, projects, intentions, lists, iterations, plugins, tasks,
    schedules and hooks, plus the counting helpers (`intentionCount`,
    `countsTowards`, `inScope` …).
  - Demo "now" is `today = 2026-06-25` and `now = 2026-06-25T10:40`.
- `shared/vera-model.js`: the status axes and how state is derived. No data,
  no DOM.
- `shared/vera-ui.js`: the shell.
  - `NAV` is the sidebar entries, each with the permission it requires.
  - `ROLE_PERMS` is **derived from `roles` in the data**.
  - It also holds the running-tasks panel, watchlists, the filter bar and
    master–detail.
- `shared/vera.css`: styles, in one section per page.

**How the demo expresses roles.** The floating bar at the bottom has an **as**
switch (reader, staff, curator, dig-curator, admin), stored in
`localStorage['vera.role']`. Entries and actions a role cannot use are
**absent, never disabled**. Checks appear in the code as `can('permission.key')`
or `held.has(...)`. Deep links use query parameters, for example
`intentions.html?i=i3`, `lists.html?list=L-2026-015`, `tasks.html?run=T-9905`,
`schedules.html?s=s4`, `access.html?r=curator`, `hooks.html?h=H-03`.

### 1.4 Out of scope

- **`app/`**: the old system, which will be reimplemented. It is never evidence
  for the design.
- **`docs/bak/`**: archived.
- **`docs/demos/*.html` at the top level** (the originals): the look-and-feel
  reference only, not design.
- **`large/`, `small/`, `phone/`**: allowed to lag until a page is agreed at
  notebook size. Mention them only if something there contradicts notebook.
- **`notebook/home.html`** and **`index.html`**: stale, and deferred by the user.

---

## 2. What to produce

A set of **Mermaid diagrams**, each followed by a short list of findings. Keep
each diagram readable: about 40 nodes at most. Split by area, or use
`subgraph`s, rather than drawing one huge graph. **Every edge must come from a
source.** After each diagram, list the files (and section or line) it was
drawn from. When the docs and the demo disagree about an edge, draw it the
demo's way, **dash it**, and list it as a finding.

### 2.1 The diagrams

1. **Domain model.** The entities and how they relate:
   - request, iteration, document, list, project, category, distribution,
     intention and intention repeat;
   - user, group, role, permission, custody;
   - plugin type → implementation → instance, schedule, task (run), hook,
     delivery channel, status log.

   Show the cardinalities where the docs state them.
2. **Functionality map.** Each capability as a node, with how they feed each
   other. For example:
   - propose → decide → ingest → validate → put on a list → digitize → publish;
   - registry checks and existing copies;
   - intentions counting planned, delivered and output;
   - generating a list shaped by an intention, including the correcting run;
   - custody and who it reaches;
   - automation: schedules → tasks → what changed, and events → hooks →
     delivery channels.
3. **Use cases → functionality → pages.** Take `document-use-cases.md`
   (§7 has the landing pages). Show which use case needs which capability, and
   where in the demo it happens. **Flag:** use cases with no page, and pages or
   capabilities no use case needs.
4. **Pages ↔ pages.** The cross-links a user can actually follow in the demo:
   deep links, "see it" links, provenance links. Show which pages link to which
   other pages.
5. **Roles → pages.** For each of the five shipped roles, the sidebar entries it
   sees, with their labels. *My Documents* and *My Tasks* are the narrower labels.
   Derive it from `roles` + `NAV`, and check it against `permissions.md` §5.
6. **Permissions → roles → actions.** Which role holds which permission at which
   scope (`permissions.md` §3–§4 against `vera-data.js` `roles`). Also show
   which page actions each permission gates (the `can('…')` calls).
   **Flag:**
   - permissions no role holds;
   - permissions the code checks that are not in `PERMISSIONS`;
   - permissions in `PERMISSIONS` that nothing checks;
   - places where the doc's scope and the data's scope differ.
7. **State lifecycle.** The axes from `status-model.md` as state diagrams:
   decision, restriction, validation and progress, plus the cancellation flag.
   Show which page or action moves each transition.
8. **Views, lenses, watchlists.** From `view-map.md` §1: which pages host which
   views, which fixed scope each view has, and where watchlists attach.

### 2.2 Then, a findings list

Put these after the diagrams, ranked most important first:

- **Contradictions** between sources, citing both sides by file and section or
  line.
- **Dead ends**: a state, action or link that leads nowhere, or an entity with
  no page that manages it.
- **Duplicates**: the same thing configured or shown in two places without
  that being a stated decision. *Custody shown in Users & Groups but edited in
  Categories* and *intention repeats listed on Schedules but edited on
  Intentions* are **stated decisions**, not findings.
- **Open items**: everything `STATUS.md` marks *not confirmed* or *my choice*,
  plus the *Open* sections of the docs, in one list.
- **Fresh-eyes questions**: things that look odd to someone who was not in the
  earlier conversations. Label them as questions, not as defects.

Do not propose redesigns unless the user asks. Map, check and question.

---

## 3. How to go about it

- Start with `concepts.md`, `STATUS.md` **Decisions to trust**, and `navigation.md`
  §1. Then read `vera-data.js` top to bottom. It is the fastest way to see the
  whole model as it is built.
- The page scripts are long. Read their header comments first; each one states
  the page's decisions. Go into the code for the details you need, such as
  `can(…)` checks and links.
- It is fine to use subagents for reading, but they are bound by §0 too, so
  give them this brief.
- Present the diagrams one area at a time, and ask the user whether to continue
  before moving to the next area.
