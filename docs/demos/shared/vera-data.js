/* VERA demo — one dataset, every page is a view over it.
   Cross-page consistency is the point: the same document appears as a row in
   Proposals with three askers, then in Documents, then on a list, then inside
   a project's planned-versus-delivered numbers. */

window.VERA_DATA = (function () {

  /* ------------------------------------------------------------- people */
  /* An agent is a user record flagged non-human — a plugin that harvests
     documents is a requester like any other (view-map §6.1).              */

  /* A user is a PERSON or an AGENT — nothing else (decided with the user
     2026-09-26). Roles are held two ways and never through a group
     (decided 2026-09-26, permissions §1):
       roles       set by hand on Users & Groups
       mapped      given by an Identity plugin instance from a claim,
                   re-evaluated at every login (identity §4)
     `identities` is how they sign in: (instance, external id). An agent has
     none — it is created with its plugin and never logs in. */
  const KC = 'pi22', EDU = 'pi23', LOCAL = 'pi24';
  const users = [
    { id: 'u1', name: 'Jana Nováková',    kind: 'person', email: 'jana.novakova@mzk.cz',   roles: [], groups: ['g1'],
      mapped: [{ role: 'curator', idp: KC, claim: 'group mzk-curators' }],
      identities: [{ idp: KC, ext: 'jnovakova', last: 'today 08:12' }] },
    { id: 'u2', name: 'Martin Svoboda',   kind: 'person', email: 'martin.svoboda@mzk.cz',  roles: [], groups: ['g2'],
      mapped: [{ role: 'dig-curator', idp: KC, claim: 'group mzk-digitization' }],
      identities: [{ idp: KC, ext: 'msvoboda', last: 'today 07:55' }] },
    { id: 'u3', name: 'Petr Dvořák',      kind: 'person', email: 'petr.dvorak@mzk.cz',     roles: ['admin'], groups: [],
      mapped: [{ role: 'staff', idp: KC, claim: 'group mzk-staff' }],
      identities: [{ idp: KC, ext: 'pdvorak', last: 'today 09:01' }, { idp: LOCAL, ext: 'admin', last: '2 Jun 2026' }] },
    { id: 'u4', name: 'Eva Horáková',     kind: 'person', email: 'eva.horakova@mzk.cz',    roles: [], groups: ['g3'],
      mapped: [{ role: 'staff', idp: KC, claim: 'group mzk-staff' }],
      identities: [{ idp: KC, ext: 'ehorakova', last: 'yesterday' }] },
    { id: 'u8', name: 'Kateřina Novotná', kind: 'person', email: 'katerina.novotna@mzk.cz', roles: ['curator'], groups: ['g1'],
      mapped: [{ role: 'staff', idp: KC, claim: 'group mzk-staff' }],
      identities: [{ idp: KC, ext: 'knovotna', last: '19 Jun 2026' }] },
    { id: 'u9', name: 'Radek Šimek',      kind: 'person', email: 'radek.simek@mzk.cz',     roles: [], groups: ['g2'],
      mapped: [{ role: 'staff', idp: KC, claim: 'group mzk-staff' }],
      identities: [{ idp: KC, ext: 'rsimek', last: '21 Jun 2026' }] },
    { id: 'u5', name: 'Tomáš Marek',      kind: 'person', email: 'tomas.marek@muni.cz',    roles: [], groups: [],
      mapped: [{ role: 'reader', idp: EDU, claim: 'default role' }],
      identities: [{ idp: EDU, ext: 'marek@muni.cz', last: '18 Jun 2026' }] },
    { id: 'u6', name: 'Lucie Benešová',   kind: 'person', email: 'lucie.benesova@gmail.com', roles: ['reader'], groups: [],
      mapped: [], identities: [{ idp: LOCAL, ext: 'lbenesova', last: '12 Jun 2026' }] },
    { id: 'u7', name: 'Ondřej Krejčí',    kind: 'person', email: 'ondrej.krejci@seznam.cz', roles: ['reader'], groups: [],
      mapped: [], identities: [{ idp: LOCAL, ext: 'okrejci', last: '3 May 2026' }] },
    /* a first login through Local accounts, whose default role is none:
       they see "You have no access yet" until an admin gives a role */
    { id: 'u10', name: 'Adam Kolář',      kind: 'person', email: 'adam.kolar@post.cz',     roles: [], groups: [],
      mapped: [], identities: [{ idp: LOCAL, ext: 'akolar', last: 'today 08:40' }] },
    { id: 'a1', name: 'Kramerius sweep',  kind: 'agent',  email: null, entry: 'Additions', roles: ['reader'], groups: [], mapped: [], identities: [] },
    { id: 'a2', name: 'ISSN harvester',   kind: 'agent',  email: null, entry: 'Proposals', roles: ['reader'], groups: [], mapped: [], identities: [] }
  ];
  const byId = (id) => users.find(u => u.id === id) || { name: '—', kind: 'person' };

  const groups = [
    { id: 'g1', name: 'Periodicals Curators', categories: ['c2'], projects: [],
      description: 'Curators of the periodicals collection.' },
    { id: 'g2', name: 'Digitization Office',  categories: [],     projects: ['p1', 'p2'],
      description: 'Plans lists and runs the funded projects.' },
    { id: 'g3', name: 'Reading Room',         categories: [],     projects: [],
      description: 'Reading-room staff.' }
  ];
  /* a group gives custody, proposal custody and project membership — never
     a role (decided 2026-09-26) */

  /* PROPOSAL CUSTODY (proposal-custody.md) — a name with members. Which
     proposals are in it is the Custody plugins' answer, never typed in;
     `open` is how many open proposals they placed in it right now. Exactly
     one fallback, from installation: what no rule placed. */
  const proposalCustodies = [
    { id: 'pc0', name: 'Fallback', fallback: true, users: ['u3'], groups: [],
      description: 'What no Custody rule placed.' },
    { id: 'pc1', name: 'Periodicals', users: ['u8'], groups: ['g1'],
      description: 'Serials and newspapers, by material type.' },
    { id: 'pc2', name: '19th-century prints', users: ['u1'], groups: [],
      description: 'Anything published 1800–1899, from field 260.' },
    { id: 'pc3', name: 'Moravica', users: ['u2'], groups: ['g2'],
      description: 'Proposals into the Moravica project.' }
  ];
  /* direct custody for people — category_members (relationships §2). Edited
     on Categories only; Users & Groups shows it (decided 2026-09-26). */
  const categoryMembers = { c4: ['u8'] };

  /* ------------------------------------------------------- permissions */
  /* permissions §3 — every permission, the scopes it ACCEPTS (null =
     self-scoped: a grant with no scope), and a line saying what it is.
     Roles are built from these, and the demo's shell derives what each
     role may see from the same table. */
  const PERMISSIONS = [
    ['Requests', [
      ['request.create', null, 'raise a proposal'],
      ['request.read_own', null, 'my requests and what they became'],
      ['request.withdraw_own', null, 'take back my own ask'],
      ['request.read', ['custody', 'project', 'any'], 'other people\'s requests'],
      ['request.decide', ['custody', 'any'], 'approve or decline a proposal, rescans included — custody is proposal custody']]],
    ['Documents', [
      ['iteration.read', ['custody', 'project', 'any'], 'other people\'s documents'],
      ['iteration.edit_descriptive', ['custody', 'any'], 'fix titles and descriptions'],
      ['iteration.classify', ['custody', 'any'], 'category and priority, after approval'],
      ['iteration.relink', ['custody', 'any'], 'point at another catalog record'],
      ['validation.approve', ['custody', 'any'], 'accept the outstanding defects'],
      ['validation.deny', ['custody', 'any'], 'refuse, with a reason'],
      ['validation.revoke', ['custody', 'any'], 'take an approval back'],
      ['restriction.overrule', ['any'], 'lift a restriction — never custody'],
      ['iteration.cancel', ['custody', 'any'], 'stop work, with a reason'],
      ['iteration.resume', ['custody', 'any'], 'restart stopped work'],
      ['iteration.publish', ['custody', 'any'], 'set the link where the scan is available'],
      ['watch', null, 'save watchlists over what I can read']]],
    ['Additions', [
      ['addition.read', ['custody', 'any'], 'ingest detail — batch, failure text'],
      ['addition.retry', ['any'], 'ingest again'],
      ['addition.read_payload', ['any'], 'raw responses']]],
    ['Planning', [
      ['list.read', ['custody', 'project', 'any'], 'see digitization lists'],
      ['list.create', ['any'], 'build a list, generators included'],
      ['list.edit', ['any'], 'membership and dates'],
      ['list.delete', ['any'], 'return a list\'s members to the pool'],
      ['intention.read', ['project', 'any'], 'see intentions'],
      ['intention.edit', ['project', 'any'], 'create and edit intentions'],
      ['intention.edit_overall', ['any'], 'the Overall intention\'s mix'],
      ['intention.repeat', ['any'], 'repeating intentions'],
      ['project.read', ['project', 'any'], 'see projects'],
      ['project.create', ['any'], 'start a project — it starts Proposed'],
      ['project.edit', ['managed', 'any'], 'edit a project'],
      ['project.manage_members', ['managed', 'any'], 'who is on a project, and its manager'],
      ['project.delete', ['managed', 'any'], 'delete a project with no proposals'],
      ['project.decide', ['any'], 'approve or reject a project — and see every project']]],
    ['Categories', [
      ['category.read', ['custody', 'any'], 'see the tree'],
      ['category.edit', ['custody', 'any'], 'rename, move, refine'],
      ['category.grant_custody', ['custody', 'any'], 'bring somebody onto a branch']]],
    ['Administration', [
      ['task.read_own', null, 'the tasks I started — and cancelling them'],
      ['task.read', ['any'], 'everybody\'s tasks, and Schedules'],
      ['task.cancel', ['any'], 'cancel somebody else\'s run'],
      ['task.schedule', ['any'], 'edit schedules and retention'],
      ['plugin.read', ['any'], 'see plugins'],
      ['plugin.configure', ['any'], 'configure instances'],
      ['plugin.upload_code', ['any'], 'install plugin code'],
      ['plugin.run', ['any'], 'run a plugin now'],
      ['hook.read', ['any'], 'see hooks'],
      ['hook.configure', ['any'], 'edit hooks'],
      ['access.read', ['any'], 'see users, groups and roles'],
      ['access.manage', ['any'], 'change them — including roles']]]
  ];
  const permission = (k) => { for (const [g, ps] of PERMISSIONS) { const p = ps.find(x => x[0] === k); if (p) return { key: k, group: g, scopes: p[1], what: p[2] }; } return null; };

  /* permissions §4 — the five shipped roles. Bundles, not a ladder: each
     holds its grants outright, and nothing marks a shipped role as special
     except that it came with VERA. Every one is editable. */
  const G = (scope, ...keys) => keys.map(k => [k, scope]);
  const READER = G(null, 'request.create', 'request.read_own', 'request.withdraw_own', 'watch');
  const STAFFG = [...READER, ...G(null, 'task.read_own'), ...G('any', 'project.create'),
    ...G('project', 'project.read'), ...G('managed', 'project.edit', 'project.manage_members', 'project.delete'),
    ...G('any', 'iteration.read', 'request.read', 'iteration.edit_descriptive', 'iteration.relink', 'category.read')];
  const roles = [
    { id: 'reader', name: 'reader', shipped: true, grants: READER,
      description: 'Proposes and follows their own requests. Holds only self-scoped grants.' },
    { id: 'staff', name: 'staff', shipped: true, grants: STAFFG,
      description: 'Library staff: read every record, fix descriptions.' },
    { id: 'curator', name: 'curator', shipped: true,
      grants: [...STAFFG, ...G('custody', 'request.decide',
          'validation.approve', 'validation.deny', 'validation.revoke', 'iteration.classify',
          'iteration.cancel', 'iteration.resume', 'iteration.publish', 'addition.read', 'category.edit', 'category.grant_custody'),
        ...G('any', 'project.decide')],
      description: 'Decides proposals in their proposal custody; validates, classifies and publishes inside their category custody; decides projects.' },
    { id: 'dig-curator', name: 'dig-curator', shipped: true,
      grants: [...STAFFG.filter(([k]) => !k.startsWith('project.')), ...G('any', 'list.read', 'list.create', 'list.edit', 'list.delete', 'intention.read', 'intention.edit',
        'project.read', 'project.create', 'project.edit', 'project.manage_members', 'project.delete', 'iteration.cancel', 'iteration.resume')],
      description: 'Plans the work: lists, intentions, projects.' },
    { id: 'admin', name: 'admin', shipped: true,
      grants: PERMISSIONS.flatMap(([, ps]) => ps.map(p => [p[0], p[1] ? p[1][p[1].length - 1] : null])),
      description: 'Everything, at any scope.' }
  ];

  /* --------------------------------------------------------- categories */
  /* Documents attach to LEAVES only. Custody attaches at any node and
     inherits down — people and subtrees versus documents and the bottom.  */

  const categories = [
    { id: 'c1', name: 'Monographs',  parent: null },
    { id: 'c11', name: '19th century', parent: 'c1' },
    { id: 'c12', name: '20th century', parent: 'c1' },
    { id: 'c2', name: 'Periodicals', parent: null },
    { id: 'c21', name: 'Regional',   parent: 'c2' },
    { id: 'c22', name: 'National',   parent: 'c2' },
    { id: 'c23', name: 'Specialist', parent: 'c2' },
    { id: 'c3', name: 'Manuscripts', parent: null },
    { id: 'c31', name: 'Medieval',   parent: 'c3' },
    { id: 'c32', name: 'Early modern', parent: 'c3' },
    { id: 'c4', name: 'Maps',        parent: null }
  ];
  const cat = (id) => categories.find(c => c.id === id);
  const isLeaf = (id) => !categories.some(c => c.parent === id);
  const pathOf = (id) => {
    const out = []; let c = cat(id);
    while (c) { out.unshift(c.name); c = c.parent ? cat(c.parent) : null; }
    return out;
  };
  const childrenOf = (id) => categories.filter(c => c.parent === id);

  /* ------------------------------------------------- distributions §1.1 */
  /* Percentages, not weights. A sibling set sums to 100. A set summing to
     less is FLAGGED, not corrected — the remainder is unallocated.        */

  const distributions = [
    /* A mix belongs to an intention (decided 2026-09-26): `owner` is the
       intention that owns it; every other intention using it TRACKS that
       owner. No chains — an owner never tracks. The name is the backend's
       only; pages say whose mix it is (intentions §2). */
    { id: 'd1', name: 'Standard mix', isOverall: true, owner: 'i4', shares: {
        c1: 35, c2: 45, c3: 15, c4: 5,
        c11: 40, c12: 60,
        c21: 30, c22: 50, c23: 20,
        c31: 60, c32: 40 } },
    { id: 'd2', name: 'Periodicals push 2026', isOverall: false, owner: 'i8', shares: {
        c1: 20, c2: 70, c3: 10, c4: 0,          /* Maps deliberately excluded */
        c11: 50, c12: 50,
        c21: 55, c22: 35,                        /* Specialist has no row -> 10 unallocated */
        c31: 50, c32: 50 } }
  ];

  /* effective(node) = share(node) × effective(parent), recursively */
  function effectiveShare(distId, catId) {
    const d = distributions.find(x => x.id === distId);
    let pct = 1, c = cat(catId);
    while (c) {
      const s = d.shares[c.id];
      if (s == null) return null;               /* unallocated somewhere up the chain */
      pct *= s / 100;
      c = c.parent ? cat(c.parent) : null;
    }
    return pct * 100;
  }
  /* what a sibling set leaves unallocated */
  function unallocated(distId, parentId) {
    const d = distributions.find(x => x.id === distId);
    const kids = childrenOf(parentId);
    const sum = kids.reduce((a, k) => a + (d.shares[k.id] || 0), 0);
    return kids.length ? 100 - sum : 0;
  }

  /* ------------------------------------------------ projects, intentions */

  /* Demo-scale targets — thousands of pages, not the hundreds of thousands a
     real grant buys — so the bars say something about the rows that exist.
     Two things read as a project's state and never mix (projects.md §1):
       state     the DECISION, stored — Proposed · Approved · Rejected, final
                 once decided
       period    derived from the dates — Upcoming · Active · Ended
     `manager` is whoever created it, until handed over; always a member.
     `priority` is set once, at approval, and never changes (§2.1). */
  const A = (by, at, priority) => ({ state: 'Approved', decidedBy: by, decidedAt: at, priority });
  const projects = [
    { id: 'p1', name: 'NDK Periodika', starts: '2025-07-01', ends: '2027-06-30', target: 6000,
      manager: 'u2', members: ['u2', 'u1', 'u4'], createdAt: '12 Jun 2025', ...A('u1', '30 Jun 2025', 'High'),
      description: 'National Digital Library grant for Czech periodicals: regional and national papers, 1850–1945.' },
    { id: 'p2', name: 'VISK 7 / 2026', starts: '2026-01-01', ends: '2026-12-31', target: 3000,
      manager: 'u2', members: ['u2'], createdAt: '4 Dec 2025', ...A('u1', '15 Dec 2025', 'Normal'),
      description: 'The ministry\'s yearly VISK 7 call: the approved backlog, any category.' },
    { id: 'p3', name: 'Moravica', starts: '2024-01-01', ends: '2026-12-31', target: 1200,
      manager: 'u2', members: ['u2', 'u4'], createdAt: '20 Nov 2023', ...A('u3', '4 Dec 2023', 'High'),
      description: 'Regional literature about Moravia, with the regional authority. Extended by a closing year.' },
    /* proposed and empty — nobody has proposed into it yet, so it can still
       be deleted (§3) */
    { id: 'p4', name: 'Hudebniny — NAKI III', starts: '2026-09-01', ends: '2028-08-31', target: 2000,
      manager: 'u2', members: ['u2'], createdAt: '18 Jun 2026', state: 'Proposed',
      description: 'Printed music from the Brno collections. Applied for; the call closes in August.' },
    /* proposed, with its members' proposals in it — what a curator decides */
    { id: 'p8', name: 'Brněnské kalendáře', starts: '2026-09-01', ends: '2027-08-31', target: 800,
      manager: 'u4', members: ['u4', 'u5'], createdAt: '20 Jun 2026', state: 'Proposed',
      description: 'Brno almanacs and town plans for the local history society\'s index, with the city archive.' },
    /* rejected — final; every member reads the reason */
    { id: 'p9', name: 'Pohlednice Brna', starts: '2026-04-01', ends: '2026-12-31', target: 1500,
      manager: 'u4', members: ['u4'], createdAt: '2 Mar 2026', state: 'Rejected', decidedBy: 'u1', decidedAt: '16 Mar 2026',
      decisionReason: 'The postcard collection is not catalogued yet, so nothing in it can be proposed. Start a new project once it is in the catalog.',
      description: 'The picture-postcard collection, for the city\'s anniversary.' },
    /* ended — what an audit asks about years later */
    { id: 'p5', name: 'VISK 7 / 2025', starts: '2025-01-01', ends: '2025-12-31', target: 2500,
      manager: 'u2', members: ['u2'], createdAt: '2 Dec 2024', ...A('u1', '9 Dec 2024', 'Normal'),
      description: 'The 2025 VISK 7 call.' },
    { id: 'p6', name: 'Staré tisky — restoration scans', starts: '2024-03-01', ends: '2025-06-30', target: 1200,
      manager: 'u2', members: ['u2', 'u1'], createdAt: '14 Feb 2024', ...A('u3', '20 Feb 2024', 'Urgent'),
      description: 'Scans of early prints before and after restoration.' },
    { id: 'p7', name: 'Mapy Moravy — NAKI II', starts: '2022-01-01', ends: '2024-12-31', target: 900,
      manager: 'u3', members: ['u3', 'u2'], createdAt: '10 Dec 2021', ...A('u3', '10 Dec 2021', 'Normal'),
      description: 'Historical maps of Moravia.' }
  ];
  const proj = (id) => projects.find(p => p.id === id);

  /* An intention is SCOPE (funding, one category subtree) plus OBJECTIVE
     (a mix, an optional page target, a window). Nothing is attached to it by
     hand: an item counts towards every intention whose scope it matches
     (intentions §5, as re-decided 2026-09-26).
       funding   null = any · 'none' = no project · a project id
       scope     null = all categories · one category, with its subtree
       starts    the counting start — required, LOCKED once created, may be future
       ends      last day, or null (open-ended). Windows are start-inclusive,
                 end-exclusive: [starts, ends + 1 day)
       target    pages, or null — without one it only tracks the mix
     `overall` marks the protected one: everything, no target, no end, the
     default mix for generating. `template` names the repeat it came from. */
  const intentions = [
    { id: 'i4', name: 'House mix', overall: true, funding: null, scope: null,
      distribution: 'd1', target: null, starts: '2019-01-01', ends: null,
      description: 'What everything MZK digitizes ought to look like.' },
    { id: 'i1', name: 'NDK Periodika — 2026 Q3', funding: 'p1', scope: 'c2',
      distribution: 'd2', target: 7500, starts: '2026-07-01', ends: '2026-09-30',
      description: 'The quarter of the NDK grant that goes to periodicals.' },
    { id: 'i2', name: 'VISK 7 backlog', funding: 'p2', scope: null,
      distribution: 'd1', target: 4000, starts: '2026-01-01', ends: '2026-12-31',
      description: 'Clearing the approved backlog the VISK 7 grant pays for.' },
    { id: 'i5', name: 'Moravica — closing year', funding: 'p3', scope: null,
      distribution: 'd1', target: 800, starts: '2026-01-01', ends: '2026-12-31',
      description: 'The extension year of the Moravica grant.' },
    { id: 'i3', name: 'Regional catch-up', funding: null, scope: 'c21',
      distribution: 'd2', target: 4000, starts: '2026-03-12', ends: null,
      description: 'Regional weeklies we are behind on. No deadline — done when done.' },
    { id: 'i6', name: 'Monthly output — June 2026', funding: null, scope: null, template: 't1',
      distribution: 'd1', target: 3000, starts: '2026-06-01', ends: '2026-06-30',
      description: 'What the scanning room should deliver this month.' },
    { id: 'i10', name: 'Monthly output — May 2026', funding: null, scope: null, template: 't1',
      distribution: 'd1', target: 3000, starts: '2026-05-01', ends: '2026-05-31',
      archived: { at: '1 Jun 2026', by: 'sys' },
      description: 'What the scanning room should deliver this month.' },
    { id: 'i7', name: 'June catch-up run', funding: null, scope: null,
      distribution: 'd1', target: 3000, starts: '2026-06-01', ends: '2026-06-19',
      description: 'One run, one target: the first three weeks of June.' },
    { id: 'i8', name: 'Periodicals push — watch', funding: null, scope: 'c2',
      distribution: 'd2', target: null, starts: '2026-01-01', ends: null,
      description: 'Is what we deliver inside Periodicals shaped the way the push says?' },
    { id: 'i11', name: 'Unfunded work — 2027', funding: 'none', scope: null,
      distribution: 'd1', target: null, starts: '2027-01-01', ends: '2027-12-31',
      description: 'The mix of what we digitize on our own budget next year.' },
    { id: 'i9', name: 'Maps watch', funding: null, scope: 'c4',
      distribution: 'd1', target: null, starts: '2026-01-01', ends: null,
      archived: { at: '12 Jun 2026', by: 'u2' },
      description: 'Kept while the large-format scanner was out. Nothing to watch until Q4.' }
  ];
  /* A repeat is a TEMPLATE that makes concrete occurrences, each its own
     intention with its own window and progress. Editing the template changes
     the ones still to come. Archiving the previous one only hides it.
     Needs intention.repeat (admin by default). */
  const intentionTemplates = [
    { id: 't1', name: 'Monthly output — {period}', every: 'month', funding: null, scope: null,
      distribution: 'd1', target: 3000, archivePrevious: true, since: '2026-05-01',
      by: 'u3', next: '2026-07-01' }
  ];

  /* ------------------------------------------------------ digitization lists */

  /* The demo's today. Progress derives from it: a list starting after today
     makes its members Planned, one already started makes them InProgress
     (status-model §2). */
  const today = '2026-06-25';

  /* What a list counts towards is DERIVED from its members and its start
     date, never attached. `generated` is provenance: what produced it — the
     intention whose scope and mix it aimed at, the pages asked for, the
     generator. A hand-built list has none. `targetPages` is what it was
     built towards. */
  const lists = [
    { id: 'L-2026-014', name: 'Periodika — summer run', starts: '2026-06-22',
      ends: '2026-07-10', targetPages: 3500, generated: null,
      createdBy: 'u2', createdAt: '15 Jun 2026' },
    { id: 'L-2026-015', name: 'Regional weeklies',      starts: '2026-10-05',
      ends: '2026-10-23', targetPages: 4000,
      generated: { intention: 'i3', distribution: 'd2', pages: 4000, generator: 'PriorityFirst 1.2.0', at: '22 Jun 2026' },
      createdBy: 'u2', createdAt: '22 Jun 2026' },
    { id: 'L-2026-016', name: 'Manuscripts — November', starts: '2026-11-02',
      ends: '2026-11-20', targetPages: null, generated: null,
      createdBy: 'u2', createdAt: '24 Jun 2026' },
    /* Done is an act, not a derivation (decided 2026-09-26): marking it Done
       moved its members to Digitized, except any marked could not be digitized */
    { id: 'L-2026-012', name: 'Moravica — June',        starts: '2026-06-01',
      ends: '2026-06-19', targetPages: 3000, generated: null,
      createdBy: 'u2', createdAt: '20 May 2026', done: { by: 'u2', at: '20 Jun 2026' } }
  ];
  const listOf = (id) => lists.find(l => l.id === id);

  /* ------------------------------------------------------------ documents */
  /* Identity is catalog ID + optional unit ID. Page count comes from several
     tiered sources; the resolved value is what a list is built on, and every
     source stays visible (document-properties §4, §5).                     */

  const D = (o) => Object.assign({
    type: 'Periodical', signature: null, unit: null, registries: [], pageSources: []
  }, o);

  const documents = [
    D({ id: 'D1', catalogId: 'MZK01-001284756', title: 'Lidové noviny',
        unit: { type: 'volume-name', value: '1918–1925' }, signature: 'ST1-0032',
        pageSources: [ { source: 'catalog', tier: 50, value: 2847, at: '11 Mar 2026' },
                       { source: 'predictor', tier: 20, value: 2600, at: '11 Mar 2026' } ],
        registries: [
          { source: 'Kramerius', state: 'Published', raw: 'published', linkKind: 'content',
            url: 'https://kramerius.mzk.cz/view/uuid:demo', observed: '3 min ago', checked: '3 min ago' },
          { source: 'RDCZ', state: 'Digitized', raw: 'Digitized', linkKind: 'record',
            url: 'https://www.registrdigitalizace.cz/rdcz/detail/demo', observed: '2 days ago', checked: '2 days ago' }
        ] }),
    D({ id: 'D2', catalogId: 'MZK01-001198432', title: 'Právo lidu',
        unit: { type: 'volume-number', value: 'roč. 35' }, signature: 'ST2-0187',
        pageSources: [ { source: 'catalog', tier: 50, value: 456, at: '2 May 2026' } ],
        registries: [
          { source: 'Kramerius', state: 'NotFound', raw: null, observed: '1 hour ago', checked: '1 hour ago' },
          { source: 'RDCZ', state: 'Planned', raw: 'Planned', linkKind: 'record',
            url: 'https://www.registrdigitalizace.cz/rdcz/detail/demo2', observed: '1 hour ago', checked: '1 hour ago' }
        ] }),
    D({ id: 'D3', catalogId: 'MZK01-000998431', title: 'Moravská orlice',
        unit: { type: 'volume-name', value: '1899' }, signature: 'ST1-0104',
        pageSources: [ { source: 'manual', tier: 100, value: 1120, at: '18 Jun 2026', by: 'u4' },
                       { source: 'catalog', tier: 50, value: 1098, at: '17 Jun 2026' } ],
        registries: [
          { source: 'Kramerius', state: 'NotFound', raw: null, observed: '20 min ago', checked: '20 min ago' },
          { source: 'RDCZ', state: 'Unmapped', raw: 'Revision', linkKind: 'record',
            url: 'https://www.registrdigitalizace.cz/rdcz/detail/demo3', observed: '20 min ago', checked: '20 min ago' }
        ] }),
    D({ id: 'D4', catalogId: 'MZK03-000112877', title: 'Kniha o Brně',
        type: 'Monograph', signature: 'MB4-0921',
        pageSources: [ { source: 'catalog', tier: 50, value: 312, at: '9 Jun 2026' } ],
        registries: [ { source: 'Kramerius', state: 'NotFound', raw: null, observed: '5 min ago', checked: '5 min ago' } ] }),
    D({ id: 'D5', catalogId: 'MZK01-001452200', title: 'Hlas Moravy',
        unit: { type: 'barcode', value: 'MZK-2801-000341' }, signature: 'ST3-0455',
        pageSources: [ { source: 'predictor', tier: 20, value: 780, at: '21 Jun 2026' } ],
        registries: [ { source: 'Kramerius', state: 'NotFound', raw: null, observed: '2 hours ago', checked: '2 hours ago' },
                      { source: 'RDCZ', state: 'CheckFailed', raw: null, error: 'gateway timeout',
                        observed: '6 weeks ago', checked: '4 min ago' } ] }),
    D({ id: 'D6', catalogId: 'MZK05-000004412', title: 'Graduál rajhradský',
        type: 'Manuscript', signature: 'RKP-0012',
        pageSources: [ { source: 'manual', tier: 100, value: 244, at: '2 Apr 2026', by: 'u1' } ],
        registries: [ { source: 'Kramerius', state: 'NotFound', raw: null, observed: '1 day ago', checked: '1 day ago' } ] }),
    D({ id: 'D7', catalogId: 'MZK01-001300094', title: 'Zemědělské listy',
        unit: { type: 'volume-number', value: 'roč. 12' }, signature: 'ST2-0311',
        pageSources: [ { source: 'catalog', tier: 50, value: 620, at: '14 Jun 2026' } ],
        registries: [ { source: 'Kramerius', state: 'NotFound', raw: null, observed: '30 min ago', checked: '30 min ago' } ] }),
    D({ id: 'D8', catalogId: 'MZK01-001277001', title: 'Slovácké noviny',
        unit: { type: 'volume-name', value: '1936–1938' }, signature: 'ST1-0788',
        pageSources: [ { source: 'catalog', tier: 50, value: 1440, at: '3 Jun 2026' } ],
        registries: [ { source: 'Kramerius', state: 'Published', raw: 'published', linkKind: 'content',
                        url: 'https://kramerius.mzk.cz/view/uuid:demo8', observed: '12 min ago', checked: '12 min ago' } ] }),
    D({ id: 'D9', catalogId: 'MZK04-000067120', title: 'Mapa Moravy 1846',
        type: 'Map', signature: 'MAP-0067',
        pageSources: [ { source: 'catalog', tier: 50, value: 2, at: '8 Jun 2026' } ],
        registries: [] }),
    D({ id: 'D10', catalogId: 'MZK03-000445012', title: 'Dějiny Velehradu',
        type: 'Monograph', signature: 'MB2-0140',
        pageSources: [ { source: 'catalog', tier: 50, value: 488, at: '19 Jun 2026' } ],
        registries: [ { source: 'Kramerius', state: 'NotFound', raw: null, observed: '2 days ago', checked: '2 days ago' } ] }),
    D({ id: 'D11', catalogId: 'MZK01-001509888', title: 'Věstník spolku',
        unit: { type: 'volume-number', value: 'roč. 4' }, signature: 'ST4-0025',
        pageSources: [],
        registries: [] }),
    D({ id: 'D12', catalogId: 'MZK05-000009901', title: 'Kodex Gigas — fragment',
        type: 'Manuscript', signature: 'RKP-0341',
        pageSources: [ { source: 'manual', tier: 100, value: 18, at: '28 May 2026', by: 'u1' } ],
        registries: [] }),
    D({ id: 'D13', catalogId: 'MZK01-001388120', title: 'Selské noviny',
        unit: { type: 'volume-name', value: '1907–1911' }, signature: 'ST2-0512',
        pageSources: [ { source: 'catalog', tier: 50, value: 1980, at: '21 Jun 2026' } ],
        registries: [ { source: 'Kramerius', state: 'NotFound', raw: null, observed: '15 min ago', checked: '15 min ago' } ] }),
    D({ id: 'D14', catalogId: 'MZK01-001290877', title: 'Čas',
        unit: { type: 'volume-number', value: 'roč. 21' }, signature: 'ST1-0233',
        pageSources: [ { source: 'catalog', tier: 50, value: 3140, at: '20 Jun 2026' } ],
        registries: [ { source: 'RDCZ', state: 'InProgress', raw: 'InProgress', linkKind: 'record',
                        url: 'https://www.registrdigitalizace.cz/rdcz/detail/demo14',
                        observed: '40 min ago', checked: '40 min ago' } ] }),
    D({ id: 'D15', catalogId: 'MZK01-001411903', title: 'Hospodářský obzor',
        unit: { type: 'volume-number', value: 'roč. 6' }, signature: 'ST4-0117',
        pageSources: [ { source: 'catalog', tier: 50, value: 540, at: '22 Jun 2026' } ],
        registries: [ { source: 'Kramerius', state: 'Published', raw: 'published', linkKind: 'content',
                        url: 'https://kramerius.mzk.cz/view/uuid:demo15', observed: '1 day ago', checked: '1 hour ago' } ] }),
    D({ id: 'D16', catalogId: 'MZK01-001355400', title: 'Brněnské noviny',
        unit: { type: 'volume-name', value: '1921' }, signature: 'ST1-0620',
        pageSources: [ { source: 'predictor', tier: 20, value: 1250, at: '22 Jun 2026' } ],
        registries: [ { source: 'Kramerius', state: 'Published', raw: 'published', linkKind: 'content',
                        url: 'https://kramerius.mzk.cz/view/uuid:demo16',
                        observed: '25 min ago', checked: '25 min ago' } ] }),
    D({ id: 'D34', catalogId: 'MZK01-001476310', title: 'Hlas lidu',
        unit: { type: 'volume-number', value: 'roč. 19' }, signature: 'ST2-0877',
        pageSources: [ { source: 'predictor', tier: 20, value: 1460, at: '17 Jun 2026' } ],
        registries: [ { source: 'Kramerius', state: 'NotFound', raw: null, observed: '2 days ago', checked: '2 days ago' } ] }),
    D({ id: 'D35', catalogId: 'MZK01-001502233', title: 'Našinec',
        unit: { type: 'volume-number', value: 'roč. 12' }, signature: 'ST3-0149',
        pageSources: [],
        registries: [] }),
    /* on lists, and in the pool — enough supply per category for a list to
       be built by hand or generated, and short in Maps on purpose */
    ...[
      ['D36', 'MZK03-000301144', 'Moravské hory a doly', null, 'Monograph', 'MB1-0217', 420],
      ['D37', 'MZK01-001250008', 'Rovnost', ['volume-name', '1920'], 'Periodical', 'ST1-0515', 1310],
      ['D38', 'MZK01-001301550', 'Hanák', ['volume-number', 'roč. 7'], 'Periodical', 'ST2-0402', 960],
      ['D39', 'MZK01-001420871', 'Příroda a škola', ['volume-number', 'roč. 2'], 'Periodical', 'ST4-0088', 402],
      ['D40', 'MZK01-001333912', 'Znojemský týdeník', ['volume-name', '1898'], 'Periodical', 'ST2-0633', 880],
      ['D41', 'MZK01-001345677', 'Kroměřížské noviny', ['volume-name', '1902'], 'Periodical', 'ST2-0719', 1204],
      ['D42', 'MZK01-001298430', 'Opavský týdeník', ['volume-name', '1885'], 'Periodical', 'ST2-0290', 1080],
      ['D43', 'MZK01-001180225', 'Moravské noviny', ['volume-name', '1849'], 'Periodical', 'ST1-0077', 1620],
      ['D44', 'MZK01-001266104', 'Lidové listy', ['volume-number', 'roč. 3'], 'Periodical', 'ST1-0391', 940],
      ['D45', 'MZK01-001401996', 'Časopis Matice moravské', ['volume-number', 'roč. 40'], 'Periodical', 'ST4-0012', 610],
      ['D46', 'MZK03-000284560', 'Pověsti z Hané', null, 'Monograph', 'MB1-0388', 188],
      ['D47', 'MZK03-000512300', 'Brněnský průmysl 1900', null, 'Monograph', 'MB3-0144', 264],
      ['D48', 'MZK05-000006120', 'Žaltář olomoucký', null, 'Manuscript', 'RKP-0077', 212],
      ['D49', 'MZK05-000007815', 'Kancionál brněnský', null, 'Manuscript', 'RKP-0190', 356]
    ].map(([id, catalogId, title, unit, type, signature, pages]) => D({ id, catalogId, title, type, signature,
        unit: unit ? { type: unit[0], value: unit[1] } : null,
        pageSources: [ { source: type === 'Manuscript' ? 'manual' : 'catalog',
                         tier: type === 'Manuscript' ? 100 : 50, value: pages, at: '2 Jun 2026' } ],
        registries: [ { source: 'Kramerius', state: 'NotFound', raw: null, observed: '1 hour ago', checked: '1 hour ago' } ] })),
    /* what the ended projects bought — published years ago, their lists
       long deleted; only listName survives, as on IT0 */
    ...[
      ['D50', 'MZK01-000980112', 'Brněnské noviny', ['volume-name', '1861'], 'Periodical', 'ST1-0102', 980, 'uuid:demo50'],
      ['D51', 'MZK03-000120447', 'Moravský zemský zákoník', null, 'Monograph', 'MB2-0033', 820, 'uuid:demo51'],
      ['D52', 'MZK01-000975530', 'Brünner Zeitung', ['volume-name', '1850'], 'Periodical', 'ST1-0044', 600, 'uuid:demo52'],
      ['D53', 'MZK03-000044810', 'Herbář Mattioliho', null, 'Monograph', 'ST-0412', 700, 'uuid:demo53'],
      ['D54', 'MZK03-000051277', 'Kancionál Šamotulský', null, 'Monograph', 'ST-0588', 540, 'uuid:demo54'],
      ['D55', 'MZK04-000031002', 'Atlas Moravy 1890', null, 'Map', 'MAP-0310', 380, 'uuid:demo55'],
      ['D56', 'MZK04-000029915', 'Plány města Brna 1825–1850', null, 'Map', 'MAP-0299', 230, 'uuid:demo56']
    ].map(([id, catalogId, title, unit, type, signature, pages, uuid]) => D({ id, catalogId, title, type, signature,
        unit: unit ? { type: unit[0], value: unit[1] } : null,
        pageSources: [ { source: 'catalog', tier: 50, value: pages, at: '3 Jan 2024' } ],
        registries: [ { source: 'Kramerius', state: 'Published', raw: 'published', linkKind: 'content',
                        url: `https://kramerius.mzk.cz/view/${uuid}`, observed: '2 hours ago', checked: '2 hours ago' } ] })),
    D({ id: 'D17', catalogId: 'MZK03-000601877', title: 'Brno — plán regulace',
        type: 'Monograph', signature: 'MB3-0612',
        pageSources: [], registries: [] })
  ];
  const doc = (id) => documents.find(d => d.id === id);

  /* highest tier that HAS a value wins; `manual` is the reserved top tier */
  function effectivePages(d) {
    const rows = (d.pageSources || []).filter(r => r.value != null);
    if (!rows.length) return null;
    return rows.slice().sort((a, b) => b.tier - a.tier)[0];
  }

  /* ----------------------------------------------------------- defects */

  const DEF = (plugin, rule, subject, pub, int, seen) =>
    ({ key: `${plugin}:${rule}:${subject}`, plugin, rule, subject,
       publicText: pub, internalText: int, seen: seen || null });

  /* --------------------------------------------------------- iterations */
  /* The unit of work. Category, priority, project, list, status all here.  */

  const iterations = [
    { id: 'IT1', doc: 'D1', category: 'c22', priority: 'High', project: 'p1',
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'Published', list: 'L-2026-012', cancellation: null,
      defects: [ DEF('CatalogValidity', 'R07', '260$c',
        'Publication year is unclear on the record.',
        'MARC 260$c reads "19uu"; publication year cannot be resolved.', '19 Jun 2026') ],
      approvedKeys: [], deniedKeys: [], request: 'R1' },

    { id: 'IT2', doc: 'D2', category: 'c21', priority: 'Normal', project: 'p1',
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'Planned', list: 'L-2026-015', cancellation: null,
      defects: [], approvedKeys: [], deniedKeys: [], request: 'R2' },

    { id: 'IT3', doc: 'D3', category: 'c21', priority: 'Urgent', project: 'p3',
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'Ready', list: null, cancellation: null,
      defects: [ DEF('PageCount', 'R02', 'pages',
        'The page count on file differs from the catalogue.',
        'Manual page count 1120 differs from catalog 1098 by 22 pages.') ],
      approvedKeys: ['PageCount:R02:pages'], deniedKeys: [], request: 'R3' },

    { id: 'IT4', doc: 'D4', category: 'c12', priority: 'Normal', project: null,
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'Ready', list: null, cancellation: null,
      defects: [], approvedKeys: [], deniedKeys: [], request: 'R4' },

    { id: 'IT5', doc: 'D5', category: 'c21', priority: 'Normal', project: 'p1',
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'InProgress', list: 'L-2026-014', cancellation: null,
      defects: [], approvedKeys: [], deniedKeys: [], request: 'R5' },

    { id: 'IT6', doc: 'D6', category: 'c31', priority: 'High', project: 'p3',
      decision: 'Approved', restrictionOverride: null,
      restriction: { rule: 'Conservation hold',
        publicText: 'Not available for digitization (condition).',
        internalText: 'Binding unstable; conservation report 2026/114 prohibits handling until restored.' },
      progress: 'Enqueued', list: null, cancellation: null,
      defects: [], approvedKeys: [], deniedKeys: [], request: 'R6' },

    { id: 'IT7', doc: 'D7', category: 'c23', priority: 'Normal', project: null,
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'IngestFailed', list: null, cancellation: null, attempts: 3,
      defects: [], approvedKeys: [], deniedKeys: [], request: 'R7',
      ingestError: 'Catalog adapter returned HTTP 502 after 3 attempts.' },

    /* the 2019 scan — the SAME document's first iteration. The 2026 rescan
       below is a second attempt, not a second document (concepts §Document) */
    { id: 'IT0', n: 1, doc: 'D8', category: 'c21', priority: 'Normal', project: null,
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'Published', list: null, listName: 'Periodicals 2019/3', cancellation: null,
      defects: [], approvedKeys: [], deniedKeys: [], request: 'R0',
      digitizedAt: 'Nov 2019', dpi: 300 },

    { id: 'IT8', n: 2, doc: 'D8', category: 'c21', priority: 'Low', project: null,
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'Ready', list: null, cancellation: null,
      defects: [], approvedKeys: [], deniedKeys: [], request: 'R8' },

    { id: 'IT9', doc: 'D9', category: 'c4', priority: 'Low', project: null,
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'Ready', list: null,
      cancellation: { cause: 'Decided', by: 'u2', at: '21 Jun 2026',
        publicText: 'Postponed — will be scheduled next quarter.',
        internalText: 'Large-format scanner unavailable until Q4; removed from July batch.' },
      defects: [], approvedKeys: [], deniedKeys: [], request: 'R9' },

    { id: 'IT10', doc: 'D10', category: 'c12', priority: 'Normal', project: 'p2',
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'Enqueued', list: null, cancellation: null,
      defects: [ DEF('CatalogValidity', 'R03', '245$a',
        'The title on the record needs checking.',
        'MARC 245$a contains an unbalanced bracket: "Dějiny Velehradu [díl I".'),
        DEF('LanguageCheck', 'R01', '041$a',
        'The language of the item is not recorded.',
        'MARC 041$a absent; language could not be determined from 008/35-37.') ],
      approvedKeys: [], deniedKeys: [], request: 'R10' },

    { id: 'IT11', doc: 'D11', category: 'c23', priority: 'Normal', project: null,
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'Enqueued', list: null, cancellation: null,
      defects: [ DEF('PageCount', 'R01', 'pages',
        'No page count could be established.',
        'No catalog page count; predictor declined (insufficient features).') ],
      approvedKeys: [], deniedKeys: ['PageCount:R01:pages'], request: 'R11',
      deniedBy: 'u1', deniedAt: '20 Jun 2026',
      deniedNote: 'Cannot plan capacity without a page count. Returns when one exists.' },

    { id: 'IT12', doc: 'D12', category: 'c32', priority: 'Urgent', project: 'p3',
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'Digitized', list: 'L-2026-012', cancellation: null,
      defects: [ DEF('CatalogValidity', 'R11', '300$a',
        'The extent recorded does not match what was scanned.',
        'MARC 300$a says 16 ff.; 18 images delivered.') ],
      approvedKeys: [], deniedKeys: [], request: 'R12' },

    /* --- the validation queue proper: outstanding defects, in custody --- */

    { id: 'IT13', doc: 'D13', category: 'c21', priority: 'Urgent', project: 'p1',
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'Enqueued', list: null, cancellation: null,
      defects: [ DEF('CatalogValidity', 'R07', '260$c',
          'The publication years are unclear on the record.',
          'MARC 260$c reads "190u-191u"; neither bound resolves.'),
        DEF('PageCount', 'R04', 'pages',
          'The page count looks unusually high for the years covered.',
          'Catalog 1980 pp over 5 volume-years = 396 pp/yr, 3.2σ above the periodical mean.') ],
      approvedKeys: [], deniedKeys: [], request: 'R23' },

    /* forbidden by a rule — never by a person (decided 2026-09-26). A
       restriction outranks a review state, so it waits in Validations'
       Forbidden filter, where a curator can only message an admin */
    { id: 'IT14', doc: 'D14', category: 'c22', priority: 'Normal', project: 'p1',
      decision: 'Approved', restrictionOverride: null,
      restriction: { rule: 'Copyright', by: 'Czech copyright', plugin: 'pi28', code: 'C70', at: '21 Jun 2026',
        publicText: 'Not available for digitization (rights).',
        internalText: 'Editor-in-chief died 1961: protected until 2031 under the 70-year rule.' },
      progress: 'Enqueued', list: null, cancellation: null,
      defects: [ DEF('LanguageCheck', 'R01', '041$a',
          'The language of the item is not recorded.',
          'MARC 041$a absent; 008/35-37 reads "und".') ],
      approvedKeys: [], deniedKeys: [], request: 'R24' },

    { id: 'IT15', doc: 'D15', category: 'c23', priority: 'Normal', project: null,
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'Ready', list: null, cancellation: null,
      defects: [], approvedKeys: [], deniedKeys: [], request: 'R25' },

    /* two things true at once — the case a single enum cannot hold */
    { id: 'IT16', doc: 'D16', category: 'c21', priority: 'High', project: 'p1',
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'Enqueued', list: null, cancellation: null,
      defects: [ DEF('PageCount', 'R03', 'pages',
          'The page count is an estimate, not a count.',
          'Only the predictor answered (tier 20); no catalog extent on the record.') ],
      approvedKeys: [], deniedKeys: [], request: 'R26' },

    /* accepted once; the catalog record then changed upstream and the re-run
       found something NEW — so the curator is shown only the new defect */
    { id: 'IT18', doc: 'D34', category: 'c21', priority: 'Normal', project: null,
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'Enqueued', list: null, cancellation: null,
      defects: [ DEF('PageCount', 'R03', 'pages',
          'The page count is an estimate, not a count.',
          'Only the predictor answered (tier 20); no catalog extent on the record.', '17 Jun 2026'),
        DEF('CatalogValidity', 'R07', '260$c',
          'The publication year is unclear on the record.',
          'MARC 260$c changed upstream from "1906" to "190-?"; the year no longer resolves.', '24 Jun 2026') ],
      approvedKeys: ['PageCount:R03:pages'], deniedKeys: [], request: 'R38' },

    /* the identifier resolves to nothing — fixed by relinking, after which
       the re-check takes it out of D on its own (status-model §2) */
    { id: 'IT19', doc: 'D35', category: 'c23', priority: 'High', project: null,
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'Enqueued', list: null, cancellation: null,
      defects: [ DEF('CatalogLink', 'R01', 'record',
          'The catalogue record for this volume could not be found.',
          'Aleph returned no record for MZK01-001502233 · roč. 12; the ISSN on the request belongs to a different title.', '23 Jun 2026') ],
      approvedKeys: [], deniedKeys: [], request: 'R39' },

    /* --- members of lists, and the pool the list editor draws from --- */
    ...[
      ['IT20', 'D36', 'c11', 'Normal', 'p3', 'Published',  'L-2026-012'],
      ['IT21', 'D37', 'c22', 'High',   'p1', 'InProgress', 'L-2026-014'],
      ['IT22', 'D38', 'c21', 'Normal', 'p1', 'InProgress', 'L-2026-014'],
      ['IT23', 'D39', 'c23', 'Normal', 'p1', 'InProgress', 'L-2026-014'],
      ['IT24', 'D40', 'c21', 'High',   null, 'Planned',    'L-2026-015'],
      ['IT25', 'D41', 'c21', 'Normal', null, 'Planned',    'L-2026-015'],
      ['IT26', 'D42', 'c21', 'High',   'p1', 'Ready', null],
      ['IT27', 'D43', 'c22', 'High',   'p1', 'Ready', null],
      ['IT28', 'D44', 'c22', 'Normal', null, 'Ready', null],
      ['IT29', 'D45', 'c23', 'Normal', null, 'Ready', null],
      ['IT30', 'D46', 'c11', 'Normal', 'p2', 'Ready', null],
      ['IT31', 'D47', 'c12', 'High',   'p2', 'Ready', null],
      ['IT32', 'D48', 'c31', 'High',   'p3', 'Ready', null],
      ['IT33', 'D49', 'c32', 'Normal', 'p3', 'Ready', null]
    ].map(([id, doc, category, priority, project, progress, list], i) => ({ id, doc, category, priority, project,
        decision: 'Approved', restriction: null, restrictionOverride: null, progress, list, cancellation: null,
        defects: [], approvedKeys: [], deniedKeys: [], request: 'R' + (40 + i) })),

    /* funded by the ended projects — Published, list deleted long ago */
    ...[
      ['IT34', 'D50', 'c21', 'p5', 'VISK 7 — spring 2025',  'May 2025'],
      ['IT35', 'D51', 'c12', 'p5', 'VISK 7 — autumn 2025',  'Oct 2025'],
      ['IT36', 'D52', 'c22', 'p5', 'VISK 7 — autumn 2025',  'Nov 2025'],
      ['IT37', 'D53', 'c32', 'p6', 'Staré tisky — 2024',    'Sep 2024'],
      ['IT38', 'D54', 'c32', 'p6', 'Staré tisky — 2025',    'Apr 2025'],
      ['IT39', 'D55', 'c4',  'p7', 'Mapy — 2023',           'Jun 2023'],
      ['IT40', 'D56', 'c4',  'p7', 'Mapy — 2024',           'Aug 2024']
    ].map(([id, doc, category, project, listName, digitizedAt], i) => ({ id, doc, category, priority: 'Normal', project,
        decision: 'Approved', restriction: null, restrictionOverride: null, progress: 'Published',
        list: null, listName, digitizedAt, cancellation: null,
        defects: [], approvedKeys: [], deniedKeys: [], request: 'R' + (54 + i) })),

    /* a second ingest failure, in a batch where the rest came in — so grouping
       by batch shows a batch that is PARTLY stuck, the common case */
    { id: 'IT17', doc: 'D17', category: 'c12', priority: 'Normal', project: null,
      decision: 'Approved', restriction: null, restrictionOverride: null,
      progress: 'IngestFailed', list: null, cancellation: null, attempts: 1,
      defects: [], approvedKeys: [], deniedKeys: [], request: 'R27',
      ingestError: 'Catalog record MZK03-000601877 has no 245 field; the adapter rejected it.' }
  ];
  /* a listed item that gains a blocker stays on its list, flagged — the
     dig-curator decides whether to take it off (decided 2026-09-26) */
  iterations.find(it => it.id === 'IT25').defects = [DEF('PageCount', 'R02', 'pages',
    'The page count does not match the catalog.', 'Catalog 300a says 412 p.; the predictor counts 640 — found after it was listed.', '24 Jun 2026')];

  const iter = (id) => iterations.find(i => i.id === id);
  /* every attempt at one document, oldest first — `n` is the attempt number */
  const iterationsOfDoc = (docId) => iterations.filter(i => i.doc === docId)
    .sort((a, b) => (a.n || 1) - (b.n || 1));
  /* the CURRENT iteration is the latest attempt; earlier ones are history */
  const iterOfDoc = (docId) => iterationsOfDoc(docId).slice(-1)[0];

  /* ----------------------------------------------------------- requests */
  /* One row per ask. Proposal and addition are PHASES of this, not entities.
     A request either PRODUCES an iteration or SHADOWS one.                 */

  const requests = [
    { id: 'R1',  doc: 'D1',  by: 'u5', at: '11 Mar 2026', decision: 'Approved', iteration: 'IT1',
      reason: 'Researching interwar press coverage of Brno for a dissertation chapter.' },
    { id: 'R2',  doc: 'D2',  by: 'u4', at: '2 May 2026',  decision: 'Approved', iteration: 'IT2', reason: null },
    { id: 'R3',  doc: 'D3',  by: 'u6', at: '17 Jun 2026', decision: 'Approved', iteration: 'IT3',
      reason: 'Needed for the March exhibition on regional journalism.' },
    { id: 'R4',  doc: 'D4',  by: 'u5', at: '9 Jun 2026',  decision: 'Approved', iteration: 'IT4',
      reason: 'Came across it in the catalogue, looked interesting.' },
    { id: 'R5',  doc: 'D5',  by: 'a1', at: '21 Jun 2026', decision: 'Approved', iteration: 'IT5', reason: null },
    { id: 'R6',  doc: 'D6',  by: 'u1', at: '2 Apr 2026',  decision: 'Approved', iteration: 'IT6', reason: null },
    { id: 'R7',  doc: 'D7',  by: 'u7', at: '14 Jun 2026', decision: 'Approved', iteration: 'IT7',
      reason: 'Family history — my great-grandfather wrote for this paper.' },
    { id: 'R0',  doc: 'D8',  by: 'u4', at: '12 Mar 2019', decision: 'Approved', iteration: 'IT0', reason: null },
    /* approved OVER an existing copy — a rescan, decided by a curator on its
       own (status-model §2, §2.8) */
    { id: 'R8',  doc: 'D8',  by: 'a2', at: '3 Jun 2026',  decision: 'Approved', iteration: 'IT8', reason: null,
      existingCopies: [
        { source: 'VERA', state: 'Published', iteration: 'IT0', seenAt: '3 Jun 2026' },
        { source: 'Kramerius', state: 'Published', link: 'https://kramerius.mzk.cz/view/uuid:demo8', seenAt: '3 Jun 2026' } ],
      rescan: { by: 'u1', at: '19 Jun 2026',
        note: 'The 2019 scan is 300 dpi greyscale; the regional project needs 400 dpi colour.' } },
    { id: 'R9',  doc: 'D9',  by: 'u4', at: '8 Jun 2026',  decision: 'Approved', iteration: 'IT9', reason: null },
    { id: 'R10', doc: 'D10', by: 'u5', at: '19 Jun 2026', decision: 'Approved', iteration: 'IT10',
      reason: 'Local history society is preparing an anniversary publication.' },
    { id: 'R11', doc: 'D11', by: 'u6', at: '20 Jun 2026', decision: 'Approved', iteration: 'IT11', reason: null },
    { id: 'R12', doc: 'D12', by: 'u1', at: '28 May 2026', decision: 'Approved', iteration: 'IT12', reason: null },

    { id: 'R23', doc: 'D13', by: 'u6', at: '21 Jun 2026', decision: 'Approved', iteration: 'IT13',
      reason: 'Agricultural history seminar — the 1908 harvest reports.' },
    { id: 'R24', doc: 'D14', by: 'a2', at: '20 Jun 2026', decision: 'Approved', iteration: 'IT14', reason: null },
    /* a copy that appeared AFTER approval — nobody decided over it, so it is
       a warning, not a rescan (registry-status §10) */
    { id: 'R25', doc: 'D15', by: 'u4', at: '22 Jun 2026', decision: 'Approved', iteration: 'IT15', reason: null,
      existingCopies: [ { source: 'Kramerius', state: 'Published', link: 'https://kramerius.mzk.cz/view/uuid:demo15',
                          seenAt: '24 Jun 2026', afterApproval: true } ] },
    { id: 'R26', doc: 'D16', by: 'u7', at: '22 Jun 2026', decision: 'Approved', iteration: 'IT16',
      reason: 'The Kramerius scan is unreadable at the resolution I need.',
      existingCopies: [ { source: 'Kramerius', state: 'Published', link: 'https://kramerius.mzk.cz/view/uuid:demo16', seenAt: '22 Jun 2026' } ],
      rescan: { by: 'u1', at: '22 Jun 2026', note: 'Existing scan is 150 dpi; unusable for the requested study.' } },
    { id: 'R27', doc: 'D17', by: 'u5', at: '18 Jun 2026', decision: 'Approved', iteration: 'IT17',
      reason: 'Cited in a paper on interwar town planning.' },

    { id: 'R38', doc: 'D34', by: 'u4', at: '17 Jun 2026', decision: 'Approved', iteration: 'IT18',
      reason: 'Completes the run of Hlas lidu we already hold 1900–1918.' },
    { id: 'R39', doc: 'D35', by: 'a2', at: '23 Jun 2026', decision: 'Approved', iteration: 'IT19', reason: null },

    /* the asks behind the list members and the pool — dates are the
       tie-break a rule-based generator orders by */
    ...[['u5', '12 May 2026'], ['a1', '28 Apr 2026'], ['u4', '6 May 2026'], ['u6', '14 May 2026'],
        ['u4', '30 Apr 2026'], ['a2', '2 May 2026'], ['u6', '26 May 2026'], ['u5', '9 May 2026'],
        ['a2', '1 Jun 2026'], ['u7', '4 Jun 2026'], ['u5', '21 May 2026'], ['u4', '18 May 2026'],
        ['u1', '11 May 2026'], ['u6', '3 Jun 2026']]
      .map(([by, at], i) => ({ id: 'R' + (40 + i), doc: 'D' + (36 + i), by, at, decision: 'Approved',
        iteration: 'IT' + (20 + i), reason: null })),

    ...[['u1', '14 Jan 2025'], ['u4', '3 Mar 2025'], ['u1', '20 Mar 2025'], ['u4', '11 Mar 2024'],
        ['u1', '9 Oct 2024'], ['u4', '2 Feb 2022'], ['u1', '15 May 2023']]
      .map(([by, at], i) => ({ id: 'R' + (54 + i), doc: 'D' + (50 + i), by, at, decision: 'Approved',
        iteration: 'IT' + (34 + i), reason: null })),

    /* shadows — arrived after work had started, resolved without review */
    { id: 'R13', doc: 'D1',  by: 'u7', at: '4 Jun 2026',  decision: 'Duplicate', tracks: 'IT1',
      reason: 'Want to read the 1921 issues.' },
    { id: 'R14', doc: 'D3',  by: 'u5', at: '19 Jun 2026', decision: 'Duplicate', tracks: 'IT3',
      reason: 'Same exhibition — I am writing the catalogue text.' },
    { id: 'R15', doc: 'D3',  by: 'u4', at: '20 Jun 2026', decision: 'Duplicate', tracks: 'IT3', reason: null },

    /* pending — several asks for one document, decided together */
    { id: 'R16', custodies: ['pc1', 'pc2'], doc: 'D20', by: 'u6', at: '22 Jun 2026', decision: 'Pending',
      reason: 'Needed for a seminar in October.' },
    { id: 'R17', custodies: ['pc1', 'pc2'], doc: 'D20', by: 'u5', at: '22 Jun 2026', decision: 'Pending',
      reason: 'Citation chasing — referenced in a 1954 bibliography.' },
    { id: 'R18', custodies: ['pc1', 'pc2'], doc: 'D20', by: 'u7', at: '23 Jun 2026', decision: 'Pending', reason: null },
    /* checks not run yet — checkedAt null (status-model §2) */
    { id: 'R19', custodies: ['pc1'], doc: 'D21', by: 'u5', at: '21 Jun 2026', decision: 'Pending', checkedAt: null,
      reason: 'Regional history project, would like the full run.' },
    /* a plugin's `additions` entry point asked for approval on arrival; the
       check found a copy, so it is HELD — the intent kept, into review
       (status-model §2.8) */
    { id: 'R20', custodies: ['pc3'], project: 'p3', afterApproval: true, doc: 'D22', by: 'a1', at: '23 Jun 2026', decision: 'Pending', reason: null,
      approveOnCheck: { actor: 'a1', at: '23 Jun 2026' },
      existingCopies: [ { source: 'Kramerius', state: 'Published', link: 'https://kramerius.mzk.cz/view/uuid:demo22', seenAt: '23 Jun 2026' } ] },
    { id: 'R21', doc: 'D23', by: 'u6', at: '18 Jun 2026', decision: 'Denied',
      reason: 'Curious about the illustrations.',
      declinePublic: 'Too fragile to scan in its current condition.',
      declineInternal: 'Conservation report 2026/098: spine detached, leaf loss at gatherings 3–5.',
      declinedBy: 'u1', declinedAt: '19 Jun 2026' },
    { id: 'R22', doc: 'D24', by: 'u5', at: '10 Jun 2026', decision: 'Withdrawn',
      reason: 'Wrong volume — I meant 1937.', withdrawnAt: '11 Jun 2026' },

    /* submitted as BATCHES — one submission of several items is one batch,
       whichever way it was filled. A batch groups the asks; it decides
       nothing, since the decision is per document (status-model §2.7) */
    /* B-0143 — a shelf, scanned book after book */
    { id: 'R28', custodies: ['pc1', 'pc2'], project: 'p1', afterApproval: true, doc: 'D25', by: 'u4', at: '24 Jun 2026', batch: 'B-0143', decision: 'Pending',
      reason: 'Reading room: the run is requested weekly and the paper is brittle.' },
    { id: 'R29', custodies: ['pc1', 'pc2'], project: 'p1', afterApproval: true, doc: 'D26', by: 'u4', at: '24 Jun 2026', batch: 'B-0143', decision: 'Pending',
      reason: 'Reading room: the run is requested weekly and the paper is brittle.' },
    { id: 'R30', custodies: ['pc1', 'pc2'], project: 'p1', afterApproval: true, doc: 'D27', by: 'u4', at: '24 Jun 2026', batch: 'B-0143', decision: 'Pending',
      reason: 'Reading room: the run is requested weekly and the paper is brittle.',
      existingCopies: [ { source: 'Kramerius', state: 'Published', link: 'https://kramerius.mzk.cz/view/uuid:demo27', seenAt: '24 Jun 2026' } ] },
    { id: 'R31', custodies: ['pc1', 'pc2'], project: 'p1', afterApproval: true, doc: 'D28', by: 'u4', at: '24 Jun 2026', batch: 'B-0143', decision: 'Pending',
      reason: 'Reading room: the run is requested weekly and the paper is brittle.' },
    /* the same document asked for before, on its own — ONE row, listed with
       its earliest ask, and the batch says where it went */
    { id: 'R32', custodies: ['pc1', 'pc2'], project: 'p1', afterApproval: true, doc: 'D20', by: 'u4', at: '24 Jun 2026', batch: 'B-0143', decision: 'Pending',
      reason: 'Reading room: the run is requested weekly and the paper is brittle.' },
    /* B-0144 — a reader's pasted list, inside propose.max_at_once */
    { id: 'R33', custodies: ['pc1'], project: 'p8', doc: 'D29', by: 'u5', at: '24 Jun 2026', batch: 'B-0144', decision: 'Pending',
      reason: 'The local history society is indexing Brno almanacs.' },
    { id: 'R34', custodies: ['pc1'], project: 'p8', doc: 'D30', by: 'u5', at: '24 Jun 2026', batch: 'B-0144', decision: 'Pending',
      reason: 'The local history society is indexing Brno almanacs.',
      existingCopies: [ { source: 'Kramerius', state: 'Published', link: 'https://kramerius.mzk.cz/view/uuid:demo30', seenAt: '24 Jun 2026' } ] },
    { id: 'R35', custodies: [], project: 'p8', doc: 'D31', by: 'u5', at: '24 Jun 2026', batch: 'B-0144', decision: 'Pending',
      reason: 'Street plans for a walking-history project.' },
    /* B-0145 — a harvesting agent; no reasons, it is a plugin */
    { id: 'R36', custodies: ['pc1'], doc: 'D32', by: 'a2', at: '25 Jun 2026', batch: 'B-0145', decision: 'Pending', reason: null },
    { id: 'R37', custodies: ['pc1'], doc: 'D33', by: 'a2', at: '25 Jun 2026', batch: 'B-0145', decision: 'Pending', reason: null }
  ];

  /* what the Custody plugins placed in each proposal custody right now —
     counted by document, since one decision covers every asker. A proposal
     no rule placed is in the fallback. */
  proposalCustodies.forEach(c => {
    const docs = new Set(requests.filter(r => r.decision === 'Pending' &&
      ((r.custodies || []).length ? r.custodies.includes(c.id) : c.fallback)).map(r => r.doc));
    c.open = docs.size;
  });
  /* the proposal custodies a proposal is in — the fallback when no rule
     named one (proposal-custody §3) */
  const custodiesOf = (r) => (r.custodies || []).length ? r.custodies : ['pc0'];

  /* proposal-stage documents (no iteration yet) */
  const proposalDocs = [
    D({ id: 'D20', catalogId: 'MZK01-001622010', title: 'Národní listy',
        unit: { type: 'volume-name', value: '1889' }, signature: 'ST1-0901',
        pageSources: [ { source: 'catalog', tier: 50, value: 2210, at: '22 Jun 2026' } ],
        registries: [ { source: 'Kramerius', state: 'NotFound', raw: null, observed: '1 hour ago', checked: '1 hour ago' },
                      { source: 'RDCZ', state: 'Planned', raw: 'Planned', linkKind: 'record',
                        url: 'https://www.registrdigitalizace.cz/rdcz/detail/demo20',
                        observed: '1 hour ago', checked: '1 hour ago' } ] }),
    D({ id: 'D21', catalogId: 'MZK01-001640055', title: 'Ostravský deník',
        unit: { type: 'volume-number', value: 'roč. 8' }, signature: 'ST2-0644',
        pageSources: [ { source: 'predictor', tier: 20, value: 890, at: '21 Jun 2026' } ],
        registries: [ { source: 'Kramerius', state: 'NotFound', raw: null, observed: '3 hours ago', checked: '3 hours ago' } ] }),
    D({ id: 'D22', catalogId: 'MZK03-000556213', title: 'Průvodce Moravským krasem',
        type: 'Monograph', signature: 'MB1-0455',
        pageSources: [ { source: 'catalog', tier: 50, value: 96, at: '23 Jun 2026' } ],
        registries: [ { source: 'Kramerius', state: 'Published', raw: 'published', linkKind: 'content',
                        url: 'https://kramerius.mzk.cz/view/uuid:demo22',
                        observed: '10 min ago', checked: '10 min ago' } ] }),
    D({ id: 'D23', catalogId: 'MZK05-000011204', title: 'Herbář moravský',
        type: 'Manuscript', signature: 'RKP-0455',
        pageSources: [ { source: 'catalog', tier: 50, value: 210, at: '18 Jun 2026' } ],
        registries: [] }),
    D({ id: 'D24', catalogId: 'MZK01-001277001', title: 'Slovácké noviny',
        unit: { type: 'volume-name', value: '1939' }, signature: 'ST1-0789',
        pageSources: [], registries: [] }),
    /* proposed in batches */
    ...['1872', '1873', '1874', '1875'].map((y, i) => D({ id: 'D' + (25 + i),
        catalogId: 'MZK01-000998431', title: 'Moravská orlice',
        unit: { type: 'volume-name', value: y }, signature: 'ST1-0412',
        pageSources: [ { source: 'catalog', tier: 50, value: [1180, 1204, 1236, 1190][i], at: '24 Jun 2026' } ],
        registries: y === '1874'
          ? [ { source: 'Kramerius', state: 'Published', raw: 'published', linkKind: 'content',
                url: 'https://kramerius.mzk.cz/view/uuid:demo27', observed: '20 min ago', checked: '20 min ago' } ]
          : [ { source: 'Kramerius', state: 'NotFound', raw: null, observed: '20 min ago', checked: '20 min ago' } ] })),
    ...['1901', '1902'].map((y, i) => D({ id: 'D' + (29 + i),
        catalogId: 'MZK03-000556300', title: 'Brněnský kalendář',
        unit: { type: 'volume-name', value: y }, signature: 'ST4-0120',
        pageSources: [ { source: 'catalog', tier: 50, value: [164, 172][i], at: '24 Jun 2026' } ],
        registries: [ { source: 'Kramerius', state: 'NotFound', raw: null, observed: '1 hour ago', checked: '1 hour ago' } ] })),
    D({ id: 'D31', catalogId: 'MZK03-000612045', title: 'Plán města Brna',
        unit: { type: 'volume-name', value: '1928' },
        type: 'Map', signature: 'MP1-0871', pageSources: [], registries: [] }),
    ...['1910', '1911'].map((y, i) => D({ id: 'D' + (32 + i),
        catalogId: 'MZK01-000211870', title: 'Hlídka',
        unit: { type: 'volume-name', value: y }, signature: 'ST3-0233',
        pageSources: [ { source: 'predictor', tier: 20, value: [960, 1010][i], at: '25 Jun 2026' } ],
        registries: [ { source: 'Kramerius', state: 'NotFound', raw: null, observed: '2 hours ago', checked: '2 hours ago' } ] }))
  ];
  documents.push(...proposalDocs);


  /* ------------------------------------------------------------ batches */
  /* An addition is a phase of a request, not an entity — but ingest is
     operated in batches, and a batch is the unit an admin retries.        */

  const batches = [
    /* submissions still in review — `via` is the way the list was filled;
       `items` fills as they are approved and ingested */
    { id: 'B-0145', name: 'ISSN sweep, 25 Jun', via: 'harvest', at: '25 Jun 2026 06:00', by: 'a2', items: [] },
    { id: 'B-0144', name: 'brno-almanacs.txt', via: 'pasted list', at: '24 Jun 2026 16:40', by: 'u5', items: [] },
    { id: 'B-0143', name: 'shelf ST1-04', via: 'barcode scan', at: '24 Jun 2026 10:14', by: 'u4', items: [] },
    { id: 'B-0142', name: 'proposals-2026-06-21.csv', at: '21 Jun 2026 09:12', by: 'u3',
      items: ['IT13', 'IT14', 'IT16'] },
    { id: 'B-0141', name: 'proposals-2026-06-19.csv', at: '19 Jun 2026 08:40', by: 'u3',
      items: ['IT10', 'IT11', 'IT17'] },
    { id: 'B-0138', name: 'harvest / ISSN harvester', at: '14 Jun 2026 06:00', by: 'a2',
      items: ['IT7'] },
    { id: 'B-0120', name: 'proposals-2026-04-02.csv', at: '2 Apr 2026 10:05', by: 'u3',
      items: ['IT6'] }
  ];
  const batchOf = (itId) => batches.find(b => b.items.includes(itId));

  /* ------------------------------------------------------------ plugins */
  /* A plugin is a TYPE; you create named INSTANCES of it. Three Aleph
     adapters pointed at three libraries are three instances of one type, and
     that is also the shape multi-library VERA needs (TODO(Tenancy)).

     A type declares what it CAN supply — property tiers, a raw_state mapping,
     an agent and entry point, rules. An instance declares WHERE it points.  */

  const pluginTypes = [
    { id: 'pt1', name: 'AlephCatalogAdapter', kind: 'Catalog adapter', version: '2.4.1',
      description: 'Adapter for the Aleph ILS. Speaks Z39.50 and REST; enumerates units.',
      properties: [ { key: 'page_count', tier: 50 }, { key: 'material_type', tier: 50 },
                    { key: 'unit_enumeration', tier: 50 } ],
      identifiers: ['CNBID', 'ISSN', 'ISBN'], mapping: null, agent: null, entry: null, rules: null,
      instances: [
        /* `search` — whether the propose dialog can search this catalog.
           A catalog it cannot search is still usable: the user is sent
           there (`opac`), and the adapter reads back the record link they
           copy (`linkHint`) — document-identity */
        { id: 'pi1', name: 'MZK Aleph',  config: 'base_url=aleph.mzk.cz · protocol=REST · timeout=30s',
          linked: 'all categories', by: 'u3', at: '15 Jan 2026', enabled: true,
          schedule: 'on demand', lastRun: '10 min ago', search: true },
        { id: 'pi2', name: 'NKP Aleph',  config: 'base_url=aleph.nkp.cz · protocol=Z39.50 · timeout=45s · search=off',
          linked: 'all categories', by: 'u3', at: '15 Jan 2026', enabled: true,
          schedule: 'on demand', lastRun: '10 min ago', search: false,
          opac: 'https://aleph.nkp.cz/F/?func=file&file_name=find-b&local_base=NKC',
          linkHint: 'the record\'s <b>Permanent link</b>, under the full record' },
        { id: 'pi3', name: 'VKOL Aleph', config: 'base_url=aleph.vkol.cz · protocol=REST · timeout=30s',
          linked: 'all categories', by: 'u3', at: '20 Feb 2026', enabled: true,
          schedule: 'on demand', lastRun: '7 Jun 2026', search: true } ] },

    { id: 'pt2', name: 'KrameriusRegistry', kind: 'Registry', version: '1.8.0',
      description: 'Asks a Kramerius instance whether a record is already published.',
      properties: [], identifiers: [], rules: null, agent: null, entry: null,
      mapping: [ { raw: 'published', state: 'Published', copy: true },
                 { raw: '(absent)',  state: 'NotFound',  copy: false } ],
      instances: [
        { id: 'pi4', name: 'MZK Kramerius', config: 'base_url=kramerius.mzk.cz · link=content',
          linked: 'all categories', by: 'u3', at: '15 Jan 2026', enabled: true,
          schedule: 'on ingest', lastRun: 'running now' } ] },

    { id: 'pt3', name: 'RDCZRegistry', kind: 'Registry', version: '1.2.3',
      description: 'The national digitization registry. Reports what other libraries plan and hold.',
      properties: [], identifiers: [], rules: null, agent: null, entry: null,
      mapping: [ { raw: 'Planned',    state: 'Planned',    copy: false },
                 { raw: 'InProgress', state: 'InProgress', copy: false },
                 { raw: 'Digitized',  state: 'Digitized',  copy: true },
                 { raw: 'Revision',   state: 'Unmapped',   copy: false } ],
      instances: [
        { id: 'pi5', name: 'RDCZ production', config: 'base_url=registrdigitalizace.cz · link=record',
          linked: 'all categories', by: 'u3', at: '15 Jan 2026', enabled: true,
          schedule: 'on ingest', lastRun: '06:00 today' } ] },

    { id: 'pt4', name: 'PageCountPredictor', kind: 'Property source', version: '0.9.2',
      description: 'Estimates an extent from material type, year and format when no catalogue extent exists.',
      properties: [ { key: 'page_count', tier: 20 } ],
      identifiers: [], mapping: null, agent: null, entry: null, rules: null,
      instances: [
        { id: 'pi6', name: 'Periodicals model', config: 'model=periodical-v3 · min_confidence=0.6',
          linked: 'Periodicals', by: 'u2', at: '3 Mar 2026', enabled: true,
          schedule: 'on ingest', lastRun: '21 Jun 2026' },
        { id: 'pi7', name: 'Monographs model', config: 'model=monograph-v1 · min_confidence=0.75',
          linked: 'Monographs', by: 'u2', at: '3 Mar 2026', enabled: true,
          schedule: 'on ingest', lastRun: '19 Jun 2026' } ] },

    { id: 'pt5', name: 'ISSNHarvester', kind: 'Harvester', version: '1.0.4',
      description: 'Watches the ISSN portal for new titles in scope and proposes them.',
      properties: [], identifiers: ['ISSN'], mapping: null, rules: null,
      agent: 'ISSN harvester', entry: 'proposals',
      instances: [
        { id: 'pi8', name: 'Moravian periodicals', config: 'region=CZ-64 · since=1850 · max=50/run',
          linked: 'Periodicals / Regional', by: 'u2', at: '11 Apr 2026', enabled: true,
          schedule: '', lastRun: '22 Jun 2026' } ] },

    { id: 'pt6', name: 'CatalogValidity', kind: 'Validation', version: '3.1.0',
      description: 'Checks a catalogue record is complete enough to digitize against.',
      properties: [], identifiers: [], mapping: null, agent: null, entry: null,
      rules: [ { code: 'R03', what: 'title well-formed' },
               { code: 'R07', what: 'publication year resolvable' },
               { code: 'R11', what: 'extent matches what was delivered' } ],
      instances: [
        { id: 'pi9', name: 'Default ruleset', config: 'severity=blocking · rules=R03,R07,R11',
          linked: 'all categories', by: 'u3', at: '15 Jan 2026', enabled: true,
          schedule: 'on ingest', lastRun: 'running now' } ] },

    { id: 'pt7', name: 'LanguageCheck', kind: 'Validation', version: '1.0.0',
      description: 'Flags records with no language recorded.',
      properties: [], identifiers: [], mapping: null, agent: null, entry: null,
      rules: [ { code: 'R01', what: 'language recorded' } ],
      instances: [
        { id: 'pi10', name: 'Default', config: 'severity=advisory',
          linked: 'all categories', by: 'u3', at: '2 Jun 2026', enabled: true,
          schedule: 'on ingest', lastRun: '2 min ago' } ] },

    /* INPUT plugins — each one enables a way of entering items in the propose
       dialog, and without one the way is absent. Typed entry, catalog search,
       a pasted list with the type chosen, and a structured file need none. */
    { id: 'pt8', name: 'IdentifierDetector', kind: 'Input', version: '1.2.0', input: 'autodetect',
      description: 'Recognises which identifier each pasted line is — ISBN, ISSN, CNB, barcode, catalog ID.',
      properties: [], identifiers: ['CNBID', 'ISSN', 'ISBN', 'Barcode', 'Catalog ID'],
      mapping: null, agent: null, entry: null, rules: null,
      instances: [
        { id: 'pi11', name: 'Default', config: 'checksums=on · unknown=flag',
          linked: 'all categories', by: 'u3', at: '4 Feb 2026', enabled: true,
          schedule: 'on demand', lastRun: '1 hour ago' } ] },

    { id: 'pt9', name: 'BarcodeReader', kind: 'Input', version: '0.8.1', input: 'barcode',
      description: 'Reads EAN-13 (ISBN), ISSN and library barcodes from the device camera. A hardware scanner needs no plugin — it types like a keyboard.',
      properties: [], identifiers: ['ISBN', 'ISSN', 'Barcode'],
      mapping: null, agent: null, entry: null, rules: null,
      instances: [
        { id: 'pi12', name: 'Camera', config: 'formats=ean13,code128 · beep=on',
          linked: 'all categories', by: 'u3', at: '4 Feb 2026', enabled: true,
          schedule: 'on demand', lastRun: '3 hours ago' } ] },

    { id: 'pt10', name: 'CoverRecognition', kind: 'Input', version: '0.3.0', input: 'photo',
      description: 'Reads a photo of a cover, title page or catalog card — identifiers, and the text itself (title, author, place, year, shelf mark) — and matches it to catalog records.',
      properties: [], identifiers: ['ISBN', 'ISSN', 'CNBID'],
      mapping: null, agent: null, entry: null, rules: null,
      instances: [
        { id: 'pi13', name: 'OCR pilot', config: 'engine=tesseract · lang=ces+deu+lat · match=catalog',
          linked: 'all categories', by: 'u3', at: '10 Sep 2026', enabled: true,
          schedule: 'on demand', lastRun: '2 days ago' } ] },

    /* LIST GENERATORS — a plugin kind of its own, in two classes. With none
       configured there is no Generate button (intentions §4). `?generators=`
       one|none overrides it in the demo, so every state can be seen */
    { id: 'pt11', name: 'PriorityFirst', kind: 'List generator', version: '1.2.0', class: 'rule-based',
      description: 'Fills each category to its share, highest priority first, then the oldest ask. Deterministic.',
      properties: [], identifiers: [], mapping: null, agent: null, entry: null, rules: null,
      instances: [
        { id: 'pi14', name: 'Priority, then age', config: 'tolerance=5% · order=priority,asked',
          linked: 'all categories', by: 'u3', at: '15 Jan 2026', enabled: true,
          schedule: 'on demand', lastRun: '22 Jun 2026' } ] },

    { id: 'pt12', name: 'ShelfAdvisor', kind: 'List generator', version: '0.4.0', class: 'AI-based',
      description: 'A model reads the pool and proposes a list, giving its own reason for every pick. Not deterministic.',
      properties: [], identifiers: [], mapping: null, agent: null, entry: null, rules: null,
      instances: [
        { id: 'pi15', name: 'Pilot', config: 'model=vera-advisor-2 · tolerance=8%',
          linked: 'all categories', by: 'u3', at: '1 Sep 2026', enabled: true,
          schedule: 'on demand', lastRun: '3 days ago' } ] }


    /* DELIVERY CHANNELS — where a hook can send. An implementation provides
       one INTERFACE (email, chat, webhook, file); two mail services are two
       implementations of the same interface, each with its own config
       (decided with the user 2026-09-26). A hook picks an instance. */
    ,{ id: 'pt13', name: 'SmtpMailer', kind: 'Delivery channel', version: '1.1.0', channel: 'email',
      description: 'Sends mail through an SMTP server.', properties: [], identifiers: [], mapping: null, agent: null, entry: null, rules: null,
      instances: [{ id: 'pi16', name: 'MZK SMTP', config: 'host=smtp.mzk.cz · port=587 · from=vera@mzk.cz · tls=starttls',
        linked: 'all categories', by: 'u3', at: '15 Jan 2026', enabled: true, schedule: 'on event', lastRun: '20 min ago' }] },
    { id: 'pt14', name: 'MailgunMailer', kind: 'Delivery channel', version: '0.6.2', channel: 'email',
      description: 'Sends mail through the Mailgun API — for volume the house server should not carry.', properties: [], identifiers: [], mapping: null, agent: null, entry: null, rules: null,
      instances: [{ id: 'pi17', name: 'Mailgun — requesters', config: 'domain=mg.mzk.cz · region=eu · from=noreply@mg.mzk.cz',
        linked: 'all categories', by: 'u3', at: '2 May 2026', enabled: true, schedule: 'on event', lastRun: '20 min ago' }] },
    { id: 'pt15', name: 'SlackNotifier', kind: 'Delivery channel', version: '1.0.3', channel: 'chat',
      description: 'Posts to a Slack channel as a bot.', properties: [], identifiers: [], mapping: null, agent: null, entry: null, rules: null,
      instances: [{ id: 'pi18', name: 'MZK Slack', config: 'workspace=mzk · bot=vera · token=•••',
        linked: 'all categories', by: 'u3', at: '3 Jun 2026', enabled: true, schedule: 'on event', lastRun: '14 Jun 2026' }] },
    { id: 'pt16', name: 'TeamsNotifier', kind: 'Delivery channel', version: '0.9.0', channel: 'chat',
      description: 'Posts to a Microsoft Teams channel through a workflow webhook.', properties: [], identifiers: [], mapping: null, agent: null, entry: null, rules: null,
      instances: [{ id: 'pi19', name: 'MZK Teams', config: 'tenant=mzk.cz · workflow=vera-post',
        linked: 'all categories', by: 'u2', at: '22 Jun 2026', enabled: true, schedule: 'on event', lastRun: '22 Jun 2026' }] },
    { id: 'pt17', name: 'HttpWebhook', kind: 'Delivery channel', version: '2.0.1', channel: 'webhook',
      description: 'POSTs the event as JSON, signed with a shared secret.', properties: [], identifiers: [], mapping: null, agent: null, entry: null, rules: null,
      instances: [{ id: 'pi20', name: 'Webhooks', config: 'timeout=10s · sign=hmac-sha256 · secret=•••',
        linked: 'all categories', by: 'u3', at: '15 Jan 2026', enabled: true, schedule: 'on event', lastRun: '20 Jun 2026' }] },
    { id: 'pt18', name: 'SftpDrop', kind: 'Delivery channel', version: '1.0.0', channel: 'file',
      description: 'Writes a file to an SFTP folder.', properties: [], identifiers: [], mapping: null, agent: null, entry: null, rules: null,
      instances: [{ id: 'pi21', name: 'Scan-ops SFTP', config: 'host=scan-ops · user=vera · key=vera_rsa · format=csv',
        linked: 'all categories', by: 'u2', at: '1 Mar 2026', enabled: true, schedule: 'on event', lastRun: '20 May 2026' }] },

    /* CUSTODY — places proposals into proposal custodies (proposal-custody §3).
       Re-run over every open proposal whenever an instance changes. */
    /* harvesting Kramerius is a harvester of its own — a registry answers,
       it never proposes (view-map §6, decided 2026-09-26) */
    { id: 'pt26', name: 'KrameriusHarvester', kind: 'Harvester', version: '1.0.0',
      description: 'Finds what a Kramerius instance published that VERA does not hold, and adds it.',
      properties: [], identifiers: ['Catalog ID'], mapping: null, agent: 'Kramerius sweep', entry: 'additions', rules: null,
      instances: [{ id: 'pi29', name: 'MZK Kramerius sweep', config: 'base_url=kramerius.mzk.cz · since=last run · max=200/run',
        linked: 'all categories', by: 'u3', at: '15 Jan 2026', enabled: true, schedule: 'nightly 02:00', lastRun: '02:00 today' }] },
    /* the only kind that can say never — a restriction takes an admin to
       lift (plugins.md §4.6, decided 2026-10-02) */
    { id: 'pt25', name: 'CopyrightRule', kind: 'Restriction', version: '1.0.0',
      description: 'Forbids what is still in copyright: the last known author or editor died less than 70 years ago.',
      properties: [], identifiers: [], mapping: null, agent: null, entry: null,
      rules: [{ code: 'C70', what: 'author or editor died less than 70 years ago' },
              { code: 'C-UNK', what: 'no death date and published after 1900' }],
      instances: [{ id: 'pi28', name: 'Czech copyright', config: 'years=70 · unknown_after=1900 · authority=NKC',
        linked: 'all categories', by: 'u3', at: '10 Jun 2026', enabled: true, schedule: 'on proposal, on ingest', lastRun: '21 Jun 2026' }] },
    { id: 'pt19', name: 'JqCustody', kind: 'Custody', version: '1.0.0',
      description: 'Evaluates one jq expression over the proposal as JSON; it returns the names of the custodies it belongs in.',
      properties: [], identifiers: [], mapping: null, agent: null, entry: null, rules: null,
      instances: [{ id: 'pi25', name: 'House rules', config: 'expr=[ if .document.type == "Periodical" then "Periodicals" else empty end, if (.record.fields."260".c // "" | test("^18")) then "19th-century prints" else empty end, if .request.project == "Moravica" then "Moravica" else empty end ]',
        names: ['Periodicals', '19th-century prints', 'Moravica'],
        linked: 'all categories', by: 'u3', at: '23 Jun 2026', enabled: true, schedule: 'on proposal', lastRun: '20 min ago' }] },

    /* IDENTITY — ways to log in, several at once (identity.md). `order` is the
       login page; `userId` the claim each returns, fixed once users exist. */
    { id: 'pt20', name: 'OidcIdentity', kind: 'Identity', version: '2.1.0',
      description: 'Logs in through an OpenID Connect provider — Keycloak, or any other.',
      properties: [], identifiers: [], mapping: null, agent: null, entry: null, rules: null,
      instances: [{ id: 'pi22', name: 'MZK Keycloak', label: 'Log in with MZK account', order: 1, userId: 'preferred_username',
        defaultRole: null, matchEmail: false,
        maps: [['group mzk-staff', 'staff'], ['group mzk-curators', 'curator'], ['group mzk-digitization', 'dig-curator']],
        config: 'issuer=sso.mzk.cz/realms/mzk · client=vera',
        linked: 'all categories', by: 'u3', at: '15 Jan 2026', enabled: true, schedule: 'on login', lastRun: '4 min ago' }] },
    { id: 'pt21', name: 'SamlIdentity', kind: 'Identity', version: '1.3.0',
      description: 'Logs in through a SAML federation.',
      properties: [], identifiers: [], mapping: null, agent: null, entry: null, rules: null,
      instances: [{ id: 'pi23', name: 'eduID.cz', label: 'Log in with eduID', order: 2, userId: 'eduPersonPrincipalName',
        defaultRole: 'reader', matchEmail: true, maps: [],
        config: 'metadata=eduid.cz/metadata · sp=vera.mzk.cz',
        linked: 'all categories', by: 'u3', at: '2 Feb 2026', enabled: true, schedule: 'on login', lastRun: '18 Jun 2026' }] },
    { id: 'pt22', name: 'LocalAccounts', kind: 'Identity', version: '1.0.0',
      description: 'Usernames and passwords kept by VERA — for people with no institutional account.',
      properties: [], identifiers: [], mapping: null, agent: null, entry: null, rules: null,
      instances: [{ id: 'pi24', name: 'Local accounts', label: 'Log in with a VERA account', order: 3, userId: 'username',
        defaultRole: null, matchEmail: false, maps: [],
        config: 'signup=off · password_min=12',
        linked: 'all categories', by: 'u3', at: '15 Jan 2026', enabled: true, schedule: 'on login', lastRun: 'today 08:40' }] },

    /* MESSAGE — Message… hands off to these (messaging.md); a redirect,
       pre-filled, sent by the person in their own tool. VERA keeps no text. */
    { id: 'pt23', name: 'MailtoMessage', kind: 'Message', version: '1.0.0',
      description: 'Opens the person\'s mail client with the recipients, subject and a link back filled in.',
      properties: [], identifiers: [], mapping: null, agent: null, entry: null, rules: null,
      instances: [{ id: 'pi26', name: 'Email', order: 1, result: 'redirect', config: 'cc_sender=off',
        linked: 'all categories', by: 'u3', at: '24 Jun 2026', enabled: true, schedule: 'on demand', lastRun: 'never' }] },
    { id: 'pt24', name: 'SlackMessage', kind: 'Message', version: '0.5.0',
      description: 'Opens a Slack DM, or a group DM, with the recipients — a deep link with the text pre-filled.',
      properties: [], identifiers: [], mapping: null, agent: null, entry: null, rules: null,
      instances: [{ id: 'pi27', name: 'MZK Slack', order: 2, result: 'redirect', config: 'workspace=mzk · handle=claim slack_id',
        linked: 'all categories', by: 'u3', at: '24 Jun 2026', enabled: true, schedule: 'on demand', lastRun: 'never' }] }
  ];
  /* the list generators the editor can offer — every running instance */
  const generators = () => {
    const o = (location.search.match(/[?&]generators=(one|none)/) || [])[1];
    const all = pluginTypes.filter(t => t.kind === 'List generator')
      .flatMap(t => t.instances.filter(i => i.enabled).map(i => Object.assign({ type: t }, i)));
    return o === 'none' ? [] : o === 'one' ? all.slice(0, 1) : all;
  };
  /* the catalogs the propose dialog can reach — every running adapter */
  const catalogs = () => pluginTypes.filter(t => t.kind === 'Catalog adapter')
    .flatMap(t => t.instances.filter(i => i.enabled));

  /* which input ways a running plugin enables — `?inputs=all|none` overrides
     it in the demo, so both states can be seen */
  const inputOn = (way) => {
    const o = (location.search.match(/[?&]inputs=(all|none)/) || [])[1];
    if (o) return o === 'all';
    return pluginTypes.some(t => t.input === way && t.instances.some(i => i.enabled));
  };

  /* Deployment settings. The limit binds anybody who proposes WITHOUT
     request.decide — a curator adding a shelf of items is doing their job;
     anybody else adding 400 at once is a queue somebody else must empty. */
  const settings = { proposeMaxAtOnce: 10 };
  const pluginInstances = pluginTypes.flatMap(t =>
    t.instances.map(i => Object.assign({ type: t }, i)));
  const KIND_TONE = { 'Catalog adapter': 'blue', Registry: 'purple',
                      'Property source': 'green', Harvester: 'amber', Validation: 'slate', Restriction: 'red',
                      Input: 'blue', 'List generator': 'purple', 'Delivery channel': 'green',
                      Custody: 'amber', Identity: 'blue', Message: 'green' };

  /* -------------------------------------------------------------- tasks */
  /* A task is ONE RUN of a plugin instance (or of a core job — an intention
     repeat making its next occurrence). What started it is the trigger:
       schedule — a row of `schedules`, which only Tasks › Schedule edits
       manual   — a person, from the page they did it on
       repeat   — an intention repeat (core, edited on Intentions)
     `by` is who the run belongs to: task.read_own shows exactly these.
     Runs are never deleted by hand — they expire under `taskRetention`,
     because history is the audit of what changed the data.               */

  const now = '2026-06-25T10:40';
  const taskRetention = { days: 90, failedDays: 365 };

  const tasks = [
    { id: 'T-9916', instance: 'pi4', what: 'Kramerius — registry refresh',
      trigger: { kind: 'schedule', schedule: 's2' }, by: 'sys',
      state: 'running', started: '2026-06-25T10:38', total: 1204, done: 88, errors: [], eta: 'about 4 min' },
    { id: 'T-9915', instance: 'pi9', what: 'Re-check — 12 documents in Periodicals',
      trigger: { kind: 'manual', from: 'Documents', href: 'documents.html?category=c2' }, by: 'u1',
      state: 'running', started: '2026-06-25T10:37', total: 12, done: 7, eta: 'under a minute',
      errors: [{ ref: 'IT18', msg: 'R07 — publication year not resolvable (260$c “190-?”)' }] },
    { id: 'T-9914', instance: 'pi4', what: 'Kramerius — registry refresh',
      trigger: { kind: 'schedule', schedule: 's2' }, by: 'sys',
      state: 'skipped', started: '2026-06-25T10:08', total: 0, done: 0, errors: [],
      note: 'The 09:38 run was still going — this schedule skips an overlapping run.' },
    { id: 'T-9912', instance: 'pi1', what: 'MZK Aleph — catalog resync',
      trigger: { kind: 'schedule', schedule: 's1' }, by: 'sys',
      state: 'done', started: '2026-06-25T10:30', finished: '2026-06-25T10:30:38', total: 214, done: 214, errors: [],
      changed: [{ text: '3 page counts, 1 title', href: 'documents.html' }] },
    { id: 'T-9909', instance: 'pi5', what: 'RDCZ — registry refresh',
      trigger: { kind: 'schedule', schedule: 's3' }, by: 'sys',
      state: 'done', started: '2026-06-25T06:00', finished: '2026-06-25T06:04:12', total: 1204, done: 1204, errors: [],
      changed: [{ text: '1 state — Moravská orlice → Revision', href: 'documents.html?category=c21' }] },
    { id: 'T-9905', instance: 'pi9', what: 'Catalog validity — nightly sweep',
      trigger: { kind: 'schedule', schedule: 's4' }, by: 'sys',
      state: 'done', started: '2026-06-25T02:00', finished: '2026-06-25T02:21:40', total: 1204, done: 1204,
      errors: [{ ref: 'IT10', msg: 'R03 — unbalanced bracket in 245$a' },
               { ref: 'IT13', msg: 'R07 — publication years not resolvable (260$c “190u-191u”)' },
               { ref: 'IT12', msg: 'R11 — extent 16 ff., 18 images delivered' }],
      changed: [{ text: '3 documents newly failing a rule', href: 'validation.html?defect=CatalogValidity' }] },
    { id: 'T-9901', instance: 'pi14', what: 'Generate list — Regional catch-up, 4 000 pp',
      trigger: { kind: 'manual', from: 'Digitization Lists', href: 'lists.html' }, by: 'u2',
      state: 'done', started: '2026-06-22T14:05', finished: '2026-06-22T14:05:09', total: 186, done: 186, errors: [],
      changed: [{ text: 'Draft list Regional weeklies', href: 'lists.html?list=L-2026-015' }] },
    { id: 'T-9890', instance: 'pi8', what: 'ISSN harvest — weekly',
      trigger: { kind: 'schedule', schedule: 's5' }, by: 'sys',
      state: 'done', started: '2026-06-22T06:00', finished: '2026-06-22T06:03:51', total: 50, done: 50, errors: [],
      changed: [{ text: '2 proposals raised', href: 'proposals.html' }] },
    { id: 'T-9884', instance: 'pi4', what: 'Kramerius — full re-harvest',
      trigger: { kind: 'manual', from: 'Plugins', href: 'plugins.html' }, by: 'u3',
      state: 'cancelled', started: '2026-06-20T15:00', finished: '2026-06-20T15:01:05', total: 1204, done: 112, errors: [],
      cancelledBy: 'u3', note: 'Stopped after 112 of 1 204 — what it had already read stays.' },
    { id: 'T-9897', instance: 'pi1', what: 'Ingest batch B-0138 — 1 item',
      trigger: { kind: 'approval', from: 'Proposals', href: 'proposals.html' }, by: 'u1',
      state: 'failed', started: '2026-06-14T10:31', finished: '2026-06-14T10:33:02', total: 1, done: 0, errors: [],
      fatal: 'Catalog adapter returned HTTP 502 after 3 attempts.' },
    { id: 'T-9850', instance: null, core: 'Intention repeat', what: 'Monthly output — made June 2026',
      trigger: { kind: 'repeat', template: 't1' }, by: 'sys',
      state: 'done', started: '2026-06-01T00:00', finished: '2026-06-01T00:00:01', total: 1, done: 1, errors: [],
      changed: [{ text: 'Made Monthly output — June 2026', href: 'intentions.html?i=i6' },
                { text: 'Archived May 2026', href: 'intentions.html?i=i10' }] }
  ];

  /* Schedules — WHEN a plugin instance runs by itself. Edited only on
     Tasks › Schedule (decided with the user 2026-09-26); the instance shows
     them and links there. `overlap`: what a run does when the previous one
     is still going — skip it, or wait and run after. */
  const schedules = [
    { id: 's1', instance: 'pi1', what: 'MZK Aleph — catalog resync',   cadence: { every: 'min', n: 15 },  overlap: 'skip', enabled: true, by: 'u3', since: '15 Jan 2026' },
    { id: 's6', instance: 'pi2', what: 'NKP Aleph — catalog resync',   cadence: { every: 'min', n: 15 },  overlap: 'skip', enabled: true, by: 'u3', since: '15 Jan 2026' },
    { id: 's7', instance: 'pi3', what: 'VKOL Aleph — catalog resync',  cadence: { every: 'min', n: 15 },  overlap: 'skip', enabled: false, by: 'u3', since: '20 Feb 2026',
      paused: { by: 'u3', at: '18 Jun 2026', why: 'VKOL is migrating its catalog until 1 July.' } },
    { id: 's2', instance: 'pi4', what: 'Kramerius — registry refresh', cadence: { every: 'min', n: 30 },  overlap: 'skip', enabled: true, by: 'u3', since: '15 Jan 2026' },
    { id: 's3', instance: 'pi5', what: 'RDCZ — registry refresh',      cadence: { every: 'hour', n: 6 },  overlap: 'skip', enabled: true, by: 'u3', since: '15 Jan 2026' },
    { id: 's4', instance: 'pi9', what: 'Catalog validity — nightly sweep', cadence: { every: 'day', at: '02:00' }, overlap: 'queue', enabled: true, by: 'u3', since: '15 Jan 2026' },
    { id: 's5', instance: 'pi8', what: 'ISSN harvest — weekly',        cadence: { every: 'week', day: 1, at: '06:00' }, overlap: 'skip', enabled: true, by: 'u2', since: '11 Apr 2026' }
  ];
  /* which plugin kinds can run by themselves — an input or a list generator
     only runs when somebody is using it */
  const SCHEDULABLE = ['Catalog adapter', 'Registry', 'Validation', 'Harvester'];

  /* -------------------------------------------------------------- hooks */
  /* A hook sends something OUT when an event happens (decided with the user
     2026-09-26): an email, a chat message, a webhook call, a file. Reacting
     inside VERA — stamping a page count on ingest — is a plugin trigger,
     not a hook, so it is configured once, on Plugins.

     Events are what VERA records (status-log §3), grouped by what they are
     about, plus task runs. Derived conditions — behind pace, out of band —
     are not events: nothing happened, a number moved. A watchlist is the
     tool for those. */
  const HOOK_EVENTS = [
    ['Requests', 'someone asked for a document, or a decision was made on it', [
      ['request.created', 'a proposal is raised', 'R28 · Moravská orlice 1872'],
      ['request.decided', 'approved, approved as a rescan, denied, withdrawn or marked duplicate', 'R21 · declined'],
      ['request.held', 'a proposal is held because a copy already exists', 'R20 · Kramerius: published']]],
    ['Documents', 'one digitization attempt, from ingest to publication', [
      ['iteration.ingested', 'the catalog record arrived', 'IT16 · Brněnské noviny 1921'],
      ['iteration.ingest_failed', 'ingest gave up', 'IT7 · HTTP 502'],
      ['iteration.validated', 'a validation verdict: approved, denied, revoked', 'IT3 · approved'],
      ['iteration.restricted', 'a restriction is set or overruled', 'IT6 · restricted: conservation hold'],
      ['iteration.cancelled', 'work is stopped, or resumed', 'IT9 · cancelled'],
      ['iteration.listed', 'put on a list, or taken off one', 'IT24 · on L-2026-015'],
      ['iteration.digitized', 'scanning delivered it', 'IT12 · 18 pp'],
      ['iteration.published', 'it is public in Kramerius', 'IT1 · uuid:4a7c…'],
      ['iteration.classified', 'category, priority or project changed', 'IT3 · priority → Urgent']]],
    ['Records', 'the catalog record and what is known about it', [
      ['document.relinked', 'pointed at another catalog record', 'D35 · MZK01-001502233'],
      ['document.property_changed', 'a property value changed — page count, title…', 'D3 · page count 1098 → 1120'],
      ['document.registry_changed', 'a registry reports a new state', 'D3 · RDCZ: Revision']]],
    ['Lists', 'digitization lists', [
      ['list.created', 'a list is made', 'L-2026-015 · Regional weeklies'],
      ['list.dates_changed', 'its start or end moved', 'L-2026-014 · starts 6 Jul'],
      ['list.deleted', 'a list is deleted and its members go back to the pool', 'L-2026-009']]],
    ['Tasks', 'plugin runs', [
      ['task.failed', 'a run failed', 'T-9897 · Ingest batch B-0138'],
      ['task.finished', 'a run finished — with or without errors', 'T-9905 · 3 errors']]]
  ];
  const hookEvent = (k) => { for (const [g, , es] of HOOK_EVENTS) { const e = es.find(x => x[0] === k); if (e) return { key: k, group: g, what: e[1], sample: e[2] }; } return null; };
  /* the interfaces a delivery channel can implement — what a hook fills in
     depends on the interface, not on which service is behind it */
  const HOOK_TARGETS = {
    email:   { label: 'Email',   to: 'addresses' },
    chat:    { label: 'Chat',    to: 'channel' },
    webhook: { label: 'Webhook', to: 'URL' },
    file:    { label: 'File',    to: 'folder' }
  };

  const hooks = [
    { id: 'H-01', name: 'Notify Kramerius on publish', event: 'iteration.published',
      target: { channel: 'pi20', to: 'https://kramerius.mzk.cz/api/notify' },
      filter: 'category under Periodicals', state: 'active', retry: { attempts: 5, backoff: 'exponential' }, by: 'u3', since: '15 Jan 2026' },
    { id: 'H-02', name: 'Email the requester', event: 'request.decided',
      target: { channel: 'pi17', to: 'the requester' }, message: 'Your request for {title} was {decision}. {public_text}',
      filter: 'decision is Approved or Denied', state: 'active', retry: { attempts: 3, backoff: 'fixed' }, by: 'u3', since: '15 Jan 2026',
      /* a curator deciding a shelf sends one mail per requester, not forty:
         wait 15 min after each decision for more, never longer than an hour */
      batch: { wait: 15, max: 60, by: 'recipient' },
      pending: [{ to: 'lucie.benesova@gmail.com', items: ['R21 · Herbář moravský — declined', 'R23 · Selské noviny 1907–1911 — approved'],
                  first: '2026-06-25T10:20', sendsAt: '2026-06-25T10:50' },
                { to: 'tomas.marek@muni.cz', items: ['R10 · Dějiny Velehradu — approved'], first: '2026-06-25T10:35', sendsAt: '2026-06-25T10:50' }] },
    { id: 'H-03', name: 'Ops channel on ingest failure', event: 'iteration.ingest_failed',
      target: { channel: 'pi20', to: 'https://ops.internal/hooks/vera' },
      filter: '', state: 'active', retry: { attempts: 5, backoff: 'exponential' }, by: 'u3', since: '2 Feb 2026' },
    { id: 'H-06', name: 'Failed runs to #digitalizace', event: 'task.failed',
      target: { channel: 'pi18', to: '#digitalizace' }, message: ':warning: {task} failed — {error} {link}',
      filter: '', state: 'active', retry: { attempts: 3, backoff: 'exponential' }, by: 'u3', since: '3 Jun 2026' },
    { id: 'H-07', name: 'New list to the Digitization Office', event: 'list.created',
      target: { channel: 'pi19', to: 'Digitization Office › Lists' }, message: 'New list {list} — {pages} pp, starts {starts}. {link}',
      filter: '', state: 'active', retry: { attempts: 3, backoff: 'fixed' }, by: 'u2', since: '22 Jun 2026',
      batch: { wait: 60, max: 240, by: 'all' }, pending: [] },
    { id: 'H-04', name: 'Export a new list for scanning', event: 'list.created',
      target: { channel: 'pi21', to: '/incoming' },
      filter: '', state: 'paused', retry: { attempts: 5, backoff: 'exponential' }, by: 'u2', since: '1 Mar 2026',
      paused: { by: 'u2', at: '1 Jun 2026', why: 'Scan-ops moved to a new server; waiting for the address.' } }
  ];
  /* deliveries — one per event per hook, and the retries of it */
  const executions = [
    { id: 'X-4474', hook: 'H-06', at: '2026-06-14T10:33', result: 'ok', ms: 180, subject: 'T-9897', detail: 'posted to #digitalizace' },
    { id: 'X-4473', hook: 'H-07', at: '2026-06-22T14:05', result: 'ok', ms: 240, subject: 'L-2026-015', detail: 'posted to Lists' },
    { id: 'X-4471', hook: 'H-02', at: '2026-06-25T10:20', result: 'ok', ms: 88, subject: 'R21', detail: 'declined → lucie.benesova@…' },
    { id: 'X-4469', hook: 'H-02', at: '2026-06-25T09:40', result: 'ok', ms: 91, subject: 'R10', detail: 'approved → tomas.marek@…' },
    { id: 'X-4466', hook: 'H-02', at: '2026-06-24T16:02', result: 'retried', ms: 2100, subject: 'R27', detail: 'SMTP 451 greylisted — delivered on attempt 2' },
    { id: 'X-4450', hook: 'H-02', at: '2026-06-22T15:25', result: 'ok', ms: 95, subject: 'R26', detail: 'approved as rescan → ondrej.krejci@…' },
    { id: 'X-4402', hook: 'H-03', at: '2026-06-14T10:33', result: 'failed', ms: 0, subject: 'IT7', detail: 'connect ETIMEDOUT ops.internal:443 — gave up after 5' },
    { id: 'X-4399', hook: 'H-01', at: '2026-04-02T08:13', result: 'ok', ms: 238, subject: 'IT1', detail: 'published → uuid:4a7c…' },
    { id: 'X-4380', hook: 'H-03', at: '2026-06-19T08:41', result: 'failed', ms: 0, subject: 'IT17', detail: '503 Service Unavailable — gave up after 5' },
    { id: 'X-4371', hook: 'H-03', at: '2026-05-28T12:40', result: 'ok', ms: 140, subject: '—', detail: 'test delivery — Send a test' },
    { id: 'X-4300', hook: 'H-04', at: '2026-05-20T09:00', result: 'ok', ms: 1200, subject: 'L-2026-012', detail: 'L-2026-012.csv written' }
  ];
  /* deliveries that gave up after their hook's last retry — kept until
     somebody retries or discards them */
  const deadLetters = [
    { id: 'DL-14', hook: 'H-03', at: '2026-06-14T10:33', subject: 'IT7', error: 'connect ETIMEDOUT ops.internal:443',
      attempts: 5, payload: '{ "event": "iteration.ingest_failed", "iteration": "IT7", "error": "HTTP 502" }' },
    { id: 'DL-13', hook: 'H-03', at: '2026-06-19T08:41', subject: 'IT17', error: '503 Service Unavailable',
      attempts: 5, payload: '{ "event": "iteration.ingest_failed", "iteration": "IT17", "error": "no 245 field" }' }
  ];
  const hookRetention = { days: 30 };

  /* --------------------------------------------------------- status log */
  /* Causes, never derivations. One log across entities; correlation_id
     groups the rows one action wrote.                                     */

  const log = [
    { subject: 'IT3', at: '20 Jun 2026 14:02', actor: 'u1', corr: 'k1',
      event: 'Validation approved', detail: 'PageCount R02 — accepted, 22-page difference is not material.' },
    { subject: 'IT3', at: '19 Jun 2026 09:14', actor: 'u4', corr: 'k2',
      event: 'Page count set manually', detail: 'catalog 1098 → manual 1120' },
    { subject: 'IT3', at: '17 Jun 2026 16:40', actor: 'u1', corr: 'k3',
      event: 'Approved — 3 requests', detail: 'Category Periodicals / Regional, priority Urgent.' },
    { subject: 'IT14', at: '21 Jun 2026 06:04', actor: 'sys', corr: 'k15',
      event: 'Forbidden by Copyright', detail: 'CopyrightRule: editor-in-chief died 1961, protected until 2031.' },
    { subject: 'IT8', at: '19 Jun 2026 11:20', actor: 'u1', corr: 'k4',
      event: 'Approved as rescan', detail: 'Over VERA 2019 and Kramerius: published. 300 dpi greyscale is not enough for the regional project.' },
    { subject: 'IT0', at: '14 Nov 2019 09:30', actor: 'sys', corr: 'k0',
      event: 'Published', detail: 'Kramerius uuid:demo8' },
    { subject: 'R20', at: '23 Jun 2026 06:02', actor: 'sys', corr: 'k11',
      event: 'Held: a copy exists', detail: 'Approval was requested on arrival; Kramerius already has it.' },
    { subject: 'R20', at: '23 Jun 2026 06:00', actor: 'a1', corr: 'k11',
      event: 'Proposed, approval requested', detail: '' },
    { subject: 'IT17', at: '19 Jun 2026 08:41', actor: 'sys', corr: 'k12',
      event: 'Ingest failed', detail: 'Catalog record has no 245 field.' },
    { subject: 'IT16', at: '22 Jun 2026 15:10', actor: 'u1', corr: 'k13',
      event: 'Approved as rescan', detail: 'Over Kramerius: published. Existing scan is 150 dpi.' },
    { subject: 'IT15', at: '24 Jun 2026 07:00', actor: 'sys', corr: 'k14',
      event: 'Copy found after approval', detail: 'Kramerius: published.' },
    { subject: 'IT9', at: '21 Jun 2026 08:55', actor: 'u2', corr: 'k5',
      event: 'Cancelled', detail: 'Large-format scanner unavailable until Q4.' },
    { subject: 'IT9', at: '20 Jun 2026 17:02', actor: 'u2', corr: 'k6',
      event: 'Removed from list L-2026-014', detail: '' },
    { subject: 'IT7', at: '14 Jun 2026 10:31', actor: 'sys', corr: 'k7',
      event: 'Ingest failed', detail: 'Catalog adapter returned HTTP 502 after 3 attempts.' },
    { subject: 'IT11', at: '20 Jun 2026 13:44', actor: 'u1', corr: 'k8',
      event: 'Validation denied', detail: 'PageCount R01 — cannot plan capacity without a page count.' },
    { subject: 'IT12', at: '12 Jun 2026 09:00', actor: 'sys', corr: 'k9',
      event: 'Digitized', detail: '18 images delivered.' },
    { subject: 'IT18', at: '24 Jun 2026 06:15', actor: 'sys', corr: 'k15',
      event: 'Checks re-run — catalog record changed', detail: 'New: CatalogValidity R07 on 260$c. PageCount R03 found again, still accepted.' },
    { subject: 'IT18', at: '18 Jun 2026 10:20', actor: 'u1', corr: 'k16',
      event: 'Validation approved', detail: 'PageCount R03 — an estimate is enough to plan a regional run.' },
    { subject: 'IT19', at: '23 Jun 2026 09:02', actor: 'sys', corr: 'k17',
      event: 'Added — no catalog record', detail: 'Approved on arrival from the ISSN harvester.' },
    /* lists — causes only: created, generated, members moved, dates moved.
       Never "Ready → Planned"; that is derived from the date */
    { subject: 'L-2026-015', at: '22 Jun 2026 14:05', actor: 'u2', corr: 'k20',
      event: 'Created', detail: '5 → 23 Oct · shaped by Regional catch-up' },
    { subject: 'L-2026-015', at: '22 Jun 2026 14:05', actor: 'u2', corr: 'k20',
      event: 'Generated — PriorityFirst 1.2.0', detail: 'pages 4 000 · Periodicals only · 3 picked · 1 460 pp short: the rest of Periodicals was still in review' },
    { subject: 'L-2026-014', at: '15 Jun 2026 09:30', actor: 'u2', corr: 'k21',
      event: 'Created', detail: '22 Jun → 10 Jul · built by hand' },
    { subject: 'L-2026-014', at: '15 Jun 2026 09:30', actor: 'u2', corr: 'k21',
      event: 'Added 5 by hand', detail: '' },
    { subject: 'L-2026-014', at: '20 Jun 2026 17:02', actor: 'u2', corr: 'k6',
      event: 'Removed 1', detail: 'Mapa Moravy 1846 — large-format scanner unavailable until Q4' },
    { subject: 'L-2026-016', at: '24 Jun 2026 15:40', actor: 'u2', corr: 'k22',
      event: 'Created', detail: '2 → 20 Nov · built by hand · empty' },
    { subject: 'L-2026-012', at: '20 May 2026 10:00', actor: 'u2', corr: 'k23',
      event: 'Created', detail: '1 → 19 Jun · built by hand' },
    { subject: 'L-2026-012', at: '20 May 2026 10:00', actor: 'u2', corr: 'k23',
      event: 'Added 3 by hand', detail: '' },
    /* projects — causes only; the state (Upcoming, Active, Ended) is the date */
    { subject: 'p1', at: '12 Jun 2025 10:15', actor: 'u2', corr: 'k30',
      event: 'Created', detail: '1 Jul 2025 → 30 Jun 2027 · 6 000 pp' },
    { subject: 'p1', at: '30 Jun 2025 09:00', actor: 'u2', corr: 'k31',
      event: 'Member added', detail: 'Jana Nováková' },
    { subject: 'p1', at: '10 Jun 2026 08:00', actor: 'u2', corr: 'k32',
      event: 'Intention attached', detail: 'NDK Periodika — 2026 Q3' },
    { subject: 'p2', at: '4 Dec 2025 13:40', actor: 'u2', corr: 'k33',
      event: 'Created', detail: '1 Jan → 31 Dec 2026 · 3 000 pp' },
    { subject: 'p3', at: '20 Nov 2023 11:00', actor: 'u2', corr: 'k34',
      event: 'Created', detail: '1 Jan 2024 → 31 Dec 2025 · 1 200 pp' },
    { subject: 'p3', at: '8 Dec 2025 09:30', actor: 'u2', corr: 'k35',
      event: 'Period extended', detail: 'ends 31 Dec 2025 → 31 Dec 2026 — the provider granted a closing year' },
    { subject: 'p4', at: '18 Jun 2026 14:20', actor: 'u2', corr: 'k36',
      event: 'Created', detail: '1 Sep 2026 → 31 Aug 2028 · 2 000 pp · no intention yet' },
    { subject: 'p5', at: '2 Dec 2024 10:00', actor: 'u2', corr: 'k37',
      event: 'Created', detail: '1 Jan → 31 Dec 2025 · 2 500 pp' },
    { subject: 'p6', at: '14 Feb 2024 09:10', actor: 'u2', corr: 'k38',
      event: 'Created', detail: '1 Mar 2024 → 30 Jun 2025 · 1 200 pp' },
    { subject: 'p7', at: '10 Dec 2021 15:30', actor: 'u3', corr: 'k39',
      event: 'Created', detail: '1 Jan 2022 → 31 Dec 2024 · 900 pp' },
    { subject: 'IT1', at: '2 Apr 2026 08:12', actor: 'sys', corr: 'k10',
      event: 'Published', detail: 'Kramerius uuid:demo' }
  ];
  /* --------------------------------------------------- intention counting */
  /* One place for the rules, because Intentions, Lists and Projects must
     agree. PLANNED: a matching item on a list whose START falls in the
     window. DELIVERED: those of them digitized inside the window — plan
     completion, a part of planned. OUTPUT: everything matching digitized in
     the window, whenever it was planned — what the mix is measured on. One
     item counts towards every intention it matches; figures across
     intentions overlap and are never added. */
  const DAYMS = 864e5;
  const ms = (s) => Date.parse(s) || 0;
  const winFrom = (i) => ms(i.starts);
  const winTo = (i) => i.ends ? ms(i.ends) + DAYMS : Infinity;
  const inWindow = (i, t) => t != null && t >= winFrom(i) && t < winTo(i);
  const under = (catId, top) => { let c = cat(catId); while (c) { if (c.id === top) return true; c = c.parent ? cat(c.parent) : null; } return false; };
  const pagesOfIt = (it) => { const p = effectivePages(doc(it.doc)); return p ? p.value : 0; };
  const isDone = (it) => VERA.atLeast(it.progress, 'Digitized');
  /* when it was digitized: recorded, or the day its list ended */
  const doneAt = (it) => !isDone(it) ? null
    : it.digitizedAt ? Date.parse('1 ' + it.digitizedAt)
    : it.list ? ms(listOf(it.list).ends) : null;
  const inScope = (i, it) => !!it.category
    && (i.funding == null || (i.funding === 'none' ? !it.project : it.project === i.funding))
    && (!i.scope || under(it.category, i.scope));
  const plannedIn = (i) => iterations.filter(it => it.list && inScope(i, it)
    && inWindow(i, ms(listOf(it.list).starts)) && (!it.cancellation || isDone(it)));
  function intentionCount(i) {
    const p = plannedIn(i), d = p.filter(it => inWindow(i, doneAt(it)));
    const out = iterations.filter(it => isDone(it) && inScope(i, it) && inWindow(i, doneAt(it)));
    const noDate = iterations.filter(it => isDone(it) && inScope(i, it) && doneAt(it) == null);
    const sumP = (its) => its.reduce((a, it) => a + pagesOfIt(it), 0);
    return { planned: p, delivered: d, output: out, noDate,
             plannedPages: sumP(p), deliveredPages: sumP(d), outputPages: sumP(out) };
  }
  /* what one list counts towards, and how much of it — part of a list can
     qualify, so it is pages per intention, never a row of names */
  function countsTowards(l, members, starts) {
    const t = ms(starts || l.starts);
    return intentions.filter(i => !i.archived && inWindow(i, t)).map(i => {
      const its = members.filter(it => inScope(i, it));
      return { i, pages: its.reduce((a, it) => a + pagesOfIt(it), 0), n: its.length };
    }).filter(x => x.n);
  }
  /* a share read inside an intention's scope: the scope node is 100%, its
     children split it recursively — a change of reference frame, not a
     rescale. null where something on the way down has no share. */
  function shareWithin(i, catId) {
    const d = distributions.find(x => x.id === i.distribution);
    let pct = 1, c = cat(catId);
    while (c && c.id !== i.scope) {
      const s = d.shares[c.id];
      if (s == null) return null;
      pct *= s / 100;
      c = c.parent ? cat(c.parent) : null;
    }
    return pct * 100;
  }

  /* whose mix an intention reads, and who reads its own */
  const mixOwner = (i) => { const d = distributions.find(x => x.id === i.distribution);
    return intentions.find(x => x.id === d.owner) || i; };
  const trackersOf = (i) => mixOwner(i) === i ? intentions.filter(x => x !== i && x.distribution === i.distribution) : [];
  const mixText = (i) => mixOwner(i) === i ? 'own mix' : `tracks ${mixOwner(i).name}`;

  const logFor = (subject) => log.filter(e => e.subject === subject);

  return {
    users, byId, groups, proposalCustodies, custodiesOf, categories, cat, isLeaf, pathOf, childrenOf,
    distributions, effectiveShare, unallocated, mixOwner, trackersOf, mixText,
    projects, proj, intentions, intentionTemplates, lists, listOf, today, generators,
    intentionCount, countsTowards, shareWithin, inScope, doneAt, under,
    documents, doc, effectivePages,
    iterations, iter, iterOfDoc, iterationsOfDoc, requests, batches, batchOf, log, logFor,
    pluginTypes, pluginInstances, inputOn, settings, catalogs, KIND_TONE, PERMISSIONS, permission, roles, categoryMembers, tasks, schedules, SCHEDULABLE, now, taskRetention, hooks, executions, deadLetters, hookRetention, HOOK_EVENTS, hookEvent, HOOK_TARGETS
  };
})();
