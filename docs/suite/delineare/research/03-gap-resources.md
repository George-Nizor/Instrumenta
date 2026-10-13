# Gap resources for thin modules (second pass)

Date: 2026-10-13. Researcher: gap pass 03.

## Read this first: how much of this was checked

Two limits shaped this pass, and they matter more than anything else here.

1. No page could be opened. In this environment WebFetch and curl cannot reach outside hosts (archive.org, youtube.com, gutenberg.org, proko.com, wikipedia.org, commons.wikimedia.org and the rest all failed with a DNS error or a proxy 403). The only evidence available was WebSearch: result titles, URLs and the search tool's summary of each page. Every new entry in the JSON carries `"evidence": "search-result"` in place of `verified_on`. Nothing was opened, played or read in full.
2. The shared web-search budget (200 calls per turn across all parallel researchers) ran out after 19 searches in this pass. So most thin modules got no new search at all. For those I suggest re-using resources already in the curriculum catalogue (opened by the first pass), tagged `"evidence": "existing-catalogue"` with their `existing_rid`, and I list search targets for a follow-up pass. Those targets are names only, with no URLs, and are unverified.

Every URL below either appeared in a search result in this pass or is already in curriculum.json. One YouTube URL was shortened from the mobile form with a tracking parameter to the plain watch URL with the same video id; this is noted where it applies.

## Summary of what changed

New material found (search-result evidence):

- "Drawing is Seeing", an open textbook by David DeRoche (Open Oregon, Pressbooks, 2022, CC BY-NC-SA). Its exercises fill gaps in ellipses, still life, photo-versus-life checking, measuring and graphite shading.
- The Da Vinci Initiative's 28-lesson Bargue drawing course, released free on its YouTube channel in 2016 and 2017. This is the first free, structured atelier Bargue video course found for this curriculum.
- Bargue plates on Wikimedia Commons: Category:Charles Bargue has a Drawing Course I subcategory with 41 files, and individual plates from Parts I and III exist as separate files.
- A second Rijksmuseum Cours de dessin plate (Theseus, Part I) and a Bargue print after Holbein.
- The Design Sketchbook's free freehand ellipse and ellipse-in-perspective tutorials.
- Confirmation that the Internet Archive "Bargue Drawing Course" uploads are scans of the modern ACR Edition book with Gerald Ackerman's copyrighted text. They should not be linked.

Coverage after this pass:

- Now reasonably covered: found-ellipses, obs-still-life-from-life, light-bargue-cast, obs-master-copies-bargue. Two figure modules also become workable by re-using free Proko lessons that the catalogue already holds: fig-facial-features-expressions and fig-foreshortening-perspective.
- Still thin: obs-photo-vs-life, obs-visual-memory, persp-foreshortening (for objects), persp-curvilinear, light-media (charcoal side), fig-portrait-likeness, nat-reptiles-amphibians-fish, nat-hard-surface-vehicles-machines (ships and aircraft), nat-food-organic-still-life, nat-patterns-ornament-surface-detail, nat-landscape-elements (rocks, mountains, fire, smoke), des-costume-props-accessories, des-cartooning-stylisation-caricature and persp-imagination. Non-English sources and turnarounds and model sheets were not researched.

## Phase 2 to 5 thin modules

### found-ellipses (thin)

What is missing: the core (Drawabox Lesson 1) has never been opened by any research pass, and the only other free items were a Ctrl+Paint video and a John Muir Laws session. Nothing covered freehand ellipse mechanics together with ellipses in squares.

Found:

- Proko, "How to Draw Cylinders and Ellipses" (Stan Prokopenko). The search summary says it covers ellipses, cylinders in perspective and using boxes to place them. The first pass saw the lesson marked free (lesson 94 of 185 of Drawing Basics, 14:36). This search could not reconfirm that, and one listing shows the parent course at 159 USD. It is already in the catalogue as r196, attached only to persp-ellipses-cylinders. Suggest attaching it here as core because it has the strongest teaching record of the options.
- The Design Sketchbook, "How to draw an ellipse freehand". A free tutorial page covering five common beginner mistakes and eight techniques. It links a flat-bottomed ellipse to posture and a locked elbow, which matches this module's posture outcomes. Alternative.
- The Design Sketchbook, "How to draw ellipses in perspective in 7 steps" (tip 158). Builds the ellipse inside a square in a 2-point box, with the minor axis running through the centre and the vanishing point. It directly serves the outcome "fit an ellipse inside a square plane". Supplementary. Its own comments note that it only works for a circle inside a square.
- Drawing is Seeing, Exercise 3.4 "Ellipses" (David DeRoche, Open Oregon). Draw at least 20 ellipses of different sizes and angles in a timed sitting, and keep the pencil moving past the ends so they do not turn pointed. A clean, licensed practice drill. Supplementary. The page gives 10 minutes in one place and 15 in another.

