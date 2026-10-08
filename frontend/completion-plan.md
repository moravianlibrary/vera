# Finish the original frontend implementation

Implementation handoff for the Sol agent, 2026-10-07.

## Objective and boundaries

Finish steps 11 and 12 of `plan.md`, then close verified functional gaps in
earlier steps. Deliver working React/TypeScript views with finished CSS,
responsive behavior and meaningful checks. This is the existing MSW-backed
frontend; connecting the real backend is a separate milestone.

The user wants the original implementation completed before the later visual
revision. Preserve the `.v2` demos as proposals for that revision: their filters,
Users/Permissions layout and Tasks master–detail change are deferred. Do not edit
demos or migrate those designs into the frontend during this plan.

Read `brief.md` first, then the current session below. Its conventions, source
precedence, commit/report workflow and prohibition on subagents apply. Do not
restart completed steps 0–10. Inspect code before acting on an old TODO: the
continuation guide and inventory have stale status entries. Use existing accepted
product decisions; identify unresolved product questions explicitly rather than
inventing behavior. Routine component and styling choices are implementation work.

## Stack and reuse contract

- React 19, TypeScript, React Router, TanStack Query, Tailwind v4 and the existing
  shadcn components in `src/components/ui/`. Forms use React Hook Form and Zod;
  API schemas use Zod, mock requests use MSW.
- Start from `brief.md` §3 and the actual component exports. Reuse or extend shared
  parts; do not copy a feature's dialog, table, filter bar or layout into a new one.
- Hooks: `MasterDetail`, `RecordList`, `GroupHeader`, `ListToolbar`, `Pane`,
  `DetailCard`, `FactGrid`, `HistoryCard`, `ActionBar`, `DataTable`,
  `useViewUrlState`, `useActionMutation` and the existing dialog family.
- Forms: `FormDialog`, `ReasonDialog`, `ConsequenceDialog`, `SteppedDialog`,
  `PickerDialog`, `SetEditorDialog`, existing field wrappers and shadcn inputs.
  Picker and set editor already exist.
- Preferences: existing watchlist API, query hooks, tabs, editors and audience
  controls; extend `api/user-settings.ts` and `use-user-settings-query.ts`.
  Do not introduce a second settings store or a second watchlist editor.
- Shell: extend `AppShell`, sidebar, `PageHeader`, `visibleNavigation` and existing
  session hooks. The Running tasks panel already exists.
- Build a missing shared composition only when required: likely SettingsPage,
  a small Home card-grid composition and a sparkline. Use the current primitives;
  a sparkline can be accessible SVG without another chart dependency.

## Finished CSS is part of every session

No temporary stylesheet, demo CSS import, per-page reset, placeholder skin or
“polish later” completion claim. Use `src/globals.css` tokens and established
Tailwind/component variants for colors, spacing, typography, radii and focus.
Keep feature layout classes near the component; change globals only for a shared
token or shared behavior. Avoid specificity patches and arbitrary new palettes.

Match the current application's visual language. Verify selected, hover, focus,
pending, empty, error, unavailable and success states, long names, dense content
and inline validation. Status must be understandable without color alone.
Dialogs keep dirty input on refusal, restore focus and have usable phone footers.
Pages must have intentional scrolling, no clipped controls or accidental page
horizontal overflow. Do not shrink type to make a layout fit.

Check 393×852, 1024×768, 1440×900 and 1700×950. Master–detail docks from 768px;
phone uses the existing sheet pattern. Review actual screenshots and fix defects
before closing the session. Respect reduced motion for gestures and transitions.
CSS is final for this implementation pass; the deferred redesign is independent.

## Session A — Hooks contracts and delivery behavior (11.1)

**Implemented 2026-10-07.** Typed API, fixtures, MSW handlers, timing and
delivery actions are in place. Publication and list creation emit public
events. The other event producers still need stable event codes and explicit
public payloads; status-log entries cannot supply them because their event
names are free text and their details may be internal. The mock accepts the
two conditions shown by the demo and rejects an unsupported condition with
`hook.filter_unsupported`. Define the general condition contract before
claiming arbitrary conditions work. Session B should use the API as built and
report these dependencies when wiring end-to-end examples.

Read `brief.md` §5 Hooks, STATUS's **Hooks** section (search by heading),
`entities/plugins.md` §4.12, `entities/messaging.md`, the Hooks permission row,
and `docs/demos/shared/page-hooks.js`. Demo state is reference, never app storage.

1. Define typed hook, subscription, channel reference, delivery, history and
   editor/test-preview contracts in `src/api/`; pure rules in `src/domain/`.
   Determine exact fields and endpoints from those sources and existing API style.
2. Add coherent fixtures and MSW handlers. Channels reference existing Delivery
   channel plugin instances, not another independent channel catalogue. Separate
   hook configuration/state from delivery state and preserve delivery history.
