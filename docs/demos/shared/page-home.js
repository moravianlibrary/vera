/* Home — /
   row      one CARD per sidebar entry the actor holds
   scope    whatever the actor can reach, in navigation §1 order
   actor    any — assembled per grant, exactly like the sidebar

   `/` RESOLVES BEFORE IT RENDERS (navigation §8). Three outcomes, and two of
   them are not a page:

     0 entries   no role yet. One line, and who gives one (identity.md §3:
                 an unknown login gets an account with no role and is listed
                 for an admin on Users & Groups).
     1 entry     a redirect. A reader's Home IS My Documents — reached by the
                 logo, by `/` and by the sidebar, all landing on the same
                 place. No landing page holding a single card.
     2+ entries  the card page below.

   The demo STATES the first two rather than performing them. A redirect that
   fires silently is indistinguishable from a broken link when you are reading
   a design, so the rule is drawn instead of executed — with the destination
   one click away. Switch `as` to `reader` to see it.

   Shape: neither of the two. Home has no list and no record, so it is not
   master–detail and not a table. It is cards.                              */

window.PAGE_HOME = function (tier) {
  const M = VERA, D = VERA_DATA, U = VERA_UI;
  const role = U.currentRole('curator');
  /* ?grants=none forces the no-role branch — no role in the `as` bar holds
     nothing, and the branch still has to be drawn somewhere */
  const none = /[?&]grants=none/.test(location.search);
  const held = none ? new Set() : U.permsOf(role);
  const can = (p) => held.has(p);
  const ME = none ? 'u10' : U.userOf(role) || 'u1';
  const me = D.byId(ME);

  /* --------------------------------------------------------- the numbers */
  /* Each is the SAME derivation the page it links to uses. If a card and
     its page ever disagree the card is wrong, because the page is the one
     with room to be right (navigation §6). A number appears only when it is
     work waiting for THIS actor (navigation §8.3). */

  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;

  /* Proposals — at `custody`, the proposal custodies I am in (proposal-custody.md) */
  const everywhere = U.scopesOf(role, 'request.decide').includes('any');
  const myCust = D.proposalCustodies.filter(c => everywhere || c.users.includes(ME) ||
    c.groups.some(g => (me.groups || []).includes(g))).map(c => c.id);
  const pendingDocs = new Set(D.requests.filter(r => r.decision === 'Pending' &&
    (everywhere || D.custodiesOf(r).some(id => myCust.includes(id)))).map(r => r.doc)).size;

  /* Validations — category custody; a curator holds Periodicals. A
     forbidden item has left the queue */
  const custody = role === 'curator' ? ['c2'] : null;
  const inCustody = (catId) => { if (!custody) return true;
    let c = D.cat(catId);
    while (c) { if (custody.includes(c.id)) return true; c = c.parent ? D.cat(c.parent) : null; }
    return false; };
  const needChecking = D.iterations.filter(it => inCustody(it.category) &&
    M.validationOf(it) === 'Needed' && !M.restricted(it)).length;

  /* Lists — the pool, and a list that ended without being marked Done */
  const readyPool = D.iterations.filter(it => it.progress === 'Ready' && !it.list && M.passesGates(it)).length;
  const today = Date.parse(D.today);
  const unmarked = D.lists.filter(l => !l.done && Date.parse(l.ends) + 864e5 <= today).length;

  /* Projects — what waits for a decision */
  const proposedProjects = D.projects.filter(p => p.state === 'Proposed').length;

  /* Documents — my own asks still moving; for an admin, ingest that failed */
  const myOpen = D.requests.filter(r => r.by === ME).filter(r => {
    const v = U.reqView(r);
    return ['Pending'].includes(r.decision) || (v.it && !M.atLeast(v.it.progress, 'Digitized'));
  }).length;
  const failedIngest = D.iterations.filter(it => it.progress === 'IngestFailed').length;

  const failedTasks = D.tasks.filter(t => t.state === 'failed' &&
    (can('task.read') || t.by === ME)).length;
  const noRole = D.users.filter(u => u.kind === 'person' && !U.rolesOfUser(u).length).length;
  const dead = (D.deadLetters || []).length;

  const own = !can('iteration.read');
  /* The job line is the card: what you came to do, in the words of the
     person doing it — never the page's name, which is the second line. */
  const JOB = {
    documents:  own ? ['See what happened to what you asked for', () => myOpen && `${myOpen} still in progress`]
                    : ['Look something up', () => can('addition.retry') && failedIngest && `${n(failedIngest, 'could', 'could')} not be added`],
    proposals:  ['Decide what enters the pipeline',
                 () => pendingDocs && `${pendingDocs} waiting for your decision`],
    validation: ['Check documents before they can be digitized',
                 () => needChecking && `${needChecking} need checking`],
    lists:      ['Build the next digitization list, and close the last one',
                 () => [unmarked && `${n(unmarked, 'list', 'lists')} ended, not marked Done`,
                        readyPool && `${readyPool} ready to be listed`].filter(Boolean).join(' · ')],
    projects:   can('project.decide')
                  ? ['Approve or reject the projects proposed', () => proposedProjects && `${n(proposedProjects, 'project', 'projects')} waiting for a decision`]
                  : ['Start a project, or see what yours planned and delivered', null],
    categories: ['Set up the tree, and how the work is split across it', null],
    intentions: ['Say what the next lists should aim at', null],
    tasks:      ['See what the system has been doing',
                 () => failedTasks && `${failedTasks} failed — the rest ran`],
    schedules:  ['See what runs by itself, and when', null],
    access:     ['Give somebody access, or find out why they have it',
                 () => can('access.manage') && noRole && `${n(noRole, 'person', 'people')} waiting for a role`],
    plugins:    ['Configure where the data comes from, and who can log in', null],
    hooks:      ['Send what happens here somewhere else',
                 () => can('hook.configure') && dead && `${dead} undelivered`]
  };

  const mine = U.visibleNav(held);

  /* ------------------------------------------------- the two non-pages */

  if (!mine.length) {
    return U.mount({ tier, active: '', role, bare: true,
      title: `Signed in as ${me.name}`,
      body: `
        <div class="home-alone">
          <h2>You have no access yet</h2>
          <p>You are signed in, and nothing has been granted to this account —
             not a role, not a category, not a project. An administrator sees
             you on <b>Users &amp; Groups</b> under <i>No role yet</i>, and
             gives you one.</p>
          <p class="fine">This is the system failing <b>closed</b>: whoever logs in through a
             provider whose default role is none lands here, never on someone else's work.
             <br>In the demo, Adam Kolář is this account.</p>
        </div>` });
  }

  if (mine.length === 1) {
    const only = mine[0];
    return U.mount({ tier, active: '', role,
      title: `Signed in as ${me.name}`,
      body: `
        <div class="home-alone">
          <h2>Home is <a href="${only.file}">${only.label}</a></h2>
          <p>You hold exactly one entry, so <code>/</code> is a <b>redirect</b>
             and there is no Home page — the logo, <code>/</code> and the
             sidebar all land in the same place.</p>
          <p class="fine">A landing page holding a single card that says
             <i>go to ${only.label}</i> is a click charged for nothing.
             <br>In the product this never renders; the demo draws the rule so
             it can be read. Switch <b>as</b> to see the card page, or
             <a href="home.html?grants=none">see an account with no role</a>.</p>
        </div>` });
  }

  /* ------------------------------------------------------- the card page */

  const card = (e) => {
    const [job, waiting] = JOB[e.id] || ['Open ' + e.label, null];
    const w = waiting && waiting();
    return `<a class="homecard" href="${e.file}">
        <span class="hc-job">${job}</span>
        <span class="hc-entry">${e.label}</span>
        ${w ? `<span class="hc-wait">${w}</span>` : ''}
      </a>`;
  };

  /* one grid, in the sidebar's order — no group headers: the entries are one
     flat list everywhere, and Home does not invent a structure the sidebar
     does not have */
  U.mount({ tier, active: '', role,
    title: `Signed in as ${me.name}`,
    subtitle: `${role} · ${mine.length} of the ${U.NAV.length} areas are yours`,
    body: `<div class="home-grid">${mine.map(card).join('')}</div>` });
};
