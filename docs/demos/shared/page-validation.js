/* Documents Validations — /review/documents   (Validation, view-map §2.3)
   row      one ITERATION whose metadata a defect holds
   scope    iterations in categories under my custody — validation.* is
            @custody for a curator (permissions §4), and unlike a proposal an
            iteration HAS a category, so custody can place it
   opens on Review needed, most urgent first, then longest waiting.
            Denied in review and Accepted are one filter away
   actor    curator (use cases C3, C4, C7, C10)

   Metadata only. A prohibition is a restriction and an existing copy is a
   fact on the request (status-model §2); neither is judged here.

   The curator is shown D \ A — what is OUTSTANDING, never a defect already
   accepted. Three ways out of each one:
     fix     the staff edits — page count, a field, a relink. The checks run
             again, and a defect that is gone needs no verdict
     accept  validation.approve over the outstanding set as it stands
     deny    validation.deny, with the text every asker reads
   A re-check finding the same or fewer defects disturbs nobody; one finding
   something new returns the item here showing only the new one.

   No bulk. Every verdict here is a judgement on one record's evidence.

   Shape: MASTER–DETAIL, the list as a table at large and notebook, as in
   Documents and Proposals.                                                  */

window.PAGE_VALIDATION = function (tier) {
  const M = VERA, D = VERA_DATA, U = VERA_UI;
  const role = U.currentRole('curator');
  const held = U.permsOf(role);
  const can = (p) => held.has(p);

  /* custody: a curator's validation.* is @custody. Jana holds Periodicals
     through the Periodicals Curators group, so her queue is every leaf
     beneath it; an admin holds it @any. */
  const CUSTODY = role === 'curator' ? ['c2'] : null;
  const inCustody = (catId) => {
    if (!CUSTODY) return true;
    let c = D.cat(catId);
    while (c) { if (CUSTODY.includes(c.id)) return true; c = c.parent ? D.cat(c.parent) : null; }
    return false;
  };
  const scopeName = CUSTODY ? CUSTODY.map(id => D.cat(id).name).join(', ') : 'every category';

  /* ------------------------------------------------------------ query */
  const q = new URLSearchParams(location.search);
  /* Forbidden (decided 2026-09-26): what a rule forbade, in my custody. A
     curator cannot act on a restriction — only message an admin about it */
  const SHOW = [['', 'Review needed'], ['Denied', 'Denied in review'], ['Approved', 'Accepted'],
    ['forbidden', 'Forbidden'], ['all', 'Everything']];
  const show = SHOW.some(([v]) => v === q.get('show')) ? q.get('show') : '';
  const forbidden = show === 'forbidden';
  const kept = show === 'all' ? ['Needed', 'Denied', 'Approved'] : [show || 'Needed'];
  const go = (k, v) => { v ? q.set(k, v) : q.delete(k); location.search = q.toString(); };
  const href = (k, v) => { const u = new URLSearchParams(q); v ? u.set(k, v) : u.delete(k);
    return '?' + u.toString(); };

  /* ---------------------------------------------------------- records */
  const when = (s) => Date.parse(s) || 0;
  const reqOf = (it) => D.requests.find(r => r.id === it.request);
  const me = U.userOf(role);
  /* a restriction outranks a review state: forbidden items leave the queue */
  const scope = D.iterations.filter(it => inCustody(it.category) && (forbidden
    ? M.restricted(it) : M.validationOf(it) !== 'NotRequired' && !M.restricted(it)));
  const PLUGINS = [...new Set(scope.flatMap(it => (it.defects || []).map(x => x.plugin)))].sort();
  const LEAVES = [...new Set(scope.map(it => it.category))]
    .sort((a, b) => M.catPath(D.pathOf(a)).localeCompare(M.catPath(D.pathOf(b))));
  const ruleF = PLUGINS.includes(q.get('defect')) ? q.get('defect') : '';
  const catF = LEAVES.includes(q.get('cat')) ? q.get('cat') : '';

  /* how long it has waited: the oldest outstanding finding, or — for a
     defect with no date of its own — the ask that brought it in */
  const sinceOf = (it) => {
    const out = M.outstanding(it), base = (reqOf(it) || {}).at;
    const dates = (out.length ? out : it.defects).map(x => x.seen || base).filter(Boolean);
    return dates.sort((a, b) => when(a) - when(b))[0] || '';
  };

  const recs = scope.filter(it => forbidden || kept.includes(M.validationOf(it)))
    /* a defect filter asks what is still to rule on — an accepted page count
       does not put an item in a page-count watchlist */
    .filter(it => !ruleF || (M.validationOf(it) === 'Needed' ? M.outstanding(it) : it.defects)
      .some(x => x.plugin === ruleF))
    .filter(it => !catF || it.category === catF)
    .map(it => ({ it, d: D.doc(it.doc), v: M.validationOf(it), out: M.outstanding(it), since: sinceOf(it) }))
    .sort((a, b) => (a.v !== 'Needed') - (b.v !== 'Needed')
      || M.prioRank(b.it.priority) - M.prioRank(a.it.priority)
      || when(a.since) - when(b.since) || a.d.title.localeCompare(b.d.title));

  const post = (it) => M.atLeast(it.progress, 'Digitized');
  const leaf = (id) => D.cat(id).name;

  /* ----------------------------------------------------------- the row */

  /* one defect verbatim, or the count — never a pick of one of several */
  function whyOf(r) {
    const { it, v, out } = r;
    if (M.restricted(it)) return `<b style="color:var(--tone-red-fg)">Forbidden by ${it.restriction.rule}:</b> ${it.restriction.internalText}`;
    if (v === 'Denied') return `<b style="color:var(--tone-red-fg)">Denied:</b> ${it.deniedNote || 'ruled substantial'}`;
    if (v === 'Approved') return `<b>Accepted</b> — ${it.defects.length} ${it.defects.length === 1 ? 'defect' : 'defects'} ruled tolerable`;
    const bits = [];
    if (post(it)) bits.push(`<b style="color:var(--tone-purple-fg)">Found after digitization</b>`);
    const accepted = it.defects.length - out.length;
    bits.push(out.length > 1 ? `<b>${out.length} defects</b> — ${out.map(x => `${x.plugin} ${x.rule}`).join(', ')}`
      : `<b>${out[0].plugin} ${out[0].rule}</b> · ${out[0].internalText}`);
    if (accepted) bits.push(`${accepted} already accepted, not shown again`);
    return bits.join(' · ');
  }

  const TABLE = tier === 'large' || tier === 'notebook';
  const COLUMNS = !TABLE ? null : [
    { label: 'Document', w: 'minmax(9rem, 1fr)' }, { label: 'Status', w: 'fit-content(9rem)' },
    { label: 'Defects', num: 1 }, { label: 'Priority', w: 'fit-content(5rem)' },
    { label: 'Category', w: 'fit-content(7rem)' }, { label: 'Since', num: 1 }];

  function rowOf(r) {
    const { it, d, out } = r, why = whyOf(r);
    if (!TABLE) return { key: it.id, id: M.docId(d), title: d.title, why,
      meta: U.statusBadge(it) + U.prioBadge(it.priority, 'badge-xs') +
        (out.length ? `<span class="lrow-n">${out.length} outstanding</span>` : '') };
    return { key: it.id, why, num: [0, 0, 1, 0, 0, 1],
      cells: [`<div class="tc-title">${d.title}</div><span class="lrow-id">${M.docId(d)}</span>`,
        U.statusBadge(it), out.length || '<span class="muted">—</span>',
        U.prioBadge(it.priority, 'badge-xs'), `<span class="muted">${leaf(it.category)}</span>`,
        `<span class="muted">${r.since.split(' ').slice(0, 2).join(' ')}</span>`] };
  }

  /* ------------------------------------------------------------ pane */

  const who = (id) => id === 'sys' ? 'System' : D.byId(id).name;
  const may = (p) => can(p);          /* scope is already custody: every row is mine */

  /* the fix a defect's subject points at — the staff edit that makes it go
     away, rather than a verdict that it may stay */
  function fixOf(x) {
    if (x.subject === 'record') return { perm: 'iteration.relink', label: 'Relink…',
      field: 'Catalog record', ph: 'e.g. MZK01-001502234 · roč. 12' };
    if (x.subject === 'pages') return { perm: 'iteration.edit_descriptive', label: 'Enter page count…',
      field: 'Pages, counted', ph: 'e.g. 1 412', num: true };
    return { perm: 'iteration.edit_descriptive', label: `Correct ${x.subject}…`,
      field: `${x.subject}, in VERA`, ph: 'the corrected value' };
  }

  function defectHTML(x, it) {
    const f = fixOf(x), fixable = may(f.perm) && !post(it);
    return `<div class="defect" data-key="${x.key}">
        <div class="defect-h"><b>${x.plugin} ${x.rule}</b> <span class="mono muted">${x.subject}</span>
          ${x.seen ? `<span class="muted defect-seen">found ${x.seen}</span>` : ''}</div>
        <div class="defect-t">${x.internalText}</div>
        <div class="defect-p muted">Askers read: “${x.publicText}”</div>
        ${fixable ? `<div class="defect-acts"><button class="btn btn-sm" data-fix>${f.label}</button></div>
        <div class="defect-fix">
          <label class="fld" style="margin-top:.5rem">${f.field}
            <input ${f.num ? 'inputmode="numeric"' : ''} data-fixval placeholder="${f.ph}"></label>
          <div class="decide-acts" style="margin-top:.5rem">
            <button class="btn btn-sm btn-primary" data-fix-save disabled>Save and re-check</button>
            <button class="btn btn-sm" data-fix-cancel>Cancel</button></div>
        </div>
        <div class="defect-fixed"></div>` : ''}
      </div>`;
  }

  /* The verdict. Accept takes the outstanding set as it stands, minus what
     was just fixed; deny names the defects it rules substantial and says
     so to every asker. */
  function decideCard(r) {
    const { it, v, out } = r;
    if (v !== 'Needed') return '';
    const n = out.length;
    const askers = D.requests.filter(x => x.iteration === it.id || x.tracks === it.id).length || 1;
    const rule = may('validation.approve') || may('validation.deny');
    return U.pcard(`Outstanding — ${n}`, `
      <div class="decide" data-decide="${it.id}">
        ${out.map(x => defectHTML(x, it)).join('')}
        ${rule ? `
        <label class="fld">Note <span class="muted">— optional; kept with the verdict</span>
          <textarea rows="2" data-note placeholder="Why this is tolerable, or why it is not"></textarea></label>
        <div class="decide-acts">
          ${may('validation.approve') ? `<button class="btn btn-primary btn-sm" data-accept>Accept ${n === 1 ? 'it' : `all ${n}`}</button>` : ''}
          ${may('validation.deny') ? `<button class="btn btn-sm btn-danger" data-deny>Deny…</button>` : ''}
          <span class="muted decide-hint"></span>
        </div>
        <div class="decline-form">
          ${n > 1 ? `<div class="fld" style="margin-bottom:.25rem">Which are substantial</div>
            ${out.map(x => `<label class="qf deny-pick"><input type="checkbox" data-pick="${x.key}" data-said="${x.publicText.replace(/"/g, '&quot;')}" checked>
              ${x.plugin} ${x.rule} <span class="mono muted">${x.subject}</span></label>`).join('')}` : ''}
          <label class="fld">What they are told <span class="muted">— ${askers === 1 ? 'the asker reads' : `all ${askers} askers read`} this</span>
            <textarea rows="2" data-pub>${out.map(x => x.publicText).join(' ')}</textarea></label>
          <div class="decide-acts"><button class="btn btn-sm btn-danger" data-confirm-deny>Deny</button>
            <button class="btn btn-sm" data-cancel-deny>Cancel</button></div>
        </div>` : ''}
        <div class="decide-done"></div>
      </div>
      <p class="fine">Fix it and the checks run again: a defect that is gone needs no
        verdict. Accepting says it is tolerable — a later re-check finding the same
        or fewer asks nobody again.</p>`);
  }

  function acceptedCard(r) {
    const { it } = r;
    const A = it.defects.filter(x => (it.approvedKeys || []).includes(x.key));
    if (!A.length) return '';
    const by = D.logFor(it.id).find(e => e.event === 'Validation approved');
    const revoke = may('validation.revoke');
    return U.pcard(`Already accepted — ${A.length}`,
      A.map(x => `<div class="row-kv"><span><b>${x.plugin} ${x.rule}</b> <span class="mono muted">${x.subject}</span>
          <br><span class="muted">${x.internalText}</span></span>
          <span class="muted" style="text-align:right">${by ? `${who(by.actor)}<br>${by.at.split(' ').slice(0, 3).join(' ')}` : 'accepted'}</span></div>`).join('') +
      (r.v === 'Needed' ? `<p class="fine">Not asked again: the re-check found ${A.length === 1 ? 'it' : 'them'}
          unchanged. Only what is new is outstanding.</p>` : '') +
      `<div class="revoke-done"></div>`,
      revoke ? `<button class="btn btn-sm" data-revoke="${it.id}">Revoke</button>` : '');
  }

  function deniedNote(it) {
    const N = it.defects.filter(x => (it.deniedKeys || []).includes(x.key));
    return `<div class="status-note status-note-red"><span>&#9660;</span><div><b>Denied in review</b>
      by ${who(it.deniedBy)}, ${it.deniedAt}: <span>${it.deniedNote}</span>
      <br><span>Over ${N.map(x => `${x.plugin} ${x.rule}`).join(', ')}. The denial lapses on its own
      once the defect is gone — fix it below and the checks clear it.</span></div></div>`;
  }

  function gatesCard(it) {
    const other = M.gates(it).filter(g => g.label !== 'validation' && !g.ok);
    if (!other.length) return '';
    return U.pcard('Also holding it', other.map(g => `<div class="row-kv"><span>${g.label}</span>
      <span style="color:var(--tone-red-fg);font-weight:600">&#10007; blocks</span></div>`).join('') +
      `<p class="fine">Accepting the defects does not admit it while this holds.</p>`);
  }

  function pagesCard(d, it) {
    const pages = D.effectivePages(d);
    if (!it.defects.some(x => x.subject === 'pages')) return '';
    return U.pcard('Page count — every source',
      (d.pageSources || []).length
        ? (d.pageSources || []).slice().sort((a, b) => b.tier - a.tier).map(p => `
          <div class="row-kv"><span>${p.source} <span class="muted">tier ${p.tier}</span></span>
            <span class="num">${M.fmt(p.value)}
              ${pages && p.source === pages.source ? U.badge('in use', 'green', 'badge-xs') : ''}</span></div>`).join('')
        : '<p class="fine" style="margin-top:0">No source answered.</p>');
  }

  function catalogCard(d, it) {
    return U.pcard('This attempt', U.kv2([
        ['Category', M.catPath(D.pathOf(it.category))], ['Priority', U.prioBadge(it.priority)],
        ['Type', d.type], ['Unit', d.unit ? `${d.unit.value} <span class="muted">(${d.unit.type})</span>` : 'whole record'],
        ['Signature', d.signature || '—'], ['Progress', it.progress]
      ]), '<button class="btn btn-sm">Open in catalog &#8599;</button>');
  }

  function historyCard(it) {
    const ev = D.logFor(it.id).slice().sort((a, b) => when(b.at) - when(a.at));
    return U.pcard('History', ev.map(e => `<div class="row-kv"><span><b>${e.event}</b>${
        e.detail ? `<br><span class="muted">${e.detail}</span>` : ''}</span>
        <span class="muted">${e.at} · ${who(e.actor)}</span></div>`).join('')
      || '<p class="fine" style="margin-top:0">Nothing recorded yet.</p>');
  }

  /* the record acts that are not verdicts on defects: reclassify and
     cancel — each writes a reason, so each is a dialog. There is no Forbid:
     forbidding is a rule's, never a person's (decided 2026-09-26) */
  function moreMenu(it) {
    const more = [];
    if (may('iteration.classify')) more.push(['classify', 'Reclassify — category, priority…']);
    if (may('iteration.cancel') && !it.cancellation && !post(it)) more.push(['cancel', 'Cancel…', 'danger']);
    return more.length ? `<details class="menu"><summary class="btn btn-sm">More &#9662;</summary>
      <div class="menu-list">${more.map(([k, l, c]) =>
        `<button class="menu-item ${c || ''}" data-act="${k}" data-it="${it.id}">${l}</button>`).join('')}</div></details>` : '';
  }

  function render(key) {
    const r = recs.find(x => x.it.id === key), { it, d, v, out } = r;
    if (M.restricted(it)) return forbiddenPane(r);
    const head = U.paneHead(d.title,
      `<span class="mono">${M.docId(d)}</span> · ${M.catPath(D.pathOf(it.category))}`,
      `<a class="btn btn-sm" href="documents.html?q=${it.id}">Open in Documents &#8594;</a>${moreMenu(it)}`);
    const note = v === 'Denied' ? deniedNote(it)
      : post(it) && v === 'Needed'
      ? `<div class="status-note status-note-purple"><span>&#9660;</span><div><b>${it.progress} · review needed.</b>
          <span>Found after the scan exists, so progress does not move back. Accepting records it as
          tolerable; denying marks it ${it.progress} · denied in review. A fix goes to the
          catalog record, not here.</span></div></div>`
      : v === 'Approved' ? `<div class="status-note status-note-green"><span>&#9660;</span><div><b>Accepted.</b>
          <span>Every current defect has been ruled tolerable. Revoking returns it to the queue.</span></div></div>`
      : '';
    const accepted = it.defects.length - out.length;
    const facts = U.stats([
      { label: 'Status', value: `<span style="font-size:.9375rem">${U.statusBadge(it)}</span>` },
      { label: 'Outstanding', value: out.length,
        foot: accepted ? `${accepted} already accepted` : 'nothing accepted yet' },
      v === 'Denied' ? { label: 'Denied', value: `<span style="font-size:.9375rem">${it.deniedAt}</span>`,
          foot: `by ${who(it.deniedBy)}` }
      : v === 'Approved' ? (() => { const e = D.logFor(it.id).find(x => x.event === 'Validation approved');
          return { label: 'Accepted', value: `<span style="font-size:.9375rem">${e ? e.at.split(' ').slice(0, 3).join(' ') : '—'}</span>`,
            foot: e ? `by ${who(e.actor)}` : '' }; })()
      : { label: 'Waiting since', value: `<span style="font-size:.9375rem">${r.since}</span>`,
          foot: (reqOf(it) || {}).by ? `asked by ${who(reqOf(it).by)}` : '' }
    ]);
    const deniedFix = v === 'Denied' ? U.pcard('Fix it',
      it.defects.filter(x => (it.deniedKeys || []).includes(x.key)).map(x => defectHTML(x, it)).join('')) : '';
    return head + (note ? `<div style="margin-bottom:1rem">${note}</div>` : '') + facts +
      decideCard(r) + deniedFix + acceptedCard(r) + gatesCard(it) + pagesCard(d, it) +
      catalogCard(d, it) + historyCard(it);
  }

  /* a forbidden item: what the rule said, and the one thing a curator can do
     about it — reach an admin, who alone may overrule (messaging.md §3) */
  function forbiddenPane(r) {
    const { it, d } = r, x = it.restriction;
    const head = U.paneHead(d.title,
      `<span class="mono">${M.docId(d)}</span> · ${M.catPath(D.pathOf(it.category))}`,
      (can('restriction.overrule') ? '' : U.messageButton(`data-msg-admins="${it.id}"`, 'Message admins…')) +
      `<a class="btn btn-sm" href="documents.html?q=${it.id}">Open in Documents &#8594;</a>`);
    return head + `<div style="margin-bottom:1rem"><div class="status-note status-note-red"><span>&#9660;</span><div>
        <b>Forbidden by ${x.rule}</b>${x.at ? `, ${x.at}` : ''}: <span>${x.internalText}</span>
        <br><span>Askers read: “${x.publicText}”</span></div></div></div>` +
      U.stats([
        { label: 'Status', value: `<span style="font-size:.9375rem">${U.statusBadge(it)}</span>` },
        { label: 'Set by', value: `<span style="font-size:.9375rem">${x.plugin && can('plugin.read') ? `<a href="plugins.html?i=${x.plugin}">${x.by}</a>` : x.by || 'a rule'}</span>`,
          foot: `${x.code ? `rule ${x.code} · ` : ''}a rule, never a person` },
        { label: 'Lifted by', value: `<span style="font-size:.9375rem">an admin</span>`, foot: can('restriction.overrule') ? 'you — in Documents' : 'restriction.overrule' }
      ]) +
      U.pcard('What you can do', `<p class="fine" style="margin-top:0">${can('restriction.overrule')
        ? 'Overrule it from Documents — <i>More → Overrule restriction…</i>. The rule is re-checked on every change to the record, and a re-check that no longer finds it clears it.'
        : 'Nothing here acts on a restriction. If the rule is wrong for this item, message an admin: they can overrule it. A re-check that no longer finds it clears it by itself.'}</p>`) +
      catalogCard(d, it) + historyCard(it);
  }

  /* ------------------------------------------------------- record acts */
  function openAct(kind, it) {
    const d = D.doc(it.doc);
    const T = {
      classify: { t: 'Reclassify', ok: 'Save', body: `
        <div class="fld-row">
          <label class="fld" style="margin-top:0">Category <select data-v>${D.categories.filter(c => D.isLeaf(c.id))
            .map(c => `<option value="${c.id}" ${c.id === it.category ? 'selected' : ''}>${M.catPath(D.pathOf(c.id))}${inCustody(c.id) ? '' : ' — not yours'}</option>`).join('')}</select></label>
          <label class="fld" style="margin-top:0">Priority <select>${M.PRIORITY_DESC.map(p =>
            `<option ${p === it.priority ? 'selected' : ''}>${p}</option>`).join('')}</select></label></div>
        <p class="fine" data-handover>${CUSTODY ? `Into a category outside ${scopeName}, it is <b>handed over</b>: it leaves your queue
          for whoever holds that category, and you cannot move it back.` : 'Any category.'}</p>`,
        done: 'Saved. The history records the change.' },
      forbid: { t: 'Forbid', ok: 'Forbid', danger: 1, req: 1, body: `
        <label class="fld" style="margin-top:0">Rule <select><option>Copyright</option><option>Embargo</option>
          <option>Conservation hold</option><option>Other</option></select></label>
        <label class="fld">What they are told <span class="muted">— required; every asker reads this</span>
          <textarea rows="2" data-req placeholder="About the document — never about a motive"></textarea></label>
        <label class="fld">Internal note <span class="muted">— optional; curators only</span><textarea rows="2"></textarea></label>
        <p class="fine">A restriction is not a validation verdict: nothing accepted here lifts it.
          Only an administrator can overrule it.</p>`,
        done: 'Forbidden. It leaves this queue: a restriction outranks a review state.' },
      cancel: { t: 'Cancel', ok: 'Cancel it', danger: 1, req: 1, body: `
        <label class="fld" style="margin-top:0">Reason <span class="muted">— required; every asker reads this</span>
          <textarea rows="2" data-req placeholder="e.g. Postponed — will be scheduled next quarter."></textarea></label>
        <label class="fld">Internal note <span class="muted">— optional</span><textarea rows="2"></textarea></label>
        <p class="fine">Held at the gate, not moved. Resuming lets it through again.</p>`,
        done: 'Cancelled. It stays in Documents, with Resume.' }
    }[kind];
    const host = document.createElement('div');
    host.className = 'modal-scrim';
    host.innerHTML = `<div class="modal">
      <div class="modal-head"><h2>${T.t} — ${d.title}</h2>
        <button class="modal-x" data-x aria-label="Close">&times;</button></div>
      <div class="modal-body">${T.body}</div>
      <div class="modal-foot"><button class="btn foot-left" data-x>Close</button>
        <button class="btn ${T.danger ? 'btn-danger' : 'btn-primary'}" data-ok ${T.req ? 'disabled' : ''}>${T.ok}</button></div></div>`;
    const ok = host.querySelector('[data-ok]'), reqd = host.querySelector('[data-req]');
    if (reqd) reqd.oninput = () => { ok.disabled = !reqd.value.trim(); };
    ok.onclick = () => {
      host.querySelector('.modal-body').innerHTML = `<div class="status-note status-note-green"><span>&#9660;</span>
        <div><b>${T.done}</b></div></div>`;
      host.querySelector('.modal-foot').innerHTML = '<button class="btn btn-primary" data-x>Done</button>';
      host.querySelectorAll('[data-x]').forEach(b => b.onclick = () => host.remove());
    };
    host.querySelectorAll('[data-x]').forEach(b => b.onclick = () => host.remove());
    host.onclick = (e) => { if (e.target === host) host.remove(); };
    document.getElementById('app').appendChild(host);
  }

  /* ------------------------------------------------------------- mount */

  const quick = `<select class="addfilter" id="fShow">${SHOW.map(([v, l]) =>
      `<option value="${v}" ${v === show ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const outN = recs.reduce((a, r) => a + r.out.length, 0);
  const chips = [];
  if (ruleF) chips.push({ k: 'Defect', v: ruleF, drop: href('defect', '') });
  if (catF) chips.push({ k: 'Category', v: leaf(catF), drop: href('cat', '') });

  U.splitPage({
    tier, active: 'validation', role,
    title: 'Documents Validations',
    subtitle: `${recs.length} ${recs.length === 1 ? 'document' : 'documents'} · in ${scopeName}`,
    filters: {
      search: 'Search — title, catalog ID, signature, defect',
      chips,
      options: [['Defect', PLUGINS.filter(p => p !== ruleF).map(p => [p, href('defect', p)])],
                ['Category', LEAVES.filter(c => c !== catF).map(c => [M.catPath(D.pathOf(c)), href('cat', c)])]],
      available: ['Priority', 'Project', 'Since'],
      right: quick,
      watch: { view: 'Validations', name: ruleF ? `${ruleF} defects` : catF ? leaf(catF) : '', n: recs.length,
               file: 'validation.html' + (q.toString() ? '?' + q.toString() : '') }
    },
    count: `${recs.length} ${recs.length === 1 ? 'document' : 'documents'}${show === '' ? ` · ${outN} outstanding` : ''}`,
    rows: recs.map(rowOf), columns: COLUMNS, open: q.get('it'),
    empty: show === '' ? 'Nothing needs review in your custody.' : forbidden ? 'Nothing in your custody is forbidden.' : 'Nothing here.',
    render,
    footer: `<b>Scope is custody.</b> An iteration has a category, so a curator's
      queue is what sits under the categories they hold — here ${scopeName}.
      <br><b>Outstanding is D \\ A</b>: a defect already accepted is never shown
      again, and a re-check that finds something new shows only the new one.
      <br><b>Fix, accept or deny.</b> A fix re-runs the checks and needs no verdict;
      a denial lapses by itself once its defect is gone.
      <br><b>Forbidden</b> is a filter: a rule forbade it, a restriction outranks review, and a
      curator can only message an admin about it.
      <br>Not here: forbidding (rules do it) · existing copies (not metadata) · bulk verdicts ·
      anything outside custody.`
  });

  /* ----------------------------------------------------------- wiring */
  const byId = (id) => document.getElementById(id);
  if (byId('fShow')) byId('fShow').onchange = (e) => go('show', e.target.value);

  const pane = document.querySelector('.pane');
  const sync = (box) => {
    const left = [...box.querySelectorAll('.defect:not(.is-fixed)')];
    const acc = box.querySelector('[data-accept]');
    if (acc) {
      acc.disabled = !left.length;
      acc.textContent = left.length > 1 ? `Accept all ${left.length}` : left.length ? 'Accept it' : 'Accept';
    }
    const hint = box.querySelector('.decide-hint');
    if (hint) hint.textContent = left.length ? '' : 'Nothing left to rule on — the checks are running again';
    const pub = box.querySelector('[data-pub]'), picks = box.querySelectorAll('[data-pick]:checked');
    const cd = box.querySelector('[data-confirm-deny]');
    if (cd) cd.disabled = !pub.value.trim() || (box.querySelector('[data-pick]') && !picks.length);
  };
  pane.addEventListener('input', (e) => {
    const f = e.target.closest('.defect');
    if (f && e.target.matches('[data-fixval]')) f.querySelector('[data-fix-save]').disabled = !e.target.value.trim();
    if (e.target.matches('[data-pub]')) e.target.dataset.edited = '1';
    const box = e.target.closest('.decide'); if (box) sync(box);
  });
  pane.addEventListener('change', (e) => {
    const box = e.target.closest('.decide'); if (!box) return;
    /* what they are told follows the defects picked, until it is edited */
    const pub = box.querySelector('[data-pub]');
    if (e.target.matches('[data-pick]') && !pub.dataset.edited)
      pub.value = [...box.querySelectorAll('[data-pick]:checked')].map(x => x.dataset.said).join(' ');
    sync(box);
  });
  pane.addEventListener('click', (e) => {
    const t = e.target;
    const ma = t.closest('[data-msg-admins]');
    if (ma) { const it = D.iter(ma.dataset.msgAdmins), d = D.doc(it.doc);
      return U.message({ about: `${it.id} · ${d.title}`, link: `validation.html?show=forbidden&it=${it.id}`, sender: me,
        context: `Forbidden by ${it.restriction.rule}: ${it.restriction.internalText}`,
        to: U.holders('restriction.overrule').map(u => u.id), toLabel: 'admins — who may overrule a restriction' }); }
    const act = t.closest('[data-act]');
    if (act) {
      act.closest('details').open = false;
      return openAct(act.dataset.act, D.iter(act.dataset.it));
    }
    const f = t.closest('.defect');
    if (f && t.closest('[data-fix]')) { f.classList.add('fixing'); f.querySelector('[data-fixval]').focus(); }
    if (f && t.closest('[data-fix-cancel]')) f.classList.remove('fixing');
    if (f && t.closest('[data-fix-save]')) {
      f.classList.remove('fixing'); f.classList.add('is-fixed');
      f.querySelector('.defect-fixed').innerHTML = `<div class="status-note status-note-green"><span>&#9660;</span>
        <div><b>Saved — the checks are running again.</b> <span>If they no longer find it,
        it needs no verdict${f.closest('.decide') ? ' and leaves the set you accept' : ''}.</span></div></div>`;
      if (f.closest('.decide')) sync(f.closest('.decide'));
    }
    const rv = t.closest('[data-revoke]');
    if (rv) {
      rv.disabled = true;
      rv.closest('.pcard').querySelector('.revoke-done').innerHTML = `<div class="status-note status-note-amber"
        style="margin-top:.5rem"><span>&#9660;</span><div><b>Revoked.</b> <span>The accepted defects are
        outstanding again, and it is back in Review needed.</span></div></div>`;
    }
    const box = t.closest('.decide');
    if (!box) return;
    const r = recs.find(x => x.it.id === box.dataset.decide);
    const askers = D.requests.filter(x => x.iteration === r.it.id).length || 1;
    const done = (html) => { box.classList.add('is-done'); box.querySelector('.decide-done').innerHTML = html; };
    if (t.closest('[data-deny]')) box.classList.add('declining');
    if (t.closest('[data-cancel-deny]')) box.classList.remove('declining');
    if (t.closest('[data-accept]')) {
      const left = box.querySelectorAll('.defect:not(.is-fixed)').length;
      const fixed = box.querySelectorAll('.defect.is-fixed').length;
      done(`<div class="status-note status-note-green"><span>&#9660;</span><div><b>Accepted — ${left}
        ${left === 1 ? 'defect' : 'defects'}</b> <span>· ${post(r.it) ? `${r.it.progress}, review closed` : 'approved in review'}</span></div></div>
        <p class="fine">${fixed ? `${fixed} fixed, waiting on the re-check. ` : ''}If a later check finds the
        same or fewer, nobody is asked again.</p>`);
    }
    if (t.closest('[data-confirm-deny]')) {
      done(`<div class="status-note status-note-red"><span>&#9660;</span><div><b>Denied in review</b>
        <span>· “${box.querySelector('[data-pub]').value.trim()}” — sent to ${askers === 1 ? 'the asker' : `all ${askers}`}</span></div></div>
        <p class="fine">It lapses by itself if the defect is fixed.</p>`);
    }
  });
};
