# Intentions, independent mixes, and preserved archives

Design discussion recorded on **2026-10-08**.

**Status:** core behavior was implemented in the React frontend and mock API on
2026-10-08. Sections 3 and 9 retain open proposals; the implementation record
below distinguishes those from shipped behavior.

## Implementation record

- Mixes have independent IDs, names, Primary designation, active/archive state,
  immutable percentage revisions, named revision snapshots, and editable copies.
  `/mixes` and `/mixes/:id` provide the direct management view. Existing
  intention-owner fields and endpoints remain for compatibility with older
  links and data; new selections use mix IDs directly.
- Categories links its selected mix beside the picker for editing or viewing.
  The Mixes pages keep their direct URLs; the separate sidebar row appears only
  when an account can read mixes but cannot open Categories.
- Intentions may select no mix, follow an active mix's latest revision, or pin a
  named snapshot. New ordinary intentions offer Primary by default. Project
  intentions start without a mix; no-mix generation uses eligible work in
  priority and request-age order, with no category allocation.
- Overall output remains on its selected mix when Primary changes. `/intentions`
  now presents one board, with Repeats first and intentions grouped into
  Running, Upcoming, Ended, and Archived. The Type filter makes Targets
  (with a page target), Output (without one), and Repeats mutually exclusive;
  output comparison is still available on target cards. Its search and Type
  filter, together with state, pace/attention, repeat frequency, mix,
  project (including Any project and No project), counting dates and target/time percentages, can be saved as watchlists,
  with three seeded shared examples. Categories selects a mix
  directly and shows its definition without implying actual output.
- Archive captures an intention's displayed row, mix tree, category labels,
  and exact mix revision. Archived views are read-only. Existing active
  followers and repeats pin the final revision when a mix is archived. The
  Primary mix must be replaced before it can be archived. List generation
  records mix ID and revision; earlier fixture histories without a stored
  revision use their current mix definition as a compatibility fallback.
- The archive capture stores the current displayed result in the mock's
  in-memory database. Its state resets on reload, as all mock writes do. Old
  seeded archived intentions receive their first capture when read. List and
  document drill-downs are outside the captured intention result.

**Still open:** the proposed project filter on a mix, a correction/restore
workflow for archives, and saved watchlists plus full filter bars for Mixes. These were not settled by the
discussion in this note. The mock does not create repeat occurrences on a
calendar tick; repeat templates now carry the optional mix selection for a
future scheduler.

The agreed decisions below supersede the earlier requirements that every mix
belongs to an intention and that archiving only changes visibility, in
[intentions.md](intentions.md) and [concepts.md](concepts.md). Other behavior in
those documents needs to be reconciled during implementation planning.

## 1. Why the design is changing

The current Intentions page divides records into Targets and Tracking according
to whether they have a page target. It also presents mix ownership, mix reuse,
output comparisons, and repeat templates.

These are different properties. A target may own a mix or use another mix. An
intention without a page target may do either as well. “Tracking” currently
describes both the absence of a page target and following another owner's mix.

Mix editing exists but is hard to discover. In the running frontend, an admin
following NDK Periodika's **Edit mix** link first reaches its comparison page,
then follows **Edit Periodicals push — watch's mix**, and finally opens
**Edit proportions**. The first label does not describe its immediate
destination. The `.v2` demo still links to Categories for mix editing.

Adding two separate watchlist strips and filter bars to the existing columns
would leave these conceptual problems unresolved.

## 2. Agreed concepts

| Concept | Responsibility |
|---|---|
| Intention | Defines which work counts through funding, category scope, and a date window; may have a page target and may use a mix. |
| Page target | Adds a quantity objective, progress, and pace when there is an end date. |
| Mix | An independently identifiable, reusable definition of desired category proportions. It has its own lifecycle. |
| Mix revision | An immutable version of a mix's percentages. |
| Output comparison | Evaluates an intention's actual output against a selected mix revision within that intention's scope and window. |
| Archived intention | A preserved definition and result, including the exact mix revision used when applicable. |
| Repeat | A template creating intentions for successive periods; it may create intentions with or without page targets. |

Keep the underlying Intention model unified. Having a page target and selecting
a mix are optional properties, not separate stored intention types.

A mix has no actual output, pace, or drift on its own. The same mix can produce
different comparisons for intentions with different funding, scope, or dates.
Mix completeness, such as unallocated shares, is a property of its definition.

Intentions continue to count overlapping work. Their page counts must not be
summed as though they were disjoint containers.

## 3. Projects and optional mixes

The agreed direction is for a project's own intention to measure delivery
without requiring category proportions. The project wants its eligible work
digitized; a mix must not prevent a category's work from being selected merely
to meet a percentage allocation.

Project delivery can still have a page target. Its work can also contribute to
Overall and other intentions whose scopes match.

