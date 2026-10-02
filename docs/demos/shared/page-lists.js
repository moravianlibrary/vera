/* Digitization Lists — /lists   (view-map §2.4, use cases G1 G2 G3)
   One page, three surfaces, because the same dig-curator switches between
   them in one sitting:
     browse   /lists, /lists/:id        master–detail — the lists, the chosen
                                        one in the pane             list.read
     new      /lists/new    (?new)      the editor, starting empty  list.create
     edit     /lists/:id/edit (?edit=)  the editor, from the list   list.edit
   Creating and editing are ONE editor: a new list is an empty list.

   A list is CURRENT STATE, not history. `list_id` sits on the iteration and
   progress derives from the list's date — Planned before it starts,
   InProgress from the morning it does, nothing written. DONE is an act
   (decided 2026-09-26): marking the list Done moves every member to
   Digitized except those a dig-curator marked *could not be digitized*,
   each with a message. Deleting a list clears list_id: its members go back
   to Ready, or to Enqueued if a gate now fails (V14); a Done list cannot be
   deleted (L16). That they were ever scheduled lives in the status log.

   Two ways to fill a list, and they are one path: move rows by hand, or
   Generate — a dialog over a configured list generator plugin that
   pre-fills a DRAFT. Nothing is saved by generating (intentions §4).     */

