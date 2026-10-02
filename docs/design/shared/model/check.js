/* Checks the workflow model (workflows.js) against itself, the roles and
   permissions in the demo data, the sidebar, and the demo page scripts.

     node docs/design/shared/model/check.js          from the repository
     → prints the report, writes report.js beside this file for model.html,
       exits 1 when anything fails

   Every finding is { check, level, machine, item, text }: level `fail` is a
   break in the design, `warn` something to look at. */

const fs = require('fs'), path = require('path');
const HERE = __dirname, DEMOS = path.join(HERE, '../../../demos/shared');

global.window = {};
require(path.join(DEMOS, 'vera-model.js'));
require(path.join(DEMOS, 'vera-data.js'));
require(path.join(DEMOS, 'vera-ui.js'));
const D = window.VERA_DATA, U = window.VERA_UI;
const { machines, SCRIPTS } = require(path.join(HERE, 'workflows.js'));
const SRC = Object.fromEntries([...new Set(Object.values(SCRIPTS))].map(f =>
  [f, fs.readFileSync(path.join(DEMOS, f), 'utf8')]));

const out = [];
const add = (check, level, machine, item, text) => out.push({ check, level, machine, item, text });

/* ------------------------------------------------------------ lookups */
const PERM = new Map(D.PERMISSIONS.flatMap(([, ps]) => ps.map(p => [p[0], p[1]])));
const NAV = new Map(U.NAV.map(n => [n.id, n]));
const HOOKS = new Set(D.HOOK_EVENTS.flatMap(([, , es]) => es.map(e => e[0])));
const KINDS = new Map();
D.pluginTypes.forEach(t => { const k = KINDS.get(t.kind) || { types: 0, enabled: 0 };
  k.types++; k.enabled += t.instances.filter(i => i.enabled).length; KINDS.set(t.kind, k); });
/* a scope covers another when it is the same, or `any` */
const covers = (held, want) => held === want || held === 'any' || (want == null && held == null);
const holders = (key, scope) => D.roles.filter(r => r.grants.some(([k, s]) => k === key && covers(s, scope)));
const sees = (role, navId) => U.holds(new Set(role.grants.map(g => g[0])), NAV.get(navId));

/* ------------------------------------------------------------ per transition */
function checkStep(m, t, isAction) {
  const where = `${t.id}${isAction ? ' (action)' : ''}`;
  if (t.by === 'person') {
    if (!t.noPerm) {
      const [key, scope] = (t.perm || '').split('@');
      if (!PERM.has(key)) add('permission declared', 'fail', m.id, where, `${key} is not in PERMISSIONS`);
      else {
        const accepts = PERM.get(key);
        if (scope && !(accepts || []).includes(scope)) add('scope accepted', 'fail', m.id, where, `${key} does not accept @${scope} (takes ${(accepts || ['none']).join(', ')})`);
        const hs = holders(key, scope || (accepts ? accepts[0] : null));
        if (!hs.length) add('someone holds it', 'fail', m.id, where, `no shipped role holds ${t.perm}`);
        else if (NAV.has(t.page) && !hs.some(r => sees(r, t.page)))
          add('holder sees the page', 'fail', m.id, where, `${hs.map(r => r.id).join(', ')} hold ${t.perm} but cannot open ${NAV.get(t.page).label}`);
      }
    }
    if (!NAV.has(t.page)) add('offered on a page', 'fail', m.id, where, `no sidebar entry "${t.page}"`);
    else {
      const f = SCRIPTS[t.page];
      if (!t.marker || !SRC[f].includes(t.marker))
        add('built in the demo', 'warn', m.id, where, `"${t.label}" — ${f} has no "${t.marker}"`);
    }
  }
  if (t.by.startsWith('plugin:')) {
    const kind = t.by.slice(7), k = KINDS.get(kind);
    if (!k) add('plugin kind exists', 'fail', m.id, where, `no plugin type of kind "${kind}" in the data`);
    else if (!k.enabled) add('plugin kind exists', 'warn', m.id, where, `kind "${kind}" has no enabled instance`);
  }
  if (!m.unlogged && t.by !== 'system' && !t.logs && !t.noPerm)
    add('logged', 'fail', m.id, where, `"${t.label}" records nothing in the status log`);
  if (t.hook && !HOOKS.has(t.hook)) add('hook event exists', 'fail', m.id, where, `${t.hook} is not a hook event`);
}

