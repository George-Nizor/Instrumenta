# Decisions

Newest first. Each entry records what was chosen, what was rejected, and why, so that a later
session does not quietly reverse it. Supersede an entry with a new one; never edit an old one.

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
