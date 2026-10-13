# Resource verification, second pass

Checked on 2026-10-13. Companion data: `02-resource-verification.json` (83 records).

## Limits of this pass

Read this first. It changes how much the rest can be trusted.

- No page was opened directly except one on github.com. In this environment curl gets a 403 from the egress proxy for drawabox.com, web.archive.org, proko.com, nma.art, youtube.com, wikipedia.org, reddit.com, johnmuirlaws.com, khanacademy.org and every other general host I tried. WebFetch fails DNS for every host except github.com (example.com and en.wikipedia.org also failed). The Wayback Machine was not reachable by either tool. The coordinator confirmed this and asked for search-only checks.
- Only WebSearch worked. Everything marked `confirmed-by-search` means a search result showed that exact URL, or that exact page title, and the search engine's summary of the page matched the entry. I did not see the page itself. The summaries are written by the search tool from the page text, so they are good evidence but not the same as reading the page.
- The WebSearch budget for this turn is 200 calls, shared by all the parallel researchers. It ran out after 36 of my searches. I spent them on task 1 (Drawabox) and task 2 (the four flagged links), because those were the ones nobody had been able to check. Tasks 3, 4 and 5 could not be done as live checks. Those records are in the JSON with `status: "unconfirmed"` and `method: "none"`, and nothing in them should be read as a confirmation.
- To finish the job, either allow the hosts in the environment's network settings (Network access, a broader level or the hosts added under allowed domains) so that WebFetch and curl work, or rerun tasks 3 to 5 in a new turn with a fresh search budget.

## Method

- Drawabox: 29 WebSearch queries, most restricted to `drawabox.com` (and one to `patreon.com`), aimed at each lesson, each challenge, Lesson 0, the 50% rule, the recommendations page and the critique system. I recorded every drawabox.com URL that the results showed and what the summaries said about it.
- Flagged links: 7 WebSearch queries (NMA Friday session, UNAM PDF, RMIT course guide, PoseMyArt).
- Offline work with `python3 -I` on `curriculum.json` and `link_check.json`: drew the seeded sample (random.seed(13), 30 of the 269 verified entries), scanned the "verified" entries' own notes for admissions that something was not seen, reviewed cost labels for Proko, New Masters Academy and Ctrl+Paint, and pulled the redirects that the previous pass's own link check recorded. Scripts are in `scratchpad/scripts/` (`summ.py`, `list_unv.py`, `sample.py`, `audit.py`, `strict.py`, `proko.py`, `compile.py`).
- One direct check worked: r322 (Z-Anatomy on github.com) opened with WebFetch.

Status values in the JSON: `confirmed` (page opened, matches; only r322), `confirmed-by-search`, `moved`, `dead`, `mismatch`, `unconfirmed`. Method values: `webfetch`, `search`, `offline (link_check.json final_url)`, `none`.

## Drawabox

### Outcome in one paragraph

The lessons and challenges exist at the URLs the curriculum uses, with the titles it uses, with two problems: r081 points at a sub-page of the 250 box challenge that never showed up in any result, and r083's title claims Lessons 6 and 7 while its URL is Lesson 6 only. The lesson material is free to read. Critique is split: free community critique that is not guaranteed, and paid official critique bought with credits. So the right cost label for each lesson is "free", with a note about paid critique, rather than "free-tier". All of this rests on search results, not on pages I opened, so the entries should stay `verified: false` (CLAUDE.md keeps them unverified on purpose) until someone opens them in a browser.

### Lesson and challenge map

URLs are listed exactly as they appeared in search results. "Pattern" means the bare lesson URL follows the same `/lesson/N` form that showed up for Lessons 4 and 7, but did not itself appear in a result.

