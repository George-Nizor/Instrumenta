# Aligning an app with brand v2

How to bring one product into the Instrumenta brand, in a session of its own. Written so a fresh
chat with no history can do it: read this file, then `brand/README.md`, then the product's own
docs, and you have everything.

The brand was decided on 2026-10-06 (`docs/suite/decisions.md`). The launcher has adopted it in
full. **Every other product adopts it through one of these reviews, one product at a time.** The
apps have grown complicated, so this is a review and a set of agreed changes, not a find-and-replace.
If a change would break or muddy what the app does, the app wins and the review records why.

## What is fixed

These are settled. A review applies them; it does not reopen them.

| | |
| --- | --- |
| Icon style | Freestanding objects with depth: a flat drawing of the thing, a dark ink outline, a deep-shaded extrusion down and to the right. **No tile or rounded container behind it** (rejected as phone-app-like). |
| The product's icon | Drawn in `brand/icons/instrumenta-icons.js`. Fabula is the slate (clapperboard with transcript lines), Instrumenta the organ. The other six are first drafts that a review may redraw, in the library, in the same style. |
| Colour | One accent per product, all at the same OKLCH lightness 0.70 and chroma 0.155 (Luna 0.07). Values in `brand/tokens.json`: `accent`, `secondary` (light tint), `deep` (extrusion), `ink` (lines), `surface` (dark ground). |
| Display type | **Fraunces**, weight 650 to 700, `font-variation-settings: "SOFT" 100, "WONK" 1`, optical size matched to the size. For the product name, headings and big moments only. |
| Interface type | **Commissioner**, `font-variation-settings: "FLAR" 40`. Everything a person reads to operate the app. |
| Code type | **Spline Sans Mono**: code, versions, timecodes, sizes, FEN, IDs. |
| Motion | Each icon has its own movement (`brand/icons/instrumenta-icons.css`). It rests by default and moves on hover, focus, or a meaningful moment (opening, finishing, updating). Always honour `prefers-reduced-motion`. |

## What each app decides in its review

- Where the icon appears (title bar, empty states, about screen, loading) and whether it animates there.
- Which surfaces take Fraunces. Usually: the app name, page and section titles, empty-state headlines.
  Never dense UI, tables, form labels or body copy.
- How the accent is used: primary buttons, selection, focus, progress. Not large fills behind text.
- Dark and light themes: the tokens are dark-first; an app with a light theme derives its own light
  surfaces and keeps the accent, checking contrast.
- What stays as it is, and why. Content type is the app's own (Ludere's Courier page, Imago's
  composition fonts, LearnChess's board and pieces, Discere's lesson typography where it carries meaning).

## How an app takes the assets

Products are separate repositories and must build and run on their own, so they **copy** what they
need rather than reaching into the Instrumenta checkout. A web product also cannot load fonts or
scripts from a CDN: the launcher's build audit refuses it.

1. **Fonts**: copy `brand/fonts/*.woff2`, the three `OFL-*.txt` files and `fonts.css` into the app
   (for example `public/fonts/brand/`) and load that `fonts.css`. Keep the licence files beside them.
2. **Icon**: copy `brand/icons/svg/<id>.svg` (and `-24`, `-16`) for static use, and
   `brand/icons/png/<id>-*.png` or `ico/<id>.ico` for favicons and the Windows executable. To animate
   it, copy `instrumenta-icons.js` and `instrumenta-icons.css` and render with
   `InstrumentaIcons.render('<id>', { size })`. The output uses no inline styles, so it is safe under a
   strict Content-Security-Policy.
3. **Colour**: copy the product's block and `family` from `brand/tokens.json` into the app's CSS
   custom properties. Do not hand-pick nearby values.
4. Record what was copied and from which Instrumenta commit, in the app's own docs, so a later
   refresh knows what to update. Regenerate in Instrumenta (`uv run brand/scripts/build-brand.py`),
   never edit a copied file.
5. If the review redraws the product's glyph, change it in `instrumenta-icons.js`, rebuild, commit
   in Instrumenta, then copy the results.

## The README

Every repository's README is the first thing someone who clones it sees, and every one is still in
the v1 brand. Bring it across in the same review, or in a README pass across all repositories at
once (see the backlog), whichever comes first:

- **Banner**: `docs/images/<id>-banner.png`, 1600×500, redone in v2: the dark `surface` field with
  the product accent at the edges, the name in Fraunces (not Space Grotesk), and the freestanding
  icon in place of the v1 sculpture. Generate it from the brand files rather than composing it by
  hand, so all eight match.
