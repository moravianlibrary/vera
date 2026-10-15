# Decide the proposals in my custody

**Who.** A curator: Kateřina Novotná, a member of the *Periodicals* proposal custody.

**Goal.** "Clear today's proposals: approve what we should scan, decline what we shouldn't."

**Starting state.** Open proposals in *Periodicals*, among them:
- one asked by two people;
- one with a copy already in Kramerius;
- one whose checks have not answered yet;
- a batch of several periodicals.

There are also open proposals in *Moravica*, which she is not a member of.

## Steps

1. Kateřina opens *Proposals*.
   → She sees the proposals in *Periodicals* and none from *Moravica*. Each row names its
   custodies ([VIEW-proposals](../../reference/access/views.md#view-proposals)).
2. She opens the one asked by two people and approves it into a leaf category, *Periodicals →
   Regional*, at *Normal* priority. The form opened on the classifier's suggestion.
   → Both asks are approved, and one iteration exists, originated by the older ask
   ([LC-REQ-one-iteration](../../reference/lifecycles/request.md#lc-req-one-iteration)).
3. She tries to approve the one still being checked.
   → Refused until the checks answer
   ([LC-REQ-checks-first](../../reference/lifecycles/request.md#lc-req-checks-first)).
4. She approves the one with a Kramerius copy.
   → She must say why it is scanned again
   ([DOC-existing-copy](../../reference/model/documents.md#doc-existing-copy)).
5. She declines one, with a public reason and an internal note.
   → Every asker reads the public reason; the note stays internal
   ([ACT-reason-two-texts](../../reference/access/acts.md#act-reason-two-texts)).
6. She groups by batch and approves the batch under one category, unticking one item.
   → All but the unticked one, any rescan and any unchecked one are approved; those left out are
   counted ([ACT-approve-batch](../../reference/access/acts.md#proposal-review)).
7. She opens a link to a *Moravica* proposal and tries to decide it.
   → Refused: it is outside her proposal custody
   ([ACT-out-of-reach](../../reference/access/acts.md#act-out-of-reach)).

## Rules

[ACCESS-proposal-custody](../../reference/access/custody.md#access-proposal-custody) ·
[ACCESS-one-decision](../../reference/access/custody.md#access-one-decision) ·
[ACT-approve](../../reference/access/acts.md#proposal-review) ·
[ACT-decline](../../reference/access/acts.md#proposal-review) ·
[ACCESS-custody-ends](../../reference/access/custody.md#access-custody-ends)

## Not covered

How proposals reach a custody: [cross-role/custody-routing](../cross-role/custody-routing.md).
