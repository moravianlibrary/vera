# Identifier Types

Identifiers are the primary way documents enter VERA. Each proposal contains one or more identifiers that resolve to catalog records.

## Supported Types

| Type | Format | Example | Resolution |
|------|--------|---------|------------|
| CNBID | `cnb\d{9}` | cnb002345678 | Czech National Bibliography |
| ISSN | `\d{4}-\d{3}[\dX]` | 1801-1234 | ISSN Portal |
| ISBN | `978-...` | 978-80-7325-456-3 | ISBN lookup |
| OCLC | `\d+` | 12345678 | WorldCat |

## Rules

- **An identifier is not an identity.** It resolves *to* a catalog ID, which is
  what names the document — see [[document-identity]]. Two identifiers of
  different types may resolve to the same record.
- Format validation is synchronous (a regex check, the same patterns rules 3–5
  of the [[view-rules]] §3 search table use).
- Resolution is asynchronous and happens during `progress = Enqueued`
  ([[status-model]] §2). A resolution that cannot complete is an ingest
  failure; one that completes and finds nothing is a *no catalog record*
  defect, fixed by relinking.
- A single document may carry more than one identifier.

> `TODO(Tenancy):` these four types are national or international registries and
> are institution-neutral. The **catalog ID and barcode** formats are not — those
> are MZK's, and live in [[view-rules]] §3 rules 2 and 6. Keep the distinction:
> what an identifier *is* generalises; what one library's own IDs look like does
> not.

> `TODO(Plugins):` **which plugin resolves which type.** The Resolution column
> above names a service, not a contract. Whether the type→plugin mapping is
> configuration or is claimed by the plugin itself is a question for the plugin
> model, together with `defect_key` ([[status-model]] §2).

## Related

- [[document-identity]] — what an identifier resolves to
- [[view-rules]] — §3, the search patterns these formats feed
- [[status-model]] — §2, where resolution happens
