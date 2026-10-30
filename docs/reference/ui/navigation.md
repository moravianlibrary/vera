# Navigation

The shell around every page. Which entries a person sees is in
[access/views](../access/views.md#the-sidebar).

#### UI-flat-sidebar

The sidebar is one flat list of entries in a fixed order, with no groups, dividers or headings,
and no counts of records.

*Why:* a taxonomy of the entries was tried (Work, Plan, Operate, Configure) and rejected: nobody
looks for a page by its group.

#### UI-badge

The only number on an entry is the count of its watchlists with something new
([WATCH-badge](../integrations/watchlists.md#watch-badge)).

#### UI-rail

On notebook and large, the sidebar is either expanded or collapsed to a rail of two-letter
marks. Hovering the rail opens it over the content for a moment. The choice is remembered per
device and per tier. Without one, large starts expanded and notebook collapsed. On small and
phone the sidebar is a sheet, always expanded.

#### UI-running

While any run is going, the sidebar foot shows what is running. Its heading links to Tasks; each
run opens its detail drawer over the current page. The same behavior applies to run links from
Schedules and Plugins. The current page remains behind the drawer, with `?run=` naming the open
run in its URL. A direct `/tasks?run=` link still opens that run on Tasks.

#### UI-user-menu

The user menu sits at the foot of the sidebar. It holds:
- the person's name;
- direct links to the four Preferences tabs: *Watchlists*, *Notifications*, *Display* and
  *Account*;
- *Appearance*: System, Light or Dark, the same choice as *Display*'s, which the menu applies at
  once and stays open for;
- *Log out*.

Preferences is one page with four addressable tabs at `/preferences/:section`.
*Display* holds appearance, language, density, dates and opening choices. *Account* shows
identities, roles and access. The user menu offers the same four destinations as the page.

#### UI-preferences

A person's preferences (the Display choices, the watchlists they last opened, their notification
choices) are theirs alone. They are kept on the server, apart from the user record, so they
follow the person to any browser they log in from, and nobody else reads or changes them. A
change sends only what changed; it is merged into what is kept, key by key, and leaves the other
preferences as they were. Only what a person may choose before logging in, such as the
appearance and the language on the login page, is kept in the browser until they log in; and the
sidebar's expanded or collapsed state stays with the device ([UI-rail](#ui-rail)), since one
person wants a different answer on a large monitor and on a notebook.

#### UI-language

The interface speaks Czech or English. On a person's first access it speaks the browser's
language, or English when the browser prefers neither. The login page lets them pick the other.
The language is the person's: their first login keeps the one in use, it is the same in any
browser they log in from, and they change it in Preferences → Display. A pick on the login page
replaces the language they hold.

#### UI-record-links

A link to a record opens it. Most go to that record's page; a run opens over the current page.
The URL names the selection:
- `?id=` on list pages;
- `?i=` for a plugin instance and `?impl=` for an implementation;
- `?run=` for a run drawer on the current page;
- `?s=` on Schedules.

A filter, a grouping and an open watchlist are in the URL too, so a link reproduces the view.

#### UI-stale-link

A link with unknown or malformed values still opens the page: what cannot be read is dropped.