| Example | Page target | Mix |
|---|---|---|
| Project's own delivery intention | Optional | None |
| Regional catch-up | 4,000 pages | Optional |
| Periodicals allocation intention | None | Selected mix |
| Quarterly digitization plan | 7,500 pages | Selected mix |

An explicitly absent mix must remain absent. It must not silently resolve to the
Primary mix during generation. A default selection and a deliberate choice of
no mix are different states in the user flow.

Whether project intentions are prohibited from selecting a mix, or merely start
without one, remains an implementation decision. Rules for selecting and
ordering project documents without a mix also need to be specified.

### Project filter in a mix view — proposed, not settled

The user suggested filtering a mix's category tree to categories containing
documents from a selected project, with ancestors retained for context. This
would help inspect relevant categories without assigning the mix to the project.

The proposed behavior is to keep stored percentages unchanged and default
category presence to all project documents, including work awaiting digitization.
Actual output would still use digitized pages within an explicitly selected
period. The definition of document presence and whether comparison may
recalculate relative proportions within the filtered categories are **not yet
agreed**. Filtering must not silently rewrite the mix.

## 4. Primary, lifecycle, and revisions are separate

Mixes do not need a tier hierarchy for the behavior discussed so far.

| Property | Meaning |
|---|---|
| Primary | The default mix offered when a flow needs a mix and no other mix is selected. |
| Active / Archived | Whether a mix remains available for new selections. |
| Revision | A preserved version of the percentages. |

There is exactly **one active Primary mix**. Designating another active mix as
Primary changes the default for future selections. Existing intentions retain
their selected mix and follow/snapshot behavior.

Archiving the Primary mix requires choosing its replacement. That transition
must not leave the application with no active Primary mix.

**Overall output and Primary mix are separate concepts.** Overall measures all
digitized work from its reporting baseline. Primary identifies the default
allocation. Changing Primary does not automatically retarget Overall's existing
mix selection; changing that selection would be a separate explicit action.

## 5. Following a mix and taking snapshots

An intention using a mix has one of two choices:

| Choice | Behavior |
|---|---|
| Follow latest | Uses the selected mix's latest revision as that mix changes. |
| Use snapshot | Uses one specified immutable revision. |

**Create snapshot** preserves a particular revision and may give it a meaningful
label, such as “Approved allocation for 2027.” A snapshot is read-only.
**Create editable copy** starts another mix from that revision.

These are separate acts:

- Editing a mix creates a new revision of that mix.
- Taking a snapshot preserves a revision; it does not create another editable mix.
- Making an editable copy creates a distinct mix that can subsequently diverge.

The precise representation of a named snapshot remains open: it can name an
existing immutable revision rather than duplicate all its data. A manually
created snapshot does not, by itself, change existing followers.

User-facing reuse language should say **Use shared mix**, **Follow latest**,
**Use snapshot**, and **Create editable copy**. Reuse should identify the mix,
without requiring users to find an intention that happens to own it.

## 6. Archive means preserve

Keep the action named **Archive**. It includes the behavior previously described
as “close and preserve”; there is no separate close action required by this
discussion.

### Archiving an intention

Archive preserves its definition, results, and the exact mix revision used, if
it has a mix. Reopening its archived view shows that preserved state even when
source records or the shared mix later change.

At minimum, preservation must cover the information needed to reproduce what
the archived UI presents:

- Funding and category scope, date window, and optional page target.
- The time at which the archive was captured.
- Displayed planned, delivered, and output results and their category breakdowns.
- The selected mix and exact revision, where applicable.
- Relevant category paths and labels, so later tree edits do not change the
  meaning of the preserved breakdown.

These are preservation requirements, not a final storage schema. The depth of
document/list drill-down preservation remains open.

Archiving an intention that follows the latest mix effectively pins its archived
comparison to the revision captured at that moment. It does not archive the mix
for other users.

Example: archive NDK Periodika's Q3 intention with its Q3 results and mix
revision. Periodicals push and a Q4 intention can continue following and editing
the same mix without changing the Q3 archive.

### Archiving a mix

Archive preserves its final revision and removes the mix from new selections.
Existing references, including archived intentions and snapshots, remain valid.
The archived mix is read-only; an editable copy can start future work.

The behavior and confirmation for **active intentions still following** a mix
when it is archived must be decided. One candidate is to preserve their
reference to the final revision, clearly showing that it will receive no more
updates. They must not silently switch to the new Primary mix.

### Preservation boundaries still needing decisions

An ended date window is not automatically an Archive action unless explicitly
decided. Existing automatic archiving through project lifecycle and repeat
templates must be reviewed because archiving now preserves results.

Restoring or correcting an archived record must not overwrite its preserved
version. Whether to support an explicit new version, a copy, or a separate
restore workflow remains open.

