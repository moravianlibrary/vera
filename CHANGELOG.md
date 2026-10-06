# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added

- Frontend application shell: permission-driven sidebar that expands on hover when collapsed,
  page header and responsive master–detail layout.
- Documents view against an MSW mock API: search, quick fields and filter chips with facet
  counts in the URL, the status filtered by its stored dimensions, slice-by-slice loading,
  cards or table rows by the list's own width, grouping by batch or project, and watchlists
  as tabs.
- Shared watchlists: every staff member sees them, and only holders of the new
  `watchlist.manage_shared` permission create, change, rename or delete them. A watchlist is
  saved new from "+" and its changes are saved, or discarded, on its own tab.
- A filter is saved as one watchlist only: saving it again, as personal or shared, is
  refused with the name of the watchlist that holds it, and a personal watchlist is shared in
  place from its tab.
- The document detail as cards, following the demo: a toned note on what holds the record
  (such as Review needed with its outstanding defects), its facts, who asked, existing
  copies, defects, adding, digitization, earlier iterations, the catalog record and the
  history; a requester reads their own ask in public words.
- Propose: one dialog holding one list of items, typed, pasted or from a file, each checked
  against the catalog and VERA as it lands, then submitted as a request or, for several, one
  batch; a curator may approve the new ones at once.
- Proposal Review on the mock API: proposal custodies with members and the fallback, one row
  per document within the decider's custody, its filters with facet counts, grouping by batch
  or requester, and approve, approve as rescan, decline and bulk approve over every asker at
  once, written to the status log.
- The Proposals view: one row per document awaiting a decision with why it is there (a copy,
  checks still running, the project, the askers' reasons), Decision and Proposal custody on
  the bar and the other fields as chips, grouping by batch or by requester, watchlist tabs,
  and the proposal beside it as cards: who asked, where it was placed, existing copies, the
  catalog record and the history. Documents links a pending document straight to it.
- Deciding a proposal from its pane: approve with a category and a priority, pre-filled from
  the project when it came after the project's approval; approve as rescan with a note when a
  copy exists; or decline with what every asker is told and an internal note. One decision
  covers every asker.
- Bulk approve from a batch's header in Proposals: one category and priority for what the
  batch can take, each item untickable, with rescans and items still being checked listed as
  left out. New proposals from Propose show in Proposals at once.
- More ▾ in a document's pane: relink it to another catalog record (clearing a missing-record
  defect), reclassify its category and priority before it is scanned, warned when the new
  category hands it to another custody, and set or change where its scan is available, which
  makes it Published. Each is offered only to those whose grant reaches the document's
  category, and a refusal shows in the dialog.
- An administrator retries a batch's failed additions from its header in Documents grouped by
  batch: each goes back to being added, its attempt counted and logged.
- Documents filters by page count and by the day it was asked for: *Advanced…* sets either as a
  range with open ends (with *Last 7 days* and *This month*), a panel under the bar on a large
  screen and a dialog on a notebook; on a tablet the range shows as a chip that can be removed.
- On a phone the filter bar is the search and one *Filter* button counting what is set; it opens
  a sheet with every field's values and counts, Mine, the ranges and *Clear all*.
- *Message askers…* in a proposal's pane writes to everyone who asked for it, in the person's
  own mail or Slack: the dialog shows who it reaches, names who the chosen one cannot reach,
  and opens it pre-filled with the record and a link back. VERA keeps none of the text, and
  the action is absent when no Message plugin is enabled.

### Changed

- A view reopens on the watchlist tab, or "All", that the person last opened there,
  remembered per person and per view. In Proposals "All" now shows every
  decision, and a shared "Awaiting a decision" watchlist leaves out the declined and withdrawn.
- The remembered tab is kept with the person's settings on the server (`/session/settings`),
  so it follows them to another device; the mock server keeps those settings across reloads.
- The record docks beside the list from 768px, the whole small tier, as the tablet demo
  draws it; only the phone opens it as a sheet.

- Below 1280px the separate top bar is gone: ☰ sits before the page title and opens the
  sidebar, with the page's actions on the right of the same line. Nothing is fixed at the bottom
  of a phone screen.
- At the large tier (1600px and wider) the type steps back to 15px, as designed.
- Declining a proposal opens a dialog with what every asker is told and an internal note;
  closing it with text typed asks to discard first, and a refusal shows in the dialog with the
  text kept. On a phone a dialog fills the screen.
- A page shows at most three action buttons, two on the small tier and one on a phone; the rest
  are under "…", and an irreversible action is never the filled button on a phone.

- The page header no longer repeats the list's count under the title.

## [0.1.0] - 2026-10-02

- Initialize the frontend workspace.
