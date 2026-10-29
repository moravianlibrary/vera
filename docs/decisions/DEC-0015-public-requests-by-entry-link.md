# DEC-0015: The public asks through entry links, with Google or Seznam

**Context.** Public digitization requests reach MZK through *Tlačítko digitalizovat*: a button and
form on a portal write to a Google Sheet, which a separate mini app reads. 1 307 requests since
2023, 45–80 a month in 2026, from 456 people, 95 % of them with a personal mailbox and no library
account ([prod-profile.md](../develop/prod-profile.md)). VERA takes this over.

**Decision.**
- An outside portal links into VERA with a fixed **entry link** that opens *Propose…* with the
  item and reason filled in. Nothing is submitted until the person confirms.
- Each portal is an instance of the `EntryLink` Input plugin. A submission that started from one
  keeps it as its **source**, so the use of each portal can be counted.
- The public logs in with **Google** or **Seznam**, as Identity instances whose default role is
  *reader*. A person signed out is sent to log in and comes back to the same entry link.

**Rejected.**
- Keep reading the Google Sheet: the sheet's rows carry an email, not an account, so the
  requester could not follow the request or be told the outcome.
- A request form open to anyone without logging in: no one to tell, no limit per person, and no
  *My documents*.
- Record how every item came in: one submission mixes ways in, and only the portal's use is
  wanted ([ENT-batch](../reference/model/entities.md#ent-batch)).

**Rules.** [ACT-entry-link](../reference/access/acts.md#act-entry-link),
[ENT-batch](../reference/model/entities.md#ent-batch),
[ACCESS-login-return](../reference/access/people.md#access-login-return). Not built
([L70](../ledger.md#l70-entry-links)).
