# Being told when something enters a watchlist

**Who.**
- Petr Dvořák (admin) shares a watchlist.
- Kateřina Novotná (curator) receives it.

**Goal.** "Tell the periodicals curators when an urgent item needs review."

**Starting state.** Kateřina has never opened the watchlist and has mail delivery off.

## Steps

1. **Petr** filters *Documents Validations* to *Review needed* and priority *Urgent*, and saves
   it as a system watchlist for the *Periodicals Curators* group.
   → It appears as a tab for every member who can open the page
   ([WATCH-audience](../../reference/integrations/watchlists.md#watch-audience)).
2. **Kateřina** switches on mail for it on *Watchlists*.
   → What matches now is a baseline: no burst of mail
   ([WATCH-delivery](../../reference/integrations/watchlists.md#watch-delivery)).
3. An urgent item enters review.
   → *Documents Validations* shows a badge of 1. Within the 15-minute window she gets one mail
   ([WATCH-mail-batch](../../reference/integrations/watchlists.md#watch-mail-batch)).
4. Another enters, and she opens the watchlist before the window closes.
   → The badge clears and no mail is sent for it
   ([WATCH-new](../../reference/integrations/watchlists.md#watch-new)).
5. **Petr** changes the filter.
   → Kateřina's delivery pauses until she confirms the new filter; she is told once
   ([WATCH-system-change](../../reference/integrations/watchlists.md#watch-system-change)).
6. **Kateřina** sets *Do not send notifications*.
   → No watchlist or hook mail reaches her; her choices are kept
   ([WATCH-do-not-send](../../reference/integrations/watchlists.md#watch-do-not-send)).

## Rules

[WATCH-personal-system](../../reference/integrations/watchlists.md#watch-personal-system) ·
[WATCH-badge](../../reference/integrations/watchlists.md#watch-badge) ·
[UI-badge](../../reference/ui/navigation.md#ui-badge)

## The engine needs

A clock it can move and a fake mail outbox that the test can read
([L35](../../ledger.md#l35-watchlist-engine)).