| Step | URL | Evidence | Placement | Official critique |
|---|---|---|---|---|
| Lesson 0 | /lesson/0/2/50percent, /lesson/0/3/gettingfeedback, /lesson/0/3/gettingthemost, /lesson/0/5, /lesson/0/faq/portfolio | Summary: "Lesson 0, which consists of 4 pages, is where you start" | Start here | None |
| Lesson 1: Lines, Ellipses and Boxes | /lesson/1 (pattern); /lesson/1/5 and /lesson/1/12/about seen | Dozens of submission pages with this exact title | After Lesson 0 | 1 credit |
| 250 Box Challenge | /lesson/250boxes/1 (linked from critiques); /lesson/250boxes/2/subdivide and /lesson/250boxes/4/exercise seen | Summary of the challenge page; revised on 19 Feb 2024 | After Lesson 1; required before Lesson 2 | 1 credit |
| Lesson 2: Contour Lines, Texture and Construction | /lesson/2 (pattern); /lesson/2/6/drawingforms, /lesson/2/7/example, /lesson/2/formintersections/step2 seen | Summary gives this title and the Dissections exercise | After box challenge | 1 credit |
| Lesson 3: Applying Construction to Plants | /lesson/3 (pattern); /lesson/3/2 seen | Submission titles; summary of /lesson/3/2 (leaves exercise) | After Lesson 2 | 2 credits |
| Lesson 4: Applying Construction to Insects and Arachnids | /lesson/4 seen | Summary gives homework: 2 pages organic forms, 4 pages construction only, 6 pages with texture | After Lesson 3 | 2 credits |
| 250 Cylinder Challenge | /lesson/250cylinders/1/stage2 seen | Summary: 150 cylinders on arbitrary minor axes, 100 in boxes | After Lesson 2 at the earliest; suggested between Lessons 5 and 6 | 1 credit |
| Lesson 5: Applying Construction to Animals | /lesson/5 (pattern); /lesson/5/1/homework seen | Summary gives homework: birds, hooved and non-hooved quadrupeds | After Lesson 4 | 2 credits |
| Lesson 6: Applying Construction to Everyday Objects | /lesson/6 (pattern); /lesson/6/1/tools seen | Summary: needs Lesson 5, 250 box and 250 cylinder; 8 pages of objects | After the cylinder challenge | 2 credits |
| 25 Wheel Challenge | /lesson/25wheels/1/assignment seen | Summary: 25 wheels from reference; after Lesson 6, before Lesson 7 | Between 6 and 7 | 1 credit |
| Lesson 7: Applying Construction to Vehicles | /lesson/7 seen | Summary: needs lessons through 6, both 250 challenges and the wheel challenge | Last lesson | 2 credits |
| 25 Texture Challenge (optional) | /lesson/25textures/1/video seen | Summary: 25 rows of the Lesson 2 texture analysis, spread over time | Any time after Lesson 2 | 2 credits |
| 100 Treasure Chest Challenge (optional) | /lesson/100chests/1/challenge seen | Summary: needs Lesson 1, 250 box, Lesson 2, 250 cylinder, Lesson 6 | After Lesson 6 | 2 credits |
| Recommendations | /recommendations seen | Summary: pens, tools, programs and books, many Amazon affiliate links | Reference | None |

All URLs are on `https://drawabox.com`.

### What is free and what is paid

- Lessons and challenges: free to read. A search summary quotes Irshad Karim ("Uncomfortable"): "my lessons are available completely free". The site is funded by Patreon, ads, pen sales and affiliate links. I could not confirm whether reading needs an account.
- Community critique: free, "but not guaranteed, as it relies on the good will of other students" (summary of /lesson/0/3/gettingfeedback). The free channels are the drawabox.com community, r/ArtFundamentals and the Drawabox Discord. Students report waiting months for it.
- Official critique: paid. Credits come from Patreon student tiers and expire two months after they are granted. A search summary of patreon.com/cw/uncomfortable shows a "Casual Student" tier at $5 a month for 1 credit, with at most 2 credits held; the summary could not confirm the page is current. A 2024 forum post (drawabox.com/community/submission/8M271XYK) and a Patreon post on the move to credits both say Lessons 1 and 2 and the box, cylinder and wheel challenges cost 1 credit, and Lessons 3 to 7 and the texture and chest challenges cost 2. The site says these amounts can change. Official critique also requires a complete submission, a 2-week gap between submissions, and fineliners from Lesson 2 on.
- Tools: 0.5 mm fineliner and plain printer paper. Ballpoint is accepted for Lesson 1 and the box challenge; Lessons 6 and 7 and the wheel challenge use ballpoint for linework.

### Curriculum entries mapped

