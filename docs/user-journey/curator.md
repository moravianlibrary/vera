# Curator User Journey

The curator is VERA's core operator. They review proposals, approve or decline them,
validate iterations, reclassify metadata, manage category custody, and decide on
projects.

**Holds**: staff grants + proposal decision and validation grants at custody scope,
category custody actions, and `project.decide@any`.

**Sidebar**: Documents, Proposals, Documents Validations, Projects,
Categories, Tasks.

**Proposal limit**: Unlimited because the shipped curator role explicitly sets its
per-submission limit to `null`.

**Daily limit**: Unlimited because the shipped curator role explicitly sets `null`.
`request.decide` itself does not bypass a role's numeric daily limit.

## Login → Proposals Review

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A(["Login"]) --> B["Home"]:::st
    B --> C["Proposals card:<br/>N waiting for your review"]:::st
    C --> D["Proposals view"]:::st
    D --> E{"Filter by custody?"}
    E -->|yes| F["See proposals in my custody"]:::st
    E -->|no| G["See all proposals I may see"]:::st

    F --> H["Proposal row: custody chip,<br/>requester, reason, existing copies"]:::st
    G --> H

    H --> I["Open proposal"]:::user
    I --> J{"Decision?"}

    J -->|Approve| K["Choose category + priority"]:::user
    K --> L["Approve → Approved"]:::sys
    L --> M["Iteration created → Enqueued"]:::sys

    J -->|Decline| N["Provide reason<br/>(public + internal)"]:::user
    N --> O["Decline → Denied"]:::sys

    J -->|Withdraw| P["Can only withdraw own"]:::st

    class A,B,C,D,H,I,K,N user
```

### Proposal custody check

```mermaid
flowchart LR
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    P["Proposal in Pending"] --> E["Custody plugins run"]
    E --> U["Union of custody names"]
    U --> R["Curator sees proposal if<br/>in that custody OR holds @any"]
    class P,R st
```

- **`request.decide@custody`** — resolves through proposal custody. A curator sees and
  decides proposals in custodies they are members of.
- **`request.decide@any`** — admin sees all proposals.
- A curator holding both `curator` and `admin` roles gets the wider scope.

## Approving with checks

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A["Propose with approve now"] --> B["Checks run automatically"]:::sys
    B --> C{"Existing copy found?"}
    C -->|no| D["Auto-approve"]:::sys
    C -->|yes| E["Held: copy exists"]:::sys

    A --> F["Curator decides manually"]:::user
    F --> G["Approve → Approved"]:::sys
    F --> H["Decline → Denied"]:::sys

    class A user
    class D,E,G,H sys
```

- **Approve now** is an intent the system applies after checks — shown only to someone
  holding `request.decide`.
- If checks find an existing copy, the request is held until a curator decides.
- A rescan (re-approving over existing copy) is `request.decide`, not a separate grant.

## Validating iterations

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A(["Documents Validations"]) --> B["Check results"]:::st
    B --> C{"Defects found?"}

    C -->|no| D["NotRequired — no defect"]:::st
    C -->|yes| E["Needed — review needed"]:::st

    E --> F["Open validation detail"]:::user
    F --> G{"Defect verdict?"}

    G -->|Accept| H["Approved"]:::sys
    G -->|Deny| I["Denied with reason"]:::sys
    G -->|Fix & Recheck| J["Edit metadata → recheck"]:::user
    J --> K["Defects cleared → NotRequired"]:::sys

    H --> L["Revoke?"]:::user
    L -->|yes| M["Back to Needed"]:::sys

    class A,E,F,G,H,I,J user
```

- **`validation.approve@custody`** — accept the outstanding defect set.
- **`validation.deny@custody`** — deny with reason (public + internal).
- **`validation.revoke@custody`** — take back an acceptance.
- **`iteration.recheck@custody`** — re-read from catalog, rerun checks.
- **`iteration.classify@custody`** — change category and priority.

## Managing categories

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A(["Categories"]) --> B["Open category detail"]:::st
    B --> C{"Action?"}

    C -->|Rename| D["Edit name"]:::user
    C -->|Reparent| E["Move to different parent"]:::user
    C -->|Refine| F["Split into sub-categories"]:::user
    C -->|Grant custody| G["Add users/groups to custody"]:::user

    D --> H["Changes stay within my subtree"]:::st
    G --> I["Delegation bounded by my grant"]:::st

    class B,C,D,E,F,G user
```

- **`category.edit@custody`** — at `custody`, moves stay within my own subtree.
- **`category.grant_custody@custody`** — at `custody`, means "within my own subtree".
- A curator holding Periodicals can bring someone onto Periodicals/Regional without admin.

## Managing project custody

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A(["Projects"]) --> B["Project card"]:::st
    B --> C{"State?"}

    C -->|Proposed| D["Approve (pick priority)"]:::user
    C -->|Proposed| E["Reject (provide reason)"]:::user

    D --> F["Approved — work can begin"]:::sys
    E --> G["Rejected — see reason"]:::sys

    class B,C,D,E user
```

- **`project.decide@any`** — approve or reject any Proposed project.
- A curator can decide projects even those in their own custody — project custody is
  about proposals, not projects.

## Restriction overruling

```mermaid
flowchart TD
    classDef st fill:#dbeafe,stroke:#2563eb
    classDef sys fill:#f1f5f9,stroke:#94a3b8
    classDef user fill:#dcfce7,stroke:#16a34a

    A["Iteration marked Forbidden"] --> B["Rule forbids digitization"]:::sys
    B --> C["Curator sees it in Validations"]:::st
    C --> D["Can they message admins?"]:::st
    D -->|no permission| E["No — message is hidden"]:::st
    D -->|has access.read| F["Message admins (no perm required)"]:::user
    C --> G["Overrule restriction?"]:::user
    G -->|yes| H["Overruled — work may continue"]:::sys

    class A,B user
```

- **`restriction.overrule@any`** — only at `any`, deliberately. A curator cannot quietly
  lift prohibitions inside their own subtree. This act requires someone outside it.
