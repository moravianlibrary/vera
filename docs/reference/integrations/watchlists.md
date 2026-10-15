# Watchlists and notifications

Saved filters, what is new in them, and how people are told. The acts are in
[acts](../access/acts.md#watchlists).

#### WATCH-model

A watchlist is a saved filter over one page: Documents, My Documents, Proposals, Documents
Validations, Digitization Lists, Projects, Categories, Intentions or Tasks. Opening it shows
every record that matches now. Grouping is presentation and is never part of it.

#### WATCH-personal-system

A watchlist is either:
- **personal**, kept by the person who saved it;
- **system**, shared with everyone or with the members of some groups and the holders of some
  roles.

Anyone saves a personal one. Only `watchlist.manage_shared` creates, changes or removes a system
one; it keeps who created it, but any holder of the permission maintains it.

> **Open — [L45](../../ledger.md#l45-managing-system-watchlists).** The permission becomes
> `watchlist.manage_system`. It needs `iteration.read@any`, shows both Documents and My Documents,
> and lists filter values that match nothing yet.

#### WATCH-audience

Every audience stops at who may open the page: being in a watchlist's audience never gives
access to the page or its records. Holders of `watchlist.manage_shared` are always in every
system watchlist's audience.

#### WATCH-documents-perspectives

Documents and My Documents are separate pages for watchlists, with their own vocabularies. A
filter field of one cannot be saved on the other. A My Documents system watchlist runs against
each recipient's own requests.

#### WATCH-no-duplicates

A person cannot save a watchlist with the same filter on the same page as one they already see.
The one exception: a manager may publish a system copy of their own personal one.

#### WATCH-new

A record is **new** in a watchlist when it starts matching, since the person last opened that
watchlist. Leaving does not count; leaving and coming back is new again. Opening the watchlist
marks its entries seen; opening the Watchlists page or receiving an email does not.

#### WATCH-badge

A sidebar entry's badge counts its watchlists with unseen entries, not records. A watchlist
with ten new records adds one. Badges cannot be switched off.

#### WATCH-delivery

Each person decides, per watchlist and per channel (email, chat), whether to be told; it is off
until they switch it on. They are told when a record **enters** the filter, not when one in it
changes. What matched when they switched it on is a baseline, not a burst.

#### WATCH-mail-batch

Watchlist mail is batched per person across all their watchlists, in a 15-minute window: at
most one email per window, grouped by watchlist, a record shown once. Entries the person opened
before the window closed are left out, and if none remain no mail is sent. Hook mail is never
bundled with it.

#### WATCH-system-change

When a system watchlist changes:

| Change | Subscriptions | Notice to subscribers |
|---|---|---|
| renamed | continue | none |
| filter changed | paused until each recipient confirms; current matches are a new baseline | the change, with a link to review |
| someone removed from the audience | stop for them, their settings kept | they lost access |
| someone added | start off | none |
| removed | stop | it was removed |

#### WATCH-hook-preferences

A hook addressed to users carries a preference with a label and a declared default. Each person
can switch such hooks off one by one or all at once on *Preferences → Notifications*. A hook
added later follows its own default.

#### WATCH-do-not-send

*Do not send notifications* stops every optional notification, hook and watchlist mail alike,
and keeps the individual choices for when it is cleared.

#### WATCH-manage-link

A hook email links to *Manage email notifications*. Logged in, it opens Preferences on that
hook. Without logging in, it opens a limited signed page that can only switch hook mail off, or
set *Do not send notifications*. It never changes another logged-in account.

> **Open — [L35](../../ledger.md#l35-watchlist-engine).** The frontend simulates membership,
> batching and outboxes in memory. The engine needs durable entry events, access checks at send
> time, a per-person window, signed-link verification and real transports.