## 7. Information architecture candidate

The following layout was considered during brainstorming. The Intentions
destinations were superseded by the merged board described above:

| View | Contents | Candidate route |
|---|---|---|
| Targets | Intentions with a page target; delivery and pace. | `/intentions/targets` |
| Output | All intentions, including targets; output and optional mix comparison. | `/intentions/output` |
| Mixes | Independent mixes, Primary status, revisions, completeness, and usage. | `/mixes` |
| Repeats | Templates, next occurrence, optional target, and mix selection. | `/intentions/repeats` |

An intention may appear in Targets and Output. Output remains useful without a
mix: it can show digitized pages and their category breakdown without an
intended-versus-actual comparison.

Each list would use the existing shared watchlist tabs and filter bar. Watchlist
state belongs to its view. Structural mix gaps belong in Mixes; output drift
belongs in Output. The precise seeded watchlists and filters remain to be
designed.

Mix details would have a direct, clearly visible **Edit proportions** action
where permitted, plus revisions, snapshots, and where the mix is used.
An intention's detail would distinguish **View output comparison** from
**Edit shared mix**. The latter must identify the mix and explain whom an edit
affects.

Mix-to-mix comparisons must use the same category frame. Mix-to-output
comparisons must identify the intention and its window. A project category
filter does not itself supply a reporting period or define the comparison.

Existing `/intentions/:id/mix?c=...`, `?i=...`, and `?t=...` links need explicit
compatibility handling that preserves their intention and category context.

## 8. Model and migration implications

These are consequences to plan, not changes already implemented:

- Introduce an independent mix identity, name, lifecycle, and immutable revisions.
- Replace intention-to-intention mix ownership/reuse with an optional mix
  reference and an explicit follow-latest or pinned-revision selection.
- Replace the special intention's implicit default allocation role with the
  active Primary mix designation.
- Preserve Overall as a counting intention, separate from that default role.
- Give archived intentions a preserved definition and result rather than only
  an `archived` visibility marker.
- Review repeat templates, project lifecycle actions, list generation provenance,
  Categories' mix picker, and permissions against the new model.

In the fixtures, `i4` currently combines Overall and ownership of distribution
`d1`; `i8` owns `d2`, reused by `i1` and `i3`. Those provide concrete migration
examples. The new mix names must be chosen deliberately. Existing generation
history must continue to identify the exact allocation used.

The existing percentage rules remain relevant: recursive sibling sets, explicit
unallocated shares, and 0% as deliberate exclusion. Independent identity does
not by itself change how percentages work.

## 9. Decisions needed before implementation

We have enough agreement to design the main screens and draft a migration plan.
The following behavior still needs an answer before implementing its dependent
workflow:

1. **Project delivery:** is a mix forbidden on a project's own intention or just
   absent by default? How does generation choose and order work without a mix,
   especially when a run has a page limit?
2. **Mix scope:** can each independent mix cover the whole tree or one subtree?
   How are incompatible intention scopes handled? The current scoped owner can
   hide shares that remain stored elsewhere in the tree.
3. **Project filter:** which documents determine visible categories, and may a
   comparison explicitly recalculate proportions within that selection?
4. **Archive capture:** how much drill-down is preserved, how are running work
   and late corrections treated, and what do repeat/project automatic archives
   capture? Are ended windows archived automatically or only by an action?
5. **Archive with active followers:** do they remain on the final revision, must
   they be pinned explicitly, or must the user resolve them before archiving?
6. **Archive restoration:** is creating a copy sufficient, or is an explicit
   restore/new-version workflow needed?
7. **Permissions:** who can create, edit, snapshot, archive, and designate a
   Primary mix now that permission cannot come from an owning intention?
8. **New selections:** which workflows default to Primary, and which default
   to no mix? For mixes, does a new selection default to follow latest or to a
   snapshot? How do repeat templates pass that choice to occurrences?
9. **Navigation:** confirm the Targets/Output/Mixes/Repeats destinations, record
   details, routes, and watchlist scopes before building the new pages.

## 10. Implementation references

- [Current intention API](../../../../frontend/src/api/intentions.ts)
- [Current mix API](../../../../frontend/src/api/mixes.ts)
- [Counting and comparison rules](../../../../frontend/src/domain/intentions.ts)
- [Current fixtures](../../../../frontend/src/mocks/fixtures/intentions.ts)
- [Current Intentions page](../../../../frontend/src/features/intentions/intentions-page.tsx)
- [Current mix editor](../../../../frontend/src/features/intentions/mix-page.tsx)
- [Shared frontend components and conventions](../../../../frontend/brief.md)

The `.v2` demos remain design references and were not changed by the frontend
implementation. Unresolved choices above remain proposals.
