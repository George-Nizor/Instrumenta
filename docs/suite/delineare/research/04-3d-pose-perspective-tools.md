# 3D, pose and perspective tools: survey and build plan

Checked on 2026-10-13. Machine-readable version: `04-3d-pose-perspective-tools.json` (58 rows, same verdicts).

## How this was checked, and its limits

Direct page fetches (WebFetch and curl) were blocked by this environment's network policy for every tool site tried (posemy.art, justsketch.me, magicposer.com, posemaniacs.com, terawell.net, setpose.com, sketchfab.com, polyhaven.com, kenney.nl, 3d.si.edu). Two hosts were reachable: raw.githubusercontent.com and the npm registry.

So the evidence comes in three levels, and every row says which:

- Opened: a licence or source file read directly on raw.githubusercontent.com (three.js, mannequin.js, MakeHuman, WebXR Input Profiles, Khronos glTF Sample Assets, Smithsonian Voyager, PyVista). These are the only pages I actually opened.
- Search: facts taken from web search result summaries that quote the official pages. The pages themselves were not opened, so prices and terms here should be rechecked before they are shown to learners.
- Not checked: the shared web search budget ran out partway through. Perspective tools, light and value tools, SenshiStock, AdorkaStock, iNaturalist, Poly Haven, Kenney and Quaternius rest on prior knowledge only and are marked unconfirmed.

This does not change the main conclusions. The things we would bundle were all confirmed from licence files I opened.

## Short answer

Link out to: Line of Action (timed figure, hands, faces, animals, environments, basic shapes), Quickposes, PoseMyArt, JustSketchMe, Posemaniacs (30-second flayed figures), Zygote Body (free anatomy), New Masters Academy free sessions, Croquis Cafe, Handy (paid phone app for hands and heads under light). Link the paid apps (Magic Poser, Clip Studio, Complete Anatomy, Cascadeur, Human Generator) as optional extras only.

Embed: Sketchfab only (official iframe, Viewer API, oEmbed), for CC BY head-planes models, anatomy and skeletons that we should not redistribute. YouTube embeds are possible for ordinary videos, but the figure session channels are often age-restricted, so link those.

Build in three.js: a perspective form viewer, a light-on-form tool with posterise, a primitive-based poseable mannequin, a hand poser on the MIT WebXR hand, a head viewer on two CC0 Smithsonian scans, and a random-view drill that reuses all of them. Add two small 2D tools: a printable perspective and curvilinear grid generator, and a value checker for photos of the learner's own drawing.

## Survey

Evidence column: O = opened, S = search results only, N = not checked.

### Pose and mannequin

