# Rework for new demos as cornerstone for reimplementation

## Targeted screen sizes

4 targeted screen sizes - large, notebook, small (tablet), and phone. Default one should be notebook. Large is just to use more space when it is available.

> **Settled, and it was wrong before.** A tier had been built as a *column
> count* — one type scale everywhere, tiers differing only in which columns
> survived. So notebook was large-minus-columns and small was a cropped
> notebook; nothing fitted anything, and nothing zoomed.
>
> A tier is a **display**. Everything is in `rem`, so the root size is the one
> knob (`shared/vera.css` § scale, stamped by `data-tier` on `<html>`):
>
> | tier | viewport | root | why |
> |---|---|---|---|
> | **notebook** | 1440×900 | **16px** | the size the demos are authored at — fits the laptop |
> | **large** | 1920×1200 | **15px** | bigger monitor *and* a step back: ~6% smaller type on ~33% more width — zoomed out |
> | **small** | 1024×768 | **16px** | a tablet. Same physical type, less room, so the layout reflows |
> | **phone** | 393×852 | **16px** | same again, plus touch-sized controls |
>
> Scale does not track width, and that is the point. Small and phone are
> physically smaller panels held closer, so type stays put and the **layout**
> gives way; large is a bigger panel further back, so type shrinks and the
> layout gains. Large caps its reading measure at 64rem — more room, not
> longer lines.
>
> Small keeps the **two-column split**: at 1024 there is room for both, and it
> is a smaller display rather than a narrower one. Only the phone gives up and
> makes the pane a sheet.
>
> **And a tier has to be shown at its display's size.** Opened on a desktop,
> `small` and `phone` stretch to fill the window and read as a wide layout
> with oversized type — the exact confusion the tier model exists to prevent.
> So on a bigger screen they are drawn at their real pixel size, centred on a
> backdrop, **inside a device frame**; the phone gets a phone's bezel. Only
> those two are framed: `notebook` is the default and the one being worked on,
> and `large` exists to use extra room when there is extra room.
>
> **When the device does not fit the window it is scaled, never cropped.** A
> phone cut off at 700px tall is not a phone, and everything concluded from it
> about what fits above the fold would be false. The frame keeps its true
> 393×852 layout and the whole device is drawn smaller — standing back from a
> real phone rather than sawing the bottom off one.
>
> On a screen that *is* the device — a real phone, or the screenshot harness
> at 393×852 — the frame never appears, which is what keeps the screenshots
> honest.

## Type

Measured off the original demos with playwright (`tools/type.js`), not
eyeballed. The originals **override Tailwind's default stack** in their own
`<style>` block, so matching Tailwind would have been the wrong target:

```
-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif

18px/600  page title       14px/500  body, table cells, list titles
20px/600  pane title       12px/…    secondary, ids, footnotes
                           10px/600  uppercase labels
```

`14px/500` is the dominant size in the originals by a wide margin. The rework
had drifted to 13px and 12px everywhere, which is what made it read as a
different typeface even though the family was identical.

## Palette

https://ui.shadcn.com/create?preset=b2BWi3afQ&item=preview

> **Read out of the live preview** (playwright, sampling painted pixels — the
> page serves `lab()` values, so reading the computed string gives nonsense)
> and written into `shared/vera.css` as CSS variables. `tools/palette.js`
> re-reads it if the preset changes.
>
> Neutral base, **mono-blue** chart ramp, `--radius: .625rem`:
> `background #ffffff` · `foreground #0a0a0a` · `muted #f5f5f5` ·
> `muted-foreground #737373` · `border #e5e5e5` · `primary #171717` ·
> `destructive #e7000b` ·
> charts `#8ec5ff #2b7fff #155dfc #1447e6 #193cb8`.
>
> One deliberate departure: the preset's `--sidebar` is near-white (`#fafafa`).
> The demos keep the **dark** bar from the original demos, built from the
> preset's own dark neutrals (`#171717` / `#262626`) rather than invented
> slate.

