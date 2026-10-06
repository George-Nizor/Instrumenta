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
| Fabula | The slate | Two windows' worth of UI: the editor and the Making panel, plus the video look system (themes and fonts that end up *in films*; those are content, not chrome). Already carries the v1 Motus mark. Aligned 2026-10-07 (see review log). | Done |
| Imago | Framed picture with sparkle | Rebuilt as an AI designer on 2026-10-06 and aligned in the same work (see review log). Its composition fonts in `fonts/` are content, for designs, and are not used by the interface. | Done |
| Ludere | Screenplay page | The screenplay page stays Courier. Only the interface around it changes. Aligned 2026-10-06 (see review log). | Done |
| LearnChess | Rook | Already uses Fraunces, with JetBrains Mono for FEN and PGN: the closest to v2 already. Decide whether JetBrains Mono gives way to Spline Sans Mono. Board colours and piece sets are content. Aligned 2026-10-06 (see review log). | Done |
| Luna | Crescent with a voice | Has a deliberate 1-bit, black-and-white UI. It is archived in `brand/archive/v1/luna/` in case the owner wants it back. Biggest visual change of the suite; preview before committing. Its accent is deliberately low-chroma. Aligned 2026-10-06 (see review log): the 1-bit UI is replaced. | Done |
| Forge3D | Cube | Uses Space Grotesk in its Electron desktop, and a 3D viewport whose colours are content. Aligned 2026-10-06, then redone in depth (surfaces, themes, icon set, readiness UX); merged to main. Real Windows run still to verify. | Done |

