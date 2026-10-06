# Backlog and ideas

Updated: 2026-10-06

High level only. Tasks become real work in the owning repository; this list just stops ideas getting
lost between sessions. It is the tracker. If it later moves to Notion (Life HQ › Bonehead Labs),
the tables here import as databases unchanged.

Status: **Idea** (not decided) · **Next** (decided, not started) · **Doing** · **Done** · **Parked**.
Size: S (a session), M (a few sessions), L (a project).

## Suite

| Item | Product | Status | Size | Note |
| --- | --- | --- | --- | --- |
| Produce brand v2 assets: redraw all eight glyphs (organ, slate + six), 16/24 px tuning, SVG/PNG/ICO, banners; archive v1 first | All | Next | M | Decided 2026-10-06; see `decisions.md`. |
| Restyle the Instrumenta launcher fully in brand v2 | Instrumenta | Next | M | Launcher goes first and goes all the way. |
| README branding pass: v2 banner, icon, one-line description, Bonehead Labs footer, in every repository | All | Idea | M | Every README is still v1. Can ride along with each app's review or go as one pass; see `brand/ALIGNMENT.md`, "The README". Best done before the move to `Bonehead-Labs`. |
| Generate the v2 README banners from the brand files (`build-brand.py`) | Instrumenta | Idea | S | So all eight banners match and are rebuilt when a glyph changes. |
| Per-product brand review before any restyle, one product at a time | Each product | Next | M | Follow `brand/ALIGNMENT.md`; log each review there. Discere's is being started by the owner. |
| Unified brand: new icon family, one UI typeface, shared colour system with a per-app accent | All | Next | L | Preview directions in an artifact before choosing. Marks become flat/vector, so they can animate in the apps. |
| Archive the current marks and Luna's 1-bit look before replacing them | All, Luna | Next | S | Tag `brand-v1` in Instrumenta; copy the art to `brand/archive/v1/`. |
| Ludere: unify UI fonts only; the screenplay page keeps Courier | Ludere | Next | S | Part of the brand work. |
| Open-source readiness: every README opens with a clone-and-run quickstart | All | Idea | M | The audience is people cloning to use, not contributors. |
| Register MCP servers with Codex in WSL (`./instrumenta.sh setup ai`) | Instrumenta | Next | S | Wait until the current Discere work lands. |
| Refresh workspace `README.md` versions (Luna 0.3.0 → 0.4.1; LearnChess 0.1.1; launcher 0.10.1) | Instrumenta | Next | S | |
| Refresh or archive the Motus-era notes (`knowledge-base.md`, `product-brief.md`, `editor-ui-system.md`) | Instrumenta | Idea | S | Superseded in part by `catalogue.md`; `known-issues.md` still has live entries (K-009). |

## Repositories and licences (to sort out in the management pass)

| Item | Product | Status | Size | Note |
| --- | --- | --- | --- | --- |
| Version the workspace scaffolding: `CLAUDE.md`, `README.md`, `instrumenta.sh`, `Instrumenta.cmd` | Instrumenta | Next | S | Unversioned at the workspace root. Keep the source in the Instrumenta repo (e.g. `workspace/`) and have setup copy or link it to the root. |
| Push or drop Forge3D's unpushed commit from 2026-09-04 | Forge3D | Next | S | "Add export pipeline, splat packaging, and local-only enforcement". Then decide whether it warrants v0.2.3. |
| Delete Luna's merged branches (`docs/finalize-publication-audit`, `feat/local-installed-payload-repack`) | Luna | Idea | S | Both fully merged. |
| Remove the empty `renderer/`, `.agents/`, `.codex/` folders at the workspace root | Workspace | Idea | S | Empty; check nothing writes there first. |
| Choose licences for Fabula and Discere | Fabula, Discere | Next | S | MIT matches the rest unless a dependency forces GPL (as with LearnChess). |
| Transfer repositories to `Bonehead-Labs` | All | Idea | M | Order: update `catalog.json` owners, ship a launcher, transfer, verify the redirects. |

## Technology

| Item | Product | Status | Size | Note |
| --- | --- | --- | --- | --- |
| Shared UI package: tokens, fonts, icons, motion, and base components for every product | All | Next | M | The real unification. Lands with the brand work. |
| Let Instrumenta host Fabula, Luna and Forge3D as local services in its own window, keeping their Electron shells for standalone use | Fabula, Luna, Forge3D | Idea | L | One Chromium instead of four. Only worth it if the duplicate runtimes start to hurt. |

## Launcher features (chosen 2026-10-06 for the launcher rebuild)

| Item | Product | Status | Size | Note |
| --- | --- | --- | --- | --- |
| About panel: Bonehead Labs site and GitHub links, per-app "report a problem", licences | Instrumenta | Next | S | Opens in the browser via an allowlist. Licences and credits are needed for open source anyway. |
| Credits roll: film-style end credits for every library, model, font and dataset | Instrumenta | Next | S | The charming version of the third-party notices. |
| What's new: release notes on the tile after an app updates itself | Instrumenta | Next | S | Put the notes in `instrumenta-release.json` so no extra API call. |
| Continue where you left off: each app's recent projects on its hero | Instrumenta + apps | Parked | M | Needs a small per-app recents contract. |
| Storage panel: what each app uses on disk, and safe clean-up | Instrumenta | Next | S | Luna ~15 GB, the Fabula engine ~7 GB. |
| Readiness checks in the UI: GPU, WSL, Claude Code/Codex, per app | Instrumenta | Next | M | `doctor`, with a face. |
| The organ plays: each app has a note; launching plays it; startup chord built from installed apps | Instrumenta | Next | S | Web Audio, synthesised, off by default. |
| Latin names: what each app's name means, on the hero | Instrumenta | Next | S | fabula = story, imago = image, ludere = to play, discere = to learn, luna = moon. |
| Ambience by time and season: dust motes by day, fireflies at night, snow in December | Instrumenta | Next | S | Reuses `particles.js`. |
| Workshop journal: private local milestones ("first film cut", "night owl") | Instrumenta | Next | M | Local only, never sent anywhere. |
| Small celebrations and an easter egg: a hop and a burst in the app's colour after an update; the organ plays a tune | Instrumenta | Next | S | |

## Products

| Item | Product | Status | Size | Note |
| --- | --- | --- | --- | --- |
| Rebuild Imago as an AI designer: YouTube thumbnails, static designs, photo manipulation, driven by Claude (Claude Design style), not a full photo editor | Imago | Done | L | 2026-10-06, uncommitted on `redesign/ai-designer`. Drives the owner's Claude Code (`claude -p`); three presets; brand v2 UI. Now `web-service` from source. Not yet verified through the launcher on Windows (service in WSL). Spec: `Imago/docs/redesign-contract.md`. |
| Luna brand redesign; keep the 1-bit look archived as a fallback | Luna | Next | M | Part of the brand work. |
