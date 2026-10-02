const { chromium } = require('playwright');
const path = require('path');
const R = '/home/robert/code/work/github.com/moravianlibrary/vera/docs/demos';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto('file://' + path.join(R, 'documents.html'));
  await p.waitForTimeout(900);
  const out = await p.evaluate(() => {
    const seen = {};
    const label = (el) => {
      const t = (el.textContent || '').trim().slice(0, 28);
      const cs = getComputedStyle(el);
      return `${cs.fontSize}/${cs.fontWeight} lh${cs.lineHeight}  "${t}"`;
    };
    const pick = (sel) => { const e = document.querySelector(sel); return e ? label(e) : null; };
    // sample every distinct font-size present on visible text nodes
    const sizes = {};
    document.querySelectorAll('body *').forEach(el => {
      if (!el.offsetParent) return;
      const kids = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
      if (!kids.length) return;
      const cs = getComputedStyle(el);
      const k = cs.fontSize + '/' + cs.fontWeight;
      sizes[k] = (sizes[k] || 0) + 1;
    });
    return {
      h1: pick('h1'),
      paneTitle: pick('h2') || pick('.text-2xl'),
      sizes: Object.entries(sizes).sort((a,b)=>b[1]-a[1]).slice(0, 12)
    };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
