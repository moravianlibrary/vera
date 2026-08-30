# Proposals

Proposals represent requests to digitize a document. They can originate from VERA itself (manual submission) or from a plugin (automated harvesting).

## Core Concepts

- **Batch**: A group of proposals submitted together, sharing metadata (project, justification, priority)
- **Eligibility**: Automatic check against catalog and existing digitization records
- **Source**: Either `VERA` (app) or a plugin name (e.g. `CatalogHarvester`)

## Roles

| Role | Can do |
|------|--------|
| Requestor | Submit proposals, view own proposals |
| Reviewer | Approve/reject proposals, assign category & priority |
| Admin | All above + configure eligibility rules |

## Related Entities

- [[identifier-types]] — types of identifiers used in proposals
- [[document-lifecycle]] — what happens after a proposal is approved
- [[pipeline-overview]] — where proposals fit in the overall pipeline
