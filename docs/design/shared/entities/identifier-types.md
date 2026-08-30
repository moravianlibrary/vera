# Identifier Types

Identifiers are the primary way documents enter VERA. Each proposal contains one or more identifiers that resolve to catalog records.

## Supported Types

| Type | Format | Example | Resolution |
|------|--------|---------|------------|
| CNBID | `cnb\d{9}` | cnb002345678 | Czech National Bibliography |
| ISSN | `\d{4}-\d{3}[\dX]` | 1801-1234 | ISSN Portal |
| ISBN | `978-...` | 978-80-7325-456-3 | ISBN lookup |
| OCLC | `\d+` | 12345678 | WorldCat |

## Validation Rules

- Format validation is synchronous (regex check)
- Catalog resolution is async (queued as eligibility check)
- A single document may have multiple identifiers (e.g. both CNBID and ISBN)
- Identifier type determines which catalog plugin is invoked for resolution

## Used By

- Proposals — identifiers are the input
- Documents — primary identifier is inherited from proposal
- Additions — identifier used for re-ingest matching
