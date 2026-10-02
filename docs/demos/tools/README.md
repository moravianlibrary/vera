# tools

`render-check.js` renders every page in every tier under jsdom and reports
runtime errors, row counts and nav-entry counts. It is a smoke test, not a
visual one — it catches "this page throws" and "this page renders nothing",
not "this page looks wrong".

    npm install --no-save jsdom
    node tools/render-check.js

Run it from `docs/demos/`.

`shots.js` renders every page at its tier's viewport with playwright, writes a
screenshot to `shots/`, and fails on: a JS error, an empty page, horizontal
overflow, **columns clipped inside a scroll container**, **hover-expand
pushing the content** instead of overlaying it, and an **empty detail pane**
(a master–detail page that never rendered its first record is a blank
right-hand half). Those last three are the ones a human misses.

The viewports are real displays rather than crops of one, and the CSS root
size differs per tier — see `vera.css` § scale:

| tier | viewport | root |
|---|---|---|
| large | 1920×1200 | 15px |
| notebook | 1440×900 | 16px |
| small | 1024×768 | 16px |
| phone | 393×852 | 16px |

Because the harness opens each tier at exactly its own viewport, the **device
frame** (`vera.css` § device frame) never engages — it only appears when the
window is bigger than the device. So the screenshots are the pages themselves,
not pages inside a bezel. Open `small/` or `phone/` in a desktop browser to
see the framed version.

`type.js` measures the **original** demos' type scale — every distinct
size/weight actually painted, ranked by how often it appears. The rework's
type is set from what this reports, not from taste. Run it against
`documents.html` when the originals are the reference for a judgement call.

`palette.js` re-reads the shadcn preset named in `rework.md`. The page serves
`lab()` values, so it samples painted pixels rather than reading computed
strings — reading the string gives nonsense.

    npm install --no-save playwright && npx playwright install chromium
    node tools/shots.js            # all pages
    node tools/shots.js validation # one page, four tiers
    node tools/palette.js
    node tools/type.js             # measure the ORIGINALS' type scale
