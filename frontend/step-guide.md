# Step guide

How one step of `plan.md` is done. The steps from 1 on are done one at a
time in the main session, with no subagents (decided 2026-10-06: subagents
spent far more tokens than they saved). One session does exactly one step
(or one half of a step split by a *Session break* in `plan.md`), then
stops; the user compacts the conversation and asks for the next. So
every step starts from this repository and a compacted summary, and this page
is what it needs before it starts. The step's commits are listed in
`plan.md`.

---

## 1. Read first, in this order

1. **This guide**, then `continuation.md` (what exists, where, and how it is
   wired) and the step in `plan.md`.
2. **The parts the step uses**: their rows in `component-inventory.md` and
   their draft props in `component-interfaces.md`. The interfaces are
   sketches: follow their intent, not every field. Leave out what nothing
   needs yet, and say so in the commit or the module header.
3. **The design of the view**: its notebook demo
   (`docs/demos/notebook/<page>.html` and `docs/demos/shared/page-<page>.js`,
   with `vera.css`, `vera-ui.js`, `vera-data.js`), then the other tiers'
   demos for the same page.
4. **The decision records**: `docs/README.md` names them; read
   `entities/concepts.md`, `entities/status-model.md` and the ones the view
   touches (`view-catalog.md`, `page-composition.md`, `view-rules.md`, the
   entity docs). `docs/demos/STATUS.md` says which are current and which are
   behind.

**Which source wins**, when they disagree (STATUS.md § Which source wins):
what the user decided (dated *Decided* notes in the frontend docs, then
`rework.md`) → the docs marked current → the notebook demo → the docs marked
behind. `filtering.md` is a draft. The demos' filters are to be rethought, not
copied.

**Never:**
- read `app/`, `client/` or `webclient/` for design, or import from them;
- edit `docs/demos/*.html` (the originals) or the design docs, unless the step
  says so;
- add navigation groups, dividers or any other taxonomy nobody asked for;
- change the sidebar entries;
- push, or touch the user's own dev server (`.frontend.pid`, port 5173).

**When a decision is missing** — the demos and the docs do not say, or say
two things — do not invent one. Build what is certain, leave the rest behind
a `TODO(rrandiak): …` naming the question, and list it in your report.

---

## 2. Conventions

The coding conventions are Robert Randiak's (load the
`coding-conventions:conventions` skill; the frontend profile reads
`foundations`, `engineering`, `security`, `makefiles`, `frontend`,
`typescript`). Where the repository already decided otherwise, the repository
wins: **double quotes** (Biome is configured so), Vitest with jsdom, not
`bun test`.

What the code here looks like, so yours reads the same:
- a `//` header on every file: what it is, why, and the design doc it follows
  (`view-rules.md §5.2`, `component-interfaces.md §6.3`); comments say why,
  never what;
- `TODO(rrandiak): …` for deferred work, and `TODO(rrandiak): labels move to
  i18n.` in any file with user-facing strings (i18n is not wired yet);
- full names, `is`/`has`/`can` booleans, no boolean parameters, guard clauses
  with a blank line after them, braces on every block, `const` over `let`;
- vocabularies as `as const` arrays and zod enums; labels as
  `{ … } as const satisfies Record<Value, string>`;
- zod at the HTTP boundary (`src/api/`), pure derivations in `src/domain/`,
  views in `src/features/<view>/`, shared parts in `src/components/` and
  `src/hooks/`;
- no new dependency without a reason in the commit body; never a page-local
  array of data that bypasses the API.

---

## 3. Build on step 0

Step 0 extracted the shared machinery. Use it; extend it when a view needs
more, and do not fork a private copy.

| Need | Use |
|---|---|
| A list view's URL state | `ViewDefinition` (`src/lib/view-definition.ts`), declared in `src/features/<view>/<view>-view.ts`, read by `useViewUrlState` |
| Its filter bar | the definition's `fields` → `FilterBar` (`src/components/filters/filter-bar.tsx`); names of referenced records via `useReferenceLabels` |
| Saved filters | `WatchlistTabs`; a new view needs its value in `watchlistViewSchema` and a comparer in `src/api/watchlists.ts` |
| A list beside a pane | `MasterDetail` + `RecordList` (columns, card, why line, groups via `GroupHeader`) + `usePagedList` |
| The pane's states | `Pane` / `paneStateOf` / `Outcome` (`src/components/pane-state.tsx`) |
| The pane's content | `DetailCard`, `FactGrid`, `StatTiles`, `StatusNote`, `record-cards.tsx` |
| Header and pane actions | `ViewAction` + `ActionBar` (per-tier cap); `PageHeader actions` |
| Who may | `useCan()` / `can()` with a `ScopedRecord`; an action someone may not do is absent, never disabled |
| A dialog | `DialogShell`, `ConsequenceDialog`, `ReasonDialog`, `FormDialog` (`src/components/dialogs/`) |
| Doing something | `useActionMutation` → `ActionResult`; its `invalidates` lists every query the change shows in |
| The display tier | `useTier`, `valueForTier`; container queries for what the room decides |
| Counts in words | `plural`; dates with `formatDay` |

