# Curriculum structure review

Reviewer pass 01: structure, sequencing, coverage and claims of `data/curriculum.json` (125 modules, 10 phases). Machine-readable changes are in `01-curriculum-structure-changes.json` (134 entries).

## Verdict

The individual modules are mostly sound and well written, but the structure works against George's goal. Read in phase order, the first module that teaches construction-based drawing from imagination (`persp-imagination`) arrives after about 680 to 1,660 hours of study, which is 4.4 to 10.7 years at 3 hours a week. Figures, characters and creatures from imagination all sit in phase 9, mostly as stretch work. Meanwhile the essential tier spends hours on a digital primer, paint mixing, charcoal and ink wash, and two near-identical nature journaling modules. The phase numbers impose a linear order that the dependency graph does not need: 22 modules sit three or more phases after their prerequisites would allow. Several Drawabox-based modules send a beginner to Drawabox lessons 3 to 5 without the lessons that come before them. About 30 modules duplicate others, and anatomy is one 30 to 80 hour block. None of this needs new research. It needs a restructure. I propose 96 modules in 10 phases, three of them new, with a 47-module essential spine of about 250 to 520 gate hours plus ongoing practice. The app should schedule it by rotating strands rather than marching through phases, and it should test drawing from imagination on day one and at every benchmark. At 3 to 5 hours a week that spine takes roughly 1.5 to 5 years, and the app should say so plainly.

## How this review was done, and what was verified

- I read all 125 modules in full (summary, outcomes, practice, done_when, common_mistakes, school references), plus the benchmarks, consensus stages, syllabi, weekly templates, the handoff docs and research note 09. I searched the other research notes for specific evidence.
- I analysed the graph with scripts in `scratchpad/scripts/`: `graph.py`, `extra_checks.py`, `reach.py`, `proposal.py` and `spine_order.py`. Every count and hour figure in this report comes from those scripts. `proposal.py` checks that the proposed structure is a valid DAG, that no prerequisite sits in a later phase and that every one of the 125 original modules is mapped to a new home.
- External sources: WebFetch could not reach any outside host from this environment (drawabox.com failed with a DNS error, and the coordinator confirmed that fetches do not work). I used WebSearch only, and the shared search budget ran out after about 20 queries. I opened no web pages. Every external claim below rests on search-result summaries and the URLs those results showed, so treat them as "found by search, not opened". When I rely on the project's own research notes, which did open pages, I say "project notes". When I rely on my own knowledge, I say so.
- Not checked at all, because the search budget ran out: Kim Jung Gi's practice, Central Saint Martins foundation, Schoolism, Pixar in a Box beyond the project notes, the order of Betty Edwards's book, the order of Lecoq de Boisbaudran's exercises, Glenn Vilppu, RISD beyond the project notes, and evidence on the left-brain/right-brain myth.

## Findings ranked by severity

### 1. Critical: drawing from imagination comes too late for the stated goal

Modules: `persp-imagination`, `fig-imagination-visual-library`, `des-character-design-process`, `des-creature-monster-design`, `nat-creature-design-invented-animals`, `light-invented-light`, `des-visual-development-workflow`, and the play track (`des-ideation-sketching`, `des-prompt-challenges`, `des-surreal-ideation`, `des-reference-visual-library`).

What is wrong:
- `persp-imagination` (stretch, phase 9, 30 to 100 h) requires `persp-intuitive`, `persp-construct-primitives` and `persp-measure-scale`. Its own prerequisite closure is 114 to 316 h, but read in phase order it comes after 679 to 1,664 h of non-optional modules.
- `fig-imagination-visual-library` (stretch, phase 9) requires the whole 30 to 80 h anatomy module, hands, feet and stretch-tier figure foreshortening. Its closure is 129 to 352 h, and in phase order it comes after 669 to 1,624 h.
- Character design, creature design and visual development all sit in phase 9. The essential tier contains one phase 9 module (`des-shape-language-silhouette`) and no character, creature or environment design.
- The early play track is chance- and prompt-based (exquisite corpse, ink blots, random words). That is good for fluency, but nothing asks him to build an invented object, figure or animal in 3D until phase 9.
- `persp-imagination` lists as a common mistake: "Starting from imagination before the construction skills are steady". That is folk wisdom presented as fact, and it contradicts the programmes below.

