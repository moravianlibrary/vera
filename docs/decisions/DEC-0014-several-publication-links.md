# DEC-0014: An iteration may be published in several places

**Context.** An iteration held one link, where its scan can be read. A scan from MZK is
read in the library's own Kramerius and also in the national aggregator (ČDK), and a
publication detector may find it in both. With one link, the second replaced the first, or was
lost.

**Decision.** An iteration holds a set of links, each with where it is (the Link or Publication
detector instance that made it canonical, or *web address*), who set it and when. One link is
**primary**: the first one set, until someone makes another primary. The first link makes the
iteration Published; it stays Published while it holds any link. A person adds, replaces,
removes and makes primary; the last link cannot be removed. A detector only adds, and never
removes or replaces a link a person set. The same canonical address is held once.

Wherever one link is shown or sent, it is the primary one: the record's *Open*, the requester's
notice, a hook's `link`. Every link shows on the record and goes in a hook's `links`.

**Rejected.**
- Keep one link and a free-text note listing the others: a detector cannot write a note and a
  hook cannot read it.
- Every link equal, with none primary: a notice to a requester has to pick one, and would pick
  by order of arrival.
- Removing the last link to unpublish: an iteration that was once readable is history; a wrong
  link is replaced, not taken away.

**Rules.** [LC-ITER-published](../reference/lifecycles/iteration.md#lc-iter-published),
[LC-ITER-links](../reference/lifecycles/iteration.md#lc-iter-links),
[ACT-publish](../reference/access/acts.md#iterations),
[HOOK-subject-data](../reference/integrations/hooks.md#hook-subject-data). Built
([L69](../ledger.md#confirmed-as-built-2026-11-13)).
