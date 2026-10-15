# A project from its proposal to its items

**Who.**
- Kateřina Novotná (curator) starts and runs the project.
- Eva Horáková (staff) is a member and proposes into it.
- Petr Dvořák (admin) decides it.

**Goal.** "Our grant's documents get scanned at the priority the grant pays for."

**Starting state.** None of the documents has been asked for.

## Steps

1. **Kateřina** starts the project and adds Eva as a member.
2. **Eva** proposes ten items into the project.
   → They wait for the project's decision
   ([LC-REQ-project](../../reference/lifecycles/request.md#lc-req-project)).
3. One of them already has a copy in Kramerius.
4. **Petr** approves the project at *High* priority, reading the impact first: nine to approve,
   one skipped.
   → Nine are approved at High priority; the one with a copy waits for review as a rescan
   ([LC-PROJ-decide](../../reference/lifecycles/project.md#lc-proj-decide)).
5. The project's intention appears on *Intentions*, counting what the project funds over its
   dates ([LC-PROJ-own-intention](../../reference/lifecycles/project.md#lc-proj-own-intention)).
6. **Eva** proposes one more item after approval.
   → It is reviewed on *Requests*, marked as proposed after the project's approval.
7. **Kateřina** removes Eva from the project.
   → Eva's proposals stay in the project
   ([LC-PROJ-members](../../reference/lifecycles/project.md#lc-proj-members)).

## Alternative

4b. **Petr** rejects the project with a reason.
   → The project's pending asks are declined with that reason; its intention is archived.

## Rules

[ACT-project-approve](../../reference/access/acts.md#projects) ·
[ACT-project-reject](../../reference/access/acts.md#projects) ·
[REL-per-attempt](../../reference/model/relationships.md#rel-per-attempt)
