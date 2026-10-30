# Decisions

The larger choices behind VERA, each with the reason it was made and what was rejected. A
decision record keeps the *why*; the rules it led to are in the [reference](../reference/).

| ID | Decision |
|---|---|
| [DEC-0001](DEC-0001-status-is-four-axes.md) | A status is four stored axes and one derived badge |
| [DEC-0002](DEC-0002-a-tier-is-a-display.md) | A size tier is a display, not a column count |
| [DEC-0003](DEC-0003-properties-are-not-columns.md) | Properties are plugin-supplied facts, not columns (superseded by DEC-0013) |
| [DEC-0004](DEC-0004-log-causes-not-derivations.md) | The log records causes, never derivations |
| [DEC-0005](DEC-0005-roles-are-bundles-groups-carry-responsibility.md) | Roles are bundles; groups carry responsibility, not roles |
| [DEC-0006](DEC-0006-vera-does-not-fix-records.md) | VERA does not fix records |
| [DEC-0007](DEC-0007-flat-navigation.md) | Navigation is one flat list, without counts |
| [DEC-0008](DEC-0008-intention-and-list-are-not-attached.md) | An intention and a list are related by derivation, never attached |
| [DEC-0009](DEC-0009-independent-mixes-and-preserved-archives.md) | Mixes are independent; archiving preserves |
| [DEC-0010](DEC-0010-messaging-hands-off.md) | Messaging hands off to a plugin |
| [DEC-0011](DEC-0011-registry-states-are-evidence.md) | Registry states are evidence, not status |
| [DEC-0012](DEC-0012-relationships-that-do-not-exist.md) | Some relationships deliberately do not exist |
| [DEC-0013](DEC-0013-properties-are-admin-defined.md) | Properties are defined by an admin, typed, and sourced |
| [DEC-0014](DEC-0014-several-publication-links.md) | An iteration may be published in several places |
| [DEC-0015](DEC-0015-public-requests-by-entry-link.md) | The public asks through entry links, with Google or Seznam |
| [DEC-0016](DEC-0016-local-sign-up.md) | A person may create their own local account |
| [DEC-0017](DEC-0017-observability.md) | VERA is observed through OpenTelemetry, into ClickHouse, read in HyperDX |
| [DEC-0018](DEC-0018-one-event-catalogue.md) | One event catalogue, taken in part by the log, hooks and an audit stream |
| [DEC-0019](DEC-0019-plugin-api-and-capabilities.md) | The plugin API is written once, and a version declares what it can do (proposal) |

A new record takes the next number as its ID, `DEC-NNNN`, and its file is named
`DEC-NNNN-title.md`. Cite a decision by its ID, as you would a rule. A record is never edited to
say something else: a decision that changes gets a new record, which names the one it replaces.
