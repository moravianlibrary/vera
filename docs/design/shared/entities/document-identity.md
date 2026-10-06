# Document Identity

A document is identified by a **catalog ID** plus an **optional unit ID**.

| Part | Required | What it names |
|------|----------|---------------|
| catalog ID | yes | The bibliographic record — the title |
| unit ID | no | Which physical unit of that record this document is |

Two documents may share a catalog ID and differ only by unit ID. A document with
no unit ID *is* the whole record — a single-volume monograph, or a collection
treated as one item.

## Unit ID forms

The unit ID is one of three things, and which one it is matters for search:

| Form | Example | Shape |
|------|---------|-------|
| barcode | `MZK-2801-000341` | fixed, recognisable |
| volume number | `roč. 35`, `sv. 3` | semi-fixed, recognisable |
| volume name | `1918-1925`, `Jarní číslo` | **free text, not recognisable** |

**A volume name has no pattern.** This is the consequence worth planning for: a
user typing `1918-1925` cannot be routed to a unit-ID lookup by shape alone,
because that string is indistinguishable from a year range. Search therefore
resolves the first two forms exactly and lets the third fall through to text
matching over title + unit ID ([[view-rules]] §3, rules 6–7 and 9).

## Rules

- Catalog ID is immutable, and there is **no relink** (decided 2026-10-06). A
  record repaired in the catalog is picked up by a re-check. A record that no
  longer exists upstream cancels the document's work as *Record no longer
  exists* ([[status-model]] §2.5); the asker asks for the new record, which is
  a new document.
- Unit ID is set once at creation and only changed by `staff` or above, because
  changing it silently repoints physical work.
- `catalogId + unitId` is unique. Two documents for the same volume are a
  duplicate, and duplicate detection keys on exactly this pair.
- Where only one identifier fits the space, show the **unit ID**. Siblings in a
  list share a catalog ID, so the catalog ID is the part that does not tell them
  apart. Detail surfaces show both.
- A missing unit ID renders as nothing, never as `—`. Absence here is normal,
  not missing data.

## Where units come from

**The catalog enumerates them; a person picks one.** A catalog record for a
periodical knows its volumes and issues, so the catalog adapter — a plugin like
any other ([[document-properties]] §1) — is what lists them. VERA does not
invent units and does not ask a requester to type one.

| Issuance | What the requester picks |
|----------|--------------------------|
| standalone | nothing — the record *is* the document |
| volume / issue | one unit from the enumerated list |
| bundle | the bundle, which is one document covering several units |

**Documents are created on demand, not up front.** A periodical with 400
volumes does not become 400 rows the day it is catalogued; a row appears when
somebody asks for that volume or a plugin harvests it. The alternative fills the
corpus with rows nobody will ever act on, and makes every count meaningless.

Two consequences:

- **The unit list at proposal time is a catalog lookup, not a query over
  documents.** Most of what it offers does not exist in VERA yet, which is the
  normal case rather than an error.
- **Duplicate detection still keys on `catalogId + unitId`**, so picking from
  the catalog list is what makes [[status-model]] §2.7 work at all — two people
  choosing "volume 35" from the same enumeration produce the same pair, and the
  second is recognised as asking for work already under way.

> `TODO(Plugins):` **what a catalog adapter must return for a unit.** At minimum
> a stable unit ID and a label; whether it also supplies page count and
> issuance type — and therefore arrives pre-tiered per
> [[document-properties]] §4 — is part of the catalog adapter contract.

## Used By

- Documents — the identity of the record
- Proposals — a proposal carries **both**: the catalog ID and the unit chosen
  from the catalog's enumeration, or an explicit *the whole record* for a
  standalone item. It cannot wait for ingest — duplicate detection runs at
  proposal time and keys on the pair ([[status-model]] §2.7), so a proposal
  with no unit could not be recognised as asking for work already under way.
- Additions — re-ingest matches on `catalogId + unitId`
- Digitization lists — list entries reference the pair, not the title

## Related

- [[identifier-types]] — CNBID / ISSN / ISBN, which resolve *to* a catalog ID
- [[document-properties]] — everything about a document that is not its identity
- [[view-rules]] — §3 search, §1 which identifier survives at each size
