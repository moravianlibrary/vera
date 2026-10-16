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
implementation of its own. An instance recognises one of the types below and no other: a
document stores its identifiers by these types. The predefined instances show on Plugins like
any other and can be edited, but not deleted:

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

The propose dialog checks a value as it is typed by the recogniser of its type's Pattern
instance. A type checked only by an implementation's own code, or with no instance enabled, has
no recogniser there: any value is taken when the type is chosen, and the catalog lookup checks it.

#### DOC-lines

A pasted list has one item per line: identifier, unit and reason, separated by `;`, a tab, or a
comma. A line starting with `#` is skipped. With a type chosen, every line is read as that
type; without one, each line's type is the first Identifier instance, in their order, that
recognises it. A type without a recogniser is read only when chosen.

## Properties

#### DOC-property

A **property** is a fact VERA keeps about a document or about one attempt, beyond what
identifies it. Only a holder of `property.define`, which accepts `any` and only `admin` is given,
defines one, on the *Properties* page under Administration. A definition has:
- a **key**, which never changes;
- a **name** in each UI language;
- a **visibility**, public or staff ([DOC-property-visibility](#doc-property-visibility));
- a **type** ([DOC-property-types](#doc-property-types));
- what it is **about**: the document, true whatever attempt is made (its size), or one
  **attempt**, held by that iteration as its category is (the machine chosen this time);
- whether it may be **entered by hand**, and the tier a hand value gets
  ([DOC-property-hand](#doc-property-hand)).

#### DOC-property-types

A property's type is one of:
- **text**;
- **number**, with a unit;
- **yes/no**;
- **date**;
- **enum**, each value with a name in each UI language;
- a **list** of any of these.

> **Open — [L64](../../ledger.md#l64-changing-a-propertys-type).** Whether a type may change once
> records hold values; the frontend keeps it.

#### DOC-property-values

Every value has a **source**: a person entering it by hand, or a plugin instance, the catalog
adapter included. Each value keeps its source's tier, when it was observed and who set it. The
value in use is the one from the highest tier that has a value, and every source stays visible.
A plugin instance's tier is set on the instance
([PLG-upgrade](../integrations/plugins.md#plg-upgrade)).

A changed value is logged with its source and both values. It fires
`document.property_changed` for a document property and `iteration.property_changed` for an
attempt property ([HOOK-events](../integrations/hooks.md#hook-events)).

#### DOC-property-hand

A property that may be entered by hand needs `property.<key>.edit`
([PERM-property-edit](../access/permissions.md#perm-property-edit)). The tier its definition
gives hand values decides whether a hand value outranks a plugin's.

A fact the catalog holds, such as the title, cannot be defined for hand entry; the page count
is the one exception ([DOC-manual-page-count](#doc-manual-page-count)). A value is entered on the
record pane, or in bulk on a selection in Documents. Entering one reruns the checks when a rule
reads that property. An attempt property's value cannot change once the attempt is scanned
(409).

*Why:* VERA does not fix records
([DEC-0006](../../decisions/DEC-0006-vera-does-not-fix-records.md)); hand entry is for facts the
catalog does not hold.

#### DOC-property-visibility

A **public** property is read wherever its record is, My Documents included. A **staff**
property is read only in staff detail, on Documents and the pages that need `iteration.read`
([VIEW-own-label](../access/views.md#view-own-label)). A property a person may not read is
absent, and cannot be filtered on
([PERM-absent-not-disabled](../access/permissions.md#perm-absent-not-disabled)).

#### DOC-property-filter

Each type gives its filter on every page that shows the property, saved watchlists included:
- text, what it contains;
- a number or a date, a range, as *Pages* and *Asked* are;
- an enum or yes/no, its values, each with how many records it finds
  ([UI-facets](../ui/pages.md#ui-facets));
- a list, any of its values.

Every property can also be filtered on having *no value*.

The record pane shows every property the person may read, with its sources. A property is a
column only where a page's view declares it.

#### DOC-property-delete

Deleting a definition removes its values, its permission from every role, and every filter,
watchlist filter and intention scope condition that names it. An intention that had a condition
on it counts more from then on ([PLAN-scope](../planning/intentions.md#plan-scope)). A system
watchlist whose filter loses a condition is refiltered: it pauses until each recipient confirms
([WATCH-system-change](../integrations/watchlists.md#watch-system-change)). A deleted key is never
defined again, as a removed rule ID is not reused.

#### DOC-page-count

The page count is a number property of the document. Its sources are:
- **manual**, entered in VERA (tier 100);
- the **catalog adapter**;
- a **predictor** plugin.

The one in use follows [DOC-property-values](#doc-property-values).

#### DOC-property-predefined

The page count, the material type, the shelf mark and the title are predefined definitions.
They can be edited but not deleted (409), as the predefined Identifier instances are
([DOC-identifiers](#doc-identifiers)).

*Why:* counting and generating read the page count, and the pages filter and search on the
others.

#### DOC-manual-page-count

A counted page count is entered in VERA, and entering it runs the checks again
([ACT-page-count](../access/acts.md#iterations)). A defect in any other fact the catalog holds
is repaired in the catalog, and VERA reads it again with *Recheck*.

*Why:* VERA does not fix records. A defect points to the catalog record, and a recheck reads
the repaired record.

## Existing copies

#### DOC-existing-copy

When a request is checked, VERA records every existing copy it finds:
- a registry that says the document is Digitized or Published;
- VERA's own earlier iteration that was scanned.

Approving over an existing copy is a **rescan**, which needs a note saying why
([ACT-approve](../access/acts.md#request-review)). A copy found after approval is a warning,
not a rescan.
