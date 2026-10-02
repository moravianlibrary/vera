/* Render every page at its tier's viewport and save a screenshot.
   Also reports console errors, horizontal overflow and element counts.

     npm install --no-save playwright && npx playwright install chromium
     node tools/shots.js            all pages
     node tools/shots.js validation just that one

   Run from docs/demos/.                                                    */

const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tools', 'shots');
/* Real displays, not crops of one. The CSS root size differs per tier
   (vera.css § scale), so `large` is a bigger screen AND a step back, while
   `small` and `phone` keep notebook's type on a physically smaller panel. */
const TIERS = {
  large:    { width: 1920, height: 1200 },   /* desktop monitor  — 15px root */
  notebook: { width: 1440, height:  900 },   /* the laptop       — 16px root */
  small:    { width: 1024, height:  768 },   /* tablet landscape — 16px root */
  phone:    { width:  393, height:  852 }    /* phone            — 16px root */
};

(async () => {
  const only = process.argv[2];
  fs.mkdirSync(OUT, { recursive: true });
  const pages = fs.readdirSync(path.join(ROOT, 'large'))
    .filter(f => f.endsWith('.html'))
    .filter(f => !only || f.startsWith(only));

  const browser = await chromium.launch();
  let bad = 0;

  for (const [tier, vp] of Object.entries(TIERS)) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    for (const file of pages) {
      const p = await ctx.newPage();
      const errs = [];
      p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      p.on('pageerror', e => errs.push(e.message));
      await p.goto('file://' + path.join(ROOT, tier, file));
      /* park the pointer away from the rail — at (0,0) it sits inside the
         sidebar and silently triggers hover-expand */
      await p.mouse.move(vp.width - 5, vp.height / 2);
      await p.waitForTimeout(150);

      const m = await p.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1
          ? document.documentElement.scrollWidth - window.innerWidth : 0,
        /* a table wider than its scroll container means columns are CLIPPED —
           invisible at page level because .content scrolls */
        clipped: (() => {
          const c = document.querySelector('.content');
          if (!c) return 0;
          const t = document.querySelector('.card');
          const a = c.scrollWidth - c.clientWidth, bb = t ? t.scrollWidth - t.clientWidth : 0;
          return Math.max(a > 1 ? a : 0, bb > 1 ? bb : 0);
        })(),
        /* a master–detail pane that never got its first record is a blank
           right-hand half — the reader sees an empty page, not a list */
        emptyPane: (() => {
          const pane = document.querySelector('.pane');
          if (!pane) return false;
          const sheet = document.documentElement.dataset.tier === 'phone';
          return !sheet && !pane.querySelector('.pane-head');
        })(),
        rows: document.querySelectorAll(
          'tr.data-row, article.rec, .lrow, .homecard, .home-alone, .pj-card, .pj-table tbody tr, .tk-card, .tk-run, .ac-item, .lrow').length,
        nav:  document.querySelectorAll('.nav .sidebar-link').length,
        detail: !!document.querySelector('.detail.docked'),
        sidebarW: (document.querySelector('.sidebar') || {}).offsetWidth || 0,
        mainX: Math.round((document.querySelector('.main') || {}).getBoundingClientRect
          ? document.querySelector('.main').getBoundingClientRect().x : 0)
      }));

      /* hover-expand must OVERLAY, never push: .main must not move */
      let shift = 0;
      if (tier === 'notebook') {
        await p.mouse.move(20, 300);
        await p.waitForTimeout(450);
        const after = await p.evaluate(() =>
          Math.round(document.querySelector('.main').getBoundingClientRect().x));
        shift = Math.abs(after - m.mainX);
        await p.mouse.move(vp.width - 5, vp.height / 2);
        await p.waitForTimeout(250);
      }

      const name = `${tier}-${file.replace('.html', '')}.png`;
      await p.screenshot({ path: path.join(OUT, name), fullPage: false });

      const flags = [];
      if (errs.length) flags.push('JS:' + errs[0].slice(0, 60));
      if (m.overflow) flags.push(`OVERFLOW +${m.overflow}px`);
      if (!m.rows) flags.push('NO ROWS');
      if (m.clipped) flags.push(`COLUMNS CLIPPED +${m.clipped}px`);
      if (m.emptyPane) flags.push('EMPTY PANE');
      if (shift) flags.push(`HOVER PUSHED CONTENT ${shift}px`);
      if (flags.length) bad++;
      console.log(
        (flags.length ? 'x ' : '  ') + `${tier}/${file}`.padEnd(30),
        `rows:${String(m.rows).padEnd(3)} nav:${String(m.nav).padEnd(3)}`,
        `sidebar:${String(m.sidebarW).padEnd(4)}`,
        m.detail ? 'docked' : '      ',
        flags.join(' | '));
      await p.close();
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${pages.length * 4} shots in tools/shots/ — ${bad} with problems`);
})();
