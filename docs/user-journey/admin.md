# Admin User Journey

The admin has full access to everything. They manage users, roles, groups, custody
assignments, plugins, hooks, schedules, and tasks.

**Holds**: all 60 permissions at `any`.

**Sidebar**: All entries — My Documents, Documents, Proposals, Documents Validations,
Digitization Lists, Projects, Categories, Intentions, Tasks, Schedules, Users & Groups,
Plugins, Hooks.

## Managing Users

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A(["Users & Groups"]) --> B["Show: People / Agents / No role yet"]:::st
    B --> C["Open user detail"]:::st

    C --> D["Set roles by hand"]:::user
    D --> E["Grant/remove roles"]:::user
    E --> F["Roles update:<br/>effective permissions,<br/>gains/loses shown"]:::sys

    C --> G["Add to groups"]:::user
    G --> H["Group custody &<br/>project membership added"]:::sys

    C --> I["Link identity"]:::user
    I --> J["Add another login method"]:::sys

    C --> K["Disable user"]:::user
    K --> L["Disabled — cannot log in"]:::sys

    class A,C,D,G,I,K user
```

- **`access.manage@any`** — manage all users, roles, groups, custody.
- A user's detail shows their roles with provenance: hand-set vs. mapped, and by which
  instance.
- **Provenance matters** — "staff — mapped by MZK Keycloak from group mzk-staff".

## Managing Roles

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A(["Users & Groups → Roles"]) --> B["Open role"]:::st
    B --> C["Edit grants"]:::user
    C --> D["Select permission + scope"]:::user
    D --> E["Save → see who is reached"]:::sys

    E --> F["Affected users:<br/>- Gains: new/wider permissions<br/>- Loses: permissions that disappeared"]:::sys

    class A,B,C,D user
```

- The role editor only offers valid permission/scope combinations from the catalog.
- `includedRolesOf()` shows which roles this one includes (narrower roles whose grants
  are fully covered).
- The "who is reached" panel shows every user holding this role, with what they gain
  and lose.

## Managing Groups

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A(["Users & Groups → Groups"]) --> B["Open group"]:::st
    B --> C["Add/remove members"]:::user
    C --> D["Consequence shown:<br/>- Custody: categories gained<br/>- Proposal custody: custodies gained<br/>- Project membership: projects gained"]:::sys

    B --> E["Edit category custody"]:::user
    E --> F["Assign categories to group"]:::user

    class A,B,C,E user
```

- A group's detail shows **what holding it confers** — custody, proposal custody, projects.
- This makes the consequence of adding someone visible at the moment of adding them.
- Groups carry **custody and project membership**, never roles.

## Managing Proposal Custody

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A(["Users & Groups → Custody"]) --> B["Open custody"]:::st
    B --> C["Add/remove users & groups"]:::user
    C --> D["See: open count,<br/>placed by (plugins)"]:::st

    B --> E["Delete custody"]:::user
    E --> F["Open proposals re-evaluated<br/>(moved to fallback if needed)"]:::sys

    class A,B,C,E user
```

- **Exactly one fallback**, always exists, cannot be deleted.
- Deleting a custody triggers a re-run over all open proposals.
- The fallback catches what no plugin named.

## Managing Identity Plugins

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A(["Plugins"]) --> B["Open Identity plugin"]:::st
    B --> C["Configure:<br/>- Label, order<br/>- User ID claim<br/>- Default role<br/>- Attribute mappings<br/>- Match by email"]:::user

    class A,B,C user
```

- **`plugin.configure@any`** — configure all plugins including Identity.
- Changes to mappings take effect at the next login, not immediately.
- A disabled instance disappears from the login page.

## Managing Custody Plugins

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A(["Plugins → Custody"]) --> B["Open Custody instance"]:::st
    B --> C["Edit jq rule"]:::user
    C --> D["Rule tested against proposal preview"]:::sys
    D --> E["Save → warning if unknown names"]:::sys
    E --> F["Run over open proposals"]:::user
    F --> G["All open proposals re-evaluated"]:::sys

    class A,B,C,E,F user
```

- A rule change triggers a re-run over all open proposals.
- Unknown custody names in a rule trigger a warning on the Plugins page.
- **`plugin.run@any`** — run custody re-evaluation manually.

## Managing Hooks and Schedules

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A(["Hooks"]) --> B["Open hook"]:::st
    B --> C["Configure: event filter,<br/>delivery channel, URL"]:::user
    C --> D["Send now / Retry / Discard"]:::user

    A --> E["Schedules"]:::st
    E --> F["Open schedule"]:::st
    F --> G["Edit, pause, delete,<br/>set retention"]:::user

    class A,B,C,E,F user
```

- **`hook.configure@any`** — configure hooks and act on deliveries.
- **`task.schedule@any`** — create, edit, pause, delete schedules.
- Hooks fire on events: `request.created`, `request.decided`, `iteration.ingested`, etc.

## Managing Tasks

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A(["Tasks"]) --> B["Open task/run"]:::st
    B --> C["Cancel run"]:::user
    B --> D["Rerun failed run"]:::user

    A --> E["Run a plugin now"]:::user
    E --> F["Task created → Running"]:::sys

    class A,B,C,D,E user
```

- **`task.read@any`** — see all tasks (including others' runs).
- **`task.cancel@any`** — cancel any run.
- **`task.read_own`** — self-scoped, see the tasks I started.
- **`task.cancel`** — on my own runs, I only need `task.read_own`.

## Admin overview

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A(["Admin actions"]) --> B["Users & Groups"]:::st
    A --> C["Plugins"]:::st
    A --> D["Hooks"]:::st
    A --> E["Tasks & Schedules"]:::st

    B --> F["Manage users, roles, groups,<br/>custody, identities"]:::user
    C --> G["Configure Identity, Custody,<br/>Catalog, Priority plugins"]:::user
    D --> H["Configure hooks, act on deliveries"]:::user
    E --> I["Schedule runs, manage retention,<br/>cancel/rerun tasks"]:::user

    class A,F,G,H,I user
```

The admin's day-to-day is primarily **Users & Groups** and **Plugins** — configuring the
identity system, managing role assignments, and maintaining custody plugin rules.