/* ------------------------------------------------------------ per machine */
const graphs = machines.map(m => {
  const states = Object.keys(m.states);
  const real = m.transitions.filter(t => !t.loop);
  m.unlogged = ['delivery', 'task'].includes(m.id);
  real.concat(m.transitions.filter(t => t.loop)).forEach(t => {
    [t.from, t.to].filter(Boolean).forEach(s => { if (!m.states[s]) add('states declared', 'fail', m.id, t.id, `unknown state ${s}`); });
    checkStep(m, t, false);
  });
  (m.actions || []).forEach(a => checkStep(m, a, true));

  /* reachable from what comes into existence */
  const seen = new Set(states.filter(s => m.states[s].initial));
  real.filter(t => t.from == null).forEach(t => seen.add(t.to));
  let grew = true;
  while (grew) { grew = false;
    real.forEach(t => { if (t.from && seen.has(t.from) && !seen.has(t.to)) { seen.add(t.to); grew = true; } }); }
  states.filter(s => !seen.has(s)).forEach(s => add('every state reachable', 'fail', m.id, s, `${m.states[s].label} cannot be reached`));
  /* an initial state exists from the moment its record does — a flag on an iteration */
  if (!real.some(t => t.from == null) && !states.some(s => m.states[s].initial))
    add('something creates it', 'fail', m.id, '—', 'no transition brings it into existence');

  /* no dead ends: a state that is not terminal, final or handed on must have a way out */
  states.forEach(s => { const st = m.states[s];
    if (st.terminal || st.next || (m.final || []).includes(s)) return;
    if (!real.some(t => t.from === s)) add('no dead ends', 'fail', m.id, s, `${st.label} has no way out and is not terminal`); });

  /* a terminal state with a way out is not terminal */
  states.forEach(s => { if (m.states[s].terminal && real.some(t => t.from === s))
    add('terminal is terminal', 'warn', m.id, s, `${m.states[s].label} is marked terminal but has a way out`); });

  return { id: m.id, reachable: [...seen] };
});

/* ------------------------------------------------------------ across the model */
const steps = machines.flatMap(m => [...m.transitions, ...(m.actions || [])]);

/* every hook event is fired by something in the model */
const fired = new Set(steps.map(t => t.hook).filter(Boolean));
[...HOOKS].filter(h => !fired.has(h)).forEach(h => add('every hook event fires', 'warn', '—', h, `no transition in the model fires ${h}`));

/* every permission is usable: named by the model or by a page */
const scriptText = Object.values(SRC).join('\n') + fs.readFileSync(path.join(DEMOS, 'vera-ui.js'), 'utf8');
const used = new Set(steps.map(t => (t.perm || '').split('@')[0]).filter(Boolean));
[...PERM.keys()].filter(k => !used.has(k) && !scriptText.includes(`'${k}'`))
  .forEach(k => add('every permission used', 'warn', '—', k, `${k} is granted but no page or transition uses it`));

/* every permission a page asks about exists */
const GROUPS = new Set([...PERM.keys()].map(k => k.split('.')[0]));
for (const [f, src] of Object.entries(SRC)) {
  const asked = [...src.matchAll(/(?:can|may|has|holds|scopesOf\(role,\s*|at\()\(?\s*'([a-z]+\.[a-z_]+)'/g)].map(x => x[1]);
  [...new Set(asked)].filter(k => GROUPS.has(k.split('.')[0]) && !PERM.has(k) && !HOOKS.has(k))
    .forEach(k => add('pages ask for real permissions', 'fail', '—', f, `${f} checks ${k}, which is not a permission`));
}

/* every role grant is a declared permission at an accepted scope */
D.roles.forEach(r => r.grants.forEach(([k, s]) => {
  if (!PERM.has(k)) add('grants are declared', 'fail', 'roles', r.id, `${r.id} grants ${k}, not a permission`);
  else if (s && !(PERM.get(k) || []).includes(s)) add('grants are declared', 'fail', 'roles', r.id, `${r.id} grants ${k}@${s}, a scope it does not take`);
}));

/* every sidebar entry has something to do on it */
U.NAV.forEach(n => { if (!steps.some(t => t.page === n.id))
  add('every page has work', 'warn', '—', n.id, `${n.label}: no transition or action in the model is offered here`); });

/* ------------------------------------------------------------ report */
const CHECKS = ['states declared', 'something creates it', 'every state reachable', 'no dead ends', 'terminal is terminal',
  'permission declared', 'scope accepted', 'someone holds it', 'holder sees the page', 'offered on a page',
  'built in the demo', 'plugin kind exists', 'logged', 'hook event exists', 'every hook event fires',
  'every permission used', 'pages ask for real permissions', 'grants are declared', 'every page has work'];
const counts = { transitions: machines.reduce((a, m) => a + m.transitions.length, 0),
  actions: machines.reduce((a, m) => a + (m.actions || []).length, 0),
  states: machines.reduce((a, m) => a + Object.keys(m.states).length, 0) };
const report = { at: new Date().toISOString(), counts, checks: CHECKS, findings: out, graphs };
fs.writeFileSync(path.join(HERE, 'report.js'), `/* written by check.js — do not edit */\nwindow.VERA_REPORT = ${JSON.stringify(report, null, 1)};\n`);

const pad = (s, n) => (s + ' ' + '.'.repeat(n)).slice(0, n);
console.log(`${machines.length} machines · ${counts.states} states · ${counts.transitions} transitions · ${counts.actions} actions\n`);
CHECKS.forEach(c => {
  const f = out.filter(x => x.check === c), fails = f.filter(x => x.level === 'fail').length;
  console.log(`${f.length ? (fails ? '✗' : '!') : '✓'} ${pad(c, 34)} ${f.length || 'ok'}`);
  f.forEach(x => console.log(`    ${x.level === 'fail' ? '✗' : '!'} ${x.machine} · ${x.item} — ${x.text}`));
});
const fails = out.filter(x => x.level === 'fail').length;
console.log(`\n${fails} failing · ${out.length - fails} to look at`);
process.exitCode = fails ? 1 : 0;