- **Icon**: the freestanding icon at the top, or `brand/icons/svg/<id>-animated.svg`, which moves
  on its own on GitHub.
- **Name and line**: the same one-line description the launcher uses, so the suite describes each
  app one way everywhere.
- **Family**: a short footer saying the app is part of Instrumenta, by Bonehead Labs, with links,
  and the licence. Make sure it still reads well if the repository moves to the Bonehead-Labs
  organisation.
- **Screenshots**: replace any that show the v1 look once the app itself is aligned.

## The review, step by step

1. **Read.** This file, `brand/README.md`, the product's README and agent docs, and its current
   styles (where colours, fonts and icons are defined today).
2. **Inventory.** List every place the app shows its mark, its name, an accent colour, or a font.
   Note which are interface and which are content.
3. **Propose.** Before changing code, write a short plan: what changes, what stays and why, any
   risk to functionality. Show it to the owner. A preview (an artifact or screenshots) is the best
   way to agree it.
4. **Apply** in the app's repository, on a branch, in small commits. Fonts and tokens first, then
   the icon, then the surfaces.
5. **Check.** The app's own tests and build; a look at every main screen in dark and light; reduced
   motion; keyboard focus is still visible in the new accent; nothing is slower to load.
6. **README.** Bring the README across (see "The README" above), or note that the README pass will.
7. **Record.** In this file's table below: date, what changed, what was deliberately kept, and the
   app commit. In `docs/suite/decisions.md` if anything departs from the fixed rules. A dated line in
   `docs/suite/session-log.md`.

## Per-app notes

What is already known about each product, to start its review from.

| Product | Icon | Known constraints | Status |
| --- | --- | --- | --- |
| Instrumenta | The organ | The launcher. Adopted in full on 2026-10-06. | Done |
| Discere | Open book | Aligned 2026-10-06 (see review log). The owner is actively developing it. Its UI is large (React, Inter variable via Fontsource, its own `--font-sans` and `--font-mono` variables) with lesson content, KaTeX maths and deterministic SVG diagrams, maps and timelines whose type and colour may carry meaning. Review the chrome first and leave learning content until it is clearly safe. It has `public/discere-mark.png` and a favicon to replace. Its capability-gating screens (Settings) are a good first surface. | Done |
| Fabula | The slate | Two windows' worth of UI: the editor and the Making panel, plus the video look system (themes and fonts that end up *in films*; those are content, not chrome). Already carries the v1 Motus mark. | Not started |
| Imago | Framed picture with sparkle | Due to be rebuilt as an AI designer (backlog, parked). Its composition fonts are content. Probably align only the chrome now, or fold the brand into the rebuild. | Not started |
| Ludere | Screenplay page | The screenplay page stays Courier. Only the interface around it changes. | Not started |
| LearnChess | Rook | Already uses Fraunces, with JetBrains Mono for FEN and PGN: the closest to v2 already. Decide whether JetBrains Mono gives way to Spline Sans Mono. Board colours and piece sets are content. | Not started |
| Luna | Crescent with a voice | Has a deliberate 1-bit, black-and-white UI. It is archived in `brand/archive/v1/luna/` in case the owner wants it back. Biggest visual change of the suite; preview before committing. Its accent is deliberately low-chroma. | Not started |
| Forge3D | Cube | Uses Space Grotesk in its Electron desktop, and a 3D viewport whose colours are content. | Not started |

Each repository's README banner (`docs/images/<id>-banner.png`) is still v1 and is redone in its review.

## Starting a review in a fresh chat

Paste this, with the product name filled in:

> We're doing the brand v2 alignment review for **Discere**. Read
> `Instrumenta/brand/ALIGNMENT.md` and `Instrumenta/brand/README.md` in the workspace first, then
> Discere's own docs and styles. Follow the review steps: inventory, then propose a plan and show it
> to me before changing anything. Don't touch other products.

## Review log

| Date | Product | Changed | Kept, and why | Commit |
| --- | --- | --- | --- | --- |
| 2026-10-06 | Instrumenta | Launcher rebuilt in v2: icons, type, colour, motion | — | `feat/brand-v2-launcher` |
| 2026-10-06 | Discere | Fonts, accent and book icon copied; Fraunces/Commissioner/Spline roles; extruded buttons; 30 interface icons in the brand style (`apps/web/src/brand`); raised answer choices | Bonehead as companion; course art, diagrams, KaTeX, aurora and dark theme (content or meaning); see Discere `docs/brand/README.md` | uncommitted |