| rid | Entry | Result |
|---|---|---|
| r075 | Lesson 1 | confirmed-by-search. Keep URL. Cost: free (critique paid). |
| r082 | Lesson 2 | confirmed-by-search. Keep URL. Change cost to free with critique note. |
| r076 | Lesson 3 | confirmed-by-search. Keep URL. Same cost change. |
| r077 | Lesson 4 | confirmed-by-search (exact URL seen). Same cost change. |
| r078 | Lesson 5 | confirmed-by-search. Same cost change. |
| r083 | "Lessons 6 and 7" at /lesson/6 | mismatch. The URL is Lesson 6 only; Lesson 7 is already r079. Retitle to Lesson 6. |
| r079 | Lesson 7 | confirmed-by-search (exact URL seen). Same cost change. |
| r080 | Recommendations page | confirmed-by-search (exact URL seen). It covers tools and books, not the course's paper rules; those are in Lesson 0. Pair with the new Lesson 0 tools entry for found-materials-setup. |
| r081 | 250 Box Challenge at /lesson/250boxes/2/about | unconfirmed. That URL never appeared. Switch to /lesson/250boxes/1, which critiques link to for the assignment. |

Library entry `drawabox-challenges` points at the home page; point it at the challenge pages above instead. Library entry `r-artfundamentals`: see r239 below.

### Drawabox entries to add

In the JSON as `rid: "new"`, each with its module ids.

| Title | URL | Modules |
|---|---|---|
| Lesson 0: the 50% rule | /lesson/0/2/50percent | found-practice-method, found-sketchbook-habits |
| Lesson 0: getting feedback | /lesson/0/3/gettingfeedback | found-critique-feedback |
| Lesson 0: getting the most out of the course | /lesson/0/3/gettingthemost | found-practice-method (contents not summarised; check first) |
| Lesson 0: tools | /lesson/0/5 | found-materials-setup |
| 250 Cylinder Challenge | /lesson/250cylinders/1/stage2 (landing page probably /lesson/250cylinders) | persp-ellipses-cylinders, persp-construct-primitives |
| 25 Wheel Challenge | /lesson/25wheels/1/assignment | nat-hard-surface-vehicles-machines, persp-ellipses-cylinders |
| 25 Texture Challenge | /lesson/25textures/1/video | light-materials-textures, nat-texture-fur-feather-scale |
| 100 Treasure Chest Challenge | /lesson/100chests/1/challenge | nat-everyday-objects, persp-construct-primitives |

## The four flagged links

| Item | Result |
|---|---|
| r170 NMA "Friday Figure Drawing with Glenn Vilppu (free live session)" | dead as a free resource. The free-with-RSVP wording survives only on archive pages that carry an October 2023 "no longer updated" notice. The current listings, "Friday Draw Along (Live Class)" at https://www.nma.art/courses/friday-figure-drawing-live-class/ and a June 2026 run with Iliya Mirochnik, say "free for all active NMA subscribers", which means paid. I found no free public Friday session. Past streams are at https://www.nma.art/courses/friday-figure-drawing-livestream-archive/ (access not confirmed). This entry was marked `verified: true`. |
| r281 UNAM "Desde otro punto de vista" PDF | confirmed-by-search: the exact URL and title are in the index. The summary says it is an announcement for a 12-hour in-person workshop (Luis Leonel Gomez Flores; one-, two- and three-point and fisheye perspective) with January dates. It is a course outline, not a lesson. The certificate error is on UNAM's server. Keep only as a syllabus reference. |
| RMIT VART6406C course guide (syllabi[], not a resource) | confirmed-by-search: the 2145 URL is still indexed as "Course Title: Produce drawings to communicate ideas". A later guide exists at https://www1.rmit.edu.au/courses/C4382VART6406C2205 (2022). No 2026 guide was found. The expired certificate is RMIT's problem. |
| PoseMyArt (library[], not a resource) | moved. The tool lives at https://posemy.art/, not posemyart.com, which explains the 503. The site calls itself "Free, Online, Simple". I found no pricing page, so a paid tier is neither confirmed nor ruled out, and the licence was not seen. |

## Other unverified resources (task 3)

Not done. The 45 non-Drawabox entries with `verified: false` are in the JSON as `unconfirmed` with `method: "none"`. The previous pass's notes stand unchanged. Two have some incidental evidence:

- r239 r/ArtFundamentals: drawabox.com mirrors its threads under drawabox.com/r/artfundamentals/, and Lesson 0 calls Reddit critique "completely free". So the subreddit exists and is Drawabox's critique forum, but the reddit.com URL itself was not seen.
- r212, r287 and r294: the previous link check recorded redirects (Proko lesson without `/discussions`, urbansketchers.org without www, webexhibits on https with www). The new URLs are in the JSON.

## Proko, New Masters Academy, Ctrl+Paint (task 4)

Not checked live. Offline review of the labels only:

