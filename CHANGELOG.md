# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added

- Digitization Lists, browse: the lists beside the chosen one, Planned and running by default
  with Done and Everything behind *Show*, each row with its state, run, items, pages and how
  much is delivered, and a line for what needs a look (past its end and not marked Done,
  blocked since listing, review needed after scanning, empty). The pane says where the list
  stands, planned against delivered, what is on it with each item's status and flag, and its
  history; whoever builds lists sees how much is ready to list.
- Digitization Lists, building a list: *New list* and *Edit* open one editor, the list on top
  (name, starts now or on a day, ends, pages against a target) and two panes under it, what is
  on it and what is ready to list. Rows are picked by their checkbox (Shift for a range) and
  moved one at a time or together; the pool filters by category and search and says what
  review still holds back. Everything is a draft until Save, counted as +N −M; taking one off
  returns it to Ready with no reason, and leaving with changes asks first. Saving goes back to
  the list.
- Digitization Lists, *Generate…*: where a list generator is configured, the editor's left
  pane offers it. Give the pages, and optionally the categories; with several generators, pick
  one, each marked rule-based or AI-based. The preview shows the picks and a report (pages
  against those asked, the tolerance, what was re-spread, and which categories are short and
  why); taking it puts the picks on the list, each marked *generated* with its reason, keeps
  what was there, and leaves the report on top. Nothing is saved until Save, which records
  what it was generated with.
- Documents Validations groups its list by category or by defect.
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
- Proposals filters by the day it was asked for: *Advanced…* sets *Asked* as a range of days,
  matching a document when any of its asks falls within it, and a watchlist keeps it.
- The Documents Validations view: one row per item in the curator's category custody that a
  defect holds or a rule forbade, what needs review first, most urgent, longest waiting, each
  with why it is there (the defect verbatim or how many, what was already accepted, the denial,
  the rule, or *Found after digitization*). Review and Category on the bar, Defect, Priority,
  Project and *Waiting since* as further filters, watchlist tabs with *Review needed*, *Page
  counts* and *Denied in review* shared. Documents' *Resolve in Documents Validations* opens the
  item there.
- An item's pane in Documents Validations: a note on what holds it (the denial and over which
  defects, found after digitization, accepted, or the rule that forbade it), its facts, each
  outstanding defect with its internal text and what askers read, and a fix in place: *Enter
  page count…*, *Correct 260$c…* or *Relink…*. A fix runs the checks again; a defect they no
  longer find needs no verdict, and an item with nothing left says so where it was. A denied
  item shows its defects to fix, and the defects already accepted sit in their own card with
  who and when.
- Ruling on an item in Documents Validations: *Accept it* (or *Accept all n*) with an optional
  note, *Deny…* picking which defects are substantial with what every asker reads following the
  pick, and *Revoke* on the accepted defects, which returns the item to review. More ▾ holds
  *Reclassify* (an item moved outside the curator's custody is handed over) and *Cancel…* with
  its reason. Accepting makes an item Ready once every gate passes; a denial or a revocation
  takes a Ready item back.
- The *Forbidden* filter in Documents Validations shows what a rule forbade in the curator's
  custody, with what the rule said; nothing there acts on it, and *Message admins…* writes to
  those who may overrule it.

### Changed

- Filters have no *Advanced…* any more: Pages, Asked and Waiting since are added from
  "+ Add filter" like any other field, as a chip reading "any" that opens its range. A date
  offers *Last 7 days*, *Last 14 days*, *Last 30 days* or *This month*, which a saved watchlist
  keeps relative, or two days of your choice. Pages offers *Under 100*, *100–499*, *500–999*
  and *1,000 and more* before two numbers of your choice. Every screen size can edit a range,
  a phone in its filter sheet.
- A batch's header in Documents counts how far adding it got, each document once by the
  status its row shows: *4 awaiting a decision · 2 declined · 1 forbidden · 3 review needed ·
  12 being added · 3 could not be added · 28 added*. A batch just retried or just arrived no
  longer reads as all added, what a rule or a review holds no longer reads as being added, and
  the parts add up to the batch.
- A proposal not yet decided reads *Awaiting a decision* on its row, in Proposals and in its
  ask, as its batch's header does, instead of *Awaiting review*, which is easy to take for a
  review in Documents Validations.
- The mock API refuses with RFC 9457 Problem Details (`application/problem+json`), adding a
  stable `code` and, for a rejected body, the fields it got wrong. A refusal in a dialog now
  says the server's reason where the action has no words of its own for its code.
- Rechecking a document and entering its page count take the new `iteration.recheck`
  permission, which curators hold within their custody and administrators everywhere. The
  catalog link in Validations is the one the catalog adapter plugin gives, and absent when it
  gives none.
- Documents' *Restricted* filter is called *Forbidden*, and Documents Validations has the same
  Yes / No field in place of Forbidden among the review states, so "any" review now means every
  reviewable item and forbidden ones are one pick away.
- Documents Validations: one Defects card with outstanding, denied and accepted defects in
  sections. Nothing is corrected in VERA but the page count: the catalog record opens from the
  pane, and **Recheck**, beside Accept and Deny, reads it again and clears what was repaired.
  Entering a page count runs the checks again by itself. Accept offers a pick of which
  defects to accept when there is more than one, all ticked to begin with.
- Status badges read in words, such as *Review needed* and *Denied in review*, instead of
  the stored value.
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
- Bulk approve takes the whole batch on the server, however many it asked for, but what was
  unticked: its dialog loads the batch as it scrolls, lists rescans and items still being
  checked in place as left out, fills the screen on a phone and says on its result what moved
  to Documents and what stays.

### Removed

- *Relink catalog record*, from Documents' More ▾ and from Validations: a document's catalog
  record never changes. A record repaired in the catalog is picked up when the checks run
  again.
- **Breaking:** `iteration.edit_descriptive`, and with it editing descriptive metadata in VERA:
  it is repaired in the catalog. Staff no longer hold a grant for it.

## [0.1.0] - 2026-10-02

- Initialize the frontend workspace.
