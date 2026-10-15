# DEC-0006: VERA does not fix records

**Context.** A defect in a catalog record could be fixed in a form in VERA. VERA would then hold
a second copy of the record, and the catalog would stay wrong.

**Decision.** VERA finds defects and never edits the record. A defect links to the catalog,
where it is repaired, and *Recheck* reads the record again. The one value entered in VERA is a
counted page count, and entering it reruns the checks.

**Rejected.** Edit forms for catalog fields in VERA.

**Rules.** [DOC-manual-page-count](../reference/model/documents.md#doc-manual-page-count),
[PLG-no-fixing](../reference/integrations/plugins.md#plg-no-fixing).
