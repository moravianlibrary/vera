# Digitization Curator User Journey

The dig-curator plans and executes digitization: creating lists, running generators,
managing intentions and mixes, and coordinating the digitization workflow. They can
cancel and resume iterations across all categories.

**Holds**: curator grants + `list.*@any`, `intention.read@any`, `intention.edit@any`,
`project.*@any`, `iteration.cancel@any`, `iteration.resume@any`.

**Sidebar**: Documents, Proposals, Documents Validations,
Digitization Lists, Projects, Intentions, Categories, Tasks.

## Planning a digitization list

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A(["Digitization Lists"]) --> B["New list"]:::user
    B --> C["Fill: name, start/end dates,<br/>target pages"]:::user
    C --> D["Create → Planned"]:::sys

    B --> E["New list, starts now"]:::user
    E --> F["Create → InProgress"]:::sys

    D --> G["Generate a draft?<br/>(run generator with mix)"]:::user
    G --> H["Draft generated"]:::sys
    H --> I["Edit: add/remove items,<br/>mark done, could not digitize"]:::user

    F --> I

    class A,B,C,D,E,G,I user
```

- **`list.create@any`** — create lists, including running generators.
- **`list.edit@any`** — edit membership, dates, Mark Done, Could not be digitized.
- **`list.delete@any`** — delete lists, return items to pool.
- **`list.read@any`** — see all lists.

## Generating from intentions

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A["List generator"] --> B["Select intention"]:::user
    B --> C["Intentions determine:<br/>- What items to count<br/>- Distribution mix<br/>- Target pages"]:::sys
    C --> D["Generator runs<br/>(e.g., PriorityFirst 1.2.0)"]:::sys
    D --> E["Draft with allocations<br/>by category"]:::sys

    E --> F["Review & adjust"]:::user
    F --> G["Generate list"]:::user

    class A,B,F,G user
```

- **`intention.read@any`** — see all intentions.
- **`intention.edit@any`** — edit intentions, their mixes.

## Managing intentions and mixes

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A(["Intentions"]) --> B["Open intention"]:::st
    B --> C{"Mix type?"}

    C -->|Tracks owner| D["See tracked intention's mix"]:::st
    D --> E["Detach to own mix"]:::user
    E --> F["Owns its mix independently"]:::st

    C -->|Owns mix| G["Edit shares by category"]:::user
    G --> H["Save → mix updated,<br/>trackers see new shares"]:::sys

    B --> I["Edit: scope, project,<br/>target pages, repeat"]:::user

    class A,B,D,E,G,I user
```

- **Tracks vs. Owns** — an intention either tracks an owner's mix or owns its own.
- **Detaching** creates an independent mix that won't change when the tracked owner changes.
- **`intention.edit_overall@any`** — NOT held by dig-curator. Only admin can edit the
  Overall mix.

## Project management

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A(["Projects"]) --> B["All project actions"]:::st
    B --> C["Read, create, edit, manage members,<br/>approve, reject, delete"]:::st

    class A,B user
```

- **`project.*@any`** — all project permissions at `any`. A dig-curator can do everything
  with projects, including approve/reject.
- This makes dig-curators the primary project coordinators.

## Cancelling and resuming

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A["Any iteration"] --> B["Cancel"]:::user
    B --> C["Cancelled — with reason"]:::sys

    C --> D["Resume"]:::user
    D --> E["Back to active state"]:::sys

    A --> F["Could not be digitized"]:::user
    F --> G["NotDigitizable"]:::sys
    G --> H["Resume"]:::user
    H --> E

    class A,B,D,F,H user
```

- **`iteration.cancel@any`** — stop work on any iteration (not limited by custody).
- **`iteration.resume@any`** — restart a cancelled or NotDigitizable iteration.
- Cancel and resume are separately grantable — one can stop work without restarting.

## Digitization workflow overview

```mermaid
flowchart LR
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A["Approved request"]:::st --> B["Enqueued"]:::st
    B --> C["Ready"]:::st
    C --> D["Put on Planned list"]:::user
    D --> E["Planned"]:::st
    E --> F["List starts / Put on running"]:::user
    F --> G["InProgress"]:::st
    G --> H["Mark Done"]:::user
    H --> I["Digitized"]:::st
    I --> J["Set published link"]:::user
    J --> K["Published"]:::st

    class A,B,C,E,F,H,I,K st
    class D,G user
```

The dig-curator orchestrates this entire flow: putting iterations on lists, marking them
done, and publishing.