Every repository's README carries the v2 banner, animated icon and Family footer as of 2026-10-06. `brand/scripts/build-readme-banner.mjs` renders a banner from the brand files; Luna has its own `scripts/brand_banner.cjs`.

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
| 2026-10-06 | Discere | Fonts, accent and book icon copied; Fraunces/Commissioner/Spline roles; extruded buttons; 30 interface icons in the brand style (`apps/web/src/brand`); raised answer choices | Bonehead as companion; course art, diagrams, KaTeX, aurora and dark theme (content or meaning); see Discere `docs/brand/README.md` | Discere 0c1fc62 |
| 2026-10-06 | Imago | Folded into the AI-designer rebuild: brand fonts and `fonts.css`, the imago icons (static and animated SVG, PNGs) and the imago tokens copied into `web/public/brand/`; Discere's icon renderer adapted into `web/src/brand/imago-icons.ts`; accent `#00BCAB` matches the logo; Fraunces, Commissioner and Spline Sans Mono roles; dark and light themes; README and v2 banner (`docs/images/imago-banner.png`, rendered with Imago's own renderer from the brand files); README pass later the same day: the launcher's one-line description, the animated icon (`docs/brand/imago-animated.svg`), the Instrumenta and Bonehead Labs footer with the licence link, and real v2 screenshots of the running app (no face photos; the old mock-mode captures are gone) | The content fonts in `Imago/fonts/` (Anton, Bebas Neue and others) are for the designs Claude makes, never for the interface | uncommitted, `redesign/ai-designer` |
| 2026-10-06 | Ludere | Brand fonts, page icon (inline, turns on hover), violet accent `#B583EB` with deep/tint for contrast in light/dark, dark theme on brand ink and surface, Fraunces headings, Commissioner interface, Spline Sans Mono for numbers and key hints, manifest and theme colours, service worker cache | Courier Prime page and print layout, paper colours, saved beat colour name `plum`; README banner done in the README pass (Ludere `4ab3400`); see Ludere `docs/brand/README.md` | Ludere `855d80e`, `feat/brand-v2` |
| 2026-10-06 | LearnChess | Brand fonts and `fonts.css` copied to `public/fonts/brand/` (replace Google-vendored Fraunces and JetBrains Mono); v2 rook icons, PNG and ICO, launcher art and `InstrumentaIcons` copied to `public/brand/`, rook in the title bar hops on hover; accent `#47B968` from tokens, with `accent-strong` and `focus` (deep in light) for text and rings; Commissioner interface, Fraunces h1/h2 only, Spline Sans Mono for FEN and PGN; v1 3D mark renderer removed; README footer and v2 banner | Board colours and piece sets, tutor avatar and status colours; neutral surface ramps; README screenshots still show the old look; see LearnChess `docs/brand/README.md` | LearnChess `ca91003`, `feat/brand-v2` |
| 2026-10-06 | Forge3D | Brand fonts and `fonts.css` vendored in the Vite bundle (replace Space Grotesk); v2 cube icons, ICO for `Forge3D.exe` (`build.win.icon`), launcher art and `InstrumentaIcons` copied; ember accent `#EE7752` with ink and deep (extruded Run and primary buttons); Fraunces wordmark and panel titles only, Commissioner (FLAR 40) interface, Spline Sans Mono readouts; cube in the title bar (lid lifts on hover and job start) and empty viewport; README banner, icon and Family footer | 3D viewport, splat rendering and wireframe colours (content); neutral graphite surfaces (brand `surface` would tint panels over the viewport); status colours; Windows package build, real Electron and artifact previews not verified; see Forge3D `docs/brand/README.md` | Forge3D merged to main (see `git log`); redone beyond this row: neutral dark/light themes, 36-glyph icon set, readiness card |
| 2026-10-06 | Luna | 1-bit UI replaced: brand fonts and `fonts.css` vendored in `app/static/brand/fonts/`; crescent icons, favicon, launcher art and `InstrumentaIcons` copied (mark in a new top bar, moves while generating or playing); `assets/luna-icon.{ico,png}` keep their paths with v2 art (exe, installer, window icon); lunar accent `#73A6C4` with deep `#20536E` for text and rings in light; opaque ink-outlined extruded objects on family neutrals, dark and light themes with a System/Light/Dark toggle; Fraunces name, titles and Sound history, Commissioner (FLAR 40) in sentence case, Spline Sans Mono for counters, timecodes, sizes and IDs; 20-glyph full-colour icon set (`luna-icons.js`); README v2 banner, animated icon, screenshots and Family footer. The crescent's voice bars gained a light core in the library (Instrumenta `d3f9c64`) so they read on dark | Voice visualiser and waveform shapes (content; recoloured from theme tokens); element IDs and API; installer, uninstall record, DisplayVersion and release manifest; the 1-bit look stays archived; see Luna `docs/brand/README.md` | Luna `f136197` |
| 2026-10-06 | README pass | v2 banner, animated icon, launcher one-liner and Family footer for Instrumenta, Ludere and Discere (the rest were done in their reviews) | Discere's in-app screenshots live in its own docs | Instrumenta `54268fc`, Ludere `4ab3400`, Discere `7b959a2` |
| 2026-10-07 | Fabula | v1 Motus mark replaced by the v2 slate (masthead, empty states, Making panel, favicon, window/taskbar ICO, release bundle, launcher art); brand fonts vendored under chrome-only family names; coral `#ED7088` from tokens with deep/ink/tint for contrast; dark (family neutrals) and light themes with persisted System/Light/Dark and no flash, carried to the title-bar overlay; ink outlines, extrusion, pressed buttons, no glass/glow/gradient/looping motion; Fraunces titles only, Commissioner interface (transcript included), Spline Sans Mono times and sizes; 26-object icon set (`renderer/brand-icons`, hues incl. brick for destructive); slate claps at open, brief, render start/finish, draft; Windows setup window restyled; real-window screenshot harness with contrast and reduced-motion checks; README banner, icon, line, Family; see Fabula `docs/brand/README.md` | Look system, film fonts, painter/overlays, stage field, footage, Look previews (content); guides' fixed colours over footage; dark terminal in both themes; insert marks and timeline glyphs as text; `Fabula.exe`'s embedded icon is still Electron's (needs rcedit on Windows; its windows carry the slate) | Fabula `ca72e8e`, released 0.2.0 |
