# Users management — UI redesign

Status: implemented in the frontend mock-backed UI on 2026-10-10. This describes the replacement for the
linked-columns Users & Groups page at `/access`. The domain rules in [permissions](permissions.md),
[proposal custody](proposal-custody.md), [project membership](../../../access/project-membership.md),
and [groups](../../../access/groups.md) still apply. The
[notebook v2 demo](../../../demos/notebook/access.v2.html) illustrates the table-and-detail
direction, but this specification resolves differences between that demo and VERA's current model.

## Purpose and boundaries

Rename the navigation item and page heading **Users management**. Keep `/access` so existing links
continue to work. The page answers three questions:

1. Who is this person, what roles do they hold, and what can those roles do?
2. Which groups, proposal custodies, category branches, and projects reach them, and through which
   assignment?
3. Who can reach a proposal or category, and why?

This page has **no watchlist tabs or shared-watchlist records**. Shared watchlist creation, audience,
and management belong to Preferences → Watchlists. A role or group may still be used as a watchlist
audience there; that relationship does not appear in Users management.

The primary UI is searchable entity tables with inspectable details. The existing many-to-many
visualization becomes **Explore relationships** for one selected root, rather than a graph of the
whole access model.

## Navigation and layout

One route has four views: **Users · Roles · Groups · Custodies**. Users opens by default. The chosen
view, filters, and selected record are reflected in the URL. Changing views preserves each view's
own search/filter state during the visit; opening a deep link selects the named record even if it
would be hidden by the current filter. Existing `/access?u=`, `?r=`, `?g=`, and `?c=` links must
continue to open the corresponding records.

```text
Users management                                      New local user · New group
Users   Roles   Groups   Custodies

Search users…   Kind: any   Role: any   Group: any   Add filter

User                 Roles                Groups             Resource access
Alice Johnson        Curator              Periodicals Team   2 projects · 3 custodies
Bob Smith            Staff                —                  —
```

The table occupies the master pane; selecting a row opens a persistent detail pane beside the
list. On a phone, the same four views become horizontally scrollable tabs, the table becomes a
compact list, and the detail opens as a full-screen sheet. A direct URL opens that detail on both sizes.

Use the existing `PageHeader`, `FilterBar`, `DataTable`, `MasterDetail`, dialogs, badges, and permission
checks where they fit. There are **no saved filters** for this page. Search and filters remain
ordinary URL state. Tables load more rows as the master pane scrolls; there are no page controls
or page number in the URL. Do not render a global relationship graph or hundreds of user cards.

## Users: the default operational view

Columns: **User**, **Roles**, **Groups**, **Resource access**. The first column includes an agent
badge or sign-in identifier as appropriate. Access is a compact summary of project membership,
proposal custody, and category custody; it is not a claim that every membership gives a usable
permission. Empty values use a clear dash or *No resource access*.

Search by name, email, and sign-in identifier. Filters: people/agents/no role, role, group,
project membership, proposal custody, and category custody. Filters combine with search and each
other. Show a result count and progressively load matching rows on scroll. The user may reach a project or custody directly
or through a group; filters for those relationships use **effective membership** and the detail pane
shows its source.

The user detail pane contains these sections, in order:

| Section | What it shows | Edit location |
|---|---|---|
| Identity | Person or agent, email, linked identities and last login | Link an identity here; identity mappings on Plugins |
| Roles | Every role and every source: by hand or mapped by an Identity instance/claim | Hand assignments here; mapped assignments on the Identity instance |
| Groups | Direct group memberships | User/group member editor here |
| Proposal custody | Named custody sets and every direct/group source; whether the user's roles let them decide, see only, or do neither | Custody set membership here |
| Category custody | Assigned branch, inherited descendants, and each direct/group source | Link to the category's custody editor on Categories |
| Project membership | Each project as manager, direct member, or via each group | Link to that project's members editor on Projects |
| Effective permissions | Permission and scope, with every role that supplies it | Role editor |

If the same access comes from two sources, show **both**. Removing one assignment must not make
the other look removed. A role is never inherited through a group. A user with no role says *No
access yet* even if they are in groups or custodies. Distinguish **membership** from **capability**:
for example, a proposal custody member without a suitable `request.read` or `request.decide`
grant cannot act on its proposals.

## Roles

The Roles table shows role name, purpose, grant count, holder count, and whether VERA shipped it.
The detail pane shows permission/scope grants, proposal submission limits, hand-set holders, mapped
holders and their Identity sources, and an **Edit role** action. Keep the existing role-impact
check for deletion and the rule that access management cannot be left without a manager. A role
describes *what someone may do*; its detail does not imply access to a particular project or
custody unless that role's scope and the person's membership both match.