3. Implement read, create/edit, pause/resume/delete, retry/retry-all, discard,
   send-now, and preview/test operations wherever supported by the accepted design.
   Preview must not send. A test sends only on the explicit send action.
4. Model wait-after-last-event, maximum wait, batching, attempts/backoff and
   exhausted deliveries with deterministic mock time. The channel sends once;
   hook delivery logic owns retries. No real external delivery from MSW.
5. Enforce `hook.read`/`hook.configure` server-side; validate transitions and
   disabled/missing channels; use existing Problem Details conventions.
6. Integrate Plugins: linked hooks on a channel and accurate disable/delete impact.
   Resolve the existing plugin TODOs about affected hooks with real mock data.

Acceptance: HTTP tests cover permissions, invalid changes, retry/discard/send-now
transitions, batching timing, preview versus explicit test, and channel impacts.
No internal-only text or secrets leak into public delivery previews. Contracts and
mock rules are ready for the UI. Step 11 remains open until Session B finishes.

## Session B — Hooks UI with final styling (11.2–11.3)

**Implemented 2026-10-08.** `/hooks` now uses the Hooks index and existing
master–detail, filter, list, card and dialog parts. URL selection, channel and
state filters, delivery actions, editor, public preview and explicit test are
live. Four viewport layouts, the editor, failed-delivery detail and test flow
were reviewed in an isolated admin preview. The remaining typed public event
producers and general “Only when” condition contract are separate dependencies
recorded in Session A; neither is represented as arbitrary working behavior.

1. Replace `/hooks`' placeholder with grouped master–detail. Group by the event
   subject; show channel/recipient, event/filter, seven-day activity, state and
   failed-delivery attention. Keep selection in the URL and support deep links.
2. Detail order: exhausted deliveries, waiting deliveries, subscription, public
   message preview, delivery history. Implement Retry, Retry all, Discard and
   Send now using the API; destructive actions explain their consequences.
3. Implement New/Edit and applicable state actions with shared dialogs. Channel
   choice drives destination fields. Show validation and refusals beside the form.
   Test flow previews the entered configuration and explicitly sends a test without
   silently saving the editor. Preserve the draft on failure or returning from test.
4. Reuse existing filters if required by the original Hooks design; do not add a
   new preset-menu design. Invalidate related hook/channel queries after changes.
5. Complete keyboard selection, focus, loading/error/empty/gone states and phone
   layout. Verify channel links and Plugins' affected-hook links end to end.

Acceptance: exercise every action once against MSW; inspect screenshots of list,
detail, editor, failed deliveries and test flow. Mark step 11 done only after
contracts, behavior and CSS meet the common gates below.

## Session C — Home and user menu (12.1 and relevant 12.2)

Read `brief.md` §5 step 12, current Home decisions, `navigation.md` §7–8,
and the existing Home demo. Read navigation against the newer watchlist decision:
badges belong on destinations; management belongs in user options. Do not build
the obsolete standalone Watchlists sidebar row/popover mentioned in plan 12.2.

1. Home uses the same permission-derived destination list as navigation: zero
   destinations gives No access, one redirects, multiple show destination cards.
   Keep existing labels/reach and navigation order; no new analytics dashboard.
2. Reuse existing card parts where appropriate. Counts, if specified, come from
   typed server data with reach applied; do not count fixture arrays in a page.
3. Add the user menu using shadcn dropdown primitives. Wire Preferences and the
   accepted account/session actions; no visible controls with empty handlers.
4. Preserve destination badges and the Running tasks panel. Opening a destination
   alone must not clear watchlist notifications.

Acceptance: test zero/one/multiple destinations, direct routes and role changes;
verify menu keyboard behavior and all viewport sizes. Keep step 12 open.

## Session D — Preferences contracts and UI (12.3)

Read `component-inventory.md` **Not in the demos**, SettingsPage's interface,
identity/account rules, and the existing settings/watchlist API tests first.

1. Add `/preferences`, reachable through user options, without a sidebar entry.
   Make its active section addressable. Redirect `/watchlists` to Watchlists.
   Build the shared settings layout only if no suitable composition exists.
2. Watchlists: group by destination in navigation order. Reuse existing operations
   for opening, rename, editing filters, deleting, badge preference, reordering,
   shared visibility and unreachable entries. Shared entries preserve ownership
   and audience permissions. Provide keyboard-accessible reorder controls.
3. Display: extend the existing server settings record for the documented sidebar
   preference per tier, last-used/fixed starting tab, density and date format.
   Preserve existing last-opened watchlists and category-tree settings. Apply the
   choices to consumers, including reload and session changes; do not build inert
   switches. Establish defaults/fallbacks for missing or unreachable fixed tabs.
