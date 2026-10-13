# Delineare: proposal and research, round 1

Updated: 2026-10-13. Status: chosen and in development. The owner picked the name Delineare, the
pencil mark, chartreuse (hue 112, the hue furthest from every other accent, in place of the blue
first proposed), direction C ("Plate book"), the restructured curriculum, Delineare's own lessons
only where free material leaves a gap, and no AI critique for now. The decision is recorded in
`docs/suite/decisions.md`; the app lives in its own repository, George-Nizor/Delineare.

Delineare is the proposed ninth Instrumenta product: a learn-to-draw app that sequences a curriculum,
sends the learner to free teaching material hosted by its owners (credited, never copied), and runs
practice sessions on the phone or laptop beside the paper. It will live in its own repository and be
installed and launched by Instrumenta like the other web products.

This folder holds the round 1 proposal (name, colour, mark, three design directions) and the
research that vetted the curriculum handed over on 2026-10-13. The raw research reports are in
[`research/`](research/). The curriculum itself (`curriculum.json`, 125 modules, 323 resources)
came from the handoff zip and is not copied here; it moves into the product repository when that
exists.

## The proposal

Name: Delineare, from the Latin dēlīneō, "to sketch out". Ludere is to play, Discere is to learn,
Delineare is to draw. Its one classical use is Pliny the Elder, Natural History 35.89, on Apelles:
"arrepto carbone extincto e foculo imaginem in pariete delineavit" (he snatched a dead coal from the
brazier and drew a likeness on the wall). Runner-up: Lineola, "a little line". Linea is ruled out
because Linea Sketch is a drawing app; Graphis, Stilus and Videre also collide. App store and
trademark searches could not be run from this session and are still to do (report 07).

Colour: hue 215 in the suite's formula (OKLCH lightness 0.70, chroma 0.155). Accent `#00B5DA`,
light `#88E0F6`, deep `#005A72`, ink `#001A20`. The light tint lands on non-photo blue, the pencil
illustrators use for construction lines, so diagrams can draw their guides in it. Alternatives
shown: chartreuse (hue 112) and orchid (hue 340).

Mark: three drafts drawn in the brand's freestanding style through the real icon library: a pencil
that has just drawn a line (recommended; reads at 16 px), a spiral sketchbook, and an artist's
mannequin. The draft glyph source is `brand/concepts/delineare-2026-10/glyphs.cjs`. Adding a ninth
product gives the organ an eighth pipe.