## Groups

The Groups table shows name, member count, proposal custodies, category branches, and projects.
The detail pane shows members and a prominent **Membership gives access to** summary. Below it, list
each proposal custody, category branch, and project the group carries, linking to the owning
resource. Editing a group's name and members remains here. Category assignments are edited on
Categories; project group membership is edited on the project. Group membership never grants a
role by itself.

## Custodies: manage the assignment sets

The Custodies view has **Proposal sets | Categories** tabs. Search and filters apply only to the
active tab. Proposal custody sets are the primary entities here; individual proposals are
reviewed on Proposals.

### Proposal sets

Show each named set, its direct members, member groups, the Custody plugin instances whose output
can name it, and its count of currently placed open proposals. Filter by direct/via group/no
members and by Custody plugin. The set detail shows every membership source and whether each
person's roles allow **decides**, **sees only**, or **no access**. It also shows recent open
proposals currently placed in that set as read-only output, with a link to the filtered Proposals
view.

Custody plugins return names of sets for each open proposal. VERA never assigns a person to an
individual proposal. Creating, editing, deleting, and changing the members of a named set happen
here. The fallback set is pinned, marked as such, and cannot be deleted. Which proposals appear
in a set is changed through Custody plugin rules on Plugins. One proposal may be in several sets.

### Categories

Show category path, direct people, member groups, and effective custodians. The detail pane separates
assignments **on this category** from custody **inherited from an ancestor** and expands groups
to explain who receives custody. Category custody applies to descendants. The edit action opens
the existing custody editor on Categories for the relevant node; Users management remains an
inspection and navigation surface for category assignments.

The resource tables need data beyond the current `/access` index: proposal rows and category
paths/effective custody must come from their existing resource APIs or dedicated read endpoints.
The UI should not infer proposal placement from a person's roles or fabricate a direct
proposal-to-user assignment.

## Project membership

VERA has multiple projects. Membership belongs to each project, so it is **not a fifth peer view**.
Users can be filtered by project, and both user and group detail panes show their projects. Each
project link opens its detail and members editor, which remains the source of truth for manager,
direct members, and member groups. In the user detail pane, show every route into the project, including
manager plus direct/group membership if several apply. Do not label every project as funded;
membership does not itself grant a role or project-scoped capability.

## Explore relationships

An **Explore relationships** action in a user, role, group, proposal, category, or custody-set
detail opens a graph rooted at that one record. Limit it to the selected record's immediate
neighborhood by default, with explicit expansion. Label edges **by hand**, **mapped**, **via
group**, **member of set**, or **inherited from category** as appropriate. The graph is read-only;
editing remains in the detail sections and owning resource editors. Return to details without
losing selection or filters.

## URL and behavior contract

- Keep `/access` and existing selected-record links. Add `view=users|roles|groups|custodies` only
  when needed; an absent value means Users.
- Custodies use `type=proposals|categories` (`proposals` means proposal custody sets and is the
  default). `?c=` opens a named set and `?category=` opens a category. A link to an individual
  proposal opens Proposals, not a separate Users management record.
- Search, filters, and selected resource are URL state. The loaded row count is transient. Opening another record does
  not reset the filter; switching tabs does not leave a stale detail pane open.
- Read-only users see the same provenance and links without edit actions. Mutations still follow
  `access.manage`, `category.grant_custody`, and `project.manage_members` checks at their owning
  surfaces.
- Empty, loading, no-match, and deleted-record states are explicit. If a deep-linked record is
  gone or inaccessible, say so rather than silently selecting the first user.

## Implementation sequence

1. Replace the linked-columns index with tabbed tables and the Users detail pane while preserving
   existing access mutations and old selected-record links.
2. Add Roles and Groups tables/detail panes, moving their existing editors into the new entry points.
3. Add proposal-set management, current placement output, and category links.
4. Add rooted relationship exploration, responsive layouts, scroll loading, and deep-link
   checks. Remove shared-watchlist records from this page; leave their management in Preferences.
5. Update navigation, `view-catalog.md`, `page-composition.md`, `filtering.md`, `frontend/brief.md`,
   and tests to describe the shipped UI rather than the former linked-columns design.

The underlying user, role, group, custody, category, and project models stay distinct. This
redesign changes how their relationships are found and explained; it does not require a new
combined access entity.
