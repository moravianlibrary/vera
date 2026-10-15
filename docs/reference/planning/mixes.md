# Mixes

The proportions the library wants across the tree ([ENT-mix](../model/entities.md#ent-mix)).

#### PLAN-mix

A mix is independent: it has its own name, revisions and lifecycle, and any number of
intentions and repeats may use it. It holds percentages only, with no scope, size, dates or
output.

#### PLAN-mix-sets

A mix is written per set of siblings:
- the top level splits 100%;
- each parent's children split their parent's share;
- a set adds up to at most 100.

A set under 100 leaves the rest **unallocated**, and that is flagged, never scaled. `0%` means
deliberately excluded. A category with no entry has **no share** decided yet.

#### PLAN-mix-revision

Every save makes a new revision; a saved revision never changes. A revision may carry a label,
which makes it a named snapshot. An edit opened on an older revision is refused once somebody
saved meanwhile.

#### PLAN-mix-primary

Exactly one active mix is **Primary**: the one offered when a flow needs a mix and none was
chosen. It has to be replaced before it can be archived.

#### PLAN-mix-archive

An archived mix is no longer offered for new selections and cannot be edited. Intentions and
repeats that followed it keep its final revision, pinned. To change it, make an editable copy.

#### PLAN-mix-within-scope

An intention reads its mix inside its own scope: the scope's node counts as 100%, and its
children split that. This is a change of frame, not a rescaling of the mix.

#### PLAN-mix-band

Output within 5 points of the intended share reads as on the mix. That band is display tolerance
only, and changes nothing in the mix.

#### PLAN-mix-flags

Against an intention's output, each category of the mix reads as one of:
- **in band**;
- **over** or **under**;
- **excluded but used**: the share is 0%, yet there is output;
- **no share**: nothing was decided for it.

#### PLAN-no-mix

An intention may have no mix. That is a deliberate choice and never silently becomes the Primary
mix. A project's own intention starts without one.

A mix is never filtered by project: a project's own intention already scopes its items.

> **Open — [L28](../../ledger.md#l28-remove-mix-tracking).** The code still keeps the older
> *track another intention's mix* and *detach* acts beside independent mixes. They go.
