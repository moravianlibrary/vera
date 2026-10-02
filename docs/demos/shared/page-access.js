/* Users & Groups — /access   (view-catalog Users & Groups, permissions,
   identity, proposal-custody)
   ONE view, three linked columns, the user in the middle (redrawn
   2026-10-01, after groups stopped giving roles):

     Roles  ←  Users  →  Groups · Proposal custodies

   Left answers "what may this person do": a role is held BY HAND or MAPPED
   by an Identity plugin from a claim — never through a group. Right answers
   "what are they responsible for": groups, and the proposal custodies they
   are in, directly or via a group. Selecting anything lights up what it is
   connected to and draws the links; the record opens underneath.

   Every capability is shown WITH ITS PROVENANCE (permissions §6): not
   "Jana: curator" but "curator — mapped by MZK Keycloak from group
   mzk-curators". Category custody is SHOWN here and edited on Categories;
   proposal custodies and their members are edited here, the rules that
   place proposals in them on Plugins.                                     */

window.PAGE_ACCESS = function (tier) {
  const M = VERA, D = VERA_DATA, U = VERA_UI;
  const role = U.currentRole('admin');
  const held = U.permsOf(role);
  const can = (p) => held.has(p);
  const q = new URLSearchParams(location.search);
  const TABS = tier === 'phone';

  /* ------------------------------------------------------------ records */
  const user = (id) => D.users.find(u => u.id === id);
  const group = (id) => D.groups.find(g => g.id === id);
  const roleOf = (id) => D.roles.find(r => r.id === id);
  const cust = (id) => D.proposalCustodies.find(c => c.id === id);
  const membersOf = (g) => D.users.filter(u => u.groups.includes(g.id));
  const catName = (c) => M.catPath(D.pathOf(c));
  const SCOPE_RANK = { custody: 1, project: 1, managed: 1, any: 2 };
  const idps = D.pluginTypes.filter(t => t.kind === 'Identity').flatMap(t => t.instances).sort((a, b) => a.order - b.order);
  const idp = (id) => idps.find(i => i.id === id) || { name: id };

  /* effective roles, each with every way it arrives: 'hand', or a mapping */
  function rolesOf(u) {
    const out = new Map();
    const add = (r, how) => { if (!out.has(r)) out.set(r, []); out.get(r).push(how); };
    u.roles.forEach(r => add(r, { by: 'hand' }));
    (u.mapped || []).forEach(m => add(m.role, { by: 'map', idp: m.idp, claim: m.claim }));
    return [...out.entries()].map(([r, how]) => ({ role: r, how }));
  }
  const howText = (h) => h.by === 'hand' ? 'by hand' : `mapped by ${idp(h.idp).name} from ${h.claim}`;
  const howShort = (how) => how.map(h => h.by === 'hand' ? 'by hand' : 'mapped').join(' and ');
  const mappedOnly = (how) => how.every(h => h.by === 'map');
  const holdersOf = (r) => D.users.map(u => ({ u, how: (rolesOf(u).find(x => x.role === r.id) || {}).how })).filter(x => x.how);
  /* which Identity instances give a role, and how */
  const mappingsOf = (r) => idps.flatMap(i => [
    ...(i.defaultRole === r.id ? [{ i, claim: 'default role — everyone first seen here' }] : []),
    ...(i.maps || []).filter(([, rr]) => rr === r.id).map(([claim]) => ({ i, claim }))]);

  /* custody and projects a user reaches — read-only here */
  function custodyOf(u) {
    const out = [];
    Object.entries(D.categoryMembers || {}).forEach(([c, ids]) => ids.includes(u.id) && out.push({ c, via: 'direct' }));
    u.groups.forEach(gid => (group(gid).categories || []).forEach(c => out.push({ c, via: gid })));
    return out;
  }
  function pcustOf(u) {
    const out = [];
    D.proposalCustodies.forEach(c => {
      if (c.users.includes(u.id)) out.push({ c, via: 'direct' });
      c.groups.filter(g => u.groups.includes(g)).forEach(g => out.push({ c, via: g }));
    });
    return out;
  }
  const custMembers = (c) => {
    const m = new Map();
    c.users.forEach(id => m.set(id, ['direct']));
    c.groups.forEach(g => membersOf(group(g)).forEach(u => m.set(u.id, [...(m.get(u.id) || []), g])));
    return [...m.entries()].map(([id, via]) => ({ u: user(id), via }));
  };
  function projectsOf(u) {
    const out = [];
    D.projects.forEach(p => (p.members || []).includes(u.id) && out.push({ p, via: p.manager === u.id ? 'manager' : 'direct' }));
    u.groups.forEach(gid => (group(gid).projects || []).forEach(p => out.push({ p: D.proj(p), via: gid })));
    return out;
  }
  /* effective permissions: widest scope wins, every role that gives it kept */
  function permsOf(u) {
    const out = new Map();
    rolesOf(u).forEach(({ role: rid, how }) => (roleOf(rid) || { grants: [] }).grants.forEach(([k, sc]) => {
      const cur = out.get(k);
      if (!cur) out.set(k, { k, scope: sc, from: [{ rid, how }] });
      else { cur.from.push({ rid, how }); if (sc && SCOPE_RANK[sc] > SCOPE_RANK[cur.scope]) cur.scope = sc; }
    }));
    return out;
  }
  /* what a custody member can actually do with its proposals */
  const reach = (u) => { const p = permsOf(u);
    const s = (k) => p.has(k) && (p.get(k).scope === 'custody' || p.get(k).scope === 'any');
    return s('request.decide') ? 'decides' : s('request.read') ? 'sees' : null; };
  /* a role "includes" another when it holds every grant of it at least as wide */
  const covers = (a, b) => a !== b && b.grants.length && b.grants.every(([k, sc]) => a.grants.some(([k2, sc2]) =>
    k2 === k && (!sc || sc2 === sc || SCOPE_RANK[sc2] > SCOPE_RANK[sc])));
  const includes = (r) => { const inc = D.roles.filter(o => covers(r, o));
    return inc.filter(o => !inc.some(x => x !== o && covers(x, o))); };

  /* ---------------------------------------------------------- selection */
  const T = { u: user, g: group, r: roleOf, c: cust };
  let sel = ['g', 'r', 'c'].map(t => q.get(t) && T[t](q.get(t)) ? { t, id: q.get(t) } : null).find(Boolean)
    || { t: 'u', id: q.get('u') && user(q.get('u')) ? q.get('u') : 'u1' };
  let tab = TABS ? (q.get('col') || { u: 'users', g: 'groups', r: 'roles', c: 'custodies' }[sel.t]) : null;
  let query = '';
  const kindF = () => q.get('kind') || '';

  /* what the selection is connected to: key → tag text. Lines always run
     left → right: role → user → group / custody. Mapped-only is dashed. */
  function links() {
    const L = { u: new Map(), g: new Map(), r: new Map(), c: new Map() }, lines = [];
    if (sel.t === 'u') {
      const u = user(sel.id);
      rolesOf(u).forEach(({ role: r, how }) => { L.r.set(r, howShort(how)); lines.push(['r:' + r, 'u:' + u.id, mappedOnly(how) ? 'map' : '']); });
      u.groups.forEach(g => { L.g.set(g, 'member'); lines.push(['u:' + u.id, 'g:' + g]); });
      pcustOf(u).forEach(({ c, via }) => { L.c.set(c.id, via === 'direct' ? 'member' : 'via ' + group(via).name); lines.push(['u:' + u.id, 'c:' + c.id, via === 'direct' ? '' : 'map']); });
    } else if (sel.t === 'g') {
      const g = group(sel.id);
      membersOf(g).forEach(u => { L.u.set(u.id, 'member'); lines.push(['u:' + u.id, 'g:' + g.id]); });
      D.proposalCustodies.filter(c => c.groups.includes(g.id)).forEach(c => L.c.set(c.id, 'held by this group'));
    } else if (sel.t === 'r') {
      const r = roleOf(sel.id);
      holdersOf(r).forEach(({ u, how }) => { L.u.set(u.id, howShort(how)); lines.push(['r:' + r.id, 'u:' + u.id, mappedOnly(how) ? 'map' : '']); });
    } else {
      const c = cust(sel.id);
      custMembers(c).forEach(({ u, via }) => {
        L.u.set(u.id, via.includes('direct') ? 'member' : 'via ' + via.map(g => group(g).name).join(', '));
        if (via.includes('direct')) lines.push(['u:' + u.id, 'c:' + c.id]);
        via.filter(v => v !== 'direct').forEach(g => lines.push(['u:' + u.id, 'g:' + g, 'map']));
      });
      c.groups.forEach(g => L.g.set(g, 'member of it'));
    }
    return { L, lines };
  }

  /* ------------------------------------------------------------ columns */
  const match = (s) => !query || s.toLowerCase().includes(query);
  function item(t, id, title, sub, tag, extra) {
    const on = sel.t === t && sel.id === id;
    const dim = !on && !tag && sel.t !== t;
    return `<div class="ac-item ${on ? 'on' : ''} ${tag ? 'linked' : ''} ${dim ? 'dim' : ''}" data-sel="${t}:${id}" id="ac-${t}-${id}" tabindex="0" role="button">
      <div class="ac-item-main"><div class="ac-item-title">${title}${extra || ''}</div><div class="t-sub">${sub}</div></div>
      ${tag ? `<span class="ac-tag ${/hand/.test(tag) ? 'ac-tag-d' : ''}">${tag}</span>` : ''}</div>`;
  }
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  const head = (h, n) => `<div class="ac-col-head"><h2>${h}</h2><span class="muted">${n}</span></div>`;
  function columns() {
    const { L } = links();
    const us = D.users.filter(u => match(u.name + ' ' + (u.email || '')) &&
      (!kindF() || (kindF() === 'none' ? !rolesOf(u).length : u.kind === kindF())));
    const gs = D.groups.filter(g => match(g.name));
    const cs = D.proposalCustodies.filter(c => match(c.name));
    const rs = D.roles.filter(r => match(r.name));
    const colR = `<section class="ac-col" data-col="roles">${head('Roles', rs.length)}
      ${rs.map(r => item('r', r.id, r.name, `${r.grants.length} grants · ${n(holdersOf(r).length, 'person', 'people')}`, L.r.get(r.id),
        r.shipped ? '' : ' ' + U.badge('custom', 'blue', 'badge-xs'))).join('') || '<p class="fine">No role matches.</p>'}</section>`;
    const colU = `<section class="ac-col" data-col="users">${head('Users', us.length)}
      ${us.map(u => { const rr = rolesOf(u).map(x => x.role);
        return item('u', u.id, u.name, rr.length ? rr.join(', ') : '<span class="ac-none">no role yet — sees nothing</span>',
          L.u.get(u.id), u.kind === 'agent' ? ' ' + U.badge('agent', 'purple', 'badge-xs') : ''); }).join('') || '<p class="fine">Nobody matches.</p>'}</section>`;
    const groupsHTML = `${head('Groups', gs.length)}
      ${gs.map(g => item('g', g.id, g.name, n(membersOf(g).length, 'member', 'members'), L.g.get(g.id))).join('') || '<p class="fine">No group matches.</p>'}`;
    const custHTML = `${head('Proposal custodies', cs.length)}
      ${cs.map(c => item('c', c.id, c.name, `${n(c.open, 'open proposal', 'open proposals')} · ${n(custMembers(c).length, 'person', 'people')}`, L.c.get(c.id),
        c.fallback ? ' ' + U.badge('fallback', 'amber', 'badge-xs') : '')).join('') || '<p class="fine">No custody matches.</p>'}`;
    if (TABS) {
      const cur = tab || 'users';
      const body = { roles: colR, users: colU, groups: `<section class="ac-col" data-col="groups">${groupsHTML}</section>`,
        custodies: `<section class="ac-col" data-col="custodies">${custHTML}</section>` }[cur];
      return `<div class="viewtabs in-tabs">${[['users', 'Users', D.users.length], ['roles', 'Roles', D.roles.length], ['groups', 'Groups', D.groups.length], ['custodies', 'Custodies', D.proposalCustodies.length]]
        .map(([k, l, n]) => `<a href="#" data-col="${k}" class="${k === cur ? 'current' : ''}">${l} <span class="in-tab-n">${n}</span></a>`).join('')}</div>
        <div class="ac-cols ac-one">${body}</div>`;
    }
    return `<div class="ac-wrap"><svg class="ac-svg" aria-hidden="true"></svg><div class="ac-cols">${colR}${colU}
      <section class="ac-col" data-col="groups">${groupsHTML}<div class="ac-col-gap"></div>${custHTML}</section></div></div>`;
  }

  /* draw the links in the gutters, left element's right edge → right
     element's left edge */
  function drawLines() {
    const svg = document.querySelector('.ac-svg');
    if (!svg) return;
    const box = svg.parentElement.getBoundingClientRect();
    svg.setAttribute('width', box.width); svg.setAttribute('height', box.height);
    const pt = (key, side) => { const [t, id] = key.split(':'); const el = document.getElementById(`ac-${t}-${id}`);
      if (!el) return null; const b = el.getBoundingClientRect();
      return { x: (side === 'r' ? b.right : b.left) - box.left, y: b.top + b.height / 2 - box.top }; };
    svg.innerHTML = links().lines.map(([a, b, kind]) => {
      const p = pt(a, 'r'), r = pt(b, 'l');
      if (!p || !r) return '';
      const mx = (p.x + r.x) / 2;
      return `<path class="ac-ln ${kind === 'map' ? 'ac-ln-d' : ''}" d="M${p.x},${p.y} C${mx},${p.y} ${mx},${r.y} ${r.x},${r.y}"/>`;
    }).join('');
  }

  /* ------------------------------------------------------------- detail */
  const chipRole = (r) => `<a href="#" class="ac-chip" data-sel="r:${r}">${r}</a>`;
  const chipGroup = (g) => `<a href="#" class="ac-chip ac-chip-g" data-sel="g:${g}">${group(g).name}</a>`;
  const chipCust = (c) => `<a href="#" class="ac-chip" data-sel="c:${c}">${cust(c).name}</a>`;
  const viaG = (v) => v === 'direct' ? 'member' : v === 'manager' ? 'manager' : `via ${chipGroup(v)}`;
  const howHTML = (how) => how.map(h => h.by === 'hand' ? '<span class="ac-tag ac-tag-d">by hand</span>'
    : `mapped by <a href="plugins.html?i=${h.idp}">${idp(h.idp).name}</a> <span class="muted">from ${h.claim}</span>`).join(' and ');
  const none = '<p class="fine" style="margin-top:0">None.</p>';
  const custodyHTML = (list) => list.length ? list.map(x => `<div class="row-kv"><span><a href="categories.html?c=${x.c}">${catName(x.c)}</a>
      <span class="muted">and everything under it</span></span><span class="muted">${x.via === 'direct' ? 'direct' : 'via ' + group(x.via).name}</span></div>`).join('') : none;
  const custodyFoot = `<p class="fine">Category custody is granted on <a href="categories.html">Categories</a>, from the branch — not here.</p>`;
  const NOROLE = '<p class="fine">A group never gives a role. Roles are set by hand here, or mapped by an Identity plugin from a claim.</p>';

  function permTable(entries, showFrom) {
    const byGroup = new Map();
    entries.forEach(e => { const p = D.permission(e.k); if (!p) return;
      if (!byGroup.has(p.group)) byGroup.set(p.group, []); byGroup.get(p.group).push(Object.assign({ p }, e)); });
    const order = D.PERMISSIONS.map(([g]) => g);
    return `<div class="ac-perms">${order.filter(g => byGroup.has(g)).map(g => `<div class="ac-pgroup"><h4>${g}</h4>
      ${byGroup.get(g).map(e => `<div class="ac-perm"><span class="mono">${e.k}</span>
        <span class="ac-scope ac-scope-${e.scope || 'self'}">${e.scope || 'own'}</span>
        ${showFrom ? `<span class="ac-from">${[...new Set(e.from.map(f => f.rid))].map(rid =>
          `${rid} <span class="muted">${howShort(e.from.filter(f => f.rid === rid).flatMap(f => f.how))}</span>`).join(', ')}</span>` : ''}</div>`).join('')}</div>`).join('')}</div>`;
  }

  function detailUser(u) {
    const rr = rolesOf(u), perms = [...permsOf(u).values()];
    const acts = can('access.manage') ? `<button class="btn btn-sm" data-uroles="${u.id}">Roles…</button>
      <button class="btn btn-sm" data-ugroups="${u.id}">Groups…</button>
      ${u.kind === 'person' ? `<button class="btn btn-sm" data-ulink="${u.id}">Link identity…</button>` : ''}` : '';
    const first = (u.identities || [])[0];
    return `<div class="ac-dhead"><div><h2>${u.name} ${u.kind === 'agent' ? U.badge('agent', 'purple', 'badge-xs') : ''}</h2>
      <div class="t-sub">${u.kind === 'agent' ? `A plugin acting as a user — enters through <b>${u.entry}</b>, so what it proposes goes through review. It never logs in.` : u.email}</div></div>
      <div class="ac-dacts">${acts}</div></div>
      ${!rr.length ? `<div class="status-note status-note-amber"><span>&#9660;</span><div><b>No access yet.</b> <span>They logged in through ${first ? idp(first.idp).name : 'an identity provider'}, whose default role is none, and see <i>You have no access yet</i>. Give them a role — <i>reader</i> at least.</span></div></div>` : ''}
      <div class="ac-dgrid">
        <div><h3>Roles — and how</h3>
          ${rr.map(x => `<div class="row-kv"><span>${chipRole(x.role)}</span><span>${howHTML(x.how)}</span></div>`).join('') || none}
          ${rr.some(x => x.how.length > 1) ? '<p class="fine">Held two ways — that is not a conflict. Remove the hand-set one and the mapped one still holds.</p>' : ''}
          ${rr.some(x => x.how.some(h => h.by === 'map')) ? '<p class="fine">Mapped roles follow the provider: they are checked again at every login. Change them there, or the mapping on Plugins.</p>' : ''}
          <h3>Signs in with</h3>
          ${(u.identities || []).map(i => `<div class="row-kv"><span><a href="plugins.html?i=${i.idp}">${idp(i.idp).name}</a> <span class="mono">${i.ext}</span></span><span class="muted">last ${i.last}</span></div>`).join('')
            || `<p class="fine" style="margin-top:0">${u.kind === 'agent' ? 'Nothing — an agent has no identity.' : 'No identity linked.'}</p>`}
          <h3>Groups</h3>
          ${u.groups.map(g => `<div class="row-kv"><span>${chipGroup(g)}</span><span class="muted">${group(g).description || ''}</span></div>`).join('') || none}
        </div>
        <div><h3>Category custody</h3>${custodyHTML(custodyOf(u))}${custodyFoot}
          <h3>Proposal custody</h3>
          ${pcustOf(u).map(x => `<div class="row-kv"><span>${chipCust(x.c.id)}</span><span class="muted">${x.via === 'direct' ? 'member' : 'via ' + group(x.via).name}</span></div>`).join('') || none}
          ${pcustOf(u).length && !reach(u) ? '<p class="fine">A member, but no role of theirs reaches proposals — they see nothing in it.</p>' : ''}
          <h3>Projects</h3>
          ${projectsOf(u).map(x => `<div class="row-kv"><span><a href="projects.html?p=${x.p.id}">${x.p.name}</a></span><span class="muted">${x.via === 'direct' ? 'member' : x.via === 'manager' ? 'manager' : 'via ' + group(x.via).name}</span></div>`).join('') || none}
        </div>
      </div>
      <h3>What they can do <span class="muted">· ${perms.length} permissions, and which role each comes from</span></h3>
      ${perms.length ? permTable(perms, true) : '<p class="fine">Nothing.</p>'}`;
  }
  function confersText(g) {
    const bits = [];
    if ((g.categories || []).length) bits.push('custody of ' + g.categories.map(catName).join(' and ') + ' and everything under it');
    const pc = D.proposalCustodies.filter(c => c.groups.includes(g.id));
    if (pc.length) bits.push('the proposal custod' + (pc.length > 1 ? 'ies ' : 'y ') + pc.map(c => c.name).join(' and '));
    if ((g.projects || []).length) bits.push('membership of ' + g.projects.map(p => D.proj(p).name).join(' and '));
    return bits.length ? bits.join(', ') : 'nothing yet — the group holds no custody and no project';
  }
  function detailGroup(g) {
    const ms = membersOf(g);
    const acts = can('access.manage') ? `<button class="btn btn-sm" data-gedit="${g.id}">Edit…</button>
      <button class="btn btn-sm" data-gmembers="${g.id}">Members…</button>` : '';
    const pc = D.proposalCustodies.filter(c => c.groups.includes(g.id));
    return `<div class="ac-dhead"><div><h2>${g.name}</h2><div class="t-sub">${g.description || ''}</div></div><div class="ac-dacts">${acts}</div></div>
      <div class="status-note status-note-blue"><span>&#9660;</span><div><b>Adding somebody here gives them</b> <span>${confersText(g)}.</span></div></div>
      <div class="ac-dgrid">
        <div><h3>Members · ${ms.length}</h3>
          ${ms.map(u => `<div class="row-kv"><span><a href="#" data-sel="u:${u.id}">${u.name}</a>${u.kind === 'agent' ? ' ' + U.badge('agent', 'purple', 'badge-xs') : ''}</span>
              <span class="muted">${rolesOf(u).map(x => x.role).join(', ') || 'no role'}</span></div>`).join('') || '<p class="fine" style="margin-top:0">Nobody yet.</p>'}
          ${NOROLE}
        </div>
        <div><h3>Category custody</h3>${(g.categories || []).length ? g.categories.map(c => `<div class="row-kv"><span><a href="categories.html?c=${c}">${catName(c)}</a> <span class="muted">and everything under it</span></span></div>`).join('') : none}${custodyFoot}
          <h3>Proposal custody</h3>${pc.map(c => `<div class="row-kv"><span>${chipCust(c.id)}</span><span class="muted">${c.open} open</span></div>`).join('') || none}
          <h3>Projects</h3>${(g.projects || []).map(p => `<div class="row-kv"><span><a href="projects.html?p=${p}">${D.proj(p).name}</a></span></div>`).join('') || none}
        </div>
      </div>`;
  }
  function detailRole(r) {
    const hs = holdersOf(r), inc = includes(r), maps = mappingsOf(r);
    const acts = can('access.manage') ? `<button class="btn btn-sm" data-redit="${r.id}">Edit grants…</button>
      <button class="btn btn-sm" data-rcopy="${r.id}">Duplicate</button>
      <button class="btn btn-sm btn-danger" data-rdel="${r.id}">Delete…</button>` : '';
    return `<div class="ac-dhead"><div><h2>${r.name} ${r.shipped ? U.badge('shipped', 'slate', 'badge-xs') : U.badge('custom', 'blue', 'badge-xs')}</h2>
      <div class="t-sub">${r.description || ''}${inc.length ? ` · includes everything ${inc.map(o => chipRole(o.id)).join(' and ')} has` : ''}</div></div><div class="ac-dacts">${acts}</div></div>
      <div class="ac-dgrid">
        <div><h3>Held by · ${hs.length}</h3>
          ${hs.map(({ u, how }) => `<div class="row-kv"><span><a href="#" data-sel="u:${u.id}">${u.name}</a></span><span>${howHTML(how)}</span></div>`).join('') || '<p class="fine" style="margin-top:0">Nobody.</p>'}</div>
        <div><h3>Mapped by identity providers</h3>
          ${maps.map(({ i, claim }) => `<div class="row-kv"><span><a href="plugins.html?i=${i.id}">${i.name}</a></span><span class="muted">${claim}</span></div>`).join('')
            || '<p class="fine" style="margin-top:0">No mapping gives it — only by hand.</p>'}
          <p class="fine">Mappings are set on the Identity instance, on <a href="plugins.html?kind=Identity">Plugins</a>.</p></div>
      </div>
      <h3>Grants · ${r.grants.length} <span class="muted">· <i>own</i> is self-scoped: it acts on the holder's own records and has no scope to choose · <i>managed</i> is a project they manage</span></h3>
      ${r.grants.length ? permTable(r.grants.map(([k, scope]) => ({ k, scope })), false) : '<p class="fine">None — whoever holds only this role sees nothing.</p>'}`;
  }
  function detailCust(c) {
    const ms = custMembers(c);
    const rules = D.pluginTypes.filter(t => t.kind === 'Custody').flatMap(t => t.instances.map(i => ({ t, i })))
      .filter(({ i }) => (i.names || []).includes(c.name));
    const acts = can('access.manage') ? `<button class="btn btn-sm" data-cedit="${c.id}">Edit…</button>
      <button class="btn btn-sm" data-cmembers="${c.id}">Members…</button>
      ${c.fallback ? '' : `<button class="btn btn-sm btn-danger" data-cdel="${c.id}">Delete…</button>`}` : '';
    const RL = { decides: 'decides', sees: 'sees only' };
    return `<div class="ac-dhead"><div><h2>${c.name} ${c.fallback ? U.badge('fallback', 'amber', 'badge-xs') : ''}</h2>
      <div class="t-sub">${c.description || ''} · <a href="proposals.html">${c.open} open proposals</a></div></div><div class="ac-dacts">${acts}</div></div>
      <div class="status-note status-note-blue"><span>&#9660;</span><div><b>${c.fallback ? 'What no rule placed lands here.' : 'Which proposals are in it is a rule’s answer, never typed in.'}</b>
        <span>${c.fallback ? 'Every Custody rule answered nothing for these. It cannot be deleted. With no members, only admins see them.'
          : rules.length ? `Placed by ${rules.map(({ i }) => `<a href="plugins.html?i=${i.id}">${i.name}</a>`).join(', ')}, on Plugins. To move a proposal, change the rule.`
          : 'No Custody rule names it yet, so it holds nothing. Add its name to a rule on Plugins.'}</span></div></div>
      <div class="ac-dgrid">
        <div><h3>Members · ${ms.length}</h3>
          ${ms.map(({ u, via }) => { const r = reach(u);
            return `<div class="row-kv"><span><a href="#" data-sel="u:${u.id}">${u.name}</a> <span class="muted">${via.map(v => v === 'direct' ? 'direct' : 'via ' + group(v).name).join(' and ')}</span></span>
              <span class="${r ? 'muted' : 'ac-none'}">${r ? RL[r] : 'no role reaches it'}</span></div>`; }).join('') || '<p class="fine" style="margin-top:0">Nobody.</p>'}
          <p class="fine">Membership is not capability: a member decides only with <span class="mono">request.decide</span>, and sees only with <span class="mono">request.read</span>, through a role.</p></div>
        <div><h3>Groups in it</h3>
          ${c.groups.map(g => `<div class="row-kv"><span>${chipGroup(g)}</span><span class="muted">${membersOf(group(g)).length} members</span></div>`).join('') || none}</div>
      </div>`;
  }

  /* ------------------------------------------------------------- modals */
  function modal(title, bodyHTML, foot, wide) {
    const host = document.createElement('div');
    host.className = 'modal-scrim';
    host.innerHTML = `<div class="modal ${wide ? 'ac-wide' : ''}">
      <div class="modal-head"><h2>${title}</h2>
        <button class="modal-x" data-x aria-label="Close">&times;</button></div>
      <div class="modal-body">${bodyHTML}</div>
      <div class="modal-foot">${foot}</div></div>`;
    host.querySelectorAll('[data-x]').forEach(b => b.onclick = () => host.remove());
    host.onclick = (e) => { if (e.target === host) host.remove(); };
    document.body.appendChild(host);
    return host;
  }
  const FOOT = (ok) => `<button class="btn foot-left" data-x>Cancel</button><button class="btn btn-primary" data-ok>${ok}</button>`;
  const saved = (b, s) => `<div class="status-note status-note-green pj-saved"><span>&#9660;</span><div><b>${b}</b> <span>${s}</span></div></div>`;
  /* the one lock-out the page must refuse: nobody left to manage access */
  const managers = () => D.users.filter(u => rolesOf(u).some(x => (roleOf(x.role) || { grants: [] }).grants.some(([k]) => k === 'access.manage')));

  function editRole(r, copy) {
    const isNew = !r || copy;
    const src = r || { name: '', description: '', grants: [] };
    const cur = new Map(src.grants.map(([k, s]) => [k, s]));
    const opts = (k, scopes) => scopes
      ? `<select data-perm="${k}"><option value="">—</option>${scopes.map(s => `<option value="${s}" ${cur.get(k) === s ? 'selected' : ''}>${s}</option>`).join('')}</select>`
      : `<label class="ac-own"><input type="checkbox" data-perm="${k}" ${cur.has(k) ? 'checked' : ''}> own</label>`;
    const host = modal(isNew ? (copy ? `Duplicate ${r.name}` : 'New role') : `Edit role — ${r.name}`, `
      <div class="fld-row" style="margin-top:0">
        <label class="fld" style="margin-top:0">Name<input id="rlName" value="${copy ? src.name + '-copy' : src.name}" placeholder="e.g. maps-curator"></label>
        <label class="fld" style="margin-top:0">What it is for<input id="rlDesc" value="${src.description || ''}"></label></div>
      <div class="fld">Grants <span class="muted">— pick the scope each permission reaches; <i>own</i> means the holder's own records</span></div>
      <div class="ac-edit">${D.PERMISSIONS.map(([g, ps]) => `<div class="ac-pgroup"><h4>${g}</h4>${ps.map(([k, scopes, what]) =>
        `<div class="ac-erow"><span><span class="mono">${k}</span><br><span class="muted">${what}</span></span>${opts(k, scopes)}</div>`).join('')}</div>`).join('')}</div>
      <div class="ac-impact" id="rlImpact"></div><div class="pj-err" id="rlErr"></div>`, FOOT(isNew ? 'Create role' : 'Save role'), true);
    const $ = (id) => host.querySelector('#' + id);
    const read = () => [...host.querySelectorAll('[data-perm]')].map(el => el.type === 'checkbox'
      ? (el.checked ? [el.dataset.perm, null] : null) : (el.value ? [el.dataset.perm, el.value] : null)).filter(Boolean);
    const impact = () => {
      const now = read();
      if (isNew) { $('rlImpact').innerHTML = `<b>${now.length}</b> grants. Nobody holds it until you give it to somebody, or an Identity mapping names it.`; return; }
      const was = new Map(r.grants.map(([k, s]) => [k, s])), nw = new Map(now.map(([k, s]) => [k, s]));
      const added = now.filter(([k, s]) => !was.has(k) || was.get(k) !== s), removed = r.grants.filter(([k]) => !nw.has(k));
      const hs = holdersOf(r);
      $('rlImpact').innerHTML = added.length + removed.length
        ? `<b>${added.length + removed.length} change${added.length + removed.length > 1 ? 's' : ''}</b>${added.length ? ` · adds or widens ${added.map(([k, s]) => `<span class="mono">${k}</span>${s ? '@' + s : ''}`).join(', ')}` : ''}${removed.length ? ` · removes ${removed.map(([k]) => `<span class="mono">${k}</span>`).join(', ')}` : ''}
          <br>Reaches <b>${hs.length}</b> ${hs.length === 1 ? 'person' : 'people'} at once: ${hs.map(({ u, how }) => `${u.name} <span class="muted">(${howShort(how)})</span>`).join(', ') || 'nobody'}.`
        : '<span class="muted">No changes yet.</span>';
    };
    host.querySelectorAll('[data-perm]').forEach(el => el.onchange = impact);
    impact();
    host.querySelector('[data-ok]').onclick = () => {
      const name = $('rlName').value.trim().toLowerCase().replace(/\s+/g, '-');
      if (!name) { $('rlErr').textContent = 'A role needs a name.'; return; }
      if (D.roles.some(x => x.name === name && x !== (isNew ? null : r))) { $('rlErr').textContent = `There is already a role called ${name}.`; return; }
      const grants = read();
      if (!isNew && r.grants.some(([k]) => k === 'access.manage') && !grants.some(([k]) => k === 'access.manage')) {
        const left = managers().filter(u => rolesOf(u).some(x => x.role !== r.id && roleOf(x.role).grants.some(([k]) => k === 'access.manage')));
        if (!left.length) { $('rlErr').textContent = 'Nobody else could manage access after this — keep access.manage, or give it to another role first.'; return; }
      }
      host.remove();
      let id;
      if (isNew) { id = name; D.roles.push({ id, name, description: $('rlDesc').value.trim(), shipped: false, grants }); }
      else { Object.assign(r, { name, description: $('rlDesc').value.trim(), grants }); id = r.id; }
      select('r', id, saved(isNew ? `Role ${name} created.` : `Role ${name} saved.`, isNew ? 'Give it to somebody, or name it in an Identity mapping, to take effect.' : `${holdersOf(roleOf(id)).length} people hold it — the change is theirs now.`));
    };
  }
  function delRole(r) {
    const hs = holdersOf(r), maps = mappingsOf(r);
    const host = modal(`Delete ${r.name}?`, (hs.length
      ? `<p style="margin-top:0">It is held by <b>${hs.length}</b> ${hs.length === 1 ? 'person' : 'people'}. They lose what only this role gave them:</p>
         <ul class="tk-changed">${hs.map(({ u }) => { const other = rolesOf(u).filter(x => x.role !== r.id);
           return `<li>${u.name} <span class="muted">— ${other.length ? 'keeps ' + other.map(x => x.role).join(', ') : 'is left with no role, and sees nothing'}</span></li>`; }).join('')}</ul>`
      : '<p style="margin-top:0">Nobody holds it.</p>')
      + (maps.length ? `<p>${maps.map(({ i, claim }) => `<b>${i.name}</b> maps ${claim} to it`).join('; ')}. That mapping stops giving anything, and shows a warning on Plugins until it is changed.</p>` : ''),
      `<button class="btn foot-left" data-x>Cancel</button><button class="btn btn-danger" data-ok>Delete role</button>`);
    host.querySelector('[data-ok]').onclick = () => {
      if (r.grants.some(([k]) => k === 'access.manage') && managers().every(u => rolesOf(u).every(x => x.role === r.id || !roleOf(x.role).grants.some(([k]) => k === 'access.manage')))) {
        host.querySelector('.modal-body').insertAdjacentHTML('beforeend', '<div class="pj-err">Nobody else could manage access after this.</div>'); return; }
      host.remove();
      D.roles.splice(D.roles.indexOf(r), 1);
      D.users.forEach(u => { u.roles = u.roles.filter(x => x !== r.id); u.mapped = (u.mapped || []).filter(m => m.role !== r.id); });
      select('u', 'u1', saved(`Role ${r.name} deleted.`, `${hs.length} people affected.`));
    };
  }
  const roleChecks = (on) => D.roles.map(r => `<label class="line in-line"><input type="checkbox" data-role="${r.id}" ${on.includes(r.id) ? 'checked' : ''}>
      <span><b>${r.name}</b> <span class="muted">— ${r.description || r.grants.length + ' grants'}</span></span></label>`).join('');
  function userRoles(u) {
    const mapped = u.mapped || [];
    const host = modal(`Roles — ${u.name}`, `
      <p class="fine" style="margin-top:0">Roles set by hand. ${mapped.length ? `Mapped ones are not changed here: ${mapped.map(m => `<b>${m.role}</b> (${howText(Object.assign({ by: 'map' }, m))})`).join(', ')} — they follow the provider at every login.` : ''}</p>
      ${roleChecks(u.roles)}<div class="pj-err" id="urErr"></div>`, FOOT('Save roles'));
    host.querySelector('[data-ok]').onclick = () => {
      const pick = [...host.querySelectorAll('[data-role]:checked')].map(x => x.dataset.role);
      const was = u.roles; u.roles = pick;
      if (!managers().length) { u.roles = was; host.querySelector('#urErr').textContent = 'Nobody could manage access after this.'; return; }
      host.remove();
      select('u', u.id, saved(`Roles saved for ${u.name}.`, !rolesOf(u).length ? 'They hold no role now — they will see nothing.' : `Now ${rolesOf(u).map(x => x.role).join(', ')}.`));
    };
  }
  function userGroups(u) {
    const host = modal(`Groups — ${u.name}`, D.groups.map(g => `<label class="line in-line"><input type="checkbox" data-grp="${g.id}" ${u.groups.includes(g.id) ? 'checked' : ''}>
      <span><b>${g.name}</b> <span class="muted">— gives ${confersText(g)}</span></span></label>`).join('') + NOROLE, FOOT('Save groups'));
    host.querySelector('[data-ok]').onclick = () => {
      u.groups = [...host.querySelectorAll('[data-grp]:checked')].map(x => x.dataset.grp);
      host.remove(); select('u', u.id, saved(`Groups saved for ${u.name}.`, u.groups.length ? u.groups.map(g => group(g).name).join(', ') : 'In no group now.'));
    };
  }
  function linkIdentity(u) {
    const host = modal(`Link an identity — ${u.name}`, `
      <p class="fine" style="margin-top:0">Another way for the same person to log in. Their record, roles and history stay one.</p>
      <div class="fld-row"><label class="fld" style="margin-top:0">Provider<select id="liIdp">${idps.map(i => `<option value="${i.id}">${i.name} — user id is ${i.userId}</option>`).join('')}</select></label>
        <label class="fld" style="margin-top:0">Their id there<input id="liExt" placeholder="the value of that claim"></label></div>
      <div class="pj-err" id="liErr"></div>`, FOOT('Link'));
    host.querySelector('[data-ok]').onclick = () => {
      const i = host.querySelector('#liIdp').value, ext = host.querySelector('#liExt').value.trim();
      if (!ext) { host.querySelector('#liErr').textContent = 'Which id do they have there?'; return; }
      const taken = D.users.find(x => (x.identities || []).some(y => y.idp === i && y.ext === ext));
      if (taken) { host.querySelector('#liErr').textContent = `${idp(i).name} ${ext} is already ${taken.name}.`; return; }
      u.identities.push({ idp: i, ext, last: 'never' }); host.remove();
      select('u', u.id, saved('Identity linked.', `${u.name} can now log in with ${idp(i).name}.`));
    };
  }
  function groupMembers(g) {
    const host = modal(`Members — ${g.name}`, `
      <div class="status-note status-note-blue" style="margin-top:0"><span>&#9660;</span><div><b>Each person added gets</b> <span>${confersText(g)}.</span></div></div>
      ${D.users.map(u => `<label class="line in-line"><input type="checkbox" data-mem="${u.id}" ${u.groups.includes(g.id) ? 'checked' : ''}>
        <span><b>${u.name}</b>${u.kind === 'agent' ? ' ' + U.badge('agent', 'purple', 'badge-xs') : ''} <span class="muted">— ${rolesOf(u).map(x => x.role).join(', ') || 'no role'}</span></span></label>`).join('')}`, FOOT('Save members'));
    host.querySelector('[data-ok]').onclick = () => {
      host.querySelectorAll('[data-mem]').forEach(el => { const u = user(el.dataset.mem);
        u.groups = el.checked ? [...new Set([...u.groups, g.id])] : u.groups.filter(x => x !== g.id); });
      host.remove(); select('g', g.id, saved(`Members saved.`, `${membersOf(g).length} in ${g.name}.`));
    };
  }
  function editGroup(g) {
    const isNew = !g, v = g || { name: '', description: '' };
    const host = modal(isNew ? 'New group' : `Edit group — ${g.name}`, `
      <label class="fld" style="margin-top:0">Name<input id="gpName" value="${v.name}" placeholder="e.g. Maps Curators"></label>
      <label class="fld">What it is for<input id="gpDesc" value="${v.description || ''}"></label>
      ${NOROLE}
      <p class="fine">Once it exists: category custody on <a href="categories.html">Categories</a>, projects on Projects, proposal custody from the custody here.</p>
      <div class="pj-err" id="gpErr"></div>`, FOOT(isNew ? 'Create group' : 'Save group'));
    host.querySelector('[data-ok]').onclick = () => {
      const name = host.querySelector('#gpName').value.trim();
      if (!name) { host.querySelector('#gpErr').textContent = 'A group needs a name.'; return; }
      const x = { name, description: host.querySelector('#gpDesc').value.trim() };
      host.remove();
      let id;
      if (g) { Object.assign(g, x); id = g.id; }
      else { id = 'g' + (D.groups.length + 1); D.groups.push(Object.assign({ id, categories: [], projects: [] }, x)); }
      select('g', id, saved(isNew ? `Group ${name} created.` : `Group ${name} saved.`, isNew ? 'Add members next.' : ''));
    };
  }
  function editCust(c) {
    const isNew = !c, v = c || { name: '', description: '' };
    const host = modal(isNew ? 'New proposal custody' : `Edit — ${c.name}`, `
      <label class="fld" style="margin-top:0">Name<input id="pcName" value="${v.name}" placeholder="e.g. Maps" ${c && c.fallback ? 'disabled' : ''}></label>
      <label class="fld">What it covers<input id="pcDesc" value="${v.description || ''}"></label>
      <p class="fine">${isNew ? 'It holds nothing until a Custody rule on Plugins returns this name.' : c.fallback ? 'The fallback keeps its name.' : 'Renaming it: rules that return the old name stop placing proposals here until they are changed.'}</p>
      <div class="pj-err" id="pcErr"></div>`, FOOT(isNew ? 'Create custody' : 'Save'));
    host.querySelector('[data-ok]').onclick = () => {
      const name = host.querySelector('#pcName').value.trim();
      if (!name) { host.querySelector('#pcErr').textContent = 'A custody needs a name.'; return; }
      if (D.proposalCustodies.some(x => x.name === name && x !== c)) { host.querySelector('#pcErr').textContent = `There is already a custody called ${name}.`; return; }
      const x = { name, description: host.querySelector('#pcDesc').value.trim() };
      host.remove();
      let id;
      if (c) { Object.assign(c, x); id = c.id; }
      else { id = 'pc' + (D.proposalCustodies.length + 1); D.proposalCustodies.push(Object.assign({ id, users: [], groups: [], open: 0 }, x)); }
      select('c', id, saved(isNew ? `Custody ${name} created.` : `Custody ${name} saved.`, isNew ? 'Add members, then name it in a Custody rule.' : ''));
    };
  }
  function custMembersModal(c) {
    const host = modal(`Members — ${c.name}`, `
      <div class="fld" style="margin-top:0">Groups</div>
      ${D.groups.map(g => `<label class="line in-line"><input type="checkbox" data-cg="${g.id}" ${c.groups.includes(g.id) ? 'checked' : ''}><span><b>${g.name}</b> <span class="muted">— ${membersOf(g).length} members</span></span></label>`).join('')}
      <div class="fld">People</div>
      ${D.users.filter(u => u.kind === 'person').map(u => { const r = reach(u);
        return `<label class="line in-line"><input type="checkbox" data-cu="${u.id}" ${c.users.includes(u.id) ? 'checked' : ''}><span><b>${u.name}</b> <span class="${r ? 'muted' : 'ac-none'}">— ${r ? (r === 'decides' ? 'would decide' : 'would see only') : 'no role reaches proposals'}</span></span></label>`; }).join('')}`, FOOT('Save members'));
    host.querySelector('[data-ok]').onclick = () => {
      c.groups = [...host.querySelectorAll('[data-cg]:checked')].map(e => e.dataset.cg);
      c.users = [...host.querySelectorAll('[data-cu]:checked')].map(e => e.dataset.cu);
      host.remove(); select('c', c.id, saved('Members saved.', `${custMembers(c).length} people in ${c.name}.`));
    };
  }
  function delCust(c) {
    const host = modal(`Delete ${c.name}?`, `
      <p style="margin-top:0">Every open proposal is placed again, as when a rule changes. The <b>${c.open}</b> in it lose this custody; those in no other land in the <b>Fallback</b>.</p>
      <p>Rules that still return <i>${c.name}</i> show a warning on Plugins until they are changed. The deletion is logged.</p>`,
      `<button class="btn foot-left" data-x>Cancel</button><button class="btn btn-danger" data-ok>Delete custody</button>`);
    host.querySelector('[data-ok]').onclick = () => {
      host.remove();
      cust('pc0').open += c.open;
      D.proposalCustodies.splice(D.proposalCustodies.indexOf(c), 1);
      select('c', 'pc0', saved(`${c.name} deleted.`, 'Its proposals were placed again — re-run on Tasks.'));
    };
  }
  function newLocal() {
    const local = idps.find(i => i.id === 'pi24');
    const host = modal('New local account', `
      <p class="fine" style="margin-top:0">For somebody with no institutional account. People with one appear by themselves the first time they log in; agents are created with their plugin.</p>
      <div class="fld-row"><label class="fld" style="margin-top:0">Name<input id="nuName"></label>
        <label class="fld" style="margin-top:0">Username<input id="nuUser"></label></div>
      <label class="fld">Email<input id="nuMail" placeholder="name@example.cz"></label>
      <div class="fld">Roles <span class="muted">— by hand; ${local.name} gives ${local.defaultRole || 'no role'} by default</span></div>
      ${roleChecks(['reader'])}
      <div class="pj-err" id="nuErr"></div>`, FOOT('Create account'));
    host.querySelector('[data-ok]').onclick = () => {
      const name = host.querySelector('#nuName').value.trim(), un = host.querySelector('#nuUser').value.trim();
      if (!name || !un) { host.querySelector('#nuErr').textContent = 'A name and a username, please.'; return; }
      if (D.users.some(x => (x.identities || []).some(y => y.idp === local.id && y.ext === un))) { host.querySelector('#nuErr').textContent = `${un} is taken.`; return; }
      const u = { id: 'u' + (D.users.length + 20), name, kind: 'person', email: host.querySelector('#nuMail').value.trim(),
        roles: [...host.querySelectorAll('[data-role]:checked')].map(e => e.dataset.role), groups: [], mapped: [],
        identities: [{ idp: local.id, ext: un, last: 'never' }] };
      D.users.push(u); host.remove();
      select('u', u.id, saved(`${name} created.`, rolesOf(u).length ? `Holds ${rolesOf(u).map(x => x.role).join(', ')}. They set a password at first login.` : 'No role — they will see nothing until given one.'));
    };
  }

  /* -------------------------------------------------------------- shell */
  const FOOTER = `<b>The person in the middle.</b> Left: what they may do — roles, each <i>by hand</i> or <i>mapped</i> by an
      Identity plugin from a claim (dashed). Right: what they are responsible for — groups and proposal custodies.
      A group never gives a role (decided 2026-09-26): it gives custody, proposal custody and project membership.
      <br><b>Union, never intersection.</b> Two paths to the same role are not a conflict; there is no deny rule.
      <br><b>Edited here:</b> roles and their grants, hand-set roles, groups, proposal custodies and their members, linked identities.
      <b>Not here:</b> category custody (Categories), mappings and Custody rules (Plugins).`;
  U.mount({ tier, active: 'access', role, title: 'Users & Groups',
    filters: { search: 'Search people, roles, groups, custodies…',
      chips: kindF() ? [{ k: 'Show', v: { agent: 'Agents', person: 'People', none: 'No role yet' }[kindF()], drop: 'access.html' }] : [],
      options: [['Show', [['People', 'access.html?kind=person'], ['Agents', 'access.html?kind=agent'], ['No role yet', 'access.html?kind=none']]]], available: [] },
    body: '<div id="ac"></div>' });
  const bar = document.querySelector('.topbar');
  const sub = () => { let p = bar.querySelector('.titles p');
    if (!p) { p = document.createElement('p'); bar.querySelector('.titles').appendChild(p); }
    const agents = D.users.filter(u => u.kind === 'agent').length, waiting = D.users.filter(u => !rolesOf(u).length).length;
    p.innerHTML = `${D.users.length - agents} people · ${agents} agents · ${D.roles.length} roles · ${D.groups.length} groups · ${D.proposalCustodies.length} custodies`
      + (waiting ? ` · <a href="access.html?kind=none">${waiting} with no role yet</a>` : ''); };
  /* phone: four buttons do not fit beside the title — one New… instead */
  if (can('access.manage')) bar.querySelector('.topbar-actions').innerHTML = TABS
    ? '<button class="btn btn-primary btn-sm" data-newany>New…</button>'
    : `<button class="btn btn-sm" data-newrole>New role</button><button class="btn btn-sm" data-newgroup>New group</button>
     <button class="btn btn-sm" data-newcust>New custody</button><button class="btn btn-primary btn-sm" data-newuser>New local account</button>`;
  const newAny = () => { const host = modal('New…', [['data-newrole', 'Role', 'a set of (permission, scope) grants'],
      ['data-newgroup', 'Group', 'gives custody, proposal custody and projects'], ['data-newcust', 'Proposal custody', 'a name rules place proposals in'],
      ['data-newuser', 'Local account', 'for somebody with no institutional account']]
    .map(([a, l, w]) => `<button class="btn ac-newrow" ${a}><b>${l}</b> <span class="muted">— ${w}</span></button>`).join(''), '<button class="btn foot-left" data-x>Cancel</button>');
    host.addEventListener('click', (e) => { const b = e.target.closest('.ac-newrow'); if (!b) return; host.remove();
      if (b.hasAttribute('data-newrole')) editRole(null); else if (b.hasAttribute('data-newgroup')) editGroup(null);
      else if (b.hasAttribute('data-newcust')) editCust(null); else newLocal(); }); };

  function draw(note) {
    sub();
    const d = { u: () => detailUser(user(sel.id)), g: () => detailGroup(group(sel.id)), r: () => detailRole(roleOf(sel.id)), c: () => detailCust(cust(sel.id)) }[sel.t]();
    document.getElementById('ac').innerHTML = `${note || ''}${columns()}<section class="pcard ac-detail" id="acDetail">${d}</section>
      <div class="budget">${FOOTER}</div>`;
    requestAnimationFrame(drawLines);
  }
  function select(t, id, note) {
    sel = { t, id };
    ['u', 'g', 'r', 'c'].forEach(k => q.delete(k)); q.set(t, id);
    history.replaceState(null, '', 'access.html?' + q);
    draw(note);
    if (TABS || note) document.getElementById('acDetail').scrollIntoView({ block: 'start', behavior: note ? 'auto' : 'smooth' });
  }
  addEventListener('resize', drawLines);

  document.querySelector('.main').addEventListener('click', (e) => {
    const t = e.target;
    const s = t.closest('[data-sel]');
    if (s) { e.preventDefault(); const [k, id] = s.dataset.sel.split(':'); return select(k, id); }
    const c = t.closest('.in-tabs [data-col]'); if (c) { e.preventDefault(); tab = c.dataset.col; return draw(); }
    const by = (a) => t.closest(`[${a}]`) && t.closest(`[${a}]`).getAttribute(a);
    if (by('data-uroles')) return userRoles(user(by('data-uroles')));
    if (by('data-ugroups')) return userGroups(user(by('data-ugroups')));
    if (by('data-ulink')) return linkIdentity(user(by('data-ulink')));
    if (by('data-gmembers')) return groupMembers(group(by('data-gmembers')));
    if (by('data-gedit')) return editGroup(group(by('data-gedit')));
    if (by('data-redit')) return editRole(roleOf(by('data-redit')));
    if (by('data-rcopy')) return editRole(roleOf(by('data-rcopy')), true);
    if (by('data-rdel')) return delRole(roleOf(by('data-rdel')));
    if (by('data-cedit')) return editCust(cust(by('data-cedit')));
    if (by('data-cmembers')) return custMembersModal(cust(by('data-cmembers')));
    if (by('data-cdel')) return delCust(cust(by('data-cdel')));
    if (t.closest('[data-newany]')) return newAny();
    if (t.closest('[data-newrole]')) return editRole(null);
    if (t.closest('[data-newgroup]')) return editGroup(null);
    if (t.closest('[data-newcust]')) return editCust(null);
    if (t.closest('[data-newuser]')) return newLocal();
  });
  const search = document.querySelector('.filterbar .search');
  if (search) search.oninput = () => { query = search.value.trim().toLowerCase(); draw(); };

  draw();
};
