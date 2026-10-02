/* Plugins — /plugins
   One data table, grouped twice (decided with the user 2026-09-26):
     TYPE            — what kind of job a plugin does: catalog adapter,
                       registry, harvester, validation, input, list generator…
       IMPLEMENTATION — the code: AlephCatalogAdapter v2.4.1. It declares what
                       it CAN supply — property tiers, a raw_state mapping, an
                       agent and entry point, rules.
         INSTANCE     — a configured, named copy that runs: MZK Aleph, NKP
                       Aleph, VKOL Aleph. It declares WHERE it points.
   An implementation opens its contract in the drawer; an instance opens its
   configuration, when it runs and what its last runs did. Schedules are shown
   here and edited only on Schedules.                                       */

window.PAGE_PLUGINS = function (tier) {
  const M = VERA, D = VERA_DATA, U = VERA_UI;
  const role = U.currentRole('admin');
  const held = U.permsOf(role);
  const can = (p) => held.has(p);
  const q = new URLSearchParams(location.search);
  const tone = (k) => D.KIND_TONE[k] || 'slate';

  const KINDS = Object.keys(D.KIND_TONE);
  const KIND_DESC = {
    'Catalog adapter': 'reads catalog records — page counts, material type, units',
    'Registry': 'asks whether a copy already exists somewhere',
    'Property source': 'supplies a value when the catalog has none',
    'Harvester': 'finds new documents and proposes them',
    'Validation': 'checks a record is complete enough to digitize',
    'Restriction': 'forbids digitizing — copyright, embargo; only an admin overrules it',
    'Input': 'a way of entering items in the propose dialog',
    'List generator': 'builds a digitization list for an intention',
    'Delivery channel': 'where a hook can send — email, chat, webhook, file',
    'Custody': 'places proposals into proposal custodies',
    'Identity': 'a way to log in — the login page is built from these',
    'Message': 'where Message… hands a conversation off to — mail, chat'
  };
  /* what switching an instance off costs — said before it happens */
  const LOSS = {
    'Catalog adapter': (i) => `${i.name} can no longer be searched when proposing, and its records stop resyncing.`,
    'Registry': (i) => `existing-copy checks against ${i.name} stop, and the registry states it reported go stale.`,
    'Property source': () => 'values it already supplied stay; new documents get none from it.',
    'Harvester': () => 'it stops proposing new documents.',
    'Validation': () => 'its rules stop running on ingest; defects it already found stay.',
    'Restriction': () => 'it stops forbidding anything new. What it already forbade stays forbidden until a re-check clears it or an admin overrules it.',
    'Input': (i, t) => othersOn(i, t) ? 'another instance still offers this way of entering items.' : 'this way of entering items disappears from the propose dialog.',
    'List generator': (i, t) => othersAll(t) ? 'it disappears from Generate; other generators stay.' : 'it is the last generator — the Generate button disappears from Digitization Lists.',
    'Delivery channel': (i) => { const n = D.hooks.filter(h => h.target.channel === i.id).length;
      return n ? `the ${n} hook${n > 1 ? 's' : ''} sending through it stop sending — their deliveries wait until it is back or they are moved to another channel.` : 'no hook sends through it.'; },
    'Custody': () => 'every open proposal is placed again without its rule; what nothing else places lands in the fallback.',
    'Identity': (i) => { const n = D.users.filter(u => (u.identities || []).some(x => x.idp === i.id)).length;
      return `it leaves the login page. ${n} ${n === 1 ? 'user signs' : 'users sign'} in through it; they keep their records but cannot log in this way, and roles it mapped stay until their next login elsewhere.`; },
    'Message': (i, t) => othersAll(t) ? 'Message… stops offering it; other ways stay.' : 'it is the last one — Message… disappears everywhere.'
  };
  const othersOn = (i, t) => D.pluginTypes.some(x => x.input === t.input && x.instances.some(y => y !== i && y.enabled));
  const othersAll = (t) => D.pluginTypes.filter(x => x.kind === t.kind).flatMap(x => x.instances).filter(y => y.enabled).length > 1;

  /* ------------------------------------------------------------ records */
  const impl = (id) => D.pluginTypes.find(t => t.id === id);
  const instOf = (id) => { for (const t of D.pluginTypes) { const i = t.instances.find(x => x.id === id); if (i) return { t, i }; } return {}; };
  const CAD = (c) => ({ min: `every ${c.n} min`, hour: c.n === 1 ? 'hourly' : `every ${c.n} hours`, day: `daily ${c.at}`,
    week: `weekly, ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][c.day]} ${c.at}`, month: `monthly, day ${c.day}` })[c.every];
  const schedsOf = (i) => D.schedules.filter(s => s.instance === i.id);
  const runsOf = (i) => D.tasks.filter(t => t.instance === i.id).sort((a, b) => Date.parse(b.started) - Date.parse(a.started));
  const NOW = Date.parse(D.now);
  const ago = (iso) => { const m = Math.round((NOW - Date.parse(iso)) / 6e4);
    return m < 60 ? `${m} min ago` : m < 24 * 60 ? `${Math.round(m / 60)} h ago` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
  const RUN = { running: ['running', 'blue'], done: ['ok', 'green'], failed: ['failed', 'red'], cancelled: ['cancelled', 'slate'], skipped: ['skipped', 'slate'] };
  const lastRunCell = (i) => { const r = runsOf(i)[0];
    if (!r) return `<span class="muted">${i.lastRun}</span>`;
    const [l, c] = r.state === 'done' && r.errors.length ? ['errors', 'amber'] : RUN[r.state];
    return `${U.badge(l, c, 'badge-xs')} <span class="muted">${ago(r.started)}</span>`; };
  const runsText = (i, links) => {
    const parts = i.schedule ? [i.schedule] : [];
    schedsOf(i).forEach(s => parts.push(links && can('task.read')
      ? `<a href="schedules.html?s=${s.id}" class="pl-a">${CAD(s.cadence)}</a>${s.enabled ? '' : ' <span class="muted">(paused)</span>'}`
      : CAD(s.cadence) + (s.enabled ? '' : ' (paused)')));
    return parts.join(' + ') || '<span class="muted">—</span>';
  };
  const supplies = (t) => [
    ...t.properties.map(p => `${p.key} <span class="muted">tier ${p.tier}</span>`),
    t.mapping ? `${t.mapping.length} registry states` : null,
    t.rules ? `${t.rules.length} rules` : null,
    t.identifiers.length ? t.identifiers.join(' · ') : null,
    t.agent ? `agent <i>${t.agent}</i> → ${t.entry}` : null,
    t.class ? t.class : null,
    t.channel ? `${t.channel} interface` : null].filter(Boolean);

  /* ------------------------------------------------------------ filters */
  const F = { kind: KINDS.includes(q.get('kind')) ? q.get('kind') : '', state: ['on', 'off'].includes(q.get('state')) ? q.get('state') : '' };
  const href = (patch) => { const x = new URLSearchParams(q); Object.entries(patch).forEach(([k, v]) => v ? x.set(k, v) : x.delete(k));
    return 'plugins.html' + (x.toString() ? '?' + x : ''); };
  let query = '';
  const collapsed = new Set();

  /* -------------------------------------------------------------- table */
  const COLS = {
    large:    ['name', 'config', 'linked', 'runs', 'last', 'state'],
    notebook: ['name', 'config', 'runs', 'last', 'state'],
    small:    ['name', 'runs', 'state'],
    phone:    ['name', 'state']
  };
  const HEAD = { name: 'Instance', config: 'Configuration', linked: 'Linked to', runs: 'Runs', last: 'Last run', state: '' };
  const cols = COLS[tier];

  function table() {
    const hit = (s) => !query || s.toLowerCase().includes(query);
    const body = KINDS.filter(k => !F.kind || k === F.kind).map(kind => {
      const impls = D.pluginTypes.filter(t => t.kind === kind).map(t => ({ t,
        ins: t.instances.filter(i => (!F.state || (F.state === 'on') === i.enabled) && (hit(i.name + ' ' + t.name) || hit(i.config))) }))
        .filter(x => x.ins.length || (!F.state && hit(x.t.name)));
      if (!impls.length) return '';
      const nI = impls.reduce((a, x) => a + x.ins.length, 0), shut = collapsed.has(kind);
      const kindRow = `<tr class="pl-kind" data-kind="${kind}"><td class="cell" colspan="${cols.length}">
          <span class="pl-caret">${shut ? '&#9656;' : '&#9662;'}</span> ${U.badge(kind, tone(kind))}
          <span class="muted">${KIND_DESC[kind]} · ${impls.length} implementation${impls.length > 1 ? 's' : ''} · ${nI} instance${nI === 1 ? '' : 's'}</span></td></tr>`;
      if (shut) return kindRow;
      return kindRow + impls.map(({ t, ins }) => `
        <tr class="pl-impl" data-impl="${t.id}"><td class="cell" colspan="${cols.length}"><div class="pl-impl-in">
          <div class="pl-impl-main"><span class="pl-impl-name">${t.name}</span> <span class="mono muted">v${t.version}</span>
            <span class="muted pl-impl-desc">${t.description}</span>
            ${tier === 'phone' ? '' : `<div class="pl-sup">${supplies(t).map(x => `<span class="pl-chip">${x}</span>`).join('')}</div>`}</div>
          ${can('plugin.configure') && tier !== 'phone' ? `<button class="btn btn-sm" data-newinst="${t.id}">New instance</button>` : ''}</div></td></tr>
        ${ins.map(i => {
          const cell = {
            name: `<div class="t-title">${i.name}</div>${tier === 'small' || tier === 'phone' ? `<div class="t-sub">${t.name}</div>` : ''}`,
            config: `<span class="mono pl-cfg">${i.config}</span>`,
            linked: i.linked,
            runs: runsText(i, false),
            last: lastRunCell(i),
            state: i.enabled ? U.badge('enabled', 'green', 'badge-xs') : U.badge('disabled', 'slate', 'badge-xs')
          };
          return `<tr class="data-row pl-inst ${sel === 'i:' + i.id ? 'tk-sel' : ''}" data-inst="${i.id}">${cols.map(k => `<td class="cell ${k === 'state' ? 'pl-statecell' : ''}">${cell[k]}</td>`).join('')}</tr>`;
        }).join('') || `<tr class="pl-inst-none"><td class="cell" colspan="${cols.length}"><span class="muted">No instance${F.state ? ' in this state' : ' — it does nothing until one is configured'}.</span></td></tr>`}`).join('');
    }).join('');
    return `<div class="card"><table class="pl-table">
      <thead><tr>${cols.map(k => `<th class="col">${HEAD[k]}</th>`).join('')}</tr></thead>
      <tbody>${body || `<tr><td class="cell" colspan="${cols.length}"><span class="muted">Nothing matches.</span></td></tr>`}</tbody></table></div>`;
  }

  /* ------------------------------------------------------------- detail */
  const panel = U.detail(tier === 'large' ? 'large' : 'drawer', '');
  let sel = null;
  const head = (title, sub) => `<div class="detail-head"><div><h2>${title}</h2><div class="t-sub">${sub}</div></div>
    <button class="icon-btn" style="margin-left:auto" data-close>&times;</button></div>`;
  function contract(t) {
    return `${t.properties.length ? `<h3>Properties it supplies</h3>
        ${t.properties.map(x => `<div class="row-kv"><span>${x.key}</span><span class="muted">tier ${x.tier}</span></div>`).join('')}
        <p class="fine">Highest tier that has a value wins. <code>manual</code> is tier 100 and reserved — a person who looked outranks every plugin.</p>` : ''}
      ${t.mapping ? `<h3>Registry mapping</h3>
        <table class="sub-table"><thead><tr><th>Raw</th><th>Normalised</th><th>Existing copy</th></tr></thead>
          <tbody>${t.mapping.map(m => `<tr><td><code>${m.raw}</code></td>
            <td>${m.state === 'Unmapped' ? '<span style="color:var(--tone-amber-fg)">Unmapped</span>' : m.state}</td>
            <td>${m.copy ? '<span style="color:var(--tone-purple-fg)">counts</span>' : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table>
        ${t.mapping.some(m => m.state === 'Unmapped') ? `<div class="status-note status-note-amber" style="margin-top:.5rem"><span>&#9660;</span>
          <div><b>Revision is unmapped on purpose.</b> <span>An unmapped value shown verbatim costs a curator one moment of
          unfamiliarity; a wrong mapping tells every curator something false, silently.</span></div></div>` : ''}` : ''}
      ${t.agent ? `<h3>Agent</h3><dl class="kv"><dt>Name</dt><dd>${t.agent}</dd><dt>Entry point</dt><dd><code>${t.entry}</code></dd></dl>
        <p class="fine">${t.entry === 'proposals' ? 'What it finds goes through review, attributed to the agent.'
          : 'What it finds skips review — created already approved, attributed to the agent.'}</p>` : ''}
      ${t.rules ? `<h3>Rules</h3>${t.rules.map(r => `<div class="row-kv"><span><span class="mono">${r.code}</span> ${r.what}</span></div>`).join('')}
        <p class="fine">A rule code must stay stable between versions — renumbering silently invalidates every approval made against it.</p>` : ''}
      ${t.identifiers.length ? `<h3>Identifiers it resolves</h3><div>${t.identifiers.map(x => U.badge(x, 'blue', 'badge-xs')).join(' ')}</div>` : ''}
      ${t.class ? `<h3>Class</h3><p class="fine" style="margin-top:0"><b>${t.class}</b> — ${t.class === 'AI-based' ? 'gives its own reason for every pick; not deterministic.' : 'the same pool gives the same list.'}</p>` : ''}`;
  }
  function openImpl(t) {
    sel = 't:' + t.id;
    panel.innerHTML = head(t.name, `${U.badge(t.kind, tone(t.kind), 'badge-xs')} <span class="mono">v${t.version}</span> · implementation`) + `
      <div class="detail-body"><p style="margin-top:0;font-size:.8125rem">${t.description}</p>
        ${contract(t)}
        <h3>Instances · ${t.instances.length}</h3>
        ${t.instances.map(i => `<div class="row-kv"><span><a href="#" data-inst="${i.id}">${i.name}</a></span>
          <span>${i.enabled ? U.badge('enabled', 'green', 'badge-xs') : U.badge('disabled', 'slate', 'badge-xs')}</span></div>`).join('') || '<p class="fine">None.</p>'}
        <div class="tk-dacts">
          ${can('plugin.configure') ? `<button class="btn btn-primary btn-sm" data-newinst="${t.id}">New instance</button>` : ''}
          ${can('plugin.upload_code') ? `<button class="btn btn-sm" data-upload="${t.id}">Upload a new version…</button>` : ''}
        </div></div>`;
    show();
  }
  function openInst(id) {
    const { t, i } = instOf(id);
    sel = 'i:' + id;
    const runs = runsOf(i).slice(0, 5);
    const runnable = D.SCHEDULABLE.includes(t.kind);
    panel.innerHTML = head(i.name, `<a href="#" data-impl="${t.id}" class="pl-a">${t.name}</a> <span class="mono">v${t.version}</span> · ${U.badge(t.kind, tone(t.kind), 'badge-xs')}`) + `
      <div class="detail-body">
        ${i.enabled ? '' : '<div class="status-note status-note-slate" style="margin-top:0"><span>&#9660;</span><div><b>Disabled.</b> <span>It keeps its configuration and runs nowhere.</span></div></div>'}
        <h3>Configuration</h3>
        <pre class="code">${i.config.split(' · ').join('\n')}</pre>
        <dl class="kv"><dt>Linked to</dt><dd>${i.linked}</dd><dt>Created</dt><dd>${i.at} · ${D.byId(i.by).name}</dd></dl>
        <h3>When it runs</h3>
        <dl class="kv">
          ${i.schedule ? `<dt>On</dt><dd>${i.schedule}</dd>` : ''}
          ${schedsOf(i).map(s => `<dt>Scheduled</dt><dd>${CAD(s.cadence)}${s.enabled ? '' : ' <span class="muted">· paused</span>'}${can('task.read') ? ` · <a href="schedules.html?s=${s.id}">edit on Schedules</a>` : ''}</dd>`).join('')}
        </dl>
        ${runnable && !schedsOf(i).length ? `<p class="fine">No schedule — it runs only ${i.schedule || 'by hand'}.${can('task.schedule') ? ' <a href="schedules.html">Add one on Schedules</a>.' : ''}</p>` : ''}
        ${runnable || runs.length ? `<h3>Recent runs</h3>
          ${runs.map(r => { const [l, c] = r.state === 'done' && r.errors.length ? ['errors', 'amber'] : RUN[r.state];
            return `<div class="row-kv"><span>${can('task.read') ? `<a href="tasks.html?run=${r.id}">${r.what}</a>` : r.what}<br><span class="muted">${ago(r.started)}${r.changed ? ' · ' + r.changed.map(x => x.text).join(', ') : ''}</span></span><span>${U.badge(l, c, 'badge-xs')}</span></div>`; }).join('')
            || `<p class="fine" style="margin-top:0">Last run ${i.lastRun}; its run has expired from Tasks.</p>`}` : ''}
        ${t.kind === 'Delivery channel' ? `<h3>Hooks sending through it</h3>${D.hooks.filter(h => h.target.channel === i.id).map(h =>
          `<div class="row-kv"><span>${can('hook.read') ? `<a href="hooks.html?h=${h.id}">${h.name}</a>` : h.name}</span><span class="muted">${h.target.to}</span></div>`).join('') || '<p class="fine" style="margin-top:0">None.</p>'}` : ''}
        <h3>What it supplies</h3>
        <div class="pl-sup">${supplies(t).map(x => `<span class="pl-chip">${x}</span>`).join('') || '<span class="muted">—</span>'}</div>
        <p class="fine">Declared by the implementation — <a href="#" data-impl="${t.id}">see its contract</a>.</p>
        <div class="tk-dacts">
          ${runnable && can('plugin.run') && i.enabled ? `<button class="btn btn-primary btn-sm" data-run="${i.id}">Run now</button>` : ''}
          ${can('plugin.configure') ? `<button class="btn btn-sm" data-edit="${i.id}">Edit configuration…</button>
            <button class="btn btn-sm" data-toggle="${i.id}">${i.enabled ? 'Disable…' : 'Enable'}</button>
            <button class="btn btn-sm btn-danger" data-del="${i.id}">Delete…</button>` : ''}
        </div></div>`;
    show();
  }
  function show() {
    panel.classList.add('open');
    document.querySelectorAll('.tk-sel').forEach(x => x.classList.remove('tk-sel'));
    const [k, id] = sel.split(':');
    const row = document.querySelector(k === 'i' ? `tr[data-inst="${id}"]` : `tr[data-impl="${id}"]`);
    if (row) row.classList.add('tk-sel');
  }
  const close = () => { panel.classList.remove('open'); panel.innerHTML = ''; sel = null; document.querySelectorAll('.tk-sel').forEach(x => x.classList.remove('tk-sel')); };

  /* ------------------------------------------------------------- modals */
  function modal(title, bodyHTML, foot) {
    const host = document.createElement('div');
    host.className = 'modal-scrim';
    host.innerHTML = `<div class="modal"><div class="modal-head"><h2>${title}</h2>
        <button class="modal-x" data-x aria-label="Close">&times;</button></div>
      <div class="modal-body">${bodyHTML}</div><div class="modal-foot">${foot}</div></div>`;
    host.querySelectorAll('[data-x]').forEach(b => b.onclick = () => host.remove());
    host.onclick = (e) => { if (e.target === host) host.remove(); };
    document.body.appendChild(host);
    return host;
  }
  const FOOT = (ok, danger) => `<button class="btn foot-left" data-x>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${ok}</button>`;
  const saved = (b, s) => `<div class="status-note status-note-green pj-saved"><span>&#9660;</span><div><b>${b}</b> <span>${s}</span></div></div>`;
  const linkOpts = (v) => ['all categories', ...D.categories.map(c => M.catPath(D.pathOf(c.id)))]
    .map(x => `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('');
  function editInst(t, i) {
    const isNew = !i;
    const host = modal(isNew ? `New instance — ${t.name}` : `Edit ${i.name}`, `
      <label class="fld" style="margin-top:0">Name<input id="piName" value="${i ? i.name : ''}" placeholder="e.g. MZK Aleph"></label>
      <label class="fld">Configuration <span class="muted">— one key=value per line</span>
        <textarea id="piCfg" rows="5" class="mono">${i ? i.config.split(' · ').join('\n') : ''}</textarea></label>
      <label class="fld">Linked to<select id="piLink">${linkOpts(i ? i.linked : 'all categories')}</select></label>
      ${D.SCHEDULABLE.includes(t.kind) ? `<p class="fine">When it runs by itself is set on ${can('task.read') ? '<a href="schedules.html">Schedules</a>' : 'Schedules'}, once it exists.</p>` : ''}
      <div class="pj-err" id="piErr"></div>`, FOOT(isNew ? 'Create instance' : 'Save'));
    host.querySelector('[data-ok]').onclick = () => {
      const name = host.querySelector('#piName').value.trim();
      if (!name) { host.querySelector('#piErr').textContent = 'An instance needs a name — it is what runs are listed under.'; return; }
      const x = { name, config: host.querySelector('#piCfg').value.split('\n').map(s => s.trim()).filter(Boolean).join(' · '), linked: host.querySelector('#piLink').value };
      host.remove();
      if (i) Object.assign(i, x);
      else { i = Object.assign({ id: 'pi' + (D.pluginTypes.reduce((a, y) => a + y.instances.length, 0) + 1), by: U.userOf(role), at: '25 Jun 2026', enabled: true,
        schedule: t.kind === 'Input' || t.kind === 'List generator' ? 'on demand' : '', lastRun: 'never' }, x); t.instances.push(i); }
      draw(saved(isNew ? `${name} created.` : `${name} saved.`, isNew ? 'Enabled. It runs from its next trigger.' : 'From its next run.'));
      openInst(i.id);
    };
  }
  function toggle(i) {
    const { t } = instOf(i.id);
    if (!i.enabled) { i.enabled = true; draw(saved(`${i.name} enabled.`, 'It runs from its next trigger.')); return openInst(i.id); }
    const host = modal(`Disable ${i.name}?`, `<p style="margin-top:0">While it is disabled, ${LOSS[t.kind](i, t)}</p>
      <p class="fine">Its configuration and history stay${schedsOf(i).length ? ', and its schedules are skipped rather than deleted' : ''}. Enable it again at any time.</p>`, FOOT('Disable'));
    host.querySelector('[data-ok]').onclick = () => { host.remove(); i.enabled = false; draw(saved(`${i.name} disabled.`, LOSS[t.kind](i, t))); openInst(i.id); };
  }
  function del(i) {
    const { t } = instOf(i.id), ss = schedsOf(i), rs = runsOf(i);
    const host = modal(`Delete ${i.name}?`, `<p style="margin-top:0">It stops for good: ${LOSS[t.kind](i, t)}</p>
      ${ss.length ? `<p>Its ${ss.length} schedule${ss.length > 1 ? 's go' : ' goes'} with it.</p>` : ''}
      <p class="fine">${rs.length ? `Its ${rs.length} run${rs.length > 1 ? 's' : ''} on Tasks stay until retention removes them. ` : ''}What it already wrote — page counts, registry states, proposals — stays in each record's history. To stop it for a while, disable it instead.</p>`,
      FOOT('Delete instance', true));
    host.querySelector('[data-ok]').onclick = () => {
      host.remove(); t.instances.splice(t.instances.indexOf(i), 1);
      ss.forEach(s => D.schedules.splice(D.schedules.indexOf(s), 1));
      close(); draw(saved(`${i.name} deleted.`, `${t.name} has ${t.instances.length} instance${t.instances.length === 1 ? '' : 's'} left.`));
    };
  }
  function upload(t) {
    const host = modal(t ? `New version — ${t.name}` : 'Upload plugin code', `
      <label class="fld" style="margin-top:0">Package<input type="file" id="upFile"></label>
      <p class="fine">${t ? `Currently v${t.version}. The new version's contract is compared with this one before anything switches:
        a renumbered rule code or a removed mapping is shown and has to be accepted — it would silently invalidate approvals made against it.`
        : 'The package declares its type and what it can supply; nothing runs until you create an instance of it.'}</p>`, FOOT('Upload'));
    host.querySelector('[data-ok]').onclick = () => { host.remove(); draw(saved('Uploaded.', 'The demo stops here — the contract comparison is part of the plugin contract, not designed yet.')); };
  }

  /* -------------------------------------------------------------- shell */
  const insts = () => D.pluginTypes.flatMap(t => t.instances);
  const chips = [];
  if (F.kind) chips.push({ k: 'Type', v: F.kind, drop: href({ kind: '' }) });
  if (F.state) chips.push({ k: 'State', v: F.state === 'on' ? 'enabled' : 'disabled', drop: href({ state: '' }) });
  U.mount({ tier, active: 'plugins', role, title: 'Plugins',
    filters: { search: 'Search plugins and instances…', chips,
      options: [['Type', KINDS.map(k => [k, href({ kind: k })])], ['State', [['Enabled', href({ state: 'on' })], ['Disabled', href({ state: 'off' })]]]], available: [] },
    actions: can('plugin.upload_code') ? '<button class="btn btn-primary btn-sm" data-upload="">Upload plugin code…</button>' : '',
    body: '<div id="pl"></div>' });
  function draw(note) {
    const p = document.querySelector('.topbar .titles p') || document.querySelector('.topbar .titles').appendChild(document.createElement('p'));
    const n = insts().length, off = insts().filter(i => !i.enabled).length;
    p.innerHTML = `${new Set(D.pluginTypes.map(t => t.kind)).size} types · ${D.pluginTypes.length} implementations · ${n} instances${off ? ` · ${off} disabled` : ''}`;
    document.getElementById('pl').innerHTML = `${note || ''}${table()}
      <div class="budget">
        <b>Type → implementation → instance.</b> A type is the job (a registry, a harvester); an implementation is the
        code and what it declares it can supply; an instance is a configured copy that runs — <code>MZK Aleph</code>,
        <code>NKP Aleph</code> and <code>VKOL Aleph</code> are three instances of one implementation, which is also how
        more than one library would be served from one VERA.
        <br><b>Four things the rest of the model needs from here:</b> property <b>tiers</b> · registry <b>mappings</b>
        and which count as an existing copy · <b>agent and entry point</b> · <b>when it runs</b> — shown here, scheduled on
        Schedules and only there.
        <br><b>Plugins cannot add columns.</b> A property is offered in a view's column picker, never placed.
        <br>Open: who assigns tiers. A plugin declaring its own lets a badly written one outrank the catalogue;
        per-installation configuration is safer and costs this screen. The contract itself is not designed yet.
      </div>`;
    if (sel) { const [k, id] = sel.split(':'); const row = document.querySelector(k === 'i' ? `tr[data-inst="${id}"]` : `tr[data-impl="${id}"]`); if (row) row.classList.add('tk-sel'); }
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('.modal-scrim')) return;
    if (t.closest('[data-close]')) return close();
    const g = (a) => { const el = t.closest(`[${a}]`); return el ? el.getAttribute(a) : null; };
    if (g('data-newinst') !== null && t.closest('[data-newinst]')) { e.stopPropagation(); return editInst(impl(g('data-newinst')), null); }
    if (t.closest('[data-upload]')) return upload(impl(g('data-upload')));
    if (g('data-run')) { const { i } = instOf(g('data-run'));
      D.tasks.unshift({ id: 'T-99' + (20 + D.tasks.length), instance: i.id, what: i.name + ' — run by hand', trigger: { kind: 'manual', from: 'Plugins', href: 'plugins.html' },
        by: U.userOf(role), state: 'running', started: D.now, total: 100, done: 0, errors: [], eta: 'a few minutes' });
      draw(saved(`${i.name} started.`, can('task.read') ? 'Follow it on <a href="tasks.html">Tasks</a>.' : 'Follow it on My Tasks.')); return openInst(i.id); }
    if (g('data-edit')) return editInst(instOf(g('data-edit')).t, instOf(g('data-edit')).i);
    if (g('data-toggle')) return toggle(instOf(g('data-toggle')).i);
    if (g('data-del')) return del(instOf(g('data-del')).i);
    const k = g('data-kind'); if (k) { collapsed.has(k) ? collapsed.delete(k) : collapsed.add(k); return draw(); }
    if (t.closest('a[href]:not([href="#"])')) return;
    const ins = g('data-inst'); if (ins) { e.preventDefault(); return openInst(ins); }
    const im = g('data-impl'); if (im) { e.preventDefault(); return openImpl(impl(im)); }
  });
  const search = document.querySelector('.filterbar .search');
  if (search) search.oninput = () => { query = search.value.trim().toLowerCase(); draw(); };
  draw();
  if (q.get('i') && instOf(q.get('i')).i) openInst(q.get('i'));
};
