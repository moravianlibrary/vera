# Propose documents

**Who.** A reader: Tomáš Marek, a researcher who logs in with eduID.

**Goal.** "I need these volumes digitized for my research."

**Starting state.**
- Tomáš has proposed nothing today.
- One of the items he will ask for is already being worked on for somebody else.
- One he asked for last month is still waiting.

## Steps

1. Tomáš opens VERA. He lands on *My Documents*, the only entry in his sidebar besides
   *Watchlists*.
   → No other page is offered ([VIEW-own-label](../../reference/access/views.md#view-own-label)).
2. He opens *Propose…* and types one catalog ID with a volume, and a reason.
   → The identifier's format is checked as he types
   ([DOC-identifiers](../../reference/model/documents.md#doc-identifiers)).
3. He switches to pasting a list of five lines, one of them a comment, one an ISSN without a
   volume.
   → Four items are read; the comment is skipped
   ([DOC-lines](../../reference/model/documents.md#doc-lines)). The ISSN asks which volume
   ([DOC-units](../../reference/model/documents.md#doc-units)).
4. He picks the volume and submits.
   → The report says how many were proposed, how many joined work already moving, and which were
   skipped because he had already asked for them
   ([LC-REQ-check](../../reference/lifecycles/request.md#lc-req-check),
   [LC-REQ-join](../../reference/lifecycles/request.md#lc-req-join)).
5. He tries to paste eleven items at once.
   → It is refused: at most ten at once
   ([ROLE-limits](../../reference/access/roles.md#role-limits)).
6. After his hundredth accepted item today, he tries once more.
   → *Daily proposal limit reached*, until tomorrow in the library's time zone
   ([ROLE-library-day](../../reference/access/roles.md#role-library-day)).

## Rules

[PERM-self-scoped](../../reference/access/permissions.md#perm-self-scoped) ·
[ACT-propose](../../reference/access/acts.md#proposing) ·
[LC-REQ-check](../../reference/lifecycles/request.md#lc-req-check) ·
[LC-REQ-join](../../reference/lifecycles/request.md#lc-req-join) ·
[ROLE-limits](../../reference/access/roles.md#role-limits)

## Not covered

What happens to the asks afterwards: [reader/follow](follow.md).
