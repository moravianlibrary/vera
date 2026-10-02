# Document Properties

Most of what a view shows about a document is not a column VERA authored. It is
a **typed property**, supplied by a plugin, and several plugins may supply the
same one with different answers.

This document decides what a property is, how competing answers resolve, and
what each type is allowed to do in a view. Page count is the worked example
throughout, because it is the property where being wrong is most expensive —
list generation is built on it.

---

## 1. Why properties are not columns

The archived system had `pageCountCatalog`, `pageCountPredicted` and
`pageCountManual` as three named columns plus a `pageCount()` method that picked
between them. That works for exactly as long as there are three sources.

The moment a fourth appears — another catalog, a better predictor, a
digitization operation reporting what it actually scanned — every layer needs a
new column and the resolver needs a new branch. So: **sources are rows, not
columns**, and the resolution rule is data.

---

## 2. Definition

```
property_definition
  key             text    — 'page_count', 'material_type', 'illustrators'
  type            enum    — int | float | text | enum | date | bool
  multivalued     bool    — an array of `type`
  label, unit             — presentation only
  enum_values     text[]  — type = enum only
  owner           text    — 'core', or the plugin that declares it
  searchable      bool    — may be a `scope:` key, §6
  default_visible bool    — offered as a column, §7
```

The five shapes asked for map to `type` × `multivalued`: `int`, `float`, `text`,
low-cardinality (`enum`), and arrays of any of them.

**`enum` is a distinct type, not text with few values.** It is the only type
that can be a checkbox facet, because facets need a closed, enumerable domain
([[view-rules]] §2). A `text` property with three values in practice is still
`text` — today's three values are not a guarantee.

---

## 3. Values, one row per source

```
document_property_value
  document_id
  property_key
  source          text    — plugin id, or 'manual'
  tier            int     — higher wins, §4
  value           jsonb   — typed per the definition
  observed_at     timestamptz
  UNIQUE (document_id, property_key, source)
```

On the **document**, not the iteration: page count, size and material type are
physical facts about the item and do not change between attempts
([[relationships]] §6).

Every source that answered keeps its answer. Nothing is overwritten by a
*competing* source, which is what makes §5 possible and what makes a mis-tiered
plugin recoverable by re-tiering rather than by re-harvesting.

**A source re-answering does overwrite itself**, though — the row is unique per
`(document, key, source)`, so when a catalog sync reports 430 pages where it
previously reported 412, the 412 is gone. That is right for the table, which
holds what is true now, and wrong to lose entirely: a document already on a list
whose page count moves by 18 has changed that list's capacity.

**So a changed value writes a status-log entry**, with the source, both values
and the time. The same place every other provenance question is answered
([[view-rules]] §4), and the same division [[registry-status]] §3 makes: current
state in the table, history in the log. This is the honest version of the
archived system's MARC-difference view — not a stored diff of every record, but
a log entry wherever a change actually moved a number VERA acts on.

---

## 4. Resolution: highest tier that has a value

```
effective(document, key) = the value with the greatest tier
                           among sources that supplied one
```

A plugin declares the tier it claims; a source that returns nothing is simply
absent and the next tier down answers. No fallback chain is coded anywhere —
the chain *is* the tier ordering, and re-ordering it is configuration.

**`manual` is the top tier, reserved.** A person who types a page count has
looked at the thing; no plugin outranks that. Two consequences worth stating
because they are easy to be surprised by:

- A manual value is **sticky**. Once set, no plugin can correct it, including a
  catalog that later gets better data. The view must therefore show that a value
  is manual, and clearing it must be as easy as setting it.
- A manual value is **attributed** — who typed it and when, in the [[status-log]]
  like any other state change ([[view-rules]] §5 rule 6).

Ties are a configuration error. Where one occurs anyway, the most recent
`observed_at` wins and the collision is logged rather than silently resolved.

> `TODO(Plugins):` **who assigns tiers.** A plugin declaring its own tier lets a
> badly-written one claim the top and outrank the catalog. Tiers being
> per-installation configuration is the safer answer and costs an admin screen.
> Settle with the rest of the plugin contract ([[status-model]] §2).

