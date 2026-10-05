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

## [0.1.0] - 2026-10-02

- Initialize the frontend workspace.
