# Watchlists and notifications

Saved filters, what is new in them, and how people are told. The acts are in
[acts](../access/acts.md#watchlists).

#### WATCH-model

A watchlist is a saved filter over one page: Documents, My Documents, Requests, Documents
Validations, Digitization Lists, Projects, Categories, Intentions or Tasks. Opening it shows
every record that matches now. Grouping is presentation and is never part of it.

#### WATCH-personal-system

A watchlist is either:
- **personal**, kept by the person who saved it;
- **system**, shared with everyone or with the members of some groups and the holders of some
  roles.

A holder of `watch` saves a personal one. Only `watchlist.manage_system` creates, changes or
removes a system one; it keeps who created it, but any holder of the permission maintains it.
Its holder reads every document ([PERM-requires](../access/permissions.md#perm-requires)), opens
both Documents views ([VIEW-own-label](../access/views.md#view-own-label)), and is offered every
filter value, those that match nothing yet included, since a system watchlist waits for what
comes later.

#### WATCH-audience

Every audience stops at who may open the page: being in a watchlist's audience never gives
access to the page or its records. Holders of `watchlist.manage_system` are always in every
system watchlist's audience.

#### WATCH-documents-perspectives

Documents and My Documents are separate pages for watchlists, with their own vocabularies. A
filter field of one cannot be saved on the other. A My Documents system watchlist runs against
each recipient's own requests.

#### WATCH-no-duplicates

A person cannot save a watchlist with the same filter on the same page as one they already see.
Two explicit copies are exceptions: a manager may publish a system copy of their own personal
watchlist, and a person may save a personal copy of a visible system watchlist. A second personal
copy of the same filter is refused. Copying leaves the source watchlist and its recipients intact.

#### WATCH-new

A record is **new** in a watchlist when it starts matching, since the person last opened that
watchlist. Leaving does not count; leaving and coming back is new again. Opening the watchlist
marks its entries seen; opening Preferences → Watchlists or receiving an email does not.

#### WATCH-badge

A sidebar entry's badge counts its watchlists with unseen entries, not records. A watchlist
with ten new records adds one. Badges cannot be switched off.

#### WATCH-delivery

Each person decides, per watchlist and per channel, whether to be told. The channels are browser
push and every enabled Delivery channel instance that can reach a person
([PLG-declares](plugins.md#plg-declares)): by the email on their account, or by their handle in a
chat, read from an identity claim. Each is named by its instance's name, *MZK SMTP* or *MZK
Slack*, even when it is the only one of its kind. A person the channel cannot reach, with no
such claim, is told so beside its switch.

Every channel but browser push is off until they switch it on. Browser push is on for every watchlist
they see, personal and system, once they allow the site's notifications in the browser; nothing
is pushed before that. They are told when a record **enters** the filter, not when one in it
changes. What matched when they switched it on is a baseline, not a burst.

The browser's permission is asked on Preferences → Watchlists, above the person's watchlists.
The person's choices for every visible personal or system watchlist are there; system definition
and audience management are on the separate System watchlists page
([VIEW-watchlists](../access/views.md#view-watchlists)).

#### WATCH-mail-batch

Watchlist mail is batched per person across all their watchlists, in a 15-minute window: at
most one email per window, grouped by watchlist, a record shown once. Entries the person opened
before the window closed are left out, and if none remain no mail is sent. Hook mail is never
bundled with it.

#### WATCH-push

A push names the watchlist and the records that entered it: the first three by name, the rest as
*+N more*. Pushes are batched per person and watchlist, in seconds: the batch is sent once
nothing new has entered for 5 seconds, and 30 seconds after its first record at most. Entries
the person opened before it is sent are left out, and if none remain nothing is pushed.
Clicking a push opens Preferences → Watchlists with that watchlist selected.

#### WATCH-system-change

When a system watchlist changes:

| Change | Subscriptions | Notice to subscribers |
|---|---|---|
| renamed | continue | none |
| filter changed | paused until each recipient confirms; current matches are a new baseline | the change, with a link to review |
| someone removed from the audience | stop for them, their settings kept | they lost access |
| someone added | push starts on, every other channel off | none |
| removed | stop | it was removed |

#### WATCH-hook-preferences

A hook addressed to users carries a preference with a label and a declared default. Each person
can switch such hooks off one by one, or all at once with *No hook email*
([WATCH-channel-off](#watch-channel-off)), on *Preferences → Notifications*. A hook added later
follows its own default.

#### WATCH-do-not-send

*Do not send notifications* stops every optional notification, hook mail and every watchlist
channel alike, and keeps the individual choices for when it is cleared.

#### WATCH-channel-off

Beside *Do not send notifications*, each person can switch one kind of notification off
everywhere, on *Preferences → Notifications*:
- for watchlists, each channel of [WATCH-delivery](#watch-delivery) by its name, browser push
  included;
- *No hook email*, since hooks reach people by email only
  ([HOOK-recipient](hooks.md#hook-recipient)).

Each stops its kind for every watchlist or hook, those that come later included, and keeps the
individual choices for when it is cleared. A watchlist or hook whose own switch is on says that
its kind is off for all. *Do not send notifications* still stops everything.

#### WATCH-manage-link

A hook email links to *Manage email notifications*. Logged in, it opens Preferences on that
hook. Without logging in, it opens a limited signed page that can only switch hook mail off, or
set *Do not send notifications*. It never changes another logged-in account.

> **Open — [L35](../../ledger.md#l35-watchlist-engine).** The frontend simulates membership,
> batching and outboxes in memory. The engine needs durable entry events, access checks at send
> time, a per-person window, signed-link verification and real transports.