| Tool | Good for | Cost | Platforms | Licence and embedding | Offline | Verdict | Ev. |
|---|---|---|---|---|---|---|---|
| PoseMyArt, posemy.art | figure, gesture, hands, camera angles | Free core; paid tier price unconfirmed | Web, mobile browsers | Proprietary; no embed found | No | Link | S |
| JustSketchMe, justsketch.me | figure, hands, heads | Free with limits; Pro from $12/month, 50% off yearly, once-off option | Web, Windows, macOS, iOS, Android, Linux on request | Proprietary; one key for all devices | Apps likely | Link | S |
| Magic Poser | figure, multi-figure scenes | Freemium; Master about $14.99/month; Pro unlock $4.99 to $9.99 | iOS, Android, web (weak source) | Proprietary | Apps | Link | S |
| DesignDoll (Terawell) | figure, proportion | Free limited; pro was $79 in an old source | Windows | Proprietary | Yes | Link, low priority | S |
| Clip Studio Paint 3D figures, head model | figure, hands, heads | PRO $49.99 one-time; plans from $4.49/month | Desktop and tablets | Proprietary | Yes | Link if learner uses it | S |
| Posemaniacs | gesture (30-second flayed figures), hands | Free | Web | Proprietary | No | Link | S |
| SetPose | figure | Said to be free | Web | Unknown | No | Link, low priority | S |
| Easy Poser (Madcatgames) | figure on phone | Free, Pro about $4.99 | iOS; Android unconfirmed | Proprietary | Yes | Link | S |
| ArtPose | figure | $2.99 each edition, Pro $5.99 (2022 data) | iOS | Proprietary | Yes | Link, low priority | S |
| Cascadeur | dynamic poses, invention | Free non-commercial; Indie about $8/month yearly; Pro about $49/month (aggregators) | Desktop | Proprietary | Yes | Link, optional | S |
| Sketchfab poseable models | figure, anatomy, animals | Free to view | Web | Per-model licence; official iframe, Viewer API, oEmbed | No | Embed | S |
| Blender with Rigify | scenes, cameras, value renders | Free | Windows, macOS, Linux | GPL | Yes | Link, advanced | N |
| Human Generator Ultimate | realistic figures in Blender | $68 personal, $128 commercial | Blender 3.6 to 5.0 | GPL listed for add-on | Yes | Link, optional | S |
| MakeHuman and MPFB | base figure source | Free | Desktop, Blender add-on | Code AGPL/GPL; assets and exports CC0 | Yes | Build (use CC0 export) and link | O |
| mannequin.js | primitive mannequin reference | Free | Web | GPL-3.0, keep out of MIT repo | No | Link | O |
| Mixamo | animation | Free with Adobe account | Web | No raw-file redistribution | No | Link, do not bundle | S |

### Hands and heads under light

| Tool | Good for | Cost | Platforms | Licence and embedding | Offline | Verdict | Ev. |
|---|---|---|---|---|---|---|---|
| Handy Art Reference Tool (Belief Engine) | hands, heads, skulls, 3-point light rig | $1.99 iOS plus IAP; about EUR 2.16 Android | iOS, Android | Proprietary; reports of launch issues after updates | Yes | Link | S |
| Manus | hands, free light | $1.99 | iOS (iPad) | Proprietary | Yes | Link, optional | S |
| Proko Plane Head Pro Bundle | heads, light on planes | $5 (OBJ, ZTL, PDF, cheat sheets) | Download | Licence not read; personal use assumed | Yes | Link, do not bundle | S |
| "planes of the head Asaro" by IdonKorch, Sketchfab | heads, planes | Free | Web | CC BY 4.0 per a third-party page only | No | Embed until licence confirmed | S |
| "Planes of the Head - Andrew Loomis Method" by Josh Galeto, Sketchfab | heads, Loomis construction | Free | Web | CC Attribution per search | No | Embed | S |
| Smithsonian George Washington bust (NPG.70.4) | heads, light and form | Free | Download | CC0 | Yes once bundled | Build (bundle) | S + O |
| Smithsonian Lincoln life masks (1860, 1865) | heads, features | Free | Download | CC0 | Yes once bundled | Build (bundle) | S + O |
| WebXR Input Profiles generic hand | hands, posable | Free | glTF | MIT, (c) 2019 Amazon | Yes once bundled | Build (bundle) | O |

### Anatomy in 3D

| Tool | Good for | Cost | Platforms | Licence and embedding | Offline | Verdict | Ev. |
|---|---|---|---|---|---|---|---|
| Zygote Body | muscles, bones, landmarks | Lite $0; Premium $4/month; Professional $98/month | Web (WebGL) | Proprietary; no embed found | No | Link | S |
| Complete Anatomy (Elsevier) | deep anatomy | Student $74.99/year, Professional $99.99/year | iOS, Android, Windows, macOS | Proprietary | Yes | Link, optional | S |
| Visible Body Human Anatomy Atlas | anatomy | About $24.99 iOS | Web, iOS, Android | Proprietary | Yes | Link, optional | S |
| BioDigital Human | anatomy | Free plan capped at 10 model views/month | Web, iOS, Android | Embedding only on paid plans | No | Link | S |
| Anatomy 360 (Ten24) | scanned nude poses | Packs from GBP 9.99 (2017) | Desktop | Proprietary | Yes | Link, optional | S |
| Smithsonian 3D (3d.si.edu) | busts, skeletons, objects | Free | Web, downloads | CC0 where marked; Voyager viewer Apache-2.0 | Bundled yes | Link, bundle chosen CC0 | S + O |
| Smithsonian Human Origins 3D | skulls | Free | Downloads | Primates non-commercial only | No | Link | S |
| Scan the World (MyMiniFactory) | classical busts, cast drawing | Free | Downloads | Per object, often CC BY-NC-SA | No | Link | S |
| Sketchfab CC BY ecorche and skulls | anatomy, heads | Free | Web | Per model | No | Embed | S |

