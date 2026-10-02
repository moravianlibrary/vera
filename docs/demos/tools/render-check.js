const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const root = require('path').resolve(__dirname, '..');
const tiers = ['large','notebook','small','phone'];
const pages = fs.readdirSync(path.join(root,'large')).filter(f=>f.endsWith('.html'));
let fail = 0, ok = 0;
for (const tier of tiers) for (const page of pages) {
  const file = path.join(root, tier, page);
  const html = fs.readFileSync(file,'utf8');
  const errs = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: { fetch(){ return null; } },
    url: 'http://localhost/' + tier + '/' + page,
    beforeParse(w){
      w.localStorage = { getItem:()=>null, setItem:()=>{} };
      w.onerror = (m)=>errs.push(m);
    }
  });
  // manually inline scripts since jsdom won't fetch local files without a resource loader
  const doc = dom.window.document;
  try {
    for (const s of [...doc.querySelectorAll('script[src]')]) {
      const p = path.resolve(path.dirname(file), s.getAttribute('src'));
      dom.window.eval(fs.readFileSync(p,'utf8'));
    }
    for (const s of [...doc.querySelectorAll('script:not([src])')]) dom.window.eval(s.textContent);
  } catch (e) { errs.push(e.message); }
  const rows = doc.querySelectorAll('tr.data-row, article.rec').length;
  const nav  = doc.querySelectorAll('.sidebar-link, .tabbar a').length;
  if (errs.length) { fail++; console.log('FAIL', tier+'/'+page, '→', errs[0]); }
  else { ok++; console.log('  ok', (tier+'/'+page).padEnd(30), 'rows:'+String(rows).padEnd(4), 'nav:'+nav); }
  dom.window.close();
}
console.log('\n' + ok + ' rendered, ' + fail + ' failed');
