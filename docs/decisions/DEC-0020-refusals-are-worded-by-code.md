# DEC-0020: A refusal is worded by its code, in the person's language

> **Decided** on 2026-11-02.

**Context.** A refusal is RFC 9457 Problem Details with VERA's `code`
([ACT-refusal](../reference/access/acts.md#act-refusal)). The interface worded it by the action's
text for the code, else by the server's `detail`, else by a text for the status. Most of the
mock's refusals had no code of their own, so their English `detail` reached people using the
interface in Czech. The interface speaks Czech or English
([UI-language](../reference/ui/navigation.md#ui-language)).

**Decision.**
- **Every refusal carries a code**: its own (`list.done`), or its status's (`forbidden`,
  `not_found`, `conflict`, `invalid`, `rate_limited`) when the page needs nothing finer.
- **The interface words a refusal by its code alone**, from its messages, in the language in
  use; a code it has no words for takes the words for its status.
- **The server's `detail` is English** and is never shown: it is for logs, traces and
  developers. The codes carry no values to fill in.
- A 422's `errors` name the fields, each with a code, worded the same way.

**Rejected.**
- *The server answering in the person's language* (`Accept-Language`): every server, the engine
  and the Java backend, would keep a copy of the interface's messages.
- *Translating the server's English sentence in the client*: rewording a sentence on the server
  would silently break its translation.
- *Values in a refusal* (`{code, params}`): no refusal needs them yet; a code says enough.
