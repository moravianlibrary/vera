# Propose a batch for the reading room

**Who.** Library staff: Eva Horáková, reading-room staff, signed in through MZK Keycloak.

**Goal.** "Readers keep asking for these; I'll propose them in one go."

**Starting state.** Eva has proposed 250 accepted items today.

## Steps

1. Eva opens *My Documents* and *Propose…*, and pastes ten lines with a batch name and a reason.
   → They are proposed as one batch, which the deciders can see and approve together
   ([ENT-batch](../../reference/model/entities.md#ent-batch)).
2. She proposes forty more, ten at a time.
   → Near 300 she is warned that the daily limit is close; past it she is refused until tomorrow
   ([ROLE-limits](../../reference/access/roles.md#role-limits)).

## Rules

[ACT-propose](../../reference/access/acts.md#proposing) ·
[ROLE-limits](../../reference/access/roles.md#role-limits) ·
[ROLE-shipped](../../reference/access/roles.md#role-shipped)

## Not covered

Everything else is as for a reader: [reader/follow](../reader/follow.md).
