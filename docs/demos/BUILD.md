# Demos — build state

Open `index.html`.

## What exists

**14 pages × 4 tiers = 56 files**, all rendering clean under playwright.
Palette is the shadcn preset from `rework.md`, read out of the live preview.
Type scale and font stack are **measured off the original demos**, not
eyeballed — `tools/type.js`.

```
shared/vera-model.js     the four axes, badge precedence, gates, stage,
                         priority, registry normalisation — vocabulary and
                         derivation only, no data, no DOM
shared/vera-data.js      ONE dataset every page is a view over
shared/vera-ui.js        shell: 14-entry sidebar per tier, badges, footnotes,
                         registry cells, detail plumbing, demo chrome
shared/vera.css          scale per tier, type, master-detail, cards, rail
shared/page-*.js         one module per page; columns per tier live here
{large,notebook,small,phone}/*.html   thin — load the shared layer, call one function
tools/shots.js           playwright: screenshots + layout assertions
tools/palette.js         re-reads the shadcn preset into CSS variables
tools/type.js            re-measures the ORIGINALS' type scale
tools/render-check.js    jsdom smoke test, no browser needed
tools/shots/             56 screenshots, one per page per tier
```

The ten original demos at the top level are **untouched**, as agreed. They are
the reference the rework is measured against.

## Two shapes, and what decides which

The originals' **master–detail** is the primary shape. An earlier pass built
everything as a flat wide table; that was a regression — nine columns clipped,
and a row still could not say *why* it was where it was.

| | |
|---|---|
| **master–detail** | Documents · Validations · Proposals · My Requests · Projects · Categories (tree) · Intentions |
| **table** | Lists · Generation (it owns selection) · Additions (grouped by batch) · Tasks · Users & Groups · Plugins · Hooks |

A table is right where you compare rows of numbers across. Everything else
wants a list you scan beside a pane that answers in full.

Both carry the originals' chrome: a view switcher in the header (**lenses on
one view**, never routes to another), a filter bar of strike-off chips ending
in *Save as Watchlist*, per-row actions, and a pager.

## A tier is a display, not a column count

Everything is in `rem`, so the root size is the one knob. `<html data-tier>`
picks it.

| tier | viewport | root | |
|---|---|---|---|
| notebook | 1440×900 | **16px** | the size it is authored at — fits the laptop |
| large | 1920×1200 | **15px** | bigger screen *and* a step back — zoomed out |
| small | 1024×768 | **16px** | a tablet: same type, less room, layout reflows |
| phone | 393×852 | **16px** | same again, touch-sized controls |

Scale does not track width, and that is the point. Small keeps the two-column
split — at 1024 there is room, and it is a smaller display rather than a
narrower one. Only the phone makes the pane a sheet. Large caps its measure at
64rem: more room, not longer lines.

## Two demo-only controls

Bottom of every page:

- **size** (right) — jump between the four tiers of the same page.
- **as** (left) — re-render as a different actor. Entries and actions the actor
  cannot reach are **absent, never disabled**. *Additions* as `curator` is the
  clearest example: the same page, every action gone, the failure text still
  readable.

## What the demos demonstrate

Each was a decision that looked arguable in prose and is obvious on screen:

| | |
|---|---|
| **Proposals** | 5 asks → **3 rows**. A decision on one is a decision on all, so five rows would mean deciding one title five times. The reasons are in the row and the detail. |
| **Validations** | the budget test — 11/12 record, 17/18 chrome at notebook. *Outstanding* shows `D \ A`, never a defect already accepted. |
| **Categories** | recursive shares. Regional is 55% of Periodicals' 70% = **38.5%** of everything. Specialist has no share → flagged, not corrected. The editor refuses to save a set over 100. |
| **Generation** | the preview reports what it **cannot fill**, per category, before the list exists. *Mapa Moravy* is absent from the pool: it derives to `Ready` but is cancelled — the flag-not-position decision, visible. |
| **Documents** | `Lidové noviny` renders **`Published · review needed`** — the single exception to one-badge-per-row, from a re-check on a published item. |
| **Lists** | deleting states its consequence: *returns N to the pool, M digitized keep their status, K held stay held*. |
| **Users & Groups** | blue = direct grant, green = via a group. No capability is shown without how it got there. |

## Rendered and checked

`tools/shots.js` drives **playwright**: every page at its tier's viewport,
screenshot to `tools/shots/`, and it fails the run on any of —

- a JS error or an empty page
- the document overflowing horizontally
- **columns clipped** inside a scroll container (invisible at page level)
- **hover-expand pushing the content** instead of overlaying it
- an **empty pane** — a master–detail page that never rendered its first
  record is a blank right-hand half, which reads as a broken page

`tools/palette.js` re-reads the shadcn preset. Both need
`npm install --no-save playwright && npx playwright install chromium`.

Four real defects came out of actually looking:

| | |
|---|---|
| detail panel stacked **under** the table at `large` | it was appended to `.main` (a flex column) instead of being a sibling of it |
| hover-expand **pushed content 56px left** | `position: absolute` on hover takes the sidebar out of flow — the same fault it was meant to prevent. The aside now holds the width in flow and an inner layer grows |
| nine columns **silently clipped** by `overflow: hidden` | the card scrolls now, and the docked detail closes to give the width back |
| a reader was shown **`RDCZ: Revision`** | internal vocabulary in a public view. A reader is offered content or nothing |
| every tier rendered at **one type scale** | so notebook was large-minus-columns and small was a cropped notebook. Nothing fitted and nothing zoomed |
| buttons drawn as `<a>` came out **underlined** | `.btn` never reset `text-decoration`; a link drawn as a button is a button |
| the type had **drifted to 13px and 12px** | the originals are 14px/500 throughout. Same font family, different typeface to read |

## Honest gaps

1. **The budgets are gone from the pages, and still unmeasured.** The per-tier
   record/chrome readouts were printed from numbers copied out of the design
   docs, and the master–detail rework invalidated them — a pane is not a row,
   so the old counts describe a layout that no longer exists. They have been
   dropped rather than left lying. `view-rules.md` §1.4 still measures the old
   `documents.html`. **Re-derive the model against master–detail, then measure
   from the DOM.** This is the one number set nothing has verified.
2. **Looked at, but only by me.** Every page is screenshotted and the obvious
   faults are fixed, but nobody has used it. Typography, spacing and density
   are a first pass.
3. **Interactions are mostly inert.** Buttons that would open a dialog are
   drawn, not wired. Three things do work, because they are the point:
   the **sidebar toggle** (persisted per tier), the **distribution selector and
   percentage editor** on Categories, and the **generate preview**.
4. **Plugins is a shell**, deliberately — its detail tabs *are* the plugin
   contract, which is not designed.
5. **Search and filtering are chrome, not function.** The boxes cost their
   points and show the right patterns; nothing filters.

## Next

- **Re-derive the point budgets for master–detail** and then measure them from
  the DOM; correct `view-rules.md` §1.4, which still describes the old table
  layout of the old `documents.html`.
- Wire the dialogs that carry reasons — decline, deny, forbid, cancel. Those
  are the ones where the design says something specific (a decline reason is
  read by everyone who asked).
- The propose wizard (`/propose`) is referenced from My Requests but not built:
  identifier → resolve → **pick the unit** → reason. Both middle steps are
  load-bearing — no unit means no duplicate detection, no reason means the
  curator cannot set priority.
