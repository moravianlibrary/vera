# Implementation plan

The rest of the client, one step per view, each step split into its commits.
The parts are those in `component-inventory.md` and their draft props in
`component-interfaces.md`. The design is `docs/demos/` and
`docs/design/shared/`.

How a step is carried out, and what to read for it, is `brief.md`: the one
file a session reads before it starts.

A step is one session. Steps 4, 6 and 7 are larger than one session's
work, so each is split at the lines marked *Session break*: in two sessions,
step 7 in three.
Step 6 builds on step 4's editor, and step 9 reuses step 7's set editor, so
those pairs keep their order.

**For every commit:**
- **Checks:** tsc, vitest, and Biome on the changed files only.
- **Screenshots:** Playwright at 1440×900, 1700×950 and 393×852.
- **Records:** update `CHANGELOG.md` [Unreleased]; at a step's end,
  `continuation.md` and `brief.md` §3.
- **Mock API:** a mock API comes with its tests over HTTP, before the UI that
  uses it.

Steps 0–2 rework two views that already work, so the existing tests stay
green after every extraction.

---

## 0. Foundation — done

1. `useViewUrlState` and `ViewDefinition`; Documents and Proposals move onto
   them.
2. `RecordList`, `GroupHeader`, `ListToolbar` and `usePagedList`; both lists
   move onto them.
3. `FilterBar` driven by field declarations, and `PaneState`.
4. Screen and header:
   - `useTier`, and `data-tier` on `<html>` with the 15px root at large;
   - the phone and small header: ☰ before the title, actions top right;
   - `ActionBar`, which applies the per-tier cap on primary buttons.
5. Dialogs and actions:
   - `DialogShell`, plus the Consequence, Reason and Form dialogs, full-screen
     on the phone;
   - `useActionMutation` and `useCan`;
   - Decline moves onto the Reason dialog.

## 1. Documents — done

1. The pane's *More ▾*: Relink, Reclassify, Set where it is available, each
   with its mock endpoint.
2. Retry a batch's failed additions from its group header.
3. The *Pages* and *Asked* advanced fields with the date-range field; the
   phone filter sheet.

## 2. Proposals — done

1. The shared Message dialog and *Message askers…*.
2. The *Asked* filter.
3. Bulk approve over the whole batch on the server, removing the 200 limit.

## 3. Documents Validations — done

1. Mock API: defects, verdicts, the custody scope.
2. The list: one row per iteration, with its why line.
3. The pane: defect cards, accepted defects, fixes in place.
4. Actions:
   - Accept, Deny… (with the defect pick), Revoke, Reclassify, Cancel;
   - the Forbidden filter, with *Message admins…*.

## 4. Digitization Lists — done

1. Mock API: lists, members, the pool of what is ready, derived state.
2. Browse as master–detail, with the pane.
3. Selectable rows, drafts and the two-pane editor for new and edit.

*Session break.*

4. Generate… (stepped), and its report.
5. Mark Done and Delete (consequence dialogs); per item, Cancel and Could not
   be digitized.

## 5. Projects — done

1. Mock API: periods, decisions, pace.
2. Card sections with PaceBars; the Ended and Rejected tables.
3. The detail page, with members and history.
4. New, Edit, Members, Approve, Reject, Delete.

## 6. Intentions — done

1. Mock API: the counting rules, and tracking another intention's mix.
2. The Targets and Tracking columns of cards, with PaceBars and MixBars.

*Session break.*

3. The editor (*Track* or *Own mix*), and repeats.
4. The correcting list, which hands its allocation to the Lists editor.

## 7. Categories — done

1. Mock API: the tree, shares, custody.
2. Tree + detail, with the Show picker and the intention picker (`?i=`).

*Session break.*

3. The definitions of 2026-10-07 (`docs/design/shared/entities/concepts.md`,
   *Category, mix, intention, project*), which steps 5–7 were built before:
   - a project's intention, made with the project; the target moves onto it,
     and Projects reads planned, delivered and pace from it;
   - an intention's Mix (`/intentions/:id/mix`), with the Proportions set
     editor; saving a shared mix lists the trackers, each with *Keep the old
     mix* (detach);
   - Categories drops *Mix of*: Overall's shares only, read-only, linking to
     its Mix.

*Session break.*

4. The Classifier: its mock plugin, and the suggested leaf with its reason on
   the decide form (Proposals).
5. Custody grants, Edit, New and Delete; the Refine wizard in the pane.

## 8. Tasks and Schedules — done

1. Mock API: runs and schedules.
2. Tasks: tiles, running cards, the finished-runs table and its drawer.
3. The sidebar's Running tasks panel.
4. Schedules: the timeline, the table, and the editor with Pause.

## 9. Users & Groups — done

1. Mock API: users, groups, roles, custodies, identities.
2. The linked columns and their records.
3. The role editor (set editor) and the member pickers.
4. Shared watchlists:
   - the audience (API change, with per-person rows);
   - *Share…*;
   - shared watchlists listed here.

## 10. Plugins

1. Mock API: types, implementations, instances.
2. The grouped table, with the implementation and instance drawers.
3. The instance editor; Disable and Delete, saying what stops; the upload
   wizard.

## 11. Hooks

1. Mock API: hooks, deliveries, channels.
2. Master–detail grouped by subject, with deliveries: Retry, Discard, Send now.
3. The hook editor and *Send a test*.

## 12. Home, Preferences and the shell

1. Home cards and the `/` redirect.
2. The user menu and the Watchlists popover.
3. Preferences: Watchlists, Display, Account.
4. Phone gestures: swipe between entries and between records, and Back.
