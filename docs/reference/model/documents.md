# Documents

How a document is identified, and the facts VERA keeps about it.

## Identity

#### DOC-identity

A document is identified by its **catalog ID**, plus a **unit** when it is one part of a larger
record. A unit is a volume name, a volume number or a barcode. Two asks for the same catalog ID
and unit are asks for the same document.

#### DOC-units

When a record has several units, an ask must name one. A barcode names its unit directly. A
record with a single unit needs none. An ask that names no unit of a record with several is
answered with the units to choose from.

#### DOC-identifiers

An item can be proposed by any of these identifiers. Each has a fixed format, checked before
anything is looked up:

| Type | Format |
|---|---|
| Catalog ID | `MZK01-000000001` (three or four letters, two digits, a hyphen, nine digits) |
| NBN | the national bibliography number (MARC 015); in Czech, the ČNB: `cnb` and nine digits |
| ISBN | `978` or `979` and ten to fourteen digits or hyphens |
| ISSN | `1234-567X` |
| Barcode | `MZK-2024-000001` |
| Shelf mark | the library's own; no common format |

What an identifier resolves to is the catalog's answer, through its catalog adapter.

The types are named internationally, and the UI names them as the library does: the NBN is
*ČNB* in Czech. The NBN is not a URN:NBN, the persistent identifier of a digital copy.

A **shelf mark** (*signatura*) says where the copy stands in the library. It is one string,
read from the catalog. Its format differs between libraries and even collections, so recognising
and resolving one is left to the library's plugins and their configuration.

> **Open — [L48](../../ledger.md#l48-shelf-mark).** Proposing by shelf mark is not built, and the
> code calls the field `signature`.

One VERA serves one library.

> **Open — [L21](../../ledger.md#l21-identifier-formats-per-installation).** The catalog ID,
> barcode and NBN formats are MZK's and fixed in the code. They are to come from the plugin
> configuration of each installation.

#### DOC-lines

A pasted list has one item per line: identifier, unit and reason, separated by `;`, a tab, or a
comma. A line starting with `#` is skipped. With a type chosen, every line is read as that
type; without one, each line's type is detected from its format.

## Properties

#### DOC-page-count

A page count can come from several sources, each with a tier:
- **manual**, entered in VERA (tier 100);
- the **catalog**;
- a **predictor** plugin.

The page count in use is the one from the highest tier that has a value. Every source stays
visible with when it was observed and who set it.

#### DOC-manual-page-count

A counted page count is the one value entered in VERA. Entering it runs the checks again
([ACT-page-count](../access/acts.md#iterations)). Every other fact is repaired in the catalog,
and VERA reads it again with *Recheck*.

*Why:* VERA does not fix records. A defect points to the catalog record, and a recheck reads
the repaired record.

> **Open — [L22](../../ledger.md#l22-properties).** Admin-defined, typed properties of a
> document or an attempt, entered by hand or by plugins, are decided but not built. The page
> count is the only property with sources and tiers; material type and the others are fixed
> fields.

## Existing copies

#### DOC-existing-copy

When a request is checked, VERA records every existing copy it finds:
- a registry that says the document is Digitized or Published;
- VERA's own earlier iteration that was scanned.

Approving over an existing copy is a **rescan**, which needs a note saying why
([ACT-approve](../access/acts.md#proposal-review)). A copy found after approval is a warning,
not a rescan.
