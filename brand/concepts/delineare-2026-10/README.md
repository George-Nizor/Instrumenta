# Delineare, round 1 concepts

The name, colour, mark and three design directions proposed for the drawing app on 2026-10-13.
The reasoning and the research are in [`docs/suite/delineare/`](../../../docs/suite/delineare/README.md).
The live canvas is https://claude.ai/artifact/5NDr33aWdybyo7C6bwfUhY; `canvas/` holds its artboard
sources as published.

- `glyphs.cjs` draws the three mark drafts (pencil, sketchbook, mannequin) and the eight-pipe organ
  through the real icon library, without changing it. `HUE=215 node glyphs.cjs` writes the SVGs.
  Once a mark is chosen it moves into `brand/icons/instrumenta-icons.js` and the brand is rebuilt.
- `brand-board.png` and `glyphs-with-suite.png` show the proposal and the drafts beside the other
  eight icons.
- The `a-`, `b-` and `c-` screenshots are local renders of the canvas artboards (Today, module page,
  phone session) for directions A (Drafting sheet), B (Darkroom) and C (Plate book). The local
  renders use a fallback serif in place of Newsreader.

The reference images in the mockups are drawn for the mockups (a rendered still life and a lit
sphere plate), and the "last drawing" pages are pencil-style stand-ins, not real drawings.
