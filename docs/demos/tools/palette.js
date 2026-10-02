/* Re-read the shadcn preset named in rework.md and print it as CSS variables.
   The page serves lab() values, so read the COMPUTED string and you get
   nonsense — paint each colour to a 1x1 canvas and sample the pixel instead.

     npm install --no-save playwright && npx playwright install chromium
     node tools/palette.js                                                  */

const { chromium } = require('playwright');
const URL = 'https://ui.shadcn.com/create?preset=b2BWi3afQ&item=preview';
const KEYS = ['background','foreground','card','popover','primary','primary-foreground',
  'secondary','secondary-foreground','muted','muted-foreground','accent','accent-foreground',
  'destructive','border','input','ring','chart-1','chart-2','chart-3','chart-4','chart-5',
  'sidebar','sidebar-foreground','sidebar-primary','sidebar-accent','sidebar-border'];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  try { await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 }); } catch {}
  await p.waitForTimeout(9000);
  const read = () => p.evaluate((KEYS) => {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const g = c.getContext('2d'), probe = document.createElement('div');
    document.body.appendChild(probe);
    const out = {};
    for (const k of KEYS) {
      probe.style.backgroundColor = 'var(--' + k + ')';
      g.fillStyle = '#000'; g.fillRect(0, 0, 1, 1);
      g.fillStyle = getComputedStyle(probe).backgroundColor; g.fillRect(0, 0, 1, 1);
      const d = g.getImageData(0, 0, 1, 1).data;
      out[k] = '#' + [d[0], d[1], d[2]].map(x => x.toString(16).padStart(2, '0')).join('');
    }
    probe.remove();
    out.radius = getComputedStyle(document.documentElement).getPropertyValue('--radius').trim();
    return out;
  }, KEYS);
  const light = await read();
  await p.evaluate(() => document.documentElement.classList.add('dark'));
  await p.waitForTimeout(900);
  const dark = await read();
  const dump = (t, o) => { console.log('/* ' + t + ' */');
    Object.entries(o).forEach(([k, v]) => console.log('  --' + k + ': ' + v + ';')); };
  dump('light', light); dump('dark', dark);
  await b.close();
})();
