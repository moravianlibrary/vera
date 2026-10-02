/* VERA demo — the model, as decided in docs/design/shared/.
   Vocabulary and derivations only; no data, no DOM.

   The four status axes are stored; the badge is derived from all four by a
   precedence rule and is never a source of truth.
   See entities/status-model.md                                             */

window.VERA = (function () {

  /* ---------------------------------------------------------------- axes */

  const DECISION = ['Pending', 'Approved', 'Denied', 'Withdrawn', 'Duplicate'];
  /* restriction is not an enum: null, or { rule, publicText, internalText },
     with a separate nullable override (status-model §2). Eligibility is
     retired — an existing copy is a fact on the request, a missing field is
     a defect. */
  const restricted = (it) => !!it.restriction && !it.restrictionOverride;
  const VALIDATION = ['NotRequired', 'Needed', 'Approved', 'Denied'];

  /* progress is a sequence; IngestFailed is a genuine position (a stall),
     cancellation is NOT here — it is a flag beside it (status-model §2.5) */
  const PROGRESS = ['Enqueued', 'IngestFailed', 'Ready', 'Planned',
                    'InProgress', 'Digitized', 'Published'];
  const PROGRESS_RANK = Object.fromEntries(PROGRESS.map((p, i) => [p, i]));
  const atLeast = (p, q) => PROGRESS_RANK[p] >= PROGRESS_RANK[q];

  /* ------------------------------------------------------ validation §2 */
  /* Not stored. Derived by comparing the current defect set D against the
     approved keys A and denied keys N.                                    */

  function validationOf(it) {
    const D = (it.defects || []).map(d => d.key);
    const A = new Set(it.approvedKeys || []);
    const N = new Set(it.deniedKeys || []);
    if (D.length === 0) return 'NotRequired';
    if (D.some(k => N.has(k))) return 'Denied';
    if (D.every(k => A.has(k))) return 'Approved';
    return 'Needed';
  }

  /* what the curator is shown: D \ A — outstanding only, never what was
     already accepted */
  function outstanding(it) {
    const A = new Set(it.approvedKeys || []);
    return (it.defects || []).filter(d => !A.has(d.key));
  }

  /* -------------------------------------------------------- the badge §4 */
  /* Eleven rows, first match wins. No "Not eligible": an existing copy
     blocks nothing, so it can never be the blocking gate (status-model §4). */

  function badgeOf(it) {
    const v = validationOf(it);

    if (it.decision === 'Denied')     return B('Declined', 'red');
    if (it.decision === 'Withdrawn')  return B('Withdrawn', 'slate');
    if (it.decision === 'Pending')    return B('Awaiting review', 'amber');
    if (it.cancellation && it.cancellation.cause === 'Decided')
                                      return B('Cancelled', 'slate');
    if (it.cancellation && it.cancellation.cause === 'NotDigitizable')
                                      return B('Could not be digitized', 'red');
    if (it.progress && atLeast(it.progress, 'Digitized'))
                                      return B(it.progress, progressColor(it.progress));
    if (restricted(it))               return B('Forbidden', 'dark');
    if (v === 'Denied')               return B('Denied in review', 'red');
    if (v === 'Needed')               return B('Review needed', 'amber');
    if (it.progress === 'IngestFailed') return B('Could not be added', 'red');
    return B(it.progress || '—', progressColor(it.progress));
  }

  const B = (label, color) => ({ label, color });

  const progressColor = (p) => ({
    Enqueued: 'slate', IngestFailed: 'red', Ready: 'green', Planned: 'blue',
    InProgress: 'blue', Digitized: 'green', Published: 'purple'
  }[p] || 'slate');

  /* The one exception to one-badge-per-row: a re-check on a Digitized or
     Published iteration cannot move progress back, so validation rides along
     as a footnote — "Published · review needed". */
  function badgeFootnote(it) {
    if (!it.progress || !atLeast(it.progress, 'Digitized')) return null;
    const v = validationOf(it);
    if (v === 'Needed') return 'review needed';
    if (v === 'Denied') return 'denied in review';
    return null;
  }

  /* ----------------------------------------------------------- gates §3 */

  function gates(it) {
    const v = validationOf(it);
    return [
      { ok: it.decision === 'Approved' || it.decision == null, label: 'decision' },
      { ok: !restricted(it), label: 'restriction' },
      { ok: v === 'NotRequired' || v === 'Approved', label: 'validation' },
      { ok: it.cancellation == null, label: 'not cancelled' }
    ];
  }
  const passesGates = (it) => gates(it).every(g => g.ok);

  /* ------------------------------------------------------------ stage §5 */
  /* Who has it now. A projection, never stored. */

  function stageOf(it) {
    if (it.decision === 'Pending') return { name: 'Proposed', view: 'Proposals' };
    if (it.decision === 'Denied' || it.decision === 'Withdrawn')
      return { name: 'Declined', view: null };
    if (it.decision === 'Duplicate') return { name: 'Tracking', view: null };
    if (!it.progress) return { name: 'Approved', view: 'Documents' };
    if (it.cancellation) return { name: 'Held', view: null };
    if (it.progress === 'IngestFailed') return { name: 'Stalled', view: 'Documents' };
    if (atLeast(it.progress, 'Digitized')) return { name: 'Done', view: null };
    /* a prohibition is nobody's queue — only an admin can overrule it */
    if (restricted(it)) return { name: 'Forbidden', view: null };
    if (it.progress === 'Planned' || it.progress === 'InProgress')
      return { name: 'Queued', view: 'Digitization Lists' };
    if (passesGates(it) && it.progress === 'Ready')
      return { name: 'Ready', view: 'Digitization Lists' };
    return { name: 'Added', view: 'Documents Validations' };
  }

  /* public vocabulary — a reader needs to know whether to wait, nothing else */
  function publicStatus(it) {
    const s = stageOf(it).name;
    return {
      Proposed: 'Waiting for review', Declined: 'Not accepted',
      Approved: 'Being added', Added: 'Being checked', Ready: 'Waiting to be scheduled',
      Queued: 'Scheduled', Done: 'Available', Stalled: 'Being added',
      Held: 'On hold', Tracking: 'Already being digitized', Forbidden: 'Not available for digitization'
    }[s] || s;
  }

  /* --------------------------------------------------------- priority §  */
  /* A four-value enum. Declaration order ascending so comparison works off
     the type. Only Urgent and High carry colour.                          */

  const PRIORITY = ['Low', 'Normal', 'High', 'Urgent'];
  const PRIORITY_DESC = ['Urgent', 'High', 'Normal', 'Low'];
  const prioColor = (p) => ({ Urgent: 'red', High: 'amber' }[p] || 'slate');
  const prioRank = (p) => PRIORITY.indexOf(p);

  /* --------------------------------------------------------- registries */
  /* Evidence, not state. Both raw_state and the normalised state are kept;
     link_kind says whether a link goes to content or to somebody's records. */

  const REG_STATE_COLOR = {
    NotFound: 'slate', Planned: 'slate', InProgress: 'blue',
    Digitized: 'green', Published: 'purple', Unmapped: 'amber', CheckFailed: 'red'
  };

  /* strongest evidence wins: any Published, else the most advanced */
  const REG_RANK = { CheckFailed: -1, NotFound: 0, Unmapped: 1, Planned: 2,
                     InProgress: 3, Digitized: 4, Published: 5 };

  function strongestRegistry(doc) {
    const rows = (doc.registries || []).filter(r => r.state !== 'NotFound');
    if (!rows.length) return null;
    return rows.slice().sort((a, b) => REG_RANK[b.state] - REG_RANK[a.state])[0];
  }

  /* a reader is only ever offered a content link */
  const readerLink = (r) => (r && r.linkKind === 'content') ? r.url : null;

  /* ------------------------------------------------------------ helpers */

  const fmt = (n) => (n == null ? '—' : n.toLocaleString('en-US'));

  /* catalog ID + optional unit ID. Where only one fits, show the unit —
     siblings share a catalog ID, so it is the part that does not tell them
     apart. document-identity.md                                           */
  const docId = (d) => d.unit ? `${d.catalogId} · ${d.unit.value}` : d.catalogId;
  const docIdShort = (d) => d.unit ? d.unit.value : d.catalogId;

  /* multi-level category — show the path when the leaf is not level 0 */
  const catPath = (c) => c.join(' / ');

  return {
    DECISION, VALIDATION, restricted, PROGRESS, PRIORITY, PRIORITY_DESC,
    atLeast, validationOf, outstanding, badgeOf, badgeFootnote, progressColor,
    gates, passesGates, stageOf, publicStatus, prioColor, prioRank,
    REG_STATE_COLOR, strongestRegistry, readerLink,
    fmt, docId, docIdShort, catPath
  };
})();
