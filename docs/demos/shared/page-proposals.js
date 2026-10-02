/* Proposals — /review/proposals   (Proposal Review, view-map §2.2)
   row      one DOCUMENT, not one ask — five asks, one decision
   scope    pending proposals the curator may decide
   opens on awaiting a decision, oldest first — Declined and Withdrawn are
            one filter away, hidden by default and never absent
   actor    anybody holding request.decide. At `any` they see and decide
            every proposal; at `custody` only those in a PROPOSAL CUSTODY
            they are a member of (proposal-custody.md). Which custodies a
            proposal is in is the Custody plugins' answer, live, never typed.

   A curator cannot approve for one asker and deny for another: there would
   be one iteration either way (status-model §2.7). The REASONS are per
   asker, and they are what argues for a priority above Normal.

   Approving is an EDITOR, not a confirm: it is the one place a human sets
   category and priority. So the decision lives in the pane, where there is
   room for both pickers and for a reason everybody who asked will read.

   Group by batch: a batch is one submission — a shelf scanned, a list
   pasted, a harvest. It is context for reviewing, never a decision unit; a
   document asked for in two batches is ONE row, listed with its earliest
   ask. The batch header carries the bulk approve, which skips rescans and
   anything whose checks have not run (use cases C1, C5).

   Shape: MASTER–DETAIL. At large and notebook the list reads as a table
   beside the record, as in Documents; small and phone keep stacked rows. */

