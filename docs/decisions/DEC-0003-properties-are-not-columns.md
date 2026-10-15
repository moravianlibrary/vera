# DEC-0003: Properties are plugin-supplied facts, not columns

**Context.** Facts about a document (page count, material type) come from several sources that
disagree: the catalog, a predictor, a person counting. A column holds one value and forgets
where it came from.

**Decision.** A property's values are kept per source, each with a tier. The highest tier with a
value is the one in use, and every source stays visible. A plugin supplies a property; it does
not add a column to a view.

**Rejected.** One column per fact, overwritten by whoever wrote last.

**Rules.** [DOC-page-count](../reference/model/documents.md#doc-page-count). Only the page count
works this way so far ([L22](../ledger.md#l22-properties)).
