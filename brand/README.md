# Instrumenta brand system (v2)

Every product is a freestanding object with depth: a flat, friendly drawing of the thing the app is,
standing on its own with no tile behind it. The family resemblance comes from one drawing style,
one depth treatment, one line weight and one colour formula. It does not come from a shared
container. Chosen in October 2026; the reasoning is in `docs/suite/decisions.md` and the three
rounds that led here are in `concepts/`.

| Product | Glyph | Accent |
| --- | --- | --- |
| Instrumenta | an organ, one pipe in each product's colour | brass `#D58E00` |
| Fabula | a clapperboard whose slate holds transcript lines | coral `#ED7088` |
| Imago | a framed picture with a sparkle | teal `#00BCAB` |
| Ludere | a screenplay page | violet `#B583EB` |
| Discere | an open book | blue `#5E9EFD` |
| LearnChess | a rook | green `#47B968` |
| Luna | a crescent moon with a voice | lunar blue `#73A6C4` |
| Forge3D | a cube | ember `#EE7752` |

`tokens.json` holds every value; this table is a summary of it.

## Colour

Every accent has the same OKLCH lightness (0.70) and chroma (0.155); only the hue changes, so no
product reads louder than another. Luna is the one exception, with chroma 0.07, because it is a
monochrome-first app. Each product also has a light tint, a deep shade for the icon's depth, an ink
for lines, and a dark surface. `tokens.json` is generated from the icon library, so the palette and
the icons cannot drift apart; a test checks it.

## Icons

`icons/instrumenta-icons.js` is the only source. It runs in a page (`window.InstrumentaIcons`)
and in Node. `render(id, { size })` returns an SVG built from presentation attributes alone, so it
works under a Content-Security-Policy that forbids inline styles. Three tiers of detail: full
(32 px and up), medium (24 px) and small (16 px), with fewer depth layers, heavier lines and small
details dropped as the size falls.

Motion is `icons/instrumenta-icons.css`. An icon moves while an ancestor has `ii-play`, or while an
`ii-hover` ancestor is hovered or focused, and returns to rest afterwards. Each glyph has its own
movement: the organ's pipes ripple outward, the slate claps, the sparkle twinkles, the lines type,
the page turns, the rook hops, the voice bars pulse and the cube's lid lifts. `prefers-reduced-motion`
stops all of it.

Generated files (never edit them; change the library and rebuild):

```bash
uv run brand/scripts/build-brand.py
```

| Output | Use |
| --- | --- |
| `icons/svg/<id>.svg`, `-24.svg`, `-16.svg` | static icons, tuned per size |
| `icons/svg/<id>-animated.svg` | moves on its own; for READMEs and the web |
| `icons/png/<id>-<size>.png` | 16 to 512 |
| `icons/ico/<id>.ico` | Windows icons, 16 to 256, each size drawn at that size |
| `artwork/<id>-app-art.png` | 1024 launcher tile art for each catalogue product |
| `instrumenta-mark.png`, `../packaging/icon.png` | the launcher's mark (512) and installer icon (1024) |
| `tokens.json` | the palette |

## Type

| Role | Face | Setting |
| --- | --- | --- |
| Display: wordmarks, headings | Fraunces | weight 650 to 700, `"SOFT" 100, "WONK" 1`, optical size to match |
| Interface | Commissioner | `"FLAR" 40` |
| Code, timecodes, FEN, versions | Spline Sans Mono | regular |

All three are variable fonts under the SIL Open Font License, vendored in `fonts/` with their licence
texts (`python3 brand/scripts/vendor-fonts.py` refreshes them). Load `fonts/fonts.css`; never load a
font from a CDN, which the build audit forbids anyway. Fraunces can animate: its soft and wonk axes
make a wordmark loosen and tighten.

Ludere's screenplay page keeps Courier. Only its interface takes the brand faces.

## Adopting the brand

The step-by-step guide for aligning one app, with per-app notes and an opening prompt for a
fresh chat, is [`ALIGNMENT.md`](ALIGNMENT.md).

The launcher uses all of it. Every other product adopts it after its own review against these
guidelines, one product at a time, because a blanket restyle could break an app that has grown
complicated. Until a product's review, it keeps its current look, and its own repository keeps
whatever copy of the v1 art it has.

## The previous brand

Brand v1, the rendered sculptural marks, is in `archive/v1/` with its tokens, prompts and asset
script, along with Luna's 1-bit icon and stylesheet as Luna had them when the change was decided.
None of it ships in the installer (`package.json` excludes `brand/archive`, `brand/concepts` and
`brand/scripts`).
