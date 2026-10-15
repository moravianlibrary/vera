# Size tiers

VERA is built for four sizes of display. How each part looks at each tier belongs in
`develop/styling.md`, which part 5 writes.

#### UI-tiers

| Tier | Width | Root type size | Device |
|---|---|---|---|
| phone | below 768px | 16px | a phone, held close |
| small | 768–1279px | 16px | a tablet |
| notebook | 1280–1599px | 16px | a laptop, the default every page is designed at first |
| large | 1600px and up | 15px | a bigger monitor, further away |

#### UI-tier-is-a-display

A tier is a display, not a column count. Everything is sized in `rem`, so the root size is the one
setting that changes. On small and phone the type stays the same size and the layout gives way;
on large the type steps back slightly, so the extra room shows more.

*Why:* when tiers were column counts, notebook was large minus columns and small was a cropped
notebook, and nothing fitted.

#### UI-pane

A list with a record pane keeps both side by side at every tier except the phone, where the pane
opens as a sheet over the list.

#### UI-notebook-first

Notebook is designed first. A value set per tier falls back to its nearest neighbour towards
notebook.
