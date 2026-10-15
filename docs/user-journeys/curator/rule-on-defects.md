# Clear what holds my items in review

**Who.** A curator: Kateřina Novotná, with category custody of *Periodicals* and *Maps*.

**Goal.** "Get my items through validation so they can be scheduled."

**Starting state.** Items in *Periodicals* held in review:
- one with a missing page count;
- one with two catalog defects, one of them since repaired in the catalog;
- one forbidden by a copyright rule.

## Steps

1. Kateřina opens *Documents Validations*, grouped by defect.
   → She sees only items in her category custody
   ([VIEW-validations](../../reference/access/views.md#view-validations)).
2. On the missing page count she enters the counted pages.
   → The checks run again, the defect is gone, and the item moves to Ready
   ([ACT-page-count](../../reference/access/acts.md#iterations),
   [STAT-gates-move-progress](../../reference/model/status.md#stat-gates-move-progress)).
3. On the item with two defects she presses *Recheck*.
   → The repaired defect is no longer found; one is outstanding
   ([STAT-defect-key](../../reference/model/status.md#stat-defect-key)).
4. She accepts the remaining defect with a note.
   → Validation is Approved and the item moves to Ready
   ([ACT-accept](../../reference/access/acts.md#validation-verdicts)).
5. She changes her mind and revokes the acceptance.
   → It is back in review ([ACT-revoke](../../reference/access/acts.md#validation-verdicts)).
6. She denies it, with a public reason.
   → It shows *Validation denied*; its askers read the reason
   ([STAT-denial-lapses](../../reference/model/status.md#stat-denial-lapses)).
7. On the forbidden item she finds no verdict to give, and uses *Message…* to ask an
   administrator.
   → Her mail opens addressed to the holders of `restriction.overrule`
   ([MSG-recipients](../../reference/integrations/messaging.md#msg-recipients)).

## Rules

[STAT-validation](../../reference/model/status.md#stat-validation) ·
[STAT-gates](../../reference/model/status.md#stat-gates) ·
[ACT-deny](../../reference/access/acts.md#validation-verdicts) ·
[DOC-manual-page-count](../../reference/model/documents.md#doc-manual-page-count)

## Not covered

Overruling the restriction (admin, **not built**: [L14](../../ledger.md#l14-acts-not-built)).
