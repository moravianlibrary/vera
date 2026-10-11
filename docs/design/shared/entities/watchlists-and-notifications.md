# Watchlists and notifications

Decided 2026-10-10. This specification replaces the older Watchlists row and
Preferences → Watchlists designs in [[navigation]] §5 and [[filtering]] §4.3,
and the older rule that watchlists cannot send notifications in [[filtering]]
§4.4 and [[view-catalog]] Hooks. It describes intended behavior; the current
frontend mocks do not yet implement membership events or mail delivery.

## Watchlists as saved views

A watchlist is a saved filter on one source view. Opening it shows **all records
that currently match**, whether they matched yesterday or just now. An old
record becomes *new in the watchlist* when it starts matching; creating a new
record is not required. Leaving the filter does not count as news. A record
that leaves and later re-enters is a new entry again.

**Watchlists** is one page at `/watchlists`, last in the navbar after Hooks for
people who can see Hooks, and after their last available entry otherwise. It
replaces the planned Watchlists popover in the sidebar foot and Preferences →
Watchlists. The page is available to anyone who can use watchlists. The same
page has two sections:

| Section | Reader | `watchlist.manage_shared` holder |
|---|---|---|
| My watchlists | Their personal saved filters | Their personal saved filters |
| System watchlists | Those whose audience includes them and whose source view they may open | All system watchlists, including those outside their audience, with management actions |

Rows show source view, name, filter summary, current matching item count and
new item count. **Open** takes the person to that watchlist's tab in its source
view. Personal and system watchlists may be saved from the source view's filter
bar; filter editing happens there. The Watchlists page provides the overview,
per-person visibility, badge and notification controls. Managers can also edit
a system watchlist's audience or remove it there.

Personal watchlists are created by their user. A person with
`watchlist.manage_shared` may **Publish as system watchlist** from a current
filter or a personal watchlist. Publishing a personal watchlist creates a
separate system copy; the personal one remains. System watchlists retain
*created by* for history but are maintained by any holder of
`watchlist.manage_shared`. Their audience is everyone or a union of selected
groups and roles. Audience membership never grants access to the source view
or records. Users without management permission cannot publish system
watchlists. A system watchlist's per-person visibility, badge and notification
choices remain that person's own.

## New counts and seen state

Each watchlist tab shows how many matching records entered since **this person
last opened that watchlist**. Opening it clears that tab badge. Opening the
Watchlists overview or merely receiving an email does not mark it seen.

The **Watchlists navbar badge counts watchlists with unseen entries**, not
records, events or definition edits. A watchlist with ten new records adds one
to the navbar count. A person's hidden watchlists and those for which they
disabled the badge do not contribute. The page still shows the new item count
for those watchlists. Definition changes, such as a renamed filter, do not
increase this badge.

Seen state is per person and per watchlist. Sending an email never clears it.
If the person opens a watchlist before its queued email is sent, entries seen
there are removed from that watchlist's pending mail. Entries arriving after
the opening remain pending. Opening one watchlist does not clear another's
entries, even if both contain the same record. Already-sent mail cannot be
recalled and does not make a badge disappear.

## Mail and other external delivery

Watchlist delivery is configured by each recipient for each personal or
system watchlist and channel. It is off until the person enables it. The
initial event is **a record entering the saved filter**, not every change to
a record that remains in it. Existing matches when delivery is enabled are a
baseline, not a burst of individual messages. The watchlist itself always
shows all current matches. A changed record may be old in its source view but
new to the watchlist.

Watchlist emails use a **per-person batching window across all of that
person's watchlists**. Start with a 15-minute window; a daily digest can be a
separate preference. One window produces at most one watchlist email per
person. Group entries by watchlist and show a record once when it entered
several watchlists, naming each one. Delivery rechecks preferences, audience
and record access when it sends. Opening a watchlist before the window closes
suppresses that watchlist's already-seen pending entries; if none remain, no
email is sent. Hook emails have their own delivery rules and are **never
bundled with watchlist emails**.

Watchlist email has **Change notifications for this watchlist**, linking to
that watchlist on `/watchlists`. If login is needed, login returns to that
exact destination. It does not expose a separate email unsubscribe state:
the user's watchlist delivery choice is the source of truth.

## Changes to a system watchlist

Notification subscribers do not lock the definition. Management UI previews
how many recipients will be affected by changing its filter, audience or
removing it.

| Manager action | Effect on subscriptions | One-time notice to subscribers |
|---|---|---|
| Rename or description change | Continue | None |
| Change filter | Keep channel/frequency choices, pause delivery until each recipient reviews and confirms the new filter; rebuild current matches as a new baseline without entry alerts | Changed criteria and link to review |
| Remove someone from audience | Stop delivery immediately and retain their per-person settings in case access returns | Lost access and link to Watchlists overview |
| Add someone to audience | Newly eligible people start with delivery off | None |
| Remove watchlist | Stop delivery and remove it from lists and tabs; retain change and delivery history | Removal and link to Watchlists overview |

The one-time notice uses the channels that recipient had enabled for the
watchlist. People with delivery off receive no external notice. The global
**Do not send notifications** override also suppresses these notices. A
recipient who is no longer eligible is not sent record details in the notice.

## Processing model

Watchlist membership is computed **per watchlist**, not by taking periodic
snapshots of every source table for every user. A record change queues a
membership check for relevant watchlists. Entering creates a current entry
with an entry event; leaving removes current membership. The entry event feeds
both per-person unseen counts and eligible delivery queues. Processing and
delivery must be idempotent so retries do not duplicate emails. Relative date
filters also need checks at their time boundaries; periodic reconciliation
repairs missed events rather than serving as the main detection mechanism.

A system filter edit increments its definition version and rebuilds membership
as a baseline. Existing matches in that version are not new entries. Per-person
seen state and the pending-delivery cursor are separate; a mail send changes
only delivery state. This extends [[filtering]] §5's conceptual
`watchlist_entry` and `watchlist_viewer` records with entry events, definition
versions and per-person delivery state. The status log remains the audit trail
of record changes; a reliable change queue or outbox drives membership checks.

## Hook notification preferences

Hooks remain admin configured. Readers do not visit the Hooks page to manage
mail. A user-addressed Hook declares a stable preference ID, user-facing name,
and explicit default on/off value. A new Hook does not silently inherit an
implicit default. User choices override that declared default. Fixed-recipient
operational Hooks are outside individual preferences.

**Preferences → Notifications** lists the current user-addressed Hooks. The
person may disable one or several, disable all current Hook mails, or set
**Do not send notifications**. Disabling all current Hooks saves an individual
off choice for each existing Hook; a later Hook follows its declared default.
The global override suppresses all optional user notifications, including
future Hooks and enabled watchlist delivery, while preserving individual
choices for when it is cleared.

A Hook email's **Manage email notifications** link opens Preferences →
Notifications focused on that Hook when the recipient is logged in. Without
login it opens a limited signed preference page that can disable one, selected
or all current user-addressed Hooks, or set the global override. It cannot
edit the account or Hooks themselves. If another account is logged in, it must
not change that account's preferences. Both paths update the same preference
records.
