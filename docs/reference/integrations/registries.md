# Registries

What other registries (Kramerius, RDCZ, VERA itself) say about a document.

#### REG-evidence

A registry state is evidence, an observation of somebody else's bookkeeping. It is not VERA's
status and it never moves VERA's progress.

#### REG-states

A registry answers with one of these states:

| State | Means |
|---|---|
| Check failed | the look failed (down, timeout, auth): shown as *unknown*, with when it was last tried |
| Not found | the registry says it does not have it |
| Unmapped | the registry answered with a state VERA has no mapping for |
| Planned, In progress | somebody else intends to scan it, or is scanning it |
| Digitized, Published | a copy exists there |

No row at all means *never checked*.

*Why:* a registry that has been unreachable for a week must not read as *not there*. A curator
reading *not there* will schedule a scan that may already exist.

#### REG-raw-state

The registry's own word for the state is kept beside VERA's mapping, with when it was observed
and checked, and a link: to the scan (`content`) or to the registry's record (`record`).

#### REG-strongest

Where several registries answer, the strongest evidence shows: Published, then Digitized, In
progress, Planned, Unmapped. A *Not found* is no evidence.

#### REG-copy-not-gate

A copy elsewhere blocks nothing. It is news for whoever decides: approving over it is a rescan
([DOC-existing-copy](../model/documents.md#doc-existing-copy)).

Which registry states count as an existing copy is set on each instance, the implementation's
declaration the default ([PLG-upgrade](plugins.md#plg-upgrade)).

#### REG-scheduled

Registry checks run with the other checks on a request and at ingest, and on a schedule over the
whole corpus. A change found after VERA decided shows beside the badge as a footnote, for a person
to act on.
