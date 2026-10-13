# Name candidates for the learn-to-draw app

Research date: 2026-10-13. Scope: Latin name candidates for the Instrumenta drawing app (line, perspective, construction, light and shade, figure, invention, daily practice), checked for meaning, classical attestation, pronunciation and name collisions, plus verification of the Pliny passages behind "nulla dies sine linea".

## Summary

Recommended: Lineola first, Delineare second.

Lineola ("a little line") keeps the Apelles story of a line drawn every day (Pliny NH 35.84) and the "nulla dies sine linea" proverb, which suits an app built on daily sessions, while stepping clear of Linea Sketch by the Iconfactory, a sketching app in exactly this category. It returned no GitHub repositories, and the npm and PyPI names are free. Its weakness is thin attestation: Lewis and Short cite only Gellius 10.1.9, though it is a regular diminutive of linea.

Delineare ("to sketch out, delineate") is the exact Latin verb for drawing an outline. Its one classical attestation is Pliny NH 35.89, where Apelles takes a dead coal from the brazier and draws a face on the wall. English speakers can guess the meaning from "delineate", and the infinitive matches Ludere and Discere. Its weaknesses are length (five syllables), Delinea the security company two letters away, and "delineare" being an everyday Italian verb.

Linea is the most evocative name and the riskiest: Linea Sketch is a drawing app, Linea is also Consensys's Ethereum network, and the npm and PyPI names are taken. Graphis and Stilus are also high risk. Graphis collides with Graphis, the design magazine and publisher. Stilus sounds the same as Stylus, the CSS preprocessor, and as the generic word for a drawing pen.

| Candidate | Meaning | Collision risk | Note |
|---|---|---|---|
| Lineola | a little line | low | Daily-line story without Linea's collisions; thin attestation |
| Delineare | to sketch out | low to medium | Pliny 35.89 (charcoal portrait); long; near Delinea |
| Adumbrare | to shade; to outline | low | Covers light and shade; "dumb" inside the word |
| Designare | to mark out, trace | medium | Root of disegno; Gigabyte's Designare hardware line |
| Linea | line | high | Linea Sketch (Iconfactory), Consensys Linea, npm/PyPI taken |
| Graphice | the art of drawing | low | Pliny's own word, but reads as English "graphic" |
| Graphis | drawing stylus; drawing | high | Graphis magazine; npm taken |
| Carbo | charcoal | medium to high | One letter from Carbon (IBM, Carbon code images); npm taken |
| Stilus | writing stylus | high | Sounds like Stylus (CSS); a writing tool, not a drawing tool |
| Pingere | to paint | low to medium | Means painting, not drawing; "ping" confusion |
| Videre | to see | medium to high | videre.nvim; npm/PyPI taken; generic |
| Ducere (added) | to draw (a line), to lead | medium | Pliny's "lineam ducendo"; "Duce" overtone |
| Lineamenta (added) | lines, outlines, drawings | low | Cicero's word for artists' drawings; long |
| Penicillus (added) | painter's brush | low | Ancestor of "pencil"; penicillin and Cicero's joke |

## Method and limits

Network access was heavily restricted in this environment, and the limits shape how far the collision checks can be trusted.

- Perseus, Logeion, Wiktionary, Wikipedia, LacusCurtius, the Apple App Store, Google Play, USPTO, WIPO and IP Australia were all blocked by the environment's network policy, for both WebFetch and curl. URLs to those sites are given below as standard references, but I could not open them.
- Lewis and Short and the Pliny texts were verified against the Perseus project's own source files on GitHub, which were reachable. They are the same texts Perseus serves. Lewis and Short: `PerseusDL/lexica`, file `CTS_XML_TEI/perseus/pdllex/lat/ls/lat.ls.perseus-eng2.xml`. Pliny Latin, Mayhoff's Teubner text: `PerseusDL/canonical-latinLit`, file `data/phi0978/phi001/phi0978.phi001.perseus-lat2.xml`. Pliny English, Bostock and Riley: `phi0978.phi001.perseus-eng1.xml` in the same folder.
- GitHub repositories were checked with the GitHub repository search. Availability of `George-Nizor/<name>` and `Bonehead-Labs/<name>` was checked with `git ls-remote`, which only shows public repositories.
- npm (registry.npmjs.org) and PyPI (pypi.org) were reachable, and every name was checked there.
- WebSearch worked for seven queries, then the session's shared search budget ran out. So app store, trademark and company checks are partial. Claims marked "background knowledge" come from my own knowledge, not from a check made in this session. Before committing to a name, run a USPTO (and, if relevant, IP Australia) search for it in classes 9, 41 and 42, and do an App Store search.
- Pronunciations are worked out from the vowel lengths in Lewis and Short using the standard Latin stress rule (stress the second-to-last syllable if it is long, otherwise the one before it). Wiktionary URLs are given as the usual reference but could not be opened.

