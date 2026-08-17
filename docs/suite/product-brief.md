# Instrumenta product brief

## Overall direction

Instrumenta is a toolkit of local creative applications with a visual launcher as the front door:

- **Motus** — a native, performance-oriented video editor.
- **Imago** — an image/photo editor.
- **Ludere** — a screenplay-writing tool inspired by VOM Draft, focused on accepted screenplay
  formatting and intelligent authoring shortcuts.

The launcher should feel like a finished creative suite rather than a basic React-style app block.
It should lead with artwork, icons, motion, and clear titles, using very little explanatory copy.

## Requested work

### 1. Launcher rebuild and audit

- Rebuild the launcher around image-first animated tiles/cards.
- Use strong iconography and titles; minimise visible words until interaction or hover requires them.
- Generate production-quality Imago and Motus marks/artwork.
- Establish a repeatable artwork workflow so each future toolkit app can receive a matching image and
  icon without redesigning the launcher.
- Audit the existing launcher for broken states, unavailable apps, unsafe launch paths, and unclear
  setup/update feedback.

### 2. Frictionless Motus and Imago setup

- Make both apps convenient to open on any supported computer.
- Make rebuilds and updates safe and repeatable after source changes.
- Keep Motus's native/performance-oriented architecture where it matters, while making its launch and
  update path understandable from Instrumenta.
- Do not launch an unverified Motus build artifact. A failed rebuild must not destroy the last known
  good bundle.
- Package Imago and Ludere so an end-user does not need Node.js, npm, Qt, CMake, MSYS2, Ninja, or a
  browser installed.

### 3. Ludere screenplay editor

Ludere should be a free, open-source screenplay-writing app with the practical conveniences associated
with VOM Draft:

- screenplay elements with accepted margins, spacing, and Courier typography;
- keyboard-first authoring, including Tab cycling and useful shortcuts;
- smart transitions between logical elements (for example, a character name naturally leads to
  dialogue);
- an instructions/help surface that explains the format and shortcuts;
- a local-first writing experience suitable for drafting, revising, and organising scenes.

Its script page uses Courier. Its surrounding brand uses a separate classic typeface and muted colours
that fit the Instrumenta family.

## Follow-up visual direction

The owner liked the overall logo imagery but asked for a refinement:

- retain subtle Latin-mysticism undertones;
- make the visual language feel more like modern software and less scary or occult;
- make Ludere's internal branding, logo, and UI feel like one system;
- provide Ludere with a dedicated light/dark mode button rather than hiding it in Options;
- review other high-frequency toggles and promote them to icon buttons with a full-word tooltip on
  hover.

## Definition of done

- A fresh Windows computer can install/open Instrumenta through a normal installer or portable build.
- The launcher can explain or perform first-time preparation without exposing fragile shell details.
- Motus is only launched after its self-contained bundle and runtime probe pass.
- Imago and Ludere are included in the packaged launcher and can be rebuilt deterministically.
- The launcher and each app have coherent, related visual identity.
- Ludere supports the core screenplay workflow without requiring users to manually format every line.