Why these: the module now has one video lesson by a recognised teacher, one written diagnosis of common faults, one construction method for ellipses in squares, and one drill from an open textbook.

### obs-still-life-from-life (thin)

What is missing: no free structured still-life project; the core was a Proko critique of a single pear.

Found:

- Drawing is Seeing, Exercise 8.1 "Still life". A short warm-up still life of about 30 minutes, with shading optional. Core for the single-object and small-group stage.
- Drawing is Seeing, Exercise 8.2 "Elaborate Still Life" (and the Chapter 8 part page). Choose 12 different objects, overlap them tightly, light them from one side for strong contrast, do thumbnails first, then work on one full 18 x 24 inch sheet for about 2.5 hours with 4H, HB and 4B pencils. It also asks you to photograph the setup from your drawing position with the lens at eye height so you can compare. This is a complete set-up, block-in, compare routine, so it serves as the capstone. Alternative or capstone. Twelve objects is a lot for a near-beginner, so suggest scaling it to three to five objects first.

Existing catalogue items that fit: r148 Liz Steel "Measured Setup" stays as an alternative.

### obs-photo-vs-life (thin)

What is missing: nothing teaches the photo-versus-life comparison directly.

Found:

- Drawing is Seeing, Exercise 8.2 (above). Its instruction to photograph the still life from the exact drawing position, lens at eye height, is the exact experiment this module needs: draw from life, photograph the same view, then compare. Suggest it as a practice reference.

Still thin. Search targets for next pass: James Gurney's Gurney Journey posts on photo reference and lens distortion; the Draftsmen podcast (Proko) episode on drawing from photos versus life.

### obs-visual-memory (thin)

What is missing: only the Lecoq de Boisbaudran book (r106) and one Sight-Size article.

Found: no new resource (search budget ran out before this module).

Existing catalogue item that fits: r229 Peter Han, "Training Yourself to Draw From Imagination, Part 1" (Proko, free but not explicitly labelled). It is about storing and recalling structure, which is the memory-to-imagination bridge. Supplementary.

Search targets: Gurney Journey memory-drawing posts; Draftsmen episode on drawing from imagination; Sinix Design videos on memory.

### obs-master-copies-bargue (thin)

What is missing: no confirmed free set of Bargue plates; the Wikimedia Commons category had never been opened.

Found:

- Wikimedia Commons, Category:Charles Bargue. Search results describe a subcategory "Bargue-Gerome Drawing Course I" with 41 files, numbered plate files such as "Bargue I - 0006.png" (described as the sixth of 197 plates), and a Part III file "Plate III-24 Man seated upon the ground, his head on his knees". Commons only accepts free or public-domain files, and Bargue died in 1883, but the per-file licence tags were not seen. Core image source.
- Rijksmuseum, "Theseus, deel van het fronton van het Parthenon" (RP-P-2018-1162). A lithograph from 1866 to 1871, printed by Lemercier and published by Goupil. The museum notes it belongs to Part I of the Cours de dessin. The licence was not shown in the search summary. The sibling plate already in the catalogue (r241, Two riders) carries a Public Domain Mark. Alternative, high-resolution museum copy.
- Rijksmuseum, "Portret van een man met een hoed door Hans Holbein de Jonge". A Bargue lithograph after Holbein (c. 1875 to 1900), in the style of Part II (master drawings). The first pass recorded a Bargue print after Holbein at the Rijksmuseum as CC0, probably this record. Supplementary for a second, different copy.

Excluded, with reasons:

