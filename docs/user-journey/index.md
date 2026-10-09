# User Journeys

Mermaid flowcharts showing what each role can see and do in VERA. Each journey starts
from login and follows the user through their typical workflows.

## How to read these

- **Blue rounded rectangles** — screens / views
- **Diamonds** — decisions / checks the system makes
- **Gray rectangles** — system actions (background processing)
- **Green rectangles** — user actions
- Arrows show the flow; side notes explain what permission gates each step

## Sidebar by role

Every entry is visible only if the user holds its required permission:

| Sidebar entry | Requires | reader | staff | curator | dig-curator | admin |
|---|---|:---:|:---:|:---:|:---:|:---:|
| Documents (My Documents for reader) | `request.read_own` or `iteration.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Proposals | `request.decide` | | | ✓ | ✓ | ✓ |
| Documents Validations | `validation.approve` | | | ✓ | ✓ | ✓ |
| Digitization Lists | `list.read` | | | | ✓ | ✓ |
| Projects | `project.read` | | | ✓ | ✓ | ✓ |
| Categories | `category.read` | | | ✓ | ✓ | ✓ |
| Intentions | `intention.read` | | | | ✓ | ✓ |
| Tasks | `task.read_own` or `task.read` | | | ✓ | ✓ | ✓ |
| Schedules | `task.read` | | | | | ✓ |
| Users & Groups | `access.read` | | | | | ✓ |
| Plugins | `plugin.read` | | | | | ✓ |
| Hooks | `hook.read` | | | | | ✓ |

## The journeys

| Role | File | What it covers |
|---|---|---|
| **Reader** | [reader.md](reader.md) | Propose items, see own documents, track requests (limited batch size) |
| **Staff** | [staff.md](staff.md) | Reader actions with a higher daily proposal limit |
| **Curator** | [curator.md](curator.md) | Review proposals, validate iterations, manage category custody |
| **Digitization Curator** | [digitization.md](digitization.md) | Plan and execute digitization lists, manage intentions |
| **Admin** | [admin.md](admin.md) | Manage users, roles, groups, custody, plugins, hooks, tasks |

## Common patterns across journeys

- **Self-scoped permissions** (`request.create`, `request.read_own`) give the same access
  to everyone who holds them — readers propose from "My Documents".
- **Proposal limits** — roles set a per-submission item limit and a per-user daily
  limit. Reader and staff roles set 10 per submission and 100/300 per day respectively. Curator,
  dig-curator and admin roles explicitly set both to `null` (unlimited).
- **Scope gates** (`@custody`, `@project`, `@managed`, `@any`) determine whether an
  action is visible on a specific record.
- **Provenance is visible** — every access screen shows "how" someone got their permissions
  (direct vs. via group, hand vs. mapped).
- **Empty sidebar = empty app** — a user with no role sees nothing.