window.PAGE_LISTS = function (tier) {
  const M = VERA, D = VERA_DATA, U = VERA_UI;
  const role = U.currentRole('dig-curator');
  const held = U.permsOf(role);
  const can = (p) => held.has(p);
  const me = U.userOf(role);

  const q = new URLSearchParams(location.search);
  const mode = q.has('new') && can('list.create') ? 'new'
    : q.get('edit') && D.listOf(q.get('edit')) && can('list.edit') ? 'edit' : 'browse';
  /* the demo's own switches ride along between surfaces */
  const keep = ['generators'].filter(k => q.has(k)).map(k => `&${k}=${q.get(k)}`).join('');

  /* ------------------------------------------------------------ records */
  const when = (s) => Date.parse(s) || 0;
  const TODAY = when(D.today);
  const pagesOf = (it) => { const p = D.effectivePages(D.doc(it.doc)); return p ? p.value : 0; };
  const sum = (its) => its.reduce((a, it) => a + pagesOf(it), 0);
  const membersOf = (l) => D.iterations.filter(it => it.list === l.id);
  const intent = (id) => D.intentions.find(x => x.id === id);
  const overall = D.intentions.find(x => x.overall);
  /* the mix a list is read against: the one it was generated with, else
     Overall. Provenance, not a counting link — what it COUNTS TOWARDS is
     derived from its members and start date (intentions §5) */
  const mixBy = (l) => (l.generated && intent(l.generated.intention)) || overall;
  const countsOf = (l, m, starts) => D.countsTowards(l, m, starts);
  /* the intentions a draft can be shaped by: not archived, not ended */
  const shapeable = () => D.intentions.filter(x => !x.archived && !(x.ends && when(x.ends) + 864e5 <= TODAY))
    .sort((a, b) => (b.overall ? 1 : 0) - (a.overall ? 1 : 0));
  const reqOf = (it) => D.requests.find(r => r.id === it.request) || {};
  const done = (it) => M.atLeast(it.progress, 'Digitized');
  const leafName = (id) => D.cat(id).name;
  const topOf = (id) => { let c = D.cat(id); while (c.parent) c = D.cat(c.parent); return c.id; };
  const TOPS = D.categories.filter(c => !c.parent);
  const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const dayY = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const runs = (l) => `${day(l.starts)} → ${day(l.ends)}`;

  /* Planned and In progress derive from the date; Done is marked */
  const stateOf = (l) => l.done ? 'Done' : when(l.starts) > TODAY ? 'Planned' : 'In progress';
  const ended = (l) => when(l.ends) + 864e5 <= TODAY;
  /* could not be digitized: per item, with a message — not a cancellation
     somebody decided, so it is told differently */
  const notDigitizable = (it) => it.cancellation && it.cancellation.cause === 'NotDigitizable';
  /* a member that fails a gate after listing stays on, flagged */
  const blockerOf = (it) => !done(it) && M.gates(it).find(g => !g.ok && g.label !== 'not cancelled');
  const STATE_TONE = { Planned: 'blue', 'In progress': 'blue', Done: 'green' };
  const stateBadge = (s, cls) => U.badge(s, STATE_TONE[s], cls);

  /* a copy that appeared AFTER approval — nobody decided over it, so it is a
     warning wherever the item could be listed (registry-status §10) */
  const lateCopy = (it) => (reqOf(it).existingCopies || []).find(c => c.afterApproval);
  const warnOf = (it) => { const c = lateCopy(it);
    return c ? `<b style="color:var(--tone-amber-fg)">&#9888; ${c.source}: ${c.state.toLowerCase()} since ${c.seenAt}</b>
      — a copy appeared after approval. Look before listing it.` : ''; };

  /* the pool: every gate passed, Ready, on no list (status-model §3) */
  const POOL = D.iterations.filter(it => it.progress === 'Ready' && !it.list && M.passesGates(it));
  const HELD = D.iterations.filter(it => it.progress === 'Ready' && !it.list && !M.passesGates(it));

  /* the mix: each category's share in the intention the list is read
     against — inside its scope when it has one — against what the pages on
     the list actually are */
  function mixOf(its, i, target, alloc) {
    const nodes = i.scope ? (D.isLeaf(i.scope) ? [D.cat(i.scope)] : D.childrenOf(i.scope)) : TOPS;
    its = its.filter(it => !i.scope || D.under(it.category, i.scope));
    const total = sum(its);
    return nodes.map(c => {
      const share = i.scope && c.id === i.scope ? 100 : D.shareWithin(i, c.id);
      const pages = sum(its.filter(it => D.under(it.category, c.id)));
      /* a correcting run is read against the allocation it accepted */
      const goal = alloc ? (alloc[c.id] || 0) : share == null ? null : (target || total) * share / 100;
      return { c, share, pages, goal, target, of: total ? Math.round(pages / total * 100) : 0,
        pct: goal ? Math.min(100, pages / goal * 100) : pages ? 100 : 0 };
    });
  }
  const mixHTML = (mix, compact) => mix.map(x => {
    const tone = x.share === 0 ? 'excluded' : x.goal && x.pages > x.goal * 1.05 ? 'over' : '';
    const label = x.share == null ? 'unallocated' : x.share === 0 ? 'excluded — 0%'
      : x.target ? `${M.fmt(x.pages)} / ${M.fmt(Math.round(x.goal))} pp`
      : `${x.of}% of its pages · ${M.fmt(x.pages)} pp`;
    return `<div class="mix ${tone}" title="${x.c.name}: ${x.share == null ? 'no share' : Math.round(x.share) + '% of the plan'}">
      <div class="mix-h"><b>${x.c.name}</b> <span class="muted">${x.share == null ? '' : Math.round(x.share) + '%'}</span></div>
      <div class="meter"><i style="width:${x.pct}%"></i></div>
      ${compact ? '' : `<div class="mix-f muted">${label}</div>`}</div>`;
  }).join('');

  if (mode === 'browse') return browse();
  return editor(mode === 'edit' ? D.listOf(q.get('edit')) : null);

  /* ================================================================ browse */

  function browse() {
    const SHOW = [['', 'Planned and running'], ['done', 'Done'], ['all', 'Everything']];
    const show = SHOW.some(([v]) => v === q.get('show')) ? q.get('show') : '';
    const RANK = { 'In progress': 0, Planned: 1, Done: 2 };
    const recs = D.lists.map(l => ({ l, s: stateOf(l), m: membersOf(l) }))
      .filter(r => show === 'all' || (show === 'done' ? r.s === 'Done' : r.s !== 'Done'))
      .sort((a, b) => RANK[a.s] - RANK[b.s]
        || (a.s === 'Done' ? when(b.l.ends) - when(a.l.ends) : when(a.l.starts) - when(b.l.starts)));

    function whyOf(r) {
      const { l, m } = r;
      const ct = countsOf(l, m).filter(x => !x.i.overall);
      const bits = [ct.length ? `Counts towards ${ct.slice(0, 2).map(x => `<b>${x.i.name}</b>`).join(', ')}${ct.length > 2 ? ` +${ct.length - 2}` : ''}`
        : m.length ? 'Counts towards the house mix only' : ''].filter(Boolean);
      if (l.generated) bits.push(`generated with ${mixBy(l).name}`);
      if (!m.length) bits.unshift('<b>Empty</b> — nothing on it yet');
      const review = m.filter(it => M.badgeFootnote(it)).length;
      if (review) bits.push(`<b style="color:var(--tone-purple-fg)">${review} digitized, review needed</b>`);
      const blocked = m.filter(blockerOf).length;
      if (blocked) bits.unshift(`<b style="color:var(--tone-amber-fg)">&#9888; ${blocked} blocked since listing</b>`);
      if (r.s === 'In progress' && ended(l)) bits.unshift('<b>Ended — not marked Done yet</b>');
      return bits.join(' · ');
    }

    const TABLE = tier === 'large' || tier === 'notebook';
    const COLUMNS = !TABLE ? null : [
      { label: 'List', w: 'minmax(10rem, 1fr)' }, { label: 'State', w: 'fit-content(7rem)' },
      { label: 'Runs', w: 'max-content' }, { label: 'Items', num: 1 }, { label: 'Pages', num: 1 },
      { label: 'Delivered', num: 1 }];

    function rowOf(r) {
      const { l, s, m } = r, pp = sum(m), dl = sum(m.filter(done));
      if (!TABLE) return { key: l.id, id: l.id, title: l.name, why: whyOf(r),
        meta: stateBadge(s, 'badge-xs') + `<span class="lrow-n">${runs(l)} · ${m.length} items · ${M.fmt(pp)} pp</span>` };
      return { key: l.id, why: whyOf(r), num: [0, 0, 0, 1, 1, 1],
        cells: [`<div class="tc-title">${l.name}</div><span class="lrow-id">${l.id}</span>`,
          stateBadge(s, 'badge-xs'), `<span class="muted">${runs(l)}</span>`, m.length,
          M.fmt(pp), pp ? `${Math.round(dl / pp * 100)}%` : '<span class="muted">—</span>'] };
    }

    const who = (id) => id === 'sys' ? 'System' : D.byId(id).name;

    function render(key) {
      /* read live: Done and per-item marks change it in place */
      const r = recs.find(x => x.l.id === key), l = r.l, s = stateOf(l), m = membersOf(l);
      const pp = sum(m), dl = sum(m.filter(done)), a = mixBy(l);
      const acts = [];
      if (can('list.edit') && s === 'In progress') acts.push(`<button class="btn btn-sm ${ended(l) ? 'btn-primary' : ''}" data-done="${l.id}">Mark Done…</button>`);
      if (can('list.edit') && s !== 'Done') acts.push(`<a class="btn btn-sm ${ended(l) ? '' : 'btn-primary'}" href="lists.html?edit=${l.id}${keep}">Edit</a>`);
      /* L16 — a Done list is history, and is not deleted */
      if (can('list.delete') && s !== 'Done') acts.push(`<details class="menu"><summary class="btn btn-sm">More &#9662;</summary>
        <div class="menu-list"><button class="menu-item danger" data-del="${l.id}">Delete…</button></div></details>`);
      const head = U.paneHead(l.name, `<span class="mono">${l.id}</span> · ${dayY(l.starts)} → ${dayY(l.ends)}`, acts.join(''));

      const note = s === 'Planned'
        ? `<div class="status-note status-note-blue"><span>&#9660;</span><div><b>Planned — starts ${dayY(l.starts)}.</b>
            <span>${m.length ? `Its ${m.length} ${m.length === 1 ? 'item reads' : 'items read'} Planned until then, and In progress
            that morning — nobody has to act.` : 'Nothing is on it yet.'}</span></div></div>`
        : s === 'In progress' && ended(l)
        ? `<div class="status-note status-note-amber"><span>&#9660;</span><div><b>Ended ${dayY(l.ends)} — not marked Done.</b>
            <span>Marking it Done moves what is on it to Digitized. Mark any that could not be digitized first, with a message.</span></div></div>`
        : s === 'In progress'
        ? `<div class="status-note status-note-blue"><span>&#9660;</span><div><b>In progress since ${dayY(l.starts)}</b>
            <span>· ends ${dayY(l.ends)}. ${m.filter(done).length} of ${m.length} digitized so far. When the scanning room is through, mark it Done.</span></div></div>`
        : `<div class="status-note status-note-green"><span>&#9660;</span><div><b>Done</b> — marked by ${who(l.done.by)}, ${l.done.at}.
            <span>${m.filter(done).length} digitized, ${m.filter(it => it.progress === 'Published').length} published${
              m.filter(notDigitizable).length ? `, ${m.filter(notDigitizable).length} could not be digitized` : ''}. A Done list cannot be deleted.</span></div></div>`;

      const facts = U.stats([
        { label: 'Pages planned', value: M.fmt(pp),
          foot: l.targetPages ? `of ${M.fmt(l.targetPages)} it was built towards` : 'no target set',
          pct: l.targetPages ? Math.min(100, pp / l.targetPages * 100) : null },
        { label: 'Delivered', value: M.fmt(dl), foot: `pages digitized · ${m.filter(done).length} of ${m.length} items`,
          pct: pp ? dl / pp * 100 : 0 },
        { label: 'Items', value: m.length, foot: m.length ? `${M.fmt(Math.round(pp / m.length))} pp on average` : 'empty' }
      ]);

      const ct = countsOf(l, m);
      const g = l.generated;
      const intents = U.pcard('Counts towards', `
        ${ct.map(x => `<div class="row-kv"><span><a href="intentions.html?i=${x.i.id}"><b>${x.i.name}</b></a>${x.i.overall ? ' <span class="muted">· Overall</span>' : ''}</span>
          <span class="muted">${x.n} ${x.n === 1 ? 'item' : 'items'} · ${M.fmt(x.pages)} pp</span></div>`).join('')
          || '<p class="fine" style="margin-top:0">Nothing yet — it counts once items are on it.</p>'}
        <p class="fine">Worked out, not attached: an item counts towards every intention whose funding and
          category it matches, when the list starts inside that intention's window. The figures overlap — never add them.</p>
        ${g ? `<div class="row-kv in-prov"><span><b>Generated</b> with <a href="intentions.html?i=${g.intention}">${a.name}</a>
            <br><span class="muted">${g.generator} · ${M.fmt(g.pages)} pp asked · its mix as it was on ${g.at}</span></span></div>` : ''}`);

      const mix = U.pcard(`Mix — ${a.name}`, `<div class="mixes">${mixHTML(mixOf(m, a, l.targetPages))}</div>
        <p class="fine">Each category against its share of ${l.targetPages ? 'the target' : 'the pages on it — there is no target'}.</p>`);

      /* per item: could not be digitized (list.edit, while it runs) and
         cancel (iteration.cancel) — items can be cancelled from a list */
      const itemActs = (it) => {
        if (s === 'Done' || done(it) || it.cancellation) return '';
        const a = [];
        if (can('list.edit') && s === 'In progress') a.push(`<button class="menu-item" data-nd="${it.id}">Could not be digitized…</button>`);
        if (can('iteration.cancel')) a.push(`<button class="menu-item danger" data-cancel="${it.id}">Cancel…</button>`);
        if (can('list.edit')) a.push(`<a class="menu-item" href="lists.html?edit=${l.id}${keep}">Take it off — in the editor</a>`);
        return a.length ? `<details class="menu ls-imenu"><summary class="btn btn-sm" title="Act on this item">&#8943;</summary>
          <div class="menu-list">${a.join('')}</div></details>` : '';
      };
      const flag = (it) => { const b = blockerOf(it);
        return notDigitizable(it) ? `<br><span style="color:var(--tone-red-fg)">Could not be digitized: ${it.cancellation.message || it.cancellation.publicText || ''}</span>`
          : it.cancellation ? `<br><span class="muted">Cancelled — ${it.cancellation.publicText || ''}</span>`
          : b ? `<br><b style="color:var(--tone-amber-fg)">&#9888; Blocked since listing: ${{ validation: 'review needed', restriction: 'forbidden by a rule', decision: 'no longer approved' }[b.label] || b.label}</b> <span class="muted">— stays on; take it off if it should not be scanned</span>` : ''; };
      const members = U.pcard(`On this list — ${m.length}`, m.length ? m.map(it => { const d = D.doc(it.doc);
          return `<div class="row-kv"><span><a href="documents.html?q=${it.id}"><b>${d.title}</b></a> <span class="mono muted">${M.docIdShort(d)}</span>
              <br><span class="muted">${M.catPath(D.pathOf(it.category))}</span>${flag(it)}</span>
            <span class="ls-mright"><span style="text-align:right;white-space:nowrap"><span class="num">${M.fmt(pagesOf(it))} pp</span>
              <br>${U.statusBadge(it, 'badge-xs')}</span>${itemActs(it)}</span></div>`; }).join('')
        : `<p class="fine" style="margin-top:0">Nothing yet.${can('list.edit') ? ` <a href="lists.html?edit=${l.id}${keep}">Edit</a> to fill it by hand or generate a draft.` : ''}</p>`);

      const ev = D.log.filter(e => e.subject === l.id || e.event.includes(l.id))
        .sort((x, y) => when(y.at) - when(x.at));
      const hist = U.pcard('History', ev.map(e => `<div class="row-kv"><span><b>${e.event}</b>${
          e.detail ? `<br><span class="muted">${e.detail}</span>` : ''}</span>
          <span class="muted" style="text-align:right">${e.at}<br>${who(e.actor)}</span></div>`).join('')
        || '<p class="fine" style="margin-top:0">Nothing recorded yet.</p>');

      return head + `<div style="margin-bottom:1rem">${note}</div>` + facts + members + intents + mix + hist;
    }

    const quick = `<select class="addfilter" id="fShow">${SHOW.map(([v, l]) =>
      `<option value="${v}" ${v === show ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    U.splitPage({
      tier, active: 'lists', role,
      title: 'Digitization Lists',
      subtitle: `${recs.length} ${recs.length === 1 ? 'list' : 'lists'} · ${POOL.length} ready to list, ${M.fmt(sum(POOL))} pp`,
      actions: can('list.create') ? `<a class="btn btn-primary btn-sm" href="lists.html?new${keep}">New list</a>` : '',
      filters: { search: 'Search lists — name, ID', chips: [],
                 available: ['Intention', 'Created by', 'Runs'], right: quick },
      count: `${recs.length} ${recs.length === 1 ? 'list' : 'lists'}`,
      rows: recs.map(rowOf), columns: COLUMNS,
      empty: 'No lists here.',
      render,
      footer: `<b>A list is current state, not history.</b> Its members' progress derives from its
        date — Planned before it starts, In progress from that morning — with nothing written.
        <br><b>Done is an act.</b> Marking it moves the members to Digitized, except those marked
        <i>could not be digitized</i>, each with a message. A Done list cannot be deleted.
        <br><b>An item blocked after listing stays on, flagged</b> — the dig-curator decides.
        <br><b>Delete returns the members to the pool</b> as Ready, or Enqueued if a gate now fails.
        A digitized one keeps its status, a cancelled one stays held, and the log keeps that they were scheduled.
        <br>Edit and New list open the same editor${can('list.create') ? '' : ' — absent without list.create / list.edit'}.`
    });

    const byId = (id) => document.getElementById(id);
    if (byId('fShow')) byId('fShow').onchange = (e) => {
      e.target.value ? q.set('show', e.target.value) : q.delete('show'); location.search = q.toString(); };
    /* /lists/:id — open the one named */
    const want = q.get('list') && document.querySelector(`.lrow[data-key="${q.get('list')}"]`);
    if (want) { want.click(); want.scrollIntoView({ block: 'nearest' }); }

    const reopen = () => { const el = document.querySelector('.lrow.selected'); if (el) el.click(); };
    document.querySelector('.pane').addEventListener('click', (e) => {
      const md = e.target.closest('[data-done]');
      if (md) return markDone(D.listOf(md.dataset.done), reopen);
      const nd = e.target.closest('[data-nd]'), cn = e.target.closest('[data-cancel]');
      if (nd || cn) { (nd || cn).closest('details').open = false;
        return itemStop(D.iter((nd || cn).dataset.nd || (nd || cn).dataset.cancel), !!nd, reopen); }
      const b = e.target.closest('[data-del]');
      if (!b) return;
      b.closest('details').open = false;
      confirmDelete(D.listOf(b.dataset.del));
    });
  }

  /* declared, not const: the page returns into browse() or editor() above */
  function stamp() { return `${dayY(D.today)} ${new Date().toTimeString().slice(0, 5)}`; }
  function logIt(subject, event, detail) { D.log.push({ subject, at: stamp(), actor: me, corr: 'k' + D.log.length, event, detail }); }

  /* one item stops: could not be digitized (a fact about the item, with a
     message every asker reads) or cancelled (a decision, with a reason) */
  function itemStop(it, nd, after) {
    const d = D.doc(it.doc), l = D.listOf(it.list);
    const host = modal(nd ? `Could not be digitized — ${d.title}` : `Cancel — ${d.title}`, `
      <label class="fld" style="margin-top:0">${nd ? 'Message' : 'Reason'} <span class="muted">— required; every asker reads it</span>
        <textarea rows="2" id="lsMsg" placeholder="${nd ? 'e.g. Pages too tightly bound to open safely; sent to conservation.' : 'e.g. Postponed — will be scheduled next quarter.'}"></textarea></label>
      <p class="fine">${nd ? `It stays on ${l.name}, marked. Marking the list Done moves every other item to Digitized; this one is not.`
        : 'Held at the gate, and taken off the list. Resuming it in Documents lets it through again.'}</p>`,
      `<button class="btn foot-left" data-x>Close</button><button class="btn btn-danger" data-ok disabled>${nd ? 'Mark it' : 'Cancel it'}</button>`);
    const ok = host.querySelector('[data-ok]'), t = host.querySelector('#lsMsg');
    t.oninput = () => { ok.disabled = !t.value.trim(); };
    ok.onclick = () => {
      it.cancellation = nd ? { cause: 'NotDigitizable', by: me, at: dayY(D.today), message: t.value.trim(), publicText: t.value.trim() }
        : { cause: 'Decided', by: me, at: dayY(D.today), publicText: t.value.trim() };
      if (!nd) it.list = null;
      logIt(it.id, nd ? 'Could not be digitized' : 'Cancelled', `${t.value.trim()}${nd ? ` · on ${l.id}` : ` · taken off ${l.id}`}`);
      host.remove(); after();
    };
  }

  /* DONE is an act: everything on it not marked could-not-be-digitized moves
     to Digitized. Said in full before it happens. */
  function markDone(l, after) {
    const m = membersOf(l);
    const move = m.filter(it => !done(it) && !it.cancellation), nd = m.filter(notDigitizable), already = m.filter(done);
    const blocked = move.filter(blockerOf);
    const host = modal(`Mark ${l.name} Done?`, `
      <div class="row-kv"><span><b>${move.length}</b> move to <i>Digitized</i></span><span class="muted">${M.fmt(sum(move))} pp</span></div>
      ${already.length ? `<div class="row-kv"><span><b>${already.length}</b> already digitized stay as they are</span><span></span></div>` : ''}
      ${nd.length ? `<div class="row-kv"><span><b>${nd.length}</b> marked could not be digitized do not</span><span class="muted">their message stands</span></div>` : ''}
      ${blocked.length ? `<div class="status-note status-note-amber" style="margin-top:.75rem"><span>&#9660;</span><div>
        <b>${blocked.length} ${blocked.length === 1 ? 'is' : 'are'} blocked since listing</b> — ${blocked.map(it => D.doc(it.doc).title).join(', ')}.
        <span>If ${blocked.length === 1 ? 'it was' : 'they were'} not scanned, close this and mark ${blocked.length === 1 ? 'it' : 'them'} could not be digitized first.</span></div></div>` : ''}
      <p class="fine">${move.length ? 'If something on it was not scanned, close this and mark that item first — from the ⋯ beside it.' : ''}
        Done is final: the list stays as history and cannot be deleted.</p>`,
      `<button class="btn foot-left" data-x>Not yet</button><button class="btn btn-primary" data-ok>Mark Done</button>`);
    host.querySelector('[data-ok]').onclick = () => {
      move.forEach(it => { it.progress = 'Digitized'; it.digitizedAt = dayY(D.today); });
      l.done = { by: me, at: dayY(D.today) };
      logIt(l.id, 'Marked Done', `${move.length} moved to Digitized${nd.length ? ` · ${nd.length} could not be digitized` : ''}`);
      host.remove(); after();
    };
  }

  /* deleting is the one act that un-schedules other people's work, so the
     dialog says exactly what happens to every member first */
  function confirmDelete(l) {
    const m = membersOf(l);
    const kept = m.filter(done), heldM = m.filter(it => !done(it) && it.cancellation);
    const back = m.filter(it => !done(it) && !it.cancellation);
    /* V14 — Ready means every gate passed: one that now fails goes back to
       Enqueued, and returns to Ready when the gate clears */
    const gated = back.filter(it => !M.passesGates(it)), ready = back.filter(it => M.passesGates(it));
    const host = modal(`Delete ${l.name}?`, `
      <div class="row-kv"><span><b>${ready.length}</b> return to the pool as <i>Ready</i></span>
        <span class="muted">${M.fmt(sum(ready))} pp</span></div>
      ${gated.length ? `<div class="row-kv"><span><b>${gated.length}</b> blocked since listing go back to <i>Enqueued</i></span>
        <span class="muted">Ready again when the gate clears</span></div>` : ''}
      <div class="row-kv"><span><b>${kept.length}</b> already digitized keep their status</span>
        <span class="muted">a written value wins</span></div>
      <div class="row-kv"><span><b>${heldM.length}</b> cancelled stay cancelled</span>
        <span class="muted">the flag is untouched</span></div>
      <p class="fine">A list is deleted, not cancelled — no reason is asked. That these were
        scheduled on <span class="mono">${l.id}</span> stays in each one's history.</p>`,
      `<button class="btn foot-left" data-x>Keep it</button><button class="btn btn-danger" data-ok>Delete list</button>`);
    host.querySelector('[data-ok]').onclick = () => {
      host.querySelector('.modal-body').innerHTML = `<div class="status-note status-note-green"><span>&#9660;</span>
        <div><b>Deleted.</b> <span>${ready.length} ${ready.length === 1 ? 'item is' : 'items are'} Ready again and back in the pool${
          gated.length ? `; ${gated.length} Enqueued until ${gated.length === 1 ? 'its' : 'their'} gate clears` : ''}.</span></div></div>`;
      host.querySelector('.modal-foot').innerHTML = '<button class="btn btn-primary" data-x>Done</button>';
      host.querySelector('[data-x]').onclick = () => host.remove();
    };
  }

  function modal(title, body, foot, wide) {
    const host = document.createElement('div');
    host.className = 'modal-scrim';
    host.innerHTML = `<div class="modal ${wide ? 'modal-wide' : ''}">
      <div class="modal-head"><h2>${title}</h2>
        <button class="modal-x" data-x aria-label="Close">&times;</button></div>
      <div class="modal-body">${body}</div>
      <div class="modal-foot">${foot}</div></div>`;
    host.querySelectorAll('[data-x]').forEach(b => b.onclick = () => host.remove());
    host.onclick = (e) => { if (e.target === host) host.remove(); };
    document.getElementById('app').appendChild(host);
    return host;
  }

  /* ================================================================ editor */

  /* The browse pane, moved: the list's header goes to the top of the page
     and stays there while two panes scroll under it — what is on it, and
     everything it could take. Every change is a DRAFT until Save. */
  function editor(l) {
    let isNew = !l;
    const orig = new Set(l ? membersOf(l).map(it => it.id) : []);
    const S = {
      name: l ? l.name : '',
      starts: l ? l.starts : D.today, ends: l ? l.ends : '',
      now: l ? when(l.starts) <= TODAY : true,
      target: l ? l.targetPages : null,
      /* the intention the fill is read against, and generation's default —
         Overall unless the list was generated with another, or ?shape says */
      mixBy: l ? mixBy(l).id : (intent(q.get('shape')) || overall).id,
      /* a correcting run arrives with its allocation, accepted on Intentions */
      alloc: !l && q.get('alloc') ? Object.fromEntries(q.get('alloc').split(',').map(x => { const [k, v] = x.split(':'); return [k, +v]; })) : null,
      generated: l ? l.generated : null,
      on: new Set(orig),
      gen: new Map(),          /* id → reason, for picks a generator made */
      report: null, pick: { on: new Set(), pool: new Set() },
      poolCat: '', poolQ: '', saved: false
    };
    const GENS = D.generators();
    const byIt = (id) => D.iter(id);
    const onList = () => [...S.on].map(byIt);
    const inPool = () => POOL.filter(it => !S.on.has(it.id))
      .concat(D.iterations.filter(it => orig.has(it.id) && !S.on.has(it.id)));
    const added = () => [...S.on].filter(id => !orig.has(id)).length;
    const removed = () => [...orig].filter(id => !S.on.has(id)).length;
    const PRIO = (it) => M.prioRank(it.priority);
    const byOrder = (a, b) => PRIO(b) - PRIO(a) || when(reqOf(a).at) - when(reqOf(b).at);

    /* back to browse, on this list — /lists/:id */
    const back = 'lists.html' + (l ? `?list=${l.id}${keep}` : keep ? '?' + keep.slice(1) : '');
    const TABLE = tier === 'large' || tier === 'notebook';
    const COLS = '1.75rem minmax(9rem, 1fr) fit-content(8rem) fit-content(5rem) max-content max-content';

    function rowHTML(it, side) {
      const d = D.doc(it.doc), reason = S.gen.get(it.id), warn = warnOf(it);
      const picked = S.pick[side].has(it.id);
      const why = [reason ? `${U.badge('generated', 'purple', 'badge-xs')} ${reason}` : '', warn,
        side === 'pool' && orig.has(it.id) ? '<b>Taken off</b> — back to Ready when you save' : '']
        .filter(Boolean).join(' · ');
      const move = side === 'on'
        ? `<button class="btn btn-sm mv" data-mv="${it.id}" title="Take it off — back to Ready, no reason needed">Take off &#8594;</button>`
        : `<button class="btn btn-sm mv" data-mv="${it.id}" title="Put it on this list">&#8592; Add</button>`;
      if (!TABLE) return `<div class="lrow ${picked ? 'selected' : ''}" data-row="${it.id}">
          <div class="lrow-title">${d.title} <span class="mono muted">${M.docIdShort(d)}</span></div>
          <div class="lrow-meta">${U.prioBadge(it.priority, 'badge-xs')}<span class="lrow-n">${leafName(it.category)} · ${M.fmt(pagesOf(it))} pp</span>${move}</div>
          ${why ? `<div class="lrow-why">${why}</div>` : ''}</div>`;
      return `<div class="lrow trow ${picked ? 'selected' : ''} " data-row="${it.id}">
        <div class="tc"><input type="checkbox" data-pick="${it.id}" ${picked ? 'checked' : ''} aria-label="Select"></div>
        <div class="tc"><div class="tc-title">${d.title}</div><span class="lrow-id">${M.docId(d)}</span></div>
        <div class="tc"><span class="muted">${leafName(it.category)}</span></div>
        <div class="tc">${U.prioBadge(it.priority, 'badge-xs')}</div>
        <div class="tc num">${M.fmt(pagesOf(it))}</div>
        <div class="tc">${move}</div>
        ${why ? `<div class="lrow-why">${why}</div>` : ''}</div>`;
    }
    const thead = TABLE ? `<div class="thead"><div></div><div>Document</div><div>Category</div>
      <div>Priority</div><div class="num">Pages</div><div></div></div>` : '';

    function leftHTML() {
      const its = onList().sort((a, b) => (S.gen.has(a.id) - S.gen.has(b.id)) || byOrder(a, b));
      const n = S.pick.on.size;
      return `<div class="ed-head">
          <div><b>On this list</b> <span class="muted">${its.length} ${its.length === 1 ? 'item' : 'items'} · ${M.fmt(sum(its))} pp</span></div>
          <span class="right">
            ${GENS.length ? `<button class="btn btn-sm" id="genBtn">Generate…</button>` : ''}
            <button class="btn btn-sm" data-bulk="on" ${n ? '' : 'disabled'}>Take off ${n || ''} &#8594;</button></span></div>
        <div class="ed-list tlist" style="--cols:${COLS}">${its.length ? thead + its.map(it => rowHTML(it, 'on')).join('')
          : `<div class="ed-empty"><b>Nothing on it yet.</b><br>Add documents from the right${GENS.length
              ? ', or <a href="#" data-gen>generate a draft</a> and adjust it' : ''}.
              ${GENS.length ? '' : '<br><span class="muted">No list generator is configured, so lists are built by hand.</span>'}</div>`}</div>`;
    }

    /* what review is holding back, so a short pool explains itself (decided
       2026-09-26): approved items still in validation, by top category, and
       proposals nobody has decided */
    function holdingBack() {
      const a = intent(S.mixBy) || overall;
      const inVal = D.iterations.filter(it => !it.list && it.progress === 'Enqueued' && D.inScope(a, it) &&
        ['Needed', 'Denied'].includes(M.validationOf(it)) && !M.restricted(it));
      const byTop = TOPS.map(c => [c, inVal.filter(it => topOf(it.category) === c.id)]).filter(([, x]) => x.length);
      const props = new Set(D.requests.filter(r => r.decision === 'Pending').map(r => r.doc)).size;
      if (!byTop.length && !props) return '';
      return `<p class="ed-foot ed-held"><b>Waiting in review:</b> ${byTop.map(([c, x]) =>
        `${x.length} more in ${c.name} <span class="muted">(${M.fmt(sum(x))} pp, in Validations)</span>`).join(' · ')}${
        props ? `${byTop.length ? ' · ' : ''}${props} proposals not decided yet` : ''}. They join the pool once review lets them through.</p>`;
    }

    function rightHTML() {
      const all = inPool();
      const leaves = [...new Set(all.map(it => it.category))]
        .sort((a, b) => M.catPath(D.pathOf(a)).localeCompare(M.catPath(D.pathOf(b))));
      const tops = TOPS.filter(c => all.some(it => topOf(it.category) === c.id));
      const qq = S.poolQ.trim().toLowerCase();
      const its = all.filter(it => !S.poolCat || it.category === S.poolCat || topOf(it.category) === S.poolCat)
        .filter(it => !qq || (D.doc(it.doc).title + ' ' + M.docId(D.doc(it.doc))).toLowerCase().includes(qq))
        .sort(byOrder);
      const n = S.pick.pool.size;
      return `<div class="ed-head">
          <div><b>Ready to list</b> <span class="muted">${its.length} · ${M.fmt(sum(its))} pp</span></div>
          <span class="right">
            <input class="search" id="poolQ" placeholder="Search" value="${S.poolQ}">
            <select class="addfilter" id="poolCat"><option value="">Every category</option>${
              tops.map(c => `<option value="${c.id}" ${S.poolCat === c.id ? 'selected' : ''}>${c.name}</option>${
                leaves.filter(x => topOf(x) === c.id && x !== c.id).map(x =>
                  `<option value="${x}" ${S.poolCat === x ? 'selected' : ''}>&nbsp;&nbsp;${leafName(x)}</option>`).join('')}`).join('')}</select>
            <button class="btn btn-sm" data-bulk="pool" ${n ? '' : 'disabled'}>&#8592; Add ${n || ''}</button></span></div>
        <div class="ed-list tlist" style="--cols:${COLS}">${its.length ? thead + its.map(it => rowHTML(it, 'pool')).join('')
          : '<div class="ed-empty">Nothing ready matches.</div>'}
          ${holdingBack()}
          ${HELD.length ? `<p class="ed-foot muted">Not shown: ${HELD.length} Ready but held —
            ${HELD.map(it => `${D.doc(it.doc).title} (${it.cancellation ? 'cancelled' : 'at a gate'})`).join(', ')}.
            Resuming it in Documents brings it back here.</p>` : ''}</div>`;
    }

    /* L10 — moving an unfinished list's dates warns before Save when it
       stops counting towards an intention */
    function stopsCounting() {
      if (isNew || !l || !S.dirty) return '';
      const its = onList(), was = countsOf(l, its, l.starts).map(x => x.i.id);
      const now = countsOf({ starts: S.starts }, its, S.now ? D.today : S.starts).map(x => x.i.id);
      const lost = was.filter(id => !now.includes(id)).map(intent);
      return lost.length ? `<div class="status-note status-note-amber ed-note"><span>&#9660;</span><div>
        <b>Saving with these dates, it stops counting towards ${lost.map(i => i.name).join(', ')}.</b>
        <span>${lost.length === 1 ? 'That intention counts' : 'They count'} lists starting inside ${lost.length === 1 ? 'its' : 'their'} window; this one would start ${dayY(S.now ? D.today : S.starts)}.</span></div></div>` : '';
    }

    function topHTML() {
      const its = onList(), pp = sum(its), a = intent(S.mixBy) || overall;
      const chg = added() || removed()
        ? `<span class="ed-chg"><b style="color:var(--tone-green-fg)">+${added()}</b> <b style="color:var(--tone-red-fg)">−${removed()}</b> since opened</span>`
        : `<span class="ed-chg muted">${isNew ? 'new — not saved' : S.dirty ? 'unsaved changes' : 'no changes'}</span>`;
      const late = its.filter(lateCopy).length;
      const can2save = S.name.trim() && S.ends && (isNew || added() || removed() || S.dirty);
      const ct = countsOf({ starts: S.starts }, its, S.now ? D.today : S.starts);
      return `
        <div class="ed-row">
          <input class="ed-name" id="edName" placeholder="Name the list — e.g. Periodicals, October" value="${S.name.replace(/"/g, '&quot;')}">
          ${l ? `<span class="mono muted">${l.id}</span>` : ''}
          <span class="ed-dates">
            <select class="addfilter" id="edNow">
              <option value="now" ${S.now ? 'selected' : ''}>Starts now</option>
              <option value="on" ${S.now ? '' : 'selected'}>Starts on</option></select>
            ${S.now ? '' : `<input type="date" class="search ed-date" id="edStarts" value="${S.starts}">`}
            <span class="muted">ends</span>
            <input type="date" class="search ed-date" id="edEnds" value="${S.ends}"></span>
          <span class="ed-acts">${chg}
            <a class="btn btn-sm" href="${back}">Discard</a>
            <button class="btn btn-sm btn-primary" id="edSave" ${can2save ? '' : 'disabled'}>Save</button></span>
        </div>
        <div class="ed-row ed-row2">
          <span class="ed-lbl" title="Worked out from what is on it and when it starts — nothing to tick">Counts towards</span>
          <span class="ed-counts">${ct.map(x => `<span class="ed-ct">${x.i.name} <span class="muted">${M.fmt(x.pages)} pp</span></span>`).join('')
            || '<span class="muted">nothing yet — it counts once items are on it</span>'}</span>
          <span class="ed-pages">
            <span class="ed-lbl">Pages</span>
            <b class="num">${M.fmt(pp)}</b> <span class="muted">of</span>
            <input class="search ed-target" id="edTarget" inputmode="numeric" placeholder="target" value="${S.target || ''}">
            <span class="meter ed-meter"><i style="width:${S.target ? Math.min(100, pp / S.target * 100) : 0}%"></i></span></span>
        </div>
        <div class="ed-mix"><span class="ed-lbl">Mix<select class="addfilter ed-mixby" id="edMixBy" title="Which intention's mix to read the fill against">${
          shapeable().map(x => `<option value="${x.id}" ${x.id === a.id ? 'selected' : ''}>${x.name}</option>`).join('')}</select></span><div class="mixes mixes-row">${mixHTML(mixOf(its, a, S.target,
          S.generated && S.generated.allocation && S.generated.intention === a.id ? S.generated.allocation : null), false)}</div></div>
        ${S.generated && its.length && !ct.some(x => x.i.id === S.generated.intention) ? (() => { const g = intent(S.generated.intention);
          return `<div class="status-note status-note-amber ed-note"><span>&#9660;</span><div><b>Generated with ${g.name}, but it will not count towards it.</b>
          <span>${g.name} counts lists starting ${g.ends ? `${dayY(g.starts)} → ${dayY(g.ends)}` : `from ${dayY(g.starts)}`}; this one starts ${dayY(S.now ? D.today : S.starts)}.
          Move the start into that window if it should.</span></div></div>`; })() : ''}
        ${stopsCounting()}
        ${S.report ? S.report : ''}
        ${late ? `<div class="status-note status-note-amber ed-note"><span>&#9660;</span><div><b>${late} on this list ${late === 1 ? 'has' : 'have'} a copy that appeared after approval.</b>
          <span>Nobody decided over it — it is listed only if you mean it.</span></div></div>` : ''}
        ${S.saved ? S.saved : ''}`;
    }

    const body = `<div class="ed">
        <section class="ed-top" id="edTop"></section>
        <div class="ed-panes">
          <div class="ed-pane" id="edLeft"></div>
          <div class="ed-pane" id="edRight"></div>
        </div>
        <div class="budget ed-budget"><b>Edits are a draft until Save</b> — nothing moves in browse, or in
          anybody's status, before then. <b>Taking one off</b> returns it to the pool as Ready: not a
          cancellation, no reason needed. <b>Generate</b> pre-fills this side; nothing is saved by generating.</div>
      </div>`;

    U.mount({ tier, active: 'lists', role,
      title: isNew ? 'New list' : `Edit list`,
      subtitle: isNew ? 'Digitization Lists' : `Digitization Lists · ${l.name}`,
      split: body });

    const $ = (id) => document.getElementById(id);
    const paint = (which) => {
      if (!which || which.includes('top')) $('edTop').innerHTML = topHTML();
      if (!which || which.includes('left')) $('edLeft').innerHTML = leftHTML();
      if (!which || which.includes('right')) $('edRight').innerHTML = rightHTML();
    };
    paint();

    const move = (ids) => {
      ids.forEach(id => { if (S.on.has(id)) { S.on.delete(id); S.gen.delete(id); } else S.on.add(id); });
      S.pick.on.clear(); S.pick.pool.clear(); S.saved = false;
      paint();
    };

    const ed = document.querySelector('.ed');
    ed.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('#genBtn') || t.closest('[data-gen]')) { e.preventDefault(); return generate(); }
      const mv = t.closest('[data-mv]');
      if (mv) return move([mv.dataset.mv]);
      const bulk = t.closest('[data-bulk]');
      if (bulk) return move([...S.pick[bulk.dataset.bulk]]);
      if (t.closest('#edSave')) return save();
      /* a row click toggles its selection — the checkbox is just the visible half */
      const row = t.closest('[data-row]');
      if (row && !t.closest('a, button, select, input:not([data-pick])')) {
        const side = row.closest('#edLeft') ? 'on' : 'pool', id = row.dataset.row;
        S.pick[side].has(id) ? S.pick[side].delete(id) : S.pick[side].add(id);
        paint([side === 'on' ? 'left' : 'right']);
      }
    });
    ed.addEventListener('input', (e) => {
      const t = e.target;
      if (t.id === 'edName') { S.name = t.value; S.dirty = true; syncSave(); }
      if (t.id === 'poolQ') { S.poolQ = t.value; paint(['right']); const p = $('poolQ'); p.focus(); p.setSelectionRange(p.value.length, p.value.length); }
    });
    ed.addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'edNow') { S.now = t.value === 'now'; if (S.now) S.starts = D.today; S.dirty = true; paint(['top']); }
      if (t.id === 'edStarts') { S.starts = t.value; S.dirty = true; paint(['top']); }
      if (t.id === 'edEnds') { S.ends = t.value; S.dirty = true; paint(['top']); }
      if (t.id === 'edTarget') { S.target = parseInt(t.value.replace(/\D/g, ''), 10) || null; S.dirty = true; paint(['top']); }
      if (t.id === 'edMixBy') { S.mixBy = t.value; paint(['top']); }
      if (t.id === 'poolCat') { S.poolCat = t.value; S.pick.pool.clear(); paint(['right']); }
    });
    function syncSave() {
      const b = $('edSave');
      if (b) b.disabled = !(S.name.trim() && S.ends);
    }

    function save() {
      const its = onList(), later = !S.now && when(S.starts) > TODAY;
      const out = removed();
      S.saved = `<div class="status-note status-note-green ed-note"><span>&#9660;</span><div>
        <b>Saved${isNew ? '' : ` — +${added()} −${removed()}`}.</b>
        <span>${its.length} ${its.length === 1 ? 'item reads' : 'items read'} ${later ? `Planned until ${dayY(S.starts)}` : 'In progress'}${
          out ? `; ${out} back in the pool as Ready` : ''}. The history records what moved and who moved it.
          <a href="${back}">Back to the list</a></span></div></div>`;
      orig.clear(); S.on.forEach(id => orig.add(id)); S.dirty = false; isNew = false;
      paint();
    }

    /* ----------------------------------------------------- Generate */
    /* A dialog over one configured generator. Pages required; categories
       optional (all if none); any number of intentions, exactly one of them
       authoritative — Overall unless another is marked (intentions §4.1). */
    function generate() {
      const cur = onList(), curP = sum(cur);
      const one = GENS.length === 1;
      const host = modal('Generate a draft', `
        ${one ? `<div class="gen-one">Using <b>${GENS[0].type.name}</b> · ${GENS[0].name}
            ${U.badge(GENS[0].type.class, GENS[0].type.class === 'AI-based' ? 'purple' : 'slate', 'badge-xs')}
            <div class="muted">${GENS[0].type.description}</div></div>`
          : `<div class="fld" style="margin-top:0">Generator</div>
            ${GENS.map((g, i) => `<label class="gen-opt"><input type="radio" name="gen" value="${i}" ${i ? '' : 'checked'}>
              <span><b>${g.type.name}</b> · ${g.name} ${U.badge(g.type.class, g.type.class === 'AI-based' ? 'purple' : 'slate', 'badge-xs')}
              <br><span class="muted">${g.type.description}</span></span></label>`).join('')}`}
        <div class="fld-row">
          <label class="fld">Pages <span class="muted">— required</span>
            <input class="search" id="gPages" inputmode="numeric" value="${S.alloc ? q.get('pages') : S.target || q.get('pages') || ''}" placeholder="e.g. 4 000" ${S.alloc ? 'readonly' : ''}></label>
          <div class="fld">Categories <span class="muted">— all if none ticked</span>
            <div class="gen-cats">${TOPS.map(c => `<label class="qf"><input type="checkbox" data-gcat="${c.id}"> ${c.name}</label>`).join('')}</div></div>
        </div>
        ${cur.length ? `<p class="fine">The ${cur.length} already on it stay — ${M.fmt(curP)} pp. It tops up towards the pages you give; it never swaps out what is there.</p>` : ''}
        ${S.alloc ? `<div class="status-note status-note-purple ed-note" style="margin-top:.875rem"><span>&#9660;</span><div><b>Correcting allocation from ${intent(S.mixBy).name}</b>
          <span>${Object.entries(S.alloc).map(([c, v]) => `${D.cat(c).name} ${M.fmt(v)} pp`).join(' · ')}. Accepted on Intentions; a category that
          cannot be filled stays short. <a href="#" data-noalloc>Use its plain mix instead</a></span></div></div>` : ''}
        <label class="fld">Shape by <span class="muted">— one intention supplies the scope and the mix</span>
          <select id="gShape" ${S.alloc ? 'disabled' : ''}>${shapeable().map(x => `<option value="${x.id}" ${x.id === S.mixBy ? 'selected' : ''}>${x.name}${
            x.overall ? ' — Overall, the default' : ''}${x.scope ? ` · only ${D.cat(x.scope).name}` : ''}${
            x.funding && x.funding !== 'none' ? ` · funded by ${D.proj(x.funding).name}` : x.funding === 'none' ? ' · unfunded only' : ''}</option>`).join('')}</select></label>
        <p class="fine">It is not attached to anything by this: what the list counts towards is worked out from what ends up on it.</p>`,
        `<button class="btn foot-left" data-x>Cancel</button><button class="btn btn-primary" data-ok>Generate draft</button>`, true);
      const ok = host.querySelector('[data-ok]'), pages = host.querySelector('#gPages');
      const check = () => {
        const p = parseInt(pages.value.replace(/\D/g, ''), 10);
        ok.disabled = !(p > 0);
      };
      const na = host.querySelector('[data-noalloc]');
      if (na) na.onclick = (e) => { e.preventDefault(); S.alloc = null; host.remove(); generate(); };
      pages.oninput = check;
      check();
      ok.onclick = () => {
        const g = GENS[one ? 0 : +host.querySelector('[name=gen]:checked').value];
        const cats = [...host.querySelectorAll('[data-gcat]:checked')].map(x => x.dataset.gcat);
        const auth = host.querySelector('#gShape').value;
        const p = parseInt(pages.value.replace(/\D/g, ''), 10);
        host.remove();
        run(g, p, cats, auth, S.alloc);
      };
    }

    /* what an AI-based generator says for itself — its own sentence per pick */
    const AI_WHY = {
      IT3: 'Urgent and asked for an exhibition; its page count was reviewed and accepted.',
      IT26: 'The oldest unscanned regional weekly in the pool; pairs with the Znojmo run already planned.',
      IT27: 'A founding year of the regional press — likely to be asked for again.',
      IT28: 'Fills the National share at a modest size.',
      IT29: 'The only Specialist title ready without a copy elsewhere.',
      IT15: 'Fits the Specialist share, but Kramerius published a copy on 24 Jun — probably not needed.',
      IT8: 'A rescan at 400 dpi colour; the 2019 copy is greyscale.',
      IT30: 'Small, and the 19th-century share is otherwise empty.',
      IT31: 'High priority for VISK 7 and short.',
      IT4: 'Fills out the 20th-century share.',
      IT32: 'High priority; handled by the manuscript studio anyway this month.',
      IT33: 'Early modern share; the only one ready.'
    };

    /* The reference rule-based generator (intentions §4.2): per leaf, the
       authoritative distribution's share of the pages, filled highest
       priority first and then oldest ask; never a split document; a share
       it cannot fill is SHORTFALL, reported, and re-spread across the
       categories that still have supply — never into one at 0%. */
    function run(g, pages, cats, auth, alloc) {
      const I = intent(auth), dist = I.distribution, tol = g.type.class === 'AI-based' ? .08 : .05;
      /* shares are read inside the intention's scope — its node is 100% */
      const shareOf = (id) => I.scope && id === I.scope ? 100 : D.shareWithin(I, id);
      /* with an allocation, a leaf's goal is its node's pages split by the
         shares below that node; without one, its share of the pages */
      const nodes = I.scope ? (D.isLeaf(I.scope) ? [D.cat(I.scope)] : D.childrenOf(I.scope)) : TOPS;
      const goalFor = (leaf) => {
        const s = shareOf(leaf);
        if (!alloc) return s ? pages * s / 100 : 0;
        const n = nodes.find(x => D.under(leaf, x.id)), ns = n && shareOf(n.id);
        return n && ns && s ? (alloc[n.id] || 0) * s / ns : 0;
      };
      const ai = g.type.class === 'AI-based';
      const fixed = onList();
      const leaves = D.categories.filter(c => D.isLeaf(c.id) && (!I.scope || D.under(c.id, I.scope)));
      const allowed = (leaf) => !cats.length || cats.includes(topOf(leaf));
      /* the pool narrowed to the intention's scope: its funding, its subtree */
      const avail = POOL.filter(it => !S.on.has(it.id) && D.inScope(I, it)).sort(byOrder);
      const picks = [], lines = [];
      let total = sum(fixed);
      const reasonOf = (it, extra) => ai ? (AI_WHY[it.id] || 'Fits the mix.')
        : `${it.priority} priority · asked ${reqOf(it).at.split(' ').slice(0, 2).join(' ')}${extra ? ' · ' + extra : ''}`;
      const take = (it, extra) => { picks.push(it); total += pagesOf(it); S.gen.set(it.id, reasonOf(it, extra)); };

      /* pass 1 — each leaf to its share */
      const got = {}, goalOf = {};
      leaves.forEach(c => {
        const share = shareOf(c.id);
        got[c.id] = sum(fixed.filter(it => it.category === c.id));
        goalOf[c.id] = goalFor(c.id);
        if (!share || !allowed(c.id)) return;
        avail.filter(it => it.category === c.id).forEach(it => {
          if (got[c.id] < goalOf[c.id] && got[c.id] + pagesOf(it) <= goalOf[c.id] * (1 + tol) + 50) {
            take(it); got[c.id] += pagesOf(it); }
        });
      });
      const shortOf = (id) => goalOf[id] - got[id] > goalOf[id] * tol ? goalOf[id] - got[id] : 0;
      /* pass 2 — a share that cannot be filled goes to siblings that still
         have supply, the nearest first, and never into a category at 0% */
      let spread = 0;
      /* a correcting run leaves shortfall visible — no re-spread */
      leaves.filter(c => !alloc && shortOf(c.id)).sort((x, y) => shortOf(y.id) - shortOf(x.id)).forEach(c => {
        let need = shortOf(c.id);
        const near = (it) => D.cat(it.category).parent === c.parent ? 0 : topOf(it.category) === topOf(c.id) ? 1 : 2;
        avail.filter(it => !picks.includes(it) && allowed(it.category) && (shareOf(it.category) || 0) > 0)
          .sort((x, y) => near(x) - near(y) || byOrder(x, y)).forEach(it => {
            if (need > 0 && total + pagesOf(it) <= pages * (1 + tol)) {
              take(it, `covers ${c.name}`); got[it.category] += pagesOf(it); need -= pagesOf(it); spread++; }
          });
      });
      /* the report — what is short once everything that could be moved was */
      leaves.forEach(c => {
        const share = shareOf(c.id), path = M.catPath(D.pathOf(c.id));
        if (share == null) return lines.push([path, 'no share in the plan — unallocated, not drawn from']);
        const sh = shortOf(c.id);
        if (!sh) return;
        const left = avail.filter(it => it.category === c.id && !picks.includes(it)).length;
        lines.push([path, `${M.fmt(Math.round(sh))} pp short — ${!allowed(c.id) ? 'left out of the categories'
          : left ? 'what is ready would overshoot' : 'nothing more is ready'}`]);
      });
      const off = total - pages, offPct = Math.round(off / pages * 100);
      const late = picks.filter(lateCopy).length;
      S.mixBy = auth;
      S.generated = { intention: auth, distribution: dist, pages, generator: `${g.type.name} ${g.type.version}`, at: dayY(D.today),
        allocation: alloc || null };
      S.target = pages; S.dirty = true; S.saved = false;
      picks.forEach(it => S.on.add(it.id));
      S.report = `<div class="status-note ${lines.length ? 'status-note-amber' : 'status-note-green'} ed-note ed-report"><span>&#9660;</span><div>
        <b>Draft from ${g.type.name} ${g.type.version}</b> <span>· ${g.type.class} · ${picks.length} picked, ${M.fmt(total)} of
          ${M.fmt(pages)} pp (${off >= 0 ? '+' : ''}${offPct}%, tolerance ${Math.round(tol * 100)}%)${
          spread ? ` · ${spread} re-spread to categories with supply left` : ''}${late ? ` · ${late} with a late copy — look at ${late === 1 ? 'it' : 'them'}` : ''}.
          ${ai ? 'Each reason is the model’s own; review them before saving.' : ''} Nothing is saved yet.</span>
        ${lines.length ? `<details class="ed-shortd"><summary>${lines.length} ${lines.length === 1 ? 'category' : 'categories'} short or unallocated — show</summary>
          <ul class="ed-short">${lines.map(([c, t]) => `<li><b>${c}</b> <span>${t}</span></li>`).join('')}</ul></details>` : ''}
        </div><button class="btn btn-sm ed-x" data-unreport title="Hide the report">&times;</button></div>`;
      paint();
    }
    ed.addEventListener('click', (e) => { if (e.target.closest('[data-unreport]')) { S.report = null; paint(['top']); } });

    /* ?generate — open the dialog straight away (the demo index links it) */
    if (q.has('generate') && GENS.length) generate();
  }
};