- The premise that every Proko entry is free-tier is not what the file says. Of 52 Proko entries (counting "Proko with Marvel", "Proko Community" and the Gumroad one), 38 are free-tier, 7 are paid and 7 are free. 50 are marked verified.
- 36 Proko entries point at a single lesson. 26 of those are labelled free-tier. For one lesson video that label means nothing: the video is either free to watch or it is Premium. Each of the 26 needs a direct look (r183 to r230; full list in `scripts/proko.py` output). This is the check task 4 asked for and it is still open.
- r192 contradicts itself. The title says "Lines section: free lessons (Intro to Lines, Tapered Stroke, 6 Habits, 2 Week Challenge)", but the notes say "Both lessons are Premium" and describe warmups, and the cost is paid. It feeds 5 modules (found-line-control, found-line-weight, found-warmups, found-basic-shapes, fig-portrait-likeness). Fix the title or the notes.
- New Masters Academy: 7 entries, 4 paid, 2 free-tier and 1 free. The one free entry is r170, which is no longer free (see above). With that fixed, NMA offers nothing in this curriculum that is fully free.
- Ctrl+Paint: 32 entries, 29 free and 3 free-tier, all verified. The 8-entry sample was not checked live.
- One incidental search result: Proko hosts lessons by Drawabox's author that are marked "This lesson is premium only". They are not in the curriculum.

## How far to trust the "verified" label (task 5)

I could not measure a live error rate. The seeded sample (random.seed(13), 30 of 269 verified) is r004, r018, r026, r043, r044, r072, r085, r086, r089, r097, r126, r141, r148, r151, r166, r184, r186, r191, r211, r243, r250, r252, r256, r258, r259, r267, r270, r274, r318 and r321. None of them could be opened.

What I can say from the data and the few live results:

- Known wrong: r170 was `verified: true` and is both dead and no longer free. r322 (opened on GitHub, not in the sample) matched its entry exactly.
- In the sample, 11 of 30 entries say in their own notes that something was not seen. In 4 of those (13%) the gap is material: r318 and r321 are YouTube videos "confirmed via oEmbed; page not opened", r243's contents list "did not render", and r018 could not tell whether the content needs a paid login. The other 7 are minor (playlist names, a price not shown, or a caveat about rights). 3 of the 30 (r018, r141, r267) now redirect.
- Across all 269 verified entries, 23 have notes that say part of the claim was not opened, could not be read or was not confirmed. That includes 8 YouTube videos verified only by title and channel through oEmbed.

So "verified" in this file means "the link resolved and some of the page was read". It does not mean the cost and contents were both confirmed. Read 13% as a lower bound for verified entries whose own notes show a material gap. It is not a measured error rate; that still needs live checks of the 30 sample entries.

## URL updates from the previous link check

These come from the previous pass's `link_check.json` (the request ended in HTTP 200 at a different URL). I did not re-fetch them. They are in the JSON as `moved`, with method `offline (link_check.json final_url)`: r005, r018, r071, r131, r147, r205, r206, r211, r214, r218, r221, r223, r230, r236, r260, r267. Two need a content check as well as a URL change. r005 goes from `animationresources.org/?p=11345` to a generic `/lesson/` page, which may not be the same article. r260's TED talk slug changed.

## Recommendations

1. Drawabox: keep `verified: false`, but set `cost` to free for every lesson and challenge, with a `free_notes` line saying that official critique costs Patreon credits and community critique is free but not guaranteed. Fix r081's URL and r083's title. Add the 8 new entries. Point library `drawabox-challenges` at the challenge pages.
2. Drop r170 as a free resource or relabel it paid. Replace it with a free timed-pose tool already in the library for the Friday life-drawing slot.
3. Change PoseMyArt's URL to https://posemy.art/ and keep it unverified until its terms are read.
4. Keep r281 and the RMIT guide, labelled as outlines, with a certificate warning.
5. Apply the 16 redirect URL updates. Check r005 and r260 by hand.
6. Fix r192's title and notes contradiction.
7. Split `verified` into separate flags (link resolves, contents seen, cost seen) so that oEmbed-only YouTube entries and pages read only in part stop showing as fully verified.
8. Rerun tasks 3, 4 and 5 with network access to the hosts, or in a fresh turn with search budget: the 45 unverified entries, the 26 Proko single-lesson free-tier entries plus NMA r167 and r169, 8 Ctrl+Paint entries, and the 30-entry seeded sample.
