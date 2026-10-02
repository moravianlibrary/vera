/* Hooks — /hooks
   Master–detail (decided with the user 2026-09-26): the hooks on the left,
   grouped by what their event is about; the selected hook on the right, and
   at the TOP of it, the deliveries that gave up — the one thing on this page
   that is waiting for a person.

   A hook sends something OUT when an event happens: an email, a Slack or
   Teams message, a webhook call, a file. Reacting inside VERA is a plugin
   trigger and lives on Plugins. Retries are set per hook.                 */

window.PAGE_HOOKS = function (tier) {
  const M = VERA, D = VERA_DATA, U = VERA_UI;
  const role = U.currentRole('admin');
  const held = U.permsOf(role);
  const can = (p) => held.has(p);
  const q = new URLSearchParams(location.search);
  const SHEET = tier === 'phone';

  /* -------------------------------------------------------------- time */
  const NOW = Date.parse(D.now), MIN = 6e4, DAY = 864e5;
  const ago = (iso) => { const m = Math.round((NOW - Date.parse(iso)) / MIN);
    return m < 60 ? `${m} min ago` : m < 24 * 60 ? `${Math.round(m / 60)} h ago`
      : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };

  /* ------------------------------------------------------------ records */
  const hook = (id) => D.hooks.find(h => h.id === id);
  const deadOf = (h) => D.deadLetters.filter(x => x.hook === h.id);
  const runsOf = (h) => D.executions.filter(x => x.hook === h.id).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const week = (h) => runsOf(h).filter(x => NOW - Date.parse(x.at) < 7 * DAY);
  /* a hook sends THROUGH a delivery channel — a plugin instance whose
     implementation provides one interface: email, chat, webhook, file */
  const chan = (id) => { for (const t of D.pluginTypes) { const i = t.instances.find(x => x.id === id); if (i) return Object.assign({ type: t }, i); } return null; };
  const CH = (h) => chan(h.target.channel);
  const IF = (h) => CH(h).type.channel;
  const T = (h) => D.HOOK_TARGETS[IF(h)];
  const channels = () => D.pluginTypes.filter(t => t.kind === 'Delivery channel').flatMap(t => t.instances.map(i => Object.assign({ type: t }, i)));
  const ICON = { email: '&#9993;', chat: '#', webhook: '&#8599;', file: '&#8615;' };
  const targetText = (h) => `<span class="hk-ico hk-ico-${IF(h)}">${ICON[IF(h)]}</span>${CH(h).name} · ${h.target.to}`;
  const batchText = (b) => !b ? 'sends each one at once'
    : `waits ${b.wait} min for more — the wait restarts with each new one, never longer than ${b.max >= 60 ? b.max / 60 + ' h' : b.max + ' min'} — then sends them together${b.by === 'recipient' ? ', one per recipient' : ', as one message'}`;
  const retryText = (r) => r.backoff === 'exponential'
    ? `${r.attempts} attempts, waiting ${Array.from({ length: r.attempts - 1 }, (_, k) => 2 ** k).map(m => m >= 60 ? m / 60 + ' h' : m + ' min').join(', ')} between them`
    : `${r.attempts} attempts, 5 min apart`;
  const who = (id) => D.byId(id).name;

  /* ------------------------------------------------------------ filters */
  const F = { kind: D.HOOK_TARGETS[q.get('kind')] ? q.get('kind') : '', state: ['active', 'paused', 'dead'].includes(q.get('state')) ? q.get('state') : '' };
  const href = (patch) => { const x = new URLSearchParams(q); x.delete('h');
    Object.entries(patch).forEach(([k, v]) => v ? x.set(k, v) : x.delete(k)); return 'hooks.html' + (x.toString() ? '?' + x : ''); };
  let query = '';
  const shown = () => D.hooks.filter(h => (!F.kind || IF(h) === F.kind)
    && (!F.state || (F.state === 'dead' ? deadOf(h).length : h.state === F.state))
    && (!query || (h.name + ' ' + h.event + ' ' + h.target.to + ' ' + CH(h).name).toLowerCase().includes(query)));

  /* --------------------------------------------------------------- list */
  const COLUMNS = tier === 'phone' ? null : tier === 'small'
    ? [{ label: 'Hook', w: 'minmax(0,1fr)' }, { label: '', w: 'max-content' }]
    : [{ label: 'Hook', w: 'minmax(0,1.4fr)' }, { label: 'Fires on', w: 'minmax(0,1fr)' }, { label: '7 days', w: 'max-content' }, { label: '', w: 'max-content' }];
  function spark(h) {
    const days = Array.from({ length: 7 }, (_, k) => { const from = NOW - (7 - k) * DAY;
      const xs = runsOf(h).filter(x => Date.parse(x.at) >= from && Date.parse(x.at) < from + DAY);
      return { n: xs.length, bad: xs.some(x => x.result === 'failed') }; });
    const max = Math.max(1, ...days.map(d => d.n));
    return `<span class="hk-spark" title="deliveries per day, last 7 days">${days.map(d =>
      `<i class="${d.bad ? 'bad' : ''}" style="height:${d.n ? 25 + d.n / max * 75 : 8}%"></i>`).join('')}</span>`;
  }
  const stateBadge = (h) => h.state === 'active' ? U.badge('active', 'green', 'badge-xs') : U.badge('paused', 'slate', 'badge-xs');
  function rowOf(h) {
    const dl = deadOf(h).length;
    const why = dl ? `<span class="hk-why-bad">&#9660; ${dl} deliver${dl > 1 ? 'ies' : 'y'} gave up</span>`
      : h.state === 'paused' && h.paused ? `<span class="muted">Paused — ${h.paused.why}</span>` : '';
    const title = `<div class="tc-title">${h.name}</div><div class="t-sub">${targetText(h)}</div>`;
    if (!COLUMNS) return { key: h.id, title: h.name, meta: `${T(h).label} · <span class="mono">${h.event}</span> · ${h.state}`, why };
    const cells = tier === 'small' ? [title + `<div class="t-sub mono">${h.event}</div>`, stateBadge(h)]
      : [title, `<span class="mono hk-ev">${h.event}</span>${h.filter ? `<div class="t-sub">${h.filter}</div>` : ''}`,
         `${spark(h)} <span class="muted hk-n">${week(h).length}</span>`, stateBadge(h)];
    return { key: h.id, cells, why };
  }
  function listHTML() {
    const hs = shown();
    return D.HOOK_EVENTS.map(([g, about]) => {
      const inG = hs.filter(h => D.hookEvent(h.event).group === g);
      return inG.length ? `<div class="hk-grp"><b>${g}</b> <span class="muted">· ${about}</span></div>` +
        inG.map(h => U.lrow(Object.assign(rowOf(h), { selected: !SHEET && sel === h.id }))).join('') : '';
    }).join('') || '<div class="pane-empty">No hook matches.</div>';
  }

  /* ------------------------------------------------------------ preview */
  const FILL = { title: 'Moravské noviny 1881', decision: 'declined', public_text: 'Postponed — will be scheduled next quarter.',
    task: 'Ingest batch B-0138', error: 'Catalog adapter returned HTTP 502 after 3 attempts.', link: 'https://vera.mzk.cz/…',
    list: 'Regional weeklies', pages: '4 000', starts: '5 Oct' };
  const fill = (s) => (s || '').replace(/\{(\w+)\}/g, (m, k) => `<b>${FILL[k] || m}</b>`);
  function preview(h) {
    const e = D.hookEvent(h.event);
    const k = IF(h), batched = h.batch && h.pending && h.pending.length;
    if (batched && k === 'email') { const b = h.pending[0];
      return `<div class="hk-mail"><div><span class="muted">To</span> ${b.to}</div><div><span class="muted">Subject</span> [VERA] ${b.items.length} of your requests were decided</div>
        <ul class="tk-changed">${b.items.map(x => `<li>${x}</li>`).join('')}</ul><p class="muted">One mail for everything decided within the wait — not one each.</p></div>`; }
    if (k === 'email') return `<div class="hk-mail"><div><span class="muted">To</span> ${h.target.to}</div>
      <div><span class="muted">Subject</span> [VERA] ${e.what}</div><p>${fill(h.message)}</p></div>`;
    if (k === 'chat') return `<div class="hk-chat hk-chat-${CH(h).type.name.startsWith('Slack') ? 'slack' : 'teams'}"><div class="hk-chat-who"><b>VERA</b> <span class="muted">in ${h.target.to} · ${CH(h).type.name.replace('Notifier', '')}</span></div>${fill(h.message)}</div>`;
    if (k === 'file') return `<pre class="code">${CH(h).config.match(/host=([^ ]+)/)[1]}:${h.target.to}/L-2026-015.csv\n\ncatalog_id;title;pages;category;priority\nMZK01-001284756;Lidové noviny 1893;412;Periodicals / National;High\n…</pre>`;
    return `<pre class="code">POST ${h.target.to}\nX-Vera-Signature: sha256=…\n\n{
  "event": "${h.event}",
  "at": "2026-06-25T10:40:00Z",
  "subject": "${e.sample.split(' · ')[0]}",
  "text": "<span style="color:#fbbf24">public wording only</span>"
}</pre>`;
  }

  /* ------------------------------------------------------------- detail */
  let sel = hook(q.get('h')) ? q.get('h') : null;
  function render(id) {
    const h = hook(id), e = D.hookEvent(h.event), dl = deadOf(h), rs = runsOf(h), wk = week(h);
    const acts = can('hook.configure') ? `<button class="btn btn-sm" data-test="${h.id}">Test…</button>
      ${h.state === 'active' ? `<button class="btn btn-sm" data-pause="${h.id}">Pause…</button>` : `<button class="btn btn-sm" data-resume="${h.id}">Resume</button>`}
      <button class="btn btn-sm" data-edit="${h.id}">Edit…</button><button class="btn btn-sm btn-danger" data-del="${h.id}">Delete…</button>` : '';
    const gaveUp = dl.length ? `<section class="pcard hk-dead">
        <div class="pcard-head"><h3>${dl.length} deliver${dl.length > 1 ? 'ies' : 'y'} gave up</h3>
          ${can('hook.configure') && dl.length > 1 ? `<span class="right"><button class="btn btn-sm" data-retryall="${h.id}">Retry all</button></span>` : ''}</div>
        ${dl.map(x => `<div class="hk-dl"><div><b>${ago(x.at)}</b> · <span class="mono">${x.subject}</span> · after ${x.attempts} attempts
            <div class="hk-dl-err">${x.error}</div>
            <details class="hk-pay"><summary>What it tried to send</summary><pre class="code">${x.payload}</pre></details></div>
          ${can('hook.configure') ? `<div class="hk-dl-acts"><button class="btn btn-sm btn-primary" data-retry="${x.id}">Retry</button><button class="btn btn-sm" data-discard="${x.id}">Discard…</button></div>` : ''}</div>`).join('')}
        <p class="fine">It retried ${retryText(h.retry)}, then stopped and waits here. Nothing is lost: the event is still in the status log.</p></section>` : '';
    const pend = h.pending && h.pending.length ? `<section class="pcard hk-pend">
        <div class="pcard-head"><h3>Waiting to send · ${h.pending.reduce((a, b) => a + b.items.length, 0)}</h3>
          ${can('hook.configure') ? `<span class="right"><button class="btn btn-sm" data-flush="${h.id}">Send now</button></span>` : ''}</div>
        ${h.pending.map(b => `<div class="hk-dl"><div><b>${b.to}</b> · ${b.items.length} collected since ${new Date(Date.parse(b.first)).toTimeString().slice(0, 5)}
          <div class="muted">${b.items.join(' · ')}</div></div><div class="hk-dl-acts"><span class="muted">sends ${new Date(Date.parse(b.sendsAt)).toTimeString().slice(0, 5)}, unless more arrive</span></div></div>`).join('')}
        <p class="fine">This hook ${batchText(h.batch)}.</p></section>` : '';
    return U.paneHead(h.name, `${targetText(h)}`, acts) + `
      ${h.state === 'paused' ? `<div class="status-note status-note-slate" style="margin-bottom:1rem"><span>&#9660;</span><div><b>Paused</b> <span>${h.paused ? `by ${who(h.paused.by)} on ${h.paused.at} — ${h.paused.why}` : ''} Events that happen while it is paused are not sent later.</span></div></div>` : ''}
      ${gaveUp}${pend}
      ${U.pcard('Subscription', U.kv2([
        ['Fires on', `<span class="mono">${h.event}</span><br><span class="muted">${e.what}</span>`],
        ['Only when', h.filter || '<span class="muted">every time</span>'],
        ['Sends to', `${h.target.to}<br><span class="muted">through ${can('plugin.read') ? `<a href="plugins.html?i=${CH(h).id}">${CH(h).name}</a>` : CH(h).name} · ${CH(h).type.name} · ${T(h).label.toLowerCase()}</span>`],
        ['Timing', batchText(h.batch)],
        ['If it fails', `<span>${retryText(h.retry)}</span>`],
        ['Made by', `${who(h.by)} · ${h.since}`]]))}
      ${U.pcard('What it sends', preview(h) + `<p class="fine">Public wording only — this leaves VERA, so internal reasons never go out. Shown with a sample ${e.group.toLowerCase().replace(/s$/, '')}: ${e.sample}.</p>`)}
      ${U.pcard(`Deliveries <span class="muted">· ${wk.length} in the last 7 days</span>`, rs.length ? `<table class="pj-table hk-table"><tbody>${rs.slice(0, 8).map(x => `<tr>
          <td>${ago(x.at)}</td><td class="mono">${x.subject}</td>
          <td>${x.result === 'ok' ? U.badge('sent', 'green', 'badge-xs') : x.result === 'retried' ? U.badge('sent on retry', 'amber', 'badge-xs') : U.badge('gave up', 'red', 'badge-xs')}</td>
          <td class="muted">${x.detail}</td><td class="num muted">${x.ms ? x.ms + ' ms' : '—'}</td></tr>`).join('')}</tbody></table>`
        : '<p class="fine" style="margin-top:0">Nothing sent yet.</p>')}
      <p class="fine">Deliveries are kept for ${D.hookRetention.days} days. One that gave up stays until somebody retries or discards it.</p>`;
  }

  /* ------------------------------------------------------------- modals */
  function modal(title, bodyHTML, foot) {
    const host = document.createElement('div');
    host.className = 'modal-scrim';
    host.innerHTML = `<div class="modal"><div class="modal-head"><h2>${title}</h2>
        <button class="modal-x" data-x aria-label="Close">&times;</button></div>
      <div class="modal-body">${bodyHTML}</div><div class="modal-foot">${foot}</div></div>`;
    host.querySelectorAll('[data-x]').forEach(b => b.onclick = () => host.remove());
    host.onclick = (ev) => { if (ev.target === host) host.remove(); };
    document.body.appendChild(host);
    return host;
  }
  const FOOT = (ok, danger) => `<button class="btn foot-left" data-x>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${ok}</button>`;
  const saved = (b, s) => `<div class="status-note status-note-green pj-saved"><span>&#9660;</span><div><b>${b}</b> <span>${s}</span></div></div>`;
  let seq = 4480;

  function retry(x, quiet) {
    D.deadLetters.splice(D.deadLetters.indexOf(x), 1);
    D.executions.unshift({ id: 'X-' + seq++, hook: x.hook, at: D.now, result: 'ok', ms: 160, subject: x.subject, detail: 'sent on a manual retry' });
    if (!quiet) refresh(x.hook, saved('Sent.', `${x.subject} went out on a manual retry.`));
  }
  function discard(x) {
    const host = modal('Discard this delivery?', `<p style="margin-top:0"><b>${x.subject}</b> is not sent to ${hook(x.hook).target.to}. Nobody will be told.</p>
      <p class="fine">The event itself stays in the status log — only this delivery is dropped.</p>`, FOOT('Discard', true));
    host.querySelector('[data-ok]').onclick = () => { host.remove(); D.deadLetters.splice(D.deadLetters.indexOf(x), 1);
      refresh(x.hook, saved('Discarded.', `${x.subject} will not be sent.`)); };
  }
  function test(h) {
    const e = D.hookEvent(h.event);
    const host = modal(`Test ${h.name}`, `<p style="margin-top:0">Sends this, built from the latest <span class="mono">${h.event}</span> (${e.sample}), to ${h.target.to}:</p>
      ${preview(h)}<div id="tsRes" class="fine"></div>`, FOOT('Send test'));
    host.querySelector('[data-ok]').onclick = () => {
      host.querySelector('#tsRes').innerHTML = h.id === 'H-03'
        ? '<span class="hk-why-bad">&#9660; connect ETIMEDOUT ops.internal:443</span> — the target is still unreachable.'
        : `<span style="color:var(--tone-green-fg)">&#10003; Delivered in 212 ms.</span> A test is not recorded as a delivery.`;
    };
  }
  function pause(h) {
    const host = modal(`Pause ${h.name}?`, `<p style="margin-top:0">It stops sending. Events that happen while it is paused are <b>not</b> sent later — resuming starts from the next one.</p>
      <label class="fld">Why <span class="muted">— shown on the hook</span><input id="paWhy"></label>`, FOOT('Pause'));
    host.querySelector('[data-ok]').onclick = () => { host.remove();
      Object.assign(h, { state: 'paused', paused: { by: U.userOf(role), at: '25 Jun 2026', why: host.querySelector('#paWhy').value.trim() || 'no reason given.' } });
      refresh(h.id, saved(`Paused ${h.name}.`, 'Resume it from the same place.')); };
  }
  function del(h) {
    const dl = deadOf(h).length;
    const host = modal(`Delete ${h.name}?`, `<p style="margin-top:0">It stops sending for good.${dl ? ` Its <b>${dl}</b> deliver${dl > 1 ? 'ies' : 'y'} that gave up ${dl > 1 ? 'are' : 'is'} discarded with it.` : ''}</p>
      <p class="fine">Its deliveries stay ${D.hookRetention.days} days. To stop it for a while, pause it instead.</p>`, FOOT('Delete hook', true));
    host.querySelector('[data-ok]').onclick = () => { host.remove();
      D.hooks.splice(D.hooks.indexOf(h), 1); D.deadLetters = D.deadLetters.filter(x => x.hook !== h.id);
      sel = D.hooks[0] && D.hooks[0].id; refresh(sel, saved(`${h.name} deleted.`, '')); };
  }
  function edit(h) {
    const isNew = !h;
    const v = h || { name: '', event: 'iteration.published', filter: '', target: { channel: 'pi16', to: '' }, message: '', retry: { attempts: 3, backoff: 'exponential' }, batch: null };
    const chOpts = Object.entries(D.HOOK_TARGETS).map(([k, t]) => `<optgroup label="${t.label}">${channels().filter(c => c.type.channel === k).map(c =>
      `<option value="${c.id}" ${v.target.channel === c.id ? 'selected' : ''} ${c.enabled ? '' : 'disabled'}>${c.name} — ${c.type.name}${c.enabled ? '' : ' (disabled)'}</option>`).join('')}</optgroup>`).join('');
    const evOpts = D.HOOK_EVENTS.map(([g, , es]) => `<optgroup label="${g}">${es.map(([k, w]) =>
      `<option value="${k}" ${v.event === k ? 'selected' : ''}>${k} — ${w}</option>`).join('')}</optgroup>`).join('');
    const host = modal(isNew ? 'New hook' : `Edit ${h.name}`, `
      <label class="fld" style="margin-top:0">Name<input id="hkName" value="${v.name}" placeholder="e.g. Tell the ops channel when ingest fails"></label>
      <label class="fld">When<select id="hkEv">${evOpts}</select></label>
      <label class="fld">Only when <span class="muted">— leave empty for every time</span>
        <input id="hkFilter" value="${v.filter}" placeholder="e.g. category under Periodicals · priority is Urgent"></label>
      <label class="fld">Send through <span class="muted">— a delivery channel; ${can('plugin.read') ? '<a href="plugins.html?kind=Delivery%20channel">set up on Plugins</a>' : 'set up on Plugins'}</span><select id="hkCh">${chOpts}</select></label>
      <label class="fld"><span id="hkToL"></span><input id="hkTo" value="${v.target.to}"></label>
      <label class="fld" id="hkMsgW">Message <span class="muted">— {title}, {decision}, {public_text}, {link}… are filled in; public wording only</span>
        <textarea id="hkMsg" rows="2">${v.message || ''}</textarea></label>
      <div class="fld">Timing</div>
      <label class="line in-line"><input type="radio" name="hkBatch" value="now" ${v.batch ? '' : 'checked'}><span><b>Send each one at once</b></span></label>
      <label class="line in-line"><input type="radio" name="hkBatch" value="wait" ${v.batch ? 'checked' : ''}><span><b>Wait for more, then send them together</b>
        <span class="muted">— a curator deciding a shelf sends one message, not forty</span></span></label>
      <div class="fld-row" id="hkBatchW">
        <label class="fld">Wait<select id="hkWait">${[5, 15, 30, 60].map(n => `<option value="${n}" ${(v.batch || { wait: 15 }).wait === n ? 'selected' : ''}>${n} min after the last one</option>`).join('')}</select></label>
        <label class="fld">But never longer than<select id="hkMax">${[30, 60, 240, 1440].map(n => `<option value="${n}" ${(v.batch || { max: 60 }).max === n ? 'selected' : ''}>${n >= 60 ? n / 60 + ' h' : n + ' min'}</option>`).join('')}</select></label>
        <label class="fld">Together as<select id="hkBy"><option value="recipient" ${(v.batch || {}).by !== 'all' ? 'selected' : ''}>one per recipient</option><option value="all" ${(v.batch || {}).by === 'all' ? 'selected' : ''}>one message</option></select></label>
      </div>
      <div class="fld-row">
        <label class="fld">If it fails, try<select id="hkAtt">${[1, 2, 3, 5, 8, 10].map(n => `<option value="${n}" ${v.retry.attempts === n ? 'selected' : ''}>${n} time${n > 1 ? 's' : ''}</option>`).join('')}</select></label>
        <label class="fld">Waiting<select id="hkBack"><option value="exponential" ${v.retry.backoff === 'exponential' ? 'selected' : ''}>longer each time</option>
          <option value="fixed" ${v.retry.backoff === 'fixed' ? 'selected' : ''}>5 min each time</option></select></label></div>
      <p class="fine" id="hkRetry"></p><div class="pj-err" id="hkErr"></div>`,
      `<button class="btn foot-left" data-x>Cancel</button><button class="btn" data-try>Send a test</button><button class="btn btn-primary" data-ok>${isNew ? 'Create hook' : 'Save'}</button>`);
    const $ = (id) => host.querySelector('#' + id);
    const kind = () => chan($('hkCh').value).type.channel;
    const sync = () => { const k = kind();
      $('hkToL').textContent = { email: 'Addresses — or "the requester", "the project owner"', chat: 'Channel', webhook: 'URL — POSTed as JSON, signed by the channel', file: 'Folder — written as CSV' }[k];
      $('hkTo').placeholder = { email: 'digitalizace@mzk.cz', chat: '#digitalizace', webhook: 'https://…', file: '/incoming' }[k];
      $('hkMsgW').style.display = k === 'webhook' || k === 'file' ? 'none' : '';
      $('hkBatchW').style.display = host.querySelector('[name=hkBatch]:checked').value === 'wait' ? '' : 'none';
      $('hkRetry').textContent = 'It will try ' + retryText({ attempts: +$('hkAtt').value, backoff: $('hkBack').value }) + ' — then it gives up and the delivery waits on this page.'; };
    host.querySelectorAll('#hkCh, [name=hkBatch], #hkAtt, #hkBack').forEach(el => el.onchange = sync); sync();
    const read = () => ({ name: $('hkName').value.trim(), event: $('hkEv').value, filter: $('hkFilter').value.trim(),
      target: { channel: $('hkCh').value, to: $('hkTo').value.trim() },
      batch: host.querySelector('[name=hkBatch]:checked').value === 'wait' ? { wait: +$('hkWait').value, max: +$('hkMax').value, by: $('hkBy').value } : null,
      message: $('hkMsg').value.trim(), retry: { attempts: +$('hkAtt').value, backoff: $('hkBack').value } });
    host.querySelector('[data-try]').onclick = () => { const x = read();
      $('hkErr').innerHTML = x.target.to ? `<span style="color:var(--tone-green-fg)">&#10003; Test sent to ${x.target.to} with a sample ${x.event}.</span>` : 'Say where to send it first.'; };
    host.querySelector('[data-ok]').onclick = () => {
      const x = read();
      if (!x.name) { $('hkErr').textContent = 'A hook needs a name.'; return; }
      if (!x.target.to) { $('hkErr').textContent = 'Say where to send it.'; return; }
      host.remove();
      if (h) { Object.assign(h, x); refresh(h.id, saved(`${x.name} saved.`, 'From the next event.')); }
      else { const id = 'H-' + String(D.hooks.length + 10).padStart(2, '0');
        D.hooks.push(Object.assign({ id, state: 'active', by: U.userOf(role), since: '25 Jun 2026' }, x));
        refresh(id, saved(`${x.name} created.`, `It sends from the next ${x.event}.`)); }
    };
  }

  /* -------------------------------------------------------------- shell */
  const chips = [];
  if (F.kind) chips.push({ k: 'Sends by', v: D.HOOK_TARGETS[F.kind].label, drop: href({ kind: '' }) });
  if (F.state) chips.push({ k: 'State', v: F.state === 'dead' ? 'gave up' : F.state, drop: href({ state: '' }) });
  const first = shown()[0];
  if (!sel && !SHEET) sel = (D.hooks.find(h => deadOf(h).length && shown().includes(h)) || first || {}).id;
  U.splitPage({
    tier, active: 'hooks', role, title: 'Hooks',
    subtitle: '',
    actions: can('hook.configure') ? '<button class="btn btn-primary btn-sm" data-new>New hook</button>' : '',
    filters: { search: 'Search hooks, events, targets…', chips,
      options: [['Sends by', Object.entries(D.HOOK_TARGETS).map(([k, t]) => [t.label, href({ kind: k })])],
        ['State', [['Active', href({ state: 'active' })], ['Paused', href({ state: 'paused' })], ['Gave up', href({ state: 'dead' })]]]], available: [] },
    count: '', rows: shown().map(rowOf), columns: COLUMNS, listHTML: ' ',
    render: (k) => render(k), empty: 'Pick a hook to see what it sends, and what came back.'
  });
  const listcol = document.querySelector('.listcol'), pane = document.querySelector('.pane');
  function refresh(id, note) {
    sel = id;
    const head = listcol.querySelector('.listcol-head'), th = listcol.querySelector('.thead');
    const n = shown().length, dead = D.deadLetters.length;
    head.innerHTML = `<span>${n} hook${n === 1 ? '' : 's'}</span>${dead ? `<a href="${href({ state: 'dead' })}" class="hk-why-bad">${dead} gave up</a>` : ''}`;
    listcol.innerHTML = ''; listcol.appendChild(head); if (th) listcol.appendChild(th);
    listcol.insertAdjacentHTML('beforeend', listHTML());
    const p = document.querySelector('.topbar .titles p') || document.querySelector('.topbar .titles').appendChild(document.createElement('p'));
    p.innerHTML = `${D.hooks.length} hooks · ${D.hooks.filter(h => h.state === 'active').length} active${dead ? ` · <span class="hk-why-bad">${dead} deliveries gave up</span>` : ''}`;
    if (id && hook(id)) {
      pane.innerHTML = (note || '') + render(id) + `<div class="budget"><b>A hook sends something out</b> — email, Slack, Teams, a webhook, a file — when
        an event VERA records happens. Reacting inside VERA is a plugin trigger, on Plugins, so one reaction has one home.
        <br><b>Grouped by what the event is about</b>: requests, documents, records, lists, task runs. Behind pace or out of band
        are not events — nothing happened, a number moved; a watchlist is the tool for those.
        <br><b>A hook can wait for more.</b> Set to collect, it holds events and sends them together — the wait restarts with each new one, up to a limit.
        <br><b>Where it sends is a plugin</b> — a delivery channel. Two mail services are two implementations of one email interface, each with its own configuration; the hook only says <i>which</i> channel and <i>to whom</i>.
        <br><b>Retries are the hook's own.</b> What gave up waits at the top of its hook until somebody retries or discards it.</div>`;
      pane.scrollTop = 0;
      if (SHEET && note !== undefined) pane.classList.add('open');
    } else pane.innerHTML = `<div class="pane-empty">Pick a hook to see what it sends, and what came back.</div>`;
    const back = pane.querySelector('.pane-back'); if (back) back.onclick = () => pane.classList.remove('open');
  }
  listcol.addEventListener('click', (ev) => {
    const r = ev.target.closest('.lrow'); if (!r || ev.target.closest('a')) return;
    ev.preventDefault(); ev.stopPropagation();
    q.set('h', r.dataset.key); history.replaceState(null, '', 'hooks.html?' + q);
    refresh(r.dataset.key, ''); if (SHEET) pane.classList.add('open');
  }, true);
  document.querySelector('.main').addEventListener('click', (ev) => {
    const t = ev.target;
    const g = (a) => { const el = t.closest(`[${a}]`); return el ? el.getAttribute(a) : null; };
    if (t.closest('[data-new]')) return edit(null);
    if (g('data-edit')) return edit(hook(g('data-edit')));
    if (g('data-test')) return test(hook(g('data-test')));
    if (g('data-pause')) return pause(hook(g('data-pause')));
    if (g('data-resume')) { const h = hook(g('data-resume')); h.state = 'active'; delete h.paused; return refresh(h.id, saved(`Resumed ${h.name}.`, 'It sends from the next event.')); }
    if (g('data-del')) return del(hook(g('data-del')));
    if (g('data-retry')) return retry(D.deadLetters.find(x => x.id === g('data-retry')));
    if (g('data-retryall')) { const h = hook(g('data-retryall')), xs = deadOf(h); xs.forEach(x => retry(x, true));
      return refresh(h.id, saved(`Sent ${xs.length}.`, 'Every delivery that had given up went out.')); }
    if (g('data-flush')) { const h = hook(g('data-flush')), n = h.pending.length;
      h.pending.forEach(b => D.executions.unshift({ id: 'X-' + seq++, hook: h.id, at: D.now, result: 'ok', ms: 120, subject: b.items.map(x => x.split(' · ')[0]).join(', '), detail: `${b.items.length} in one → ${b.to}` }));
      h.pending = []; return refresh(h.id, saved(`Sent ${n} message${n > 1 ? 's' : ''}.`, 'Without waiting for more.')); }
    if (g('data-discard')) return discard(D.deadLetters.find(x => x.id === g('data-discard')));
  });
  const search = document.querySelector('.filterbar .search');
  if (search) search.oninput = () => { query = search.value.trim().toLowerCase(); refresh(sel); };
  refresh(sel);
  if (SHEET && q.get('h')) pane.classList.add('open');
};
