# Documents

Documents represent the core digitization records — each tracks a single bibliographic item through the digitization pipeline.

## Core Concepts

- **Validation**: Each document goes through validation checks before it can be approved
- **Iterations**: A document can have multiple digitization iterations (e.g. re-scan after quality rejection)
- **State**: Documents move through a lifecycle from Created → Validated → Approved → In Progress → Done

## Fields

| Field | Type | Description |
|-------|------|-------------|
| identifier | [[identifier-types]] | Primary identifier |
| status | enum | Current lifecycle state |
| project | ref | Associated project |
| category | ref | Assigned category |
| priority | 1-5 | Processing priority |
| validator | ref | Assigned validator user |

## Related

- [[document-lifecycle]] — full state machine
- [[pipeline-overview]] — how documents connect to proposals and additions
