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

### Changed

- The page header no longer repeats the list's count under the title.

## [0.1.0] - 2026-10-02

- Initialize the frontend workspace.