Owner check: `git ls-remote` found no public repository named after any candidate under George-Nizor or Bonehead-Labs. Private repositories cannot be ruled out this way. As a control, George-Nizor/Fabula resolved, and Bonehead-Labs/Fabula did not, which matches the catalog (the suite's repositories live under George-Nizor).

Lewis and Short reference URLs follow the pattern `https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=<headword>` and `https://logeion.uchicago.edu/<headword>`. The Perseus XML entry id is given for each so the entry can be found in the source file.

## Candidates

### Lineola

Meaning: "a little line", diminutive of linea. Lewis and Short, entry lineola (id n26687): "a little line, Gell. 10, 1, 9." That is the only citation, so it is a real but rare word (Aulus Gellius, 2nd century AD). The formation is regular and the meaning is transparent to anyone who knows "line".

References: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=lineola, https://logeion.uchicago.edu/lineola, https://en.wiktionary.org/wiki/lineola#Latin

Pronunciation: līneŏla, four syllables. The second-to-last syllable is short, so the stress falls on the one before it: li-NE-o-la. Classical [liːˈnɛɔla], ecclesiastical [liˈneːola]. Most English speakers would say "lin-ee-OH-la" by analogy with "gladiola". That is wrong but harmless, and either way it is easy to say.

Collisions: GitHub repository search for "lineola" in names returned 0 results. npm `lineola` and PyPI `lineola` are free. From background knowledge, lineola is a species name in biology, for example Thymelicus lineola, the Essex skipper butterfly, which is not a software collision. No app or trademark found, but the app stores and trademark registers could not be searched.

Risk: low.

Fit: very good. It ties straight to Pliny's daily line, and "a small line a day" describes a daily practice session well. It sits next to Fabula, Imago and Luna as a noun.

### Delineare

Meaning: "to sketch out, to delineate". Lewis and Short, entry delineo (id n12926): "dē-līnĕo, also dēlīnĭo, āvi, 1, v. a. linea, to sketch out, to delineate: imaginem in pariete carbone, Plin. 35, 10, 36, § 89; Tert. adv. Val. 4; id. Res. Carn. 20 init." The classical attestation is Pliny NH 35.89: Apelles, invited to Ptolemy's dinner by a trick, "arrepto carbone extincto e foculo imaginem in pariete delineavit" (snatched a dead coal from the brazier and drew a likeness on the wall), and the king recognized the face. It is a rare word, but its one classical use is about drawing, with charcoal, by Apelles.

References: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=delineo, https://logeion.uchicago.edu/delineo, https://en.wiktionary.org/wiki/delineo#Latin

Pronunciation: dēlīneāre, five syllables, stress on the long ā: de-li-ne-A-re. Classical [deːliːnɛˈaːrɛ], ecclesiastical [delineˈare]. English speakers will manage it ("de-lin-ee-AR-ay") because "delineate" is familiar, but it is the longest name in the suite.

Collisions: GitHub has PratiKo/delineare (empty 2013 repository) and carimeelmor/delineares (a 2020 sketchbook video series, no code). npm and PyPI `delineare` are free. Near names: SeaDve/Delineate (a GNOME app for viewing and editing Graphviz graphs, about 110 stars) and many "delineation" research repositories. From background knowledge: Delinea is a large privileged-access security company (formed in 2021 from Thycotic and Centrify) and very likely holds software trademarks, though the field and meaning differ. "Delineare" is also an everyday Italian verb ("to outline"), so Italian businesses may use it generically.

Risk: low to medium. Low in practice, but Delinea's software marks would need checking.

Fit: excellent meaning. The infinitive pattern matches Ludere and Discere.

### Adumbrare

Meaning: "to shade; to sketch in outline". Lewis and Short, entry adumbro (id n1042): "Esp. in painting, to shade, to represent an object with the due mingling of light and shade, σκιαγραφέω", citing Quintilian 7.10.9 ("quis pictor omnia, quae in rerum natura sunt, adumbrare didicit?") and Valerius Maximus 8.11. Also "To represent a thing only in outline", citing Cicero ND 1.75 ("istorum adumbratorum deorum lineamenta atque formas"). Lewis and Short note that in painting it means the finishing work in light and shade, not the first sketch. Well attested in classical prose.

References: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=adumbro, https://logeion.uchicago.edu/adumbro, https://en.wiktionary.org/wiki/adumbro#Latin

Pronunciation: adumbrāre, a-dum-BRA-re. Classical [adʊmˈbraːrɛ], ecclesiastical [adumˈbrare]. Pronounceable, but English readers tend to see "a-DUMB-rare", and "dumb" is not a good word to have inside a learning app's name. English has "adumbrate", but it is a rare word.

Collisions: GitHub repository search returned 0 results. npm and PyPI `adumbrare` are free.

Risk: low.

Fit: good for the light-and-shade part of the course, weaker as a name for the whole course.

### Designare

Meaning: "to mark out, trace out; to delineate, design, depict; to designate". Lewis and Short, entry designo (id n13382): "to mark out, trace out (freq. in the Aug. per.)", for example "Aeneas urbem designat aratro" (Verg. A. 5.755), and "Transf., to delineate, design, depict, represent, sc. by embroidering, weaving, etc.: Europen, Ov. M. 6, 103". Most uses are figurative ("to designate, point out, appoint"). Quintilian 4.2.120 has "velut primis lineis designare" (as if to sketch in first lines). It is the root of Italian disegno and English design. Well attested.

References: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=designo, https://logeion.uchicago.edu/designo, https://en.wiktionary.org/wiki/designo#Latin

Pronunciation: dēsignāre, de-si-GNA-re. Classical [deːsɪŋˈnaːrɛ] ("gn" as "ngn"), ecclesiastical [deziɲˈɲare]. English speakers will say "DEZ-ig-nar-ay" or "design-AIR-ee". Easy to read, and the "design" link helps.

Collisions: GitHub shows Gigabyte's Designare product line (Z390 Designare, a creator-focused motherboard, appears in many hackintosh repositories) and piscium2010/designare-table, a React table component. npm and PyPI `designare` are free. Gigabyte uses Designare as a brand for creator hardware, which is close in audience though not in product type. From background knowledge, it is also an everyday Italian verb ("to designate") and a common design-agency name.

Risk: medium.

Fit: strong etymology (disegno), but the everyday Latin sense leans to "designate" rather than "draw".

### Linea

Meaning: "linen thread, string; plumb line; a drawn line". Lewis and Short, entry linea (id n26680). The drawing sense is "a thread-like stroke or mark made with a pen, pencil, etc., a line", with Pliny 35.84 as the lead citation and the note "(namely, the proverb: nulla dies sine linea)". Also the geometric line (Gellius 1.20.7, after Varro). Very well attested.

References: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=linea, https://logeion.uchicago.edu/linea, https://en.wiktionary.org/wiki/linea#Latin

Pronunciation: līnea, LI-ne-a. Classical [ˈliːnɛa], ecclesiastical [ˈlinea]. English speakers say "LIN-ee-uh". Easy.

Collisions:
- Linea Sketch by the Iconfactory is a sketching app for iPad and iPhone, App Store id 1094770251 (confirmed by WebSearch: https://apps.apple.com/app/id1094770251, review https://www.macstories.net/reviews/linea-an-elegant-sketching-app-for-the-ipad-from-the-iconfactory/). It is in the same category and well known among iPad artists.
- Linea is also Consensys's Ethereum layer-2 network, with many Consensys/linea-* repositories on GitHub, so it is a strong developer brand.
- npm `linea` is taken ("A javascript library to draw floorplans"), and so is PyPI `linea`.
- GitHub search for the name is swamped by Linear, the issue tracker, and linear-algebra projects.
- From background knowledge, Linea is also La Marzocco's espresso machine line.

Risk: high.

Fit: the best story, but the name is crowded in exactly this category.

### Graphice and Graphis

Graphice: "the art of drawing". Lewis and Short, under graphicus (id n19883): "grăphĭce, ēs, f. (sc. ars), like ἡ γραφική, the art of drawing, Plin. 35, 10, 36, § 77". Pliny NH 35.77 is the only citation for the noun. Pronunciation: graphicē, GRA-phi-ce. Classical [ˈɡrapʰɪkeː], ecclesiastical [ˈɡrafitʃe]. English speakers will not know whether to say "GRAF-ik-ee" or "gra-FEECE", and it reads as a misspelling of "graphic". Collisions: no exact repository name (GitHub results are GraphicEx and the like); npm and PyPI `graphice` are free. Risk: low, but the name is weak.

Graphis: "drawing pencil, sketching pen; drawing, design". Lewis and Short, entry graphis (id n19885): "A drawing-pencil, sketching-pen: pingere collibitum est: graphidem date, Ser. ap. Diom.", and "Transf., drawing; a draught, design: architectum oportet graphidos scientiam habere, Vitr. 1, 1, 4: alias multa graphidis vestigia exstant in tabulis ac membranis ejus, Plin. 35, 10, 36, § 68". Pronunciation: GRA-phis. Classical [ˈɡrapʰɪs], ecclesiastical [ˈɡrafis]. Easy ("GRAF-iss"). Collisions: from background knowledge, Graphis is an international design magazine and publisher (founded in Zurich in 1944, now Graphis Inc. in New York), squarely in the art and design space. npm `graphis` is taken (an icon font). Graphis is also a genus of script lichens. GitHub search is dominated by graph-tool names (graphist, graphistry). Risk: high.

References: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=graphicus, https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=graphis, https://logeion.uchicago.edu/graphis, https://en.wiktionary.org/wiki/graphis#Latin

### Carbo

Meaning: "coal, charcoal". Lewis and Short, entry carbo (id n6742): "a coal, charcoal (dead or burning)". It is used for marking and drawing in Horace S. 2.7.98 ("Proelia rubrica picta aut carbone", battles painted in red ochre or charcoal) and in the phrase "creta an carbone notati" (Hor. S. 2.3.246). Pliny 35.89 has Apelles drawing with "carbone extincto". Well attested.

References: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=carbo, https://logeion.uchicago.edu/carbo, https://en.wiktionary.org/wiki/carbo#Latin

Pronunciation: carbō, CAR-bo. Classical [ˈkarboː], ecclesiastical [ˈkarbo]. Very easy.

Collisions: npm `carbo` is taken (immutable object helpers); PyPI is free. GitHub search for "carbo" is swamped by Carbon: carbon-app/carbon (code images, 36k stars), IBM's Carbon Design System, and the Carbon language. One letter off a design-system brand is a real confusion risk in design tools. English readers also hear "carbs".

Risk: medium to high.

Fit: names one medium (charcoal), not the whole course.

### Stilus

Meaning: "stake; stylus for writing on wax; (transferred) writing, style". Lewis and Short, entry stilus (id n45407): "A style used by the Romans for writing on waxen tablets", and "stilum vertere, for to erase". Its senses are about writing and composition, not drawing.

References: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=stilus, https://logeion.uchicago.edu/stilus, https://en.wiktionary.org/wiki/stilus#Latin

Pronunciation: STI-lus. Classical [ˈstɪlʊs], ecclesiastical [ˈstilus]. Easy, but people will hear and type "stylus".

Collisions: Stylus, the CSS preprocessor (npm `stylus`, "Robust, expressive, and feature-rich CSS superset", confirmed). jw/stilus is a Python port of Stylus that already uses this exact spelling. PyPI `stilus` is taken. From background knowledge, Stylus is also a widely used browser extension for user styles, and "stylus" is the generic word for a drawing pen, so the name could not be protected as a mark.

Risk: high.

### Pingere

Meaning: "to paint; to embroider; to color, adorn". Lewis and Short, entry pingo (id n36349): "to represent pictorially with the pencil or needle, to paint, embroider (cf.: depingo, delineo, adumbro)", for example "pingere hominis speciem" (Cic. de Or. 2.69). Well attested, but it means painting and coloring more than line drawing.

References: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=pingo, https://logeion.uchicago.edu/pingo, https://en.wiktionary.org/wiki/pingo#Latin

Pronunciation: PIN-ge-re. Classical [ˈpɪŋɡɛrɛ], ecclesiastical [ˈpindʒere]. English speakers will hesitate between "PING-er-ee" and "pin-JEER-ee", and it invites "ping" and "pinger" associations from networking.

Collisions: GitHub has yara11/Pingere (a Java paint application, a student project) and a few empty repositories. npm and PyPI are free.

Risk: low to medium.

### Videre

Meaning: "to see". Lewis and Short, entry video (id n50883): "to see, perceive, with the eyes". It is one of the most common Latin verbs. "Learning to see" is a real theme in drawing teaching, but the word says nothing about drawing.

References: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=video, https://logeion.uchicago.edu/video, https://en.wiktionary.org/wiki/video#Latin

Pronunciation: vi-DE-re. Classical [wɪˈdeːrɛ] (v as w), ecclesiastical [viˈdeːre]. English speakers will say "vi-DAIR-ay" or "VID-er-ee". It suggests "video".

Collisions: videre.nvim (a Neovim JSON explorer, 275 stars, active); Gnimuc/Videre (Julia OpenGL and Vulkan examples); videre-project (a Magic: The Gathering Online SDK). npm `videre` and PyPI `videre` are taken. From background knowledge, there is also the human-rights organization Videre est Credere.

Risk: medium to high.

### Ducere (added)

Meaning: "to lead, to draw". Lewis and Short, entry duco (id n14847): "to lead, conduct, draw, bring forward". It is the verb in Pliny's own phrase "lineam ducendo" (35.84). The same idiom appears at 35.81, where Apelles "lineam ex colore duxit summae tenuitatis", and is cited under linea from Pliny 18.327 ("lineam cinere ducere"). Like English "draw", it covers both pulling and making a line.

References: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=duco, https://logeion.uchicago.edu/duco, https://en.wiktionary.org/wiki/duco#Latin

Pronunciation: DU-ce-re. Classical [ˈduːkɛrɛ], ecclesiastical [ˈduːtʃere]. It has the same three-syllable shape as Ludere and Discere. English speakers will say "DOO-cher-ay" or "DOO-ser".

Collisions: GitHub has several small Ducere repositories (a currency converter, a time-management app, a networking platform), none notable. npm and PyPI `ducere` are free. From background knowledge, unverified: Ducere Technologies (India) and Ducere Global Business School (Australia) exist. Without the word "lineam" the default reading is "to lead", and some people will hear "Duce".

Risk: medium.

### Lineamenta (added)

Meaning: "lines, strokes; features; (plural) artists' designs, drawings". Lewis and Short, entry lineamentum (id n26682): "In plur., of the works of artists, designs, drawings, delineations: adumbratorum deorum lineamenta, Cic. N. D. 1, 27, 75: operum lineamenta, Cic. Verr. 2, 4, 44, § 98", and "in geometria lineamenta formae", Cic. de Or. 1.187. Cicero also uses it of sketches and outlines (Brut. 298). Classical and drawing-specific. English "lineaments" comes from it.

References: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=lineamentum, https://logeion.uchicago.edu/lineamentum

Pronunciation: li-ne-a-MEN-ta. Classical [liːnɛaˈmɛnta]. Easy to say, but five syllables.

Collisions: GitHub has only an OCR dump of a Latin book and an unrelated geology script. npm and PyPI are free. From background knowledge, the Vatican uses "Lineamenta" as the title of preparatory documents for the Synod of Bishops, and it appears in many Latin book titles.

Risk: low. Long, and has a slight church-document flavor.

### Penicillus (added)

Meaning: "painter's brush; (transferred) painting, style". Lewis and Short, entry penicillum (id n34502): "A painter's brush or pencil", citing Cicero Fam. 9.22.2 and Quintilian 2.21.24, and Cicero's "quam pingam coloribus tuis, penicillo meo" (Q. Fr. 2.15). Pliny 35.81 has Apelles take up a "penicillus" to draw his fine line. English "pencil" descends from it through Old French.

References: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.04.0059:entry=penicillum, https://logeion.uchicago.edu/penicillus

Pronunciation: pe-ni-CIL-lus. Classical [pɛnɪˈkɪllʊs], ecclesiastical [peniˈtʃillus]. Easy to say.

Collisions: GitHub repository search returned 0 results. npm and PyPI are free. But it reads as "penicillin". Cicero's own explanation in Fam. 9.22 is that the word comes from "penis" in the sense of "tail", which invites jokes. Penicillus is also a genus of green algae.

Risk: low for collisions, poor for connotation.

Considered and dropped: Umbra (Pliny 35.15 says painting began with the outline of a man's shadow, but the name is heavily used by game, graphics and satellite companies). Graphium (a writing stylus, the same problem as Stilus). Monogrammus (an outline-only figure, Cic. ND 2.59, but too obscure).

## Recommendation

1. Lineola. It keeps Pliny's daily line, the strongest story for an app built around daily sessions, without colliding with Linea Sketch or Consensys Linea. It returned no repositories, and the npm and PyPI names are free. It is four short syllables an English speaker can say at first sight, and as a noun it sits naturally beside Fabula, Imago and Luna. The README can tell the story in one sentence: "Apelles never let a day pass without drawing a line (Pliny, NH 35.84); Lineola means a little line."

2. Delineare. It is the most exact verb for drawing an outline, its classical use is Apelles drawing a portrait in charcoal (NH 35.89), English speakers can read its meaning through "delineate", and it follows the Ludere and Discere infinitive pattern. Run a trademark check against Delinea before choosing it.

If a shading-first identity is wanted, Adumbrare is the cleanest alternative on collisions. Avoid Linea, Graphis, Stilus and Videre.

Before committing, run App Store and Google Play searches and a USPTO search (classes 9, 41, 42) for the chosen name. None of those could be reached from this session.

## Pliny passages, verified

Latin from Mayhoff's Teubner edition (Perseus text 1999.02.0138), checked against the Perseus source file on GitHub. English from Bostock and Riley, 1855 (Perseus text 1999.02.0137), checked the same way. Lewis and Short cite these passages as "Plin. 35, 10, 36, § 77" and "§ 84": book 35, chapter 10 in Mayhoff's numbering, chapter 36 in the older numbering Perseus uses for the English, then the section number.

Perseus URLs (blocked from this session, given as the standard references):
- Latin: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.02.0138:book=35:chapter=36
- English: https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.02.0137:book=35:chapter=36

Source files actually read:
- https://raw.githubusercontent.com/PerseusDL/canonical-latinLit/master/data/phi0978/phi001/phi0978.phi001.perseus-lat2.xml
- https://raw.githubusercontent.com/PerseusDL/canonical-latinLit/master/data/phi0978/phi001/phi0978.phi001.perseus-eng1.xml

I could not reach LacusCurtius (penelope.uchicago.edu) to check whether it carries Book 35.

### NH 35.84, Apelles and the daily line

Latin: "Apelli fuit alioqui perpetua consuetudo numquam tam occupatum diem agendi, ut non lineam ducendo exerceret artem, quod ab eo in proverbium venit."

Literal translation: "Apelles also had an unbroken habit of never letting a day be so busy that he did not practise his art by drawing a line; from him this passed into a proverb."

Bostock and Riley: "It was a custom with Apelles, to which he most tenaciously adhered, never to let any day pass, however busy he might be, without exercising himself by tracing some outline or other; a practice which has now passed into a proverb."

Note: Pliny reports that a proverb grew from the habit but does not quote it. The words "nulla dies sine linea" are not in Pliny.

### NH 35.76 to 77, Pamphilus and graphice

Latin, 35.76 end: "... primus in pictura omnibus litteris eruditus, praecipue arithmetica et geometria, sine quibus negabat artem perfici posse, docuit neminem talento minoris, annuis X D, quam mercedem et Apelles et Melanthius dedere ei."

Latin, 35.77: "huius auctoritate effectum est Sicyone primum, deinde in tota Graecia, ut pueri ingenui omnia ante graphicen, hoc est picturam in buxo, docerentur recipereturque ars ea in primum gradum liberalium. semper quidem honos ei fuit, ut ingenui eam exercerent, mox ut honesti, perpetuo interdicto ne servitia docerentur."

Text notes: Mayhoff prints the manuscript order "omnia ante". The older vulgate reads "ante omnia", and Gelenius read "diagraphicen" for "graphicen". The digitized file has "fruit" for "fuit", an obvious scanning error, corrected above. "X D" is 500 denarii.

Literal translation: "Through his influence it came about, first at Sicyon and then in all Greece, that freeborn boys were taught graphice, that is, drawing on boxwood, before everything else, and that this art was received into the first rank of the liberal arts. It has always been held in honour: freeborn people practised it, and later men of rank, and it was always forbidden to teach it to slaves."

Bostock and Riley: "It was through his influence that, first at Sicyon, and then throughout the whole of Greece, all children of free birth were taught the graphic art, or in other words, the art of depicting upon boxwood, before all others; in consequence of which this came to be looked upon as the first step in the liberal arts. It is the fact, however, that this art has always been held in high estimation, and cultivated by persons of free birth, and that, at a more recent period, men of rank even began to pursue it; it having always been forbidden that slaves should receive instruction in it."

The fee in 35.76 (Bostock and Riley): "He gave instruction to no one for a smaller sum than one talent, at the rate of five hundred denarii per annum, and this fee both Apelles and Melanthius paid."

### Related passages useful for naming copy

- NH 35.81 to 83, the contest of lines: Apelles, finding Protogenes out, "adreptoque penicillo lineam ex colore duxit summae tenuitatis per tabulam" (took up a brush and drew a line of the utmost fineness across the panel). Protogenes drew a finer line inside it in another color, and Apelles cut both lengthwise with a third, "nullum relinquens amplius subtilitati locum".
- NH 35.89, the charcoal portrait: "arrepto carbone extincto e foculo imaginem in pariete delineavit" (the only classical use of delineo).
- NH 35.15, the origin of painting: "omnes umbra hominis lineis circumducta" (all agree it began with tracing round a man's shadow in lines).
- NH 35.151, Butades' daughter: "umbram ex facie eius ad lucernam in pariete lineis circumscripsit" (she outlined the shadow of her lover's face on the wall by lamplight).

### Where "nulla dies sine linea" first appears

Erasmus has the saying, but not in the familiar wording. His Adagia I.iv.12 is "Nullam hodie lineam duxi" ("I have drawn no line today"), built on this Pliny passage. This is confirmed by Hardouin's note on Pliny 35.84, "vide Erasmum Chil. 1, cent. 4, Adag. 12: Nullam hodie lineam duxi" (OCR in the GitHub repositories latin-ocr/caiipliniisecun00hardgoog, file caiipliniisecun00hardgoog_0348.txt, and latin-ocr/historinaturali00mgoog, file historinaturali00mgoog_0349.txt), and by the adage list in the Manutius index of the Adagia (nevenjovanovic/camena-neolatinlit, file thesaurus/Manutius_index_proverbiorum_iuxta_locos.xml).

The exact form "nulla dies sine linea" is credited to Polydore Vergil's Proverbiorum libellus (Venice: Christophorus de Pensis, 1498), the first printed collection of Latin proverbs, two years before Erasmus's Adagiorum collectanea (1500). The 1498 date and printer come from WebSearch results citing English Wikipedia (https://en.wikipedia.org/wiki/Nulla_dies_sine_linea) and the Morgan Library catalog (https://themorgan.org/print/176176). A Spanish Wikipedia mirror cites fol. 16 of the 1498 edition. I could not open a scan of the 1498 edition to confirm the wording at first hand.

## Sources

- Lewis and Short, Perseus XML: https://github.com/PerseusDL/lexica/blob/master/CTS_XML_TEI/perseus/pdllex/lat/ls/lat.ls.perseus-eng2.xml
- Pliny NH, Latin (Mayhoff) and English (Bostock and Riley): https://github.com/PerseusDL/canonical-latinLit/tree/master/data/phi0978/phi001
- Linea Sketch: https://apps.apple.com/app/id1094770251 and https://www.macstories.net/reviews/linea-an-elegant-sketching-app-for-the-ipad-from-the-iconfactory/
- Nulla dies sine linea: https://en.wikipedia.org/wiki/Nulla_dies_sine_linea
- Polydore Vergil 1498 edition: https://themorgan.org/print/176176
- npm registry checks: https://registry.npmjs.org/<name>; PyPI checks: https://pypi.org/pypi/<name>/json
- GitHub repository search results cited above: Consensys/linea-contracts, SeaDve/Delineate, seven-of-eleven/designare-z390-opencore-efi, jw/stilus, Owen-Dechow/videre.nvim, carbon-app/carbon, carbon-design-system/carbon, yara11/Pingere
