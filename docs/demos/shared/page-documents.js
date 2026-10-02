/* Documents — /documents   ("My Documents" with request.read_own alone)
   row      one DOCUMENT — its askers from the moment of asking, then its
            current iteration from approval on. Earlier iterations are in
            the pane, never extra rows (view-map §2.1)
   scope    authorship with request.read_own alone; the grant's scope with
            iteration.read, where Mine is a filter (navigation §1.1)
   opens on nothing filtered — this is reference, nothing is hidden
   actor    anyone. Reach sets the label, the reason text and the rows —
            it is one page, not role views

   Shape: MASTER–DETAIL at large and notebook. The row says where the
   document is and why; the pane answers in full and carries every act on
   the record. No approve, no deny — deciding is Proposals' and Documents
   Validations', and this page links there.

   Declared cost (view-rules §6, notebook chrome with the sidebar expanded):
     record   large 10.5+1 / 12   notebook 7.5+1 / 8   My Documents 5+1
     chrome   large 17 / 28       notebook 16 / 18                        */

window.PAGE_DOCUMENTS = function (tier) {
  const M = VERA, D = VERA_DATA, U = VERA_UI;
  const role = U.currentRole('staff');
  const held = U.permsOf(role);
  const can = (p) => held.has(p);
  const ME = U.userOf(role) || 'u4';

  /* REACH — the one switch on this page. Not a role switcher: nobody holding
     iteration.read is ever shown the narrower page. */
  const wide = can('iteration.read');
  const audience = wide ? 'staff' : 'public';
  const title = wide ? 'Documents' : 'My Documents';

  /* custody — a curator's grants are @custody (permissions §4); everybody
     else in the demo holds theirs @any */
  const CUSTODY = ['c2'];
  const CUSTODY_SCOPED = new Set(['validation.approve',
    'iteration.classify', 'iteration.cancel', 'iteration.publish',
    'iteration.resume', 'addition.read']);
  const inCustody = (catId) => {
    let c = D.cat(catId);
    while (c) { if (CUSTODY.includes(c.id)) return true; c = c.parent ? D.cat(c.parent) : null; }
    return false;
  };
  const may = (p, it) => can(p) &&
    !(role === 'curator' && CUSTODY_SCOPED.has(p) && it && !inCustody(it.category));

  /* ------------------------------------------------------------ query */
  /* the quick controls are real, so the two behaviours worth seeing —
     Mine and group by batch — can be seen rather than described */
  const q = new URLSearchParams(location.search);
  const mineOnly = wide && q.get('mine') === '1';
  const byBatch = can('addition.read') && q.get('group') === 'batch';
  const byProject = q.get('group') === 'project';
  const projF = D.proj(q.get('project')) ? q.get('project') : '';
  const query = (q.get('q') || '').trim();
  const statusF = q.get('status') || '';
  const go = (k, v) => { v ? q.set(k, v) : q.delete(k);
    location.search = q.toString(); };

  /* ---------------------------------------------------------- records */

  const when = (s) => Date.parse(s) || 0;
  const PRIO = { Urgent: 3, High: 2, Normal: 1, Low: 0 };

  const docIds = [...new Set([...D.requests.map(r => r.doc), ...D.iterations.map(i => i.doc)])];
  let recs = docIds.map(id => {
    const d = D.doc(id), its = D.iterationsOfDoc(id);
    const cur = its[its.length - 1] || null;
    const reqs = D.requests.filter(r => r.doc === id);
    /* the askers of THIS attempt — earlier iterations keep their own */
    const askers = cur ? reqs.filter(r => r.iteration === cur.id || r.tracks === cur.id ||
                                          r.decision === 'Pending')
                       : reqs;
    const mine = reqs.filter(r => r.by === ME)
      .sort((a, b) => when(b.at) - when(a.at));
    /* without an iteration the document's status is its liveliest request */
    const lead = cur ? null : ['Pending', 'Denied', 'Withdrawn']
      .map(k => reqs.find(r => r.decision === k)).find(Boolean);
    /* the project it is for: the iteration's, or before approval the
       request's (a request carries a project — decided 2026-09-26) */
    const pid = (cur && cur.project) || (askers.find(x => x.project) || {}).project || null;
    return { id, d, its, cur, reqs, askers, mine, lead, project: pid ? D.proj(pid) : null,
             earlier: its.slice(0, -1), copies: askers.flatMap(r => r.existingCopies || []) };
  });
  const recsAll = new Map(recs.filter(r => wide || r.mine.length).map(r => [r.id, r]));
  if (!wide) recs = recs.filter(r => r.mine.length);
  if (mineOnly) recs = recs.filter(r => r.mine.length);
  if (projF) recs = recs.filter(r => r.project && r.project.id === projF);
  /* search covers the title, catalog ID, unit and iteration ID — a link to one
     document is this search (decided 2026-09-26) */
  const norm = (x) => String(x || '').toLowerCase();
  /* an iteration or request ID is matched whole — IT1 is not IT12 */
  if (query) recs = recs.filter(r => [r.d.title, r.d.catalogId, r.d.unit && r.d.unit.value, r.d.signature]
      .some(v => norm(v).includes(norm(query)))
    || [...r.its.map(i => i.id), ...r.reqs.map(x => x.id)].some(v => norm(v) === norm(query)));

  /* The public vocabulary carries its own colours. Borrowing the internal
     badge's would leak it — a red "Being added" says *failed* without saying
     it (view-map §4). */
  const PUBLIC_COLOR = { 'Waiting for review': 'amber', 'Not accepted': 'red',
    'Being checked': 'slate', 'Being added': 'slate', 'Waiting to be scheduled': 'green',
    'Scheduled': 'blue', 'Available': 'purple', 'On hold': 'slate',
    'Already being digitized': 'blue', 'Not available for digitization': 'dark' };

  /* the ingest failure TEXT is addition.read's; without it the fact shows,
     the detail does not (permissions §3) */
  const hideIngest = (it) => it && it.progress === 'IngestFailed' && !may('addition.read', it);
  const INGEST_OPAQUE = `<b style="color:var(--tone-red-fg)">Could not be added:</b>
    an administrator retries it.`;

  /* the badge, and the text it is filtered by */
  function statusOf(r) {
    if (!wide) {
      const v = U.reqView(r.mine[0]);
      const label = v.it ? M.publicStatus(v.it) : v.publicStatus;
      return { label, html: U.badge(label, PUBLIC_COLOR[label] || 'slate'), v };
    }
    if (r.cur) return { label: M.badgeOf(r.cur).label, html: U.statusBadge(r.cur) };
    const b = M.badgeOf({ decision: r.lead.decision });
    return { label: b.label, html: U.badge(b.label, b.color) };
  }
  recs.forEach(r => { r.status = statusOf(r); });
  const statuses = [...new Set(recs.map(r => r.status.label))].sort();
  const statusCounts = new Map(recs.map(r => r.status.label).reduce((counts, label) => {
    counts.set(label, (counts.get(label) || 0) + 1); return counts;
  }, new Map()));
  if (statusF) recs = recs.filter(r => r.status.label === statusF);
  /* ?category=ID — the way in from Categories: that category and all under it */
  const catF = D.cat(q.get('category')) ? q.get('category') : '';
  const under = (id, top) => { let c = D.cat(id); while (c) { if (c.id === top) return true; c = c.parent ? D.cat(c.parent) : null; } return false; };
  if (catF) recs = recs.filter(r => r.cur && under(r.cur.category, catF));
  const dropCat = () => { const u = new URLSearchParams(q); u.delete('category'); const s = u.toString(); return 'documents.html' + (s ? '?' + s : ''); };

  recs.sort(wide
    ? (a, b) => (PRIO[b.cur && b.cur.priority] ?? 1.5) - (PRIO[a.cur && a.cur.priority] ?? 1.5)
                || a.d.title.localeCompare(b.d.title)
    : (a, b) => when(b.mine[0].at) - when(a.mine[0].at));

  /* ----------------------------------------------------------- the row */

  const askersText = (n) => `<span class="lrow-n">${n} ${n === 1 ? 'asker' : 'askers'}</span>`;

  function rowOf(r) {
    const d = r.d, it = r.cur;
    let meta, why;
    if (!wide) {
      const v = r.status.v;
      meta = r.status.html + (M.readerLink(M.strongestRegistry(d)) ? U.registryCell(d, 'public') : '');
      why = v.note ? `<b style="color:var(--tone-${v.note.tone}-fg)">${v.note.title}:</b> ${v.note.text}`
          : v.it ? U.whyLine(v.it, 'public') : '';
    } else {
      const pages = D.effectivePages(d);
      meta = r.status.html +
        (it ? U.prioBadge(it.priority, 'badge-xs') : '') +
        (tier === 'large' && it ? `<span class="lrow-n">${D.pathOf(it.category).slice(-1)[0]}</span>` : '') +
        (tier === 'large' && pages ? `<span class="lrow-n mono">${M.fmt(pages.value)} pp</span>` : '') +
        askersText(r.askers.length) +
        (M.strongestRegistry(d) ? U.registryCell(d, 'staff') : '');
      why = hideIngest(it) ? INGEST_OPAQUE : it ? U.whyLine(it, 'staff')
          : r.lead.decision === 'Denied'
            ? `<b style="color:var(--tone-red-fg)">Declined:</b> ${r.lead.declineInternal}`
          : (r.lead.approveOnCheck && r.copies.length)
            ? `<b style="color:var(--tone-amber-fg)">Held for review:</b> approval was asked for;
               ${r.copies[0].source} already has it.` : '';
    }
    if (!TABLE) return { key: r.id, id: M.docId(d), title: d.title, meta, why };
    const doc = `<div class="tc-title">${d.title}</div><span class="lrow-id">${M.docId(d)}</span>`;
    if (!wide) return { key: r.id, why, num: [0, 0, 0, 1],
      cells: [doc, r.status.html,
        M.readerLink(M.strongestRegistry(d)) ? U.registryCell(d, 'public') : '',
        `<span class="muted">${r.mine[0].at.split(' ').slice(0, 3).join(' ')}</span>`] };
    const pages = D.effectivePages(d);
    return { key: r.id, why, num: [0, 0, 0, 1, 1],
      cells: [`<div class="tc-title">${d.title}</div><span class="lrow-id">${M.docId(d)}${
          it ? ` · <span class="tc-cat">${D.pathOf(it.category).slice(-1)[0]}</span>` : ''}</span>`,
        r.status.html,
        it ? U.prioBadge(it.priority, 'badge-xs') : '',
        pages ? `<span class="mono">${M.fmt(pages.value)}</span>` : '',
        r.askers.length,
        M.strongestRegistry(d) ? U.registryCell(d, 'staff') : ''] };
  }
  /* large and notebook read the list as a table beside the record; small and
     phone keep the stacked row */
  const TABLE = tier === 'large' || tier === 'notebook';
  const COLUMNS = !TABLE ? null : wide
    ? [{ label: 'Document', w: 'minmax(9rem, 1fr)' }, { label: 'Status', w: 'fit-content(8.5rem)' },
       { label: 'Priority' }, { label: 'Pages', num: 1 }, { label: 'Askers', num: 1 },
       { label: 'Existing copy', w: 'fit-content(7.5rem)' }]
    : [{ label: 'Document', w: 'minmax(9rem, 1fr)' }, { label: 'Status', w: 'fit-content(8.5rem)' },
       { label: 'Copy', w: 'fit-content(8rem)' }, { label: 'Asked', num: 1 }];
  const rows = recs.map(rowOf);

  /* ------------------------------------------------- grouped by batch */
  /* The batch is the unit an admin retries, so failures group by it. A
     document that came in on its own is not in a batch and says so. */

  let listHTML = null, orderedRows = rows;
  if (byBatch) {
    const seen = new Set(), parts = [], order = [];
    const failedIn = (b) => b.items.filter(i => (D.iter(i) || {}).progress === 'IngestFailed').length;
    D.batches.slice().sort((a, b) => failedIn(b) - failedIn(a)).forEach(b => {
      const inB = recs.filter(r => r.cur && b.items.includes(r.cur.id));
      if (!inB.length) return;
      const failed = failedIn(b);
      parts.push(`<div class="bhead">
          <div class="bhead-t"><b class="mono">${b.id}</b> <span class="muted">${b.name}</span></div>
          <div class="bhead-s">${b.at.split(' ').slice(0, 3).join(' ')} · ${D.byId(b.by).name} ·
            ${failed ? `<b style="color:var(--tone-red-fg)">${failed} of ${b.items.length} could not be added</b>`
                     : `${b.items.length} added`}</div>
          ${failed && can('addition.retry') ? `<div class="bhead-a">
            <button class="btn btn-sm">Retry ${failed === 1 ? 'the failed one' : 'failed'}</button></div>` : ''}
        </div>`);
      inB.forEach(r => { seen.add(r.id); order.push(r); parts.push(U.lrow(rowOf(r))); });
    });
    const rest = recs.filter(r => !seen.has(r.id));
    if (rest.length) {
      parts.push(`<div class="bhead"><div class="bhead-t"><b>Not from a batch</b></div>
        <div class="bhead-s">asked for one at a time, or still a proposal</div></div>`);
      rest.forEach(r => { order.push(r); parts.push(U.lrow(rowOf(r))); });
    }
    listHTML = parts.join('');
    orderedRows = order.map(rowOf);
  }

  /* ----------------------------------------------- grouped by project */
  if (byProject) {
    const parts = [], order = [];
    const keys = [...new Set(recs.map(r => r.project ? r.project.id : ''))]
      .sort((a, b) => !a - !b || D.proj(a).name.localeCompare(D.proj(b).name));
    keys.forEach(k => {
      const inG = recs.filter(r => (r.project ? r.project.id : '') === k), p = k && D.proj(k);
      parts.push(`<div class="bhead"><div class="bhead-t"><b>${p ? p.name : 'No project'}</b>${
          p ? ' ' + U.badge(p.state, { Proposed: 'amber', Approved: 'green', Rejected: 'red' }[p.state], 'badge-xs') : ''}</div>
        <div class="bhead-s">${inG.length} ${inG.length === 1 ? 'document' : 'documents'}${
          p && wide && (can('project.read') || can('project.decide')) ? ` · <a href="projects.html?p=${p.id}">open the project</a>` : ''}</div></div>`);
      inG.forEach(r => { order.push(r); parts.push(U.lrow(rowOf(r))); });
    });
    listHTML = parts.join('');
    orderedRows = order.map(rowOf);
  }

  /* ------------------------------------------------------------ pane bits */

  const who = (id) => {
    const u = D.byId(id);
    return `<b>${u.name}</b>${u.kind === 'agent' ? ' ' + U.badge('agent', 'purple', 'badge-xs') : ''}`;
  };

  /* Where it is now — every view answers this (view-map §4). A link only to
     an entry the actor holds; otherwise the name alone. */
  const FILE = { 'Proposals': 'proposals.html', 'Documents Validations': 'validation.html',
                 'Digitization Lists': 'lists.html' };
  const PERM = { 'Proposals': 'request.decide', 'Documents Validations': 'validation.approve',
                 'Digitization Lists': 'list.read' };
  function whereNow(r) {
    const post = r.cur && M.badgeFootnote(r.cur) === 'review needed';   /* C10 */
    const view = post ? 'Documents Validations'
      : r.cur ? M.stageOf(r.cur).view : (r.lead.decision === 'Pending' ? 'Proposals' : null);
    if (!view) return { value: 'Nobody', foot: 'nothing is waiting on anyone' };
    if (view === 'Documents') return { value: 'Here', foot: r.cur.progress === 'IngestFailed'
      ? 'ingest failed — an administrator retries it' : 'being added' };
    const link = can(PERM[view]) ? `<a href="${FILE[view]}">${view} &#8594;</a>` : view;
    return { value: `<span style="font-size:.9375rem">${link}</span>`, foot: 'whose desk it is on' };
  }

  function actionsOf(r) {
    const it = r.cur;
    const ownPending = r.mine.find(x => x.decision === 'Pending');
    const sec = [];
    if (ownPending && can('request.withdraw_own')) sec.push('<button class="btn btn-sm">Withdraw</button>');
    if (!r.mine.length && can('request.create') && !(it && M.restricted(it)))
      sec.push(`<button class="btn btn-sm" data-ask="${r.id}">Ask for this too</button>`);

    const more = [];
    if (it) {
      const frozen = M.validationOf(it) === 'Denied' || M.restricted(it);
      if (may('iteration.edit_descriptive', it) && !frozen) more.push(['Edit descriptive metadata…']);
      if (may('iteration.relink', it)) more.push(['Relink catalog record…']);
      if (may('iteration.classify', it)) more.push(['Reclassify — category, priority…']);
      /* forbidding is done only by rules, never by a person (decided
         2026-09-26); the link that makes it Published is iteration.publish */
      if (may('iteration.publish', it) && M.atLeast(it.progress, 'Digitized'))
        more.push([it.progress === 'Published' ? 'Change where it is available…' : 'Set where it is available…', '', 'data-publish']);      if (it.restriction && !it.restrictionOverride && can('restriction.overrule'))
        more.push(['Overrule restriction…', 'danger']);
      if (it.cancellation ? may('iteration.resume', it)
                          : may('iteration.cancel', it) && !M.atLeast(it.progress, 'Digitized')
                            && it.progress !== 'IngestFailed')
        more.push(it.cancellation ? ['Resume'] : ['Cancel…', 'danger']);
    }
    const menu = more.length ? `<details class="menu"><summary class="btn btn-sm">More &#9662;</summary>
      <div class="menu-list">${more.map(([l, k, a]) =>
        `<button class="menu-item ${k === 'danger' ? 'danger' : ''}" ${a ? `${a}="${it.id}"` : ''}>${l}</button>`).join('')}</div></details>` : '';
    return sec.join('') + menu;
  }

  function askersCard(r) {
    const tag = (x) => x.iteration === (r.cur && r.cur.id) ? U.badge('originated', 'blue', 'badge-xs')
      : x.tracks ? U.badge('following', 'slate', 'badge-xs')
      : x.decision === 'Pending' ? U.badge('awaiting review', 'amber', 'badge-xs')
      : x.decision === 'Denied' ? U.badge('declined', 'red', 'badge-xs')
      : x.decision === 'Withdrawn' ? U.badge('withdrawn', 'slate', 'badge-xs')
      : U.badge(`iteration ${(D.iter(x.iteration) || {}).n || 1}`, 'slate', 'badge-xs');
    const list = r.reqs.slice().sort((a, b) => when(b.at) - when(a.at));
    const pending = r.reqs.some(x => x.decision === 'Pending');
    return U.pcard(`Asked by ${r.askers.length}`,
      list.map(x => `<div class="row-kv"><span>${who(x.by)} ${tag(x)}
          ${x.reason ? `<br><span class="muted">“${x.reason}”</span>` : ''}
          ${x.project && !r.cur ? `<br><span class="muted">for ${projLink(D.proj(x.project))}${x.afterApproval ? ', after its approval' : ''}</span>` : ''}
          ${x.approveOnCheck ? `<br><span class="muted">asked for approval on arrival</span>` : ''}</span>
          <span class="muted">${x.at}</span></div>`).join('') +
      (pending ? `<p class="fine">One decision covers every asker.${
          can('request.decide')
            ? ' <a href="proposals.html">Decide it in Proposals &#8594;</a>' : ''}</p>` : '') +
      (r.reqs.some(x => x.tracks) ? `<p class="fine">A later asker <b>follows</b> the
          work already moving rather than duplicating it — none of them sees the
          word “duplicate”.</p>` : ''));
  }

  function copiesCard(r) {
    const d = r.d;
    const decided = r.askers.find(x => x.rescan);
    const copies = r.copies.map(c => `<div class="row-kv">
        <span><b>${c.source}</b> <span class="muted">seen ${c.seenAt}${
          c.afterApproval ? ' · after approval' : ''}</span></span>
        <span>${c.link ? `<a href="${c.link}" target="_blank" rel="noopener"
            class="badge badge-purple badge-xs">${c.state} &#8599;</a>`
          : c.iteration ? U.badge(`${c.state} · iteration ${D.iter(c.iteration).n}`, 'purple', 'badge-xs')
          : U.badge(c.state, 'purple', 'badge-xs')}</span></div>`).join('');
    const regs = (d.registries || []).filter(x => x.state !== 'NotFound').map(x => `<div class="row-kv">
        <span>${x.source} <span class="muted">${x.state === 'CheckFailed'
          ? `unreachable — last answer ${x.observed}` : `observed ${x.observed}`}</span></span>
        <span>${x.url ? `<a href="${x.url}" target="_blank" rel="noopener"
          class="badge badge-${M.REG_STATE_COLOR[x.state] || 'slate'} badge-xs">${x.raw || x.state} &#8599;</a>`
          : U.badge(x.raw || x.state, M.REG_STATE_COLOR[x.state] || 'slate', 'badge-xs')}</span></div>`).join('');
    if (!copies && !regs) return U.pcard('Existing copies',
      '<p class="fine">No copy anywhere VERA looks. Nothing to decide over.</p>');
    return U.pcard('Existing copies', copies +
      (decided ? `<div class="status-note status-note-blue" style="margin-top:.5rem"><span>&#9660;</span>
          <div><b>Approved as rescan</b> by ${D.byId(decided.rescan.by).name}, ${decided.rescan.at}:
          <span>${decided.rescan.note}</span></div></div>` : '') +
      (r.copies.some(c => c.afterApproval) && !decided
        ? `<p class="fine"><b>Found after approval</b>, so nobody decided over it.
            It is flagged in the list editor's pool, so it is never listed unseen.</p>` : '') +
      (regs ? `<div style="margin-top:.75rem">${regs}</div>
        <p class="fine">Registry answers are evidence: shown as the registry said them.</p>` : '') +
      (copies && !decided && !r.copies.some(c => c.afterApproval)
        ? `<p class="fine">A copy blocks nothing. Approving over it is a
            <b>rescan</b> — decided in Proposals, one item at a time.</p>` : ''));
  }

  function defectsCard(it) {
    const out = M.outstanding(it), v = M.validationOf(it);
    if (v === 'NotRequired' || v === 'Approved') return '';
    const link = may('validation.approve', it)
      ? '<a class="btn btn-sm" href="validation.html">Resolve in Documents Validations &#8594;</a>' : '';
    return U.pcard(`Defects — ${out.length} outstanding`,
      out.map(x => `<div class="row-kv"><span><b>${x.plugin} ${x.rule}</b>
          <span class="muted">${x.subject}</span><br>
          <span class="muted">${x.internalText}</span></span></div>`).join('') +
      (v === 'Denied' ? `<p class="fine"><b>Denied in review</b>${it.deniedNote ? ': ' + it.deniedNote : ''}</p>` : '') +
      `<p class="fine">Read-only here — accepting a defect is a decision, and
        deciding happens in Documents Validations.</p>`, link);
  }

  function addingCard(it) {
    const b = D.batchOf(it.id);
    if (!b || !may('addition.read', it)) return '';
    const failed = it.progress === 'IngestFailed';
    const acts = failed ? [
      can('addition.retry') ? '<button class="btn btn-sm">Retry</button>' : '',
      can('addition.read_payload') ? '<button class="btn btn-sm">Raw payload</button>' : ''
    ].join('') : '';
    return U.pcard('Adding', U.kv2([
        ['Batch', `<span class="mono">${b.id}</span> <span class="muted">${b.name}</span>`],
        ['Submitted', `${b.at} · ${D.byId(b.by).name}`],
        ['Ingest', failed ? U.badge('Failed', 'red', 'badge-xs') : U.badge('Ingested', 'green', 'badge-xs')],
        ['Attempts', `<span class="num">${it.attempts || 1}</span>`]
      ]) +
      (failed ? `<div class="status-note status-note-red" style="margin-top:.75rem"><span>&#9660;</span>
          <div><b>Could not be added:</b> <span>${it.ingestError}</span></div></div>` : '') +
      (failed && !acts ? `<p class="fine">Only an administrator can retry this. Ask
          about <b class="mono">${b.id}</b> — the batch is the unit they retry.</p>`
        : failed ? '<p class="fine">A failed ingest is retried, never deleted.</p>' : ''),
      acts);
  }

  const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const projLink = (p) => p && (can('project.decide') || can('project.read'))
    ? `<a href="projects.html?p=${p.id}">${p.name}</a>` : p ? p.name : '—';
  function digitizationCard(it) {
    const l = it.list ? D.listOf(it.list) : null;
    /* a curator sees the list an item is on — its name and dates — without
       list.read (decided 2026-09-26) */
    return U.pcard('Digitization', U.kv2([
      ['Progress', it.progress + (it.cancellation ? ' <span class="muted">· held here</span>' : '')],
      ['Project', projLink(it.project && D.proj(it.project))],
      ['List', l ? `${can('list.read') ? `<a href="lists.html?list=${l.id}">${l.name}</a>` : l.name}
        <span class="muted">· ${day(l.starts)} → ${day(l.ends)}</span>` : 'not on a list'],
      ...(M.atLeast(it.progress, 'Digitized') ? [['Available at', it.publishedLink
        ? `<a href="${it.publishedLink}" target="_blank" rel="noopener">${it.publishedLink.replace(/^https?:\/\//, '')}</a>`
        : '<span class="muted">not set yet — setting it makes it Published</span>']] : []),
      ['Cancelled', it.cancellation
        ? `${it.cancellation.cause === 'Decided' ? 'yes' : 'could not be digitized'} · ${D.byId(it.cancellation.by).name}, ${it.cancellation.at}`
        : '<span class="muted">no</span>']
    ]), l ? U.messageButton(`data-msg-list="${l.id}"`, 'Message…') : '');
  }

  function earlierCard(r) {
    if (!r.earlier.length) return '';
    return U.pcard(`Earlier iterations — ${r.earlier.length}`,
      r.earlier.map(e => `<div class="row-kv">
        <span><b>Iteration ${e.n || 1}</b> <span class="muted">${
          e.listName ? e.listName + ' · ' : ''}${e.dpi ? e.dpi + ' dpi · ' : ''}digitized ${e.digitizedAt || '—'}</span></span>
        <span>${U.statusBadge(e, 'badge-xs')}</span></div>`).join('') +
      `<p class="fine">One document, several attempts. The row shows the
        current one; the earlier scans stay here, and are the <b>VERA</b>
        copy a rescan was decided over.</p>`);
  }

  function catalogCard(d) {
    const pages = D.effectivePages(d);
    return U.pcard('Catalog record', U.kv2([
        ['Type', d.type], ['Unit', d.unit ? `${d.unit.value} <span class="muted">(${d.unit.type})</span>` : 'whole record'],
        ['Signature', d.signature || '—'], ['Catalog ID', `<span class="mono">${d.catalogId}</span>`]
      ]) +
      `<div style="margin-top:.875rem">${(d.pageSources || []).length
        ? d.pageSources.slice().sort((a, b) => b.tier - a.tier).map(p => `<div class="row-kv">
            <span>Pages — ${p.source} <span class="muted">tier ${p.tier}${p.by ? ' · ' + D.byId(p.by).name : ''}</span></span>
            <span class="num">${M.fmt(p.value)} ${pages && p.source === pages.source ? U.badge('in use', 'green', 'badge-xs') : ''}</span></div>`).join('')
        : '<p class="fine">No source answered a page count — that is a defect, not a blank.</p>'}</div>`,
      '<button class="btn btn-sm">Open in catalog &#8599;</button>');
  }

  function historyOf(r, pub) {
    const subjects = new Set([...r.its.map(i => i.id), ...r.reqs.map(x => x.id)]);
    const ev = D.log.filter(e => subjects.has(e.subject))
      .sort((a, b) => when(b.at) - when(a.at));
    const asked = (pub ? r.mine : r.reqs).map(x => ({ at: x.at, event: 'Asked for', actor: x.by }));
    const all = [...ev, ...asked].sort((a, b) => when(b.at) - when(a.at));
    return U.pcard(pub ? 'What has happened' : 'History',
      all.map(e => `<div class="row-kv"><span><b>${e.event}</b>${
          !pub && e.detail ? `<br><span class="muted">${e.detail}</span>` : ''}</span>
          <span class="muted">${e.at}${pub ? '' : ' · ' + (e.actor === 'sys' ? 'System' : D.byId(e.actor).name)}</span></div>`).join('') +
      `<p class="fine">Provenance lives in the history, not in a box of its own.</p>`);
  }

  /* ------------------------------------------------------------- the pane */

  function renderWide(r) {
    const d = r.d, it = r.cur, pages = D.effectivePages(d), where = whereNow(r);
    const head = U.paneHead(d.title,
      `<span class="mono">${M.docId(d)}</span> · ${d.type}${d.signature ? ' · ' + d.signature : ''}`,
      actionsOf(r));
    const note = hideIngest(it) ? `<div class="status-note status-note-red"><span>&#9660;</span>
        <div>${INGEST_OPAQUE}</div></div>`
      : it ? U.noteFor(it, 'staff')
      : r.lead.decision === 'Denied' ? `<div class="status-note status-note-red"><span>&#9660;</span>
          <div><b>Declined</b> by ${D.byId(r.lead.declinedBy).name}, ${r.lead.declinedAt}:
          <span>${r.lead.declineInternal}</span></div></div>`
      : (r.lead.approveOnCheck && r.copies.length) ? `<div class="status-note status-note-amber"><span>&#9660;</span>
          <div><b>Held for review:</b> <span>approval was asked for on arrival, and
          ${r.copies[0].source} already has it. Approving it now is a rescan, so a
          curator decides it on its own.</span></div></div>` : '';
    const facts = U.stats(it ? [
      { label: 'Status', value: `<span style="font-size:.9375rem">${U.statusBadge(it)}</span>` },
      { label: 'Category', value: `<span style="font-size:.9375rem">${M.catPath(D.pathOf(it.category))}</span>` },
      { label: 'Priority', value: `<span style="font-size:.9375rem">${U.prioBadge(it.priority)}</span>` },
      { label: 'Page count', value: pages ? M.fmt(pages.value) : '—',
        foot: pages ? `${pages.source} · tier ${pages.tier}` : 'no source answered' },
      { label: 'Where it is now', value: where.value, foot: where.foot },
      { label: 'Iteration', value: it.n || 1, foot: r.earlier.length ? 'earlier ones below' : 'the first attempt' }
    ] : [
      { label: 'Status', value: `<span style="font-size:.9375rem">${r.status.html}</span>` },
      { label: 'Askers', value: r.askers.length, foot: 'decided together' },
      { label: 'Where it is now', value: where.value, foot: where.foot }
    ]);
    const cards = [askersCard(r), copiesCard(r)];
    if (it) cards.push(defectsCard(it), addingCard(it), digitizationCard(it), earlierCard(r));
    cards.push(catalogCard(d), historyOf(r, false));
    return head + (note ? `<div style="margin-bottom:1rem">${note}</div>` : '') + facts + cards.join('');
  }

  function renderOwn(r) {
    const d = r.d, mineR = r.mine[0], v = r.status.v;
    const head = U.paneHead(d.title,
      `<span class="mono">${M.docId(d)}</span> · asked ${mineR.at}`, actionsOf(r));
    const note = v.note
      ? `<div class="status-note status-note-${v.note.tone}"><span>&#9660;</span>
           <div><b>${v.note.title}:</b> <span>${v.note.text}</span></div></div>`
      : mineR.decision === 'Denied' ? '' : v.it ? U.noteFor(v.it, 'public') : '';
    const link = U.registryCell(d, 'public');
    const facts = U.stats([
      { label: 'Status', value: `<span style="font-size:.9375rem">${r.status.html}</span>`,
        foot: 'the same words a notification carries' },
      { label: 'Asked', value: `<span style="font-size:.9375rem">${mineR.at}</span>` },
      { label: 'Read it', value: `<span style="font-size:.9375rem">${link.includes('href') ? link : 'Not yet'}</span>`,
        foot: link.includes('href') ? 'somewhere you can read it now' : 'you get a link the moment there is one' }
    ]);
    const why = mineR.reason ? U.pcard('Why I asked', `<p style="margin:0">${mineR.reason}</p>
      <p class="fine">Only you and the curator deciding read this.</p>`) : '';
    return head + (note ? `<div style="margin-bottom:1rem">${note}</div>` : '') + facts + why + historyOf(r, true);
  }

  const render = (key) => {
    const r = recs.find(x => x.id === key);
    return wide ? renderWide(r) : renderOwn(r);
  };

  /* ---------------------------------------------------------- propose */
  /* ONE dialog, one list of items — the original's Submit Proposals, kept.
     Items come in by whichever way is to hand, and every item runs the same
     check the moment it is added: the CATALOG gives the identifier (catalog
     ID + volume or issue, document-identity), then VERA looks itself up. So
     the list shows, per item, what submitting will do — propose it, join the
     work that exists ("ask for this too"), or nothing because the catalog
     does not know it. One item is a request; several are one batch.

     Ways in:  typed · catalog search · pasted list · file   — always
               auto-detect in a pasted list                  — IdentifierDetector
               barcode scan, with a scanner                  — always: a scanner
                                                               IS a keyboard
               barcode scan, with the camera                 — BarcodeReader
               photo capture                                 — CoverRecognition
     A way whose plugin is not running is ABSENT, not greyed. */

  const decider = can('request.decide');
  /* the projects I may propose into: a member, and not Rejected (projects.md §4) */
  const meU = D.byId(ME);
  const PROPOSE_INTO = D.projects.filter(p => p.state !== 'Rejected' && (p.members.includes(ME) ||
    D.groups.some(g => g.projects.includes(p.id) && (meU.groups || []).includes(g.id))));
  const LIMIT = decider ? Infinity : D.settings.proposeMaxAtOnce;
  const WAYS = [
    ['manual', 'Type it'], ['search', 'Catalog search'], ['paste', 'Paste list'],
    ['file', 'File upload'],
    ['barcode', 'Barcode scan'],
    ...(D.inputOn('photo') ? [['photo', 'Photo capture']] : [])
  ];
  /* the two ways that are a device, not typing, carry its picture — as in
     the original Submit Proposals */
  const ICON = {
    barcode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M4 5v14M7.5 5v14M10 5v14M13.5 5v14M17 5v14M20 5v14"/><path stroke-width="1" d="M5.75 5v14M15.25 5v14M18.5 5v14"/></svg>',
    photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>'
  };
  const detect = D.inputOn('autodetect');
  const TYPES = ['Catalog ID', 'CNBID', 'ISBN', 'ISSN', 'Barcode'];
  const typeOf = (v) => /^[A-Z]{3,4}\d\d-\d/.test(v) ? 'Catalog ID' : /^cnb/i.test(v) ? 'CNBID'
    : /^\d{4}-\d{3}[\dX]$/.test(v) ? 'ISSN' : /^97[89]/.test(v.replace(/-/g, '')) ? 'ISBN'
    : /^MZK-\d/.test(v) ? 'Barcode' : null;

  /* what the catalog answers, for the identifiers the demo knows. A record
     with units and no unit given asks WHICH — never the whole run by accident */
  const CAT = {
    'MZK01-001277001': { title: 'Slovácké noviny', units: { '1936–1938': 'D8', '1939': 'D24', '1940': null } },
    'MZK03-000556300': { title: 'Brněnský kalendář' },
    'MZK01-001622010': { title: 'Národní listy', units: { '1889': 'D20', '1890': null } },
    'MZK03-000112877': { title: 'Kniha o Brně', doc: 'D4' },
    'cnb001388120':    { title: 'Selské noviny · 1907–1911', doc: 'D13' },
    '978-80-7325-456-3': { title: 'Moravské kostely' },
    '1801-1234':       { title: 'Moravský hospodář', units: { 'roč. 1': null, 'roč. 2': null } },
    'MZK-2801-000341': { title: 'Hlas Moravy', doc: 'D5' },
    'MZK-2801-000977': { title: 'Brněnský deník · 1952' },
    'MZK-2801-000412': { title: 'Brněnský deník · 1953' },
    'MZK03-000778120': { title: 'Moravské kostely · Brno 1932' },
    'MZK03-000781004': { title: 'Moravské kostely a kaple · Brno 1948' },
    'MZK-2801-000533': { title: 'Kniha o Brně', doc: 'D4' },
    'MZK-2801-000618': { title: 'Brněnský deník · 1954' },
    'VKOL01-000456123': { title: 'Slovácké noviny', units: { '1941': null, '1942': null } },
    'NKC01-002345678': { title: 'Zlatá Praha', units: { 'roč. 12': null, 'roč. 13': null } }
  };

  /* Catalogs. A searchable one answers the search box; one that is not is
     still reachable — the user is sent to it, and pastes back the record
     link, which that catalog's adapter reads into an identifier. */
  const CATS = D.catalogs();
  const SEARCHABLE = CATS.filter(c => c.search), ELSEWHERE = CATS.filter(c => !c.search);
  const RESULTS = [
    ...Object.keys(CAT['MZK01-001277001'].units).map(u =>
      ({ cat: 'MZK Aleph', value: 'MZK01-001277001', unit: u, title: 'Slovácké noviny' })),
    { cat: 'VKOL Aleph', value: 'VKOL01-000456123', unit: '1941', title: 'Slovácké noviny' }
  ].filter(r => SEARCHABLE.some(c => c.name === r.cat));
  /* what an adapter recognises in a pasted link: Aleph's permalink carries
     the base and the record number */
  const fromLink = (v) => {
    const m = v.match(/doc_number=(\d+).*?local_base=(\w+)/) || v.match(/local_base=(\w+).*?doc_number=(\d+)/);
    if (!m) return null;
    const [num, base] = /^\d+$/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
    return `${base.toUpperCase()}01-${num}`;
  };

  function resolve(it) {
    if (!it.type) return Object.assign(it, { kind: 'badtype' });
    /* a record VERA already holds is its own answer */
    const held = D.documents.find(d => d.catalogId === it.value &&
      ((d.unit && d.unit.value) || '') === (it.unit || ''));
    const rec = held ? { title: held.title + (held.unit ? ' · ' + held.unit.value : ''), doc: held.id }
                     : CAT[Object.keys(CAT).find(k => k.replace(/-/g, '') === it.value.replace(/-/g, ''))];
    if (!rec) return Object.assign(it, { kind: 'missing' });
    it.title = rec.title;
    let docId = rec.doc || null;
    if (rec.units) {
      if (!it.unit || !(it.unit in rec.units)) return Object.assign(it, { kind: 'unit', units: Object.keys(rec.units) });
      docId = rec.units[it.unit];
      it.title = `${rec.title} · ${it.unit}`;
    }
    it.doc = docId;
    /* in VERA as LIVE work — an iteration, or a request still pending */
    const live = docId && (D.iterOfDoc(docId) ||
      D.requests.some(r => r.doc === docId && r.decision === 'Pending'));
    return Object.assign(it, { kind: live ? 'in' : 'new', asked: !!(docId && !live) });
  }

  function vStatus(docId) {
    const it = D.iterOfDoc(docId);
    if (it) return wide ? U.statusBadge(it, 'badge-xs')
      : U.badge(M.publicStatus(it), PUBLIC_COLOR[M.publicStatus(it)] || 'slate', 'badge-xs');
    return U.badge(wide ? 'Awaiting review' : 'Waiting for review', 'amber', 'badge-xs');
  }

  function outcome(it, i) {
    switch (it.kind) {
      case 'new': return U.badge('New', 'green', 'badge-xs') +
        (it.asked ? ' <span class="muted">asked before, nothing moving</span>' : '');
      case 'in': return `${U.badge('In VERA', 'blue', 'badge-xs')} ${vStatus(it.doc)}
        <span class="muted">· ask for this too</span>`;
      case 'unit': return `${U.badge('Which volume?', 'amber', 'badge-xs')}
        <select data-unit="${i}"><option value="">choose…</option>${
          it.units.map(u => `<option>${u}</option>`).join('')}</select>`;
      case 'badtype': return `${U.badge('Not a known identifier', 'red', 'badge-xs')}
        <span class="muted">pick its type</span>`;
      default: return `${U.badge('Not in the catalog', 'red', 'badge-xs')}
        <span class="muted">will be skipped</span>`;
    }
  }
  const CLS = { new: '', in: '', unit: 'line-fix', badtype: 'line-skip', missing: 'line-skip' };

  function tally(items) {
    const c = { new: 0, in: 0, open: 0, skip: 0 };
    items.forEach(x => x.kind === 'new' ? c.new++ : x.kind === 'in' ? c.in++
      : x.kind === 'unit' ? c.open++ : c.skip++);
    return c;
  }

  function wayPanel(st) {
    const w = st.way;
    if (w === 'manual') return `<div class="way">
        <select id="mType">${TYPES.map(t => `<option>${t}</option>`).join('')}</select>
        <input id="mVal" class="mono" value="MZK03-000556300" placeholder="value">
        <input id="mUnit" placeholder="volume or issue — optional">
        <button class="btn btn-sm" data-add="manual">+ Add</button></div>`;
    if (w === 'search') {
      const shown = RESULTS.filter(r => !st.cat || r.cat === st.cat);
      return `<div class="way way-col">
        ${SEARCHABLE.length ? `<div class="way">
          <input class="search" style="flex:1" value="Slovácké noviny">
          ${SEARCHABLE.length > 1 ? `<select id="sCat">
            <option value="">All searchable catalogs (${SEARCHABLE.length})</option>${
            SEARCHABLE.map(c => `<option ${c.name === st.cat ? 'selected' : ''}>${c.name}</option>`).join('')}</select>` : ''}
        </div>
        ${shown.map(r => `<div class="row-kv">
          <span><b>${r.title}</b> · ${r.unit} <span class="muted mono">${r.value}</span>
            ${SEARCHABLE.length > 1 ? U.badge(r.cat, 'slate', 'badge-xs') : ''}</span>
          <button class="btn btn-sm" data-add="search" data-r="${RESULTS.indexOf(r)}">+ Add</button></div>`).join('')}`
        : '<p class="fine" style="margin:0">No catalog can be searched from here.</p>'}
        ${ELSEWHERE.length ? `<div class="elsewhere">
          <b>Not searchable from here</b>
          ${ELSEWHERE.map(c => `<div class="row-kv"><span>${c.name}
              <span class="muted">— find it there, then copy ${c.linkHint || 'the address of the record page'}</span></span>
            <a class="btn btn-sm" href="${c.opac}" target="_blank" rel="noopener">Open ${c.name} &#8599;</a></div>`).join('')}
          <div class="way" style="margin-top:.5rem">
            <input id="lnk" class="mono" style="flex:1"
              value="${st.lnk.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"
              placeholder="Paste the record link, or its ID">
            <button class="btn btn-sm" data-add="link">+ Add</button></div>
        </div>` : ''}</div>`;
    }
    if (w === 'paste') return `<div class="way way-col">
        <textarea id="pText" rows="5" class="mono">MZK01-001622010;1889
cnb001388120
1801-1234
978-80-7325-456-3
MZK09-999999999</textarea>
        <div class="way"><span class="muted">One per line — identifier ; volume or issue ; why.</span>
          <select id="pType" style="margin-left:auto">${detect ? '<option value="">Auto-detect type</option>' : ''}${
            TYPES.map(t => `<option>${t}</option>`).join('')}</select>
          <button class="btn btn-sm" data-add="paste">Parse &amp; add</button></div>
        ${detect ? '' : `<p class="fine" style="margin:0">Every line is read as the type chosen —
          auto-detect needs an identifier detector plugin.</p>`}</div>`;
    if (w === 'file') return `<div class="drop"><span class="drop-i">${ICON.file}</span>
        <b>Drop a CSV or TXT file</b><span class="muted">columns: identifier ; volume or issue ; why</span>
        <button class="btn btn-sm" data-add="file">Choose file…</button></div>`;
    /* CONTINUOUS. A hardware scanner types the code and presses Enter, like a
       keyboard — so a focused field that adds on Enter, clears and waits is
       the whole integration. Ten books are ten scans and no clicks. The
       camera is the same loop fed by the BarcodeReader plugin instead. */
    if (w === 'barcode') {
      const cam = D.inputOn('barcode');
      if (!st.scanning) return `<div class="drop"><span class="drop-i">${ICON.barcode}</span>
          <b>Scan one book after another</b>
          <span class="muted">Each scan is added as it arrives — nothing to click
            between books. A scanner works as it is; it types the code and presses Enter.</span>
          <div class="way" style="margin-top:.25rem">
            <button class="btn btn-sm btn-primary" data-scan="scanner">Start scanning</button>
            ${cam ? '<button class="btn btn-sm" data-scan="camera">Use the camera</button>' : ''}</div></div>`;
      return `<div class="scanning ${st.flash || ''}">
          ${st.scanning === 'camera' ? '<div class="scanframe"><i></i></div>' : ''}
          <div class="scan-live"><span class="dot"></span>Scanning${
            st.scanning === 'camera' ? ' with the camera' : ''} · <b>${st.scanned}</b> this session</div>
          ${st.scanning === 'scanner' ? `<input id="scanIn" class="mono" autocomplete="off" spellcheck="false"
            placeholder="waiting for a barcode…">
            <div class="scan-paused">Paused — the field lost focus. <b>Click here</b> to go on scanning.</div>` : ''}
          <div class="scan-last">${st.last || 'Scan the first book.'}</div>
          <div class="way"><button class="btn btn-sm" data-stop>Stop scanning</button>
            <span class="muted">or Esc</span>
            <button class="btn btn-sm demo-only" data-sim style="margin-left:auto">demo: simulate a scan</button></div>
        </div>`;
    }
    /* NOT a slower barcode scan. A photo is read — the identifiers on it if
       there are any, and the TEXT when there are none: an 1932 catalog card has
       no ISBN, only a title, an author, a place and year and a shelf mark. The
       plugin then matches that against the catalog, and what comes back are
       CANDIDATES with the reason each matched. Reading can be wrong, so
       nothing is added until somebody picks. */
    if (w === 'photo') return st.photo ? `<div class="photo-read">
        <div class="photo-card"><span>Kratochvíl, Josef</span><b>Moravské kostely</b>
          <span>Brno : Moravský kraj, 1932</span><span>212 s. : il.</span><i>MB2-0433</i></div>
        <div class="photo-out">
          <div class="k">Read from the photo <span class="muted">— a catalog card</span></div>
          <div class="read">${PHOTO.read.map(([k, v, conf]) => `<span><span class="muted">${k}</span> ${v}${
            conf < .8 ? ` <span class="conf">${Math.round(conf * 100)}%</span>` : ''}</span>`).join('')}</div>
          <div class="read-none">No ISBN, ISSN or barcode on it — matched by the text.</div>
          <div class="k" style="margin-top:.75rem">Records that match</div>
          ${PHOTO.matches.map(m => `<div class="row-kv"><span><b>${m.title}</b>
              <span class="muted mono">${m.value}</span><br><span class="muted">${m.why}</span></span>
            <button class="btn btn-sm" data-add="photo" data-v="${m.value}">+ Add</button></div>`).join('')}
          <div class="way" style="margin-top:.5rem">
            <button class="btn btn-sm" data-way="search">None of these — search the catalog</button>
            <button class="btn btn-sm" data-retake>Take another</button></div>
        </div></div>`
      : `<div class="drop"><span class="drop-i">${ICON.photo}</span>
        <b>Photo of a cover, title page or catalog card</b>
        <span class="muted">It is read — identifiers if there are any, the title, author and
          year if there are not — and matched to catalog records for you to pick from.</span>
        <button class="btn btn-sm" data-shoot>Take photo</button></div>`;
    return '';
  }

  function proposeHTML(st) {
    const c = tally(st.items), n = st.items.length;
    const steps = ['Items', 'Details', 'Submitted'];
    const shell = (body, foot) => `<div class="modal modal-wide" role="dialog" aria-label="Propose">
      <div class="modal-head"><h2>Propose</h2>
        <button class="modal-x" data-x aria-label="Close">&times;</button>
        <div class="steps">${steps.map((x, i) =>
          `${i ? '<span class="step-line"></span>' : ''}<span class="step ${i === st.step ? 'on'
            : i < st.step ? 'done' : ''}"><i>${i < st.step ? '&#10003;' : i + 1}</i>${x}</span>`).join('')}</div></div>
      <div class="modal-body">${body}</div>
      <div class="modal-foot">${foot}</div></div>`;

    if (st.step === 0) return shell(`
        <div class="waytabs">${WAYS.map(([k, l]) =>
          `<button class="${k === st.way ? 'on' : ''}" data-way="${k}">${k !== 'file' && ICON[k] || ''}${l}</button>`).join('')}</div>
        ${wayPanel(st)}
        ${st.msg ? `<div class="status-note status-note-amber" style="margin-top:.625rem"><span>&#9660;</span>
          <div>${st.msg}</div></div>` : ''}
        <div class="lines-head"><span>${n ? `${n} ${n === 1 ? 'item' : 'items'}` : 'No items yet'}${
            LIMIT < Infinity ? ` <span class="muted">· at most ${LIMIT} at once</span>` : ''}</span>
          ${n ? `<span class="muted">${c.new} new · ${c.in} already in VERA${
            c.open ? ` · ${c.open} to resolve` : ''}${c.skip ? ` · ${c.skip} will be skipped` : ''}</span>` : ''}</div>
        ${n ? `<div class="lines">${st.items.map((it, i) => `<div class="line ${CLS[it.kind]}">
            <span class="line-n">${i + 1}</span>
            <span class="line-id"><span class="mono">${it.type || '?'} · ${it.value}${it.unit ? ' · ' + it.unit : ''}</span>
              <span class="src">${it.source}</span>${it.title ? `<br><b>${it.title}</b>` : ''}</span>
            <span class="line-o">${outcome(it, i)}</span>
            <button class="line-x" data-del="${i}" title="Remove">&times;</button></div>`).join('')}</div>`
          : `<p class="fine">Add items any way you like and mix them — each is
              checked as it lands, so you see what submitting will do before you do it.</p>`}`,
      `<button class="btn foot-left" data-x>Cancel</button>
       <button class="btn btn-primary" data-next ${!c.new && !c.in || c.open
         ? `disabled title="${c.open ? 'Choose the volume, or remove the item' : 'Nothing to submit yet'}"` : ''}>Continue</button>`);

    if (st.step === 1) return shell(`
        ${wide && c.new + c.in > 1 ? `<label class="fld" style="margin-top:0">Batch name
            <input class="search" style="display:block;width:100%;margin-top:.375rem" value="proposals-2026-09-25"></label>` : ''}
        <label class="fld" ${wide && c.new + c.in > 1 ? '' : 'style="margin-top:0"'}>Why
          <span class="muted">— optional; argues for a priority${n > 1 ? '. An item\'s own reason wins' : ''}</span>
          <textarea rows="3" placeholder="Research, exhibition, a reader's request…"></textarea></label>
        ${PROPOSE_INTO.length ? `<label class="fld">Project <span class="muted">— optional; the ones you are a member of</span>
            <select id="pProj"><option value="">No project</option>${PROPOSE_INTO.map(p =>
              `<option value="${p.id}">${p.name} · ${p.state.toLowerCase()}</option>`).join('')}</select></label>
          <p class="fine" style="margin-top:.25rem">Into a proposed project, it is approved with the project. Into an approved one,
            it is marked <i>after the project's approval</i> and decided on its own.</p>` : ''}
        ${decider && c.new ? `
          <div class="fld-row">
            <label class="fld">Category <span class="muted">— for the ${c.new} new</span>
              <select>${D.categories.filter(x => D.isLeaf(x.id)).map(x =>
              `<option>${M.catPath(D.pathOf(x.id))}</option>`).join('')}</select></label>
            <label class="fld">Priority <select>${M.PRIORITY_DESC.map(p =>
              `<option ${p === 'Normal' ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
          </div>
          <label class="chk"><input type="checkbox" checked> <span><b>Approve now</b> — the
            ${c.new} new skip review.
            <span class="muted">Applied item by item after the checks. Any with an
            existing copy is <b>held in Proposals</b>: a rescan is always decided on its
            own. ${c.in ? `The ${c.in} already in VERA are not touched — they join work
            already decided, or being decided for every asker at once.` : ''}</span></span></label>` : ''}
        <p class="fine">${c.new} to propose · ${c.in} to join${c.skip ? ` · ${c.skip} skipped` : ''}</p>`,
      `<button class="btn foot-left" data-back>Back</button>
       <button class="btn btn-primary" data-next>Submit</button>`);

    return shell(`
        <div class="status-note status-note-green"><span>&#9660;</span><div>${
          wide && c.new + c.in > 1 ? '<b>Submitted as B-0146</b> <span>proposals-2026-09-25</span>'
                                   : '<b>Submitted.</b>'}</div></div>
        <div class="lines" style="margin-top:.75rem">
          ${c.new ? `<div class="line"><span class="line-n">${c.new}</span><span class="line-id">${decider
            ? 'proposed with approval requested — approved as the checks finish, or held in Proposals if a copy exists'
            : 'proposed — waiting for review'}</span></div>` : ''}
          ${c.in ? `<div class="line"><span class="line-n">${c.in}</span><span class="line-id">joined work already in VERA — you follow it</span></div>` : ''}
          ${c.skip ? `<div class="line line-skip"><span class="line-n">${c.skip}</span><span class="line-id">skipped — not in the catalog
            <button class="btn btn-sm" style="margin-left:.5rem">Download skipped</button></span></div>` : ''}
        </div>
        <p class="fine">Each is in ${title} from now on, whatever stage it reaches.${
          can('addition.read') && c.new + c.in > 1 ? ' <b>Group by batch</b> shows them together.' : ''}</p>`,
      '<button class="btn btn-primary" data-x>Done</button>');
  }

  /* the demo's inputs — what each way would have produced */
  const FEED = {
    file:    [['MZK01-001277001', '1940', 'Seminar on the Slovácko press'], ['MZK03-000112877'],
              ['MZK01-001277001']],
    /* what the demo's scanner "reads" — including a repeat and an unknown one */
    barcode: ['MZK-2801-000341', 'MZK-2801-000977', '9788073254563', 'MZK-2801-000412',
              'MZK-2801-000341', 'MZK-2801-000533', 'MZK-2801-099999', 'MZK-2801-000618'],
  };
  /* what the demo's photo is read as, and what the catalog matched */
  const PHOTO = {
    read: [['Title', 'Moravské kostely', .97], ['Author', 'Kratochvíl, Josef', .93],
           ['Place, year', 'Brno, 1932', .91], ['Extent', '212 s.', .74], ['Shelf mark', 'MB2-0433', .88]],
    matches: [
      { value: 'MZK03-000778120', title: 'Moravské kostely · Brno 1932',
        why: 'title, author, year and shelf mark match' },
      { value: 'MZK03-000781004', title: 'Moravské kostely a kaple · Brno 1948',
        why: 'title partly, same author — year differs' }
    ]
  };
  const SOURCE = { manual: 'typed', search: 'catalog search', link: 'pasted link', paste: 'pasted',
                   file: 'bibliography.csv', barcode: 'barcode', photo: 'photo' };

  function openPropose(seed) {
    let host = document.getElementById('propose');
    if (!host) {
      host = document.createElement('div');
      host.id = 'propose'; host.className = 'modal-scrim';
      document.getElementById('app').appendChild(host);
    }
    const st = { step: 0, way: 'manual', items: seed ? [seed] : [], msg: '', fed: {}, cat: '',
      lnk: 'https://aleph.nkp.cz/F/?func=direct&doc_number=002345678&local_base=NKC' };

    /* adding respects the limit and never adds the same item twice */
    const add = (list) => {
      let over = 0, dup = 0;
      list.forEach(x => {
        const it = resolve(Object.assign({ unit: '' }, x));
        if (st.items.some(y => y.value === it.value && (y.unit || '') === (it.unit || ''))) { dup++; return; }
        if (st.items.length >= LIMIT) { over++; return; }
        st.items.push(it);
      });
      st.msg = [over && `<b>${over} not added</b> — at most ${LIMIT} at once. Submit these,
                  then propose the rest; a curator reviews every one of them.`,
                dup && `${dup} already on this list — added once.`].filter(Boolean).join(' ');
    };
    const val = (id) => (host.querySelector('#' + id) || {}).value || '';

    /* one scan: add it, say what happened in a word, and wait for the next.
       The limit stops the session rather than silently eating scans. */
    const scanned = (code) => {
      const before = st.items.length;
      add([{ value: code, type: typeOf(code) || 'Barcode', source: 'barcode' }]);
      const it = st.items.length > before ? st.items[st.items.length - 1] : null;
      if (it) {
        st.scanned++;
        st.flash = it.kind === 'missing' ? 'bad' : 'ok';
        st.last = `<span class="mono">${code}</span> — ${it.kind === 'missing'
          ? '<b style="color:var(--tone-red-fg)">not in the catalog</b>, will be skipped'
          : `<b>${it.title}</b>${it.kind === 'in' ? ' · already in VERA, you will join it' : ' · added'}`}`;
      } else if (st.items.length >= LIMIT) {
        st.scanning = null; st.flash = '';
      } else {
        st.flash = 'dup';
        st.last = `<span class="mono">${code}</span> — already on the list, not added twice`;
      }
      draw();
    };

    const draw = () => {
      host.innerHTML = proposeHTML(st);
      const on = (sel, fn) => host.querySelectorAll(sel).forEach(b => b.onclick = () => { fn(b); draw(); });
      host.querySelectorAll('[data-x]').forEach(b => b.onclick = () => host.remove());
      on('[data-way]', b => { st.way = b.dataset.way; st.msg = ''; });
      on('[data-shoot]', () => { st.photo = true; });
      on('[data-scan]', b => { st.scanning = b.dataset.scan; st.scanned = 0; st.last = ''; st.msg = ''; });
      on('[data-stop]', () => { st.scanning = null; st.flash = ''; });
      const sim = host.querySelector('[data-sim]');
      if (sim) sim.onclick = () => {
        const n = st.fed.barcode || 0; st.fed.barcode = n + 1;
        const code = FEED.barcode[n % FEED.barcode.length];
        const f = host.querySelector('#scanIn');
        if (!f) return scanned(code);
        /* typed the way a scanner types: fast, then Enter */
        f.focus(); f.value = '';
        [...code].forEach((ch, i) => setTimeout(() => { f.value += ch; }, i * 12));
        setTimeout(() => f.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })),
                   code.length * 12 + 20);
      };
      const f = host.querySelector('#scanIn');
      if (f) {
        f.focus();
        f.onkeydown = (e) => {
          if (e.key === 'Enter') { e.preventDefault(); const v = f.value.trim(); f.value = ''; if (v) scanned(v); }
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); st.scanning = null; draw(); }
        };
        host.querySelector('.scanning').onclick = (e) => { if (!e.target.closest('button')) f.focus(); };
      }
      on('[data-retake]', () => { st.photo = false; });
      on('[data-next]', () => { st.step++; });
      on('[data-back]', () => { st.step--; });
      on('[data-del]', b => { st.items.splice(+b.dataset.del, 1); st.msg = ''; });
      const sc = host.querySelector('#sCat');
      if (sc) sc.onchange = () => { st.cat = sc.value; draw(); };
      host.querySelectorAll('[data-unit]').forEach(x => x.onchange = () => {
        const it = st.items[+x.dataset.unit]; it.unit = x.value; resolve(it); draw(); });
      on('[data-add]', b => {
        const w = b.dataset.add, source = SOURCE[w];
        if (w === 'manual') {
          const v = val('mVal').trim();
          add([{ value: v, unit: val('mUnit').trim(), type: typeOf(v) === val('mType') ? val('mType') : null, source }]);
        } else if (w === 'search') {
          const r = RESULTS[+b.dataset.r];
          add([{ value: r.value, unit: r.unit, type: 'Catalog ID', source: `search · ${r.cat}` }]);
        } else if (w === 'link') {
          const raw = st.lnk = val('lnk').trim(), v = fromLink(raw) || raw;
          if (!typeOf(v)) { st.msg = `<b>That link does not point at a record</b> — open the record
            itself and copy its permanent link, or paste the record ID.`; return; }
          add([{ value: v, type: typeOf(v), source: 'pasted link' }]);
        } else if (w === 'paste') {
          const chosen = val('pType');
          add(val('pText').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
            const [raw, u, why] = l.split(';').map(x => (x || '').trim());
            const v = fromLink(raw) || raw;       /* a record link is as good as its ID */
            const t = typeOf(v);
            return { value: v, unit: u, reason: why, source,
                     type: chosen ? (t === chosen ? chosen : null) : t };
          }));
        } else if (w === 'photo') {
          add([{ value: b.dataset.v, type: typeOf(b.dataset.v), source }]);
        } else {
          const i = st.fed[w] || 0, list = FEED[w];
          const batch = w === 'file' ? list : [list[i % list.length]];
          st.fed[w] = i + 1;
          add(batch.map(([v, u, why]) => ({ value: v, unit: u, reason: why, type: typeOf(v), source })));
        }
      });
    };
    host.onclick = (e) => { if (e.target === host) host.remove(); };
    draw();
  }

  /* P1 — the link where the scan is available. Setting it makes the item
     Published; it is iteration.publish (curator at custody, admin at any). */
  function publish(it) {
    const host = document.createElement('div');
    host.className = 'modal-scrim';
    host.innerHTML = `<div class="modal"><div class="modal-head"><h2>Where it is available</h2>
        <button class="modal-x" data-x aria-label="Close">&times;</button></div>
      <div class="modal-body">
        <label class="fld" style="margin-top:0">Link <span class="muted">— where a reader opens the scan</span>
          <input class="search" id="pubL" style="display:block;width:100%;max-width:none;margin-top:.375rem"
            value="${it.publishedLink || 'https://kramerius.mzk.cz/view/uuid:'}"></label>
        <p class="fine">${it.progress === 'Published' ? 'It stays Published; the history keeps the old link.'
          : 'Saving makes it <b>Published</b>: everyone who asked is told, with the link.'}</p></div>
      <div class="modal-foot"><button class="btn foot-left" data-x>Cancel</button>
        <button class="btn btn-primary" data-ok>Save</button></div></div>`;
    document.getElementById('app').appendChild(host);
    host.querySelectorAll('[data-x]').forEach(b => b.onclick = () => host.remove());
    host.querySelector('[data-ok]').onclick = () => {
      const v = host.querySelector('#pubL').value.trim();
      if (!/^https?:\/\/\S+[^:/]$/.test(v)) { host.querySelector('#pubL').focus(); return; }
      const was = it.progress;
      it.publishedLink = v; it.progress = 'Published';
      D.log.push({ subject: it.id, at: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + new Date().toTimeString().slice(0, 5),
        actor: ME, event: was === 'Published' ? 'Link changed' : 'Published', detail: v });
      host.remove();
      const sel = document.querySelector('.lrow.selected'); if (sel) sel.click();
    };
  }

  /* ------------------------------------------------------------- mount */

  const hrefD = (k, v) => { const u = new URLSearchParams(q); v ? u.set(k, v) : u.delete(k); const x = u.toString(); return 'documents.html' + (x ? '?' + x : ''); };
  const PROJ_OPTS = D.projects.map(p => ({ ...p, facetCount: [...recsAll.values()].filter(r => r.project && r.project.id === p.id).length }))
    .filter(p => p.facetCount > 0);
  const quick = `
    <select class="addfilter" id="fStatus"><option value="">Status: any</option>${
      statuses.map(s => `<option value="${s}" ${s === statusF ? 'selected' : ''}>${s} (${statusCounts.get(s)})</option>`).join('')}</select>
    ${wide ? `<label class="qf"><input type="checkbox" id="fMine" ${mineOnly ? 'checked' : ''}> Mine</label>` : ''}`;

  U.splitPage({
    tier, active: 'documents', role, audience,
    title,
    subtitle: wide ? `${recs.length} documents` : `${recs.length} documents · ${D.byId(ME).name}`,
    filters: {
      search: wide ? 'Search — title, catalog ID, volume, signature, cnb…, year'
                   : 'Search my documents…',
      query,
      chips: [catF && { k: 'Category', v: D.pathOf(catF).join(' › '), drop: dropCat() },
        projF && { k: 'Project', v: D.proj(projF).name, drop: hrefD('project', '') }].filter(Boolean),
      options: [['Project', PROJ_OPTS.filter(p => p.id !== projF).map(p => [`${p.name} (${p.facetCount})`, hrefD('project', p.id)])]],
      available: wide ? ['Category', 'Priority', 'Existing copy', 'Asked by'] : [],
      right: quick
    },
    actions: can('request.create')
      ? '<button class="btn btn-primary btn-sm" id="proposeBtn">Propose</button>' : '',
    count: `${recs.length} ${recs.length === 1 ? 'document' : 'documents'}`,
    countRight: `<select class="groupby" id="fGroup"><option value="">No grouping</option>${
        can('addition.read') ? `<option value="batch" ${byBatch ? 'selected' : ''}>Group by batch</option>` : ''}
           <option value="project" ${byProject ? 'selected' : ''}>Group by project</option></select>`,
    rows: orderedRows,
    listHTML, open: query && recs.length === 1 ? recs[0].id : q.get('doc'),
    columns: COLUMNS,
    empty: 'Nothing matches. Clear a filter to see more.',
    render,
    footer: wide
      ? `<b>One row is a document</b> — its askers, then its current iteration.
         A proposal, an addition and a document are the same row at different
         stages, so nothing changes page on approval.
         <br><b>Absent, not disabled:</b> switch <i>as</i> — a reader gets
         <i>My Documents</i>, a curator's acts stop at their custody
         (Periodicals), and retry and raw payload exist for admin only.
         <br><b>Forbidding is a rule's, never a person's</b>; a failed ingest is retried, never deleted.
         <br>Not here: approve · decline · accepting a defect · bulk actions.`
      : `<b>Everything here is the public wording</b> — the sentence a
         notification would carry. The machinery (priority, category, who else
         asked, the ingest batch) is absent, not greyed out.
         <br>Not here: approve / deny · internal reasons · anybody else's documents.`
  });

  /* wiring — the selects and the one CTA */
  const byId = (id) => document.getElementById(id);
  if (byId('fStatus')) byId('fStatus').onchange = (e) => go('status', e.target.value);
  if (byId('fMine')) byId('fMine').onchange = (e) => go('mine', e.target.checked ? '1' : '');
  if (byId('fGroup')) byId('fGroup').onchange = (e) => go('group', e.target.value);
  if (byId('proposeBtn')) byId('proposeBtn').onclick = () => openPropose(null);
  /* "ask for this too" from a record opens the dialog with that record on
     the list — more can be added before submitting */
  document.querySelector('.pane').addEventListener('click', (e) => {
    const pb = e.target.closest('[data-publish]');
    if (pb) return publish(D.iter(pb.dataset.publish));
    const ml = e.target.closest('[data-msg-list]');
    if (ml) { const l = D.listOf(ml.dataset.msgList), it = recs.find(x => x.cur && x.cur.list === l.id);
      /* messaging.md §3 — an item on a list: the list's author */
      return U.message({ about: `${l.name} ${l.id}`, link: `lists.html?list=${l.id}`, sender: ME,
        context: it ? `About ${it.d.title} ${M.docIdShort(it.d)} on the list` : '', to: [l.createdBy], toLabel: 'the list\'s author' }); }
    const b = e.target.closest('[data-ask]');
    if (!b) return;
    const d = D.doc(b.dataset.ask);
    /* the record already IS the identifier the catalog would have given */
    openPropose(resolve({ value: d.catalogId, unit: d.unit ? d.unit.value : '', type: 'Catalog ID',
      source: 'this record' }));
  });
};
