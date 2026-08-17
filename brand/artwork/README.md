# Instrumenta app artwork workflow

The launcher is image-first. Each instrument has one text-free square artwork at
`<tool>-app-art.png` and one deterministic SVG mark in the parent `brand/` directory.

## Adding an instrument

1. Start with the prompt template below and use the built-in image generation workflow. Generate
   one instrument per call so each prompt can control its own subject and accent palette.
2. Inspect the result at full size. Reject text, watermarks, weak silhouettes, trademark-like
   shapes, clipped edges, and details that disappear below 240 px.
3. Save the selected RGB PNG here as `<lowercase-id>-app-art.png`. Keep the original square output;
   the launcher performs its own responsive crop and vignette.
4. Draw a simplified companion mark as `brand/<id>-mark.svg`. It should preserve the generated
   concept, not its lighting or texture, and remain readable at 24 px.
5. Add the tool to `electron/workspace.cjs`, `electron/main.cjs`, and the renderer gallery. Add its
   packaged application to `scripts/package-windows.cjs` and its color tokens to `tokens.json`.
6. Verify keyboard launch, ready/missing/busy states, reveal, rebuild, packaged discovery, and the
   reduced-motion presentation.

## Prompt template

```text
Use case: logo-brand
Asset type: production app icon and image-first launcher artwork for the Instrumenta creative toolkit
Primary request: Create an original square visual identity for <NAME>, <PRODUCT PURPOSE>. The central
symbol should <ONE CLEAR METAPHOR>, communicating <TRAITS> without resembling any existing brand.
Scene/backdrop: edge-to-edge muted product colour field, clean and luminous rather than black or ominous
Style/medium: premium modern 2.5D software artwork with matte surfaces, restrained depth, crisp silhouette,
and a quiet Latin-classical geometry detail shared with the other Instrumenta icons
Composition/framing: one centered oversized emblem, generous breathing room, legible at thumbnail size,
safe padding around all edges
Lighting/mood: soft studio lighting, approachable and precise, understated depth
Color palette: one muted product accent, pale limestone, graphite, and one tiny warm highlight
Materials/textures: two or three product-relevant modern materials, almost no visible grain
Constraints: text-free; exactly one emblem; square composition; no letters; no wordmark; no mockup
device; no people; no watermark; no trademark resemblance; no neon; no occult symbols
Avoid: scary, gothic, magical, esoteric, antique ornament, excessive detail, literal clip art
```

## Production prompts used in August 2026 — modern-classical revision

The built-in image generation tool produced the three PNGs in this folder. The product-specific
prompt requests were:

- **Imago:** nested crop frames and a light disc in mineral teal, eucalyptus, limestone, graphite,
  frosted glass, and satin metal.
- **Motus:** three streamlined timeline ribbons forming a play-shaped negative space in coral,
  terracotta, cyan-grey, limestone, and graphite.
- **Ludere:** a folded screenplay page and dialogue lines held by a minimal arch in aubergine,
  dusty lilac, parchment, graphite, and a small brass sun dot.

All three prompts explicitly required a centered text-free emblem, safe padding, a thumbnail-readable
silhouette, no trademark resemblance, no watermark, no occult symbols, no antique ornament, and a
modern OS-quality software finish.
The exact final prompt strings are preserved in `prompts.json`.

## Instrumenta suite mark

The parent toolbar mark used the same built-in image-generation workflow for silhouette exploration,
then was rebuilt as deterministic SVG geometry. Its base and refinement prompts are preserved under
`concepts.instrumenta-mark.svg` in `prompts.json`; the selected source is retained as
`instrumenta-clasp-concept.png`. The production mark is the asymmetric limestone precision clasp and
coral gauge facet in `brand/instrumenta-mark.svg`, mirrored exactly into the packaging icon.
