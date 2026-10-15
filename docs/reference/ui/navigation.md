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

While any run is going, the sidebar foot shows what is running, with a link to Tasks.

#### UI-user-menu

The user menu sits at the foot of the sidebar. It holds:
- the person's name;
- *Account & access*, which shows their roles and what they reach;
- *Preferences*;
- the appearance: light, dark or system;
- *Log out*.

#### UI-record-links

A link from one page to a record on another lands on that record, opened. The URL names it:
- `?id=` on list pages;
- `?i=` for a plugin instance and `?impl=` for an implementation;
- `?run=` on Tasks;
- `?s=` on Schedules.

A filter, a grouping and an open watchlist are in the URL too, so a link reproduces the view.

#### UI-stale-link

A link with unknown or malformed values still opens the page: what cannot be read is dropped.