## Stack

Tailwind, shadcn for client.
Java Spring backend.
Java plugins for backend.

## Enums

### Status

Status of the current iteration of the document within the VERA app. Its probably mix of multiple enums, should be decided how would it be handled - either X 1 per iteration value enums, or some big enum with more then 1 values possible per iteration:
- Pending - users proposal for digitization, not a document iteration yet, waits for curator approval.
- Approved - users proposal for digitization, that was approved.
- Denied - users proposal for digitization, that was denied.
- Forbidden - proposal or addition, that digitization was forbidden by some rule (some plugin parsing some info).
- ForbiddenOverruled - for forbidden, that were admin overruled.
- ReviewNeeded - if some checks that ran (based on plugins results) did not met criteria, then the digitization cant happen, till the review is done. After review, it can be either ReviewedApproved or ReviewedDenied - shouldnt be same as Approved and Denied for proposals, because it has different meaning - for proposals it means if the proposal is going to be digitized, here it means if the metadata issue found by plugin are not substential - the curator takes responsibility and basically says this is no problem for digitization process or resulting metadata.
- NotEligible - can be still proposal approved and / or review approved. If review approved, then it says something like not eligible but approved.
- Enqueued - running eligibility checks, fetching data from apis, etc.
- Planned - all checks (proposal approval, review if needed). Document iteration is now in the pool of documents to be digitized.
- InProgress - document iteration is now part of some digitization list and will be digitized in upcoming days.
- Finished - succesfully digitized.
- Published - succesfully digitized and there is link for it (clicking on the badge will navigate there).