- Internet Archive items "CharlesBargueDrawingCourse", "C.BargueDrawingCourse", "solotestoc.barguedrawingcourse", "charlesbarguedrawingcoursewiththecollaborationofjeanleongeromepdfdrive.com" and "sv40_87866_655_2007". The text files in these items include "Practical Matters: Using the Plates as Models to Copy" and "The Schemata or Plans", which is Gerald Ackerman's commentary from the 2003 ACR Edition book. They are unauthorised scans of a modern, in-copyright book, whatever label an uploader added. The plates themselves are public domain, but these files are not a clean source.
- Wikimedia Commons "File:Charles Bargue Drawing Course (IA CharlesBargueDrawingCourse).pdf" is a copy of the same Internet Archive scan, so it has the same problem. Use the individual plate files instead.
- Art Institute of Chicago's Bargue artist page lists three Bargue works (Seated Arab and two others). None is a Cours de dessin plate, so it is not useful here.
- Artvee lists Bargue "Plate 01", "Plate 07" and so on. It is an aggregator that gives no museum provenance, so it is not recommended while Commons and the Rijksmuseum exist.

### persp-foreshortening (thin)

What is missing: free material on foreshortening objects (cylinders, boxes) rather than figures.

Found: no new resource.

Existing catalogue items that fit: r196 Proko cylinders and ellipses, which shows how a cylinder's ellipses open as it turns. r284 Studio Chalkboard covers circles (lesson 5) and diminishing size (lesson 7).

Search targets: Sinix Design foreshortening video; Marshall Vandruff foreshortening lectures; Scott Robertson's free videos on rotating forms.

### persp-curvilinear (thin)

What is missing: no teaching video or lesson, only Wikipedia and the Krita manual.

Found: nothing new. Search targets: five-point and fisheye tutorials by Sinix Design or Kienan Lafferty; António Araújo's open-access papers on spherical perspective (academic, possibly too advanced).

### light-media (thin)

What is missing: free, credible charcoal handling and fixative instruction; graphite paper-and-grade comparison.

Found:

- Drawing is Seeing, Chapter 6 "Shading". Covers hatching, cross-hatching, scribbling, blending and stippling, and how lighting sets tone. It has exercises on shading spheres (6.1), hatching and cross-hatching (6.3) and shading a glass object by smudging (6.4). This gives the graphite part of the module a structured, licensed source. Alternative.

Existing catalogue items that fit: r278 The Virtual Instructor "Charcoal Drawing Techniques" (free lesson by Matt Fussell, currently only on col-trad-charcoal) and r255 Tate "Charcoal" glossary. Attach r278 here as the charcoal alternative.

Still thin for charcoal. Search targets: Proko or Steve Huston charcoal demos; paper manufacturers' charcoal videos (Strathmore already appears in the catalogue for pen and ink).

### light-bargue-cast (thin)

What is missing: free atelier video teaching; a confirmed plate source; any free cast-drawing demo.

Found:

- The Da Vinci Initiative YouTube channel. Art Renewal Center blog posts from 2016 and 2017 say DVI released its 28-part Bargue drawing course one lesson a week, free, on this channel, ending with Lesson 28 "Last Corrections" in July 2017. The full paid version, "Bargue Drawing in the 21st Century Classroom", cost 360 to 475 USD and added discussion and assignments. The channel page now says DVI operates as The School of Atelier Arts. Core, but open the channel to confirm the videos are still public.
- Art Renewal Center blog, "Last Lesson in DVI Bargue Course Released". The record of the free release, useful as the credit and context link. Supplementary.
- Stephen Bauman, "How to draw an Advanced Bargue: Lesson 1" (YouTube). A block-in of the Belvedere Torso that he calls the most complex Bargue assignment. Supplementary for later, not a starting point. The search result URL was the mobile form with a tracking parameter; the plain watch URL with the same id is listed.
- Darren R. Rousar, "Cast Drawing in Sight-Size" video course (Velatura Press on Gumroad). Paid, 49.50 USD for 9 video lessons and a PDF ebook. It is the same content as his online course minus critiques. Listed as the paid option because no free sight-size cast demo was found.
- Plate sources are the same as obs-master-copies-bargue (Commons category, Rijksmuseum Theseus plate).

Leads not entered in JSON because the channel could not be identified from the search result: YouTube "Bargue Introduction" (video id D6lCvz1IiW8) and "Bargue Lesson 19 Tip - Another Pass" (g0wN2rPxABg). Both appeared in a search for Da Vinci Initiative and are probably DVI uploads. "How to do a Bargue drawing: Lesson 1" (GZm7qih71-w) is described as the first lesson of someone's online atelier. Check who posted them before using any of them.

New Masters Academy has a paid seven-hour charcoal plaster-cast demo by Leo Mancini-Hresko with a free first segment. The search results did not tie it to one specific URL, so it is not entered.

