# Agents

Where to look, what never to do, and how to change a rule. This file routes; it never states a
rule itself.

## Where a rule lives

| Question | File |
|---|---|
| What a thing is, what it holds | [model/entities](reference/model/entities.md), [model/documents](reference/model/documents.md) |
| How things connect, and what must not | [model/relationships](reference/model/relationships.md) |
| Status, gates, the badge | [model/status](reference/model/status.md) |
| What is logged | [model/log](reference/model/log.md) |
| States and transitions | [lifecycles/](reference/lifecycles/) |
| Categories, mixes, intentions, generating lists | [planning/](reference/planning/) |
| Who may do what | [access/permissions](reference/access/permissions.md), [scopes](reference/access/scopes.md), [roles](reference/access/roles.md) |
| Users, identities, groups, custody | [access/people](reference/access/people.md), [access/custody](reference/access/custody.md) |
| Which pages a person sees | [access/views](reference/access/views.md) |
| Every act: permission, when allowed, what it writes | [access/acts](reference/access/acts.md) |
| Plugins, registries, hooks, messages, watchlists | [integrations/](reference/integrations/) |
| Tiers, navigation, pages and their filters | [ui/](reference/ui/) |
| A term in Czech | [glossary](glossary.md) |
| Why it is so | [decisions/](decisions/README.md) |
| Whether it is built | [ledger](ledger.md) |

The [reference README](reference/README.md) gives the ID scheme and what is generated.

## Never

- State a rule outside the reference. Cite its ID instead: `// LC-LIST-done` in code, the ID in a
  test's name, a link in a document.
- Edit a generated table by hand. Run `make docs`.
- Edit `docs/demos/`, `docs/design/` or the other older material; they are sources, not targets.
- Cite the older material from new code or documents.
- Add a navigation group, divider or count nobody asked for
  ([DEC-0007](decisions/DEC-0007-flat-navigation.md)).
- Add a way to fix a catalog record in VERA
  ([DEC-0006](decisions/DEC-0006-vera-does-not-fix-records.md)).
- Reuse or renumber a removed ID.

## Changing a rule

1. Change the rule in the reference, or add one: a heading whose whole text is its ID.
2. If the code does not follow yet, add an entry to the [ledger](ledger.md) and an *Open* line
   under the rule linking to it.
3. Change the code, citing the ID; then move the ledger entry to *Done* and drop the *Open* line.
4. Run `make docs-check`. It fails on a stale table, an ID defined twice or cited but undefined,
   and a broken link or anchor.

A question only the user can answer goes in the ledger under *Open questions*, never decided
silently.