Evidence:
- Drawabox's 50% rule splits drawing time in half: lessons and exercises, and drawing for its own sake. Search summaries say the rule applies from the start and does not depend on prior skill (https://drawabox.com/lesson/0/5, found by search).
- Proko's own outline of Figure Drawing Fundamentals describes mannequinization as a way to build volume and invent poses, inside the fundamentals course (https://proko.com/course/figure-drawing-fundamentals, found by search).
- Scott Robertson's How to Draw is subtitled "drawing and sketching objects and environments from your imagination". Booksellers describe it as starting from basic perspective, grids and ellipses (https://designstudiopress.com/product/how-to-draw and https://www.abebooks.com/Draw-Drawing-Sketching-Objects-Environments-Imagination/30823955047/bd, found by search). In that book, perspective construction is the method for imagination, not a precondition that comes years earlier.
- A search summary of a scan of Nicolaides's The Natural Way to Draw mentions a note to do the daily composition every day (catalogue entry: https://www.librarything.com/work/66342). The scan's rights are unclear and I would not link it in the app.
- The project's own data counts against its own inference. Research note 09 concluded that invention "comes after the skills, not before". But RMIT's VART6406C (in `syllabi`, opened by the earlier pass) puts thumbnails and concept sketching in weeks 2 to 9, alongside line and shape.
- Peter Han's CGMA sketching mentorship page describes teaching sketching from imagination together with how to use observation and reference (https://cgmasteracademy.com/courses/131-sketching-mentorship-with-peter-han.html, found by search). The same page carries a notice that CGMA has a dissolution filing before the court and has paused operations. The data has no CGMA resources, so no action is needed, but none should be added.

Fix:
- Split `persp-imagination` into `invent-objects-1` (phase 3, essential, after box basics and freehand ellipses) and `invent-objects-2` (phase 4, essential, after construction). Fold its library-building practice into `des-reference-visual-library` as an ongoing cycle: collect, study, recall, check.
- Split `fig-imagination-visual-library` into `figures-from-imagination-1` (phase 5, essential, straight after simplified construction and the gesture ladder) and `figures-from-imagination-2` (phase 9, deepening, after anatomy).
- Make `light-invented-light` essential, requiring only `light-form-on-basic-forms` and `invent-objects-1`.
- Add `baseline-imagination-check` in phase 1: the same ten prompts drawn from imagination, repeated at every benchmark. The prompts are a person running, a dog, a chair, a car, a tree, a room, a street corner, a hand holding a cup, a face looking up, and an invented creature. The gallery then shows the goal skill directly.
- Rewrite the mistake to: "Waiting until construction feels steady before drawing from imagination; draw from imagination every week, then check against reference."

### 2. High: phase order delays modules whose prerequisites are met early

What is wrong:
- 22 modules sit three or more phases after the latest phase of their prerequisites.
  - `fig-head-construction` has only `found-basic-shapes` (phase 2) as a prerequisite but is placed in phase 6. Read in phase order, it comes after 304 to 739 h.
  - `des-composition-fundamentals` has no prerequisites but is placed in phase 8 (541 to 1,317 h in phase order).
  - `col-color-theory-basics` has no prerequisites but is placed in phase 10.
  - `light-values-squint` is in phase 5, although `obs-thumbnails-essentials` in phase 3 already asks for three-value thumbnails.
  - `nat-plants-flowers-trees`, `nat-insects-arachnids`, `nat-birds` and `nat-reptiles-amphibians-fish` are in phase 7, but their prerequisites are phase 2 modules.
- In the other direction, 11 modules have no prerequisites at all, including `col-digital-primer`, `col-color-theory-basics`, `des-composition-fundamentals` and `nat-field-sketching-habit`. The planned Path screen shows "available now" from prerequisites, so on day one it would offer colour theory, a digital primer, composition and nature journaling next to line control. That is the catalogue problem the user already rejected.

Evidence:
- Watts Atelier's learning path, as summarised by search, runs Drawing Fundamentals phases I and II, then Head Drawing Fundamentals, then Figure Drawing Fundamentals. The school says each phase takes about a month (https://www.wattsatelier.com/?p=139427 and https://wattsatelier.com/, found by search). So head work starts within months, and before the figure.
- Ctrl+Paint's library is ordered for total beginners: Traditional Drawing is section 2 and Composition Basics is section 4, both before any digital painting (https://ctrlpaint.com/library, found by search).
- Project data: Clark College's 8-week beginner class reaches portraits in week 7. San Jose State covers composition and positive and negative space in weeks 3 to 4.

Fix:
- Treat phases as display groups, not gates. Pick the next module from the DAG by rotating three strands: form and perspective; observation, figure and head; invention and design.
- Move head construction to the new phase 5, beside figure construction.
- Move composition and thumbnails, and the value scale, to phase 3.
- Make colour theory require `light-values-squint` and `light-form-on-basic-forms`.
- Give every root module at least one prerequisite, except setup, the baseline check and seeing-and-contour.

### 3. High: Drawabox-based modules are out of Drawabox's own order

What is wrong:
- `nat-reptiles-amphibians-fish` uses Drawabox Lesson 5 (animals) as its core resource, but its only prerequisite is `found-basic-shapes`.
- `nat-insects-arachnids` (Lesson 4 as an alternative resource) and `nat-birds` also need only `found-basic-shapes`.
- `nat-plants-flowers-trees` (Lesson 3 as an alternative resource) needs only line control and basic shapes.
- `persp-intuitive`'s core resource is the 250 Box Challenge, yet it requires one-point, two-point and ellipses in perspective. Drawabox runs the challenge straight after Lesson 1, with no ruled perspective.
- `persp-construct-primitives` uses Drawabox Lesson 2 as its core resource, but it is locked behind ruled two-point perspective and ellipses in perspective.
- No module covers organic forms with contour lines. Plants, insects, animals and the figure all build on them.

