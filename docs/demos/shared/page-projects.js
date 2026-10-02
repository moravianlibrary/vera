/* Projects — /projects   (view-catalog Projects, projects.md)
   Funded envelopes. A project funds ITERATIONS, not documents: a rescan can be
   funded by a different grant than the original, and both statements stay true
   forever (concepts.md).

   Few are running at once — a handful of grants, not a queue — so the index is
   NOT the master–detail every queue page uses. The proposed, active and
   upcoming ones are cards; the ended and the rejected pile up over the years
   and sit in compact tables below, there for the audit that asks years later.
     index    /projects           (projects.html)
     detail   /projects/:id       (?p=ID)
   Create / edit, members and the decision are modals on either.

   Two things read as a project's state and never mix (projects.md §1): the
   DECISION, stored — Proposed, Approved, Rejected, final once decided — and
   the PERIOD, derived from the dates — Upcoming, Active, Ended. Pace is
   computed only for an Approved project. Planned and delivered are two
   numbers that are never summed (intentions §6).
   Not here: the mix — project has no link to category (relationships §4). */

window.PAGE_PROJECTS = function (tier) {
  const M = VERA, D = VERA_DATA, U = VERA_UI;
  const role = U.currentRole('dig-curator');
  const held = U.permsOf(role);
  const can = (p) => held.has(p);
  const me = U.userOf(role);
  const q = new URLSearchParams(location.search);

  /* scope, which this page needs (projects.md §3): `any` reaches every
     project, `managed` the ones I manage, `project` the ones I am on */
  const at = (perm, p) => U.scopesOf(role, perm).some(s =>
    s === 'any' || (s === 'managed' && p.manager === me) || (s === 'project' && isMember(p, me)));
  const isMember = (p, u) => p.members.includes(u) ||
    D.groups.some(g => g.projects.includes(p.id) && D.byId(u).groups && D.byId(u).groups.includes(g.id));
  /* project.decide includes seeing every project (decided 2026-10-01) */
  const canSee = (p) => can('project.decide') || at('project.read', p);
  const canDecide = (p) => p.state === 'Proposed' && can('project.decide');
  const canEdit = (p) => at('project.edit', p);
  const canMembers = (p) => at('project.manage_members', p);
  const canDelete = (p) => at('project.delete', p) && !proposalsOf(p).length;

  /* ------------------------------------------------------------ records */
  const DAY = 864e5;
  const when = (s) => Date.parse(s) || 0;
  const TODAY = when(D.today);
  const dayY = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const period = (p) => `${dayY(p.starts)} → ${dayY(p.ends)}`;
  const pagesOf = (it) => { const p = D.effectivePages(D.doc(it.doc)); return p ? p.value : 0; };
  const sum = (its) => its.reduce((a, it) => a + pagesOf(it), 0);
  const pct = (a, b) => b ? a / b * 100 : 0;
  const who = (id) => id === 'sys' ? 'System' : D.byId(id).name;
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;

  const fundedBy = (p) => D.iterations.filter(it => it.project === p.id);
  /* planned counts only items on a list that still exists (decided
     2026-09-26) — a deleted list's items stop counting. What was digitized
     stays planned: delivered is a part of it. */
  const done = (it) => M.atLeast(it.progress, 'Digitized');
  const scheduled = (it) => done(it) || (!!it.list && M.atLeast(it.progress, 'Planned'));
  const intentionsOf = (p) => D.intentions.filter(i => i.funding === p.id);
  const people = (g) => n(D.users.filter(u => u.groups.includes(g)).length, 'person', 'people');
  const groupsOf = (p) => D.groups.filter(g => g.projects.includes(p.id));

  /* the proposals made into it, any state — what a decision acts on and
     what makes a project undeletable */
  const proposalsOf = (p) => D.requests.filter(r => r.project === p.id);
  const pendingOf = (p) => proposalsOf(p).filter(r => r.decision === 'Pending');
  const hasCopy = (r) => (r.existingCopies || []).length > 0;
  /* one row per document, as on Proposals: one decision covers every asker */
  const byDoc = (rs) => [...new Map(rs.map(r => [r.doc, r])).values()];
  /* a document someone else asked for too stays theirs when a project is
     rejected (flows D12) */
  const othersAsk = (r) => D.requests.some(x => x.doc === r.doc && x.decision === 'Pending' && x.project !== r.project);

  function numbers(p) {
    const f = fundedBy(p);
    const waiting = f.filter(it => !scheduled(it) && !done(it) && !it.cancellation);
    return { f, planned: sum(f.filter(scheduled)), delivered: sum(f.filter(done)),
             waiting, waitingPages: sum(waiting) };
  }

  const periodOf = (p) => when(p.starts) > TODAY ? 'Upcoming' : when(p.ends) + DAY <= TODAY ? 'Ended' : 'Active';
  const PERIOD_TONE = { Upcoming: 'slate', Active: 'blue', Ended: 'slate' };
  const DECISION_TONE = { Proposed: 'amber', Approved: 'green', Rejected: 'red' };
  const elapsed = (p) => Math.max(0, Math.min(100,
    pct(TODAY - when(p.starts), when(p.ends) + DAY - when(p.starts))));
  const daysTo = (iso) => Math.max(0, Math.ceil((when(iso) + DAY - TODAY) / DAY));

  /* pace: delivered against the share of the time used up. Ten points of
     slack — a grant is not behind because one list is still running.
     Only an Approved project has a pace. */
  const PACE_SLACK = 10;
  function paceOf(p, k) {
    const s = periodOf(p);
    if (p.state !== 'Approved' || s === 'Upcoming' || !k.f.length) return null;
    const d = pct(k.delivered, p.target);
    if (s === 'Ended') return d >= 100 ? { text: 'Target met', tone: 'green' }
      : { text: `${Math.round(d)}% delivered`, tone: 'amber' };
    return d >= elapsed(p) - PACE_SLACK ? { text: 'On pace', tone: 'green' }
      : { text: 'Behind pace', tone: 'amber' };
  }

  /* the lists carrying what it funded — a project reaches lists only
     through its iterations, never directly (relationships §4) */
  function listsOf(p) {
    const f = fundedBy(p);
    const live = [...new Set(f.filter(it => it.list).map(it => it.list))].map(D.listOf);
    const gone = [...new Set(f.filter(it => !it.list && it.listName).map(it => it.listName))];
    return { live, gone };
  }
  const listState = (l) => l.done ? 'Done' : when(l.starts) > TODAY ? 'Planned' : 'In progress';
  function intentionNumbers(i) {
    const c = D.intentionCount(i);
    return { planned: c.plannedPages, delivered: c.deliveredPages };
  }
  const mixName = (i) => D.mixText(i).replace(/^own mix$/, 'its own mix');

  /* --------------------------------------------------------------- bars */
  function bars(p, k, big) {
    const s = periodOf(p), t = elapsed(p);
    const time = s === 'Upcoming' ? `starts ${dayY(p.starts)} · in ${daysTo(p.starts) - 1} days`
      : s === 'Ended' ? `ended ${dayY(p.ends)}`
      : `${Math.round(t)}% elapsed · ${daysTo(p.ends)} days left`;
    const row = (label, w, txt, cls, tick) => `<div class="pj-bar ${cls}">
      <span class="pj-bl">${label}</span>
      <div class="meter"><i style="width:${Math.min(100, w)}%"></i>${
        tick != null ? `<b class="pj-tick" style="left:${tick}%" title="where it should be by today"></b>` : ''}</div>
      <span class="pj-bv">${txt}</span></div>`;
    const of = (v) => `${M.fmt(v)} / ${M.fmt(p.target)} pp · <b>${Math.round(pct(v, p.target))}%</b>`;
    const tick = s === 'Active' && p.state === 'Approved' ? t : null;
    const out = [row('Time', t, time, 'pj-time')];
    if (k.f.length) {
      out.push(row('Planned', pct(k.planned, p.target), of(k.planned) +
        (k.planned > p.target ? ` <span class="muted">· ${M.fmt(k.planned - p.target)} over</span>` : ''), 'pj-planned', tick));
      out.push(row('Delivered', pct(k.delivered, p.target), of(k.delivered), 'pj-delivered', tick));
    }
    return `<div class="pj-bars ${big ? 'pj-bars-big' : ''}">${out.join('')}</div>`;
  }

  const decisionBadge = (p, cls) => U.badge(p.state, DECISION_TONE[p.state], cls);
  /* a rejected project's period says nothing anybody acts on */
  const periodBadge = (p, cls) => p.state === 'Rejected' ? '' : U.badge(periodOf(p), PERIOD_TONE[periodOf(p)], cls);
  const paceBadge = (p, k, cls) => { const x = paceOf(p, k); return x ? U.badge(x.text, x.tone, cls) : ''; };
  const noIntention = (p) => `<div class="pj-none"><b>No intention yet</b> — nothing says what this money
      should buy.${can('intention.read') ? ' <a href="intentions.html">Create one</a>' : ''}</div>`;

  /* what a decision would do, said before it is made: the pending proposals
     it approves, and the ones with a copy it skips (flows D11) */
  function pendingLine(p) {
    const docs = byDoc(pendingOf(p)), copies = docs.filter(hasCopy);
    if (!docs.length) return 'No proposals in it yet';
    return `<b>${n(docs.length, 'pending', 'pending')}</b>${copies.length
      ? ` · ${n(copies.length, 'with a copy', 'with a copy')} (will be skipped)` : ''}`;
  }

  /* -------------------------------------------------------------- index */

  function card(p) {
    const k = numbers(p), ints = intentionsOf(p), ls = listsOf(p).live, g = groupsOf(p);
    const proposed = p.state === 'Proposed';
    const foot = [
      proposed ? pendingLine(p) : null,
      !proposed && ints.length ? n(ints.length, 'intention', 'intentions') : null,
      ls.length ? n(ls.length, 'list', 'lists') : null,
      `${n(p.members.length, 'member', 'members')}${g.length ? ` · ${g.map(x => x.name).join(', ')}` : ''}`,
      k.waiting.length ? `<b>${M.fmt(k.waitingPages)} pp</b> approved, not on a list` : null
    ].filter(Boolean).join(' · ');
    const decide = canDecide(p) ? `<div class="pj-decide">
        <button class="btn btn-sm btn-primary" data-approve="${p.id}">Approve…</button>
        <button class="btn btn-sm" data-reject="${p.id}">Reject…</button></div>` : '';
    return `<article class="pj-card" data-href="projects.html?p=${p.id}">
      <div class="pj-card-head">
        <div><a class="pj-name" href="projects.html?p=${p.id}">${p.name}</a>
          <div class="pj-sub">${period(p)} · target ${M.fmt(p.target)} pp · managed by ${who(p.manager)}${
            p.priority ? ` · ${p.priority} priority` : ''}</div></div>
        <div class="pj-badges">${decisionBadge(p, 'badge-xs')}${periodBadge(p, 'badge-xs')}${paceBadge(p, k, 'badge-xs')}</div>
      </div>
      ${p.description ? `<p class="pj-desc">${p.description}</p>` : ''}
      ${bars(p, k)}
      ${!proposed && !ints.length ? noIntention(p) : ''}
      ${decide}
      <div class="pj-foot">${foot}</div>
    </article>`;
  }

  function endedTable(list) {
    if (!list.length) return '';
    return `<details class="pj-ended" open><summary>Ended <span class="muted">· ${list.length}</span></summary>
      <table class="pj-table"><thead><tr><th>Project</th><th class="pj-c-period">Period</th>
        <th class="num">Target</th><th class="num pj-c-planned">Planned</th><th class="num">Delivered</th><th>Result</th></tr></thead>
      <tbody>${list.map(p => { const k = numbers(p);
        return `<tr data-href="projects.html?p=${p.id}">
          <td><a href="projects.html?p=${p.id}">${p.name}</a></td>
          <td class="pj-c-period muted">${period(p)}</td>
          <td class="num">${M.fmt(p.target)}</td>
          <td class="num pj-c-planned">${M.fmt(k.planned)}</td>
          <td class="num">${M.fmt(k.delivered)}</td>
          <td>${paceBadge(p, k, 'badge-xs')}</td></tr>`; }).join('')}</tbody></table></details>`;
  }
  function rejectedTable(list) {
    if (!list.length) return '';
    return `<details class="pj-ended"><summary>Rejected <span class="muted">· ${list.length}</span></summary>
      <table class="pj-table"><thead><tr><th>Project</th><th class="pj-c-period">Period</th>
        <th>Reason</th><th class="pj-c-period">Decided</th></tr></thead>
      <tbody>${list.map(p => `<tr data-href="projects.html?p=${p.id}">
          <td><a href="projects.html?p=${p.id}">${p.name}</a></td>
          <td class="pj-c-period muted">${period(p)}</td>
          <td class="muted">${p.decisionReason}</td>
          <td class="pj-c-period muted">${p.decidedAt} · ${who(p.decidedBy)}</td></tr>`).join('')}</tbody></table></details>`;
  }

  const FOOTER = `<b>A project is money and a deadline, not a plan.</b> What the money should
      buy — the mix, the targets — is an <i>intention</i>, so funding can exist before anybody
      has decided how to spend it, and says so on its card.
      <br><b>Proposed, Approved, Rejected is the decision; Upcoming, Active, Ended is the period.</b>
      Approving picks the priority once and approves what is pending in it; both decisions are final.
      <br><b>Planned and delivered are never added together.</b> Planned is every funded page
      on a list that exists; delivered, the ones digitized — a part of planned, not more of it.
      <br><b>Projects fund iterations, not documents.</b> A rescan in 2029 can be funded by a
      different grant than the 2019 scan of the same book.`;

  function index(note) {
    const seen = D.projects.filter(canSee);
    const live = (s) => seen.filter(p => p.state !== 'Rejected' && periodOf(p) === s);
    const proposed = seen.filter(p => p.state === 'Proposed' && periodOf(p) !== 'Ended').sort((a, b) => when(a.starts) - when(b.starts));
    const active = live('Active').filter(p => p.state === 'Approved').sort((a, b) => when(a.ends) - when(b.ends));
    const upcoming = live('Upcoming').filter(p => p.state === 'Approved').sort((a, b) => when(a.starts) - when(b.starts));
    const ended = live('Ended').sort((a, b) => when(b.ends) - when(a.ends));
    const rejected = seen.filter(p => p.state === 'Rejected').sort((a, b) => when(b.starts) - when(a.starts));
    retitle('Projects', [proposed.length && `${proposed.length} proposed`, active.length && `${active.length} active`,
      upcoming.length && `${upcoming.length} upcoming`, ended.length && `${ended.length} ended`].filter(Boolean).join(' · ')
      || (can('project.decide') || U.scopesOf(role, 'project.read').includes('any') ? 'none yet' : 'none you are on'),
      can('project.create') ? '<button class="btn btn-primary btn-sm" data-new>New project</button>' : '');
    body().innerHTML = `${note || ''}
      <div class="pj-cards">${[...proposed, ...active, ...upcoming].map(card).join('') ||
        '<p class="fine">No project is running, about to start, or waiting for a decision.</p>'}</div>
      ${endedTable(ended)}${rejectedTable(rejected)}
      <div class="budget">${FOOTER}</div>`;
  }

  /* ------------------------------------------------------------- detail */

  function detail(p, note) {
    if (!canSee(p)) return index(`<div class="status-note status-note-slate pj-saved"><span>&#9660;</span><div>
      <b>You are not on that project.</b> <span>Only its members, and whoever decides projects, see it.</span></div></div>`);
    const k = numbers(p), s = periodOf(p), ints = intentionsOf(p), { live, gone } = listsOf(p), g = groupsOf(p);
    const pace = paceOf(p, k);
    const acts = [];
    if (canDecide(p)) acts.push(`<button class="btn btn-sm btn-primary" data-approve="${p.id}">Approve…</button>`,
      `<button class="btn btn-sm" data-reject="${p.id}">Reject…</button>`);
    acts.push(U.messageButton('data-msg'));
    if (canDelete(p)) acts.push('<button class="btn btn-sm" data-del>Delete…</button>');
    if (canEdit(p)) acts.push(`<button class="btn btn-sm ${canDecide(p) ? '' : 'btn-primary'}" data-edit>Edit</button>`);
    retitle(p.name, `<a href="projects.html">Projects</a> · ${p.state}${p.state === 'Rejected' ? '' : ` · ${s}`} · ${period(p)}`, acts.join(''));

    const d = Math.round(pct(k.delivered, p.target)), t = Math.round(elapsed(p));
    const pend = byDoc(pendingOf(p)), copies = pend.filter(hasCopy);
    const status = p.state === 'Proposed'
      ? `<div class="status-note status-note-amber"><span>&#9660;</span><div><b>Proposed — waiting for a curator to approve or reject it.</b>
          <span>${pend.length ? `${n(pend.length, 'document is', 'documents are')} proposed into it. Approving approves them at the priority it picks${
            copies.length ? `, except ${copies.length} with a copy, each decided on its own as a rescan` : ''}.` : 'Nothing is proposed into it yet; members can propose while it waits.'}
          ${can('project.decide') ? '' : 'You cannot decide it: that is <code>project.decide</code>.'}</span></div></div>`
      : p.state === 'Rejected'
      ? `<div class="status-note status-note-red"><span>&#9660;</span><div><b>Rejected ${p.decidedAt} by ${who(p.decidedBy)}.</b>
          <span>${p.decisionReason} It takes no more proposals, and the decision is final — to try again, start a new project.</span></div></div>`
      : s === 'Upcoming'
      ? `<div class="status-note status-note-slate"><span>&#9660;</span><div><b>Approved · starts ${dayY(p.starts)}.</b>
          <span>${ints.length ? 'Nothing is delivered before it starts.' : 'Funded, and nothing yet says what it should buy — attach an intention before lists are generated for it.'}</span></div></div>`
      : s === 'Ended'
      ? `<div class="status-note status-note-${pace ? pace.tone : 'slate'}"><span>&#9660;</span><div><b>Ended ${dayY(p.ends)} — ${
          d >= 100 ? 'target met' : `${d}% of the target delivered`}.</b>
          <span>${M.fmt(k.delivered)} of ${M.fmt(p.target)} pages digitized${d >= 100 ? '' : `, ${M.fmt(p.target - k.delivered)} short`}. These numbers stay true — the pages it funded are funded by it forever.</span></div></div>`
      : !pace
      ? `<div class="status-note status-note-amber"><span>&#9660;</span><div><b>Running since ${dayY(p.starts)}, and nothing is funded by it yet.</b>
          <span>${daysTo(p.ends)} days left. No approved request names this project.</span></div></div>`
      : `<div class="status-note status-note-${pace.tone === 'green' ? 'green' : 'amber'}"><span>&#9660;</span><div><b>${pace.text} —
          ${d}% delivered with ${t}% of the time gone.</b>
          <span>${daysTo(p.ends)} days left. ${k.planned > k.delivered ? `${M.fmt(k.planned - k.delivered)} pp are on lists and not digitized yet.` : 'Nothing of it is on a running list.'}${
          k.waiting.length ? ` ${M.fmt(k.waitingPages)} pp more are approved and waiting for a list.` : ''}</span></div></div>`;

    const about = U.pcard('About', `
      ${p.description ? `<p style="margin-top:0">${p.description}</p>` : '<p class="fine" style="margin-top:0">No description.</p>'}
      <div class="row-kv"><span class="muted">Manager</span><span>${who(p.manager)}</span></div>
      <div class="row-kv"><span class="muted">Decision</span><span>${p.state === 'Proposed' ? 'not yet'
        : `${p.state} ${p.decidedAt} · ${who(p.decidedBy)}`}</span></div>
      ${p.priority ? `<div class="row-kv"><span class="muted">Priority</span><span>${U.prioBadge(p.priority, 'badge-xs')}
        <span class="muted">· set at approval</span></span></div>` : ''}
      ${p.priority ? `<p class="fine">Set once, at approval: the proposals approved with it took it, and it pre-fills
        those proposed after. Each item's priority is its own from then on.</p>` : ''}`);

    const progress = p.state === 'Rejected' ? '' : U.pcard('Against the target', bars(p, k, true) + (p.state === 'Approved' ? `
      <p class="fine">The mark on the planned and delivered bars is where they would be at an even
        pace. ${pace && s === 'Active' ? `Within ${PACE_SLACK} points of it reads <i>on pace</i>.` : ''}
        Delivered is a part of planned — the two are never added.</p>` : `
      <p class="fine">Nothing counts towards it until it is approved: what is proposed into it is still waiting.</p>`),
      `<span class="muted">${M.fmt(p.target)} pp</span>`);

    const props = proposalsOf(p);
    const DEC_TONE = { Pending: 'amber', Approved: 'green', Denied: 'red', Withdrawn: 'slate', Duplicate: 'slate' };
    const proposals = U.pcard(`Proposals — ${byDoc(props).length}`, props.length
      ? `<table class="sub-table"><thead><tr><th>Document</th><th>Proposed by</th><th>Decision</th></tr></thead>
        <tbody>${byDoc(props).map(r => { const doc = D.doc(r.doc);
          const flags = [r.afterApproval ? 'after the project\'s approval' : '', hasCopy(r) ? 'a copy exists' : ''].filter(Boolean);
          return `<tr><td><a href="proposals.html?doc=${r.doc}"><b>${doc.title}</b></a> <span class="mono muted">${M.docIdShort(doc)}</span>
              ${flags.length ? `<br><span class="muted">${flags.join(' · ')}</span>` : ''}</td>
            <td class="muted">${who(r.by)} · ${r.at}</td>
            <td>${U.badge(r.decision === 'Denied' ? 'Declined' : r.decision, DEC_TONE[r.decision] || 'slate', 'badge-xs')}</td></tr>`; }).join('')}</tbody></table>
        <p class="fine">${p.state === 'Approved'
          ? 'Proposed after the approval, each is decided on its own in Proposals, with this project\'s priority pre-filled.'
          : p.state === 'Proposed' ? 'Ordinary pending proposals: a curator may decide one before the project is decided.'
          : 'Rejected with the project, except where somebody else asked too.'}</p>`
      : `<p class="fine" style="margin-top:0">${p.state === 'Rejected' ? 'None.' : 'None yet. Members propose documents into it from Documents.'}</p>`);

    const intentions = p.state !== 'Approved' ? '' : U.pcard(`Intentions — ${ints.length}`, ints.length
      ? ints.map(i => { const x = intentionNumbers(i);
          return `<div class="row-kv"><span><a href="intentions.html?i=${i.id}"><b>${i.name}</b></a>
              <br><span class="muted">${mixName(i)}${
                ` · ${i.ends ? `${dayY(i.starts)} → ${dayY(i.ends)}` : `since ${dayY(i.starts)}`}`}</span></span>
            <span class="pj-int-n"><span class="num">${M.fmt(x.planned)} planned · ${M.fmt(x.delivered)} delivered</span>
              <br><span class="muted">of ${i.target ? M.fmt(i.target) + ' pp' : 'no target'}</span></span></div>`; }).join('') +
        `<p class="fine">Each counts what this project funds on lists starting in its own window — so they need not add up to the project.
          What the money should buy is set there, not here.</p>`
      : s === 'Ended'
        ? '<p class="fine" style="margin-top:0">None was attached — it ran without a stated mix. Its numbers above are all there is to report.</p>'
        : noIntention(p) + '<p class="fine">Allowed, and it says something true: the money exists, the plan does not yet.</p>');

    const lists = !k.f.length ? '' : U.pcard(`Lists — ${live.length + gone.length}`, (live.length || gone.length)
      ? live.map(l => { const m = k.f.filter(it => it.list === l.id);
          return `<div class="row-kv"><span><a href="lists.html?list=${l.id}"><b>${l.name}</b></a>
              <br><span class="muted"><span class="mono">${l.id}</span> · ${dayY(l.starts)} → ${dayY(l.ends)}</span></span>
            <span style="text-align:right">${U.badge(listState(l), listState(l) === 'Done' ? 'green' : 'blue', 'badge-xs')}
              <br><span class="muted">${m.length} of its items · ${M.fmt(sum(m))} pp</span></span></div>`; }).join('') +
        gone.map(name => { const m = k.f.filter(it => !it.list && it.listName === name);
          return `<div class="row-kv"><span>${name} <span class="muted">· no longer exists</span></span>
            <span class="muted">${m.length} of its items · not counted</span></div>`; }).join('') +
        '<p class="fine">The lists carrying items it funded. A list can mix funding — only this project\'s pages are counted here. A deleted list\'s items stop counting.</p>'
      : '<p class="fine" style="margin-top:0">None of what it funds is on a list yet.</p>');

    const RANK = (it) => M.PROGRESS.indexOf(it.progress);
    const items = k.f.slice().sort((a, b) => RANK(b) - RANK(a));
    const funded = !k.f.length && p.state !== 'Approved' ? '' : U.pcard(`What it funded — ${k.f.length}`, k.f.length
      ? `<table class="sub-table"><thead><tr><th>Document</th><th>Category</th><th>List</th>
          <th class="num">Pages</th><th>Status</th></tr></thead>
        <tbody>${items.map(it => { const doc = D.doc(it.doc);
          return `<tr><td><a href="documents.html?q=${it.id}"><b>${doc.title}</b></a> <span class="mono muted">${M.docIdShort(doc)}</span></td>
            <td class="muted">${M.catPath(D.pathOf(it.category))}</td>
            <td class="muted">${it.list ? D.listOf(it.list).name : it.listName || '—'}</td>
            <td class="num">${M.fmt(pagesOf(it))}</td>
            <td>${U.statusBadge(it, 'badge-xs')}</td></tr>`; }).join('')}</tbody></table>
        <p class="fine">Iterations, not documents — a rescan of the same book can be funded by another grant.
          <a href="documents.html?project=${p.id}">Open in Documents</a>.</p>`
      : '<p class="fine" style="margin-top:0">Nothing yet — no approved request names this project.</p>');

    const members = U.pcard('Members', `
      ${p.members.map(u => `<div class="row-kv"><span>${D.byId(u).name}</span>
        <span class="muted">${u === p.manager ? 'manager' : 'member'}</span></div>`).join('')}
      ${g.map(x => `<div class="row-kv"><span>${x.name} <span class="muted">· group</span></span>
        <span class="muted">${people(x.id)}</span></div>`).join('')}
      <p class="fine">Members propose documents into it${p.state === 'Rejected' ? ' — not any more' : ''}. A grant
        scoped to <code>project</code> means exactly these people and groups; one scoped to <code>managed</code>, its manager.</p>`,
      canMembers(p) ? '<button class="btn btn-sm" data-members>Edit</button>' : '');

    const ev = D.log.filter(e => e.subject === p.id).sort((x, y) => when(y.at) - when(x.at));
    const hist = U.pcard('History', ev.map(e => `<div class="row-kv"><span><b>${e.event}</b>${
        e.detail ? `<br><span class="muted">${e.detail}</span>` : ''}</span>
        <span class="muted" style="text-align:right">${e.at}<br>${who(e.actor)}</span></div>`).join('')
      || '<p class="fine" style="margin-top:0">Nothing recorded yet.</p>');

    body().innerHTML = `${note || ''}<div class="pj-status">${status}</div>
      <div class="pj-detail">
        <div class="pj-main">${progress}${proposals}${intentions}${lists}${funded}</div>
        <div class="pj-side">${about}${members}${hist}</div>
      </div>
      <div class="budget">${FOOTER}</div>`;
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
  const stamp = () => `${dayY(D.today)} ${new Date().toTimeString().slice(0, 5)}`;
  const logIt = (p, event, detail) => D.log.push({ subject: p.id, at: stamp(), actor: me, corr: 'k' + D.log.length, event, detail });
  const saved = (b, t) => `<div class="status-note status-note-green pj-saved"><span>&#9660;</span><div><b>${b}</b> <span>${t || ''}</span></div></div>`;

  /* one editor for create and edit — a new project is an empty one. The
     manager is not here: handing over is a members act (§3) */
  function editProject(p) {
    const isNew = !p;
    const v = p || { name: '', description: '', starts: '', ends: '', target: '' };
    const host = modal(isNew ? 'New project' : `Edit ${p.name}`, `
      <label class="fld" style="margin-top:0">Name<input id="pjName" value="${v.name}" placeholder="e.g. NDK Periodika 2027"></label>
      <label class="fld">Description <span class="muted">— what it is for; members and curators read it</span>
        <textarea id="pjDesc" rows="3">${v.description || ''}</textarea></label>
      <div class="fld-row">
        <label class="fld">Starts<input type="date" id="pjStarts" value="${v.starts}"></label>
        <label class="fld">Ends<input type="date" id="pjEnds" value="${v.ends}"></label>
      </div>
      <label class="fld">Target pages <span class="muted">— what the money should buy</span>
        <input type="number" min="1" step="100" id="pjTarget" value="${v.target}"></label>
      <p class="fine">${isNew ? `It starts <b>Proposed</b>, with you as its manager and only member. Members propose documents into it;
          a curator approves or rejects it. What the money should buy is an intention, attached once it is approved.`
        : p.state === 'Approved' ? 'Its decision and priority stay as they are.' : ''}</p>
      <div class="pj-warn" id="pjWarn"></div>
      <div class="pj-err" id="pjErr"></div>`,
      `<button class="btn foot-left" data-x>Cancel</button><button class="btn btn-primary" data-ok>${isNew ? 'Propose project' : 'Save'}</button>`);
    const $ = (id) => host.querySelector('#' + id);
    /* an approved project's dates and target stay editable — a grant can be
       extended — with a warning that its intentions' counting follows */
    const warn = () => {
      if (isNew || p.state !== 'Approved') return;
      const moved = $('pjStarts').value !== p.starts || $('pjEnds').value !== p.ends || +$('pjTarget').value !== p.target;
      const ints = intentionsOf(p);
      $('pjWarn').innerHTML = moved ? `<div class="status-note status-note-amber"><span>&#9660;</span><div>
        <b>It is approved.</b> <span>Its period and pace follow the new ${+$('pjTarget').value !== p.target ? 'target' : 'dates'}${
          ints.length ? `, and so does what ${ints.length === 1 ? 'its intention counts' : 'its intentions count'} (${ints.map(i => i.name).join(', ')})` : ''}. Nothing it funded moves.</span></div></div>` : '';
    };
    host.oninput = warn;
    host.querySelector('[data-ok]').onclick = () => {
      const x = { name: $('pjName').value.trim(), description: $('pjDesc').value.trim(), starts: $('pjStarts').value, ends: $('pjEnds').value,
                  target: +$('pjTarget').value };
      const err = !x.name ? 'A project needs a name.'
        : !x.starts || !x.ends ? 'A project is time-boxed — it needs both dates.'
        : when(x.ends) < when(x.starts) ? 'It cannot end before it starts.'
        : !(x.target > 0) ? 'Set how many pages the money should buy.' : '';
      if (err) { $('pjErr').textContent = err; return; }
      host.remove();
      if (isNew) {
        const np = Object.assign(x, { id: 'p' + (D.projects.length + 10), manager: me, members: [me], state: 'Proposed', createdAt: dayY(D.today) });
        D.projects.push(np);
        logIt(np, 'Created', `${period(np)} · ${M.fmt(np.target)} pp · proposed`);
        index(saved(`Proposed ${np.name}.`, `You manage it. Add members, who propose documents into it; a curator decides it.
          <a href="#" data-open="${np.id}">Open it</a>`));
      } else {
        const moved = x.starts !== p.starts || x.ends !== p.ends || x.target !== p.target;
        const before = `${period(p)} · ${M.fmt(p.target)} pp`;
        const textOnly = x.name !== p.name || x.description !== p.description;
        Object.assign(p, x);
        if (moved) logIt(p, 'Dates or target changed', `${before} → ${period(p)} · ${M.fmt(p.target)} pp`);
        if (textOnly) logIt(p, 'Details changed', '');
        detail(p, saved('Saved.', moved ? `Now ${periodOf(p).toLowerCase()}, ${period(p)}.` : 'Nothing it funded changed.'));
      }
    };
  }

  function editMembers(p) {
    const S = { users: p.members.slice(), groups: groupsOf(p).map(g => g.id), manager: p.manager };
    const host = modal(`Members — ${p.name}`, '<div id="pjMem"></div>',
      `<button class="btn foot-left" data-x>Cancel</button><button class="btn btn-primary" data-ok>Save members</button>`);
    const box = host.querySelector('#pjMem');
    function draw() {
      const freeU = D.users.filter(u => u.kind === 'person' && !S.users.includes(u.id));
      const freeG = D.groups.filter(g => !S.groups.includes(g.id));
      box.innerHTML = `
        <label class="fld" style="margin-top:0">Manager <span class="muted">— edits it and its members; always a member</span>
          <select id="pjMgr">${S.users.map(u => `<option value="${u}" ${u === S.manager ? 'selected' : ''}>${D.byId(u).name}</option>`).join('')}</select></label>
        ${S.manager !== p.manager ? `<p class="fine">Handing over: ${who(p.manager)} stays a member until removed.</p>` : ''}
        <div class="fld">People</div>
        ${S.users.map(u => `<div class="row-kv"><span>${D.byId(u).name}</span>${u === S.manager
          ? '<span class="muted">manager</span>' : `<button class="btn btn-sm" data-rmu="${u}">Remove</button>`}</div>`).join('')}
        ${freeU.length ? `<select class="addfilter pj-add" data-addu><option value="">+ Add a person…</option>${
          freeU.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}</select>` : ''}
        <div class="fld">Groups <span class="muted">— everyone in it is a member while they are in it</span></div>
        ${S.groups.map(id => { const g = D.groups.find(x => x.id === id);
          return `<div class="row-kv"><span>${g.name} <span class="muted">· ${people(id)}</span></span>
            <button class="btn btn-sm" data-rmg="${id}">Remove</button></div>`; }).join('') ||
          '<p class="fine" style="margin-top:.25rem">No group.</p>'}
        ${freeG.length ? `<select class="addfilter pj-add" data-addg><option value="">+ Add a group…</option>${
          freeG.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}</select>` : ''}
        <p class="fine">Members propose documents into it. Removing someone leaves what they proposed in the project.</p>`;
    }
    draw();
    box.onclick = (e) => {
      const u = e.target.closest('[data-rmu]'), g = e.target.closest('[data-rmg]');
      if (u) { S.users = S.users.filter(x => x !== u.dataset.rmu); draw(); }
      if (g) { S.groups = S.groups.filter(x => x !== g.dataset.rmg); draw(); }
    };
    box.onchange = (e) => {
      if (e.target.id === 'pjMgr') { S.manager = e.target.value; return draw(); }
      if (!e.target.value) return;
      if (e.target.matches('[data-addu]')) S.users.push(e.target.value);
      if (e.target.matches('[data-addg]')) S.groups.push(e.target.value);
      draw();
    };
    host.querySelector('[data-ok]').onclick = () => {
      const addU = S.users.filter(u => !p.members.includes(u)), rmU = p.members.filter(u => !S.users.includes(u));
      const addG = S.groups.filter(id => !groupsOf(p).some(g => g.id === id)), rmG = groupsOf(p).filter(g => !S.groups.includes(g.id));
      addU.forEach(u => logIt(p, 'Member added', who(u)));
      rmU.forEach(u => logIt(p, 'Member removed', `${who(u)} — their proposals stay in the project`));
      addG.forEach(id => logIt(p, 'Member added', D.groups.find(g => g.id === id).name + ' (group)'));
      rmG.forEach(g => logIt(p, 'Member removed', g.name + ' (group)'));
      if (S.manager !== p.manager) logIt(p, 'Manager changed', `${who(p.manager)} → ${who(S.manager)}`);
      p.members = S.users; p.manager = S.manager;
      D.groups.forEach(g => {
        const on = S.groups.includes(g.id), was = g.projects.includes(p.id);
        if (on && !was) g.projects.push(p.id);
        if (!on && was) g.projects = g.projects.filter(x => x !== p.id);
      });
      host.remove();
      detail(p, saved('Members saved.', `${addU.length + addG.length} added, ${rmU.length + rmG.length} removed.`));
    };
  }

  /* the decision, said before it is made (projects.md §4) */
  function decide(p, approve) {
    const pend = byDoc(pendingOf(p));
    const take = pend.filter(r => !hasCopy(r)), skip = pend.filter(hasCopy);
    const others = pend.filter(othersAsk);
    const docLine = (r) => `<li>${D.doc(r.doc).title} <span class="mono muted">${M.docIdShort(D.doc(r.doc))}</span></li>`;
    const host = approve
      ? modal(`Approve ${p.name}`, `
        <label class="fld" style="margin-top:0">Priority <span class="muted">— set once; the proposals approved with it take it</span>
          <select id="pjPrio">${M.PRIORITY_DESC.map(x => `<option ${x === 'Normal' ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <div class="fld">It approves <span class="muted">— ${n(take.length, 'document', 'documents')} pending in it</span></div>
        ${take.length ? `<ul class="pj-list">${take.map(docLine).join('')}</ul>` : '<p class="fine" style="margin-top:.25rem">Nothing is pending in it.</p>'}
        ${skip.length ? `<div class="fld">It skips <span class="muted">— a copy exists; each is decided on its own, as a rescan</span></div>
          <ul class="pj-list">${skip.map(docLine).join('')}</ul>` : ''}
        <p class="fine">Approved is final. Proposals made after it carry <i>after the project's approval</i> and are decided
          on their own in Proposals, with this priority pre-filled. Each needs a category there before it moves on.</p>`,
        `<button class="btn foot-left" data-x>Cancel</button><button class="btn btn-primary" data-ok>Approve${take.length ? ` and ${n(take.length, 'proposal', 'proposals')}` : ''}</button>`)
      : modal(`Reject ${p.name}`, `
        <label class="fld" style="margin-top:0">Reason <span class="muted">— every member reads it</span>
          <textarea id="pjWhy" rows="3" placeholder="Why it is not going ahead"></textarea></label>
        ${pend.length ? `<div class="fld">Its proposals</div>
          <ul class="pj-list">${pend.map(r => `<li>${D.doc(r.doc).title} <span class="muted">— ${othersAsk(r)
            ? 'others asked for it too: only the project\'s request is rejected, theirs stay' : 'declined'}</span></li>`).join('')}</ul>` : ''}
        <p class="fine">Rejected is final and takes no more proposals. To try again, start a new project.</p>
        <div class="pj-err" id="pjErr"></div>`,
        `<button class="btn foot-left" data-x>Cancel</button><button class="btn btn-danger" data-ok>Reject project</button>`);
    host.querySelector('[data-ok]').onclick = () => {
      if (approve) {
        const prio = host.querySelector('#pjPrio').value;
        Object.assign(p, { state: 'Approved', priority: prio, decidedBy: me, decidedAt: dayY(D.today) });
        take.forEach(r => pendingOf(p).filter(x => x.doc === r.doc).forEach(x => { x.decision = 'Approved'; x.viaProject = true; }));
        logIt(p, 'Approved', `priority ${prio} · ${n(take.length, 'proposal', 'proposals')} approved${skip.length ? ` · ${skip.length} skipped (a copy exists)` : ''}`);
        host.remove();
        detail(p, saved(`Approved at ${prio} priority.`, `${n(take.length, 'proposal', 'proposals')} approved with it${
          skip.length ? `; ${skip.length} left in Proposals to decide as a rescan` : ''}.`));
      } else {
        const why = host.querySelector('#pjWhy').value.trim();
        if (!why) { host.querySelector('#pjErr').textContent = 'A rejection needs a reason — every member reads it.'; return; }
        Object.assign(p, { state: 'Rejected', decisionReason: why, decidedBy: me, decidedAt: dayY(D.today) });
        pendingOf(p).forEach(r => { r.decision = 'Denied'; r.declinePublic = why; });
        logIt(p, 'Rejected', why);
        host.remove();
        detail(p, saved('Rejected.', `Its members read the reason. ${others.length ? `${n(others.length, 'document stays', 'documents stay')} with the others who asked.` : ''}`));
      }
    };
  }

  function del(p) {
    const host = modal(`Delete ${p.name}?`, `<p style="margin-top:0">Nothing has been proposed into it, so nothing depends on it.
        It goes, and its history says it was deleted.</p>`,
      `<button class="btn foot-left" data-x>Cancel</button><button class="btn btn-danger" data-ok>Delete project</button>`);
    host.querySelector('[data-ok]').onclick = () => {
      logIt(p, 'Deleted', 'it had no proposals');
      D.projects.splice(D.projects.indexOf(p), 1);
      host.remove();
      history.pushState(null, '', 'projects.html');
      index(saved(`Deleted ${p.name}.`));
    };
  }

  /* messaging.md §3 — a project's manager; the manager may message its members */
  function messageAbout(p) {
    const mine = p.manager === me;
    U.message({ about: p.name, link: `projects.html?p=${p.id}`, sender: me,
      context: `${p.name} · ${p.state}${p.state === 'Rejected' ? '' : ` · ${periodOf(p)}`}`,
      to: mine ? p.members : [p.manager], toLabel: mine ? 'its members' : 'its manager' });
  }

  /* -------------------------------------------------------------- shell */

  U.mount({ tier, active: 'projects', role, title: 'Projects', body: '<div id="pj"></div>' });
  const body = () => document.getElementById('pj');
  function retitle(title, sub, actions) {
    const bar = document.querySelector('.topbar');
    bar.querySelector('h1').textContent = title;
    let p = bar.querySelector('.titles p');
    if (!p) { p = document.createElement('p'); bar.querySelector('.titles').appendChild(p); }
    p.innerHTML = sub;
    bar.querySelector('.topbar-actions').innerHTML = actions;
  }

  const current = () => D.proj(new URLSearchParams(location.search).get('p'));
  document.querySelector('.main').addEventListener('click', (e) => {
    if (e.target.closest('[data-new]')) return editProject(null);
    if (e.target.closest('[data-edit]')) return editProject(current());
    if (e.target.closest('[data-members]')) return editMembers(current());
    if (e.target.closest('[data-del]')) return del(current());
    if (e.target.closest('[data-msg]')) return messageAbout(current());
    const ap = e.target.closest('[data-approve]'), rj = e.target.closest('[data-reject]');
    if (ap) return decide(D.proj(ap.dataset.approve), true);
    if (rj) return decide(D.proj(rj.dataset.reject), false);
    const o = e.target.closest('[data-open]');
    if (o) { e.preventDefault(); history.pushState(null, '', `projects.html?p=${o.dataset.open}`); return detail(D.proj(o.dataset.open)); }
    /* the whole card or row is the way in; a link inside it is still a link */
    const card = e.target.closest('[data-href]');
    if (card && !e.target.closest('a, button, summary')) location.href = card.dataset.href;
  });

  const p = D.proj(q.get('p'));
  p ? detail(p) : index();
};
