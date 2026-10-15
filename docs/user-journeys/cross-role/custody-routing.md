# A proposal reaching the right deciders

**Who.**
- Petr Dvořák (admin) configures the rules and custodies.
- Kateřina Novotná (curator) decides.

**Goal.** "Each proposal reaches the people who should decide it, and nothing falls through."

**Starting state.**
- A Custody rule that places periodicals in *Periodicals* and anything from 1800–1899 in
  *19th-century prints*.
- The fallback has Petr as its only member.

## Steps

1. A reader proposes an 1850s periodical.
   → It is in both *Periodicals* and *19th-century prints*; both sets of members see it, and the
   first decision decides ([ACCESS-one-decision](../../reference/access/custody.md#access-one-decision)).
2. A reader proposes a map no rule names.
   → It is in the fallback only, and Petr sees it marked *fallback*
   ([ACCESS-fallback](../../reference/access/custody.md#access-fallback)).
3. **Petr** adds a member to *19th-century prints* who holds no deciding role.
   → Users management says the member reaches nothing
   ([ACCESS-membership-not-capability](../../reference/access/custody.md#access-membership-not-capability)).
4. **Petr** renames *19th-century prints*.
   → The rule's old name no longer places proposals there until the rule is changed
   ([ACCESS-custody-rename](../../reference/access/custody.md#access-custody-rename)).
5. **Kateřina** approves the periodical.
   → From now on its category's custody decides everything about it
   ([ACCESS-custody-ends](../../reference/access/custody.md#access-custody-ends)).

## Rules

[ACCESS-custody-by-plugins](../../reference/access/custody.md#access-custody-by-plugins) ·
[ACCESS-custody-live](../../reference/access/custody.md#access-custody-live) ·
[SCOPE-custody-proposal](../../reference/access/scopes.md#scope-custody-proposal)
