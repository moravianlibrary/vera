# Status Log

Every other document in this set defers history here. *Resumed cancellations
live in the status log.* *`list_id` is current state, not history — "was on list
X" is in the log.* *Changed property values write a log entry.* *Provenance
lives in the status log, not a separate box.*

So it had better exist, and it had better be one thing.

---

## 1. One log, across entities

**Not one table per entity.** A request becomes an iteration, and *My Documents*
has to show one continuous history across both — the moment it was proposed, the
moment it was approved, the moment it was scheduled, the moment it appeared in
Kramerius. Splitting that across `request_log` and `iteration_log` means every
reader of history performs a union and sorts it, and the first one to forget
shows a gap.

```
status_log
  id
  subject_type     enum         — request | iteration | document | list | project | access
  subject_id
  event            enum         — §3
  actor_id         → user       — never null, §4
  at               timestamptz
  from_value       jsonb  null  — what it was
  to_value         jsonb  null  — what it became
  public_text      text   null  — §5
  internal_text    text   null
  correlation_id   uuid         — §6
```

**Append-only.** Never updated, never deleted. A mistaken entry is corrected by
a new entry, because an audit trail that can be edited is not one
([[view-rules]] §5 rule 6).

---

## 2. Log causes, not derivations

[[status-model]] §2 derives `progress` from `list_id` and the list's date: an
item on a list dated tomorrow is `Planned`, and the same item is `InProgress`
the next morning **with nothing written**. There is no actor and no moment —
the world simply moved.

So the log records **what somebody did**, not what followed from it:

| Logged | Not logged |
|--------|------------|
| added to list #412 | `Ready → Planned` |
| list #412's start date moved to the 4th | `Planned → InProgress` |
| list #412 deleted | every member's return to `Ready` |
| the defect set changed on a re-check | `Approved → Needed` |

The derived state at any past moment is reconstructable from the causes; the
reverse is not true, and writing derivations would need a nightly job inventing
events with no author. **If nobody did it, it is not an entry.**

The same rule disposes of a volume problem: registry checks run on a schedule
([[registry-status]] §8), and an adapter confirming the same answer for the ten
thousandth time must write nothing. **Log changes, not observations.**

---

## 3. What is logged

Not an exhaustive list — the rule is *every state-changing action*, and these
are the ones other documents explicitly promised:

| Subject | Events |
|---------|--------|
| **request** | created · approval requested (*approve now*) · decision changed (approved / approved as rescan / denied / withdrawn / duplicate) · held: a copy exists · existing copy observed · started tracking an iteration · stopped tracking |
| **iteration** | ingested · ingest failed · restriction set (by a rule) · restriction cleared (the rule no longer finds it) · restriction overruled · validation verdict (approve / deny / revoke) · **cancelled** · **could not be digitized** · **resumed** · added to list · removed from list · flagged on its list (a blocker appeared) · digitized (its list marked Done) · published · published link changed · category, priority or project changed |
| **document** | unit ID changed · property value changed ([[document-properties]] §3) · registry state changed ([[registry-status]]) |
| **list** | created · generated (generator, version, intention, mix revision, allocation) · dates changed · marked Done · deleted |
| **project** | created · details or description changed · dates or target changed · member added or removed · manager changed · deleted (only while empty) · approved (with its priority, what it approved and what it skipped) · rejected (with its reason) |
| **access** | proposal custody created · renamed · deleted · member (user or group) added or removed · a user's role granted or removed (by hand, or by the IdP mapping) · a Custody plugin's rule changed, with the re-run over open proposals it started ([[proposal-custody]]) |

Two of these exist *only* because the log exists, and would otherwise have
needed a column apiece:

- **`resumed`** — [[status-model]] §6 clears the cancellation flag completely,
  with no `cleared_at` and no append-only cancellation table. The fact that
  somebody once stopped this survives here and nowhere else.
- **removed from list / list deleted** — `list_id` is current state, so without
  the log, deleting a list erases every trace that the work was ever scheduled.

---

## 4. The actor is never null

Person, **agent** ([[view-map]] §6.1), or the system account for transitions
nothing else claims — an ingest completing, a scheduled check finishing. All
three are user records, which is what lets provenance render uniformly and
`actor_id` stay a plain non-null foreign key.

A system account is still an answer. *"Ingest completed it"* is information;
a blank is not.

---

## 5. Two texts, as everywhere else

[[view-rules]] §4.3 applies unchanged: the entry carries a public wording and an
internal one, and the view renders whichever the reader is cleared for. The
reason text a curator types when denying **becomes** the log entry's texts —
not a copy of them, the same values — which is why §3's reason-bearing events
carry both columns and the rest carry neither.

Most entries need no text at all. *Added to list #412* says what it says.

---

## 6. One action, one story

A single curator click can write several rows. Approving a proposal for a
document three other people also asked for writes four decision changes
([[status-model]] §2.7); ingesting a batch writes one per addition.

`correlation_id` groups them, and **the history view renders a correlated group
as one event**: *"Approved — R. Randiak, 4 requests"*, expandable. Without it,
propagation rules make a person's history look like they were hit by four
separate decisions from four separate people at the same instant.

---

## 7. Where it is read

| Surface | Shows |
|---------|-------|
| **My Documents**, detail | this request's story, public texts only, causes in plain language |
| **Documents / Validation**, detail | the full log for the iteration and its document, internal texts, correlated |
| **Documents**, batch header | ingest and failure entries for the batch |
| **Digitization Lists** | membership entries — what was added, removed, and when |

[[view-map]] §2 already says *Documents* puts provenance in the history rather
than in a separate box. This is that history. There is no second provenance
mechanism anywhere in the application, and adding one is how the two start to
disagree.

---

## 8. Open

- **Retention.** Append-only and never deleted is right for decisions and wrong
  for property-value churn — a catalog adapter that reports a slightly different
  page count every sync can produce a large number of low-value entries. Either
  §2's *log changes, not observations* is enough on its own, or noisy event
  types need a retention window. Worth measuring before deciding.
- **Does the log carry `from_value` for derived state**, purely so history can
  be rendered without recomputing derivations? It costs denormalisation and buys
  a simpler reader. §2 says no; this is the place that argument would be
  revisited.

## Related

- [[status-model]] — the states whose causes this records
- [[view-rules]] — §4.3 two texts, §5 rule 6 attribution
- [[view-map]] — §2, where Documents reads it
- [[document-properties]] · [[registry-status]] — current state in a table, history here