### Gesture and timed reference

| Tool | Good for | Cost | Platforms | Licence and embedding | Offline | Verdict | Ev. |
|---|---|---|---|---|---|---|---|
| Line of Action | figure, hands and feet, faces, animals, basic shapes and still life, environments | Original features free; newer features need membership | Web | Nude by default, can be turned off; no embed found | No | Link (top pick) | S |
| Quickposes | timed gesture, 20-image challenges | Free | Web | No embed found | No | Link | S |
| SketchDaily Reference | timed figure, 360 viewer | Free (unconfirmed) | Web | Unknown | No | Link | S |
| Croquis Cafe (On Air Video) | 1, 2, 5 minute model sessions, 360 single poses | Free on YouTube; membership for more | YouTube | Many videos age-gated | No | Link | S |
| New Masters Academy Daily Life Drawing Sessions | 1, 2, 5, 10 minute poses | Free sessions; Vilppu stream free with RSVP | Web | Proprietary | No | Link | S |
| Proko | gesture lessons, timer | Free lessons; paid courses | Web, YouTube | Proprietary | No | Link | S |
| Character Design References visual library | directory of pose tools | Free to browse | Web | Proprietary | No | Link | S |
| SenshiStock | pose photo packs | Free (unconfirmed) | DeviantArt | Own rules, not read | No | Link | N |
| AdorkaStock | costume and action poses | Unconfirmed | Web | Own rules, not read | No | Link | N |

### Perspective

| Tool | Good for | Cost | Platforms | Licence and embedding | Offline | Verdict | Ev. |
|---|---|---|---|---|---|---|---|
| Clip Studio perspective rulers (incl. fisheye since 2.0) | digital perspective | See above | Desktop, tablets | Proprietary | Yes | Link | S |
| Krita assistants | vanishing point and fisheye assistants | Free | Desktop, Android | GPL | Yes | Link | N |
| SketchUp Free | block out rooms and buildings | Free web plan | Web | Proprietary | No | Link | N |
| Blender | true camera views | Free | Desktop | GPL | Yes | Link, advanced | N |
| Google Earth and Street View | urban 1, 2, 3-point reference | Free | Web, apps | Google terms | No | Link | N |
| Khan Academy Pixar in a Box | cameras, perspective basics | Free | Web | Khan terms | No | Link | N |
| Ciechanowski, Cameras and Lenses | focal length, projection | Free | Web | Author copyright | No | Link | N |
| Perspective and curvilinear grid generators | grids | Free | Web | Various | No | Build our own | N |

### Light and value

| Tool | Good for | Cost | Platforms | Licence and embedding | Offline | Verdict | Ev. |
|---|---|---|---|---|---|---|---|
| Lighting spheres, notan, posterise, value checkers | light and form, value grouping | Free | Various | Various | Varies | Build our own | N |
| Handy (see above) | lit heads and hands | $1.99 | iOS, Android | Proprietary | Yes | Link | S |

### Animals and nature

