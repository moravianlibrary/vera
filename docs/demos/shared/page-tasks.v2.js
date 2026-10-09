/* Tasks — /tasks  and  Schedules — /schedules   (page-composition §5)
   Two sidebar entries over the same runs (decided with the user 2026-09-26):
     Tasks      /tasks      — what is running, what ran, what it changed,
                              what failed. Running is NOT a tab: it is the
                              top of the same list, so a run that finishes
                              does not vanish from where you were watching.
     Schedules  /schedules  — what will run by itself, and when. The ONLY
                              place a schedule is edited; a plugin instance
                              shows its schedules and links here.
   One script draws both, because they share every helper: PAGE_TASKS(tier,
   'schedules') is the second page.
   A run's detail is docked beside the list, and a sheet on the phone (?run=ID).

   Reach: task.read sees every run; task.read_own sees the runs its holder
   started — the same page under "My Tasks"; Schedules needs task.read. Runs are
   never deleted by hand; they expire under the retention setting.         */

window.PAGE_TASKS = function (tier, page) {
  const M = VERA, D = VERA_DATA, U = VERA_UI;
  const role = U.currentRole('admin');
  const held = U.permsOf(role);
  const can = (p) => held.has(p);
  const q = new URLSearchParams(location.search);
  const ALL = can('task.read');
  const ME = U.userOf(role);
  const SMALL = tier === 'small' || tier === 'phone';
  const FILE = page === 'schedules' ? 'schedules.html' : 'tasks.v2.html';

  /* -------------------------------------------------------------- time */
  const MIN = 6e4, DAY = 864e5;
  const NOW = Date.parse(D.now);
  const pad = (n) => String(n).padStart(2, '0');
  const hm = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const dm = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return +d; };
  const ago = (iso) => {
    const t = Date.parse(iso), m = Math.round((NOW - t) / MIN);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    if (dayStart(t) === dayStart(NOW)) return `today ${hm(t)}`;
    if (dayStart(t) === dayStart(NOW) - DAY) return `yesterday ${hm(t)}`;
    return `${dm(t)} ${hm(t)}`;
  };
  const ahead = (t) => {
    const m = Math.round((t - NOW) / MIN);
    if (m < 60) return `in ${m} min`;
    if (dayStart(t) === dayStart(NOW)) return `today ${hm(t)}`;
    if (dayStart(t) === dayStart(NOW) + DAY) return `tomorrow ${hm(t)}`;
    return `${new Date(t).toLocaleDateString('en-GB', { weekday: 'short' })} ${dm(t)} ${hm(t)}`;
  };
  const dur = (ms) => { const s = Math.round(ms / 1000);
    return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} m ${s % 60} s` : `${Math.floor(s / 3600)} h ${Math.floor(s % 3600 / 60)} m`; };
  const took = (t) => t.finished ? dur(Date.parse(t.finished) - Date.parse(t.started)) : t.state === 'running' ? dur(NOW - Date.parse(t.started)) : '—';

  /* ---------------------------------------------------------- cadences */
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const cadText = (c) => ({
    min:   () => `every ${c.n} min`,
    hour:  () => c.n === 1 ? 'hourly' : `every ${c.n} hours`,
    day:   () => `daily at ${c.at}`,
    week:  () => `weekly, ${DOW[c.day]} ${c.at}`,
    month: () => `monthly, day ${c.day} at ${c.at}`,
    quarter: () => `quarterly, day 1 at ${c.at}`
  })[c.every]();
  /* every occurrence of a cadence in [from, to) */
  function occ(c, from, to) {
    const out = [];
    if (c.every === 'min' || c.every === 'hour') {
      const step = c.n * MIN * (c.every === 'hour' ? 60 : 1), d0 = dayStart(from);
      for (let t = d0 + Math.ceil((from - d0) / step) * step; t < to; t += step) {
        out.push(t);
        if (dayStart(t + step) !== dayStart(t)) t = dayStart(t + step) - step;   /* the grid restarts at midnight */
      }
      return out;
    }
    const [h, m] = c.at.split(':').map(Number);
    for (let d = dayStart(from); d < to; d += DAY) {
      const x = new Date(d); x.setHours(h, m);
      const t = +x, day = new Date(d);
      const hit = c.every === 'day' || (c.every === 'week' && day.getDay() === c.day)
        || (c.every === 'month' && day.getDate() === c.day)
        || (c.every === 'quarter' && day.getDate() === 1 && day.getMonth() % 3 === 0);
      if (hit && t >= from && t < to) out.push(t);
    }
    return out;
  }
  const nextOf = (s) => s.enabled ? occ(s.cadence, NOW + 1, NOW + 100 * DAY)[0] : null;

  /* ------------------------------------------------------------ records */
  const inst = (id) => D.pluginInstances.find(i => i.id === id);
  const who = (id) => id === 'sys' ? 'VERA' : D.byId(id).name;
  const tpl = (id) => D.intentionTemplates.find(t => t.id === id);
  const TPL_CAD = { week: { every: 'week', day: 1, at: '00:00' }, month: { every: 'month', day: 1, at: '00:00' },
                    quarter: { every: 'quarter', at: '00:00' } };
  /* every schedule the Schedule view lists: plugin schedules, and the
     intention repeats (core; their definition stays on Intentions) */
  const schedRows = () => [
    ...D.schedules.map(s => Object.assign({ src: 'plugin' }, s)),
    ...D.intentionTemplates.map(t => ({ id: t.id, src: 'repeat', what: t.name.replace('{period}', 'next period'),
      cadence: TPL_CAD[t.every], enabled: true, overlap: 'skip', by: t.by, since: t.since }))];
  const schedOf = (t) => t.trigger.kind === 'schedule' ? D.schedules.find(s => s.id === t.trigger.schedule)
    : t.trigger.kind === 'repeat' ? schedRows().find(s => s.id === t.trigger.template) : null;
  const lastRun = (s) => D.tasks.filter(t => t.trigger.schedule === s.id || t.trigger.template === s.id)
    .sort((a, b) => Date.parse(b.started) - Date.parse(a.started))[0];

  const mine = (t) => t.by === ME;
  const visible = () => D.tasks.filter(t => ALL || mine(t));
  const stateKey = (t) => t.state === 'done' && t.errors.length ? 'errors' : t.state;
  const STATE = { running: ['Running', 'blue'], done: ['Done', 'green'], errors: ['Done with errors', 'amber'],
                  failed: ['Failed', 'red'], cancelled: ['Cancelled', 'slate'], skipped: ['Skipped', 'slate'] };
  const stateBadge = (t, cls) => { const [l, c] = STATE[stateKey(t)];
    return U.badge(stateKey(t) === 'errors' ? `Done · ${t.errors.length} error${t.errors.length > 1 ? 's' : ''}` : l, c, cls); };
  const pctOf = (t) => t.total ? Math.round(t.done / t.total * 100) : 0;
  const canCancel = (t) => t.state === 'running' && (can('task.cancel') || mine(t));
  const canRerun = (t) => ['failed', 'cancelled'].includes(t.state) && t.instance && (can('plugin.run') || mine(t));

  const trigText = (t, short) => {
    const g = t.trigger;
    if (g.kind === 'schedule') { const s = schedOf(t);
      return short ? 'Schedule' : `Schedule <span class="muted">· ${cadText(s.cadence)}</span>`; }
    if (g.kind === 'repeat') return short ? 'Intention repeat' : `Intention repeat <span class="muted">· ${tpl(g.template).name.replace('{period}', '…')}</span>`;
    /* ingest starts on its own when a proposal is approved — never by hand */
    if (g.kind === 'approval') return short ? 'On approval' : `On approval <span class="muted">· ${who(t.by)} approved it</span>`;
    return short ? who(t.by) : `${who(t.by)} <span class="muted">· from ${g.from}</span>`;
  };
  const trigCell = (t) => {
    const g = t.trigger;
    if (g.kind === 'schedule') return `Schedule<div class="t-sub">${cadText(schedOf(t).cadence)}</div>`;
    if (g.kind === 'repeat') return `Intention repeat<div class="t-sub">${cadText(TPL_CAD[tpl(g.template).every])}</div>`;
    if (g.kind === 'approval') return `On approval<div class="t-sub">${who(t.by)} approved it</div>`;
    return `${who(t.by)}<div class="t-sub">from ${g.from}</div>`;
  };
  const source = (t) => t.instance ? inst(t.instance).name : t.core;
  const changedHTML = (t) => (t.changed || []).map(c => `<a href="${c.href}">${c.text}</a>`).join(' · ');
  const resultCell = (t) => {
    const k = stateKey(t);
    if (k === 'failed') return `<span class="muted">nothing changed</span>`;
    if (k === 'skipped') return `<span class="muted">did not run</span>`;
    if (k === 'cancelled') return `<span class="muted">${M.fmt(t.done)} of ${M.fmt(t.total)} processed</span>`;
    return changedHTML(t) || `<span class="muted">nothing changed</span>`;
  };

  /* ------------------------------------------------------------ filters */
  const F = { state: q.get('state') || '', trigger: q.get('trigger') || '', inst: q.get('inst') || '',
    by: ALL ? q.get('by') || '' : '', started: q.get('started') || '', search: (q.get('q') || '').toLowerCase() };
  const href = (patch) => { const x = new URLSearchParams(q); x.delete('run');
    Object.entries(patch).forEach(([k, v]) => v ? x.set(k, v) : x.delete(k));
    return 'tasks.v2.html' + (x.toString() ? '?' + x : ''); };
  const TRIG = { schedule: 'Schedule', approval: 'On approval', manual: 'Started by a person', repeat: 'Intention repeat' };
  const matchesOther = (t) => (!F.trigger || t.trigger.kind === F.trigger)
    && (!F.inst || t.instance === F.inst) && (!F.by || t.by === F.by)
    && (!F.search || `${t.what} ${t.id} ${source(t)}`.toLowerCase().includes(F.search))
    && (!F.started || NOW - Date.parse(t.started) <= (F.started === 'today' ? NOW - dayStart(NOW) : F.started === '7d' ? 7 * DAY : 30 * DAY));
  const filtered = () => visible().filter(t => t.state !== 'running'
    && (!F.state || stateKey(t) === F.state) && matchesOther(t))
    .sort((a, b) => Date.parse(b.started) - Date.parse(a.started));

  function filterBar() {
    const chips = [];
    if (F.state) chips.push({ k: 'State', v: STATE[F.state][0], drop: href({ state: '' }) });
    if (F.trigger) chips.push({ k: 'Trigger', v: TRIG[F.trigger], drop: href({ trigger: '' }) });
    if (F.inst) chips.push({ k: 'Plugin', v: inst(F.inst).name, drop: href({ inst: '' }) });
    if (F.by) chips.push({ k: 'Started by', v: who(F.by), drop: href({ by: '' }) });
    if (F.started) chips.push({ k: 'Started', v: { today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days' }[F.started], drop: href({ started: '' }) });
    const insts = [...new Set(visible().map(t => t.instance).filter(Boolean))];
    const bys = [...new Set(visible().map(t => t.by))];
    const options = [
      ['State', Object.entries(STATE).filter(([k]) => k !== 'running').map(([k, [l]]) => [l, href({ state: k })])],
      ['Trigger', Object.entries(TRIG).map(([k, l]) => [l, href({ trigger: k })])],
      ['Plugin', insts.map(i => [inst(i).name, href({ inst: i })])],
      ...(ALL ? [['Started by', bys.map(b => [who(b), href({ by: b })])]] : []),
      ['Started', [['Today', href({ started: 'today' })], ['Last 7 days', href({ started: '7d' })], ['Last 30 days', href({ started: '30d' })]]]];
    return { search: 'Search runs…', query: q.get('q') || '', chips, options, available: [],
      watch: { view: ALL ? 'Tasks' : 'My Tasks', file: 'tasks.v2.html' + location.search, n: filtered().length } };
  }

  /* --------------------------------------------------------------- runs */
  function runCard(t) {
    return `<div class="tk-run" data-run="${t.id}">
      <div class="tk-run-head"><div><b>${t.what}</b>
        <div class="t-sub">${trigText(t)} · started ${ago(t.started)}</div></div>
        <div class="tk-run-acts">${canCancel(t) ? `<button class="btn btn-sm" data-cancel="${t.id}">Cancel…</button>` : ''}</div></div>
      <div class="meter tk-meter"><i style="width:${pctOf(t)}%"></i></div>
      <div class="tk-run-foot"><span><b>${M.fmt(t.done)}</b> / ${M.fmt(t.total)} · ${pctOf(t)}%${t.errors.length
        ? ` · <span class="tk-err">${t.errors.length} error${t.errors.length > 1 ? 's' : ''} so far</span>` : ''}</span>
        <span class="muted">${t.eta} left</span></div>
    </div>`;
  }
  function historyTable(list) {
    if (tier === 'phone') return `<div class="tk-cards">${list.map(t => `<div class="tk-card" data-run="${t.id}">
        <div class="tk-card-top"><b>${t.what}</b>${stateBadge(t, 'badge-xs')}</div>
        <div class="t-sub">${trigText(t, true)} · ${ago(t.started)}</div>
        <div class="tk-card-res">${t.fatal ? `<span class="tk-err">${t.fatal}</span>` : resultCell(t)}</div></div>`).join('')}</div>`;
    const cols = tier === 'large' ? ['what', 'trigger', 'started', 'result']
      : tier === 'notebook' ? ['what', 'started', 'result'] : ['what', 'result'];
    const head = { what: 'What', plugin: 'Plugin', trigger: 'Trigger', started: 'Started', took: 'Took', state: 'State', result: 'Result' };
    const rows = list.map(t => {
      const cell = {
        what: `<div class="t-title">${t.what}</div><div class="t-sub"><span class="mono">${t.id}</span>${
          tier === 'large' ? '' : ' · ' + source(t)}${SMALL ? ` · ${trigText(t, true)} · ${ago(t.started)}` : ''}</div>`,
        plugin: source(t),
        trigger: trigCell(t),
        started: ago(t.started),
        took: took(t),
        state: stateBadge(t, 'badge-xs'),
        result: `${stateBadge(t, 'badge-xs')} ${resultCell(t)}`
      };
      const note = t.fatal ? `<tr class="note-row"><td colspan="${cols.length}">
        <div class="status-note status-note-red"><span>&#9660;</span>
        <div><b>Failed:</b> <span>${t.fatal}</span></div>${canRerun(t) ? `<button class="btn btn-sm tk-note-btn" data-rerun="${t.id}">Run again</button>` : ''}</div></td></tr>` : '';
      return `<tr class="data-row" data-run="${t.id}">${cols.map(k => `<td class="cell ${k === 'took' ? 'tk-num' : ''}">${cell[k]}</td>`).join('')}</tr>${note}`;
    }).join('');
    return `<div class="card"><table class="tk-table">
      <thead><tr>${cols.map(k => `<th class="col">${head[k]}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }
  function tiles() {
    const runs = visible();
    const run = runs.filter(t => t.state === 'running');
    const week = runs.filter(t => t.state !== 'running' && NOW - Date.parse(t.started) < 7 * DAY);
    const failed = week.filter(t => t.state === 'failed');
    const lastFail = runs.filter(t => t.state === 'failed').sort((a, b) => Date.parse(b.started) - Date.parse(a.started))[0];
    const withErr = week.filter(t => stateKey(t) === 'errors').length;
    const list = [
      { label: 'Running', value: run.length, foot: run.length ? run.map(t => t.what.split(' — ')[0]).join(', ') : 'nothing right now' },
      { label: 'Failed · last 7 days', value: failed.length,
        foot: (withErr ? `${withErr} finished with errors · ` : '') + (lastFail ? `last failure ${dm(Date.parse(lastFail.started))}` : 'none on record') }];
    if (ALL) {
      const n = D.schedules.map(s => ({ s, t: nextOf(s) })).filter(x => x.t).sort((a, b) => a.t - b.t)[0];
      list.push({ label: 'Next run', value: ahead(n.t).replace('in ', ''), foot: n.s.what });
    } else list.push({ label: 'Finished · last 7 days', value: week.filter(t => t.state === 'done').length, foot: 'started by you' });
    if (tier === 'phone') return `<div class="in-tile tk-ptile">${list.map(x => `<b>${x.value}</b> ${x.label.toLowerCase().replace(' · ', ' in ')}`).join(' · ')}</div>`;
    return U.stats(list);
  }
  function runsView() {
    const running = visible().filter(t => t.state === 'running' && matchesOther(t));
    const hist = filtered();
    const anyFilter = F.state || F.trigger || F.inst || F.by || F.started || F.search;
    if (!visible().length) return `${tiles()}<div class="pane-empty tk-empty">Nothing you started has run yet.
      Re-checks, generated lists and ingests you start show up here while they run, and after.</div>`;
    return `${tiles()}
      ${running.length && !F.state ? `<div class="in-sep">Running</div><div class="tk-runs">${running.map(runCard).join('')}</div>` : ''}
      <div class="in-sep">${anyFilter ? 'Matching runs' : 'Finished'} <span class="muted">· ${hist.length}</span></div>
      ${hist.length ? historyTable(hist) : '<p class="fine">No finished run matches these filters.</p>'}
      <p class="fine tk-ret">Runs are kept for <b>${D.taskRetention.days} days</b>, failed and cancelled ones for
        <b>${D.taskRetention.failedDays === 365 ? 'a year' : D.taskRetention.failedDays + ' days'}</b> — nobody deletes them by hand: this is the record of what changed the data.
        ${can('task.schedule') ? '<a href="#" data-retention>Change…</a>' : ''}</p>`;
  }

  /* ----------------------------------------------------------- schedule */
  function timeline() {
    const range = ['7d', '30d'].includes(q.get('range')) ? q.get('range') : '24h';
    const wk = range !== '24h', mo = range === '30d';
    const span = mo ? 30 * DAY : wk ? 7 * DAY : DAY, from = NOW, to = NOW + span;
    const x = (t) => ((t - from) / span * 100).toFixed(2);
    const axis = [];
    if (mo) { const step = tier === 'phone' ? 10 : 5;
      for (let d = dayStart(from) + DAY, k = 1; d < to; d += DAY, k++)
        if (k % step === 0) axis.push(`<span style="left:${x(d)}%">${dm(d)}</span>`); }
    else if (wk) for (let d = dayStart(from) + DAY; d < to; d += DAY)
      axis.push(`<span style="left:${x(d)}%">${new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</span>`);
    else { const st = tier === 'phone' ? 6 : 3;
      for (let d = dayStart(from) + 3600e3 * (Math.floor(new Date(from).getHours() / st) * st + st); d < to; d += st * 3600e3)
        if (x(d) > (tier === 'phone' ? 22 : 9)) axis.push(`<span style="left:${x(d)}%">${hm(d)}</span>`); }
    const lanes = schedRows().map(s => {
      const pts = s.enabled ? occ(s.cadence, from, to) : [];
      const dense = pts.length > (tier === 'phone' ? 24 : mo ? 40 : wk ? 28 : 48);
      const body = !s.enabled ? `<div class="tk-band tk-paused">paused</div>`
        : dense ? `<div class="tk-band" title="${cadText(s.cadence)}">${cadText(s.cadence)}</div>`
        : pts.map(t => `<i class="tk-dot ${s.src === 'repeat' ? 'tk-dot-r' : ''}" style="left:${x(t)}%" title="${ahead(t)}"></i>`).join('')
          || `<span class="tk-none">next ${ahead(nextOf(s))}</span>`;
      return `<div class="tk-lane-name" title="${s.what}">${s.what.split(' — ')[0]}</div><div class="tk-lane">${body}</div>`;
    }).join('');
    return `<section class="pcard tk-tl">
      <div class="pcard-head"><h3>${mo ? 'Next 30 days' : wk ? 'Next 7 days' : 'Next 24 hours'}</h3><span class="right">
        <span class="viewtabs tk-range">${[['', '24 h'], ['7d', '7 days'], ['30d', 'Month']].map(([k, l]) =>
          `<a href="${hrefS({ range: k })}" class="${(k || '24h') === range ? 'current' : ''}">${l}</a>`).join('')}</span></span></div>
      <div class="tk-grid"><div></div><div class="tk-axis"><span class="tk-nowlbl" style="left:0">now ${hm(NOW)}</span>${axis.join('')}</div>${lanes}</div>
      <p class="fine">A dot is one run. A lane that runs more often than it can show is drawn as a band.</p></section>`;
  }
  const hrefS = (patch) => { const x = new URLSearchParams(q);
    Object.entries(patch).forEach(([k, v]) => v ? x.set(k, v) : x.delete(k)); return 'schedules.html' + (x.toString() ? '?' + x : ''); };

  function scheduleView() {
    const rows = schedRows();
    const cols = SMALL ? ['what', 'next', 'act'] : tier === 'large' ? ['what', 'plugin', 'cadence', 'overlap', 'last', 'next', 'act'] : ['what', 'cadence', 'last', 'next', 'act'];
    const head = { what: 'What', plugin: 'Plugin', cadence: 'Runs', overlap: 'If still running', last: 'Last run', next: 'Next', act: '' };
    const cards = [];
    const body = rows.map(s => {
      const l = lastRun(s), n = nextOf(s), i = s.src === 'plugin' ? inst(s.instance) : null;
      const acts = s.src === 'repeat'
        ? `<a class="btn btn-sm" href="intentions.html?t=${s.id}">Edit on Intentions</a>`
        : [can('plugin.run') ? `<button class="btn btn-sm" data-now="${s.id}">Run now</button>` : '',
           can('task.schedule') ? (s.enabled ? `<button class="btn btn-sm" data-pause="${s.id}">Pause…</button>`
                                             : `<button class="btn btn-sm" data-resume="${s.id}">Resume</button>`) : '',
           can('task.schedule') ? `<button class="btn btn-sm" data-sched="${s.id}">Edit</button>` : ''].join('');
      const cell = {
        what: `<div class="t-title">${s.what}</div><div class="t-sub">${s.src === 'repeat' ? 'Intention repeat · makes the next occurrence'
          : `<a href="plugins.html?i=${i.id}" class="tk-sub-a">${i.name}</a>${tier === 'large' ? '' : ' · ' + i.type.name}`}${SMALL ? ' · ' + cadText(s.cadence) : ''}</div>`,
        plugin: i ? i.type.name : 'core',
        cadence: cadText(s.cadence) + (tier === 'large' ? '' : `<div class="t-sub">${s.overlap === 'skip' ? 'skips an overlapping run' : 'waits for the previous run'}</div>`),
        overlap: s.overlap === 'skip' ? 'skip this run' : 'wait, then run',
        last: l ? `<a href="tasks.v2.html?run=${l.id}" data-run="${l.id}" class="tk-sub-a">${stateBadge(l, 'badge-xs')}</a> <span class="muted">${ago(l.started)}</span>` : '<span class="muted">—</span>',
        next: n ? ahead(n) : `<span class="muted">paused</span>`,
        act: `<div class="tk-acts">${acts}</div>`
      };
      const note = s.paused && !s.enabled ? `<tr class="note-row"><td colspan="${cols.length}"><div class="status-note status-note-slate"><span>&#9660;</span>
        <div><b>Paused</b> <span>by ${who(s.paused.by)} on ${s.paused.at}${s.paused.why ? ' — ' + s.paused.why : ''}</span></div></div></td></tr>` : '';
      cards.push(`<div class="tk-card tk-scard ${q.get('s') === s.id ? 'tk-sel' : ''}" id="${tier === 'phone' ? 'sch-' + s.id : ''}">
        <div class="tk-card-top"><b>${s.what}</b><span class="tk-num">${n ? ahead(n) : '<span class="muted">paused</span>'}</span></div>
        <div class="t-sub">${cadText(s.cadence)}${l ? ` · last ${ago(l.started)}` : ''}</div>
        ${s.paused && !s.enabled ? `<div class="tk-card-res muted">Paused by ${who(s.paused.by)} — ${s.paused.why}</div>` : ''}
        <div class="tk-acts tk-cacts">${acts}</div></div>`);
      return `<tr class="data-row ${q.get('s') === s.id ? 'tk-hit' : ''}" id="${tier === 'phone' ? '' : 'sch-' + s.id}">${cols.map(k => `<td class="cell ${k === 'act' ? 'tk-actcell' : ''}">${cell[k]}</td>`).join('')}</tr>${note}`;
    }).join('');
    const list = tier === 'phone' ? `<div class="tk-cards">${cards.join('')}</div>`
      : `<div class="card"><table class="tk-table"><thead><tr>${cols.map(k => `<th class="col">${head[k]}</th>`).join('')}</tr></thead>
        <tbody>${body}</tbody></table></div>`;
    return `${timeline()}
      <div class="in-sep">Schedules <span class="muted">· ${rows.length}</span></div>
      ${list}
      <p class="fine">A schedule is set here and only here — a plugin instance shows its schedules and links back.
        Inputs and list generators have none: they run when somebody uses them. Intention repeats are listed so
        everything that happens by itself is in one place; what they make is defined on Intentions.</p>`;
  }

  /* ------------------------------------------------------------- detail */
  const panel = U.detail(page === 'schedules' || tier === 'phone' ? 'drawer' : 'large', '');
  panel.classList.add('tk-detail');
  const emptyRun = '<div class="pane-empty">Select a run to see its details.</div>';
  panel.innerHTML = emptyRun;
  let itemsTab = 'all';
  function itemsOf(t) {
    const errs = t.errors.map(e => ({ ref: e.ref, ok: false, msg: e.msg }));
    const pool = D.iterations.filter(it => !t.errors.some(e => e.ref === it.id));
    const oks = t.done > errs.length ? pool.slice(0, Math.min(6, t.done - errs.length)).map(it => ({ ref: it.id, ok: true })) : [];
    return itemsTab === 'errors' ? errs : [...errs, ...oks];
  }
  const itemRow = (x) => { const it = D.iterations.find(i => i.id === x.ref); const d = it && D.doc(it.doc);
    return `<div class="row-kv tk-item"><span><span class="mono">${x.ref}</span> ${d ? d.title : ''}${x.msg ? `<br><span class="tk-err">${x.msg}</span>` : ''}</span>
      <span>${x.ok ? U.badge('ok', 'green', 'badge-xs') : U.badge('error', 'red', 'badge-xs')}</span></div>`; };
  function logOf(t) {
    const L = [], at = (off) => hm(Date.parse(t.started) + off) + ':' + pad(Math.floor(off / 1000) % 60);
    L.push(`[${at(0)}] ${t.id} started — ${t.what} (${t.trigger.kind === 'schedule' ? 'schedule ' + t.trigger.schedule
      : t.trigger.kind === 'repeat' ? 'intention repeat ' + t.trigger.template : t.trigger.kind === 'approval' ? 'on approval by ' + who(t.by) : 'by ' + who(t.by)})`);
    if (t.state === 'skipped') { L.push(`[${at(0)}] skipped — ${t.note}`); return L.join('\n'); }
    t.errors.forEach((e, k) => L.push(`[${at(2000 + k * 4000)}] ${e.ref} <span class="tk-log-err">${e.msg}</span>`));
    if (t.fatal) L.push(`[${at(90000)}] <span class="tk-log-err">${t.fatal}</span>`);
    if (t.done) L.push(`[${at(4000)}] ${M.fmt(t.done)} of ${M.fmt(t.total)} processed`);
    (t.changed || []).forEach(c => L.push(`[${at(5000)}] changed: ${c.text}`));
    if (t.state === 'cancelled') L.push(`[${at(65000)}] cancelled by ${who(t.cancelledBy)}`);
    if (t.finished) L.push(`[${hm(Date.parse(t.finished))}:${t.finished.slice(-2)}] finished — ${STATE[stateKey(t)][0].toLowerCase()}`);
    else L.push(`[${hm(NOW)}:00] … running`);
    return L.join('\n');
  }
  function openRun(id) {
    const t = D.tasks.find(x => x.id === id);
    if (!t || !(ALL || mine(t))) return;
    const s = schedOf(t), i = t.instance && inst(t.instance);
    const trig = t.trigger.kind === 'schedule'
      ? `Schedule — ${cadText(s.cadence)}${ALL ? ` · <a href="schedules.html?s=${s.id}">see it</a>` : ''}`
      : t.trigger.kind === 'repeat' ? `Intention repeat — <a href="intentions.html?t=${t.trigger.template}">${tpl(t.trigger.template).name}</a>`
      : t.trigger.kind === 'approval' ? `On approval — ${who(t.by)} approved it in <a href="${t.trigger.href}">${t.trigger.from}</a>; ingest is never started by hand`
      : `${who(t.by)}, from <a href="${t.trigger.href}">${t.trigger.from}</a>`;
    const items = itemsOf(t);
    panel.innerHTML = `
      <div class="detail-head">
        <div><h2>${t.what}</h2><div class="t-sub"><span class="mono">${t.id}</span> · ${source(t)}</div></div>
        <button class="icon-btn" style="margin-left:auto" data-close>&times;</button>
      </div>
      <div class="detail-body">
        <div class="tk-dstate">${stateBadge(t)}${t.state === 'running' ? ` <span class="muted">${t.eta} left</span>` : ''}</div>
        ${t.state === 'running' || t.state === 'cancelled' ? `<div class="meter tk-meter"><i style="width:${pctOf(t)}%"></i></div>` : ''}
        ${t.fatal ? `<div class="status-note status-note-red"><span>&#9660;</span><div><b>Failed:</b> <span>${t.fatal}</span></div></div>` : ''}
        ${t.note ? `<div class="status-note status-note-slate"><span>&#9660;</span><div><span>${t.note}</span></div></div>` : ''}
        <h3>Run</h3>
        <dl class="kv">
          <dt>Plugin</dt><dd>${i ? `${can('plugin.read') ? `<a href="plugins.html?i=${i.id}">${i.name}</a>` : i.name} <span class="muted">· ${i.type.name}</span>` : `${t.core} <span class="muted">· core</span>`}</dd>
          <dt>Trigger</dt><dd>${trig}</dd>
          <dt>Started</dt><dd>${dm(Date.parse(t.started))} ${hm(Date.parse(t.started))} <span class="muted">· ${ago(t.started)}</span></dd>
          <dt>${t.finished ? 'Took' : 'Running for'}</dt><dd>${took(t)}</dd>
          ${t.total ? `<dt>Items</dt><dd>${M.fmt(t.done)} / ${M.fmt(t.total)}${t.errors.length ? ` · <span class="tk-err">${t.errors.length} with errors</span>` : ''}</dd>` : ''}
        </dl>
        <h3>What it changed</h3>
        ${t.changed ? `<ul class="tk-changed">${t.changed.map(c => `<li><a href="${c.href}">${c.text}</a></li>`).join('')}</ul>`
          : `<p class="fine" style="margin-top:0">${t.state === 'running' ? 'Shown when it finishes.' : t.state === 'done'
            ? 'Nothing — a run that confirms what VERA already knew writes nothing.' : 'Nothing.'}</p>`}
        ${t.total > 1 ? `<h3>Items</h3>
          <div class="viewtabs tk-itabs"><a href="#" data-items="all" class="${itemsTab === 'all' ? 'current' : ''}">All</a><a href="#" data-items="errors" class="${itemsTab === 'errors' ? 'current' : ''}">Errors · ${t.errors.length}</a></div>
          ${items.map(itemRow).join('') || '<p class="fine">No errors.</p>'}
          <p class="fine">Showing ${items.length} of ${itemsTab === 'errors' ? t.errors.length : M.fmt(t.done)}.</p>` : ''}
        <h3>Log</h3>
        <pre class="code tk-log">${logOf(t)}</pre>
        <div class="tk-dacts">
          ${canCancel(t) ? `<button class="btn btn-sm" data-cancel="${t.id}">Cancel…</button>` : ''}
          ${canRerun(t) ? `<button class="btn btn-primary btn-sm" data-rerun="${t.id}">Run again</button>` : ''}
          <button class="btn btn-sm">Download log</button>
        </div>
      </div>`;
    panel.classList.add('open');
    panel.dataset.run = id;
    q.set('run', id); history.replaceState(null, '', FILE + '?' + q);
    document.querySelectorAll('[data-run].tk-sel').forEach(x => x.classList.remove('tk-sel'));
    document.querySelectorAll(`.tk-run[data-run="${id}"], tr[data-run="${id}"], .tk-card[data-run="${id}"]`).forEach(x => x.classList.add('tk-sel'));
  }
  function closeRun() {
    panel.classList.remove('open'); panel.innerHTML = emptyRun; delete panel.dataset.run;
    q.delete('run'); history.replaceState(null, '', FILE + (q.toString() ? '?' + q : ''));
    document.querySelectorAll('.tk-sel').forEach(x => x.classList.remove('tk-sel'));
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
  const saved = (b, s, tone) => `<div class="status-note status-note-${tone || 'green'} pj-saved"><span>&#9660;</span><div><b>${b}</b> <span>${s}</span></div></div>`;
  let seq = 9917;
  const newRun = (from, extra) => Object.assign({ id: 'T-' + seq++, state: 'running', started: D.now, by: ME,
    trigger: { kind: 'manual', from: 'Tasks', href: 'tasks.v2.html' }, done: 0, errors: [], eta: 'a few minutes' }, from, extra);

  function cancel(t) {
    const s = schedOf(t), n = s && nextOf(s);
    const host = modal(`Cancel ${t.id}?`, `
      <p style="margin-top:0"><b>${t.what}</b> — ${M.fmt(t.done)} of ${M.fmt(t.total)} processed.</p>
      <p>It stops after the item it is on. What it already changed stays; the other
        <b>${M.fmt(t.total - t.done)}</b> are not processed.${n ? ` Its schedule runs again ${ahead(n)}.` : ''}</p>
      ${!mine(t) ? `<p class="fine">Started by ${who(t.by)} — they see it as cancelled by you.</p>` : ''}`,
      `<button class="btn foot-left" data-x>Keep running</button><button class="btn btn-danger" data-ok>Cancel the run</button>`);
    host.querySelector('[data-ok]').onclick = () => {
      host.remove();
      Object.assign(t, { state: 'cancelled', finished: D.now + ':00', cancelledBy: ME,
        note: `Stopped after ${M.fmt(t.done)} of ${M.fmt(t.total)} — what it had already done stays.` });
      draw(saved(`Cancelled ${t.id}.`, `${M.fmt(t.done)} of ${M.fmt(t.total)} processed.`));
      openRun(t.id);
    };
  }
  function rerun(t) {
    const r = newRun({ instance: t.instance, what: t.what, total: t.total }, { rerunOf: t.id,
      trigger: { kind: 'manual', from: 'Tasks', href: `tasks.v2.html?run=${t.id}` } });
    D.tasks.unshift(r);
    draw(saved(`Started ${r.id}.`, `Running ${t.what} again — ${t.id} stays as it was.`));
    openRun(r.id);
  }

  const cadFields = (c) => `
    <div class="tk-cadrow">
      <label class="fld">Repeat<select id="scEvery">${[['min', 'Every N minutes'], ['hour', 'Every N hours'], ['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']]
        .map(([k, l]) => `<option value="${k}" ${c.every === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="fld" id="scNWrap">Every<input type="number" min="1" id="scN" value="${c.n || 15}"></label>
      <label class="fld" id="scDayWrap">On<select id="scDay"></select></label>
      <label class="fld" id="scAtWrap">At<input type="time" id="scAt" value="${c.at || '02:00'}"></label>
    </div>`;
  function editSchedule(s) {
    const isNew = !s;
    const v = s || { what: '', cadence: { every: 'day', at: '02:00' }, overlap: 'skip', enabled: true };
    const opts = D.pluginTypes.filter(t => D.SCHEDULABLE.includes(t.kind)).map(t => `<optgroup label="${t.name} · ${t.kind}">${
      t.instances.map(i => `<option value="${i.id}">${i.name}</option>`).join('')}</optgroup>`).join('');
    const host = modal(isNew ? 'New schedule' : `Edit schedule — ${s.what}`, `
      ${isNew ? `<label class="fld" style="margin-top:0">Plugin instance<select id="scInst">${opts}</select></label>`
        : `<p style="margin-top:0" class="muted">Runs <b style="color:var(--foreground)">${inst(s.instance).name}</b> · ${inst(s.instance).type.name}</p>`}
      <label class="fld">Name<input id="scName" value="${v.what}" placeholder="e.g. MZK Aleph — catalog resync"></label>
      ${cadFields(v.cadence)}
      <div class="fld">If the previous run is still going
        <label class="line in-line"><input type="radio" name="scOv" value="skip" ${v.overlap === 'skip' ? 'checked' : ''}>
          <span>Skip this run <span class="muted">— the next one catches up; right for refreshes</span></span></label>
        <label class="line in-line"><input type="radio" name="scOv" value="queue" ${v.overlap === 'queue' ? 'checked' : ''}>
          <span>Wait, then run <span class="muted">— never miss one; right for sweeps</span></span></label></div>
      <div class="fld">Next runs <div class="tk-prev" id="scPrev"></div></div>
      <div class="pj-err" id="scErr"></div>`,
      `${isNew ? '' : '<button class="btn btn-danger foot-left" data-del>Delete schedule…</button>'}<button class="btn ${isNew ? 'foot-left' : ''}" data-x>Cancel</button><button class="btn btn-primary" data-ok>${isNew ? 'Create schedule' : 'Save'}</button>`);
    const $ = (id) => host.querySelector('#' + id);
    const read = () => { const e = $('scEvery').value;
      return e === 'min' || e === 'hour' ? { every: e, n: Math.max(1, +$('scN').value || 1) }
        : e === 'day' ? { every: e, at: $('scAt').value } : { every: e, day: +$('scDay').value, at: $('scAt').value }; };
    const sync = () => {
      const e = $('scEvery').value;
      $('scNWrap').style.display = e === 'min' || e === 'hour' ? '' : 'none';
      $('scAtWrap').style.display = e === 'min' || e === 'hour' ? 'none' : '';
      $('scDayWrap').style.display = e === 'week' || e === 'month' ? '' : 'none';
      const cur = +$('scDay').value || v.cadence.day || 1;
      $('scDay').innerHTML = e === 'week' ? [1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}" ${cur === d ? 'selected' : ''}>${DOW[d]}</option>`).join('')
        : Array.from({ length: 28 }, (_, k) => `<option value="${k + 1}" ${cur === k + 1 ? 'selected' : ''}>day ${k + 1}</option>`).join('');
      const c = read();
      $('scPrev').innerHTML = occ(c, NOW + 1, NOW + 100 * DAY).slice(0, 3).map(ahead).join(' · ') + ` <span class="muted">— ${cadText(c)}</span>`;
    };
    ['scEvery', 'scN', 'scDay', 'scAt'].forEach(id => $(id).oninput = sync);
    if (isNew) $('scInst').onchange = () => { if (!$('scName').dataset.touched) $('scName').value = inst($('scInst').value).name + ' — '; };
    $('scName').oninput = () => { $('scName').dataset.touched = 1; };
    sync();
    host.querySelector('[data-ok]').onclick = () => {
      const x = { what: $('scName').value.trim().replace(/ — $/, ''), cadence: read(), overlap: host.querySelector('[name=scOv]:checked').value };
      if (!x.what) { $('scErr').textContent = 'Give it a name — it is what a run is listed under.'; return; }
      if (x.cadence.every === 'min' && x.cadence.n < 5) { $('scErr').textContent = 'Every 5 minutes is the shortest — anything faster should be an event, not a schedule.'; return; }
      host.remove();
      let id;
      if (s) { Object.assign(s, x); id = s.id; }
      else { id = 's' + (D.schedules.length + 1); D.schedules.push(Object.assign({ id, instance: $('scInst').value, enabled: true, by: ME, since: dm(NOW) + ' 2026' }, x)); }
      q.set('s', id);
      draw(saved(isNew ? 'Schedule created.' : 'Schedule saved.', `${x.what} — next run ${ahead(nextOf(D.schedules.find(y => y.id === id)))}.`));
    };
    const del = host.querySelector('[data-del]');
    if (del) del.onclick = () => {
      host.remove();
      const runs = D.tasks.filter(t => t.trigger.schedule === s.id).length;
      const h2 = modal(`Delete ${s.what}?`, `<p style="margin-top:0">${inst(s.instance).name} stops running by itself. It can still be run by hand.</p>
        <p class="fine">Its ${runs} run${runs === 1 ? '' : 's'} on record stay, under retention like any other. To stop it for a while, pause it instead.</p>`,
        `<button class="btn foot-left" data-x>Cancel</button><button class="btn btn-danger" data-ok>Delete schedule</button>`);
      h2.querySelector('[data-ok]').onclick = () => { h2.remove(); D.schedules.splice(D.schedules.indexOf(s), 1); draw(saved('Schedule deleted.', `${s.what} runs only by hand now.`)); };
    };
  }
  function pause(s) {
    const host = modal(`Pause ${s.what}?`, `
      <p style="margin-top:0">It stops running by itself until somebody resumes it. A run in progress finishes.</p>
      <label class="fld">Why <span class="muted">— shown on the schedule, so nobody resumes it too early</span>
        <input id="paWhy" placeholder="e.g. catalog migration until 1 July"></label>`,
      `<button class="btn foot-left" data-x>Cancel</button><button class="btn btn-primary" data-ok>Pause</button>`);
    host.querySelector('[data-ok]').onclick = () => {
      host.remove();
      Object.assign(s, { enabled: false, paused: { by: ME, at: dm(NOW) + ' 2026', why: host.querySelector('#paWhy').value.trim() } });
      q.set('s', s.id); draw(saved(`Paused ${s.what}.`, 'Resume it from the same row.'));
    };
  }
  function runNow(s) {
    const i = inst(s.instance);
    const r = newRun({ instance: s.instance, what: s.what, total: (lastRun(s) || {}).total || 100 });
    D.tasks.unshift(r);
    draw(saved(`Started ${r.id}.`, `${s.what}, by hand — its schedule is unchanged.`));
    const n = document.querySelector('.pj-saved div');
    if (n) n.insertAdjacentHTML('beforeend', ` <a href="#" data-run="${r.id}">Open the run</a>`);
    void i;
  }
  function retention() {
    const r = D.taskRetention;
    const host = modal('Keep runs for', `
      <div class="fld-row" style="margin-top:0">
        <label class="fld" style="margin-top:0">Runs, days<input type="number" min="7" id="rtD" value="${r.days}"></label>
        <label class="fld" style="margin-top:0">Failed and cancelled, days<input type="number" min="7" id="rtF" value="${r.failedDays}"></label></div>
      <p class="fine">A run older than this is removed with its log and items. What it changed stays in each
        record's own history — only the account of the run goes.</p>`,
      `<button class="btn foot-left" data-x>Cancel</button><button class="btn btn-primary" data-ok>Save</button>`);
    host.querySelector('[data-ok]').onclick = () => {
      r.days = Math.max(7, +host.querySelector('#rtD').value || r.days);
      r.failedDays = Math.max(r.days, +host.querySelector('#rtF').value || r.failedDays);
      host.remove(); draw(saved('Retention saved.', `Runs ${r.days} days, failed and cancelled ${r.failedDays} days.`));
    };
  }

  /* -------------------------------------------------------------- shell */
  const view = page === 'schedules' && ALL ? 'schedule' : 'runs';
  if (page === 'schedules' && !ALL) { location.replace('tasks.v2.html'); return; }
  U.mount({ tier, active: view === 'schedule' ? 'schedules' : 'tasks', role,
    title: view === 'schedule' ? 'Schedules' : ALL ? 'Tasks' : 'My Tasks',
    filters: view === 'runs' && visible().length ? filterBar() : null,
    body: '<div id="tk"></div>' });
  document.getElementById('app').appendChild(panel);
  function draw(note) {
    const bar = document.querySelector('.topbar');
    const run = visible().filter(t => t.state === 'running').length;
    let p = bar.querySelector('.titles p');
    if (!p) { p = document.createElement('p'); bar.querySelector('.titles').appendChild(p); }
    const act = D.schedules.filter(s => s.enabled).length;
    p.innerHTML = view === 'schedule' ? `${act} active · ${D.schedules.length - act} paused · <a href="tasks.v2.html" class="tk-sub-a">${run} running now</a>`
      : ALL ? `${run} running · <a href="schedules.html" class="tk-sub-a">${act} schedules active</a>` : `${run} running · the runs you started`;
    bar.querySelector('.topbar-actions').innerHTML = view === 'schedule' && can('task.schedule')
      ? '<button class="btn btn-primary btn-sm" data-sched="new">New schedule</button>' : '';
    document.getElementById('tk').innerHTML = `${note || ''}${view === 'runs' ? runsView() : scheduleView()}
      ${view === 'schedule' ? `<div class="budget"><b>Its own entry, next to Tasks</b> — Tasks answers <i>what happened</i>,
        Schedules answers <i>what will happen</i>; the same admin asks both, but seldom in one sitting.
        <br><b>A schedule is edited here and only here.</b> A plugin instance shows its schedules and links back, so there is
        one place to look when something ran that nobody expected.
        <br><b>Every 5 minutes is the shortest.</b> Anything that has to react faster is an event, and events are Hooks.</div>` :
      `<div class="budget"><b>Running is the top of the list, not a tab</b> — a run that finishes moves down into
        Finished instead of disappearing from where you were watching it. The sidebar panel shows the same runs; if the
        two disagree, the panel is wrong.
        <br><b>Reach follows the grant.</b> <code>task.read</code> sees every run and <i>Schedules</i>; <code>task.read_own</code> sees the runs
        its holder started, under <i>My Tasks</i>. Whoever started a run may cancel it.
        <br><b>A check that confirms the same answer writes nothing</b> — log changes, not observations. That is why
        a finished run can say <i>nothing changed</i> and still have been worth running.</div>`}`;
    if (panel.dataset.run) document.querySelectorAll(`[data-run="${panel.dataset.run}"]`).forEach(x => x.classList.add('tk-sel'));
    const hit = q.get('s') && document.getElementById('sch-' + q.get('s'));
    if (hit) hit.scrollIntoView({ block: 'center' });
  }

  const sch = (id) => D.schedules.find(s => s.id === id);
  const runOf = (id) => D.tasks.find(t => t.id === id);
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('.modal-scrim')) return;
    if (t.closest('[data-close]')) return closeRun();
    const c = t.closest('[data-cancel]'); if (c) { e.stopPropagation(); return cancel(runOf(c.dataset.cancel)); }
    const r = t.closest('[data-rerun]'); if (r) { e.stopPropagation(); return rerun(runOf(r.dataset.rerun)); }
    const it = t.closest('[data-items]');
    if (it) { e.preventDefault(); itemsTab = it.dataset.items; return openRun(panel.dataset.run); }
    const n = t.closest('[data-now]'); if (n) return runNow(sch(n.dataset.now));
    const pa = t.closest('[data-pause]'); if (pa) return pause(sch(pa.dataset.pause));
    const re = t.closest('[data-resume]');
    if (re) { const s = sch(re.dataset.resume); s.enabled = true; delete s.paused; q.set('s', s.id);
      return draw(saved(`Resumed ${s.what}.`, `Next run ${ahead(nextOf(s))}.`)); }
    const sc = t.closest('[data-sched]'); if (sc) return editSchedule(sc.dataset.sched === 'new' ? null : sch(sc.dataset.sched));
    if (t.closest('[data-retention]')) { e.preventDefault(); return retention(); }
    const row = t.closest('[data-run]');
    if (row && (!t.closest('a') || t.closest('a[data-run]'))) { e.preventDefault(); itemsTab = 'all'; return openRun(row.dataset.run); }
  });

  draw();
  if (q.get('run')) openRun(q.get('run'));
};