> **Answered:** `docs/design/shared/entities/status-model.md` — 4 stored axes
> (decision, **restriction**, validation, progress) + 1 derived badge.
> *Eligibility* was retired later: it held three different findings — a
> prohibition (now the restriction), missing data (now a validation defect)
> and *already digitized* (now an existing copy on the request, which blocks
> nothing; approving over it is a curator's **rescan**). `Ready`
> replaces `Planned`; `Planned` is freed for future-dated lists as proposed
> below. `ForbiddenOverruled` becomes `Forbidden` + override.

What is missing? Maybe Planned is not best option for digitization ready documents and it should be Ready. Planned then can be used to pre-create digitization lists for future. Meaning when digitization curator creates list, he chooses if it goes straight to in progress other option is Planned - with some day when it is planned for.
Also idk how this could be used, these are like 4 different domains, but it also makes sense to have them as 1 enum maybe? Or at least as 1 document iteration property even when on the backend it would be 4 (5?) different enums.

## Client views

- Logo (small / big) - navigate to Home
---
- Roll out / back button
---
- Documents
- Documents Validations
- Digitization Lists Generation
- Proposals
- Additions
- Projects
- Categories
- Intentions
- Digitization Lists
- Tasks
- Users & Groups (only Users?)
- Plugins
- Hooks
---
- Watchlists
---
- Running tasks (if any)
- User preference settings / logout / change password / others - as 1 popup menu

In this exact order.
In Large and Notebook sizes there should be navbar on the left. Large default visible whole, Notebook default visible only as mini bar with short sections names (just 2 letters). Button for making it whole or small - the client should remember preference. If it small and the user hovers above it, it rolls to whole, but after navigating it rolls back to small.

> **Worked out:** `docs/design/shared/navigation.md`. Names and order kept
> exactly, as **one flat list** — no group headers, and **no counts on nav
> entries**: a bare number does not say what it counts, so counts live on
> Watchlists where the panel itemises them. **One addition** —
> *My Requests*, above Documents: a request exists before any iteration does,
> so a Documents row cannot show a proposal still awaiting review, and a reader
> would otherwise have to follow their item from Proposals into Documents by
> knowing to look.
>
> The 2-letter rail works out as `Do DV DG Pr Ad Pj Ca In DL Ta UG Pl Ho` plus
> `MR` — one-word entries take two letters, multi-word entries take initials.
> The toggle is a **row inside the bar**, under the logo. Watchlists is **one
> row opening a popover** grouped by view; Running tasks is a **panel with
> progress bars**, collapsing to a dot on the rail. Hover-expand overlays
> without moving the content — verified in the screenshot harness rather than
> asserted.
>
> **Re-cut since** — `docs/design/shared/document-use-cases.md` and
> `navigation.md` §1.1. The use cases were listed first, then the pages fitted
> to them. The first four entries are now in pipeline order: **Documents**
> (labelled *My Documents* for a reader — one row is a document, from the ask
> to the scan), **Proposals**, **Documents Validations** (metadata only),
> **Digitization Lists** (browse, plus one editor for new and existing lists —
> *Generation* merged in). *My Requests* merged into Documents;
> *Additions* is gone — an addition is a proposal approved at the moment it is
> made, and a failed one is a status in Documents, grouped by batch. **No
> groups** anywhere — the list is flat, on Home too. No
> shortcut (approve now, a plugin, bulk approve) ever approves a rescan.

### Home

Either some plots (based on user permissions), or some clickable cards - if you want propose document for digitization click here, if you want to check how your proposals went click here, if you want to generate new Digitization list click here, etc.

> **Neither, mostly** — `navigation.md` §8. `/` **resolves** rather than
> renders: exactly one entry anywhere in the sidebar redirects to it, so a user
> who only proposes documents lands straight on *My Requests*. More than one
> entry gets the cards. The count is across the whole list — somebody may hold
> *My Documents* and *Projects* and nothing else.
>
> Plots would restate the counts the sidebar already carries, and a chart with
> nothing to filter belongs on a view's overview strip. The cards stay
> **destinations**; the actions on them (*propose a document*, *generate a
> list*) become primary CTAs in the views they act on.
>
> **The card itself** is `navigation.md` §8.3–8.6: three lines — the job in the
> words of the person doing it, the entry name it lands on, and *at most one
> number, only when that number is work waiting for you*. Absent at zero rather
> than shown as zero. One grid in the sidebar's order, no group headers. Per
> tier it is 4 / 3 / 2 / 1
> columns, and a **row** rather than a box on phone. Home is the one page with
> headroom at every tier; §8.6 lists what that headroom is refused for.
>
> **Built** — `shared/page-home.js`, four tiers, 4 / 3 / 2 / 1 columns. The
> two outcomes of `/` that are *not* a page are drawn rather than performed: a
> redirect that fires silently is indistinguishable from a broken link when
> you are reading a design, so switching `as` to **reader** shows the rule
> instead of executing it, and `?grants=none` shows the fail-closed line no
> role in the `as` bar can reach.

> **Shape, settled:** the originals' **master–detail** is the primary shape
> and the rework's flat wide tables were a regression — they clipped, and they
> still could not say *why* a row was where it was. A narrow list you scan
> beside a pane that answers in full costs less width and says more.
>
> Master–detail: *Documents · Documents Validations · Proposals · My Requests ·
> Projects · Categories (tree) · Intentions*.
> Table: *Digitization Lists · Digitization Lists Generation (it owns
> selection) · Additions (grouped by batch) · Tasks · Users & Groups · Plugins
> · Hooks* — a table is right where you compare rows of numbers across.
>
> Both shapes carry the originals' chrome: a **view switcher** in the header
> (lenses on one view, never routes to another), a **filter bar** of
> strike-off chips ending in *Save as Watchlist*, per-row **actions**, and a
> **pager**.

### Documents

Read-only view of documents. By default users own documents that made it into digitization process - were approved / added. Users that have permission for it can also view here other users (either within group or all) documents. The properties shown for each document by default should be:
- Title (not only of the catalog record, but the issue / volume too if available)
- Status