Design directions, each shown as Today, the module page and the phone session runner, in light and
dark (canvas: https://claude.ai/artifact/5NDr33aWdybyo7C6bwfUhY):

- A. Drafting sheet. An architect's sheet: non-photo blue grid, a title block, the session drawn as
  a scale bar. Light first.
- B. Darkroom. A neutral dark tool where the reference image dominates and recent pages sit in a
  contact strip. Dark first.
- C. Plate book. A printed drawing manual: numbered plates, captions, margin notes and footnoted
  sources, with Newsreader for reading. Light first.

All three keep the reference viewer on a neutral grey surround, because the colour around an image
changes how its values read.

## How the research was done, and its limits

Seven agents ran in parallel: curriculum structure (01), resource verification (02), gaps in thin
modules (03), 3D, pose and perspective tools (04), reference images and art sites (05), pedagogy
and competing products (06), and the name (07).

The environment's network policy blocked page fetches to every outside host except GitHub, and the
agents shared one web search budget, which ran out partway through. So most evidence is search
results, not opened pages, and each report says which. Licences behind anything we would bundle
were read from files on GitHub. A second pass with network access is needed before any resource is
shown to the learner as verified (see "Round 2" below).

## What the research found

### The curriculum's structure works against the goal

The modules are mostly sound; the order is the problem (report 01).

- Followed in phase order, the first module that teaches drawing from imagination through
  construction (`persp-imagination`) arrives after about 680 to 1,660 hours: 4.4 to 10.7 years at
  3 hours a week. Characters, creatures and figures from imagination are all phase 9 stretch work.
  The goal is to draw anything imagined, so this is the critical fault.
- 22 modules sit three or more phases after their prerequisites (head construction, composition,
  the value scale). 11 have no prerequisites at all, so colour and digital would show as available
  on day one.
- Drawabox modules are out of Drawabox's own order (reptiles use its lesson 5 with only "basic
  shapes" as a prerequisite; the 250 box challenge is locked behind ruled two-point perspective).
- Tiers are mislabelled: the essential tier depends on deepening modules, so its real total is
  265 to 642 hours, not the 237 to 572 the app was told to show. It also includes a digital primer,
  paint mixing, charcoal and ink wash.
- About 30 modules duplicate others (four master-copy modules, three thumbnail modules, line weight
  taught three times). Anatomy is one 30 to 80 hour block. 15 done-when checks need another person
  to judge them. Nine modules quietly require Blender.
- The weekly templates cut free play as hours rise (25, 12, then 15 percent) and ignore the phase.

Proposed fix: 96 modules in 10 display groups, scheduled from the prerequisite graph across three
rotating strands, with a 47-module essential spine of about 250 to 520 hours plus ongoing practice
(about 1.4 to 4.7 years at 3 to 5 hours a week). Invention starts in week 1 with a baseline
imagination test repeated at every benchmark; invented objects arrive after about 34 to 72 hours
instead of 680. The full change list (134 changes, machine-readable) is
`research/01-curriculum-structure-changes.json`, and the agent's `proposal.py` checks that every
original module is accounted for.

### How the practice loop should work

From report 06, which is well sourced on the evidence and thin on competing products:

- Accuracy fails mainly in perception, not the hand (Cohen and Bennett 1997; Chamberlain and
  Wagemans 2016). Drills should train looking and checking: measure angles and ratios, short
  segments, frequent glances.
- Drop upside-down drawing as an accuracy method and the right-brain explanation (Cohen and Earls
  2010; Nielsen 2013). Edwards's other exercises can stay.
- Drawing more is not enough; learning techniques is (Chamberlain 2015). Each session names one
  technique and one check.
- A spaced revisit is a 3 to 10 minute cold redraw with the lesson closed, on a new subject, at
  growing intervals (2 days, a week, 3 weeks, 2 months). A module counts as done only when it passes
  on a later day. Never show a review backlog.
- Overlay the reference only after drawing, aligned by tapped landmarks, with errors reported in
  percent and direction by plain code, not a model. Ask for a prediction of where the drawing is off
  before the overlay, and track how often it is right.
- Self-ratings agree weakly with expert ratings. Compute process checks from the log, measure the
  geometric ones, and self-rate only the judgement checks, as "yes", "partly", "not yet" or "can't
  tell". Compare with the reference and his own earlier pages, not polished exemplars.
- Optional AI critique through the user's own Claude Code: on request, after his own ratings,
  grounded in the module's checks and mistakes, returning "can't tell" when it can't, and never
  judging geometry or producing a corrected drawing. No study validating model critique of drawings
  was found.
- No streaks, badges or praise. A 10-minute session for tired days; missed sessions are dropped.

### Resources

- Drawabox (report 02): lessons 0 to 7 and the four challenges have stable URLs; lessons are free to
  read and community critique is free; official critique is paid in Patreon credits. Two catalogue
  entries point at the wrong page. Eight new entries are proposed, still unverified.
- The New Masters Academy free Friday session is gone (now subscriber only), yet it was marked
  verified. PoseMyArt moved to posemy.art. Proko is not uniformly part-free: 38 part free, 7 paid,
  7 free, and 26 single-lesson entries need checking one by one. The verified label's real error
  rate could not be measured without page access; in 23 of 269 verified entries the entry's own notes
  say the page or price was not seen.
- Thin modules (report 03): now reasonably covered are ellipses, still life from life (the open
  textbook "Drawing is Seeing", CC BY-NC-SA), Bargue cast (a free 28-lesson Da Vinci Initiative
  series) and master copies (a Wikimedia Commons Bargue category). Still thin: photo versus life,
  visual memory, object foreshortening, curvilinear perspective, charcoal, portrait likeness, and
  most phase 7 to 9 subjects. Do not link the Internet Archive "Bargue Drawing Course" uploads; they
  scan the 2003 edition with copyrighted text.
- Public domain in both the US and Australia: Bridgman, Vanderpoel, Hatton, Storey, Ruskin, and the
  1911 Lecoq de Boisbaudran translation. Speed is in copyright in Australia until 2028. Do not link
  Loomis or Nicolaides.

### Tools: link, embed or build

From report 04. Link out to Line of Action (the top pick), Quickposes, PoseMyArt, JustSketchMe,
Posemaniacs, Zygote Body's free tier, Croquis Cafe and Handy. Embed only Sketchfab, which has an
official viewer, for head-plane and anatomy models. Build, in three.js and offline:

1. A form viewer with horizon, vanishing points and 1, 2 and 3-point presets.
2. A light-on-form tool: a movable lamp, terminator, reflected light, cast and contact shadows, and a
   2 to 5 value posterise. The design mockups use this tool's renders as their references.
3. A mannequin built from primitives (mannequin.js is GPL-3.0, so write our own).
4. A hand poser, using the MIT-licensed WebXR generic hand model.
5. A head viewer with a planes mode and a Loomis overlay.
6. A seeded random-view drill, plus a printable perspective grid generator and a value checker for
   photos of his drawings.

Safe to bundle, licences read: the WebXR generic hand (MIT), Smithsonian CC0 busts and life masks,
MakeHuman exports (CC0 assets), and Khronos glTF sample assets. Do not bundle Mixamo, Scan the World,
Human Origins scans or Proko files.

### Reference images the viewer may show

From report 05. No key needed and caching allowed: the Met, the Art Institute of Chicago (IIIF,
843 px, one request a second) and Cleveland, each CC0 only when the record says public domain.
Wikimedia Commons works with a per-file licence check. Unsplash, Pexels, Pixabay, Smithsonian,
Europeana and Openverse need the user's own key held by the launcher, each with its own rules
(Unsplash: hotlink only and credit with links; Pixabay: cache 24 hours). No pose site offers an API
or embed, so link out; AdorkaStock is CC BY 3.0, so a hand-picked local pack is allowed. Credit
format: `"{title}" by {creator}, {date} | {source} | {licence}`.

Sites to point learners to, first fifteen: Drawabox, Proko, Ctrl+Paint, Line of Action, Quickposes,
Marco Bucci, Alphonso Dunn, James Gurney, FZD Design Cinema, Aaron Blaise, Love Life Drawing, Watts
Atelier, r/learnart with r/ArtCrit, Urban Sketchers and Inktober.

## Decisions (made 2026-10-13)

1. Name: Delineare.
2. Colour: chartreuse `#A2A700`, hue 112, chosen as the furthest from every other accent.
3. Mark: the pencil.
4. Design direction: C, Plate book.
5. Curriculum: the restructure in report 01 (96 modules, invention from week 1).
6. Lessons: Delineare writes its own only where free material leaves a gap.
7. AI critique: not now; a possible later addition.

## Round 2, once the network allows page access

- Open every resource the learner will see first (the phase 1 to 4 spine) and record what was seen.
- Re-check the Proko, NMA and Drawabox cost labels page by page.
- Finish report 06 part B (Domestika, Skillshare, Schoolism, mobile apps, AI critique tools, reasons
  beginners quit) and the habit and motivation sources it lists.
- App store and trademark searches for the chosen name.
- Fill the remaining thin modules and look for non-English teachers.

## Files

- `research/01-curriculum-structure.md` and `-changes.json`: structure review and change list.
- `research/02-resource-verification.md` and `.json`: Drawabox map, flagged links, label checks.
- `research/03-gap-resources.md` and `.json`: 38 entries for thin modules, public-domain books.
- `research/04-3d-pose-perspective-tools.md` and `.json`: 58 tools with link, embed or build verdicts.
- `research/05-reference-sources-and-art-sites.md` and `.json`: 26 image sources, 63 sites.
- `research/06-pedagogy-and-products.md`: evidence and recommendations for the practice loop.
- `research/07-name-candidates.md`: Latin meanings, collisions and the Pliny passages.