| Tool | Good for | Cost | Platforms | Licence and embedding | Offline | Verdict | Ev. |
|---|---|---|---|---|---|---|---|
| Line of Action animals tool | timed animal gesture | Free | Web | See above | No | Link | S |
| Sketchfab animated Triceratops skeleton (Smithsonian scan) | skeleton construction | Free | Web | Listed CC0 (re-upload, confirm) | No | Embed | S |
| Khronos sample Fox | simple quadruped, animated | Free | glTF | Model CC0; rig and animation CC BY 4.0 | Yes once bundled | Build (bundle) | O |
| iNaturalist | real animal and plant photos | Free | Web, apps | Licence per photo | No | Link | N |

### Objects and environments

| Tool | Good for | Cost | Platforms | Licence and embedding | Offline | Verdict | Ev. |
|---|---|---|---|---|---|---|---|
| Khronos glTF Sample Assets | still-life props | Free | glTF | Per model; many CC0 | Yes once bundled | Build (bundle) | O |
| Poly Haven | models, HDRIs | Free | Downloads | CC0 (unconfirmed) | Yes once bundled | Build, after licence check | N |
| Kenney | low-poly buildings, props, vehicles | Free | Downloads | CC0 (unconfirmed) | Yes once bundled | Build, after licence check | N |
| Quaternius | low-poly animals, nature, buildings | Free | Downloads | CC0 (unconfirmed) | Yes once bundled | Build, after licence check | N |

## Embedding notes

Sketchfab is the one site in this survey that offers official embedding: an iframe player, the Viewer API (a script tag plus an empty iframe, initialised by model id; current docs load version 1.12.1) and an oEmbed endpoint at sketchfab.com/oembed that its help centre says allows embedding any model on any website. Embedding a model is separate from the right to download it; the per-model licence still applies to downloads. The Sketchfab developer terms (sketchfab.com/developers/terms) were not read. Use embeds for models we do not bundle, show the model title, author and licence next to the frame, and fall back to a plain link card when the app is offline.

YouTube embeds work through the official iframe player, but age-restricted videos (common for nude figure sessions) generally do not play inside embeds, and YouTube embeds also expect a normal http origin, which matters if the Electron launcher ever loads the app from file:// rather than a local http server (both points are prior knowledge, unconfirmed). Link Croquis Cafe and similar sessions instead.

Smithsonian Voyager (Apache-2.0, LICENSE opened) has documented embed instructions, but we do not need it: the CC0 meshes can load straight into our own three.js viewer.

Every other site in the survey: no official widget found, so link out with credit.

## Bundle-safe models for a public MIT repository

Keep code under MIT and put 3D assets in their own folder with a `CREDITS.md` and the licence text of each asset. CC0 and MIT assets need nothing more; CC BY 4.0 assets stay CC BY (not MIT), need the credit line, a link to the licence, and a note of changes such as "decimated and converted to GLB".

