/* VERA demo — shell and render helpers.
   Navigation is navigation.md: 12 entries, rework.md's names and order, ONE
   flat list. Rail abbreviations are initials for multi-word entries and two
   letters for single-word ones.

   No group headers and no per-entry counts — a bare number beside a nav entry
   does not say what it counts. Counts live on Watchlists, where the panel
   names each one.                                                          */

window.VERA_UI = (function () {
  const M = window.VERA, DATA = window.VERA_DATA;

  /* ------------------------------------------------------------- entries */

  /* One flat list, pipeline order first (navigation §1). Documents is the
     one entry with two ways in: `perm` is ANY-OF, and the label follows the
     reach — *My Documents* with request.read_own alone (navigation §1.1). */
  const NAV = [
    { id: 'documents',  rail: 'Do', label: 'Documents', labelOwn: 'My Documents', short: 'Documents',
      file: 'documents.html', perm: ['request.read_own', 'iteration.read'] },
    { id: 'proposals',  rail: 'Pr', label: 'Proposals',                     file: 'proposals.html',     perm: 'request.decide' },
    { id: 'validation', rail: 'DV', label: 'Documents Validations', short: 'Validations', file: 'validation.html', perm: 'validation.approve' },
    { id: 'lists',      rail: 'DL', label: 'Digitization Lists', short: 'Lists', file: 'lists.html',     perm: 'list.read' },
    { id: 'projects',   rail: 'Pj', label: 'Projects',                      file: 'projects.html',      perm: ['project.read', 'project.decide'] },
    { id: 'categories', rail: 'Ca', label: 'Categories',                    file: 'categories.html',    perm: 'category.read' },
    { id: 'intentions', rail: 'In', label: 'Intentions',                    file: 'intentions.html',    perm: 'intention.read' },
    { id: 'tasks',      rail: 'Ta', label: 'Tasks', labelOwn: 'My Tasks', ownUnless: 'task.read',
      file: 'tasks.html', perm: ['task.read_own', 'task.read'] },
    { id: 'schedules',  rail: 'Sc', label: 'Schedules',                     file: 'schedules.html',     perm: 'task.read' },
    { id: 'access',     rail: 'UG', label: 'Users & Groups',                file: 'access.html',        perm: 'access.read' },
    { id: 'plugins',    rail: 'Pl', label: 'Plugins',                       file: 'plugins.html',       perm: 'plugin.read' },
    { id: 'hooks',      rail: 'Ho', label: 'Hooks',                         file: 'hooks.html',         perm: 'hook.read' }
  ];

  /* What each role may do — read from the roles table itself (vera-data,
     permissions §4), so an entry or action is ABSENT, never disabled, for
     exactly the grants the Users & Groups page shows. Scope is not modelled
     in the shell: holding a permission at any scope reveals the entry. */
  const ROLE_PERMS = Object.fromEntries(DATA.roles.map(r => [r.id, r.grants.map(g => g[0])]));
  const permsOf = (role) => new Set(ROLE_PERMS[role] || []);
  const holds = (held, n) => [].concat(n.perm).some(p => held.has(p));
  /* Where a page needs scope (projects.md §3: `managed`, `project`), the
     scopes a role holds a permission at. `any` covers every record. */
  const ROLE_GRANTS = Object.fromEntries(DATA.roles.map(r => [r.id, r.grants]));
  const scopesOf = (role, perm) => (ROLE_GRANTS[role] || []).filter(g => g[0] === perm).map(g => g[1]);
  /* the people who hold a permission at all — by hand or mapped by an
     Identity plugin. Who a message reaches is resolved through it. */
  const rolesOfUser = (u) => [...new Set([...(u.roles || []), ...(u.mapped || []).map(m => m.role)])];
  const holders = (perm) => DATA.users.filter(u => u.kind === 'person' &&
    rolesOfUser(u).some(r => (ROLE_PERMS[r] || []).includes(perm)));

  /* the entries a set of grants reveals, each labelled for its reach */
  const visibleNav = (held) => NAV.filter(n => holds(held, n)).map(n =>
    (n.labelOwn && !held.has(n.ownUnless || 'iteration.read'))
      ? Object.assign({}, n, { label: n.labelOwn, short: n.labelOwn }) : n);

  /* ---------------------------------------------------------------- bits */

  const badge = (text, color, cls) =>
    `<span class="badge badge-${color} ${cls || ''}">${text}</span>`;

  const reqOf = (it) => it && it.request ? DATA.requests.find(r => r.id === it.request) : null;

  function statusBadge(it, cls) {
    const b = M.badgeOf(it);
    const foot = M.badgeFootnote(it);
    /* a rescan is a suffix on whatever the badge says — the copy that was
       decided over is never forgotten (status-model §4) */
    const r = reqOf(it);
    return badge(b.label + (r && r.rescan ? ' · rescan' : ''), b.color, cls) +
      (foot ? `<div class="badge-foot">· ${foot}</div>` : '');
  }

  const prioBadge = (p, cls) => badge(p, M.prioColor(p), cls);

  /* Registry column: strongest evidence wins, prefixed by whoever said it.
     A reader is only ever offered a content link.                          */
  function registryCell(d, audience) {
    const r = M.strongestRegistry(d);
    if (!r) return '<span class="muted">—</span>';

    /* A reader needs to know whether they can read it, and nothing else.
       Somebody else's planning vocabulary — Planned, InProgress, an unmapped
       Revision — is internal, and an unmapped value is the one thing we
       deliberately do not interpret. So a reader is offered content or
       nothing. view-rules §4.3, registry-status §1                        */
    if (audience === 'public') {
      const url = M.readerLink(r);
      if (!url) return '<span class="muted">—</span>';
      return `<a href="${url}" target="_blank" rel="noopener" onclick="event.stopPropagation()"
        class="badge badge-purple badge-xs hover:underline">Read it in ${r.source} <span class="opacity-60">&#8599;</span></a>`;
    }

    const label = `${r.source}: ${r.raw || r.state}`;
    const color = M.REG_STATE_COLOR[r.state] || 'slate';
    const href = audience === 'public' ? M.readerLink(r) : r.url;
    const stale = r.observed !== r.checked
      ? `<span class="reg-stale">as of ${r.observed}</span>` : '';
    if (href) {
      return `<a href="${href}" target="_blank" rel="noopener" onclick="event.stopPropagation()"
        class="badge badge-${color} badge-xs hover:underline">${label} <span class="opacity-60">&#8599;</span></a>${stale}`;
    }
    return badge(label, color, 'badge-xs') + stale;
  }

  /* Status footnote — "{status}: {reason}", readable with no interaction.
     Graded: a reader never sees the internal wording (view-rules §4.3).    */
  function noteParts(it, audience) {
    const pick = (pub, int) => audience === 'public' ? pub : (int || pub);
    let title = null, text = null, tone = 'slate';
    if (it.cancellation) {
      title = it.cancellation.cause === 'Decided' ? 'Cancelled' : 'Could not be digitized';
      text = pick(it.cancellation.publicText, it.cancellation.internalText);
      tone = 'slate';
    } else if (M.restricted(it)) {
      title = 'Forbidden'; text = pick(it.restriction.publicText, it.restriction.internalText); tone = 'slate';
    } else if (it.progress === 'IngestFailed') {
      /* a reader is told "being added" and nothing more — the failure is an
         administrator's to fix, not the requester's to worry about */
      if (audience === 'public') return null;
      title = 'Could not be added'; text = it.ingestError; tone = 'red';
    } else if (M.validationOf(it) === 'Denied') {
      title = audience === 'public' ? 'On hold' : 'Denied in review'; text = pick('A problem with the record must be fixed first.', it.deniedNote); tone = 'red';
    } else if (M.validationOf(it) === 'Needed') {
      const out = M.outstanding(it);
      title = audience === 'public' ? 'Being checked' : 'Review needed';
      text = audience === 'public'
        ? out.map(d => d.publicText).join(' ')
        : out.map(d => `${d.plugin} ${d.rule} — ${d.internalText}`).join(' ');
      tone = 'amber';
    } else if (audience !== 'public') {
      /* existing copies are for whoever decides — a reader is offered the
         copy itself as a link, never the deliberation over it */
      const r = reqOf(it);
      const late = r && !r.rescan && (r.existingCopies || []).find(c => c.afterApproval);
      if (late) {
        title = 'Copy found after approval';
        text = `${late.source}: ${late.state.toLowerCase()}, seen ${late.seenAt}. Nobody has decided over it — check before listing.`;
        tone = 'amber';
      } else if (r && r.rescan) {
        title = 'Rescan'; text = r.rescan.note; tone = 'blue';
      }
    }
    return text ? { title, text, tone } : null;
  }

  function noteFor(it, audience) {
    const n = noteParts(it, audience);
    if (!n) return '';
    return `<div class="status-note status-note-${n.tone}">
      <span class="flex-shrink-0">&#9660;</span>
      <div><b>${n.title}:</b> <span>${n.text}</span></div></div>`;
  }

  /* the same reason, one line, for a list row */
  function whyLine(it, audience) {
    const n = noteParts(it, audience);
    return n ? `<b style="color:var(--tone-${n.tone}-fg)">${n.title}:</b> ${n.text}` : '';
  }

  /* --------------------------------------------------------- request row */
  /* A request either PRODUCES an iteration or SHADOWS one. Either way what
     the requester sees is that iteration's live status — never the word
     "Duplicate", which reads as a rejection of a reasonable ask.
     status-model §2.7                                                      */

  function reqView(r) {
    const d = DATA.doc(r.doc);
    const it = r.iteration ? DATA.iter(r.iteration)
             : r.tracks ? DATA.iter(r.tracks) : null;

    if (r.decision === 'Denied') {
      return { doc: d, it: null, badge: M.badgeOf({ decision: 'Denied' }),
        publicStatus: 'Not accepted', held: '—',
        note: { title: 'Not accepted', text: r.declinePublic, tone: 'red' } };
    }
    if (r.decision === 'Withdrawn') {
      return { doc: d, it: null, badge: M.badgeOf({ decision: 'Withdrawn' }),
        publicStatus: 'Withdrawn', held: '—', note: null };
    }
    if (r.decision === 'Pending') {
      const held = r.approveOnCheck && (r.existingCopies || []).length;
      return { doc: d, it: null, badge: M.badgeOf({ decision: 'Pending' }),
        publicStatus: 'Waiting for review', held: 'Proposals',
        note: held ? { title: 'Held for review',
          text: `Approval was asked for, but ${r.existingCopies[0].source} already has it — a curator decides whether to scan it again.`,
          tone: 'amber' } : null };
    }
    const stage = M.stageOf(it);
    const base = { doc: d, it, badge: M.badgeOf(it), publicStatus: M.publicStatus(it),
                   held: stage.view || '—', shadowing: r.decision === 'Duplicate' };
    if (r.decision === 'Duplicate') {
      base.note = { title: 'Already being digitized',
        text: 'Somebody asked for this first — you are following that work.', tone: 'blue' };
    }
    return base;
  }

  /* ---------------------------------------------------------------- shell */

  /* Flat list, in rework.md's order. No group headers and no per-entry
     counts: a bare number beside a nav entry does not say what it counts.
     Counts live on Watchlists, where the panel names each one.            */
  function navHTML(active, role) {
    const held = permsOf(role);
    return visibleNav(held).map(n =>
      `<a href="${n.file}" class="sidebar-link ${n.id === active ? 'active' : ''}"
          title="${n.label}">
         <span class="rail">${n.rail}</span>
         <span class="nav-label">${n.label}</span>
       </a>`).join('');
  }

  const ICON = {
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>',
    out:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>'
  };

  /* Watchlists are saved filters INSIDE a view — a lens. So each row names its
     view as well as its own name: "Awaiting my review" means different things
     in different views, and a bare name makes them indistinguishable.      */
  const WATCHLISTS = [
    { view: 'Documents',   file: 'documents.html',  name: 'High priority, not scheduled', n: 3 },
    { view: 'Documents',   file: 'documents.html',  name: 'Published with a new defect',  n: 2 },
    { view: 'Validations', file: 'validation.html?defect=PageCount', name: 'Page counts', n: 2 },
    { view: 'Validations', file: 'validation.html?show=Denied', name: 'Denied in review',  n: 1 },
    { view: 'Proposals',   file: 'proposals.html',  name: 'More than one asker',          n: 1 },
    /* every curator sees every proposal; a lens is how one narrows it to
       their share — here by material type */
    { view: 'Proposals',   file: 'proposals.html?type=Periodical', name: 'Periodicals', n: 10 },
    { view: 'Documents',   file: 'documents.html?status=Could+not+be+added&group=batch', name: 'Could not be added', n: 2 }
  ];

  /* A watchlist is a lens inside a view, so the panel only lists lenses on
     views this actor can open — and names each group by the entry's own
     label, the string the sidebar already taught them. */
  /* the ones this viewer saved in the demo — per browser, which is enough to
     show the loop; the product keeps them on the account */
  const savedWatchlists = () => {
    try { return JSON.parse(localStorage.getItem('vera.watchlists') || '[]'); } catch (e) { return []; }
  };
  function saveWatchlist(w) {
    try { localStorage.setItem('vera.watchlists', JSON.stringify([...savedWatchlists(), w])); } catch (e) { /* private window */ }
  }
  function watchlistsFor(role) {
    const nav = visibleNav(permsOf(role));
    const labelOf = (file) => (nav.find(n => file.split('?')[0] === n.file) || {}).label;
    return [...WATCHLISTS, ...savedWatchlists()]
      .map(w => Object.assign({}, w, { view: labelOf(w.file) })).filter(w => w.view);
  }

  function watchPanelHTML(role) {
    const byView = {};
    watchlistsFor(role).forEach(w => (byView[w.view] = byView[w.view] || []).push(w));
    return `<div class="wl-head"><span>Watchlists</span>
        <button class="wl-close">&times;</button></div>
      <div class="wl-body">
        ${Object.entries(byView).map(([v, ws]) => `
          <div class="wl-group">${v}</div>
          ${ws.map(w => `<a class="wl-row" href="${w.file}">
             <span>${w.name}</span>${w.n != null ? `<span class="wl-n">${w.n}</span>` : ''}</a>`).join('')}`).join('')
          || '<div class="wl-empty">No watchlists yet. Filter a view, then <b>Save as Watchlist</b>.</div>'}
      </div>
      <div class="wl-foot">Built with advanced filtering, which exists at
        <b>large</b> and <b>notebook</b> only — authored on a desktop,
        consumed everywhere.</div>`;
  }

  /* navigation §6 — the same runs Tasks shows, scoped the same way: all of
     them for task.read, the ones this user started for task.read_own; for
     anyone else the panel is ABSENT, not zero. */
  const runningFor = (role) => {
    const held = permsOf(role);
    return (DATA.tasks || []).filter(t => t.state === 'running' &&
        (held.has('task.read') || (held.has('task.read_own') && t.by === ROLE_USER[role])))
      .map(t => ({ what: t.what, pct: Math.round(t.done / t.total * 100) }));
  };

  /* who you are follows the demo's `as` control, so the foot never contradicts
     the page it is sitting beside */
  const ROLE_USER = { reader: 'u5', staff: 'u4', curator: 'u1',
                      'dig-curator': 'u2', admin: 'u3' };

  const ICON_USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>';

  /* navigation §7 — ONE popover: preferences, change password, and whatever
     accumulates; logout set apart by a rule and by position, because it is
     the one item that clicking again does not undo. */
  function userMenuHTML(role) {
    const me = DATA.byId(ROLE_USER[role] || 'u1');
    return `<div class="um-head"><b>${me.name}</b><span>${role}</span></div>
      <div class="um-body">
        <a class="um-row" href="#">Preferences</a>
        <a class="um-row" href="#">Change password</a>
      </div>
      <div class="um-foot"><a class="um-row um-out" href="#">${ICON.out}Sign out</a></div>`;
  }

  function footHTML(role, tier) {
    const me = DATA.byId(ROLE_USER[role] || 'u1');
    const nb = tier === 'notebook';
    const wl = nb ? watchlistsFor(role) : WATCHLISTS;
    const total = wl.reduce((a, w) => a + (w.n || 0), 0);
    const run = runningFor(role);
    const tasks = !run.length ? '' : nb
      ? `<a class="tasks" href="tasks.html" title="Tasks running — open Tasks">
          <div class="tasks-collapsed"><span class="tasks-dot">${run.length}</span></div>
          <div class="tasks-expanded">
            <div class="tasks-head"><span>Tasks running</span><span>${run.length}</span></div>
            ${run.map(t => `<div class="tasks-row">
              <div class="tasks-label"><span>${t.what}</span><span>${t.pct}%</span></div>
              <div class="tasks-bar"><i style="width:${t.pct}%"></i></div></div>`).join('')}
          </div></a>`
      : `<div class="tasks">
        <div class="tasks-collapsed"><span class="tasks-dot">${run.length}</span></div>
        <div class="tasks-expanded">
          <div class="tasks-head"><span>Tasks running</span><span>${run.length}</span></div>
          ${run.map(t => `<div class="tasks-row">
            <div class="tasks-label"><span>${t.what}</span><span>${t.pct}%</span></div>
            <div class="tasks-bar"><i style="width:${t.pct}%"></i></div></div>`).join('')}
        </div>
      </div>`;
    return `
      <div class="sidebar-sep"></div>
      <button class="sidebar-link wl-btn" title="Watchlists">
        <span class="rail icon">${ICON.star}${total ? `<span class="rail-dot">${total}</span>` : ''}</span>
        <span class="nav-label">Watchlists</span>
        ${total ? `<span class="nav-label wl-total">${total}</span>` : ''}
      </button>
      ${tasks}
      <div class="sidebar-sep"></div>
      ${nb
        ? `<button class="sidebar-link um-btn" title="${me.name} — preferences, password, sign out">
            <span class="rail icon">${ICON_USER}</span>
            <span class="nav-label">${me.name}</span></button>`
        : `<button class="sidebar-link" title="${me.name} — sign out">
            <span class="rail icon">${ICON.out}</span>
            <span class="nav-label">${me.name}</span>
          </button>`}`;
  }

  /* large / notebook — a docked sidebar. Notebook defaults to the rail and
     remembers the toggle per device; hovering expands it as an OVERLAY so
     the table never reflows on a stray mouse pass (navigation §4.2).       */
  function wireSidebar(el, tier, role) {
    const popover = (cls, html) => {
      const p = document.createElement('div');
      p.className = cls; p.innerHTML = html;
      /* into #app, not body: #app is the device frame at small and phone, and a
         fixed element outside it anchors to the window instead of the screen */
      document.getElementById('app').appendChild(p);
      return p;
    };
    const panels = [];
    const bind = (btn, panel) => {
      panels.push(panel);
      btn.onclick = (e) => {
        e.stopPropagation();
        const was = panel.classList.contains('open');
        panels.forEach(p => p.classList.remove('open'));
        if (!was) panel.classList.add('open');
        sync();
      };
    };
    const sync = () => el.classList.toggle('pop-open', panels.some(p => p.classList.contains('open')));
    const wl = popover('wl-panel', watchPanelHTML(tier === 'notebook' ? role : 'admin'));
    wl.querySelector('.wl-close').onclick = () => { wl.classList.remove('open'); sync(); };
    bind(el.querySelector('.wl-btn'), wl);
    if (el.querySelector('.um-btn')) bind(el.querySelector('.um-btn'), popover('um-panel', userMenuHTML(role)));
    document.addEventListener('click', (e) => {
      panels.forEach(p => { if (!p.contains(e.target)) p.classList.remove('open'); });
      sync();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { panels.forEach(p => p.classList.remove('open')); sync(); }
    });

    /* "after navigating it rolls back to small" (rework.md). The cursor is
       usually still over the rail when the next page loads, and :hover would
       open it again at once — so hover-expand waits until the pointer has
       left the bar once. */
    if (el.classList.contains('hoverable')) {
      /* The rail's task dot is shorter than the expanded panel, so expanding
         pushed Watchlists UP under the cursor — the row moved away from the
         pointer about to click it. The rail reserves the panel's height. */
      const t = el.querySelector('.tasks');
      if (t) {
        const x = t.querySelector('.tasks-expanded');
        x.style.cssText = 'display:block;position:absolute;visibility:hidden;width:15.5rem';
        t.style.minHeight = x.offsetHeight + 'px';
        x.style.cssText = '';
      }
      el.classList.add('hover-hold');
      /* a fresh page never saw the pointer ENTER, so it will not fire a
         mouseleave either — watch for the pointer anywhere outside instead */
      document.addEventListener('mousemove', (e) => {
        if (!el.contains(e.target)) el.classList.remove('hover-hold');
      });
      el.addEventListener('click', (e) => {
        if (e.target.closest('.nav a, .tasks, .brand')) el.classList.add('hover-hold');
      });
    }
  }

  function sidebar(tier, active, role) {
    const key = `vera.sidebar.${tier}`;
    const stored = localStorage.getItem(key);
    const expanded = stored ? stored === '1' : tier === 'large';
    const el = document.createElement('aside');
    el.className = `sidebar ${expanded ? 'expanded' : ''} ${tier === 'notebook' ? 'hoverable' : ''}`;
    el.innerHTML = `<div class="sb-inner">
      <a class="brand" href="home.html" title="Home"><span class="brand-mark">V</span>
        <span class="nav-label brand-name">VERA</span></a>
      <button class="sidebar-toggle" title="Expand / collapse">
        <span class="toggle-icon">${ICON.chev}</span></button>
      <nav class="nav">${navHTML(active, role)}</nav>
      <div class="sidebar-foot">${footHTML(role, tier)}</div></div>`;
    el.querySelector('.sidebar-toggle').onclick = () => {
      el.classList.toggle('expanded');
      localStorage.setItem(key, el.classList.contains('expanded') ? '1' : '0');
    };
    return el;
  }

  /* small — hamburger opening a left sheet. phone — bottom tabs + More. */
  function sheetNav(active, role) {
    const el = document.createElement('aside');
    el.id = 'navSheet';
    el.className = 'sheet sheet-left sidebar expanded';
    el.innerHTML = `<div class="sb-inner">
      <a class="brand" href="home.html" title="Home"><span class="brand-mark">V</span>
        <span class="nav-label brand-name">VERA</span></a>
      <nav class="nav">${navHTML(active, role)}</nav>
      <div class="sidebar-foot">${footHTML(role)}</div></div>`;
    return el;
  }

  function bottomTabs(active, role) {
    const held = permsOf(role);
    /* the first three entries the actor holds, in the list's own order —
       there are no groups to pick them from (navigation §4.3) */
    const work = visibleNav(held).slice(0, 3);
    const el = document.createElement('nav');
    el.className = 'tabbar';
    el.innerHTML = work.map(n => `<a href="${n.file}" class="${n.id === active ? 'active' : ''}">
        <span class="tab-rail">${n.rail}</span><span>${n.short || n.label}</span>
        ${n.count ? `<span class="tab-count">${n.count}</span>` : ''}</a>`).join('') +
      `<a href="#" id="moreTab"><span class="tab-rail">&#8943;</span><span>More</span></a>`;
    return el;
  }

  /* ---------------------------------------------------------- page mount */

  /* View switcher — a LENS on one view, not a route to another. Documents has
     a requestor's, a validator's and a digitizer's reading of the same rows;
     that is one view seen three ways, and view-map §1 keeps it on one page. */
  function viewTabsHTML(views) {
    if (!views || !views.length) return '';
    const cur = (location.hash || '').slice(1) || views[0][0];
    return `<div class="viewtabs">${views.map(([k, l]) =>
      `<a href="#${k}" class="${k === cur ? 'current' : ''}"
          onclick="setTimeout(()=>location.reload(),0)">${l}</a>`).join('')}</div>`;
  }
  const currentView = (views) => (location.hash || '').slice(1) || (views[0] && views[0][0]);

  /* Filter bar — the active filters are chips you strike off one at a time,
     and the set of them is exactly what "Save as Watchlist" names.         */
  function filterBarHTML(f, tier) {
    if (!f) return '';
    /* A phone gets the search and ONE button. Chips, the add-filter picker and
       Save as Watchlist are authored on a desktop and consumed everywhere —
       putting them here costs two rows to say what one button says. */
    if (tier === 'phone') {
      return `<div class="filterbar">
        ${f.search === false ? '' : `<input class="search" placeholder="Search…" ${f.query != null ? `data-q value="${String(f.query).replace(/"/g, '&quot;')}"` : ''}>`}
        <button class="btn btn-sm">Filter${
          (f.chips || []).length ? ` <b>${f.chips.length}</b>` : ''}</button>
      </div>`;
    }
    const chips = (f.chips || []).map(c =>
      `<span class="chip"><span>${c.k} <b>${c.v}</b></span>${c.drop
        ? `<a class="x" href="${c.drop}" title="Remove this filter">&times;</a>`
        : '<span class="x">&times;</span>'}</span>`).join('');
    /* f.options: [[group, [[label, href]]]] — a filter the demo can really
       apply; f.available: names only, for the ones it cannot */
    const add = f.add === false ? '' :
      `<select class="addfilter" ${f.options ? 'data-go' : ''}><option value="">+ Add Filter</option>${
        (f.options || []).map(([g, vs]) => `<optgroup label="${g}">${
          vs.map(([l, h]) => `<option value="${h}">${l}</option>`).join('')}</optgroup>`).join('')}${
        (f.available || (f.options ? [] : ['Status', 'Priority', 'Category', 'Project', 'Requested by']))
          .map(o => `<option disabled>${o}</option>`).join('')}</select>`;
    return `<div class="filterbar">
      ${f.search === false ? '' :
        `<input class="search" placeholder="${f.search || 'Search…'}" ${f.query != null ? `data-q value="${String(f.query).replace(/"/g, '&quot;')}"` : ''}>`}
      ${chips || add ? '<span class="filterbar-label">Filters</span>' : ''}
      ${chips}${add}
      <span class="right">${f.right || ''}
        <button class="btn btn-sm" ${f.watch ? 'id="saveWl"' : ''}>Save as Watchlist</button></span>
    </div>`;
  }

  /* Save as Watchlist names the CURRENT filter set — the chips on the bar
     are exactly what is saved. A count is opt-in (navigation §5): it runs
     the query on every page load. */
  function wireFilters(f) {
    /* f.query: the search really runs, as ?q= — so a link can land on a record */
    const qs = document.querySelector('input.search[data-q]');
    if (qs) qs.onkeydown = (e) => { if (e.key !== 'Enter') return;
      const u = new URLSearchParams(location.search); qs.value.trim() ? u.set('q', qs.value.trim()) : u.delete('q');
      location.search = u.toString(); };
    const sel = document.querySelector('select.addfilter[data-go]');
    if (sel) sel.onchange = () => { if (sel.value) location.href = sel.value; };
    const btn = document.getElementById('saveWl');
    if (!btn) return;
    btn.onclick = () => {
      const w = f.watch, chips = f.chips || [];
      const host = document.createElement('div');
      host.className = 'modal-scrim';
      host.innerHTML = `<div class="modal">
        <div class="modal-head"><h2>Save as Watchlist</h2>
          <button class="modal-x" data-x aria-label="Close">&times;</button></div>
        <div class="modal-body">
          <label class="fld" style="margin-top:0">Name
            <input class="search" id="wlName" style="display:block;width:100%;max-width:none;margin-top:.375rem"
              value="${w.name || ''}" placeholder="What you will look for it by"></label>
          <div class="fld">In <b>${w.view}</b>, showing
            <div class="wl-chips">${chips.length ? chips.map(c =>
              `<span class="chip"><span>${c.k} <b>${c.v}</b></span></span>`).join('')
              : '<span class="muted">everything — no filter is set</span>'}</div></div>
          <label class="chk"><input type="checkbox" id="wlCount" checked> <span><b>Show a count</b>
            <span class="muted">— ${w.n} right now. The count is re-run on every page load, so
            leave it off for a watchlist you only open now and then.</span></span></label>
        </div>
        <div class="modal-foot"><button class="btn foot-left" data-x>Cancel</button>
          <button class="btn btn-primary" id="wlSave">Save</button></div></div>`;
      document.getElementById('app').appendChild(host);
      const close = () => host.remove();
      host.querySelectorAll('[data-x]').forEach(b => b.onclick = close);
      host.onclick = (e) => { if (e.target === host) close(); };
      const name = host.querySelector('#wlName');
      name.focus(); name.select();
      name.oninput = () => { host.querySelector('#wlSave').disabled = !name.value.trim(); };
      host.querySelector('#wlSave').onclick = () => {
        saveWatchlist({ view: w.view, file: w.file, name: name.value.trim(),
                        n: host.querySelector('#wlCount').checked ? w.n : null });
        location.reload();
      };
    };
  }

  function mount(opts) {
    /* opts: { tier, active, role, title, subtitle, views, filters,
               actions, body, split, audience } */
    const root = document.getElementById('app');
    const tier = opts.tier, role = opts.role || 'curator';
    document.documentElement.dataset.tier = tier;

    /* A user holding no grants has NO SHELL — no sidebar, no sheet, no tabs
       (permissions §5). It is the one state that must be drawn without the
       thing every other page takes for granted, because a page saying "there
       is nothing here for you" beside a full sidebar says the opposite. */
    if (tier === 'phone' && !opts.bare) document.body.classList.add('has-tabbar');
    if (!opts.bare && (tier === 'large' || tier === 'notebook')) {
      const bar = sidebar(tier, opts.active, role);
      root.appendChild(bar);
      wireSidebar(bar, tier, role);
    }
    const main = document.createElement('div');
    main.className = 'main';
    /* split pages own the whole height and scroll their two columns
       independently; table pages scroll one .content */
    const bodyHTML = opts.split
      ? `<div class="split">${opts.split}</div>`
      : `<div class="content">${opts.body}</div>`;
    main.innerHTML = `
      <header class="topbar">
        ${tier === 'small' && !opts.bare ? '<button id="burger" class="icon-btn">&#9776;</button>' : ''}
        <div class="titles">
          <h1>${opts.title}</h1>
          ${opts.subtitle ? `<p>${opts.subtitle}</p>` : ''}
        </div>
        ${tier === 'phone' ? '' : viewTabsHTML(opts.views)}
        <div class="topbar-actions">${opts.actions || ''}</div>
      </header>
      ${filterBarHTML(opts.filters, tier)}
      ${bodyHTML}`;
    root.appendChild(main);
    if (opts.split) main.style.overflow = 'hidden';
    if (opts.filters) wireFilters(opts.filters);

    if (!opts.bare && (tier === 'small' || tier === 'phone')) {
      const sheet = sheetNav(opts.active, role);
      root.appendChild(sheet);
      wireSidebar(sheet);
      const scrim = document.createElement('div');
      scrim.className = 'scrim'; root.appendChild(scrim);
      const open = () => { sheet.classList.add('open'); scrim.classList.add('open'); };
      const close = () => { sheet.classList.remove('open'); scrim.classList.remove('open'); };
      scrim.onclick = close;
      if (tier === 'small') document.getElementById('burger').onclick = open;
      if (tier === 'phone') {
        const tabs = bottomTabs(opts.active, role);
        root.appendChild(tabs);
        tabs.querySelector('#moreTab').onclick = (e) => { e.preventDefault(); open(); };
      }
    }
    tierBar(tier, role);
    deviceFrame();
    addEventListener('resize', deviceFrame);
  }

  /* ------------------------------------------------------ device frame ----
     The CSS (vera.css § device frame) decides WHETHER a tier is framed and at
     what size. This decides what to do when that size does not fit the window,
     and the answer is scale, never crop: a phone cut off at 700px tall is not
     a phone, and anything concluded from it about what fits above the fold
     would be false. The device keeps its true 393×852 layout — the transform
     is display magnification, and the page inside never learns about it.

     Scaling is also why the margins are here. A transform does not change the
     layout box, so a scaled device would still reserve its full unscaled
     height and push the backdrop into a scrollbar. The negative margins take
     back exactly what the scale gave up.                                    */
  function deviceFrame() {
    const app = document.getElementById('app');
    const cs = getComputedStyle(document.documentElement);
    const w = parseFloat(cs.getPropertyValue('--dev-w'));
    const h = parseFloat(cs.getPropertyValue('--dev-h'));
    /* not framed: --dev-w is 100% and --dev-h is auto, so both fail to parse */
    if (!w || !h) { app.style.transform = ''; app.style.margin = ''; return; }

    const pad = 56;                       /* the bezel, the label, breathing */
    const s = Math.min(1, (innerWidth - pad) / w, (innerHeight - pad) / h);
    if (s >= 0.999) { app.style.transform = ''; app.style.margin = ''; return; }
    app.style.transform = `scale(${s})`;  /* replaces translateZ — still a
                                             containing block for fixed */
    app.style.margin = `${-(1 - s) * h / 2}px ${-(1 - s) * w / 2}px`;
  }

  /* demo chrome — one bar, bottom right, so it never covers the sidebar */
  function tierBar(current, role) {
    /* the tooltip names the DISPLAY and its root size — a tier is not a
       breakpoint range, it is how big the type is and how much room it has */
    const tiers = [['large','Large','desktop 1920×1200 · 15px root — zoomed out'],
                   ['notebook','Notebook','laptop 1440×900 · 16px root — authored here'],
                   ['small','Small','tablet 1024×768 · 16px root'],
                   ['phone','Phone','phone 393×852 · 16px root']];
    const roles = ['reader', 'staff', 'curator', 'dig-curator', 'admin'];
    const page = location.pathname.split('/').pop() || 'home.html';
    const bar = document.createElement('div');
    bar.className = 'tierbar';
    bar.innerHTML =
      '<span class="tierbar-label">as</span>' +
      roles.map(r => `<a href="#" data-role="${r}" class="role ${r === role ? 'current' : ''}"
         title="render as ${r}">${r}</a>`).join('') +
      '<span class="tierbar-sep"></span><span class="tierbar-label">size</span>' +
      tiers.map(([k, l, h]) => `<a class="${k === current ? 'current' : ''}"
         href="../${k}/${page}" title="${h}">${l}</a>`).join('') +
      `<a class="home" href="../index.html" title="All demos">&#9737;</a>`;
    bar.querySelectorAll('a.role').forEach(a => a.onclick = (e) => {
      e.preventDefault();
      localStorage.setItem('vera.role', a.dataset.role);
      location.reload();
    });
    document.body.appendChild(bar);
  }

  /* ------------------------------------------------- master–detail pieces */

  /* A list row: identifier, title, badges, and the one-line reason. The
     reason is in the ROW because view-rules §1.1 makes it budget-exempt — a
     row you must not act on blindly is worth the point. The pane carries the
     full text; the row carries enough not to be misread.                   */
  /* NOT an <a>. A row carries badges that are themselves links (a registry
     link, a catalog link), and an anchor inside an anchor is invalid — the
     parser closes the outer one early, so everything after the nested link
     falls OUT of the row and loses its background. A div with a role is the
     only shape that survives having links inside it.                       */
  function lrow(o) {
    /* a TABLE row: the same element, its cells laid on the list's shared
       columns (a subgrid), and the reason line spanning all of them */
    if (o.cells) return `<div class="lrow trow ${o.selected ? 'selected' : ''}" data-key="${o.key}"
                 role="button" tabindex="0">
      ${o.cells.map((c, i) => `<div class="tc ${o.num && o.num[i] ? 'num' : ''}">${c}</div>`).join('')}
      ${o.why ? `<div class="lrow-why">${o.why}</div>` : ''}
    </div>`;
    return `<div class="lrow ${o.selected ? 'selected' : ''}" data-key="${o.key}"
                 role="button" tabindex="0">
      ${o.id ? `<div class="lrow-id">${o.id}</div>` : ''}
      <div class="lrow-title">${o.title}</div>
      ${o.meta ? `<div class="lrow-meta">${o.meta}</div>` : ''}
      ${o.why ? `<div class="lrow-why">${o.why}</div>` : ''}
    </div>`;
  }

  const pcard = (title, body, right) => `<section class="pcard">
    ${title ? `<div class="pcard-head"><h3>${title}</h3>
      ${right ? `<span class="right">${right}</span>` : ''}</div>` : ''}
    ${body}</section>`;

  const stats = (list) => `<div class="stat-grid">${list.map(s => `<div class="stat">
      <div class="stat-label">${s.label}</div>
      <div class="stat-value">${s.value}</div>
      ${s.foot ? `<div class="stat-foot">${s.foot}</div>` : ''}
      ${s.pct != null ? `<div class="meter"><i style="width:${s.pct}%"></i></div>` : ''}
    </div>`).join('')}</div>`;

  const kv2 = (pairs) => `<div class="kv2">${pairs.map(([k, v]) =>
    `<div><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>`;

  const pager = (n, total) => `<div class="pager">
    <span>Showing 1–${n} of ${total == null ? n : total} results</span>
    <span class="btns"><button class="btn btn-sm" disabled>Previous</button>
      <button class="btn btn-sm" ${total && total > n ? '' : 'disabled'}>Next</button></span></div>`;

  /* Build a master–detail page and wire selection. `render(key)` returns the
     pane's inner HTML; on small and phone the pane is a sheet, so the row
     click opens it and a Back button closes it.                            */
  function splitPage(o) {
    /* o.listHTML overrides the generated rows for lists that are not flat —
       the category tree, mainly. It must still emit .lrow[data-key] elements. */
    const sheetTier = o.tier === 'phone';
    const rows = o.listHTML ? [o.listHTML] : o.rows.map((r, i) =>
      lrow(Object.assign({}, r, { selected: !sheetTier && i === 0 })));
    /* o.columns turns the list into a table: half the page, a header row,
       cells aligned down the list — the record is the other half */
    const cols = o.columns;
    const head = `<div class="listcol-head"><span>${o.count}</span>
      ${o.countRight || ''}</div>` + (cols ? `<div class="thead">${cols.map(c =>
        `<div class="${c.num ? 'num' : ''}">${c.label}</div>`).join('')}</div>` : '');
    /* the page's own claim about itself — demo commentary, so it rides along
       with every record rather than being wiped by the next click */
    const foot = o.footer ? `<div class="budget">${o.footer}</div>` : '';
    const render = (k) => o.render(k) + foot;
    const first = o.rows[0];
    const initial = (sheetTier || !first)
      ? `<div class="pane-empty">${o.empty || 'Select a row to see the whole of it.'}</div>${foot}`
      : render(first.key);

    mount(Object.assign({}, o, {
      split: `<div class="listcol ${cols ? 'tlist' : ''}" ${cols
                ? `style="--cols:${cols.map(c => c.w || 'max-content').join(' ')}"` : ''}>${head}${rows.join('')}</div>
              <div class="pane">${initial}</div>`
    }));

    const pane = document.querySelector('.pane');
    const sheet = sheetTier;
    /* the column header sticks just under the count bar, whatever its height */
    const th = document.querySelector('.thead');
    if (th) th.style.top = document.querySelector('.listcol-head').offsetHeight + 'px';
    /* a custom list (a tree) cannot mark its own first row */
    if (o.listHTML && !sheet) {
      const f = document.querySelector('.lrow');
      if (f) f.classList.add('selected');
    }
    document.querySelectorAll('.lrow').forEach(el => el.onclick = (e) => {
      /* a link inside the row is a link, not a row click */
      if (e.target.closest('a')) return;
      e.preventDefault();
      document.querySelectorAll('.lrow').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
      pane.innerHTML = render(el.dataset.key);
      pane.scrollTop = 0;
      if (sheet) pane.classList.add('open');
      const back = pane.querySelector('.pane-back');
      if (back) back.onclick = () => pane.classList.remove('open');
    });
    /* a cross-page link lands on the record (decided 2026-09-26): o.open is
       the key of the row to open, if it is in the list */
    const want = o.open && document.querySelector(`.lrow[data-key="${o.open}"]`);
    if (want) { want.click(); want.scrollIntoView({ block: 'nearest' }); }
  }

  /* pane header — the Back button only exists where the pane is a sheet */
  const paneHead = (title, sub, actions, crumb) => `
    ${crumb ? `<div class="crumb">${crumb}</div>` : ''}
    <div class="pane-head">
      <button class="btn btn-sm pane-back">&#8592; Back</button>
      <div><h2>${title}</h2>${sub ? `<div class="pane-sub">${sub}</div>` : ''}</div>
      ${actions ? `<div class="pane-actions">${actions}</div>` : ''}
    </div>`;

  /* ------------------------------------------------------------- detail */
  /* Docks only at large — a docked panel is 6 points, and notebook cannot
     afford it under 18 with a sidebar and a filter rail (page-composition). */

  function detail(tier, html) {
    const el = document.createElement('aside');
    el.innerHTML = html;
    /* docked must be a SIBLING of .main inside the #app flex row — appending
       it to .main (a flex column) stacks it under the table instead */
    el.className = tier === 'large' ? 'detail docked' : 'detail drawer';
    document.getElementById('app').appendChild(el);
    return el;
  }

  /* demo chrome — see the same page as a different actor, so "absent, not
     disabled" is visible rather than described */
  function roleBar() { /* merged into tierBar */ return; }
  function _roleBarOld(current) {
    const roles = ['reader', 'staff', 'curator', 'dig-curator', 'admin'];
    const bar = document.createElement('div');
    bar.className = 'rolebar';
    bar.innerHTML = '<span class="tierbar-label">as</span>' + roles.map(r =>
      `<a href="#" data-role="${r}" class="${r === current ? 'current' : ''}">${r}</a>`).join('');
    bar.querySelectorAll('a').forEach(a => a.onclick = (e) => {
      e.preventDefault();
      localStorage.setItem('vera.role', a.dataset.role);
      location.reload();
    });
    document.body.appendChild(bar);
  }
  /* ------------------------------------------------------------ message */
  /* messaging.md — VERA does not carry the conversation. *Message…* resolves
     the recipients from the record and hands off to a Message plugin, which
     usually opens a pre-filled mail or chat. No permission of its own; with
     no Message instance enabled there is no action at all. */
  const messageInstances = () => DATA.pluginInstances
    .filter(i => i.type.kind === 'Message' && i.enabled).sort((a, b) => a.order - b.order);
  const messageButton = (attrs, label) => messageInstances().length
    ? `<button class="btn btn-sm" ${attrs}>${label || 'Message…'}</button>` : '';
  /* what an instance can reach a person by: mail needs an address, Slack a
     handle — here, a Keycloak identity carrying the slack_id claim */
  const reachBy = (inst, u) => inst.type.name === 'SlackMessage'
    ? (u.identities || []).some(x => x.idp === 'pi22') : !!u.email;
  function message(o) {
    /* o: { about, link, context, to: [user ids], toLabel, sender } */
    const insts = messageInstances();
    if (!insts.length) return;
    const S = { inst: insts[0].id };
    const host = document.createElement('div');
    host.className = 'modal-scrim';
    document.getElementById('app').appendChild(host);
    const people = [...new Set(o.to)].filter(id => id !== o.sender).map(DATA.byId);
    function draw() {
      const inst = insts.find(i => i.id === S.inst);
      const ok = people.filter(u => reachBy(inst, u)), no = people.filter(u => !reachBy(inst, u));
      const subject = `[VERA] ${o.about}`;
      const bodyText = `${o.context ? o.context + '\n\n' : ''}${o.link ? location.origin + location.pathname.replace(/[^/]*$/, '') + o.link : ''}`;
      const href = inst.type.name === 'SlackMessage'
        ? `https://slack.com/app_redirect?team=mzk&users=${ok.map(u => u.email.split('@')[0]).join(',')}`
        : `mailto:${ok.map(u => u.email).join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
      host.innerHTML = `<div class="modal">
        <div class="modal-head"><h2>Message about ${o.about}</h2>
          <button class="modal-x" data-x aria-label="Close">&times;</button></div>
        <div class="modal-body">
          <div class="fld" style="margin-top:0">To <span class="muted">— ${o.toLabel}</span></div>
          <div class="msg-to">${ok.map(u => `<span class="chip"><span>${u.name}</span></span>`).join('') ||
            '<span class="muted">nobody this way</span>'}</div>
          ${no.length ? `<p class="fine">Not reachable by ${inst.name}: ${no.map(u => u.name).join(', ')} — left out.</p>` : ''}
          ${o.context ? `<div class="fld">About</div><p class="msg-ctx">${o.context}</p>` : ''}
          ${insts.length > 1 ? `<div class="fld">Send with</div><div class="msg-insts">${insts.map(i =>
            `<label class="chk"><input type="radio" name="msgInst" value="${i.id}" ${i.id === S.inst ? 'checked' : ''}>
              <span><b>${i.name}</b> <span class="muted">· ${i.type.name === 'SlackMessage' ? 'opens a Slack DM' : 'opens your mail, pre-filled'}</span></span></label>`).join('')}</div>` : ''}
          <p class="fine">You write and send it in ${inst.name === 'Email' ? 'your mail' : inst.name}. VERA keeps none of the text,
            and does not log a message it only opened for you.</p>
        </div>
        <div class="modal-foot"><button class="btn foot-left" data-x>Cancel</button>
          ${ok.length ? `<a class="btn btn-primary" href="${href}" target="_blank" rel="noopener" data-sent>Open in ${inst.name}</a>`
            : `<button class="btn btn-primary" disabled>Open in ${inst.name}</button>`}</div></div>`;
      host.querySelectorAll('[data-x]').forEach(b => b.onclick = () => host.remove());
      const sent = host.querySelector('[data-sent]');
      if (sent) sent.addEventListener('click', () => setTimeout(() => host.remove(), 0));
    }
    draw();
    host.onclick = (e) => { if (e.target === host) host.remove(); };
    host.onchange = (e) => { if (e.target.name === 'msgInst') { S.inst = e.target.value; draw(); } };
  }

  const currentRole = (fallback) => localStorage.getItem('vera.role') || fallback;

  const userOf = (role) => ROLE_USER[role];
  return { NAV, ROLE_PERMS, permsOf, scopesOf, holders, rolesOfUser, message, messageButton, userOf, holds, visibleNav, reqOf, badge, statusBadge, prioBadge,
           registryCell, noteFor, noteParts, whyLine, reqView, mount, detail, tierBar,
           roleBar, currentRole, currentView,
           splitPage, lrow, pcard, stats, kv2, pager, paneHead };
})();
