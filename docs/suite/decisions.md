# Decisions

Newest first. Each entry records what was chosen, what was rejected, and why, so that a later
session does not quietly reverse it. Supersede an entry with a new one; never edit an old one.

## 2026-10-15: Dimensio takes Forge3D's place in the catalogue

**Chosen:** Forge3D becomes Dimensio (Latin, "a measuring", the root of "dimension"), a desktop app
that teaches Blender, with Forge3D's workshop inside it. The plan is `Forge3D/docs/course/PLAN.md`,
which moves with the folder. Its mark is the cube with its width, height and depth measured: an
isometric cube with three double-headed arrows and short extension lines, drawn as ink lines with a
light core like Delineare's line so they read on dark and light grounds. When the icon moves, the
arrows draw in and extend again. It keeps Forge3D's ember (hue 38) with the same tint, deep and ink.
At 24 and 16 px the arrows cannot be read, so the icon library gained `sm`, shapes drawn only at
those sizes, and the glyph is a larger plain cube there.

**Rejected:** filled double arrows, which outweighed the cube's own lines and smudged at 32 to 64 px;
triangle arrowheads, which read as dark wedges on a dark ground; and long extension lines from the
cube's corners, which crowded it. They are in `brand/concepts/dimensio-2026-10/`.

## 2026-10-13 — Delineare: the ninth product, a learn-to-draw app

**Chosen:** the name Delineare (Latin, "to sketch out"; Pliny NH 35.89), the pencil mark, chartreuse
at hue 112 (the hue furthest from every other accent, asked for as such), and design direction C,
"Plate book": a printed drawing manual with numbered plates, captions, margin notes and footnoted
sources, with Newsreader as the lesson face. The curriculum is the restructured one from the round 1
research (96 modules, drawing from imagination from week 1). Delineare writes its own short lessons
only where free material does not cover a topic. AI critique of photographed drawings is left for
later.

**Launcher changes it needs:** Delineare is the one product whose links open in the system browser
(https to a named public host only), its own storage partition, a CSP that admits three museums'
open-access image and search hosts, and a credentialless embedder policy so those images load
without cookies.

**Rejected:** Lineola, and the blue (hue 215), sketchbook and mannequin drafts; directions A
(Drafting sheet) and B (Darkroom). All are in `brand/concepts/delineare-2026-10/`.

## 2026-10-06 — Launcher layout: Console by default, Library as the detailed view

**Chosen:** Console, where one app fills the window with the suite in a dock along the bottom, is
the default. Library (a sidebar of pages: Library, Updates, Storage, Readiness, Journal; the suite
as a list; the app's stage as a side panel) is a toggle for detail, and the launcher remembers which
was last used. Both views draw the same elements, so every action and shortcut works in either.

**Rejected:** keeping the restyled Stage layout, and the Workbench grid. Compared in
`brand/concepts/launcher-layouts-2026-10.html`.

## 2026-10-06 — Brand v2 glyphs chosen; adoption is per product, launcher first

**Chosen:** the organ for Instrumenta (seven pipes in the other products' colours) and the slate for
Fabula (a clapperboard holding transcript lines). The other six glyphs carry over from round 3 of
`brand/concepts/brand-directions-2026-10.html`, to be redrawn properly.

**Adoption:** the Instrumenta launcher takes the new brand in full. Every other product gets its own
review against the guidelines before anything changes, because the apps have grown complicated and
a blanket restyle could break them (Discere especially). No product is restyled until that step is
reached, and Discere is not touched while the owner is working on it.

## 2026-10-06 — Project notes live in the Instrumenta repository

**Chosen:** the cross-project notes (catalogue, backlog, decisions, session log) live in
`Instrumenta/docs/suite/`. The workspace `docs/` folder only points here.

**Rejected:** keeping them in the workspace folder, because that folder is not a Git repository, so
the notes were unversioned and had already drifted from the copy in this folder. Notion, because
no connector was available. It can be added later, with these files as its source.

## 2026-10-06 — Brand v2 will be chosen from a previewed system, not one-off marks

**Chosen:** before any new artwork is made, the owner picks a direction from
`brand/concepts/brand-directions-2026-10.html`. The directions are three complete systems (icon
treatment, motion, typeface, and one shared OKLCH accent set) applied to the same eight glyph
concepts. The current marks and Luna's 1-bit look are archived before they are replaced.

**Why:** the current marks are photoreal renders. They are weak at small sizes and cannot be
animated, and the products' interface fonts have drifted apart. Choosing a system first keeps a
ninth product cheap to add.

**Round 1 feedback (2026-10-06):** rounded tiles look like phone apps, not desktop programs, so no
shared rounded container. Animations and the OKLCH accent set are liked. The type pairings were too
generic. Round 1 is kept as `brand/concepts/brand-directions-2026-10-round1.html`.

**Round 2 (same file and artifact):** five tile-free icon styles (freestanding, pixel, chip,
blueprint, print) and five variable type pairings (Recursive; Anybody + Martian Mono; Syne +
Atkinson Hyperlegible; Fraunces + Commissioner; Tilt Warp + Geologica), all OFL.

**Chosen (2026-10-06):** the freestanding icon style, and Fraunces (display) + Commissioner
(interface) + Spline Sans Mono (code). Two glyphs to redraw first: Fabula's play-button-in-a-bubble
reads as YouTube, and Instrumenta needs a grander mark, since it is the tool that holds the
others. Round 3 of the same artifact offers candidates for both. Round 2 is kept as
`brand/concepts/brand-directions-2026-10-round2.html`.