| Model | Exact URL | Author or holder | Licence | Evidence | Use |
|---|---|---|---|---|---|
| Generic hand, left.glb and right.glb | https://github.com/immersive-web/webxr-input-profiles/tree/main/packages/assets/profiles/generic-hand | WebXR Input Profiles contributors, (c) 2019 Amazon | MIT | Opened `packages/assets/LICENSE.md`; inspected left.glb: one skinned mesh, 25 joints named per the WebXR hand spec, 94 KB | Hand poser |
| George Washington marble bust, NPG.70.4 | https://3d.si.edu/object/3d/george-washington:d8c63fde-4ebc-11ea-b77f-2e728ce88125 | National Portrait Gallery, Smithsonian; bust attributed to Massimiliano Ravenna after Giuseppe Ceracchi, c. 1819 | CC0 | Smithsonian record via search; PyVista source (opened) quotes the Smithsonian CC0 statement and mirrors a 16 MB OBJ | Head viewer |
| Abraham Lincoln life mask, Clark Mills 1865 (NPG.71.26), and Leonard Volk 1860 (NPG.71.24) | https://3d.si.edu/object/3d/abraham-lincoln:c02c239d-5ebf-4a7a-a368-e2288bbf4b31 and https://3d.si.edu/object/3d/abraham-lincoln:2b4a081a-9ea1-4b0c-b1c3-6f5389da3244 | National Portrait Gallery, Smithsonian | CC0 | Search shows both 3D pages state public domain; which record is Mills and which Volk is unconfirmed; PyVista (opened) mirrors the Mills mask | Head viewer (face only) |
| MakeHuman base mesh and default skeleton (our own export) | https://github.com/makehumancommunity/makehuman | MakeHuman team | CC0 assets; project claims nothing over exports | Opened LICENSE.md sections C and D | Optional realistic body for the mannequin |
| Fox | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox | PixelMannen (model), tomkranis (rig and animation), @AsoboStudio and @scurest (glTF conversion) | Model CC0; rig, animation and conversion CC BY 4.0 | Opened README Legal section | Animal drills, random view |
| WaterBottle, Avocado, BoomBox | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models | Microsoft | CC0 | Opened each README | Still life, light on form |
| Lantern | .../Models/Lantern | Microsoft, sbtron, Frank Galligan | CC0 | Opened | Still life |
| Corset, AntiqueCamera | .../Models/Corset, .../Models/AntiqueCamera | UX3D (Maximillan Kamps for the camera) | CC0; UX3D logo on the camera is a trademark | Opened | Still life |
| SheenChair | .../Models/SheenChair | Wayfair, Eric Chadwick | CC0 | Opened | Furniture in perspective |
| FlightHelmet | .../Models/FlightHelmet | Public, Gary Hsu (conversion) | CC0 | Opened | Complex object drill |
| ToyCar | .../Models/ToyCar | Guido Odendahl | CC0 | Opened | Vehicle construction |
| Suzanne | .../Models/Suzanne | UX3D, Norbert Nopper | CC0 | Opened | Simple head-like form |
| ABeautifulGame (chess set) | .../Models/ABeautifulGame | ASWF (MaterialX Project), Ed Mackey | CC BY 4.0 | Opened | Still life, cylinders and ellipses |
| ChairDamaskPurplegold, GlamVelvetSofa, StainedGlassLamp | .../Models/<name> | Wayfair, Eric Chadwick | CC BY 4.0 | Opened | Interiors |

Not bundle-safe, or not yet:

- Asaro-style head planes on Sketchfab (IdonKorch): CC BY 4.0 only according to a third-party itch.io page; the model page was not seen. The design also reproduces John Asaro's commercial planes head, so embed it, do not redistribute it.
- Josh Galeto's Loomis planes model: licence seen only in a search summary; embed.
- Mixamo characters and animations, including three.js example characters Xbot and Michelle: Adobe does not allow redistribution of raw files.
- mannequin.js: GPL-3.0; adding it would pull GPL obligations into the MIT repo.
- Scan the World busts: per object, many CC BY-NC-SA.
- Smithsonian Human Origins primate scans: non-commercial only.
- Khronos BrainStem (Poser EULA) and Duck (SCEA licence).
- Proko Plane Head, Anatomy 360 packs, Handy assets: purchased content.
- Poly Haven, Kenney, Quaternius: very likely CC0, but not confirmed this session; check each licence page before adding files.
- No CC0 or CC BY human skull or ecorche model was confirmed this session.

## In-app 3D tools to build

Shared base: one three.js scene shell (exact pinned version, MIT) with OrbitControls, a shared light rig module, an SVG overlay layer above the canvas for lines and labels, a seeded random generator, PNG export, a phone layout with large touch targets, and no network calls. All assets ship locally, so every tool works offline beside the paper.

### 1. Form viewer with horizon and vanishing points

