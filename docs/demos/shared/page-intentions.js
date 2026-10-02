/* Intentions — /intentions   (view-catalog Intentions, intentions.md)
   What VERA is trying to digitize. An intention is SCOPE (funding, one
   category subtree) plus OBJECTIVE (a mix, an optional page target, a
   window). Nothing is attached to it: an item counts towards every intention
   whose scope it matches, so they are overlapping measures of the work, not
   containers that own it (decided with the user 2026-09-26).

   Every intention is time-based. The counting start is LOCKED once created
   (it may be in the future); the end is optional. What differs is whether it
   has a target, so the page is two columns of cards:
     Targets   — a page target: planned and delivered against it, pace when
                 it has an end
     Tracking  — no target: intended mix against actual output, ±5 points
   Each column runs running → upcoming, with Ended and Archived folded below.
   Detail is the card itself, expanded; ?i=ID opens and scrolls to one.

   PLANNED / DELIVERED is plan completion (a part of planned, never added to
   it); OUTPUT is everything digitized in the window, which is what a mix is
   measured on. Figures of different intentions overlap and are never
   summed — the column tiles count intentions, not pages.                    */

window.PAGE_INTENTIONS = function (tier) {
  const M = VERA, D = VERA_DATA, U = VERA_UI;
  const role = U.currentRole('dig-curator');
  const held = U.permsOf(role);
  const can = (p) => held.has(p);
  const q = new URLSearchParams(location.search);

  /* ------------------------------------------------------------ records */
  const DAY = 864e5;
  const when = (s) => Date.parse(s) || 0;
  const TODAY = when(D.today);
  const dayY = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const pagesOf = (it) => { const p = D.effectivePages(D.doc(it.doc)); return p ? p.value : 0; };
  const sum = (its) => its.reduce((a, it) => a + pagesOf(it), 0);
  const pct = (a, b) => b ? a / b * 100 : 0;
  const who = (id) => id === 'sys' ? 'VERA' : D.byId(id).name;
  const distOf = (i) => D.distributions.find(d => d.id === i.distribution);
  const usedBy = (dId) => D.intentions.filter(i => i.distribution === dId);
  const overall = D.intentions.find(i => i.overall);
  const GENS = D.generators();
  /* Overall's mix is intention.edit_overall, admin only (decided 2026-10-01) */
  const canMix = (o) => o.overall ? can('intention.edit_overall') : can('intention.edit');
  const BAND = 5;                      /* points either way that still read as "on the mix" */
  const PACE_SLACK = 10;               /* the same slack Projects reads pace with */

  const stateOf = (i) => when(i.starts) > TODAY ? 'Upcoming'
    : i.ends && when(i.ends) + DAY <= TODAY ? 'Ended' : 'Running';
  const elapsed = (i) => Math.max(0, Math.min(100, pct(TODAY - when(i.starts), when(i.ends) + DAY - when(i.starts))));
  const daysTo = (iso) => Math.max(0, Math.ceil((when(iso) + DAY - TODAY) / DAY));
  const windowText = (i) => i.overall ? `Counting since ${dayY(i.starts)} · everything, no end`
    : i.ends ? `${dayY(i.starts)} → ${dayY(i.ends)}`
    : when(i.starts) > TODAY ? `Counts from ${dayY(i.starts)} · no end` : `Counting since ${dayY(i.starts)} · no end`;

  /* scope, in words and as the tree node the mix is read from */
  const scopeName = (i) => i.scope ? D.cat(i.scope).name : null;
  const mixNodes = (i) => i.scope ? (D.isLeaf(i.scope) ? [] : D.childrenOf(i.scope)) : D.categories.filter(c => !c.parent);
  /* a mix belongs to an intention: its own, or the one it tracks (§2) */
  const ownerOf = (i) => D.mixOwner(i);
  const mixLabel = (i) => i.scope ? `Mix within ${scopeName(i)}` : ownerOf(i) === i ? (i.overall ? 'House mix' : 'Own mix') : `${ownerOf(i).name}'s mix`;
  const owners = () => D.intentions.filter(x => ownerOf(x) === x);
  const fundingText = (i) => i.funding == null ? null : i.funding === 'none' ? 'No project' : D.proj(i.funding).name;
  const template = (i) => i.template && D.intentionTemplates.find(t => t.id === i.template);
  const EVERY = { week: 'Weekly', month: 'Monthly', quarter: 'Quarterly' };

  const count = (i) => D.intentionCount(i);

  /* ------------------------------------------------------------ status */
  function statusOf(i, n) {
    const s = stateOf(i), t = i.target;
    if (!t) return null;
    const dp = pct(n.deliveredPages, t), met = n.deliveredPages >= t, full = n.plannedPages >= t;
    if (s === 'Upcoming') return full ? { text: 'Fully planned', tone: 'blue' } : null;
    if (s === 'Ended') return met ? { text: 'Ended — target met', tone: 'green' }
      : { text: `Ended — ${M.fmt(t - n.deliveredPages)} pp short`, tone: 'amber' };
    if (met) return { text: 'Target met', tone: 'green' };
    if (!i.ends) return full ? { text: 'Fully planned', tone: 'blue' } : null;
    /* linear pace, labelled as that and not as a forecast */
    return dp >= elapsed(i) - PACE_SLACK ? { text: 'On pace', tone: 'green' } : { text: 'Behind pace', tone: 'amber' };
  }
  const needs = (i, n) => {
    if (!i.target || !i.ends || stateOf(i) !== 'Running' || n.deliveredPages >= i.target) return null;
    const weeks = Math.max(1, daysTo(i.ends)) / 7;
    return Math.ceil((i.target - n.deliveredPages) / weeks / 10) * 10;
  };

  /* the mix, per child of the scope: intended share within the scope, the
     planned mix and the output mix, each over its own denominator */
  function drift(i, n) {
    const nodes = mixNodes(i);
    const pp = n.plannedPages, op = n.outputPages;
    const rows = nodes.map(c => {
      const intended = D.shareWithin(i, c.id);
      const pl = sum(n.planned.filter(it => D.under(it.category, c.id)));
      const out = sum(n.output.filter(it => D.under(it.category, c.id)));
      const actual = op ? pct(out, op) : null;
      const d = intended == null || actual == null ? null : actual - intended;
      const flag = intended === 0 && out > 0 ? 'excluded'
        : intended == null ? 'unalloc'
        : d == null ? null : Math.abs(d) <= BAND ? 'in' : d > 0 ? 'over' : 'under';
      return { c, intended, planned: pp ? pct(pl, pp) : null, actual, out, d, flag };
    });
    const unalloc = i.scope && D.isLeaf(i.scope) ? 0
      : 100 - nodes.reduce((a, c) => a + (distOf(i).shares[c.id] || 0), 0);
    return { rows, unalloc, out: rows.filter(r => ['over', 'under', 'excluded'].includes(r.flag)) };
  }

  /* ------------------------------------------------------------- pieces */
  const TONES = ['var(--chart-5)', 'var(--chart-3)', 'var(--chart-2)', 'var(--chart-1)', '#bfdbfe'];
  function strip(i, legendOnly) {
    const nodes = mixNodes(i);
    if (!nodes.length) return `<div class="in-strip-l"><span>${mixLabel(i)}</span> <span class="muted">— one category, all of it</span></div>`;
    let used = 0;
    const segs = nodes.map((c, k) => {
      const s = D.shareWithin(i, c.id);
      if (!s) return '';
      used += s;
      return `<i style="width:${s}%;background:${TONES[k % TONES.length]}" title="${c.name} ${Math.round(s)}%"></i>`;
    }).join('');
    const gap = Math.max(0, 100 - used);
    const o = ownerOf(i), tr = D.trackersOf(i).length;
    return `${legendOnly && overallBars(i) ? '' : `<div class="in-strip">${segs}${gap > .5 ? `<i class="in-gap" style="width:${gap}%" title="${Math.round(gap)}% unallocated"></i>` : ''}</div>`}
      <div class="in-strip-l"><span>${mixLabel(i)}</span>
        <span class="muted">${nodes.map(c => { const s = D.shareWithin(i, c.id);
          return `${c.name} ${s == null ? '<span class="ca-amber">—</span>' : s === 0 ? '0' : Math.round(s)}`; }).join(' · ')}${
          gap > .5 ? ` · <span class="ca-amber">${Math.round(gap)}% unallocated</span>` : ''}</span>
        <span class="in-strip-r muted">${o !== i ? `tracks ${o.name}` : tr ? `own · tracked by ${tr}` : 'own · used only here'}${
          can('category.read') ? ` · <a href="categories.html?i=${i.id}${i.scope ? '&c=' + i.scope : ''}">${canMix(o) ? 'Edit mix' : 'Proportions'}</a>` : ''}</span></div>`;
  }

  /* a tracking card already draws the intended mix as a bar, above */
  const overallBars = (i) => !i.target && count(i).outputPages > 0;

  function bars(i, n) {
    const s = stateOf(i), t = i.target;
    const row = (label, w, txt, cls, tick) => `<div class="pj-bar in-bar ${cls}">
      <span class="pj-bl">${label}</span>
      <div class="meter"><i style="width:${Math.min(100, w)}%"></i>${
        tick != null ? `<b class="pj-tick" style="left:${tick}%" title="where it would be at an even pace"></b>` : ''}</div>
      <span class="pj-bv">${txt}</span></div>`;
    const of = (v) => `${M.fmt(v)} / ${M.fmt(t)} · <b>${Math.round(pct(v, t))}%</b>`;
    const out = [];
    const tick = s === 'Running' && i.ends ? elapsed(i) : null;
    if (i.ends) out.push(row('Time', s === 'Upcoming' ? 0 : elapsed(i),
      s === 'Upcoming' ? `starts in ${daysTo(i.starts) - 1} days` : s === 'Ended' ? `ended ${dayY(i.ends)}`
        : `${Math.round(elapsed(i))}% · ${daysTo(i.ends)} days left`, 'pj-time'));
    out.push(row('Planned', pct(n.plannedPages, t), of(n.plannedPages) +
      (n.plannedPages > t ? ` <span class="muted">+${M.fmt(n.plannedPages - t)}</span>` : ''), 'pj-planned', tick));
    out.push(row('Delivered', pct(n.deliveredPages, t), of(n.deliveredPages), 'pj-delivered', tick));
    return `<div class="pj-bars in-bars">${out.join('')}</div>`;
  }

  /* per leaf of the scope: its share of the target, planned, delivered */
  function fillTable(i, n) {
    const leaves = D.categories.filter(c => D.isLeaf(c.id) && (!i.scope || D.under(c.id, i.scope)));
    const rows = leaves.map(c => {
      const e = D.shareWithin(i, c.id);
      const goal = e ? i.target * e / 100 : 0;
      const pl = sum(n.planned.filter(it => it.category === c.id));
      const dl = sum(n.delivered.filter(it => it.category === c.id));
      const short = e > 0 && pl < goal * .95;
      return `<tr><td>${i.scope && c.id !== i.scope ? M.catPath(D.pathOf(c.id).slice(D.pathOf(i.scope).length)) || c.name : M.catPath(D.pathOf(c.id))}</td>
        <td class="num">${e == null ? '<span class="ca-amber">unallocated</span>' : e === 0 ? '<span class="muted">excluded</span>' : (Math.round(e * 10) / 10) + '%'}</td>
        <td class="num">${e ? M.fmt(Math.round(goal)) : '—'}</td>
        <td class="num ${short ? 'in-short' : ''}">${M.fmt(pl)}</td>
        <td class="num">${M.fmt(dl)}</td></tr>`;
    }).join('');
    return `<table class="sub-table ca-table in-table"><thead><tr><th>${i.scope ? `Within ${scopeName(i)}` : 'Category'}</th>
      <th class="num">Share</th><th class="num">Target pp</th><th class="num">Planned</th><th class="num">Delivered</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <p class="fine">A planned figure in amber is short of its share. Shares are read ${i.scope
        ? `inside ${scopeName(i)} — it is 100% here, whatever it gets globally` : 'of the whole tree'}.</p>`;
  }

  function driftTable(i, n, dr) {
    const cell = (v) => v == null ? '<span class="muted">—</span>' : Math.round(v) + '%';
    const FLAG = { in: ['In band', 'green'], over: ['Over', 'red'], under: ['Under', 'blue'],
                   excluded: ['Excluded category used', 'red'], unalloc: ['No share', 'amber'] };
    return `<table class="sub-table ca-table in-table"><thead><tr><th>${i.scope ? `Within ${scopeName(i)}` : 'Category'}</th>
        <th class="num">Intended</th><th class="num">Planned</th><th class="num">Output</th><th class="num">Drift</th><th></th></tr></thead>
      <tbody>${dr.rows.map(r => `<tr><td>${r.c.name}</td>
        <td class="num">${r.intended == null ? '<span class="ca-amber">—</span>' : cell(r.intended)}</td>
        <td class="num">${cell(r.planned)}</td><td class="num">${cell(r.actual)}</td>
        <td class="num">${r.d == null ? '' : `<span class="${Math.abs(r.d) > BAND ? (r.d > 0 ? 'ca-d up' : 'ca-d down') : 'muted'}">${r.d > 0 ? '+' : ''}${Math.round(r.d)}</span>`}</td>
        <td>${r.flag ? U.badge(FLAG[r.flag][0], FLAG[r.flag][1], 'badge-xs') : ''}</td></tr>`).join('')}</tbody></table>`;
  }

  function listsOf(i, n) {
    const ids = [...new Set(n.planned.map(it => it.list))];
    return ids.map(id => { const l = D.listOf(id), its = n.planned.filter(it => it.list === id);
      return `<div class="row-kv"><span><a href="lists.html?list=${id}">${l.name}</a> <span class="mono muted">${id}</span></span>
        <span class="muted">${its.length} ${its.length === 1 ? 'item' : 'items'} · ${M.fmt(sum(its))} pp</span></div>`; }).join('');
  }

  /* ------------------------------------------------------------- cards */
  function badges(i, n) {
    const st = statusOf(i, n), tp = template(i);
    return [
      i.overall ? U.badge('Overall', 'purple', 'badge-xs') : '',
      stateOf(i) === 'Upcoming' ? U.badge('Upcoming', 'slate', 'badge-xs') : '',
      st ? U.badge(st.text, st.tone, 'badge-xs') : '',
      tp ? `<span class="badge badge-slate badge-xs" title="Made by the repeat ${tp.name}">&#8635; ${EVERY[tp.every]}</span>` : ''
    ].join('');
  }
  function scopeLine(i) {
    return [fundingText(i) ? `Funding: ${i.funding && i.funding !== 'none' ? `<a href="projects.html?p=${i.funding}">${fundingText(i)}</a>` : fundingText(i)}` : null,
      i.scope ? `Only ${M.catPath(D.pathOf(i.scope))}` : null].filter(Boolean).join(' · ');
  }

  function card(i) {
    const n = count(i), s = stateOf(i), tracking = !i.target;
    const nd = needs(i, n);
    const acts = [];
    const genOK = GENS.length && can('list.create') && s !== 'Ended' && !i.archived;
    const offMix = tracking && count(i).outputPages && drift(i, count(i)).out.length;
    /* a behind-pace target gets a catch-up Generate, pre-filled with the
       pages it is short of an even pace (decided 2026-09-26) */
    const st0 = statusOf(i, n);
    const shortBy = st0 && st0.text === 'Behind pace' ? Math.max(0, Math.round((i.target * elapsed(i) / 100 - n.plannedPages) / 10) * 10) : 0;
    if (genOK) acts.push(offMix
      ? `<button class="btn btn-sm" data-correct="${i.id}">Generate correcting list…</button>`
      : shortBy ? `<a class="btn btn-sm" href="lists.html?new&generate&shape=${i.id}&pages=${shortBy}" title="The pages it is short of an even pace">Generate catch-up — ${M.fmt(shortBy)} pp</a>`
      : `<a class="btn btn-sm" href="lists.html?new&generate&shape=${i.id}">${tracking ? 'Generate against this mix' : 'Generate a list'}</a>`);
    if (can('intention.edit')) {
      acts.push(`<button class="btn btn-sm" data-edit="${i.id}">Edit</button>`);
      const archivable = !i.overall && (s === 'Ended' || (i.target && n.deliveredPages >= i.target) || tracking);
      if (archivable) acts.push(`<button class="btn btn-sm" data-archive="${i.id}">Archive</button>`);
    }
    let bodyHTML;
    if (tracking) {
      const dr = drift(i, n);
      const basis = n.outputPages
        ? `Output ${i.ends ? `${dayY(i.starts)} → ${dayY(i.ends)}` : `since ${dayY(i.starts)}`} · <b>${M.fmt(n.outputPages)} pp</b> digitized${i.scope ? ` in ${scopeName(i)}` : ''}`
        : s === 'Upcoming' ? `Counts from ${dayY(i.starts)} — no output yet` : 'No output yet — nothing matching has been digitized in its window';
      const worst = dr.rows.filter(r => r.d != null).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
      bodyHTML = `<div class="in-basis">${basis}</div>
        ${n.outputPages ? `<div class="in-mix2">${mixCompare(i, dr)}</div>` : ''}
        ${dr.out.length ? `<div class="in-flag">${dr.out.length} ${dr.out.length === 1 ? 'category' : 'categories'} out of the ±${BAND} band${
          worst ? ` · worst: <b>${worst.c.name} ${worst.d > 0 ? '+' : ''}${Math.round(worst.d)} pts</b>` : ''}</div>`
          : n.outputPages ? `<div class="in-ok">Every category within ±${BAND} points.</div>` : ''}
        ${dr.unalloc > .5 ? `<div class="in-flag in-flag-amber">${Math.round(dr.unalloc)}% of the mix is unallocated</div>` : ''}
        <details class="in-more" ${q.get('i') === i.id ? 'open' : ''}><summary>Per category</summary>
          ${driftTable(i, n, dr)}
          <p class="fine">Intended is the mix${i.scope ? ` within ${scopeName(i)}` : ''}; planned is over the ${M.fmt(n.plannedPages)} pp on lists
            starting in its window; output is over the ${M.fmt(n.outputPages)} pp digitized in it, whenever they were planned. Drift is
            output minus intended, in points; ±${BAND} is display tolerance, not a change to the mix.</p>
          ${n.noDate.length ? `<p class="fine">${n.noDate.length} digitized with no date recorded — not counted.</p>` : ''}
        </details>`;
    } else {
      bodyHTML = `${bars(i, n)}
        ${nd ? `<div class="in-needs">Needs <b>${M.fmt(nd)} pp/week</b> to reach it by ${dayY(i.ends)}</div>` : ''}
        ${!i.ends && s === 'Running' && n.deliveredPages < i.target ? `<div class="in-needs"><b>${M.fmt(i.target - n.deliveredPages)} pp</b> to go · no end, so no pace</div>` : ''}
        <details class="in-more" ${q.get('i') === i.id ? 'open' : ''}><summary>Per category and lists</summary>
          ${fillTable(i, n)}
          <div class="in-sub">Lists starting in its window</div>
          ${listsOf(i, n) || '<p class="fine" style="margin-top:0">None yet.</p>'}
        </details>`;
    }
    return `<article class="pj-card in-card ${i.overall ? 'in-overall' : ''}" id="int-${i.id}">
      <div class="pj-card-head">
        <div><div class="pj-name">${i.name}</div>
          <div class="pj-sub">${windowText(i)}${i.target ? ` · target ${M.fmt(i.target)} pp` : ''}</div>
          ${scopeLine(i) ? `<div class="pj-sub">${scopeLine(i)}</div>` : ''}</div>
        <div class="pj-badges">${badges(i, n)}</div>
      </div>
      ${i.description ? `<p class="in-desc">${i.description}</p>` : ''}
      ${bodyHTML}
      ${strip(i, tracking)}
      ${acts.length ? `<div class="pj-foot in-foot">${i.overall ? '<span class="muted">The default mix for generating. Cannot be archived or deleted.</span>' : ''}<span class="in-acts">${acts.join('')}</span></div>` : ''}
    </article>`;
  }

  /* two stacked bars: intended against output, same colours as the strip */
  function mixCompare(i, dr) {
    const bar = (vals) => `<div class="in-strip">${dr.rows.map((r, k) => { const v = vals(r);
      return v ? `<i style="width:${v}%;background:${TONES[k % TONES.length]}" title="${r.c.name} ${Math.round(v)}%"></i>` : ''; }).join('')}</div>`;
    return `<div class="in-cmp"><span class="muted">Intended</span>${bar(r => r.intended || 0)}</div>
      <div class="in-cmp"><span class="muted">Output</span>${bar(r => r.actual || 0)}</div>
      <div class="in-cmp-d">${dr.rows.filter(r => r.flag && r.flag !== 'in').map(r =>
        `<span class="${r.flag === 'under' ? 'ca-d down' : r.flag === 'unalloc' ? 'ca-amber' : 'ca-d up'}">${r.c.name} ${
          r.flag === 'excluded' ? 'excluded, used' : r.flag === 'unalloc' ? 'no share' : (r.d > 0 ? '+' : '') + Math.round(r.d)}</span>`).join(' · ') || ''}</div>`;
  }

  function foldRows(list, kind) {
    return list.map(i => { const n = count(i), st = statusOf(i, n);
      const res = i.target ? `${M.fmt(n.deliveredPages)} / ${M.fmt(i.target)} pp` : `${M.fmt(n.outputPages)} pp output`;
      const btn = !can('intention.edit') || i.overall ? ''
        : kind === 'archived' ? `<button class="btn btn-sm" data-unarchive="${i.id}">Unarchive</button>`
        : `<button class="btn btn-sm" data-archive="${i.id}">Archive</button>`;
      return `<tr id="int-${i.id}"><td><b>${i.name}</b>${template(i) ? ' <span class="muted">&#8635;</span>' : ''}
          <div class="muted">${i.ends ? `${dayY(i.starts)} → ${dayY(i.ends)}` : `since ${dayY(i.starts)}`}</div></td>
        <td class="num">${res}</td>
        <td>${st ? U.badge(st.text.replace('Ended — ', ''), st.tone, 'badge-xs') : ''}${kind === 'archived'
          ? `<div class="muted">archived ${i.archived.at} · ${who(i.archived.by)}${i.archived.by === 'sys' ? ' (repeat)' : ''}</div>` : ''}</td>
        <td class="in-c-act">${btn}</td></tr>`; }).join('');
  }
  const fold = (title, list, kind, open) => list.length ? `<details class="pj-ended in-fold" ${open ? 'open' : ''}>
      <summary>${title} <span class="muted">· ${list.length}</span></summary>
      <table class="pj-table in-ftable"><tbody>${foldRows(list, kind)}</tbody></table></details>` : '';

  function column(key, title, list) {
    const live = list.filter(i => !i.archived);
    const running = live.filter(i => stateOf(i) === 'Running');
    const upcoming = live.filter(i => stateOf(i) === 'Upcoming').sort((a, b) => when(a.starts) - when(b.starts));
    const ended = live.filter(i => stateOf(i) === 'Ended').sort((a, b) => when(b.ends) - when(a.ends));
    const archived = list.filter(i => i.archived);
    let order;
    if (key === 'target') {
      const dated = running.filter(i => i.ends).sort((a, b) => when(a.ends) - when(b.ends));
      const open = running.filter(i => !i.ends).sort((a, b) =>
        pct(count(b).deliveredPages, b.target) - pct(count(a).deliveredPages, a.target));
      order = [...dated, ...open];
    } else order = running.sort((a, b) => (b.overall - a.overall) || a.name.localeCompare(b.name));

    /* the tile counts intentions and statuses — pages would double-count */
    const st = {};
    [...running, ...upcoming].forEach(i => { const x = statusOf(i, count(i)); if (x) st[x.text] = (st[x.text] || 0) + 1; });
    const outBand = key === 'track' ? running.filter(i => drift(i, count(i)).out.length).length : 0;
    const tile = [`<b>${running.length}</b> running`, upcoming.length ? `<b>${upcoming.length}</b> upcoming` : null,
      ...Object.entries(st).map(([k, v]) => `<b>${v}</b> ${k.toLowerCase()}`),
      key === 'track' ? (outBand ? `<b class="ca-d up">${outBand}</b> out of band` : 'all in band') : null].filter(Boolean).join(' · ');

    /* a repeat has its own address, ?t= (decided 2026-09-26) — Schedules and
       the Tasks trigger link here */
    const tpls = key === 'target' ? D.intentionTemplates.map(t => `<div class="in-tpl ${q.get('t') === t.id ? 'in-hit' : ''}" id="tpl-${t.id}">
        <span>&#8635; <b>${t.name.replace('{period}', '<i>' + ({ week: 'week', month: 'month', quarter: 'quarter' })[t.every] + '</i>')}</b> <span class="muted">· ${EVERY[t.every].toLowerCase()} · ${M.fmt(t.target)} pp ·
          ${D.mixText({ distribution: t.distribution })} · next ${dayY(t.next)}${t.archivePrevious ? ' · archives the previous one' : ''}</span></span>
        ${can('intention.repeat') ? `<button class="btn btn-sm" data-tpl="${t.id}">Edit</button>` : ''}</div>`).join('') : '';

    return `<section class="in-col" data-col="${key}">
      <div class="in-col-head"><h2>${title}</h2><div class="in-tile">${tile}</div></div>
      ${tpls}
      ${order.map(card).join('') || '<p class="fine">Nothing running.</p>'}
      ${upcoming.length ? `<div class="in-sep">Upcoming</div>${upcoming.map(card).join('')}` : ''}
      ${fold('Ended', ended, 'ended', q.get('i') && ended.some(i => i.id === q.get('i')))}
      ${fold('Archived', archived, 'archived', q.get('i') && archived.some(i => i.id === q.get('i')))}
    </section>`;
  }

  const FOOTER = `<b>Nothing is attached to an intention.</b> An item counts towards every intention whose
      funding and category it matches, when its list starts inside the window — so one page can count
      towards a grant, a regional target and the house mix at once. Those figures overlap and are never added.
      <br><b>Planned and delivered are plan completion</b>: what was put on lists in the window, and how much
      of that was digitized in it. <b>Output</b> is everything digitized in the window, whenever it was planned —
      what a mix is measured on.
      <br><b>The counting start is fixed once created.</b> To count from another date, make a new intention
      from the old one. Not here: documents — an intention is a target, not a selection.`;

  function draw(note) {
    const all = D.intentions;
    const tgt = all.filter(i => i.target), trk = all.filter(i => !i.target);
    const run = all.filter(i => !i.archived && stateOf(i) === 'Running').length;
    const up = all.filter(i => !i.archived && stateOf(i) === 'Upcoming').length;
    const acts = [];
    if (can('intention.repeat')) acts.push('<button class="btn btn-sm" data-tpl="new">New repeat</button>');
    if (can('intention.edit')) acts.push('<button class="btn btn-primary btn-sm" data-new>New intention</button>');
    retitle(`${run} running · ${up} upcoming · ${all.filter(i => i.archived).length} archived`, acts.join(''));
    /* small and phone show one column at a time — a view switch, not a route */
    const TABS = tier === 'small' || tier === 'phone';
    const hit = q.get('i') && byId(q.get('i'));
    const col = hit ? (hit.target ? 'target' : 'track') : q.get('col') === 'track' ? 'track' : 'target';
    const tabs = TABS ? `<div class="viewtabs in-tabs">${[['target', 'Targets', tgt], ['track', 'Tracking', trk]].map(([k, l, xs]) =>
      `<a href="#" data-col="${k}" class="${k === col ? 'current' : ''}">${l} <span class="in-tab-n">${xs.filter(i => !i.archived).length}</span></a>`).join('')}</div>` : '';
    body().innerHTML = `${note || ''}${tabs}<div class="in-cols">
        ${!TABS || col === 'target' ? column('target', 'Targets', tgt) : ''}
        ${!TABS || col === 'track' ? column('track', 'Tracking', trk) : ''}
      </div><div class="budget">${FOOTER}</div>`;
  }

  /* ------------------------------------------------------------- modals */
  function modal(title, bodyHTML, foot) {
    const host = document.createElement('div');
    host.className = 'modal-scrim';
    host.innerHTML = `<div class="modal">
      <div class="modal-head"><h2>${title}</h2>
        <button class="modal-x" data-x aria-label="Close">&times;</button></div>
      <div class="modal-body">${bodyHTML}</div>
      <div class="modal-foot">${foot}</div></div>`;
    host.querySelectorAll('[data-x]').forEach(b => b.onclick = () => host.remove());
    host.onclick = (e) => { if (e.target === host) host.remove(); };
    document.body.appendChild(host);
    return host;
  }
  const catOptions = (sel) => {
    const out = [`<option value="" ${!sel ? 'selected' : ''}>All categories</option>`];
    const walk = (c, d) => { out.push(`<option value="${c.id}" ${sel === c.id ? 'selected' : ''}>${'&nbsp;&nbsp;'.repeat(d * 2)}${c.name}</option>`);
      D.childrenOf(c.id).forEach(k => walk(k, d + 1)); };
    D.categories.filter(c => !c.parent).forEach(c => walk(c, 1));
    return out.join('');
  };
  const fundOptions = (sel) => [`<option value="" ${sel == null ? 'selected' : ''}>Any — funded or not</option>`,
    `<option value="none" ${sel === 'none' ? 'selected' : ''}>No project</option>`,
    ...D.projects.map(p => `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>${p.name}</option>`)].join('');
  /* §2.1 — track an owner, or own a copy of one. The picker offers only
     owners, so a chain cannot be picked */
  const mixOptions = (i) => {
    const cur = i ? (ownerOf(i) === i ? 'own' : 't:' + ownerOf(i).id) : 't:' + overall.id;
    const os = owners().filter(o => o !== i);
    return [...(i && ownerOf(i) === i ? [['own', 'Own mix — keep it']] : []),
      ...os.map(o => ['t:' + o.id, `Track ${o.name}${o.overall ? ' (Overall)' : ''}`]),
      ...owners().filter(o => o !== i).map(o => ['c:' + o.id, `Own mix, copied from ${o.name}`])]
      .map(([k, l]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${l}</option>`).join('');
  };
  /* apply the choice: tracking points at the owner's mix, a copy is a new
     mix this intention owns. An owner with trackers can switch to tracking
     only by moving them with it (§2.2) */
  function applyMix(i, v, moveThem) {
    if (v === 'own') return;
    if (v.startsWith('t:')) {
      const o = D.intentions.find(x => x.id === v.slice(2)), tr = D.trackersOf(i);
      if (moveThem) tr.forEach(x => { x.distribution = o.distribution; });
      i.distribution = o.distribution;
    } else {
      const src = distOf(D.intentions.find(x => x.id === v.slice(2)));
      const nd = { id: 'd' + (D.distributions.length + 1), name: `${i.name}'s mix`, isOverall: false, owner: i.id,
        shares: Object.assign({}, src.shares) };
      D.distributions.push(nd); i.distribution = nd.id;
    }
  }

  /* one editor for new, edit and "new from this one" — the counting start is
     editable only on something that has not counted yet */
  function editIntention(src, mode) {
    const isNew = mode !== 'edit';
    const i = src && mode === 'edit' ? src : null;
    const v = Object.assign({ name: '', description: '', funding: null, scope: null, distribution: overall.distribution,
      target: '', starts: D.today, ends: '' }, src ? JSON.parse(JSON.stringify(src)) : {});
    if (mode === 'copy') { v.name = `${src.name} (from ${dayY(D.today)})`; v.starts = D.today; delete v.archived; delete v.template; }
    const locked = !!i;
    const isOverall = i && i.overall;
    const host = modal(i ? `Edit ${i.name}` : mode === 'copy' ? `New intention from ${src.name}` : 'New intention', `
      <label class="fld" style="margin-top:0">Name<input id="inName" value="${v.name.replace(/"/g, '&quot;')}" placeholder="e.g. Regional weeklies 2027"></label>
      <label class="fld">Description <span class="muted">— optional</span><textarea id="inDesc" rows="2">${v.description || ''}</textarea></label>
      ${isOverall ? `<p class="fine">The Overall intention always counts everything from ${dayY(i.starts)}, has no target and no end.
          It always owns its mix${D.trackersOf(i).length ? `, which ${D.trackersOf(i).length} others track` : ''} — ${can('intention.edit_overall')
            ? `change the percentages in <a href="categories.html?i=${i.id}">Categories</a>` : 'only an admin changes its percentages'}.</p>` : `
      <div class="fld-row">
        <label class="fld">Funding<select id="inFund">${fundOptions(v.funding)}</select></label>
        <label class="fld">Categories <span class="muted">— one subtree</span><select id="inScope">${catOptions(v.scope)}</select></label>
      </div>
      <div class="fld-row">
        <label class="fld">Mix<select id="inDist">${mixOptions(i)}</select></label>
        <label class="fld">Target pages <span class="muted">— none: it tracks the mix</span>
          <input type="number" min="1" step="100" id="inTarget" value="${v.target || ''}"></label>
      </div>
      <div class="fld-row">
        ${locked ? `<div class="fld">Counts from<div class="in-locked">${dayY(i.starts)} <span class="muted">· fixed</span></div>
            <a href="#" data-copy class="in-copy">Count from another date — make a new intention from this one</a></div>`
          : `<label class="fld">Counts from <span class="muted">— fixed once created</span><input type="date" id="inStarts" value="${v.starts}"></label>`}
        <label class="fld">Ends <span class="muted">— empty: no end</span><input type="date" id="inEnds" value="${v.ends || ''}"></label>
      </div>
      <div class="in-mixnote" id="inMixNote"></div>
      <div class="in-land" id="inLand"></div>`}
      <div class="pj-err" id="inErr"></div>`,
      `${i && !i.overall ? '<button class="btn foot-left btn-danger" data-del>Delete…</button>' : '<span class="foot-left"></span>'}
       <button class="btn" data-x>Cancel</button><button class="btn btn-primary" data-ok>${isNew ? 'Create intention' : 'Save'}</button>`);
    const $ = (id) => host.querySelector('#' + id);
    const read = () => isOverall ? Object.assign({}, i, { name: $('inName').value.trim(), description: $('inDesc').value.trim() })
      : { name: $('inName').value.trim(), description: $('inDesc').value.trim(),
          funding: $('inFund').value || null, scope: $('inScope').value || null,
          target: +$('inTarget').value || null, starts: locked ? i.starts : $('inStarts').value, ends: $('inEnds').value || null };
    /* what the mix choice does, said before Save (§2.2) */
    const mixNote = () => {
      const box = $('inMixNote'); if (!box) return;
      const v = $('inDist').value, tr = i ? D.trackersOf(i) : [];
      box.innerHTML = i && ownerOf(i) === i && v.startsWith('t:') && tr.length
        ? `<label class="line in-line"><input type="checkbox" id="inMove"> <span><b>Move the ${tr.length} that track it along</b>
            — ${tr.map(x => x.name).join(', ')}. They would track ${D.intentions.find(x => x.id === v.slice(2)).name} too.
            <span class="muted">Without this it cannot switch: that would make a chain.</span></span></label>`
        : i && ownerOf(i) !== i && v.startsWith('c:') ? '<p class="fine">Detaching: it gets a copy of the mix as it is now. Nothing changes for anyone else.</p>'
        : v.startsWith('c:') ? '<p class="fine">A copy, edited on its own in Categories.</p>' : '';
    };
    const land = () => {
      if (isOverall) return;
      const x = read();
      if (!x.starts) { $('inLand').innerHTML = ''; return; }
      const where = x.target ? 'Targets' : 'Tracking';
      let msg = `Lands in <b>${where}</b>${x.target && x.ends ? ', with a pace' : x.target ? ' — no end, so no pace' : ''}.`;
      if (i) {
        const a = count(i), b = count(Object.assign({ id: i.id }, x));
        const ch = (l, p, n) => p === n ? '' : `<div>${l}: ${M.fmt(p)} → <b>${M.fmt(n)}</b> pp</div>`;
        const diff = ch('Planned', a.plannedPages, b.plannedPages) + ch('Delivered', a.deliveredPages, b.deliveredPages)
          + ch('Output', a.outputPages, b.outputPages);
        msg += diff ? `<div class="in-diff"><b>Saving recounts it, over its whole window:</b>${diff}</div>` : ' Its counts do not change.';
      }
      $('inLand').innerHTML = msg;
    };
    host.addEventListener('input', land); host.addEventListener('change', land); land();
    if ($('inDist')) { $('inDist').addEventListener('change', mixNote); mixNote(); }
    const cp = host.querySelector('[data-copy]');
    if (cp) cp.onclick = (e) => { e.preventDefault(); host.remove(); editIntention(i, 'copy'); };
    const dl = host.querySelector('[data-del]');
    if (dl) dl.onclick = () => { host.remove(); del(i); };
    host.querySelector('[data-ok]').onclick = () => {
      const x = read();
      const err = !x.name ? 'An intention needs a name.'
        : D.intentions.some(o => o !== i && o.name.toLowerCase() === x.name.toLowerCase()) ? 'Another intention already has that name.'
        : !x.starts ? 'Say when it starts counting.'
        : x.ends && when(x.ends) < when(x.starts) ? 'It cannot end before it starts counting.'
        : $('inMove') && !$('inMove').checked ? 'Others track its mix — move them along, or keep its own mix.' : '';
      if (err) { $('inErr').textContent = err; return; }
      host.remove();
      const mv = $('inDist') ? $('inDist').value : 'own';
      if (i) { Object.assign(i, x); if (!isOverall) applyMix(i, mv, $('inMove') && $('inMove').checked); return go(i.id, saved(`Saved ${i.name}.`, 'Its counts are recalculated over its whole window; the history keeps the old definition.')); }
      const ni = Object.assign({ id: 'in' + (D.intentions.length + 1), distribution: overall.distribution }, x);
      D.intentions.push(ni); applyMix(ni, mv);
      go(ni.id, saved(`Created ${ni.name}.`, `${ni.target ? 'Targets' : 'Tracking'} · ${stateOf(ni).toLowerCase()}. Nothing to attach — whatever matches its scope counts.`));
    };
  }

  function del(i) {
    const gen = D.lists.filter(l => l.generated && l.generated.intention === i.id);
    const host = modal(`Delete ${i.name}?`, `
      <p style="margin-top:0">Nothing is attached to an intention, so <b>no list changes</b> and no item moves.</p>
      ${gen.length ? `<p>${gen.length} ${gen.length === 1 ? 'list was' : 'lists were'} generated with it
        (${gen.map(l => l.name).join(', ')}). ${gen.length === 1 ? 'Its' : 'Their'} history keeps that, with the mix as it was then.</p>` : ''}
      <p class="fine">Archive instead if you only want it off the page — archiving keeps its result.</p>`,
      `<button class="btn foot-left" data-x>Cancel</button>${i.archived ? '' : '<button class="btn" data-arch>Archive instead</button>'}<button class="btn btn-danger" data-ok>Delete</button>`);
    host.querySelector('[data-ok]').onclick = () => { host.remove(); D.intentions.splice(D.intentions.indexOf(i), 1);
      go(null, saved(`Deleted ${i.name}.`, 'No list changed.')); };
    const a = host.querySelector('[data-arch]');
    if (a) a.onclick = () => { host.remove(); archive(i); };
  }

  function archive(i) {
    i.archived = { at: dayY(D.today), by: role === 'admin' ? 'u3' : 'u2' };
    go(i.id, saved(`Archived ${i.name}.`, 'Only off the page — its counts are unchanged.', i.id));
  }

  /* a repeat — admin only (intention.repeat). It makes occurrences; editing
     it changes the ones still to come, never one that exists */
  function editTemplate(t) {
    const isNew = !t;
    const v = t || { name: '', every: 'month', funding: null, scope: null, distribution: overall.distribution, target: '', archivePrevious: true };
    const made = t ? D.intentions.filter(i => i.template === t.id).length : 0;
    const host = modal(isNew ? 'New repeat' : `Edit repeat — ${t.name}`, `
      <label class="fld" style="margin-top:0">Name <span class="muted">— {period} becomes e.g. July 2026</span>
        <input id="tpName" value="${v.name}" placeholder="e.g. Monthly output — {period}"></label>
      <div class="fld-row">
        <label class="fld">Every<select id="tpEvery">${Object.entries(EVERY).map(([k, l]) =>
          `<option value="${k}" ${v.every === k ? 'selected' : ''}>${l.replace('ly', '')}</option>`).join('')}</select></label>
        <label class="fld">Target pages <span class="muted">— none: it tracks the mix</span>
          <input type="number" min="1" step="100" id="tpTarget" value="${v.target || ''}"></label>
      </div>
      <div class="fld-row">
        <label class="fld">Funding<select id="tpFund">${fundOptions(v.funding)}</select></label>
        <label class="fld">Categories<select id="tpScope">${catOptions(v.scope)}</select></label>
      </div>
      <label class="fld">Mix <span class="muted">— each occurrence tracks it</span><select id="tpDist">${owners().map(o =>
        `<option value="${o.distribution}" ${o.distribution === v.distribution ? 'selected' : ''}>Track ${o.name}${o.overall ? ' (Overall)' : ''}</option>`).join('')}</select></label>
      <label class="line in-line"><input type="checkbox" id="tpArch" ${v.archivePrevious ? 'checked' : ''}>
        <span>Archive the previous one when the next is made <span class="muted">— it only leaves the page; its result stays</span></span></label>
      <p class="fine">Each period gets its own intention, with its own window and progress — nothing is reset.
        ${made ? `Changes apply from the next one; the ${made} already made keep their definition — edit them one by one.` : ''}</p>
      <div class="pj-err" id="tpErr"></div>`,
      `<button class="btn foot-left" data-x>Cancel</button><button class="btn btn-primary" data-ok>${isNew ? 'Create repeat' : 'Save'}</button>`);
    const $ = (id) => host.querySelector('#' + id);
    host.querySelector('[data-ok]').onclick = () => {
      const x = { name: $('tpName').value.trim(), every: $('tpEvery').value, target: +$('tpTarget').value || null,
        funding: $('tpFund').value || null, scope: $('tpScope').value || null, distribution: $('tpDist').value,
        archivePrevious: $('tpArch').checked };
      if (!x.name.includes('{period}')) { $('tpErr').textContent = 'Put {period} in the name, so each occurrence is told apart.'; return; }
      host.remove();
      if (t) Object.assign(t, x);
      else D.intentionTemplates.push(Object.assign({ id: 't' + (D.intentionTemplates.length + 1), since: D.today, by: 'u3',
        next: x.every === 'week' ? '2026-06-29' : x.every === 'quarter' ? '2026-07-01' : '2026-07-01' }, x));
      draw(saved(isNew ? 'Repeat created.' : 'Repeat saved.', isNew ? 'Its first occurrence is made when the next period starts.' : 'From the next occurrence on.'));
    };
  }

  /* A correcting run: the allocation that brings output back towards the
     mix, shown and accepted BEFORE anything is generated. Each category gets
     what it lacks against its share of (output + the new pages); if the gaps
     add up to more than the pages, they are cut in proportion. Supply the
     pool cannot cover stays visible as shortfall — moving those pages to
     another category is a decision, not a default. */
  const POOL = D.iterations.filter(it => it.progress === 'Ready' && !it.list && M.passesGates(it));
  function correct(i) {
    const n = count(i), dr = drift(i, n);
    const host = modal(`Correcting list — ${i.name}`, `
      <p style="margin-top:0" class="fine">Output ${i.scope ? `in ${scopeName(i)} ` : ''}so far: <b>${M.fmt(n.outputPages)} pp</b>
        since ${dayY(i.starts)}. The new pages go where the output is short of the mix${i.scope ? ` within ${scopeName(i)}` : ''}.</p>
      <label class="fld">Pages for the list<input type="number" min="100" step="100" id="coPages" value="3000"></label>
      <div id="coTable"></div>`,
      `<button class="btn foot-left" data-x>Cancel</button><a class="btn btn-primary" id="coGo" href="#">Generate draft with this allocation</a>`);
    const $ = (id) => host.querySelector('#' + id);
    function plan() {
      const P = Math.max(0, +$('coPages').value || 0), O = n.outputPages;
      const rows = dr.rows.map(r => {
        const I = r.intended;
        const need = I ? Math.max(0, I / 100 * (O + P) - r.out) : 0;
        const supply = sum(POOL.filter(it => D.inScope(i, it) && D.under(it.category, r.c.id)));
        return Object.assign({}, r, { need, supply });
      });
      const N = rows.reduce((a, r) => a + r.need, 0), sumI = rows.reduce((a, r) => a + (r.intended || 0), 0);
      rows.forEach(r => {
        const raw = N >= P ? (N ? P * r.need / N : 0) : r.need + (sumI ? (P - N) * (r.intended || 0) / sumI : 0);
        r.alloc = Math.round(raw / 10) * 10;
        r.after = O + P ? (r.out + r.alloc) / (O + P) * 100 : 0;
        r.short = Math.max(0, r.alloc - r.supply);
      });
      const short = rows.filter(r => r.short);
      $('coTable').innerHTML = `<table class="sub-table ca-table in-table"><thead><tr><th>${i.scope ? `Within ${scopeName(i)}` : 'Category'}</th>
          <th class="num">Intended</th><th class="num">Output now</th><th class="num">New pages</th><th class="num">After</th><th class="num">Ready</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${r.c.name}</td>
          <td class="num">${r.intended == null ? '<span class="ca-amber">no share</span>' : r.intended === 0 ? '<span class="muted">excluded</span>' : Math.round(r.intended) + '%'}</td>
          <td class="num">${r.actual == null ? '—' : Math.round(r.actual) + '%'}</td>
          <td class="num"><b>${M.fmt(r.alloc)}</b></td>
          <td class="num">${Math.round(r.after)}% ${delta(r)}</td>
          <td class="num ${r.short ? 'in-short' : ''}">${M.fmt(r.supply)}</td></tr>`).join('')}</tbody></table>
        ${dr.unalloc > .5 ? `<p class="fine ca-amber">${Math.round(dr.unalloc)}% of the mix is unallocated — nothing is drawn for it.</p>` : ''}
        ${short.length ? `<div class="in-diff"><b>Short:</b> ${short.map(r => `${r.c.name} needs ${M.fmt(r.alloc)} pp, ${M.fmt(r.supply)} are ready`).join(' · ')}.
          The draft stays short there and says so; it does not move those pages elsewhere.</div>` : ''}
        <p class="fine">Each category gets what it lacks against its share of the output plus these pages${N > P ? ', cut in proportion because the gaps add up to more' : ''}.
          The draft is not saved, and the list counts towards whatever it matches — not towards this intention by being generated from it.</p>`;
      const alloc = rows.map(r => `${r.c.id}:${r.alloc}`).join(',');
      $('coGo').href = `lists.html?new&generate&shape=${i.id}&pages=${P}&alloc=${alloc}`;
      $('coGo').classList.toggle('disabled', !P);
    }
    const delta = (r) => { const d = r.intended == null ? null : Math.round(r.after - r.intended);
      return d == null || Math.abs(d) <= BAND ? '' : `<span class="ca-d ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</span>`; };
    $('coPages').oninput = plan; plan();
  }

  const saved = (b, s) => `<div class="status-note status-note-green pj-saved"><span>&#9660;</span><div><b>${b}</b> <span>${s}</span></div></div>`;

  /* -------------------------------------------------------------- shell */
  U.mount({ tier, active: 'intentions', role, title: 'Intentions', body: '<div id="in"></div>' });
  const body = () => document.getElementById('in');
  function retitle(sub, actions) {
    const bar = document.querySelector('.topbar');
    let p = bar.querySelector('.titles p');
    if (!p) { p = document.createElement('p'); bar.querySelector('.titles').appendChild(p); }
    p.innerHTML = sub;
    bar.querySelector('.topbar-actions').innerHTML = actions;
  }
  function go(id, note) {
    if (id) q.set('i', id); else q.delete('i');
    history.replaceState(null, '', 'intentions.html' + (q.toString() ? '?' + q.toString().replace(/=(?=&|$)/g, '') : ''));
    draw(note);
    focus();
  }
  function focus() {
    const el = (q.get('i') && document.getElementById('int-' + q.get('i'))) || (q.get('t') && document.getElementById('tpl-' + q.get('t')));
    if (el) { el.classList.add('in-hit'); el.scrollIntoView({ block: 'center' }); }
  }
  const byId = (id) => D.intentions.find(i => i.id === id);
  document.querySelector('.main').addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('[data-new]')) return editIntention(null, 'new');
    const ed = t.closest('[data-edit]'); if (ed) return editIntention(byId(ed.dataset.edit), 'edit');
    const ar = t.closest('[data-archive]'); if (ar) return archive(byId(ar.dataset.archive));
    const un = t.closest('[data-unarchive]');
    if (un) { const i = byId(un.dataset.unarchive); delete i.archived; return go(i.id, saved(`Unarchived ${i.name}.`, 'Back on the page.')); }
    const tb = t.closest('.in-tabs [data-col]');
    if (tb) { e.preventDefault(); q.delete('i'); q.set('col', tb.dataset.col); return go(null); }
    const co = t.closest('[data-correct]'); if (co) return correct(byId(co.dataset.correct));
    const tp = t.closest('[data-tpl]');
    if (tp) return editTemplate(tp.dataset.tpl === 'new' ? null : D.intentionTemplates.find(x => x.id === tp.dataset.tpl));
  });

  draw();
  focus();
};
