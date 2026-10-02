/* Categories — /categories   (page-composition §4, intentions §1)
   The subject tree, doing two jobs: classification at the leaves, custody at
   any node and inherited downward (concepts.md). The tree stays on the left
   while you work on one node on the right:
     tree + detail   /categories/:id        (?c=ID; no c = All categories)
     refine a leaf   /categories/:id/refine (?c=ID&refine=1) — a wizard, in the pane
   The percentage editor, custody grants, create and edit are modals.

   What each tree row carries is PICKABLE (Show): share of parent, of the
   whole, intended vs actual, documents, pages, ready. The pick is per viewer.
   The ⚠ on a parent whose sibling set does not reach 100 shows whatever is
   picked — switching away from shares must not hide an unallocated set.

   "All categories" is a VIRTUAL root, not a row in the data. The top level is
   a forest (relationships §2: parent is empty on the top level only), so the
   top-level sibling set had no parent to be edited on, the whole tree had
   nowhere to be totalled, and creating a top-level category was a second
   action. The root has no share (always 100%), no documents (leaves only,
   intentions §1.2) and no custody: custody over everything is the `any`
   scope, a role granted in Users & Groups — not a second way to grant it. */

window.PAGE_CATEGORIES = function (tier) {
  const M = VERA, D = VERA_DATA, U = VERA_UI;
  const role = U.currentRole('curator');
  const held = U.permsOf(role);
  const ROOT = 'all';

  /* per-viewer conveniences only — the page is right without them */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private window */ } }
  };
  /* ?i= picks the INTENTION whose mix is read (intentions §2.4, replacing
     ?d=); no i means Overall. A tracker shows its owner's mix, and the
     percentages are edited only on the owner */
  const OVERALL = D.intentions.find(i => i.overall);
  let intId = new URLSearchParams(location.search).get('i');
  if (!D.intentions.some(i => i.id === intId)) intId = OVERALL.id;
  const I = () => D.intentions.find(i => i.id === intId);
  const O = () => D.mixOwner(I());
  const curDist = () => O().distribution;
  const dist = () => D.distributions.find(d => d.id === curDist());
  const mixOf = (o) => o.overall ? 'the house mix' : `${o.name}'s mix`;
  const distLabel = (d) => { const o = D.intentions.find(i => i.id === d.owner); return o ? mixOf(o) : d.name; };
  /* a scoped intention reads only its subtree; the rest is dimmed and its
     shares are neither shown nor editable */
  const outOfScope = (id) => !!I().scope && (isRoot(id) || !inSubtree(id, I().scope));
  /* the scope node itself is 100% of the scope; its share of its parent is outside */
  const isScope = (id) => I().scope === id;

  const SHOWS = [
    ['share', 'Share of parent'], ['whole', 'Of the whole'], ['mix', 'Intended vs actual'],
    ['docs', 'Documents'], ['pages', 'Pages'], ['ready', 'Ready']
  ];
  let show = store.get('vera.catShow');
  if (!SHOWS.some(s => s[0] === show)) show = 'share';
  const byDist = () => ['share', 'whole', 'mix'].includes(show);

  /* direct custody for people — category_members (relationships §2); groups
     carry theirs on the group record */
  D.categoryMembers = D.categoryMembers || {};

  /* ------------------------------------------------------------ records */
  const isRoot = (id) => id === ROOT;
  const nameOf = (id) => isRoot(id) ? 'All categories' : D.cat(id).name;
  const kids = (id) => isRoot(id) ? D.categories.filter(c => !c.parent) : D.childrenOf(id);
  const parentOf = (id) => isRoot(id) ? null : (D.cat(id).parent || ROOT);
  const ancestors = (id) => { const out = []; let p = parentOf(id); while (p) { out.unshift(p); p = parentOf(p); } return out; };
  const inSubtree = (catId, top) => isRoot(top) || (function up(c) {
    return !!c && (c.id === top || up(c.parent ? D.cat(c.parent) : null)); })(D.cat(catId));
  const isLeaf = (id) => !isRoot(id) && D.isLeaf(id);
  const levelOf = (id) => ancestors(id).length;

  const pagesOf = (it) => { const p = D.effectivePages(D.doc(it.doc)); return p ? p.value : 0; };
  const sum = (its) => its.reduce((a, it) => a + pagesOf(it), 0);
  const itsIn = (id) => D.iterations.filter(it => it.category && inSubtree(it.category, id));
  const delivered = (its) => its.filter(it => M.atLeast(it.progress, 'Digitized'));
  const ready = (its) => its.filter(it => it.progress === 'Ready' && !it.list && M.passesGates(it));
  const pct = (a, b) => b ? a / b * 100 : 0;

  const share = (id) => isRoot(id) ? 100 : dist().shares[id];
  /* of the whole — or, for a scoped intention, of its scope */
  const whole = (id) => isRoot(id) ? 100 : I().scope ? D.shareWithin(Object.assign({}, I(), { distribution: curDist() }), id)
    : D.effectiveShare(curDist(), id);
  /* intended vs actual compares with the picked intention's output, in its
     scope and window (§2.4) */
  const outputIts = () => D.intentionCount(I()).output;
  /* null while it has no output — nothing to compare yet */
  const actual = (id) => sum(outputIts()) ? pct(sum(outputIts().filter(it => inSubtree(it.category, id))), sum(outputIts())) : null;
  const unalloc = (id, dId) => {
    const d = D.distributions.find(x => x.id === (dId || curDist())), k = kids(id);
    return k.length ? 100 - k.reduce((a, c) => a + (d.shares[c.id] || 0), 0) : 0;
  };
  const noShare = (id, dId) => {
    const d = D.distributions.find(x => x.id === (dId || curDist()));
    return kids(id).filter(c => d.shares[c.id] == null);
  };
  const usedBy = (dId) => D.intentions.filter(i => i.distribution === dId);

  const f1 = (v) => (Math.round(v * 10) / 10).toString() + '%';
  const fPct = (v) => v == null ? '—' : f1(v);
  const BAND = 5;                   /* ±points that still read as "on the mix" — the same band Intentions uses */
  const delta = (i, a) => {
    if (i == null) return '';
    const d = Math.round(a - i);
    return Math.abs(d) <= BAND ? '' : `<span class="ca-d ${d > 0 ? 'up' : 'down'}"
      title="${Math.abs(d)} points ${d > 0 ? 'over' : 'under'} the mix">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</span>`;
  };

  /* ------------------------------------------------------------- custody */
  /* custody:  admin  — any node, the whole tree (the `any` scope)
               curator — Jana holds Periodicals through Periodicals Curators,
                         so her category.* reaches that subtree and no further */
  const CUSTODY = role === 'curator' ? ['c2'] : null;
  const inCustody = (id) => !isRoot(id) && (!CUSTODY || CUSTODY.some(top => inSubtree(id, top)));
  const atAny = !CUSTODY;
  const canEdit = (id) => held.has('category.edit') && (isRoot(id) ? atAny : inCustody(id));
  const canGrant = (id) => held.has('category.grant_custody') && inCustody(id);
  /* the mix belongs to an intention: editing it is intention.edit on its
     owner, and Overall's needs intention.edit_overall (decided 2026-10-01) */
  const canShares = () => I() === O() && (O().overall ? held.has('intention.edit_overall') : held.has('intention.edit'));

  const groupsOn = (id) => D.groups.filter(g => (g.categories || []).includes(id));
  const peopleOn = (id) => (D.categoryMembers[id] || []).map(D.byId);
  const holders = (id) => groupsOn(id).length + peopleOn(id).length;
  /* who custody reaches here, and from where — provenance, not just names */
  function reach(id) {
    const out = new Map();
    [...ancestors(id).filter(a => !isRoot(a)), id].forEach(n => {
      const at = n === id ? 'here' : `on ${nameOf(n)}`;
      peopleOn(n).forEach(u => out.has(u.id) || out.set(u.id, { u, via: `direct, ${at}` }));
      groupsOn(n).forEach(g => D.users.filter(u => u.groups.includes(g.id)).forEach(u =>
        out.has(u.id) || out.set(u.id, { u, via: `${g.name}, ${at}` })));
    });
    return [...out.values()];
  }
  /* the highest categories nobody holds, above or below — nobody's validation
     queue. A branch held somewhere below is reported at the gaps, not whole. */
  const covered = (id) => [id, ...ancestors(id)].some(n => !isRoot(n) && holders(n));
  const heldBelow = (id) => D.categories.some(x => inSubtree(x.id, id) && holders(x.id));
  const unheld = () => D.categories.filter(c => !covered(c.id) && !heldBelow(c.id) &&
    (!c.parent || heldBelow(c.parent)));

  /* --------------------------------------------------------------- tree */
  const collapsed = new Set();
  let query = '';
  let sel = ROOT;

  function value(id) {
    const its = () => itsIn(id);
    switch (show) {
      case 'share': {
        const s = share(id);
        return s == null ? '<span class="ca-amber">no share</span>'
          : s === 0 ? '<span class="muted">0%</span>' : s + '%';
      }
      case 'whole': { const w = whole(id); return w == null ? '<span class="ca-amber">—</span>' : f1(w); }
      case 'mix': {
        if (isRoot(id)) return '<span class="muted">intended → actual</span>';
        const i = whole(id), a = actual(id);
        return `${i == null ? '—' : Math.round(i) + '%'} → ${a == null ? '—' : Math.round(a) + '%' + delta(i, a)}`;
      }
      case 'docs': return its().length;
      case 'pages': return M.fmt(sum(its()));
      case 'ready': { const r = sum(ready(its())); return r ? M.fmt(r) + ' pp' : '<span class="muted">—</span>'; }
    }
  }

  const matches = (id) => !query || nameOf(id).toLowerCase().includes(query);
  const visible = (id) => !query || matches(id) || D.categories.some(c => inSubtree(c.id, id) && c.id !== id && matches(c.id));

  function row(id, depth) {
    const k = kids(id), open = query || !collapsed.has(id);
    const u = unalloc(id);
    const dim = outOfScope(id) && byDist();
    if (isScope(id) && byDist()) { /* drawn below with its own label */ }
    const warn = !dim && k.length && u > 0 ? `<span class="ca-warn" title="${u}% of its share is unallocated in ${mixOf(O())}">⚠</span>` : '';
    const me = `<div class="lrow ca-row ${id === sel ? 'selected' : ''} ${isRoot(id) ? 'ca-root' : ''} ${dim ? 'ca-dim' : ''}"
        data-key="${id}" role="button" tabindex="0" style="--d:${depth}">
        ${k.length ? `<button class="ca-tog" data-tog="${id}" aria-label="${open ? 'Collapse' : 'Expand'}">${open ? '▾' : '▸'}</button>`
                   : '<span class="ca-tog"></span>'}
        <span class="ca-name ${k.length ? 'ca-branch' : ''}">${nameOf(id)}</span>${warn}
        <span class="ca-val">${dim ? '' : isScope(id) && byDist() ? '<span class="muted">the scope · 100%</span>' : value(id)}</span>
      </div>`;
    return me + (open ? k.filter(c => visible(c.id)).map(c => row(c.id, depth + 1)).join('') : '');
  }

  function drawTree() {
    const t = document.getElementById('caRows');
    t.innerHTML = visible(ROOT) || query ? row(ROOT, 0) : '';
    if (query && !D.categories.some(c => matches(c.id)))
      t.innerHTML += '<div class="pane-empty ca-none">No category is called that.</div>';
    document.getElementById('caInt').disabled = !byDist();
  }

  /* --------------------------------------------------------------- pane */
  const pathHTML = (id) => [...ancestors(id), id].map(a => a === id ? nameOf(a)
    : `<a href="?c=${a}" data-go="${a}">${nameOf(a)}</a>`).join(' <span style="opacity:.5">&rsaquo;</span> ');

  function numbers(id) {
    const its = itsIn(id), s = share(id), w = whole(id);
    const list = [];
    if (!isRoot(id) && !outOfScope(id) && !isScope(id)) {
      list.push({ label: 'Share of parent', value: s == null ? '—' : s + '%',
                  foot: s == null ? `no share in ${mixOf(O())}` : `of ${nameOf(parentOf(id))} · ${mixOf(O())}` });
      list.push({ label: I().scope ? `Of ${D.cat(I().scope).name}` : 'Of the whole', value: fPct(w),
                  foot: actual(id) == null ? `${I().name} has no output yet` : `actual ${f1(actual(id))} of ${I().name}'s output` });
    }
    list.push({ label: 'Documents', value: its.length, foot: `${M.fmt(sum(its))} pages` });
    list.push({ label: 'Delivered', value: M.fmt(sum(delivered(its))) + ' pp',
                foot: `${Math.round(pct(sum(delivered(its)), sum(its)))}% of its pages` });
    list.push({ label: 'Ready', value: M.fmt(sum(ready(its))) + ' pp', foot: 'approved, on no list' });
    return U.stats(list);
  }

  /* one sibling set, with the mix — the root's top level and every branch */
  function setCard(id) {
    const k = kids(id), u = unalloc(id), none = noShare(id);
    const rows = k.map(c => {
      const s = dist().shares[c.id], w = whole(c.id), a = actual(c.id);
      const act = a == null ? '<span class="muted">—</span>' : `${f1(a)} ${delta(w, a)}`;
      return `<tr data-go="${c.id}" class="ca-link">
        <td>${c.name}</td>
        <td class="num">${s == null ? '<span class="ca-amber">no share</span>' : s === 0 ? '<span class="muted">0% — excluded</span>' : s + '%'}</td>
        <td class="num">${fPct(w)}</td>
        <td class="num">${act}</td>
        <td class="num">${itsIn(c.id).length}</td></tr>`;
    }).join('');
    const note = u > 0 ? `<div class="status-note status-note-amber ca-note"><span>&#9660;</span><div>
        <b>${u}% unallocated</b> <span>${none.length ? `· ${none.map(c => c.name).join(', ')} ${none.length === 1 ? 'has' : 'have'} no share. ` : '· '}
        Generation allocates only what is allocated and reports the rest — it does not scale the others up.</span></div></div>` : '';
    return U.pcard(isRoot(id) ? `Top level — ${mixOf(O())}` : `Children — ${mixOf(O())}`,
      `<table class="sub-table ca-table"><thead><tr><th>Category</th><th class="num">Share${isRoot(id) ? '' : ' of ' + nameOf(id)}</th>
        <th class="num">Of the whole</th><th class="num">Actual</th><th class="num">Docs</th></tr></thead>
        <tbody>${rows}</tbody></table>${note}
        <p class="fine"><i>Actual</i> is its share of ${I().name}'s output, beside what the mix says it
          should be.${D.trackersOf(O()).length ? ` ${D.trackersOf(O()).length} other intention${D.trackersOf(O()).length === 1 ? ' tracks' : 's track'} this mix.` : ''}</p>`,
      canShares() && !outOfScope(id) ? `<button class="btn btn-sm" data-shares="${id}">Edit proportions…</button>` : '');
  }

  function custodyCard(id) {
    if (isRoot(id)) return U.pcard('Custody',
      `<p class="fine" style="margin-top:0">Custody over the whole tree is the <code>any</code> scope, a
        role granted in <b>Users &amp; Groups</b>, not a grant here. Custody is granted on a category and
        reaches everything under it.</p>`,
      held.has('access.manage') ? '<a class="btn btn-sm" href="access.html">Users &amp; Groups</a>' : '');
    const direct = [...groupsOn(id).map(g => `<div class="v">${g.name} <span class="muted">· group</span></div>`),
                    ...peopleOn(id).map(u => `<div class="v">${u.name}</div>`)];
    const r = reach(id);
    return U.pcard('Custody',
      `<div class="kv2">
        <div><div class="k">Granted here</div>${direct.join('') || '<div class="v muted">nothing</div>'}</div>
        <div><div class="k">Who it reaches</div>${r.length ? r.map(x =>
          `<div class="v">${x.u.name} <span class="muted">· ${x.via}</span></div>`).join('')
          : '<div class="v ca-amber">nobody — nobody’s validation queue holds it</div>'}</div>
      </div>
      <p class="fine">Custody inherits <b>downward</b>: granting it here also grants every category under
        ${nameOf(id)}.</p>`,
      canGrant(id) ? `<button class="btn btn-sm" data-custody="${id}">Grant custody…</button>` : '');
  }

  function docsCard(id) {
    const its = itsIn(id);
    if (!its.length) return U.pcard('Documents here',
      `<p class="fine" style="margin-top:0">None. It is a leaf, so it can classify documents; nothing has
        been approved into it yet.</p>`);
    return U.pcard(`Documents here — ${its.length}`,
      its.slice(0, 8).map(it => `<div class="row-kv"><span>${D.doc(it.doc).title}</span>
        <span>${U.statusBadge(it, 'badge-xs')}</span></div>`).join('') +
      (its.length > 8 ? `<p class="fine">and ${its.length - 8} more.</p>` : '') +
      (canEdit(id) ? `<p class="fine">Documents sit on leaves only, so a category under ${nameOf(id)} means
        moving these ${its.length} into it — that is <b>Refine</b>.</p>` : ''),
      `<a class="btn btn-sm" href="documents.html?category=${id}">Open in Documents</a>`);
  }

  function attention() {
    const out = [];
    D.distributions.filter(d => d.owner).forEach(d => [ROOT, ...D.categories.map(c => c.id)].forEach(id => {
      const u = unalloc(id, d.id), none = noShare(id, d.id);
      if (kids(id).length && u > 0) out.push(`<div class="row-kv ca-link" data-go="${id}" data-int="${d.owner}">
        <span><b>${nameOf(id)}</b> <span class="muted">· ${distLabel(d)}</span></span>
        <span class="ca-amber">${u}% unallocated${none.length ? ` · ${none.map(c => c.name).join(', ')} no share` : ''}</span></div>`);
    }));
    unheld().forEach(c => out.push(`<div class="row-kv ca-link" data-go="${c.id}">
      <span><b>${c.name}</b> <span class="muted">· custody</span></span>
      <span class="ca-amber">nobody holds it</span></div>`));
    return U.pcard('Needs attention', out.join('') ||
      '<p class="fine" style="margin-top:0">Nothing. Every set adds up to 100 and every branch has somebody.</p>');
  }

  const FOOTER = `<b>Shares are recursive.</b> <i>Share of parent</i> is what is stored; <i>of the whole</i>
    is <code>share × effective(parent)</code>, worked out on read. <b>Percentages, not weights</b>: a curator who set
    Regional to 30% expects it to be 30% tomorrow. <b>No share</b> is unallocated and flagged; <b>0%</b> is a
    deliberate exclusion. Documents sit on <b>leaves only</b>; custody attaches anywhere and inherits down.
    <br><b>All categories</b> is not a category: it is how the top level is edited, totalled and added to.
    <br>Not here: documents — this page links into <i>Documents</i> filtered, it is not a second browser.`;

  function render(id, note) {
    const pane = document.getElementById('caPane');
    const leaf = isLeaf(id), n = kids(id).length, its = itsIn(id);
    const acts = [];
    if (!isRoot(id) && !leaf) acts.push(`<a class="btn btn-sm" href="documents.html?category=${id}">Open in Documents</a>`);
    if (!isRoot(id) && canEdit(id)) acts.push('<button class="btn btn-sm" data-edit>Edit…</button>');
    if (canEdit(id)) acts.push(leaf && its.length
      ? '<button class="btn btn-sm" data-refine>Refine…</button>'
      : `<button class="btn btn-sm" data-child>+ ${isRoot(id) ? 'Top-level category' : 'Child category'}</button>`);
    if (leaf && !its.length && canEdit(id)) acts.push('<button class="btn btn-sm btn-danger" data-del>Delete</button>');
    const sub = isRoot(id) ? `${D.categories.length} categories · ${D.categories.filter(c => D.isLeaf(c.id)).length} leaves · not a category itself`
      : leaf ? `Level ${levelOf(id)} · leaf — classifies documents`
      : `Level ${levelOf(id)} · splits its share among ${n} ${n === 1 ? 'child' : 'children'}`;
    pane.innerHTML = (note || '') +
      U.paneHead(nameOf(id), sub, acts.join(''), isRoot(id) ? '' : pathHTML(id)) + mixLine(id) +
      numbers(id) +
      (isRoot(id) ? (outOfScope(id) ? '' : setCard(id)) + attention() + custodyCard(id)
        : leaf ? docsCard(id) + custodyCard(id)
        : outOfScope(id) ? custodyCard(id)
        : setCard(id) + custodyCard(id)) +
      `<div class="budget">${FOOTER}</div>`;
    pane.scrollTop = 0;
    const back = pane.querySelector('.pane-back');
    if (back) back.onclick = () => pane.classList.remove('open');
  }

  /* §2.3 — a tracker opened here shows its owner's mix, says so, and offers
     to edit the owner's or detach; a scoped one says what it does not use */
  function mixLine(id) {
    const i = I(), o = O(), n = D.trackersOf(o).length;
    const lines = [];
    if (i !== o) lines.push(`<div class="status-note status-note-blue ca-note"><span>&#9660;</span><div>
      <b>${i.name} tracks ${o.name}.</b> <span>Editing changes ${o.name}${n > 1 ? ` and ${n - 1} more` : ''}.</span>
      <div class="ca-mixacts">${(o.overall ? held.has('intention.edit_overall') : held.has('intention.edit'))
          ? `<a class="btn btn-sm" href="categories.html?i=${o.id}${isRoot(id) ? '' : '&c=' + id}">Edit ${o.name}'s mix</a>` : ''}
        ${held.has('intention.edit') ? `<button class="btn btn-sm" data-detach>Detach ${i.name}</button>` : ''}</div></div></div>`);
    if (outOfScope(id) && byDist()) lines.push(`<div class="status-note status-note-slate ca-note"><span>&#9660;</span><div>
      <b>Outside ${i.name}'s scope.</b> <span>It reads only ${M.catPath(D.pathOf(i.scope))}; shares here are not used by it.</span></div></div>`);
    return lines.join('');
  }

  function select(id, opts) {
    opts = opts || {};
    sel = id;
    /* the selection is its own address — reload or share it and it opens here */
    const iq = intId === OVERALL.id ? '' : `i=${intId}`;
    const url = 'categories.html' + ([iq, isRoot(id) ? '' : `c=${id}`].filter(Boolean).join('&').replace(/^/, '?')).replace(/^\?$/, '');
    if (!opts.nohist) history[opts.replace ? 'replaceState' : 'pushState'](null, '', url);
    ancestors(id).forEach(a => collapsed.delete(a));
    drawTree();
    render(id, opts.note);
    if (tier === 'phone' && !opts.quiet) document.getElementById('caPane').classList.add('open');
  }
  const saved = (b, t) => `<div class="status-note status-note-green pj-saved"><span>&#9660;</span><div><b>${b}</b> <span>${t}</span></div></div>`;

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
    document.getElementById('app').appendChild(host);
    return host;
  }
  const FOOT = (ok) => `<button class="btn foot-left" data-x>Cancel</button><button class="btn btn-primary" data-ok>${ok}</button>`;

  /* the percentage editor — one sibling set, written whole, under a lock */
  function editShares(id) {
    const d = dist(), k = kids(id), users = usedBy(d.id);
    const host = modal(`Proportions — ${isRoot(id) ? 'top level' : nameOf(id)}`,
      `<p class="fine" style="margin-top:0">${mixOf(O())} ·
        ${isRoot(id) ? 'the top level splits 100% of the whole' : `each child's share of ${nameOf(id)}, which is ${fPct(whole(id))} of the whole`}</p>
      <table class="sub-table"><tbody>${k.map(c => {
        const v = d.shares[c.id];
        return `<tr><td>${c.name}</td>
          <td style="width:7rem"><input type="number" min="0" max="100" class="ca-pct" data-id="${c.id}"
            value="${v == null ? '' : v}" placeholder="—"> %</td>
          <td class="muted ca-eff" data-eff="${c.id}"></td></tr>`;
      }).join('')}</tbody></table>
      <div id="caSum" class="ca-sum"></div>
      <p class="fine">The set is saved whole: changing one share is deciding where the difference comes
        from. Empty means <b>no share</b> — allowed, and flagged. <b>0</b> means deliberately excluded.</p>
      ${users.length > 1 ? `<p class="fine"><b>${users.length - 1} other intention${users.length === 2 ? ' tracks' : 's track'} this mix.</b>
        Saving asks which of them change with it.</p>` : ''}`,
      FOOT('Save the set'));
    const ins = [...host.querySelectorAll('.ca-pct')], ok = host.querySelector('[data-ok]');
    const base = isRoot(id) ? 100 : (whole(id) || 0);
    function draw() {
      const s = ins.reduce((a, i) => a + (i.value === '' ? 0 : +i.value), 0);
      ins.forEach(i => { host.querySelector(`[data-eff="${i.dataset.id}"]`).textContent =
        i.value === '' ? 'no share' : `${f1(base * i.value / 100)} of the whole`; });
      const line = host.querySelector('#caSum');
      const bad = ins.some(i => i.value !== '' && (+i.value < 0 || +i.value > 100));
      line.innerHTML = bad ? '<b class="ca-red">Each share is between 0 and 100.</b>'
        : s > 100 ? `<b class="ca-red">${s}% — over by ${s - 100}.</b> A set cannot pass 100.`
        : s < 100 ? `<b class="ca-amber">${s}% — ${100 - s} unallocated.</b> Allowed: generation allocates ${s}% and reports the rest.`
        : '<b class="ca-green">100% — complete.</b>';
      ok.disabled = bad || s > 100;
    }
    ins.forEach(i => i.oninput = draw); draw();
    ok.onclick = () => {
      const next = Object.assign({}, d.shares);
      ins.forEach(i => { if (i.value === '') delete next[i.dataset.id]; else next[i.dataset.id] = +i.value; });
      const commit = (kept) => {
        d.shares = next; redrawPicker();
        select(id, { replace: true, quiet: true, note: saved('Saved.', `${mixOf(O())}, ${isRoot(id) ? 'top level' : nameOf(id)}${
          unalloc(id) > 0 ? ` — ${unalloc(id)}% left unallocated, and flagged` : ' — complete'}.${kept || ''}`) });
      };
      host.remove();
      const tr = D.trackersOf(O());
      tr.length ? confirmTrackers(O(), tr, d, commit) : commit();
    };
  }

  /* §2.3 — saving a mix others track lists every one of them, ticked.
     Unticked ones keep the mix as it was, together: the one that has
     tracked longest owns that copy and the rest track it */
  function confirmTrackers(o, tr, d, commit) {
    const st = (i) => { const s = Date.parse(i.starts), t = Date.parse(D.today);
      return i.archived ? 'archived' : s > t ? 'upcoming' : i.ends && Date.parse(i.ends) + 864e5 <= t ? 'ended' : 'running'; };
    const order = tr.slice().sort((a, b) => Date.parse(a.starts) - Date.parse(b.starts));
    const host = modal(`Change the mix of ${o.name}?`, `
      <p style="margin-top:0">These intentions track it and change with it:</p>
      <div class="lines">${order.map(i => `<label class="line"><input type="checkbox" data-tr="${i.id}" checked>
        <span class="line-id"><b>${i.name}</b> <span class="muted">· ${i.target ? 'target' : 'tracking'} · ${st(i)}</span></span></label>`).join('')}</div>
      <p class="fine" id="caKeep"></p>
      <p class="fine">A window that is closed counts against the mix as it was, so ticking never rewrites a closed result.</p>`,
      `<button class="btn foot-left" data-x>Cancel</button><button class="btn btn-primary" data-ok></button>`);
    const boxes = [...host.querySelectorAll('[data-tr]')], ok = host.querySelector('[data-ok]');
    const draw = () => {
      const off = order.filter(i => !boxes.find(b => b.dataset.tr === i.id).checked);
      const on = order.length - off.length;
      host.querySelector('#caKeep').innerHTML = !off.length ? 'Every one of them changes with it.'
        : off.length === 1 ? `Unticked, <b>${off[0].name}</b> keeps the mix as it was, as its own.`
        : `Unticked ones keep the mix as it was. <b>${off[0].name}</b> has tracked longest, so it owns that mix; ${
            off.slice(1).map(i => i.name).join(', ')} ${off.length === 2 ? 'tracks' : 'track'} ${off[0].name}.`;
      ok.textContent = on ? `Save for ${o.name} and ${on} more` : `Save for ${o.name} only`;
    };
    host.onchange = draw; draw();
    ok.onclick = () => {
      const off = order.filter(i => !boxes.find(b => b.dataset.tr === i.id).checked);
      if (off.length) {
        const nd = { id: 'd' + (D.distributions.length + 1), name: `${off[0].name}'s mix`, isOverall: false,
          owner: off[0].id, shares: Object.assign({}, d.shares) };
        D.distributions.push(nd);
        off.forEach(i => { i.distribution = nd.id; });
      }
      host.remove();
      commit(off.length ? ` ${off.length === 1 ? off[0].name + ' keeps' : off.length + ' keep'} the old mix.` : '');
    };
  }

  /* §2.2 — detach: the tracker gets a copy of the mix as it is now */
  function detach() {
    const i = I(), o = O();
    const host = modal(`Detach ${i.name}?`, `<p style="margin-top:0">It gets its own copy of ${mixOf(o)}, as it is now, and stops
        changing with ${o.name}. Nothing changes for anyone else.</p>`, FOOT('Detach'));
    host.querySelector('[data-ok]').onclick = () => {
      const nd = { id: 'd' + (D.distributions.length + 1), name: `${i.name}'s mix`, isOverall: false, owner: i.id,
        shares: Object.assign({}, dist().shares) };
      D.distributions.push(nd); i.distribution = nd.id;
      host.remove(); redrawPicker();
      select(sel, { replace: true, quiet: true, note: saved(`${i.name} has its own mix.`, 'Edit its proportions here; nobody else changes with it.') });
    };
  }

  function grantCustody(id) {
    const S = { groups: groupsOn(id).map(g => g.id), people: (D.categoryMembers[id] || []).slice() };
    const host = modal(`Custody — ${nameOf(id)}`, '<div id="caCus"></div>', FOOT('Save custody'));
    const box = host.querySelector('#caCus');
    const leaves = D.categories.filter(c => D.isLeaf(c.id) && inSubtree(c.id, id)).length;
    function draw() {
      const freeG = D.groups.filter(g => !S.groups.includes(g.id));
      const freeU = D.users.filter(u => u.kind === 'person' && !S.people.includes(u.id));
      box.innerHTML = `
        <div class="fld" style="margin-top:0">Groups <span class="muted">— everyone in it, while they are in it</span></div>
        ${S.groups.map(g => `<div class="row-kv"><span>${D.groups.find(x => x.id === g).name}</span>
          <button class="btn btn-sm" data-rmg="${g}">Remove</button></div>`).join('') || '<p class="fine" style="margin-top:.25rem">No group.</p>'}
        ${freeG.length ? `<select class="addfilter pj-add" data-addg><option value="">+ Add a group…</option>${
          freeG.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}</select>` : ''}
        <div class="fld">People</div>
        ${S.people.map(u => `<div class="row-kv"><span>${D.byId(u).name}</span>
          <button class="btn btn-sm" data-rmu="${u}">Remove</button></div>`).join('') || '<p class="fine" style="margin-top:.25rem">Nobody directly.</p>'}
        ${freeU.length ? `<select class="addfilter pj-add" data-addu><option value="">+ Add a person…</option>${
          freeU.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}</select>` : ''}
        <p class="fine">This reaches ${nameOf(id)} and everything under it — ${leaves} ${leaves === 1 ? 'leaf' : 'leaves'}.
          It makes them responsible; what they may <i>do</i> there is their role.${CUSTODY
          ? ` You can grant it only inside ${CUSTODY.map(nameOf).join(', ')}, which is yours.` : ''}</p>`;
    }
    draw();
    box.onclick = (e) => {
      const g = e.target.closest('[data-rmg]'), u = e.target.closest('[data-rmu]');
      if (g) { S.groups = S.groups.filter(x => x !== g.dataset.rmg); draw(); }
      if (u) { S.people = S.people.filter(x => x !== u.dataset.rmu); draw(); }
    };
    box.onchange = (e) => {
      if (!e.target.value) return;
      if (e.target.matches('[data-addg]')) S.groups.push(e.target.value);
      if (e.target.matches('[data-addu]')) S.people.push(e.target.value);
      draw();
    };
    host.querySelector('[data-ok]').onclick = () => {
      const before = holders(id);
      D.groups.forEach(g => {
        g.categories = g.categories || [];
        const on = S.groups.includes(g.id), was = g.categories.includes(id);
        if (on && !was) g.categories.push(id);
        if (!on && was) g.categories = g.categories.filter(x => x !== id);
      });
      D.categoryMembers[id] = S.people;
      host.remove();
      select(id, { replace: true, quiet: true, note: saved('Custody saved.',
        `${holders(id)} grant${holders(id) === 1 ? '' : 's'} on ${nameOf(id)} (was ${before}).`) });
    };
  }

  /* where a category may go: never under itself, never under a leaf that
     holds documents (they would stop being on a leaf), and inside custody */
  const placesFor = (id) => [ROOT, ...D.categories.map(c => c.id)].filter(p =>
    (id ? !inSubtree(p, id) || isRoot(p) : true) &&
    !(isLeaf(p) && itsIn(p).length) && (isRoot(p) ? atAny : inCustody(p)));

  function editCategory(id) {
    const c = D.cat(id), places = placesFor(id);
    const host = modal(`Edit — ${c.name}`,
      `<label class="fld" style="margin-top:0">Name<input class="search ca-in" id="caName" value="${c.name}"></label>
      <label class="fld">Under<select class="addfilter ca-in" id="caParent">${places.map(p =>
        `<option value="${p}" ${p === parentOf(id) ? 'selected' : ''}>${isRoot(p) ? 'All categories — top level'
          : D.pathOf(p).join(' › ')}</option>`).join('')}</select></label>
      <p class="fine" id="caMove">Moving it takes everything under it along. Leaves that hold documents
        cannot take children, so they are not offered.</p>
      <div class="pj-err" id="caErr"></div>`, FOOT('Save'));
    const $ = (x) => host.querySelector('#' + x);
    $('caParent').onchange = () => {
      const moved = $('caParent').value !== parentOf(id);
      $('caMove').innerHTML = moved ? `<b>It starts at 0% in its new place</b>, in every mix — it
        cannot take from shares somebody already set there. Where it was, its share becomes
        <b>unallocated</b> and is flagged.` : 'Moving it takes everything under it along.';
    };
    host.querySelector('[data-ok]').onclick = () => {
      const name = $('caName').value.trim(), to = $('caParent').value;
      if (!name) { $('caErr').textContent = 'A category needs a name.'; return; }
      if (kids(to).some(k => k.id !== id && k.name.toLowerCase() === name.toLowerCase())) {
        $('caErr').textContent = `${nameOf(to)} already has a ${name}.`; return; }
      const moved = to !== parentOf(id);
      c.name = name;
      if (moved) { c.parent = isRoot(to) ? null : to; D.distributions.forEach(d => { d.shares[id] = 0; }); }
      host.remove();
      select(id, { replace: true, quiet: true, note: saved('Saved.', moved
        ? `Now under ${nameOf(to)}, at 0% in every mix. Set its share there in Edit proportions.` : 'Renamed.') });
    };
  }

  let seq = 0;
  function newChild(id) {
    const leaf = isLeaf(id);
    const host = modal(isRoot(id) ? 'New top-level category' : `New category under ${nameOf(id)}`,
      `<label class="fld" style="margin-top:0">Name<input class="search ca-in" id="caName" placeholder="What it classifies"></label>
      <p class="fine">It starts at <b>0% in every mix</b> (${D.distributions.length}) — it cannot take
        from shares somebody already set. Give it a share in Edit proportions.${leaf
        ? ` ${nameOf(id)} holds no documents, so it simply stops being a leaf; nothing moves.` : ''}</p>
      <div class="pj-err" id="caErr"></div>`, FOOT('Create'));
    const $ = (x) => host.querySelector('#' + x);
    $('caName').focus();
    host.querySelector('[data-ok]').onclick = () => {
      const name = $('caName').value.trim();
      if (!name) { $('caErr').textContent = 'A category needs a name.'; return; }
      if (kids(id).some(k => k.name.toLowerCase() === name.toLowerCase())) {
        $('caErr').textContent = `${nameOf(id)} already has a ${name}.`; return; }
      const nc = { id: 'cn' + (++seq), name, parent: isRoot(id) ? null : id };
      D.categories.push(nc);
      D.distributions.forEach(d => { d.shares[nc.id] = 0; });
      host.remove();
      select(nc.id, { note: saved(`Created ${name}.`, `Under ${nameOf(id)}, at 0% everywhere — so ${nameOf(id)}'s set is not complete until you give it a share.`) });
    };
  }

  function del(id) {
    const c = D.cat(id), p = parentOf(id);
    const hit = D.distributions.filter(d => d.shares[id]);
    const host = modal(`Delete ${c.name}?`,
      `<p style="margin-top:0">It holds no documents, so nothing moves.</p>
      ${hit.length ? `<p class="fine">Its share becomes <b>unallocated</b> in ${nameOf(p)}'s set — nothing
        rebalances into the others:</p>${hit.map(d => `<div class="row-kv"><span>${distLabel(d)}</span>
        <span class="ca-amber">${d.shares[id]}% unallocated</span></div>`).join('')}`
        : '<p class="fine">It has no share anywhere, so no set changes.</p>'}
      ${holders(id) ? `<p class="fine">Custody granted on it (${holders(id)}) goes with it.</p>` : ''}`,
      `<button class="btn foot-left" data-x>Cancel</button><button class="btn btn-danger" data-ok>Delete</button>`);
    host.querySelector('[data-ok]').onclick = () => {
      D.categories.splice(D.categories.indexOf(c), 1);
      D.distributions.forEach(d => { delete d.shares[id]; });
      D.groups.forEach(g => { g.categories = (g.categories || []).filter(x => x !== id); });
      delete D.categoryMembers[id];
      host.remove();
      select(p, { note: saved(`Deleted ${c.name}.`, hit.length ? 'Its share is unallocated and flagged here.' : '') });
    };
  }

  /* refine — a wizard, because it moves data (page-composition §4) */
  function refine(id, step, name) {
    const pane = document.getElementById('caPane'), its = itsIn(id);
    history.replaceState(null, '', `categories.html?c=${id}&refine=1`);
    const head = U.paneHead(`Refine ${nameOf(id)}`, `Step ${step} of 2 · a leaf that holds documents gains a child`,
      '<button class="btn btn-sm" data-cancel>Cancel</button>', pathHTML(id));
    const withShare = D.distributions.filter(d => d.shares[id] != null);
    pane.innerHTML = head + (step === 1 ? U.pcard('Name the new category',
      `<label class="fld" style="margin-top:0">Name<input class="search ca-in" id="caName" value="${name || ''}"
        placeholder="e.g. ${nameOf(id)} — before 1918"></label>
      <p class="fine">Documents sit on leaves only (intentions §1.2), so ${nameOf(id)} cannot hold documents
        and a child at once. All ${its.length} of them move into the new category, and ${nameOf(id)} becomes a
        branch. Sort them into further categories afterwards.</p>
      <div class="pj-err" id="caErr"></div>
      <div class="ca-wiz"><button class="btn btn-primary" data-next>Next — see what moves</button></div>`)
      : U.pcard('What this moves',
      `<div class="row-kv"><span><b>${its.length}</b> documents · ${M.fmt(sum(its))} pages</span>
        <span>${nameOf(id)} → ${nameOf(id)} › <b>${name}</b></span></div>
      ${withShare.map(d => `<div class="row-kv"><span>${distLabel(d)}</span>
        <span>${name} gets <b>100%</b> of ${nameOf(id)}'s ${d.shares[id]}%</span></div>`).join('')}
      <p class="fine">The new category takes <b>all</b> of ${nameOf(id)}'s share in each mix, since it
        holds everything that was there. Left at 0%, the whole branch would drop out of generation.
        Custody on ${nameOf(id)} still reaches them: it inherits down.</p>
      <p class="fine">Their status does not change. Each one's history records the move.</p>
      <div class="ca-wiz"><button class="btn" data-backstep>Back</button>
        <button class="btn btn-primary" data-go-refine>Refine and move ${its.length} documents</button></div>`)) +
      `<div class="budget">${FOOTER}</div>`;
    const $ = (x) => pane.querySelector('#' + x);
    pane.querySelector('[data-cancel]').onclick = () => select(id, { replace: true, quiet: true });
    if (step === 1) {
      $('caName').focus();
      pane.querySelector('[data-next]').onclick = () => {
        const n = $('caName').value.trim();
        if (!n) { $('caErr').textContent = 'The new category needs a name.'; return; }
        refine(id, 2, n);
      };
    } else {
      pane.querySelector('[data-backstep]').onclick = () => refine(id, 1, name);
      pane.querySelector('[data-go-refine]').onclick = () => {
        const nc = { id: 'cn' + (++seq), name, parent: id };
        D.categories.push(nc);
        D.distributions.forEach(d => { d.shares[nc.id] = d.shares[id] != null ? 100 : 0; });
        its.forEach(it => { it.category = nc.id; });
        select(nc.id, { replace: true, quiet: true, note: saved(`Moved ${its.length} documents into ${name}.`,
          `${nameOf(id)} is now a branch, and ${name} holds its whole share.`) });
      };
    }
  }

  /* -------------------------------------------------------------- shell */
  /* the picker lists the owners, each with what tracks it, then the
     trackers, which show their owner's mix (§2.4) */
  const pickerHTML = () => { const os = D.intentions.filter(i => D.mixOwner(i) === i && !i.archived);
    const ts = D.intentions.filter(i => D.mixOwner(i) !== i && !i.archived);
    return `<optgroup label="Own a mix">${os.map(i => `<option value="${i.id}" ${i.id === intId ? 'selected' : ''}>${i.name}${
        i.overall ? ' · Overall' : ''} · ${D.trackersOf(i).length ? `tracked by ${D.trackersOf(i).length}` : 'own'}</option>`).join('')}</optgroup>
      <optgroup label="Track another">${ts.map(i => `<option value="${i.id}" ${i.id === intId ? 'selected' : ''}>${i.name} → ${D.mixOwner(i).name}</option>`).join('')}</optgroup>`; };
  const distSel = `<label class="ca-distl">Mix of <select class="addfilter" id="caInt">${pickerHTML()}</select></label>`;
  const redrawPicker = () => { document.getElementById('caInt').innerHTML = pickerHTML(); };

  U.mount({
    tier, active: 'categories', role,
    title: 'Categories',
    subtitle: `${D.categories.length} categories · ${D.categories.filter(c => D.isLeaf(c.id)).length} leaves`,
    actions: distSel,
    split: `<div class="listcol ca-tree">
        <div class="listcol-head ca-head">
          <input class="search ca-search" id="caQ" placeholder="Search categories…">
          <label class="ca-show">Show <select class="groupby" id="caShow">${SHOWS.map(([k, l]) =>
            `<option value="${k}" ${k === show ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
        <div id="caRows"></div>
      </div>
      <div class="pane" id="caPane"></div>`
  });

  const main = document.querySelector('.main');
  document.getElementById('caInt').onchange = (e) => {
    intId = e.target.value; select(sel, { replace: true, quiet: true });
  };
  document.getElementById('caShow').onchange = (e) => {
    show = e.target.value; store.set('vera.catShow', show); drawTree();
  };
  document.getElementById('caQ').oninput = (e) => { query = e.target.value.trim().toLowerCase(); drawTree(); };

  main.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tog]');
    if (t) { e.stopPropagation(); const id = t.dataset.tog;
      collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); return drawTree(); }
    const g = e.target.closest('[data-go]');
    if (g) { e.preventDefault();
      if (g.dataset.int && g.dataset.int !== intId) { intId = g.dataset.int; document.getElementById('caInt').value = intId; }
      return select(g.dataset.go); }
    const r = e.target.closest('.ca-row');
    if (r) return select(r.dataset.key);
    if (e.target.closest('[data-shares]')) return editShares(e.target.closest('[data-shares]').dataset.shares);
    if (e.target.closest('[data-detach]')) return detach();
    if (e.target.closest('[data-custody]')) return grantCustody(e.target.closest('[data-custody]').dataset.custody);
    if (e.target.closest('[data-edit]')) return editCategory(sel);
    if (e.target.closest('[data-child]')) return newChild(sel);
    if (e.target.closest('[data-del]')) return del(sel);
    if (e.target.closest('[data-refine]')) return refine(sel, 1);
  });
  main.addEventListener('keydown', (e) => {
    const r = e.target.closest('.ca-row');
    if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(r.dataset.key); }
  });

  const fromURL = () => {
    const q = new URLSearchParams(location.search), c = q.get('c');
    const id = c && D.cat(c) ? c : ROOT;
    select(id, { nohist: true, quiet: !c });
    if (q.get('refine') && isLeaf(id) && itsIn(id).length && canEdit(id)) refine(id, 1);
  };
  addEventListener('popstate', fromURL);
  fromURL();
};