An orbitable scene of primitives (box, stacked boxes, cylinder, cone, sphere, a small "city block") on a ground grid, with a camera whose focal length runs from about 18 mm to 100 mm equivalent. For each box edge direction d, the tool projects the homogeneous point (d, 0) through the view and projection matrices: when w is near zero the edges are parallel to the picture plane (shown as "parallel", no vanishing point), otherwise the screen point is the vanishing point, drawn even when off-canvas with an arrow and distance. The horizon is the line through the vanishing points of any two horizontal directions. Presets snap to 1-point (a face parallel to the picture plane, camera level), 2-point (box yawed, camera level, verticals stay parallel) and 3-point (camera pitched). Extra overlays: the 60 degree cone of vision to explain edge distortion, ellipse major and minor axes on cylinders (minor axis along the cylinder's axis), and a centre-of-vision mark. A compare mode overlays a photo of the learner's drawing at adjustable opacity. Modules: construction, perspective, environments.

### 2. Light on form

Sphere, cube, cylinder, cone and egg (plus any bundled model: bust, hand, mannequin, still-life props) on a ground plane, lit by one key light the learner drags around a light dome by azimuth and elevation, switchable between sun (directional, parallel shadows) and lamp (point light, radiating shadows). A fill slider sets ambient level and a bounce slider sets ground albedo feeding a hemisphere light, which makes reflected light visible in the shadow side. Shadows use a soft shadow map; contact or occlusion shadow comes from an ambient occlusion pass. A custom shader marks the terminator band where N dot L crosses zero and can label highlight, light, halftone, core shadow, reflected light, cast shadow and occlusion shadow. A post pass converts to luminance and posterises into 2 to 5 values with draggable thresholds (2 values gives a notan), with a grayscale toggle, a 10-step value scale and a tap-to-read value probe. A shadow construction overlay draws rays from the light through box corners to the ground and, for sun light, the shadow vanishing point on the horizon, which serves the perspective shadows module. Modules: light and form, perspective (shadows), heads, hands.

### 3. Poseable mannequin

A figure built only from primitives, so there is no licence question: rib cage and pelvis blocks with a flexible waist, cylinder or tapered limbs, sphere joints, mitten or box hands, egg head with jaw. About 19 joints (pelvis root, two or three spine joints, neck, head, clavicles, shoulders, elbows, wrists, hips, knees, ankles, toes) with joint limits. Select a part by tapping, then rotate with a gizmo or sliders; mirror left and right; reset. Proportion presets: idealised 8 heads, average 7.5 heads, child. Display modes: boxes (construction), beans (gesture), smooth. Overlays: line of action through head, spine, pelvis and supporting leg; balance line dropped from the pit of the neck; shoulder and hip tilt lines for contrapposto. A handful of starter poses written in-house; learner poses saved locally as JSON. Later, a CC0 MakeHuman export can be skinned to the same skeleton for a realistic body. mannequin.js shows this approach works but is GPL, so write ours from scratch. Modules: figure and gesture, construction, invention.

### 4. Hand poser

Loads the MIT WebXR generic hand (left.glb, mirrored right.glb), whose 25 named joints allow full finger posing. Controls: per-finger curl that spreads rotation over the proximal, intermediate and distal joints, finger spread, thumb opposition, wrist bend and twist. Presets: relaxed, fist, point, pinch, cup, grip on a cylinder, flat. A box-hand overlay computed from joint positions (palm wedge, finger segment boxes) teaches construction. Uses the shared light rig and posterise pass. The mesh is low detail, which suits gesture and construction rather than surface anatomy; link Handy or Zygote Body for detail. Modules: hands, construction, light and form.

### 5. Head viewer

Two CC0 Smithsonian scans (the Washington bust and the Lincoln life mask), pre-processed once with a mesh simplifier into GLB files of about 1 to 3 MB each; the 16 MB originals stay out of the repo. Modes: smooth; "simplified planes", a precomputed heavy decimation (roughly 800 to 2000 triangles) with flat shading that reads as a planes head, labelled as our simplification and not as the Asaro design; and a Loomis overlay (sphere, side-plane ellipse, brow, nose and chin lines, centre line) aligned per model by a stored transform. Also a procedural Loomis head made of primitives as the default, so the tool works even without scans. Angle presets: front, three-quarter, profile, from below, from above. Shared light rig, posterise and random view. When online, a "see also" panel embeds the Sketchfab planes models with credit. Modules: heads, light and form.

### 6. Random "view from here" drill

Picks a subject (box stack, cylinder, primitive still life, a Khronos CC0 object, a saved mannequin or hand pose, the fox, a bust) and a seeded random camera: azimuth all round, elevation about -60 to +75 degrees, focal length within a set range, subject rotation, with rules that reject degenerate views. Flow: show for a set time or until tapped, optionally hide, the learner draws, then reveal the construction overlay (bounding-box edges, vanishing points, horizon, centre lines, ellipse axes) and a self-rating. The seed is stored so a session can be repeated. A "rotate it" variant shows one view and asks for the view rotated 90 degrees before revealing it. Modules: construction, perspective, figure and gesture, animals, invention.

### Two small 2D companions

Perspective grid generator: place horizon and 1, 2 or 3 vanishing points, or choose 4 or 5-point curvilinear, set line density, and export SVG or PNG at A4, A3 or Letter, or show full screen on the phone beside the paper. Value checker: take or load a photo of the learner's drawing or reference (local only), then grayscale, blur to squint, posterise into 2 to 5 values or notan, and show side by side with the reference. Both are a few hundred lines of canvas or SVG code and replace a long tail of third-party generators.

## Credit lines

Bundled assets:

- three.js, MIT licence, Copyright 2010-2026 three.js authors. https://threejs.org/
- Generic hand model from WebXR Input Profiles (https://github.com/immersive-web/webxr-input-profiles), MIT licence, Copyright (c) 2019 Amazon.
- George Washington, marble bust attributed to Massimiliano Ravenna after Giuseppe Ceracchi, c. 1819. National Portrait Gallery, Smithsonian Institution (NPG.70.4). 3D model via Smithsonian Open Access, CC0. Simplified and converted to GLB.
- Abraham Lincoln life mask by Clark Mills, 1865 (1917 cast). National Portrait Gallery, Smithsonian Institution (NPG.71.26). 3D model via Smithsonian Open Access, CC0. Simplified and converted to GLB.
- Base figure exported from MakeHuman (makehumancommunity.org); MakeHuman assets are CC0 1.0.
- Fox model by PixelMannen (CC0); rigging and animation by tomkranis (CC BY 4.0, https://creativecommons.org/licenses/by/4.0/); glTF conversion by @AsoboStudio and @scurest (CC BY 4.0). From KhronosGroup glTF-Sample-Assets.
- WaterBottle, Avocado and BoomBox by Microsoft, CC0. Lantern by Microsoft, sbtron and Frank Galligan, CC0. Corset by UX3D, CC0. AntiqueCamera by Maximillan Kamps for UX3D, CC0. SheenChair by Eric Chadwick for Wayfair, CC0. FlightHelmet, CC0 (conversion by Gary Hsu). ToyCar by Guido Odendahl, CC0. Suzanne by Norbert Nopper for UX3D, CC0. All from KhronosGroup glTF-Sample-Assets.
- A Beautiful Game: original model (c) 2020 ASWF, MaterialX Project; glTF by Ed Mackey (c) 2022. CC BY 4.0. From KhronosGroup glTF-Sample-Assets.
- ChairDamaskPurplegold, GlamVelvetSofa and StainedGlassLamp by Eric Chadwick for Wayfair, CC BY 4.0. From KhronosGroup glTF-Sample-Assets.

Link-outs and embeds (shown beside each link):

- Line of Action, line-of-action.com
- Quickposes, quickposes.com
- PoseMyArt, posemy.art
- JustSketchMe, justsketch.me
- Posemaniacs, posemaniacs.com
- Zygote Body, zygotebody.com
- New Masters Academy, nma.art
- Croquis Cafe by On Air Video
- Handy Art Reference Tool by Belief Engine
- Sketchfab embeds: "model title" by author on Sketchfab, licence name, copied from each model page

## Sources

Opened directly (raw.githubusercontent.com):

- https://raw.githubusercontent.com/mrdoob/three.js/dev/LICENSE
- https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/webgl_materials_normalmap.html and webgl_animation_skinning_blending.html (to see how three.js credits its example models)
- https://raw.githubusercontent.com/boytchev/mannequin.js/master/LICENSE and README.md
- https://raw.githubusercontent.com/makehumancommunity/makehuman/master/LICENSE.md
- https://raw.githubusercontent.com/immersive-web/webxr-input-profiles/main/LICENSE.md, packages/assets/README.md, packages/assets/LICENSE.md, packages/assets/profiles/generic-hand/left.glb
- https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/model-index.json and the README.md of each model listed above
- https://raw.githubusercontent.com/Smithsonian/dpo-voyager/master/LICENSE.md and README.md
- https://raw.githubusercontent.com/pyvista/pyvista/main/pyvista/examples/downloads.py (Smithsonian CC0 statements for the Washington bust and Lincoln mask)

Seen only in search result summaries (not opened): posemy.art/features; justsketch.me; App Store listings for Magic Poser (id1141755970), JustSketchMe (id1543663234), Easy Pose (id1335872207), ArtPose (id836464625), Handy (id478643661), Manus (id1326075156); alternativeto.net pages for PoseMyArt, JustSketchMe, DesignDoll; posemaniacs.com/tools/thirtyseconds and tips.clip-studio.com/en-us/articles/8927; clipstudio.net product pages; Cascadeur aggregator pages (capterra, toolradar); superhivemarket.com/products/humgen3d; static.makehumancommunity.org/about/license.html; beliefengine.com/presskit/handy/; proko.com/tool/plane-head-pro-bundle; peheut.itch.io/asaro-head; sketchfab.com/developers/viewer and help.sketchfab.com API overview; 3d.si.edu object pages for the Washington bust and Lincoln masks; si.edu/openaccess and dashboard.si.edu/openaccess/faq; humanorigins.si.edu/evidence/3d-collection; myminifactory.com Scan the World object pages; zygotebody.com/pricing; elsevier.support Complete Anatomy pricing pages; apppricinglab.com for Human Anatomy Atlas; pricing.biodigital.com; cgchannel.com Anatomy 360 launch article; line-of-action.com pages; quickposes.com/en/gestures/timed; characterdesignreferences.com/visual-library; nma.art pages; proko.com community pages; parkablogs.com and 3dvf.com on Croquis Cafe; community.adobe.com Mixamo FAQ threads; sketchfab.com/3d-models/animated-triceratops-skeleton-06cb55f941d94dc8b95ac46f92d89e7c.

Not checked (search budget exhausted): Krita, SketchUp Free, Google Earth and Street View, Khan Academy Pixar in a Box, Ciechanowski's Cameras and Lenses, curvilinear grid generators, lighting sphere and value tools, SenshiStock, AdorkaStock, iNaturalist, Poly Haven, Kenney, Quaternius, Blender Rigify.

## To verify before shipping

- Open the IdonKorch and Josh Galeto Sketchfab pages; record exact URLs and licence versions.
- Confirm which 3d.si.edu Lincoln record is the Mills mask and which is the Volk mask, and download originals from 3d.si.edu rather than the PyVista mirror where possible.
- Read the Sketchfab developer terms and confirm embedding is not disabled on chosen models.
- Confirm the licence pages for Poly Haven, Kenney and Quaternius before bundling anything from them.
- Recheck prices for PoseMyArt, Line of Action membership, Magic Poser and Clip Studio, which conflict across sources.
- Pick and confirm CC0 animal skeletons on 3d.si.edu and a CC BY ecorche and skull on Sketchfab.