### Partial phase 3 to 5 modules with weak cores

- obs-comparative-measuring and obs-block-in: Drawing is Seeing, Chapter 4 "Training Your Eye or 'Seeing'" and Exercise 4.4 "Create and Implement a Basic Unit" (only the title was seen; it appears to teach measuring against one base unit). Supplementary to Proko lesson 51.
- light-basic-forms: Drawing is Seeing, Exercise 6.1 "Shading of Spheres". Alternative drill.
- obs-sight-size-and-checks: the only new item is Rousar's paid course above. The free core is still the Sight-Size.com article.
- found-line-control (core is a paid Proko course page), persp-box-basics (Drawabox unverified), found-materials-setup, found-posture-grip: no new search was possible.

## Phase 6 figure modules

### fig-facial-features-expressions (thin)

Found: no new search. Existing catalogue items that fit well:

- r233 Proko with Marvel, "Drawing Character Expressions" (Alitha Martinez, free, 14:02). Currently only on des-expression-acting. It is a free video by a working comics artist and should be the video core here.
- r089 Vanderpoel, The Human Figure (DrawingBooks.org). Its opening chapters treat the eye, nose, mouth and ear as forms. Public domain.
- r009 Atlas of Emotions (Ekman) and r179 Posemaniacs face references, for expression reference.

### fig-portrait-likeness (thin)

Found: nothing new. Existing: r213 Proko Loomis lessons stay core. r087 Hatton (head and neck chapter) and r089 Vanderpoel are public-domain supports. Search targets: Ahmed Aldoori and Florent Farges portrait videos; Proko likeness lessons.

### fig-foreshortening-perspective (thin)

Existing catalogue items that fit: r200 Proko "How to Draw Foreshortened Poses" (Steven Michael Hampton, free, 23:47). It is currently only on persp-foreshortening and should be the core here, because it is figure-specific and free. r205 Draftsmen "How to Learn Perspective" (Vandruff and Prokopenko, free) is a supplementary talk.

## Phase 7 to 9 thin modules

No new searches were possible for these modules. The catalogue suggestions below are re-uses only.

- nat-reptiles-amphibians-fish: still thin. Existing r012 Biodiversity Heritage Library, r154 Lizzie Harper pen and ink. Search targets: Aaron Blaise reptile videos, John Muir Laws pages on reptiles or fish, natural-history illustration handouts.
- nat-hard-surface-vehicles-machines: still thin, especially for ships and aircraft. Existing r090 Eric Strebel, r095 FZD Design Cinema, r251 Dan Beardshaw (volumes in perspective). New, search-result only: The Design Sketchbook "How to Draw Rounded Product Forms" (cylinder-based product forms) as a supplementary; Drawing is Seeing Exercise 5.3 "Line Drawing of a Sailboat" (title seen only). Search targets: Scott Robertson free videos, FZD episodes on vehicles, ships and aircraft.
- nat-food-organic-still-life: Drawing is Seeing Exercises 8.1 and 8.2 can be run with fruit, vegetables and bread as the objects (my suggestion; the exercises do not specify food). Existing r183 Proko pear critique, r064 Ctrl+Paint material spheres. Search targets: Alphonso Dunn and Will Kemp fruit demos.
- nat-patterns-ornament-surface-detail: still thin. Existing r107 Owen Jones, r013 Haeckel, r320 Strathmore textures video. Search targets: Franz Sales Meyer, Handbook of Ornament (public domain); Lewis F. Day pattern books.
- nat-landscape-elements: still thin for rocks, mountains, fire and smoke. Existing r004 and r308 Alphonso Dunn, r099 Gurney Journey, r103 LibreTexts atmospheric perspective. Search targets: Ruskin's The Elements of Drawing (its letters cover stones, mountains and water; public domain), Alphonso Dunn rock and cloud videos, effects-animation material for fire and smoke.
- des-costume-props-accessories: Existing r190 Proko Drapery Fundamentals free lessons, r160 Muddy Colors drapery post, r087 Hatton drapery chapter, r269 Met Feuerbach drapery study. Search targets: Racinet's Le Costume historique (public domain), FZD prop-design episodes.
- des-cartooning-stylisation-caricature: Existing r233 Proko character expressions, r224 Proko "The 10 Head Volumes" free lesson, r260 McCloud TED talk. Search targets: Mark Crilley, Jesse Hamm, Sinix stylisation videos.
- persp-imagination: Existing r229 Peter Han, r205 Draftsmen perspective episode, r015 Blender. Search targets: Draftsmen episode on drawing from imagination, Marshall Vandruff lectures.
- Turnarounds and model sheets (known gap): not researched. Existing r018 Blender Studio Spring is the only lead.