A second use of something view-bound is the time to move it into a shared
part; a third is too late (rule of three).

---

## 4. One commit at a time

Each sub-item of the step in `plan.md` is one commit, in the order given.

1. **Mock API first.** A new resource gets its zod contract in `src/api/`, its
   fixtures in `src/mocks/fixtures/` (coherent with the existing ones: the
   demo's "today" is 2026-06-25, the same people, categories and documents),
   its handlers in `src/mocks/` and tests over HTTP through MSW
   (`src/api/*.test.ts` show how), before any UI uses it. The mock applies
   reach and permissions as the server will; the client only hides.
2. **Then the UI**, composed from §3.
3. **Tests** for what has behaviour: domain derivations, API contracts,
   hooks (`renderHook` in a `MemoryRouter`). A bug fixed on the way gets a
   test that failed before.
4. **Checks**, from `frontend/`:
   ```sh
   bunx tsc -b
   bun run test
   F=$(git status --porcelain -uall . | grep -v '^ D\|^D ' | awk '{print $NF}' | sed 's|^frontend/||' | grep -E '\.(ts|tsx|css)$')
   bunx biome check --write $F   # only the changed files: vendored ui/ has known errors
   ```
   All three clean before committing.
5. **Screenshots.** Start the per-user servers once (`make dev-roles`, from
   the repository root: admin 5201, curator 5202, digitization 5203, staff
   5204, reader 5205) and shoot each changed page at 1440×900, 1700×950 and
   393×852 (and 1024×768 when the small tier matters), as the users the step
   is about. Look at every shot against the demo, and fix what is wrong before
   committing. A script for your scratchpad:
   ```sh
   cd <scratchpad> && bun init -y && bun add playwright@1.63.0
   ```
   ```ts
   // shoot.ts — bun shoot.ts <outDir> <url>…
   import { chromium } from "playwright";
   const [outDir, ...urls] = Bun.argv.slice(2);
   const sizes = [[1440, 900], [1700, 950], [393, 852]];
   const browser = await chromium.launch();
   for (const url of urls) {
     for (const [width, height] of sizes) {
       const page = await browser.newPage({ viewport: { width, height } });
       await page.goto(url, { waitUntil: "networkidle" });
       // Off the rail, or the sidebar opens over the page on hover.
       await page.mouse.move(width - 5, height - 5);
       await page.waitForTimeout(800);
       const name = `${new URL(url).port}_${url.replace(/^https?:\/\/[^/]+\//, "").replace(/[^a-z0-9]+/gi, "_")}_${width}`;
       await page.screenshot({ path: `${outDir}/${name}.png` });
       await page.close();
     }
   }
   await browser.close();
   ```
   Dialogs and flows: script the clicks (`getByRole`) and shoot each state,
   and run the action once for real to see it reach the mock and come back.
6. **Records.**
   - `continuation.md`: what now exists and where, in its present-tense
     style, every commit.
   - `../CHANGELOG.md` `[Unreleased]`: what a user can now do or sees
     differently, in their words. A refactor with nothing to see adds no
     entry.
   - `plan.md`: when the step's last commit lands, mark the step done.
7. **Commit** on the current branch. Conventional Commits, imperative, a body
   that says why. No `Co-Authored-By` or "Generated with" lines.

---

## 5. Report back

End with a short report to the user, then stop: do not start the next step,
however small, until the user has compacted and asked for it. The report is
what survives the compaction, so it names everything the next step needs:
- the commits (hash and subject);
- what was built, and anything in the plan left out, with why;
- decisions you had to take, and questions only the user can answer;
- shared parts added or extended, so the next steps know;
- the checks run and their result, and where the screenshots are.