4. Account: read-only name and identities; local-password action only for a local
   identity; sign out of other sessions as specified. Add typed mock contracts and
   tests where absent. Keep mock identity/session limitations explicit; do not
   represent simulated authentication as production integration. Language and
   additional notification settings stay deferred unless already accepted.
5. User settings are scoped to the signed-in person. Keep unrelated settings when
   patching; invalidate/reset the appropriate cached session data on sign-out.

Acceptance: persistence through reload, isolation between users, server refusals,
shared/hidden/unreachable watchlists, accessible forms and final responsive CSS.
Document any genuinely unspecified account behavior instead of fabricating it.

## Session E — Phone gestures and original-plan closure (12.4)

Read `navigation.md` §3.1 and component interfaces §8.1. Implement shared behavior
in the existing shell/list/sheet compositions rather than feature-specific copies.

1. Page swipe moves through permitted destinations in order, without wrapping.
   Record swipe moves through the originating filtered/grouped list, loading more
   as needed. The selected row behind the sheet follows the displayed record.
2. Opening a record pushes history; movement within records replaces it. Back
   closes one topmost layer. Test direct-linked records separately so Back remains
   predictable. Header Back and header swipe-down follow the same close path.
3. Suspend page gestures under overlays. Exclude text fields, horizontally
   scrolling controls and system-edge Back regions. Dialogs do not take swipes;
   dirty forms use the existing leave guard. Preserve vertical scrolling.
4. Implement the specified threshold, neighbour feedback, cancellation and reduced
   motion behavior. Cover long-press picking where the accepted gesture spec
   requires it; keep keyboard/button equivalents available.

Acceptance: focused history/gesture tests and browser exercises for overlays,
dirty forms, ends of lists, pagination, denied routes and record deletion. Pointer
emulation cannot prove native device behavior; report any device verification
remaining. Mark step 12 done only after all its accepted work is complete.

## Session F — Verify and close earlier functional omissions

This is a bounded audit followed by implementation, not a mandate to implement
every historical TODO. Create `frontend/completion-gaps.md` with one row per gap:
source, current code evidence, accepted behavior, dependency, disposition and
verification. Distinguish already done/stale, actionable, superseded and blocked
by a specific unanswered product or backend/plugin contract question.

Start with these candidates from the current continuation guide and code headers:

- Documents: Ask for this too, Withdraw, Overrule restriction, Cancel/Resume;
  Adding retry/raw payload; digitization messaging and catalog links. Verify each
  against existing API and current action eligibility before extending shared acts.
- Propose: catalog search, record-link input, barcode/photo input dependencies,
  Batch field and missing reason rows; large-list rendering. Do not fake a scanner
  or invent an Input plugin contract. Separate available typed/file flows from
  genuinely unresolved plugin integration.
- Messaging: project subject/recipients and other accepted missing contexts,
  extending the shared MessageDialog and server resolver.
- Reach: document-card links currently flagged for broad permission checks; test
  actual custody/project scope and avoid links/actions outside the user's reach.
- Existing functional TODOs discovered while integrating Hooks and Preferences.
  Pure refactors and broad i18n migration are not automatic scope additions.

Implement confirmed, specified omissions in dependency order, in session-sized
batches, with the same API/UI/CSS gates. A true unresolved requirement stays
explicitly open with the exact question and affected feature; do not label it done.
Do not mark the whole original product complete merely because 11 and 12 are done.

## Checks and handoff after every session

- Run TypeScript (`bunx tsc -b`), Vitest (`bun run test`) and Biome on the changed
  TS/TSX/CSS files, as specified in `brief.md`. Run the production build at final
  integration. Add meaningful contract, derivation and interaction tests, not
  snapshots that merely repeat markup.
- Use isolated role preview servers per the brief. Do not touch the user's 5173
  server. Exercise relevant privileged, read-only and denied accounts.
- Inspect the screenshots at all four sizes; report artifact paths and which
  states were inspected. Resolve visible defects before marking the UI complete.
- Update CHANGELOG for user-visible work; `plan.md` step status only when earned;
  `continuation.md` with what now exists and any explicit outstanding work; and
  `brief.md` §3 for new shared components/contracts.
- During these updates remove stale claims about picker/set editor, Running tasks,
  the original foundation milestone and standalone Watchlists navigation. Link
  remaining gaps to the closure ledger, keeping the `.v2` redesign separately
  deferred. Do not rewrite unrelated design documents.
- Follow the brief's commit workflow, stage only the session's files, and leave
  untracked v2 demos alone. Report changes, checks, CSS review, remaining risks and
  the exact next-session prompt. Do not push.

## Starting prompt

```text
Read frontend/brief.md and frontend/completion-plan.md.
Implement Session C (Home and user menu, plan step 12.1 and relevant 12.2).
Reuse the existing React/TypeScript/shadcn architecture and shared components.
Follow the completion plan's scope and checks. Keep the .v2 redesign deferred.
Update the handoff documents and report the next session when finished.
```