window.PAGE_PROPOSALS = function (tier) {
  const M = VERA, D = VERA_DATA, U = VERA_UI;
  const role = U.currentRole('curator');
  const held = U.permsOf(role);
  const can = (p) => held.has(p);
  const decider = can('request.decide');
  const me = U.userOf(role);
  const everywhere = U.scopesOf(role, 'request.decide').includes('any');

  /* Proposal custody, not category custody: a proposal has no category
     until it is approved. Custody plugins place it in custodies by name; at
     `custody` a curator reaches the custodies they are in — directly or
     through a group — and may classify into any leaf when approving. */
  const meU = D.byId(me);
  const inCust = (c) => c.users.includes(me) || c.groups.some(g => (meU.groups || []).includes(g));
  const MINE = D.proposalCustodies.filter(c => everywhere || inCust(c)).map(c => c.id);
  const reaches = (rq) => everywhere || D.custodiesOf(rq).some(id => MINE.includes(id));
  const custName = (id) => D.proposalCustodies.find(c => c.id === id).name;
  const LEAVES = D.categories.filter(c => D.isLeaf(c.id));
  const TYPES = [...new Set(D.documents.map(d => d.type))].sort();

  /* ------------------------------------------------------------ query */
  const q = new URLSearchParams(location.search);
  const SHOW = [['', 'Awaiting a decision'], ['Denied', 'Declined'], ['Withdrawn', 'Withdrawn'], ['all', 'Everything']];
  const show = q.get('show') || '';
  const group = ['batch', 'requester'].includes(q.get('group')) ? q.get('group') : '';
  const go = (k, v) => { v ? q.set(k, v) : q.delete(k); location.search = q.toString(); };
  const kept = show === 'all' ? ['Pending', 'Denied', 'Withdrawn'] : [show || 'Pending'];
  const typeF = TYPES.includes(q.get('type')) ? q.get('type') : '';
  const custF = MINE.includes(q.get('custody')) ? q.get('custody') : '';
  const PROJECTS = D.projects.filter(p => D.requests.some(r => r.project === p.id));
  const projF = D.proj(q.get('project')) ? q.get('project') : '';
  const href = (k, v) => { const u = new URLSearchParams(q); v ? u.set(k, v) : u.delete(k);
    return '?' + u.toString(); };

  /* ---------------------------------------------------------- records */
  const when = (s) => Date.parse(s) || 0;
  const byDoc = new Map();
  D.requests.filter(r => kept.includes(r.decision) && reaches(r)
      && (!custF || D.custodiesOf(r).includes(custF)) && (!projF || r.project === projF)).forEach(r => {
    if (!byDoc.has(r.doc)) byDoc.set(r.doc, []);
    byDoc.get(r.doc).push(r);
  });
  const recs = [...byDoc.entries()].filter(([docId]) => !typeF || D.doc(docId).type === typeF)
    .map(([docId, reqs]) => {
    reqs.sort((a, b) => when(a.at) - when(b.at) || a.id.localeCompare(b.id));
    const copies = reqs.flatMap(r => r.existingCopies || []);
    const unchecked = reqs.some(r => r.checkedAt === null);
    const projects = [...new Set(reqs.map(r => r.project).filter(Boolean))].map(D.proj);
    const rec = { id: docId, d: D.doc(docId), reqs, first: reqs[0], decision: reqs[0].decision,
      copies, unchecked, heldIntent: reqs.some(r => r.approveOnCheck), projects,
      after: reqs.some(r => r.afterApproval),
      custodies: [...new Set(reqs.flatMap(D.custodiesOf))],
      batches: [...new Set(reqs.map(r => r.batch).filter(Boolean))] };
    /* what the bulk approve may take: no rescan, nothing unchecked */
    rec.bulkable = rec.decision === 'Pending' && !copies.length && !unchecked;
    return rec;
  }).sort((a, b) => (a.decision !== 'Pending') - (b.decision !== 'Pending')
    || when(a.first.at) - when(b.first.at) || a.d.title.localeCompare(b.d.title));

  const asks = recs.reduce((a, r) => a + r.reqs.length, 0);

  function statusOf(r) {
    if (r.decision === 'Denied') return U.badge('Declined', 'red');
    if (r.decision === 'Withdrawn') return U.badge('Withdrawn', 'slate');
    if (r.unchecked) return U.badge('Being checked', 'slate');
    if (r.heldIntent && r.copies.length) return U.badge('Held: asked to add', 'amber');
    return U.badge('Awaiting review', 'amber');
  }

  /* a batch's name, as the list and the pane say it */
  const batchName = (id) => { const b = D.batches.find(x => x.id === id);
    return `<span class="mono">${b.id}</span> · ${b.via}`; };

  /* ----------------------------------------------------------- the row */

  /* one reason verbatim, or the COUNT — never a truncated pick of one,
     which would silently privilege whoever asked first */
  function whyOf(r, groupBatch) {
    if (r.decision === 'Denied') return `<b style="color:var(--tone-red-fg)">Declined:</b> ${r.first.declinePublic}`;
    if (r.decision === 'Withdrawn') return `<b>Withdrawn</b> ${r.first.withdrawnAt || ''} — “${r.first.reason}”`;
    const bits = [];
    if (r.copies.length) bits.push(`<b style="color:var(--tone-purple-fg)">${r.copies[0].source} already has it</b> — approving is a rescan, decided on its own`);
    else if (r.unchecked) bits.push('<b>Checks still running</b> — the copy check has not answered yet');
    r.projects.forEach(p => bits.push(`<span class="pp-proj">${p.name}</span>${
      r.after ? ' <span class="muted">after the project\'s approval</span>' : p.state === 'Proposed' ? ' <span class="muted">project proposed</span>' : ''}`));
    const reasons = [...new Set(r.reqs.map(x => x.reason).filter(Boolean))];
    bits.push(reasons.length > 1 ? `<b>${reasons.length} reasons</b> — open to read them all`
      : reasons.length ? `“${reasons[0]}”` : '<i>no reason given</i>');
    /* in a batch view, say where the rest of this document's asks came from */
    const elsewhere = r.batches.filter(b => b !== groupBatch);
    if (groupBatch !== undefined && elsewhere.length)
      bits.push(`also asked in ${elsewhere.map(b => `<span class="mono">${b}</span>`).join(', ')}`);
    return bits.join(' · ');
  }

  const TABLE = tier === 'large' || tier === 'notebook';
  const COLUMNS = !TABLE ? null : [
    { label: 'Document', w: 'minmax(9rem, 1fr)' }, { label: 'Status', w: 'fit-content(8.5rem)' },
    { label: 'Askers', num: 1 }, { label: 'Pages', num: 1 }, { label: 'Asked', num: 1 },
    { label: 'Existing copy', w: 'fit-content(7.5rem)' }];

  function rowOf(r, groupBatch) {
    const d = r.d, pages = D.effectivePages(d), why = whyOf(r, groupBatch);
    const copy = M.strongestRegistry(d) ? U.registryCell(d, 'staff') : '';
    if (!TABLE) return { key: r.id, id: M.docId(d), title: d.title, why,
      meta: statusOf(r) + `<span class="lrow-n">${r.reqs.length} ${r.reqs.length === 1 ? 'asker' : 'askers'}</span>` + copy };
    return { key: r.id, why, num: [0, 0, 1, 1, 1, 0],
      cells: [`<div class="tc-title">${d.title}</div><span class="lrow-id">${M.docId(d)}</span>`,
        statusOf(r), r.reqs.length,
        pages ? `<span class="mono">${M.fmt(pages.value)}</span>` : '<span class="muted">—</span>',
        `<span class="muted">${r.first.at.split(' ').slice(0, 2).join(' ')}</span>`, copy] };
  }

  /* ------------------------------------------------------------ groups */

  let listHTML = null, rows = recs.map(r => rowOf(r));
  const GROUPS = [];
  if (group === 'batch') {
    /* each document once, with its EARLIEST ask — so a batch can list fewer
       documents than it asked for, and its header says where the rest went */
    const home = new Map(recs.map(r => [r.id, r.first.batch || '']));
    const keys = [...new Set(recs.map(r => home.get(r.id)))];
    keys.forEach(k => {
      const inG = recs.filter(r => home.get(r.id) === k);
      const b = D.batches.find(x => x.id === k);
      const asked = b ? D.requests.filter(x => x.batch === k && kept.includes(x.decision)) : [];
      const away = asked.filter(x => home.get(x.doc) !== k);
      GROUPS.push({ key: k, b, recs: inG, asked, away });
    });
    GROUPS.sort((a, c) => when(a.recs[0].first.at) - when(c.recs[0].first.at));
  } else if (group === 'requester') {
    const who = [...new Set(recs.flatMap(r => r.reqs.map(x => x.by)))];
    who.forEach(u => GROUPS.push({ key: u, u: D.byId(u), recs: recs.filter(r => r.reqs.some(x => x.by === u)) }));
    GROUPS.sort((a, c) => c.recs.length - a.recs.length || a.u.name.localeCompare(c.u.name));
  }

  function groupHead(g) {
    if (g.u) return `<div class="bhead">
        <div class="bhead-t"><b>${g.u.name}</b>${g.u.kind !== 'person'
          ? ' ' + U.badge(g.u.kind, g.u.kind === 'agent' ? 'purple' : 'slate', 'badge-xs') : ''}</div>
        <div class="bhead-s">${g.recs.length} ${g.recs.length === 1 ? 'document' : 'documents'}${
          g.recs.some(r => r.reqs.length > 1) ? ' · some asked for by others too' : ''}</div></div>`;
    if (!g.b) return `<div class="bhead"><div class="bhead-t"><b>Proposed one at a time</b></div>
        <div class="bhead-s">not part of a batch</div></div>`;
    const ok = g.recs.filter(r => r.bulkable).length;
    const rescans = g.recs.filter(r => r.decision === 'Pending' && r.copies.length).length;
    const checking = g.recs.filter(r => r.decision === 'Pending' && r.unchecked).length;
    const u = D.byId(g.b.by);
    return `<div class="bhead">
        <div class="bhead-t"><b class="mono">${g.b.id}</b> <span class="muted">${g.b.via} · ${g.b.name}</span></div>
        <div class="bhead-s">${u.name}${u.kind === 'agent' ? ' ' + U.badge('agent', 'purple', 'badge-xs') : ''}
          · ${g.b.at} · ${g.asked.length} asked${g.away.length
            ? ` · <b>${g.away.length}</b> listed with ${g.away.length === 1 ? 'its' : 'their'} earlier ask` : ''}</div>
        ${decider && ok ? `<div class="bhead-a">
          <button class="btn btn-sm btn-primary" data-bulk="${g.b.id}">Approve ${ok}…</button>
          ${rescans || checking ? `<span class="muted bhead-skip">${[
            rescans && `${rescans} rescan${rescans > 1 ? 's' : ''} decided on ${rescans > 1 ? 'their' : 'its'} own`,
            checking && `${checking} still being checked`].filter(Boolean).join(' · ')}</span>` : ''}
        </div>` : ''}
      </div>`;
  }

  if (GROUPS.length) {
    const parts = [], order = [];
    GROUPS.forEach(g => {
      parts.push(groupHead(g));
      g.recs.forEach(r => {
        const row = rowOf(r, g.b ? g.b.id : g.u ? undefined : '');
        order.push(row);
        parts.push(U.lrow(Object.assign({}, row, { selected: order.length === 1 && tier !== 'phone' })));
      });
    });
    listHTML = parts.join('');
    rows = order;
  }

  /* ------------------------------------------------------------ pane */

  const who = (id) => {
    const u = D.byId(id);
    return `<b>${u.name}</b>${u.kind !== 'person'
      ? ' ' + U.badge(u.kind, u.kind === 'agent' ? 'purple' : 'slate', 'badge-xs') : ''}`;
  };
  const catOptions = () => `<option value="">Choose a category…</option>${
    LEAVES.map(c => `<option value="${c.id}">${M.catPath(D.pathOf(c.id))}</option>`).join('')}`;
  const prioOptions = (pre) => M.PRIORITY_DESC.map(p =>
    `<option ${p === (pre || 'Normal') ? 'selected' : ''}>${p}</option>`).join('');
  /* flagged after its project's approval: the project's priority, pre-filled
     (projects.md §2.1) — the curator may pick another */
  const prefill = (r) => { const p = r.after && r.projects.find(x => x.priority); return p ? p.priority : null; };

  /* The decision. Approve needs a category — nothing downstream works
     without one — so it waits for the picker. Decline needs a reason that
     every asker reads. A copy turns approve into APPROVE AS RESCAN, which
     asks why the existing scan is not enough. */
  function decideCard(r) {
    if (r.decision !== 'Pending' || !decider) return '';
    const n = r.reqs.length, all = n > 1 ? ` for all ${n}` : '';
    if (r.unchecked) return U.pcard('Decide',
      `<p class="fine" style="margin-top:0">The checks have not answered yet, so
        nobody knows whether a copy exists. The decision waits for them — an
        approval now could be a rescan nobody chose.</p>`);
    const rescan = r.copies.length > 0;
    return U.pcard(`Decide${all}`, `
      <div class="decide" data-decide="${r.id}">
        <div class="fld-row">
          <label class="fld" style="margin-top:0">Category <select data-cat>${catOptions()}</select></label>
          <label class="fld" style="margin-top:0">Priority <select data-prio>${prioOptions(prefill(r))}</select></label>
        </div>
        ${prefill(r) ? `<p class="fine" style="margin-top:.375rem">Pre-filled from ${r.projects[0].name}, approved at ${prefill(r)}.</p>` : ''}
        ${rescan ? `<label class="fld">Why scan it again <span class="muted">— required; kept in the history</span>
          <textarea rows="2" data-note placeholder="e.g. the existing scan is 150 dpi greyscale"></textarea></label>` : ''}
        <div class="decide-acts">
          <button class="btn btn-primary btn-sm" data-approve disabled>${rescan ? 'Approve as rescan' : 'Approve'}${all}</button>
          <button class="btn btn-sm btn-danger" data-decline>Decline${all}…</button>
          <span class="muted decide-hint">${rescan ? 'Choose a category and say why' : 'Choose a category'}</span>
        </div>
        <div class="decline-form">
          <label class="fld">What they are told <span class="muted">— all ${n} ${n === 1 ? 'asker reads' : 'askers read'} this</span>
            <textarea rows="2" data-pub placeholder="About the document — never about a motive"></textarea></label>
          <label class="fld">Internal note <span class="muted">— optional; curators only</span>
            <textarea rows="2"></textarea></label>
          <div class="decide-acts"><button class="btn btn-sm btn-danger" data-confirm-decline disabled>Decline${all}</button>
            <button class="btn btn-sm" data-cancel-decline>Cancel</button></div>
        </div>
        <div class="decide-done"></div>
      </div>`);
  }

  function askersCard(r) {
    return U.pcard(`Who asked — ${r.reqs.length}`,
      r.reqs.map((x, i) => `<div class="row-kv"><span>${who(x.by)}${i === 0 && r.reqs.length > 1
          ? ' ' + U.badge('first', 'blue', 'badge-xs') : ''}
          <br><span class="muted">${x.reason ? '“' + x.reason + '”' : 'no reason given'}</span>
          ${x.approveOnCheck ? '<br><span class="muted">asked for approval on arrival</span>' : ''}</span>
          <span class="muted" style="text-align:right">${x.at}${x.batch ? `<br>${batchName(x.batch)}` : ''}</span></div>`).join('') +
      (r.reqs.length > 1 ? `<p class="fine">One decision covers every asker. Each sees
        only their own reason; the first ask originates the work.</p>` : ''));
  }

  function copiesCard(r) {
    const d = r.d;
    const regs = (d.registries || []).filter(x => x.state !== 'NotFound').map(x => `<div class="row-kv">
        <span>${x.source} <span class="muted">observed ${x.observed}</span></span>
        <span>${x.url ? `<a href="${x.url}" target="_blank" rel="noopener"
          class="badge badge-${M.REG_STATE_COLOR[x.state] || 'slate'} badge-xs">${x.raw || x.state} &#8599;</a>`
          : U.badge(x.raw || x.state, M.REG_STATE_COLOR[x.state] || 'slate', 'badge-xs')}</span></div>`).join('');
    if (r.unchecked) return U.pcard('Existing copies', '<p class="fine" style="margin-top:0">Not checked yet.</p>');
    if (!regs) return U.pcard('Existing copies',
      '<p class="fine" style="margin-top:0">No copy anywhere VERA looks. Nothing to decide over.</p>');
    return U.pcard('Existing copies', regs +
      (r.copies.length ? `<p class="fine">A copy blocks nothing. Approving over it is a
        <b>rescan</b> — one item at a time, never in bulk.</p>` : '<p class="fine">Registry answers are evidence, shown as the registry said them.</p>'));
  }

  /* where it sits: the custodies the rules placed it in, and its project */
  function placedCard(r) {
    const cs = r.custodies.map(id => `<span class="chip"><span>${custName(id)}${id === 'pc0' ? ' <span class="muted">· fallback</span>' : ''}</span></span>`).join(' ');
    const proj = r.projects.map(p => `<div class="row-kv"><span><a href="projects.html?p=${p.id}"><b>${p.name}</b></a>
        <br><span class="muted">${p.state}${p.priority ? ` at ${p.priority}` : ''}${r.after ? ' · proposed after its approval, so decided on its own here' : ''}</span></span>
        <span class="muted" style="text-align:right">${p.state === 'Proposed' ? 'approving the project<br>approves it too' : ''}</span></div>`).join('');
    return U.pcard('Placed in', `
      <div class="fld" style="margin-top:0">Proposal custody</div>
      <div class="msg-to">${cs}</div>
      <p class="fine">${r.custodies.includes('pc0') ? 'No Custody rule named a custody, so it is in the fallback.'
        : 'Named by the Custody rules, re-run when the record or a rule changes.'} ${
        can('plugin.read') ? '<a href="plugins.html?i=pi25">House rules</a>' : ''}</p>
      ${proj ? `<div class="fld">Project</div>${proj}` : ''}`);
  }

  function catalogCard(d) {
    const pages = D.effectivePages(d);
    return U.pcard('Catalog record', U.kv2([
        ['Type', d.type], ['Unit', d.unit ? `${d.unit.value} <span class="muted">(${d.unit.type})</span>` : 'whole record'],
        ['Signature', d.signature || '—'],
        ['Pages', pages
          ? `${M.fmt(pages.value)} <span class="muted">(${pages.source})</span>` : '<span class="muted">no source answered</span>']
      ]), '<button class="btn btn-sm">Open in catalog &#8599;</button>');
  }

  function historyCard(r) {
    const ids = new Set(r.reqs.map(x => x.id));
    const ev = [...D.log.filter(e => ids.has(e.subject)),
      ...r.reqs.map(x => ({ at: x.at, event: x.batch ? `Asked for, in ${x.batch}` : 'Asked for', actor: x.by }))]
      .sort((a, b) => when(b.at) - when(a.at));
    return U.pcard('History', ev.map(e => `<div class="row-kv"><span><b>${e.event}</b>${
        e.detail ? `<br><span class="muted">${e.detail}</span>` : ''}</span>
        <span class="muted">${e.at} · ${e.actor === 'sys' ? 'System' : D.byId(e.actor).name}</span></div>`).join(''));
  }

  function render(key) {
    const r = recs.find(x => x.id === key), d = r.d;
    const head = U.paneHead(d.title,
      `<span class="mono">${M.docId(d)}</span> · ${d.type}${d.signature ? ' · ' + d.signature : ''}`,
      U.messageButton('data-msg', 'Message askers…') + '<a class="btn btn-sm" href="documents.html">Open in Documents &#8594;</a>');
    const note = r.decision === 'Denied'
      ? `<div class="status-note status-note-red"><span>&#9660;</span><div><b>Declined</b> by
          ${D.byId(r.first.declinedBy).name}, ${r.first.declinedAt}: <span>${r.first.declineInternal}</span>
          <br><span>They were told: “${r.first.declinePublic}”</span></div></div>`
      : r.decision === 'Withdrawn'
      ? `<div class="status-note status-note-slate"><span>&#9660;</span><div><b>Withdrawn</b> by the asker,
          ${r.first.withdrawnAt}: <span>“${r.first.reason}”</span></div></div>`
      : r.heldIntent && r.copies.length
      ? `<div class="status-note status-note-amber"><span>&#9660;</span><div><b>Held: asked to add.</b>
          <span>Approval was requested on arrival, and ${r.copies[0].source} already has it — so
          it is a rescan, and a curator decides it.</span></div></div>`
      : r.copies.length
      ? `<div class="status-note status-note-purple"><span>&#9660;</span><div><b>${r.copies[0].source}: ${
          r.copies[0].state.toLowerCase()}.</b> <span>Approving scans it again. Bulk approve skips it.</span></div></div>`
      : '';
    const facts = U.stats([
      { label: 'Status', value: `<span style="font-size:.9375rem">${statusOf(r)}</span>` },
      { label: 'Askers', value: r.reqs.length, foot: r.reqs.length > 1 ? 'decided together' : '' },
      { label: r.decision === 'Pending' ? 'Waiting since' : 'First asked',
        value: `<span style="font-size:.9375rem">${r.first.at}</span>`,
        foot: [r.first.batch ? `in ${r.first.batch}` : 'asked on its own',
               ...r.batches.filter(b => b !== r.first.batch).map(b => `also ${b}`)].join(' · ') }
    ]);
    return head + (note ? `<div style="margin-bottom:1rem">${note}</div>` : '') + facts +
      decideCard(r) + askersCard(r) + placedCard(r) + copiesCard(r) + catalogCard(d) + historyCard(r);
  }

  /* ------------------------------------------------------ bulk approve */
  /* one category and one priority for what the batch can take; a rescan or
     an unchecked item is LISTED as left out, so nothing vanishes silently */
  function openBulk(batchId) {
    const g = GROUPS.find(x => x.b && x.b.id === batchId);
    const take = g.recs.filter(r => r.bulkable), left = g.recs.filter(r => r.decision === 'Pending' && !r.bulkable);
    const host = document.createElement('div');
    host.className = 'modal-scrim';
    const st = { done: false, on: new Set(take.map(r => r.id)) };
    const draw = () => {
      const n = st.on.size;
      host.innerHTML = `<div class="modal">
        <div class="modal-head"><h2>${st.done ? 'Approved' : 'Approve'} — <span class="mono">${batchId}</span></h2>
          <button class="modal-x" data-x aria-label="Close">&times;</button></div>
        <div class="modal-body">${st.done ? `
          <div class="status-note status-note-green"><span>&#9660;</span><div><b>${n} approved</b>
            <span>· ${M.catPath(D.pathOf(st.cat))} · ${st.prio}</span></div></div>
          <p class="fine">${n === 1 ? 'It moves' : 'They move'} to Documents and ${n === 1 ? 'is' : 'are'} added now. ${(() => {
            const k = left.length + take.length - n;
            return k ? `${k === 1 ? 'The one' : `The ${k}`} left out ${k === 1 ? 'stays' : 'stay'} here, waiting for you.` : ''; })()}</p>` : `
          <div class="fld-row">
            <label class="fld" style="margin-top:0">Category <span class="muted">— for all ${take.length}</span>
              <select id="bCat">${catOptions()}</select></label>
            <label class="fld" style="margin-top:0">Priority <select id="bPrio">${prioOptions()}</select></label>
          </div>
          <div class="lines-head"><span>${n} of ${take.length} to approve</span>
            <span class="muted">untick any to decide on its own</span></div>
          <div class="lines">${take.map((r, i) => `<label class="line">
              <input type="checkbox" data-on="${r.id}" ${st.on.has(r.id) ? 'checked' : ''}>
              <span class="line-id"><b>${r.d.title}</b> <span class="mono">${M.docIdShort(r.d)}</span>${
                r.reqs.length > 1 ? ` <span class="muted">· ${r.reqs.length} askers</span>` : ''}</span>
            </label>`).join('')}</div>
          ${left.length ? `<div class="lines-head"><span>Left out — ${left.length}</span></div>
            <div class="lines">${left.map(r => `<div class="line line-fix">
              <span class="line-id"><b>${r.d.title}</b> <span class="mono">${M.docIdShort(r.d)}</span></span>
              <span class="line-o">${r.copies.length ? U.badge(`${r.copies[0].source} has it — a rescan`, 'purple', 'badge-xs')
                : U.badge('still being checked', 'slate', 'badge-xs')}</span></div>`).join('')}</div>
            <p class="fine">A rescan is decided one item at a time, never in bulk. There is
              no bulk decline: a decline carries a reason every asker reads.</p>` : ''}`}
        </div>
        <div class="modal-foot">${st.done ? '<button class="btn btn-primary" data-x>Done</button>'
          : `<button class="btn foot-left" data-x>Cancel</button>
             <button class="btn btn-primary" id="bGo" ${!st.cat || !n ? 'disabled' : ''}>Approve ${n}</button>`}</div></div>`;
      host.querySelectorAll('[data-x]').forEach(b => b.onclick = () => host.remove());
      const c = host.querySelector('#bCat'), p = host.querySelector('#bPrio');
      if (c) { c.value = st.cat || ''; c.onchange = () => { st.cat = c.value; draw(); }; }
      if (p) { p.value = st.prio || 'Normal'; p.onchange = () => { st.prio = p.value; }; }
      host.querySelectorAll('[data-on]').forEach(x => x.onchange = () => {
        x.checked ? st.on.add(x.dataset.on) : st.on.delete(x.dataset.on); draw(); });
      const goB = host.querySelector('#bGo');
      if (goB) goB.onclick = () => { st.prio = st.prio || 'Normal'; st.done = true; draw(); };
    };
    host.onclick = (e) => { if (e.target === host) host.remove(); };
    document.getElementById('app').appendChild(host);
    draw();
  }

  /* ------------------------------------------------------------- mount */

  const quick = `
    <select class="addfilter" id="fShow">${SHOW.map(([v, l]) =>
      `<option value="${v}" ${v === show ? 'selected' : ''}>${l}</option>`).join('')}</select>`;

  U.splitPage({
    tier, active: 'proposals', role,
    title: 'Proposals',
    subtitle: `${recs.length} ${recs.length === 1 ? 'document' : 'documents'} · ${asks} ${asks === 1 ? 'ask' : 'asks'}${typeF ? ` · ${typeF.toLowerCase()} only` : ''}${
      everywhere ? '' : ` · in your proposal ${MINE.length === 1 ? 'custody' : 'custodies'}: ${MINE.map(custName).join(', ')}`}`,
    filters: {
      search: 'Search — title, catalog ID, volume, who asked, batch',
      chips: [typeF && { k: 'Material type', v: typeF, drop: href('type', '') },
        custF && { k: 'Proposal custody', v: custName(custF), drop: href('custody', '') },
        projF && { k: 'Project', v: D.proj(projF).name, drop: href('project', '') }].filter(Boolean),
      options: [['Material type', TYPES.filter(t => t !== typeF).map(t => [t, href('type', t)])],
        ['Proposal custody', MINE.filter(id => id !== custF).map(id => [custName(id), href('custody', id)])],
        ['Project', PROJECTS.filter(p => p.id !== projF).map(p => [p.name, href('project', p.id)])]],
      available: ['Existing copy', 'Asked by', 'Batch', 'Since'],
      right: quick,
      watch: { view: 'Proposals', name: typeF ? `${typeF}s` : '', n: recs.length,
               file: 'proposals.html' + href('group', '').replace(/^\?$/, '') }
    },
    count: `${recs.length} ${recs.length === 1 ? 'document' : 'documents'} · ${asks} ${asks === 1 ? 'ask' : 'asks'}`,
    countRight: `<select class="groupby" id="fGroup">
        <option value="">No grouping</option>
        <option value="batch" ${group === 'batch' ? 'selected' : ''}>Group by batch</option>
        <option value="requester" ${group === 'requester' ? 'selected' : ''}>Group by requester</option></select>`,
    rows, listHTML, columns: COLUMNS, open: q.get('doc'),
    empty: 'Nothing is waiting for a decision.',
    render,
    footer: `<b>One row per document</b> — a decision on one is a decision on every
      asker, so a title asked for five times is decided once.
      <br><b>Group by batch</b> shows each submission together; a document asked
      for in two batches is listed once, with its earliest ask. Bulk approve
      lives on the batch and <b>skips rescans</b> and anything still being checked.
      <br><b>Proposal custody decides who sees what.</b> Custody rules place each
      proposal in custodies by name; a curator sees the ones in theirs, an admin
      everything. What no rule placed is in the <i>Fallback</i>.
      <br><b>A project's proposals</b> are approved with it; one made after its approval
      is decided here, with the project's priority pre-filled.
      <br>Not here: bulk decline · reclassifying after approval (Documents).`
  });

  /* ----------------------------------------------------------- wiring */
  const byId = (id) => document.getElementById(id);
  if (byId('fShow')) byId('fShow').onchange = (e) => go('show', e.target.value);
  if (byId('fGroup')) byId('fGroup').onchange = (e) => go('group', e.target.value);
  /* messaging.md §3 — a proposal's message goes to its askers */
  document.querySelector('.pane').addEventListener('click', (e) => {
    if (!e.target.closest('[data-msg]')) return;
    const key = document.querySelector('.lrow.selected') && document.querySelector('.lrow.selected').dataset.key;
    const r = recs.find(x => x.id === key); if (!r) return;
    U.message({ about: `${r.d.title} ${M.docIdShort(r.d)}`, link: `proposals.html?doc=${r.id}`, sender: me,
      context: `Proposed for digitization · ${r.reqs.length === 1 ? '1 ask' : r.reqs.length + ' asks'}${r.projects.length ? ' · ' + r.projects[0].name : ''}`,
      to: r.reqs.map(x => x.by).filter(id => D.byId(id).kind === 'person'), toLabel: 'who asked' });
  });
  document.querySelector('.listcol').addEventListener('click', (e) => {
    const b = e.target.closest('[data-bulk]');
    if (b) { e.stopPropagation(); openBulk(b.dataset.bulk); }
  });

  /* the decide card lives in a pane that is re-rendered on every row click,
     so it is wired by delegation */
  const pane = document.querySelector('.pane');
  const sync = (box) => {
    const cat = box.querySelector('[data-cat]').value, note = box.querySelector('[data-note]');
    const ok = cat && (!note || note.value.trim());
    box.querySelector('[data-approve]').disabled = !ok;
    box.querySelector('.decide-hint').textContent = ok ? '' : note && cat ? 'Say why it is scanned again' : 'Choose a category';
    const pub = box.querySelector('[data-pub]');
    box.querySelector('[data-confirm-decline]').disabled = !pub.value.trim();
  };
  pane.addEventListener('input', (e) => { const box = e.target.closest('.decide'); if (box) sync(box); });
  pane.addEventListener('change', (e) => { const box = e.target.closest('.decide'); if (box) sync(box); });
  pane.addEventListener('click', (e) => {
    const box = e.target.closest('.decide');
    if (!box) return;
    const r = recs.find(x => x.id === box.dataset.decide), n = r.reqs.length;
    const done = (html) => { box.classList.add('is-done'); box.querySelector('.decide-done').innerHTML = html; };
    if (e.target.closest('[data-decline]')) box.classList.add('declining');
    if (e.target.closest('[data-cancel-decline]')) box.classList.remove('declining');
    if (e.target.closest('[data-approve]')) {
      const c = box.querySelector('[data-cat]').value, p = box.querySelector('[data-prio]').value;
      done(`<div class="status-note status-note-green"><span>&#9660;</span><div><b>${
        r.copies.length ? 'Approved as rescan' : 'Approved'}</b> <span>· ${M.catPath(D.pathOf(c))} · ${p}
        · ${n === 1 ? 'the asker is' : `all ${n} askers are`} told</span></div></div>
        <p class="fine">It moves to Documents and is added now.</p>`);
    }
    if (e.target.closest('[data-confirm-decline]')) {
      done(`<div class="status-note status-note-red"><span>&#9660;</span><div><b>Declined</b>
        <span>· “${box.querySelector('[data-pub]').value.trim()}” — sent to ${n === 1 ? 'the asker' : `all ${n}`}</span></div></div>`);
    }
  });
};