## Public-domain drawing manuals

No book page could be opened or searched in this pass. The links below are the ones already in the catalogue, which the first pass opened. The legal notes are general copyright rules applied to the authors' death and publication dates. They are not legal advice.

Rules used:

- United States: works published in 1930 or earlier are public domain as of 1 January 2026. Works from 1931 to 1963 are public domain only if their copyright was not renewed.
- Australia: works by authors who died before 1 January 1955 are public domain. Authors who died in 1955 or later are protected for life plus 70 years.

| Book | Author dates | US | Australia | Link in catalogue |
|---|---|---|---|---|
| Bridgman, Constructive Anatomy (1920) | 1865 to 1943 | PD (pre-1931) | PD (died before 1955) | r108 archive.org/details/constructiveanat00brid |
| Bridgman, Book of a Hundred Hands (1920) | as above | PD | PD | r086 drawingbooks.org |
| Vanderpoel, The Human Figure (1907) | 1857 to 1911 | PD | PD | r089 drawingbooks.org |
| Hatton, Figure Drawing (1895 onward) | 1865 to 1926 | PD | PD | r087 drawingbooks.org |
| Storey, Theory and Practice of Perspective (1910) | 1834 to 1919 | PD | PD | r182 Gutenberg 20165 |
| Lecoq de Boisbaudran, The Training of the Memory in Art (L. D. Luard translation, 1911) | 1802 to 1897; translator Luard died 1944 | PD | PD | r106 archive.org |
| Ruskin, The Elements of Drawing (1857) | 1819 to 1900 | PD | PD | not linked; no URL confirmed this pass |
| Speed, The Practice and Science of Drawing (1913) | 1872 to 1957 | PD (pre-1931) | Not PD until 1 January 2028 (life plus 70) | not linked; Gutenberg hosts a US edition, but its URL was not confirmed this pass |
| Loomis, all books (1939 to 1961) | 1892 to 1959 | Treat as in copyright: a teacher's page says the family renewed the copyrights, and Titan Books reprints them under licence | Not PD until 1 January 2030 at the earliest (life plus 70) | do not link |
| Nicolaides, The Natural Way to Draw (1941, posthumous) | 1891 to 1938 | Treat as in copyright: published 1941; renewal not checked this pass, so assume renewed | Probably PD: the author died before 1955, and the old rule for posthumous works gave 50 years from publication, which ended in 1991. Not confirmed | do not link; no legitimate free copy found |

Notes:

- Bridgman's later books (Heads, Features and Faces, 1932; The Human Machine, 1939) are public domain in Australia. In the US they are public domain only if not renewed, so prefer the pre-1931 titles.
- Speed is the trap. Harold Speed died in 1957, so his books stay in copyright in Australia until the end of 2027, although Project Gutenberg can legally offer them in the US. If the app is used from Australia, hold the Speed link until 2028 or flag it as US-only.
- Faded Page (Canada) hosts Loomis because Canada used life plus 50 for authors who died before 1972. That does not make the books free to download in Australia or the US.

## Non-English sources

Not researched: the search budget ran out first. Leads for a follow-up, all unverified: Florent Farges (French academic drawing teacher who also posts English videos); Clip Studio TIPS (already in the catalogue as r028, multilingual and Japanese-origin); Kim Jung Gi (Korean live-drawing demos, not structured lessons).

## Evidence trail

Search queries run this pass (19), in order: Bargue on Commons (general); ellipse tutorials; Proko cylinders lesson; Design Sketchbook ellipse tips; Open Oregon textbook (2 queries); Drawing is Seeing still life; Rijksmuseum Bargue (2 queries); Gallica Bargue; archive.org Bargue; Bargue museum open access; Commons Bargue (domain-restricted); Art Institute Bargue; free cast-drawing video; Florent Farges Bargue; Da Vinci Initiative Bargue (2 queries); Rousar sight-size video. Two further queries were refused by the budget limit.

Pages that failed to open (network policy): commons.wikimedia.org, archive.org, youtube.com, proko.com, gutenberg.org, en.wikipedia.org.
