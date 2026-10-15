# Documents

How a document is identified, and the facts VERA keeps about it.

## Identity

#### DOC-identity

A document is identified by its **catalog ID**, plus a **unit** when it is one part of a larger
record. A unit is a volume name, a volume number or a barcode. Two asks for the same catalog ID
and unit are asks for the same document.

#### DOC-units

When a record has several units, an ask must name one. A barcode names its unit directly; a
shelf mark names one when the catalog puts it on a single unit. A
record with a single unit needs none. An ask that names no unit of a record with several is
answered with the units to choose from.

#### DOC-records

When the catalog gives several records for an identifier, a shelf mark or any other, the ask is
answered with the records to choose from. The person picks one or more, and each picked record
is its own ask by its catalog ID, checked as any other: its unit, whether VERA holds it, whether
it is theirs.

#### DOC-identifiers

An item can be proposed by any of these identifiers. Each type is an instance of an
**Identifier** plugin ([PLG-kinds](../integrations/plugins.md#plg-kinds)), which recognises a
value, checks it and normalises it before anything is looked up, and names the type in each
language.

VERA ships one Identifier implementation, **Pattern**, configured per instance with the type's
key, its label in each language, a regular expression, how a value is normalised (trimmed,
upper-cased, hyphens dropped) and an optional checksum (ISBN-10, ISBN-13, ISSN). One predefined
Pattern instance per type below is configured with MZK's formats. A library changes their
configuration and order, or adds an instance, such as a pattern for its shelf marks; only a
check a pattern cannot make, such as looking a shelf mark up in a local register, needs an
implementation of its own. The predefined instances show on Plugins like any other and can be
edited, but not deleted:

| Type | Format |
|---|---|
| Catalog ID | `MZK01-000000001` (three or four letters, two digits, a hyphen, nine digits) |
| NBN | the national bibliography number (MARC 015); in Czech, the ČNB: `cnb` and nine digits |
| ISBN | `978` or `979` and ten to fourteen digits or hyphens; ISBN-13 checksum |
| ISSN | `1234-567X`; ISSN checksum |
| Barcode | `MZK-2024-000001` |
| Shelf mark | the library's own; no common format, so no predefined recogniser |

What an identifier resolves to is the catalog's answer, through its catalog adapter.

The types are named internationally, and the UI names them as the library does: the NBN is
*ČNB* in Czech. The NBN is not a URN:NBN, the persistent identifier of a digital copy.

A **shelf mark** (*signatura*) says where the copy stands in the library. It is one string,
read from the catalog. Its format differs between libraries and even collections, so recognising
and resolving one is left to the library's plugins and their configuration.

One VERA serves one library.

> **Open — [L21](../../ledger.md#l21-identifier-plugins).** The types and their formats are
> MZK's and fixed in the code; the Identifier kind is not built.

#### DOC-lines

A pasted list has one item per line: identifier, unit and reason, separated by `;`, a tab, or a
comma. A line starting with `#` is skipped. With a type chosen, every line is read as that
type; without one, each line's type is the first Identifier instance, in their order, that
recognises it. A type without a recogniser is read only when chosen.

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
([ACT-approve](../access/acts.md#request-review)). A copy found after approval is a warning,
not a rescan.
