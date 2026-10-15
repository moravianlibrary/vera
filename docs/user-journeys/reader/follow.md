# Follow my asks

**Who.** A reader: Tomáš Marek.

**Goal.** "What happened to what I asked for, and when can I read it?"

**Starting state.** Tomáš has asks in several states:
- one waiting for review;
- one declined;
- one approved and on a running list;
- one published;
- one following work somebody else asked for first.

## Steps

1. Tomáš opens *My Documents*.
   → Each row shows the public status: *Waiting for review*, *Not accepted*, *Scheduled*,
   *Available*. The ask that follows other work shows that work's status, never *duplicate*
   ([STAT-public](../../reference/model/status.md#stat-public),
   [STAT-never-duplicate](../../reference/model/status.md#stat-never-duplicate)).
2. He opens the declined one.
   → He reads the public reason only. The history shows *Not accepted*, with no staff name and no
   internal note ([LOG-public](../../reference/model/log.md#log-public)).
3. He opens the published one.
   → The link to read it is there.
4. He filters by status *Available* and saves the filter as a watchlist.
   → A personal watchlist on *My Documents* appears as a tab
   ([WATCH-model](../../reference/integrations/watchlists.md#watch-model)).
5. Later, another of his asks is published. He returns to VERA.
   → *My Documents* in the sidebar carries a badge of 1. Opening the watchlist shows the new
   entry, and the badge clears ([WATCH-new](../../reference/integrations/watchlists.md#watch-new)).
6. He withdraws the ask still waiting for review. **(not built:
   [L14](../../ledger.md#l14-acts-not-built))**
   → It shows *Withdrawn*.

## Rules

[VIEW-documents-audience](../../reference/access/views.md#view-documents-audience) ·
[STAT-public](../../reference/model/status.md#stat-public) ·
[LOG-public](../../reference/model/log.md#log-public) ·
[ACT-withdraw](../../reference/access/acts.md#proposing) ·
[WATCH-new](../../reference/integrations/watchlists.md#watch-new)

## Not covered

Email when a watchlist has news: [cross-role/watchlist-news](../cross-role/watchlist-news.md).