---

## 5. Every source stays visible

The resolved value is what the row shows. **The detail panel shows all of
them**, with source, tier and age:

```
Page count   412        ← catalog (tier 50), 2026-03-11
             400          predicted (tier 20), 2026-03-11
             412          manual — R. Randiak, 2026-04-02   ▲ in use
```

This is the archived *"display page count origin"* requirement, generalised.
It matters most when the numbers disagree: a curator seeing 412 has no way to
judge it without knowing whether it came from the catalog or from a model, and
a list built on predicted counts has a different error bar than one built on
catalogued counts.

### 5.1 Three ways to have no value

The same distinction [[registry-status]] §2 draws, for the same reason:

| Situation | Stored | Shown |
|---|---|---|
| no source was asked | no row | *—* |
| a source answered "unknown" | row with `value = null` | *unknown* |
| a source failed | row with `value = null` + error | *unavailable*, with when |

A page count that is **missing** and one that is **unknowable** lead to
different actions: the first is worth re-running a plugin for, the second needs
a human with the book.

---

## 6. What each type may do in a view

| Type | Facet | Range filter | Sort | `scope:` search |
|------|:-----:|:------------:|:----:|:---------------:|
| `enum` | ✅ checkbox | | ✅ | ✅ |
| `int` / `float` | | ✅ advanced | ✅ | ✅ |
| `date` | | ✅ advanced | ✅ | ✅ |
| `bool` | ✅ two-state | | | |
| `text` | | | ✅ | ✅ |
| **multivalued** any | ✅ *contains any* | | ❌ | ✅ |

**Multivalued properties are not sortable.** Sorting a set means picking a
representative — first, min, max — and every choice is arbitrary and invisible
to the person reading the sorted column. Filter by *contains*; do not sort.

`scope:` keys in the [[view-rules]] §3 search table are **property keys where
`searchable`**. That is what keeps rule 7 true — a view enables rules, it does
not invent patterns — while letting a plugin that adds `signature` make
`sig: NB2-1234` work without a change to the search table.

---

## 7. Properties do not get to add columns

A plugin may define fifty properties. A large table has twelve points
([[view-rules]] §1.1). These cannot both be free.

1. **`default_visible` is an offer, not a placement.** It makes a property
   available in the column picker and proposed for new views. Which columns a
   view actually shows stays a per-view, per-tier decision in its §6
   declaration, made against the budget.
2. **A new property never appears in an existing view by itself.** Installing a
   plugin must not silently change what a curator's table looks like, and it
   must never push a measured view over budget.
3. The **detail panel has no budget** and shows every readable property. That
   is what makes rule 2 affordable: nothing is hidden, only un-tabled.

---

## 8. Page count, end to end

| Source | Typical tier | Where it comes from |
|--------|:------------:|---------------------|
| `manual` | top, reserved | a person who looked |
| catalog adapter | high | a specific field of the catalog record |
| digitization report | high | what was actually scanned — only after the fact |
| predictor | low | a model over material type, year, format |

Two things this settles that were previously unowned:

- **List generation reads `effective(page_count)`** and nothing else, so the
  target-versus-actual arithmetic in [[view-map]] §5 has exactly one input.
- **A list whose capacity rests on predicted counts is a different object** from
  one resting on catalogued counts. Because §5 keeps every source, List Building
  can surface *"38% of this list's pages are predicted"* instead of presenting a
  number with a hidden error bar. That number is the reason this model is worth
  the extra table.

> **Open:** whether prediction is on by default. The archived system made it a
> configuration toggle, which is probably still right — a predicted count is
> better than no count for planning and worse than no count for a commitment.

---

## Related

- [[relationships]] — §6, why these live on the document
- [[view-rules]] — §1.1 the budget §7 protects, §2 facets, §3 search scope
- [[registry-status]] — the same source-and-freshness shape, for external systems
- [[document-identity]] — the properties that identify rather than describe
