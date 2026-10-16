# Give people the right roles, groups and custodies

**Who.** An administrator: Petr Dvořák.

**Goal.** "A new colleague joins the periodicals team, an external expert needs an account, and
we are reorganising who decides proposals."

**Starting state.**
- Adam Kolář logged in through local accounts and holds no role.
- Petr is the only person who can manage access.

## Steps

1. On *Users management* he finds Adam listed as having no access yet
   ([ACCESS-no-access-yet](../../reference/access/people.md#access-no-access-yet)).
2. He gives Adam the `staff` role by hand and adds him to *Periodicals Curators*.
   → Adam's record shows the role *by hand*, and the custody of *Periodicals* *via Periodicals
   Curators* ([ACCESS-provenance](../../reference/access/people.md#access-provenance)).
3. He creates a local account for an external expert with the `reader` role.
   → Allowed while local accounts are enabled
   ([ACCESS-local-account](../../reference/access/people.md#access-local-account)).
4. He links a Keycloak identity to an existing person.
   → One person, two ways in ([ACCESS-link-identity](../../reference/access/people.md#access-link-identity)).
5. He edits the `curator` role, adding a permission at a scope it does not take.
   → Refused ([PERM-accepted-scopes](../../reference/access/permissions.md#perm-accepted-scopes)).
6. He removes `access.manage` from the `admin` role.
   → Refused: nobody could manage access
   ([ACCESS-last-manager](../../reference/access/people.md#access-last-manager)).
7. He deletes the *19th-century prints* custody, after its impact: how many open proposals it
   holds and how many go to the fallback.
   → Its proposals are placed again, and Plugins shows that its rule places nothing until
   another custody is picked
   ([ACCESS-custody-delete](../../reference/access/custody.md#access-custody-delete)).
   **(engine: [L8](../../ledger.md#l8-placing-again-is-a-run))**
8. He tries to delete the fallback.
   → Refused ([ACCESS-fallback](../../reference/access/custody.md#access-fallback)).

## Rules

[ROLE-held-by-people](../../reference/access/roles.md#role-held-by-people) ·
[ACCESS-group](../../reference/access/people.md#access-group) ·
[ACT-role-save](../../reference/access/acts.md#users--groups) ·
[ACT-custody-delete](../../reference/access/acts.md#users--groups)
