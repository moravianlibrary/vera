# DEC-0010: Messaging hands off to a plugin

Decided 2026-10-01.

**Context.** People need to reach each other about a record. A conversation channel inside VERA
would need threads, unread state, notifications and moderation, and nobody would read it: the
library already talks in mail and chat.

**Decision.** VERA resolves who to ask and about what. *Message…* hands that to a Message plugin,
which opens a pre-filled mail or chat. VERA keeps nothing of the text.

**Rejected.** A channel inside VERA.

**Rules.** [MSG-handoff](../reference/integrations/messaging.md#msg-handoff),
[MSG-keeps-nothing](../reference/integrations/messaging.md#msg-keeps-nothing).
