# Instrumenta production artwork

The launcher uses one transparent RGBA product artwork at `<product>-app-art.png`. The canonical suite
mark is `../instrumenta-mark.png`; Forge3D retains its separately approved production artwork.

## Approved-source workflow

1. Keep the selected ImageGen output unchanged under `../concepts/`.
2. Run `../../scripts/build-approved-brand-assets.py` with the workspace Python environment.
3. The script removes only border-connected charcoal residue, clears the canvas perimeter, resizes with
   high-quality filtering, and validates every output as an RGBA PNG with transparent edges.
4. It publishes the same approved mark into Instrumenta and the relevant application assets. Luna also
   receives a multi-resolution Windows `.ico` file.
5. Run the launcher and application test/build gates before packaging.

Do not regenerate a production mark to perform cleanup: generative edits can change its geometry. Do not
replace these files with simplified vector approximations. Transparent production PNGs are intentional
and allow each host surface to provide its own accessible contrast treatment.

## Current approved sources

- Instrumenta: `../concepts/gateway-round-2026-08-21/02-opening-threshold.png`
- Imago, Ludere, Discere, and Luna: matching files under `../concepts/product-first-2026-08-21/`
- Fabula: `../concepts/product-first-2026-08-21/motus.png`. The mark was approved for Motus and moved
  to Fabula unchanged when Motus was discontinued; the concept keeps its original file name.
- Forge3D: `forge3d-app-art.png`, approved independently and unchanged by this system
- LearnChess: `learnchess-app-art.png`, rendered by `LearnChess/scripts/render-brand-mark.py` and
  copied here unchanged. It has no concept render because it was never generated; re-render it from
  the script rather than editing the PNG.