Evidence (search only):
- Lesson 1 is "Lines, Ellipses and Boxes" (https://drawabox.com/community/submission/PHBH7X38).
- Lesson 4 is "Applying Construction to Insects and Arachnids", and it moves from flowing flat shapes to constructed solid forms (https://drawabox.com/lesson/4).
- The 25 Wheel Challenge page says to do it after Lesson 6 and the cylinder challenge, and before Lesson 7 (https://www.drawabox.com/lesson/25wheels).
- A critique of a cylinder challenge submission tells the student to move on to Lesson 6 (https://drawabox.com/community/submission/7KT3QZY7).
- One search result is titled "Drawabox Lesson 2, Exercise 2: Organic Forms with Contour Lines".
- The rest of the lesson list (3 plants, 5 animals, 6 everyday objects, 7 vehicles) matches the curriculum's own resource titles and my own knowledge, but search did not confirm it directly. All Drawabox entries should stay marked unverified, as they are now.

Fix:
- Add `organic-forms-contours` in phase 4, mapped to the organic-forms and intersection work of Lesson 2. Make it a prerequisite for plants, insects, birds, reptiles and fish, and for figure construction. Mammals inherit it through `persp-construct-primitives`.
- `persp-intuitive` requires only `persp-box-basics` and is marked ongoing.
- `persp-construct-primitives` requires `organic-forms-contours`, `persp-two-point` and `persp-ellipses-cylinders`.
- Insects also require `persp-construct-primitives`.

### 4. High: tier labels fit neither the goal nor the person

Essential, but not essential for a paper-first learner aiming at invention:
- `col-digital-primer` and `col-digital-brushes-layers`.
- `col-color-mixing-limited-palettes` (traditional paint).
- `light-media` (charcoal and ink wash, thin free coverage).
- `nat-food-organic-still-life` (thin free coverage).
- Both `nat-field-sketching-habit` and `obs-nature-study-journaling`.

Not essential, but central to "draw anything I imagine":
- `persp-imagination` and `fig-imagination-visual-library` (stretch).
- `light-invented-light` (optional).
- `nat-hard-surface-vehicles-machines` (optional, although vehicles are Drawabox Lesson 7).
- `nat-creature-design-invented-animals` (stretch).
- `obs-visual-memory` (deepening).
- `persp-construct-primitives` and `persp-ellipses-cylinders` (deepening).

Tier inversions: `obs-thumbnails-essentials` (essential) depends on `obs-block-in` (deepening), and `nat-everyday-objects` (essential) depends on `persp-construct-primitives` and `persp-ellipses-cylinders` (deepening). With all prerequisites included, the essential tier is really 49 modules and 265 to 642 hours, not the 46 modules and 237 to 572 hours the handoff tells the product to display.

Track and ongoing flags are also off:
- Only four modules are tagged "play", all in phase 2. Creature design, character design and surreal work are never tagged as invention.
- Only four modules are flagged ongoing. In practice the gesture ladder, the box challenge, prompt challenges, memory drawing and master copies are all ongoing too.

Fix: see the `retier` and `rehours` entries in the change list.

### 5. High for an app: about 30 modules duplicate others

These overlap groups (with the module that should absorb them) all came from reading the full module text:

| Overlapping modules | Absorbing module |
|---|---|
| `found-materials-setup`, `found-posture-grip`, `found-warmups` | `start-kit-posture-warmup` |
| `found-sketchbook-habits` | `found-practice-method` (thumbnails go to composition, draw-100 to ideation) |
| `obs-seeing-vs-symbols`, `obs-contour-blind-contour` | `obs-seeing-and-contour` (blind contour also repeats in warm-ups and line weight) |
| `des-ideation-sketching`, `des-prompt-challenges` | `des-ideation-and-prompts` |
| `obs-negative-space`, `obs-comparative-measuring` | `obs-measuring` |
| `found-self-assessment`, `obs-self-critique-error-log`, the checks in `obs-sight-size-and-checks` | `check-your-drawing` (flip, overlay and grid are taught three times) |
| `obs-thumbnails-essentials`, `des-thumbnailing`, `des-composition-fundamentals` | `composition-and-thumbnails` |
| `persp-depth-cues`, `des-depth-overlap-atmosphere` | `persp-depth-cues` (same overlap and atmosphere ladders) |
| `persp-shadows`, `light-cast-shadows-ao` | `cast-shadows` |
| `persp-foreshortening`, `fig-foreshortening-perspective` | `foreshortening` |
| `obs-master-copies-bargue`, `light-bargue-cast`, `fig-master-studies`, `col-color-studies-master-copies` (four master-copy modules) | an ongoing `master-copies` module plus an optional atelier module |
| `found-line-weight`, `light-line-weight-inking`, `col-inking-line-art` (line weight taught three times) | keep `found-line-weight`; the other two become `inking-line-art` |
| `nat-field-sketching-habit`, `obs-nature-study-journaling` | `nature-journaling` |
| `obs-quick-location-sketching`, `nat-streets-cities-urban-clutter` | `location-and-street-sketching` |
| `des-creature-monster-design`, `nat-creature-design-invented-animals` | `creature-design` |
| `nat-texture-fur-feather-scale` | `light-materials-textures` |
| `found-digital-setup`, `col-digital-primer`, `col-digital-brushes-layers` | `digital-setup-basics` |
| `light-media` plus seven `col-trad-*` primers | one optional `media-sampler` |
| `nat-food-organic-still-life`, `obs-photo-vs-life` | the two still-life modules |
| `fig-hair` | head features |
| `persp-slopes` | architecture |
| `nat-foliage-trees-in-landscape` | landscape |

The design research pass (note 07) had already flagged several of these overlaps for the merger, and they were not merged.

Fix: go from 125 to 96 modules: 57 modules fold into 25 combined modules, 3 are split, and 3 are new. The bigger UI fix is to show one next module per strand, never the catalogue.

### 6. Medium-high: anatomy is one 30 to 80 hour module that gates figure invention

What is wrong:
- `fig-anatomy-skeleton-muscle` uses Proko's Anatomy of the Human Body as its core resource. Search shows that course split into Torso (163 lessons), Arms (101) and Legs (107), 371 lessons in all (https://www.proko.com/course/anatomy-of-the-human-body/lessons, https://www.proko.com/course-lesson/how-to-draw-the-spine and https://conceptartempire.com/proko-human-anatomy-course-review/, found by search). The data says 115 of them are free.
- At 3 hours a week, this one module is a 10 to 27 week block with a single set of checks, and it gates `fig-imagination-visual-library`.
- My judgement: 30 to 80 hours is low if he works through the whole course and draws along. It is fine for a simplified pass.

Fix: split it into `anatomy-torso`, `anatomy-arms-hands` and `anatomy-legs-feet` (all deepening), each with its own done_when, and let figure invention start before any of them.

### 7. Medium: the hour estimates and how they are presented

What is wrong:
- The handoff's totals are plain sums of researcher estimates.
- Spot checks:
  - Drawabox community posts found by search report 7 to 15 minutes per box and one to four months to finish the 250 Box Challenge (for example https://drawabox.com/community/submission/76M5L4NX and https://drawabox.com/community/submission/NH96MA8R/). That is roughly 30 to 60 hours for the boxes alone. `persp-intuitive`'s 20 to 60 hours is close, but the lower bound is low.
  - Proko's Figure Drawing Fundamentals is listed at 57 lessons and about 16 hours 45 minutes of video (found by search). The curriculum's gesture and construction hours look plausible against that.
- Ongoing modules (sketchbook habit, life drawing routine, nature journaling, box challenge, gesture ladder, prompt challenges) are added up as if they were sequential lessons. That inflates the "time to next phase" figure and hides the real gate.
- In phase order at 3 hours a week:
  - the perspective benchmark (end of phase 4) comes after 226 to 567 core hours, which is 1.4 to 3.6 years
  - the figure benchmark comes after 440 to 1,107 hours (2.8 to 7.1 years)
  - the whole core path (876 to 2,162 hours) takes 5.6 to 13.9 years, or 3.4 to 8.3 years at 5 hours a week.
- As a total for "draw anything", this is credible in my judgement. It is about one to two years of full-time atelier study; the project data has the Florence Academy foundation at about 28 studio hours a week for three trimesters. But the gaps between visible milestones are far too long for someone who has already quit streak systems.

Fix:
- Store and show two numbers per module: gate hours (the lesson plus the drills needed to pass the check) and ongoing practice.
- Show spine hours and the time to the next benchmark at his own weekly rate, rather than one large total.
- Retune `persp-intuitive` to a 4 to 8 hour gate plus 30 to 60 hours of ongoing practice.

### 8. Medium: many done_when checks and benchmarks cannot be self-assessed by a solo learner

What is wrong:
- 15 done_when lines need another person. Examples:
  - `fig-portrait-likeness`: "A friend can recognise the subject"
  - `des-shape-language-silhouette`: "a stranger can tell your characters apart"
  - `des-visual-storytelling`: "understood by a stranger without words"
  - `light-materials-textures`: "A viewer can name the material"
- Several checks demand streaks or heavy logging, which conflicts with the brief:
  - `found-sketchbook-habits`: "at least 10 of 14 days"
  - `found-practice-method`: "three weeks in a row"
  - `found-warmups`: "three sessions a week for two weeks"
  - `fig-timed-gesture-progression`: "12 sessions with a written review for each"
  - `fig-life-drawing-session-routine`: "12 full sessions with reviews"
  - `obs-self-critique-error-log`: "ten entries with numbers"
  - the phase 2 benchmark: "regular sessions over the last six weeks"
- Some checks are vague:
  - `fig-head-construction`: "You can draw a believable head from imagination"
  - `persp-intuitive`: "Most freehand boxes need only small corrections"
  - `persp-three-point`: "a plausible bird's-eye block"
  - `fig-dynamic-poses-interaction`: "Your silhouettes are readable"
  - `nat-texture-fur-feather-scale`: "Fur reads as clumps"
  - `fig-anatomy-skeleton-muscle`: "use anatomy notes to explain, not to decorate"
  - `col-style-development`: "I know when a piece I made is too close"
- Benchmark problems:
  - There is no benchmark after phase 8.
  - Nothing tracks drawing from imagination over time (only the phase 4 and phase 9 tasks touch it).
  - "Within about a thumb-width" has no scale.
  - "Darkest darks and lightest lights are not used until the end" describes a process step and cannot be seen in the finished drawing.
- Good checks worth copying:
  - `found-line-control`: 7 of 10 lines land on both dots
  - `obs-comparative-measuring`: ratios within about a tenth
  - `light-values-squint`: nine-step scale checked by phone greyscale
  - the overlay checks

Fix:
- Write every check as a test on one photographed page, with a number or a yes/no answer, that he can do alone. Keep "show someone" as an option.
- Replace streak conditions with totals, for example "20 dated pages" instead of "10 of 14 days".
- Add the baseline imagination prompts to every benchmark.
- Give tolerances in page units, for example "within 1 cm on A4".

### 9. Medium: hidden software prerequisites

What is wrong:
- Nine modules ask for Blender work, and no module teaches Blender: `persp-construct-primitives`, `persp-intuitive`, `persp-shadows`, `persp-slopes`, `light-basic-forms`, `light-direction-types`, `light-cast-shadows-ao`, `light-invented-light` and `persp-imagination`. This is in a curriculum where digital setup is optional and the learner draws on paper.
- Krita appears in `obs-sight-size-and-checks` and `persp-horizon-vps` with paper alternatives, which is fine.

Fix: add an optional `simple-3d-blockout` module (Blender or a free posable figure tool) and label every Blender practice item as an alternative. No done_when should depend on it.

### 10. Medium: the weekly templates

What is wrong:
- The share of free play falls as hours rise: 45 of 180 minutes (25 percent) in the 3-hour plan, 45 of 360 (12 percent) in the 6-hour plan, and 90 of 600 (15 percent) in the 10-hour plan. Drawabox's rule is half. For a goal of drawing from imagination, this is backwards.
- The templates are fixed whatever the phase: a 60-minute museum master copy every Saturday and an overlay accuracy session every Friday, from week one.
- The 3-hour plan gives the current module about 2 hours a week (Monday's 20-minute exercise, Saturday's 60 minutes and part of Wednesday). At that rate, phase 2 alone (67 to 188 hours, partly ongoing) takes most of a year.
- The 3-hour plan itself is realistic for an adult with a full-time job and training on two evenings. I would keep it as the default.

Fix: use one template shape that scales with hours.
- About 60 to 70 percent on the current spine modules and their ongoing drills (box sets as warm-ups, the gesture ladder, a memory redraw).
- About 30 to 40 percent on invention tied to the current module: draw from imagination what was just learnt, then check it against reference.
- One free session.
- The app fills sessions from his current modules instead of fixed weekday topics.

### 11. Medium-low: claims and common_mistakes that need correcting

- The `persp-imagination` mistake (see finding 1).
- `found-ellipses`:
  - Its done_when says "Most of your freehand ellipses close cleanly after one committed pass", but its core resource is Drawabox Lesson 1. I recall, but did not verify here, that Drawabox asks students to draw through each ellipse two or three times. Check by hand, and if so, reword the check to match.
  - It also contains an "ellipse in a perspective square" exercise before any perspective has been taught, and its ellipse tables are repeated in `persp-ellipses-cylinders`.
- `fig-head-construction`: the mistake "Drawing an egg instead of a ball with planes cut off" is only true for the Loomis method, while the module also teaches Reilly and block-head methods. Scope it to Loomis.
- `light-form-anatomy`: the done_when "treat the terminator as a soft band, not a line" is over-general, because under a small hard lamp the terminator is narrow. Reword it to "match the terminator's softness to the size of the light" (my judgement).
- Left brain and right brain: I searched the data and it makes no left-brain/right-brain claims. "Drawing on the Right Side of the Brain" appears only as a provider label, which is the book's title. Own lesson notes should keep the upside-down and vase-faces exercises without the hemisphere explanation. From background knowledge, not verified in this session, imaging research does not support a left/right brain personality split.
- `obs-sight-size-and-checks` is core and deepening, but sight-size needs the subject 2 to 3 m away beside an upright board, which does not work at a home table. Make it optional, inside the atelier module.

### 12. Medium-low: missing topics

- Organic forms with contour lines (Drawabox Lesson 2): add `organic-forms-contours`.
- A repeated test of drawing from imagination: add `baseline-imagination-check`.
- Simple 3D tools: add `simple-3d-blockout` as optional.
- Memory drawing is present but deepening and placed in phase 3. Move it to phase 2, make it essential and ongoing. The project notes cite Lecoq de Boisbaudran's book on memory training as a public-domain scan on the Internet Archive.
- Location sketching, as a way to build the visual library from life, should open from phase 3 rather than phase 8. I could not check sources on Kim Jung Gi's practice.
- Vehicles move from optional to deepening.
- Hands get an essential light pass in phase 5, with depth later in `anatomy-arms-hands`.
- Lettering and comic page craft are covered only by one exercise inside `des-visual-storytelling`. That is acceptable for now; add one practice item on panel lettering.
- Film stills appear as practice in the composition and depth modules. Keep them as an ongoing option under `composition-and-thumbnails`.

## Proposed revised phase structure

The phases are display groups. Scheduling follows the prerequisite graph, rotating three strands. "Spine" marks the essential spine. Hours are gate hours: my estimates, adjusted from the originals. Every original module id is accounted for (`proposal.py` checks this).

| Phase | Modules | Total gate hours | Spine |
|---|---|---|---|
| 1. Start drawing | 3 | 6 to 13 | all |
| 2. Line, form and looking | 11 | 29 to 59 | 10 |
| 3. Boxes, measuring and first inventions | 13 | 82 to 216 | 9 |
| 4. Perspective and construction | 13 | 84 to 179 | 8 |
| 5. Figure and head | 16 | 126 to 299 | 8 |
| 6. Light, value and form | 9 | 56 to 120 | 3 |
| 7. Animals, nature and machines | 8 | 67 to 143 | 1 |
| 8. Places and stories | 6 | 70 to 158 | 2 |
| 9. Characters, creatures and finished pieces | 8 | 83 to 201 | 2 |
| 10. Colour and media (a branch) | 9 | 65 to 158 | 1 |

Phase 1. Start drawing (weeks 1 to 2):
- `start-kit-posture-warmup` (merges materials, posture and warm-ups; spine)
- `found-practice-method` (absorbs sketchbook habits; spine)
- `baseline-imagination-check` (new; spine)

Phase 2. Line, form and looking:
- `found-line-control` (spine)
- `found-ellipses` (freehand only; spine)
- `found-basic-shapes` (adds overlap and cross-contours; spine)
- `obs-seeing-and-contour` (merge; spine)
- `found-line-weight` (deepening)
- `fig-gesture-line-of-action` (spine)
- `fig-timed-gesture-progression` (ongoing; spine)
- `obs-visual-memory` (moved from phase 3, now essential and ongoing; spine)
- `des-ideation-and-prompts` (merge, play, ongoing; spine)
- `des-surreal-ideation` (play, ongoing; spine)
- `des-reference-visual-library` (rewritten as the ongoing visual library cycle; spine)

Phase 3. Boxes, measuring and first inventions:
- `persp-box-basics` (spine)
- `persp-intuitive` (the freehand box challenge, ongoing, now essential; spine)
- `invent-objects-1` (from the split of `persp-imagination`; spine)
- `obs-measuring` (merge; spine)
- `obs-block-in` (now essential; spine)
- `obs-still-life-from-life` (absorbs photo-vs-life and food still life; spine)
- `check-your-drawing` (merge; spine)
- `light-values-squint` (moved from phase 5; spine)
- `composition-and-thumbnails` (merge, moved from phase 8; spine)
- `found-critique-feedback` (deepening)
- `master-copies` (merge, ongoing, deepening)
- `nature-journaling` (merge, ongoing, deepening)
- `atelier-bargue-cast-sight-size` (merge, optional)

Phase 4. Perspective and construction:
- `persp-horizon-one-point` (merge; spine)
- `persp-two-point` (spine)
- `persp-ellipses-cylinders` (now essential; spine)
- `organic-forms-contours` (new; spine)
- `persp-construct-primitives` (now essential; spine)
- `persp-depth-cues` (absorbs `des-depth-overlap-atmosphere`; spine)
- `nat-everyday-objects` (moved from phase 7; spine)
- `invent-objects-2` (spine)
- `persp-measure-scale` (deepening)
- `persp-three-point` (deepening)
- `simple-3d-blockout` (new, deepening)
- `persp-parallel-projection` (optional)
- `persp-curvilinear` (optional)

Phase 5. Figure and head:
- `fig-simplified-construction` (spine)
- `fig-proportion-systems-variation` (now essential; spine)
- `figures-from-imagination-1` (split; spine)
- `fig-head-construction` (moved from phase 6; spine)
- `fig-features-expression-hair` (merge, now essential; spine)
- `fig-hands` (now essential; spine)
- `fig-clothing-drapery` (now essential; spine)
- `des-shape-language-silhouette` (moved from phase 9; spine)
- `fig-feet` (deepening)
- `anatomy-torso`, `anatomy-arms-hands`, `anatomy-legs-feet` (split; deepening)
- `foreshortening` (merge; deepening)
- `fig-dynamic-poses-interaction` (deepening)
- `fig-life-drawing-session-routine` (ongoing; deepening)
- `fig-portrait-likeness` (deepening)

Phase 6. Light, value and form:
- `light-form-on-basic-forms` (merge; spine)
- `light-techniques` (graphite and pen only; spine)
- `light-invented-light` (now essential, renamed "Shading things you invented"; spine)
- `light-edges` (deepening)
- `light-value-composition` (deepening)
- `light-direction-types` (deepening)
- `cast-shadows` (merge; deepening)
- `light-materials-textures` (absorbs fur, feather and scale; deepening)
- `light-still-life-render` (stretch)

Phase 7. Animals, nature and machines, in Drawabox's lesson 3 to 7 order:
- `nat-plants-flowers-trees` (deepening)
- `nat-insects-arachnids` (deepening)
- `nat-birds` (deepening)
- `nat-reptiles-amphibians-fish` (deepening)
- `nat-mammal-anatomy-construction` (now essential; spine)
- `nat-animal-gesture-locomotion-expression` (deepening)
- `nat-hard-surface-vehicles-machines` (now deepening)
- `nat-patterns-ornament-surface-detail` (optional)

Phase 8. Places and stories:
- `des-environment-scene-building` (now essential; spine)
- `des-visual-storytelling` (now essential; spine)
- `landscape-elements-and-trees` (merge; deepening)
- `architecture-and-slopes` (merge; deepening)
- `location-and-street-sketching` (merge, ongoing, unlocks after phase 3 modules; deepening)
- `persp-scene-capstone` (stretch)

Phase 9. Characters, creatures and finished pieces:
- `des-character-design-process` (now essential; spine)
- `creature-design` (merge; spine)
- `des-costume-props-accessories` (deepening)
- `des-expression-acting` (deepening)
- `des-cartooning-stylisation-caricature` (deepening)
- `figures-from-imagination-2` (split; deepening)
- `col-style-development` (moved from phase 10; deepening)
- `des-visual-development-workflow` (stretch)

Phase 10. Colour and media, a branch that opens after the phase 6 essentials:
- `col-color-theory-basics` (spine)
- `col-color-mixing-limited-palettes` (now deepening)
- `col-color-light-shadow` (deepening)
- `col-color-script-mood` (stretch)
- `col-digital-painting-fundamentals` (deepening)
- `inking-line-art` (merge, paper first; deepening)
- `col-finishing-portfolio` (deepening)
- `digital-setup-basics` (merge; optional)
- `media-sampler` (merge of `light-media` and the seven primers; optional)

Totals for the proposed structure: 96 modules. Non-optional modules come to 622 to 1,390 gate hours, and all modules to 668 to 1,546. Ongoing practice is counted separately.

How long until key goal modules unlock (prerequisite closure, original versus proposed):

| Goal module | Original | Proposed |
|---|---|---|
| First invention from construction | `persp-imagination`, 114 to 316 h (phase-ordered 679 to 1,664) | `invent-objects-1`, 34 to 72 h |
| Figures from imagination | 129 to 352 h (phase-ordered 669 to 1,624) | 52 to 110 h |
| Composition | phase 8 (phase-ordered 541 to 1,317 h) | phase 3 (25 to 50 h closure) |

## Essential spine

The spine has 47 modules: about 250 to 520 gate hours, plus 75 to 190 hours of ongoing practice spread over the same weeks. The ongoing practice is the box challenge, the gesture ladder, memory redraws and invention play. The order below is a valid topological order, interleaved across strands (checked by `spine_order.py`).

The week figures assume about 70 percent of weekly time goes to spine modules and 30 percent to ongoing practice and free play. All of them are estimates.

Block A, first marks, looking and play. 13 modules, 32 to 66 h. Done by about week 15 to 31 at 3 h a week, or week 9 to 19 at 5 h a week.
- `start-kit-posture-warmup`, `baseline-imagination-check`, `found-practice-method`
- `found-line-control`, `obs-seeing-and-contour`, `fig-gesture-line-of-action`, `des-ideation-and-prompts`
- `found-ellipses`, `fig-timed-gesture-progression`, `found-basic-shapes`
- `obs-visual-memory`, `des-surreal-ideation`, `des-reference-visual-library`
- Then benchmark 1: line, gesture, contour, a memory redraw, and the baseline imagination set again.

Block B, boxes, measuring and first inventions. 9 modules, 46 to 98 h. Cumulative 78 to 164 h, done by about week 37 to 78 at 3 h a week, or week 22 to 47 at 5 h a week.
- `persp-box-basics`, `persp-intuitive` (ongoing from here), `invent-objects-1`
- `obs-measuring`, `light-values-squint`, `obs-block-in`
- `composition-and-thumbnails`, `check-your-drawing`, `obs-still-life-from-life`
- Then benchmark 2: an overlay still-life test, one invented object from three viewpoints, and the imagination set.

Block C, construction, figure and head. 16 modules, 108 to 223 h. Cumulative 186 to 387 h, done by about week 89 to 184 at 3 h a week, or week 53 to 111 at 5 h a week.
- `organic-forms-contours`, `fig-simplified-construction`, `figures-from-imagination-1`, `des-shape-language-silhouette`, `fig-head-construction`
- `persp-horizon-one-point`, `persp-two-point`, `persp-ellipses-cylinders`, `fig-proportion-systems-variation`, `persp-construct-primitives`
- `fig-features-expression-hair`, `persp-depth-cues`, `fig-hands`, `nat-everyday-objects`, `invent-objects-2`, `fig-clothing-drapery`
- Then benchmark 3: a perspective room with invented objects, a mannequin figure from imagination from three views, a constructed head at six angles, and the imagination set.

Block D, light, animals, places and characters. 9 modules, 65 to 130 h. Cumulative 251 to 517 h, done by about week 120 to 246 at 3 h a week (2.3 to 4.7 years), or week 72 to 148 at 5 h a week (1.4 to 2.8 years).
- `light-form-on-basic-forms`, `light-techniques`, `light-invented-light`
- `nat-mammal-anatomy-construction`, `des-environment-scene-building`, `des-visual-storytelling`
- `des-character-design-process`, `creature-design`, `col-color-theory-basics`
- Then benchmark 4: from one brief, a character turnaround, a creature, and a place with figures at consistent scale; plus the imagination set.

What he gets early on this spine:
- He draws from imagination in week 1 (the baseline set) and every week after that, through the play strand and memory redraws.
- Structured invention of objects arrives in block B, and invented figures early in block C.

Weekly shape at 3 hours:
- Two 30-minute sessions on the current module, each with a 5-minute warm-up drawn from the ongoing drills.
- One 75-minute session that applies the module, then draws the same thing from imagination and checks it against reference.
- One 45-minute free invention session.
- At 5 hours, lengthen the module sessions and add a second gesture or location session. Keep invention at 30 to 40 percent.

## What I could not verify

- No web page was opened. All external evidence is search-result summaries.
- Drawabox lessons 3, 5, 6 and 7 were not confirmed by search; lessons 1 and 4 and the 25 Wheel Challenge were.
- Robertson's chapter list was not retrieved.
- The proposed hours are my estimates, like the originals. They should be recalibrated from George's own session logs after the first two months: the app can compare logged minutes per module with the estimate.

## Every URL used

I opened none. WebFetch could not reach outside hosts in this environment.

Found by WebSearch and used as evidence (not opened):
- https://drawabox.com/lesson/0/5
- https://drawabox.com/community/submission/PHBH7X38
- https://drawabox.com/lesson/4
- https://drawabox.com/lesson/4/css/about
- https://www.drawabox.com/lesson/25wheels
- https://drawabox.com/lesson/25wheels/1/about
- https://drawabox.com/community/submission/7KT3QZY7
- https://drawabox.com/community/submission/76M5L4NX
- https://drawabox.com/community/submission/NH96MA8R/
- https://drawabox.com/community/submission/YTXO9PQ7
- https://drawabox.com/community/submission/OIM8EDY9
- https://drawabox.com/community/submission/GOB018BT
- https://drawabox.com/community/submission/R78E1ON
- https://drawabox.com/community/submission/G874R8MV
- https://drawabox.com/community/submission/LZB9TC
- https://proko.com/course/figure-drawing-fundamentals
- https://conceptartempire.com/proko-figure-drawing-fundamentals-review/
- https://www.proko.com/course/anatomy-of-the-human-body/lessons
- https://www.proko.com/course-lesson/how-to-draw-the-spine
- https://conceptartempire.com/proko-human-anatomy-course-review/
- https://proko.com/course/the-perspective-course/comments
- https://ctrlpaint.com/library
- https://designstudiopress.com/product/how-to-draw
- https://www.abebooks.com/Draw-Drawing-Sketching-Objects-Environments-Imagination/30823955047/bd
- https://cgmasteracademy.com/courses/131-sketching-mentorship-with-peter-han.html
- https://weareplaygrounds.nl/event/workshop-by-peter-han/
- https://www.wattsatelier.com/?p=139427
- https://wattsatelier.com/
- https://www.florenceacademyofart.edu/?p=33788
- https://en.wikipedia.org/wiki/Andrew_Loomis
- https://www.librarything.com/work/66342

Cited from the project's own research notes and `syllabi` (opened by the earlier research passes, not by me):
- https://www1.rmit.edu.au/courses/C4382VART6406C2145
- https://www.clark.edu/cce/class-resources/supply-lists/beginning-drawing-syllabus-spring2025.pdf
- https://www.sjsu.edu/art/docs/greensheets/syllabi_2202_spring2020/ART_024_04_Friedman_Erik_Spring%202020.pdf
- https://florenceacademyofart.edu/wp-content/uploads/2024/12/Foundation-in-Graphic-Arts-Curriculum-2024-25.pdf
- https://risd.edu/academics/experimental-and-foundation-studies/first-year
- https://archive.org/details/TheTrainingOfTheMemoryInArtAndTheEducationOfTheArtist
- https://www.proko.com/lesson/training-yourself-to-draw-from-imagination-peter-han

Search also surfaced scans of Loomis's and Nicolaides's books on archive.org. Their rights are unclear, I did not use them as evidence, and they should not be linked.
