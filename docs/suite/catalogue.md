# Instrumenta catalogue

Updated: 2026-10-06

One page that says what every product is, what it is built from, how it reaches a user, and where
its own documentation lives. Read this first; read the product's own docs before changing it.
Versions and delivery details come from each repository's `package.json` and
`Instrumenta/products/catalog.json`. When this page disagrees with them, they are right and this
page is stale.

Instrumenta is a Bonehead Labs project. The repositories are public under `George-Nizor` on GitHub
today; a `Bonehead-Labs` organisation exists and moving them there is on the [backlog](backlog.md).

## Products

| Product | What it is | Stack | Delivered as | Version | Licence |
| --- | --- | --- | --- | --- | --- |
| **Instrumenta** | Launcher and lifecycle gateway: discovers, installs, updates and opens every product | Electron (CommonJS), NSIS | Its own installer, updates itself | 0.10.1 | yes |
| **Fabula** | Transcript-driven talking-head video editor; Claude Code or Codex turns a cut into a film | Electron UI on Windows, Node engine + ffmpeg + WhisperX in WSL | `managed-bundle` release; checkout in a workspace | 0.1.0 | **missing** |
| **Imago** | AI designer: thumbnails, photo edits and graphics, written as HTML by your own Claude Code and rendered locally | React, TypeScript, Vite; Node service driving `claude -p`; headless Electron renderer | `web-service` from the source checkout | 0.2.0 | yes |
| **Ludere** | Screenplay editor, with an MCP server | Plain JS, static build | `managed-web` release, baked fallback | 0.1.0 | yes |
| **Discere** | Learning workspace; tutor, illustrations and authoring through the Codex CLI | pnpm monorepo: web app + Node service + MCP | `web-service` from the source checkout | 0.1.0 | **missing** |
| **LearnChess** | Chess trainer: openings, tactics, endgames, Stockfish | React 19, TypeScript, Vite, chessground | `managed-web` release, baked fallback | 0.1.1 | GPL-3.0 |
| **Luna** | Local voice generation studio; downloads voice models on demand | Python (FastAPI) + Electron shell | `installed-desktop`, its own installer | 0.4.1 | yes |
| **Forge3D** | Prompt-driven 3D workstation over Blender/Godot | Python + Electron/Vite desktop | `managed-bundle` with rollback | 0.2.2 | yes |

Discontinued: **Motus**, the native Qt rough-cut editor. Its repository is private. The `Motus/`
folder still on disk is ignored by the launcher, and its mark now belongs to Fabula.

So the suite is not all web: Imago, Ludere, LearnChess and Discere are web apps; Fabula, Luna and
Forge3D are Electron desktops with a native or Python back end. Instrumenta treats them all through
one of five adapters (`managed-web`, `managed-bundle`, `installed-desktop`, `web-service`, and the
launcher's own self-update).

## Repositories

The workspace folder (`_PersonalProjects/Instrumenta/`) is **not** a repository. It is a plain
container whose only job is to hold the product checkouts side by side, because the launcher finds
products by relative path. Each product folder is its own Git repository with its own remote,
history, tags and releases. Audited 2026-10-06 after `git fetch`:

| Folder | Remote (owner/name) | Visibility | Licence | Latest tag | State on 2026-10-06 |
| --- | --- | --- | --- | --- | --- |
| `Instrumenta/` | George-Nizor/Instrumenta | public | MIT | v0.10.1 | in sync; uncommitted: this coordination work |
| `Fabula/` | George-Nizor/Fabula | public | **none** | v0.1.0 | clean, in sync |
| `Imago/` | George-Nizor/Imago | public | MIT | v0.1.0 | clean, in sync |
| `Ludere/` | George-Nizor/Ludere | public | MIT | v0.1.0 | clean, in sync |
| `Discere/` | George-Nizor/Discere | public | **none** | none | 1 commit unpushed, large uncommitted work, five `fleet/*` branches: another session's work in progress |
| `LearnChess/` | George-Nizor/LearnChess | public | GPL-3.0 | v0.1.1 | clean, in sync |
| `Luna/` | George-Nizor/Luna | public | MIT | v0.4.1 | clean, in sync; two stale branches, both merged |
| `Forge3D/` | George-Nizor/Forge3D | public | MIT | v0.2.2 | clean; **1 commit unpushed** since 2026-09-04 ("Add export pipeline, splat packaging, and local-only enforcement"), so v0.2.2 predates it |
| `Motus/` | George-Nizor/Motus | private | MIT | none | discontinued; ignored by the launcher |

Not in any repository: the workspace-level `CLAUDE.md` (the long versions/updates/brand guide),
`README.md`, `instrumenta.sh` and `Instrumenta.cmd`, plus empty `renderer/`, `.agents/` and
`.codex/` folders. A fresh clone of Instrumenta does not get them. See the [backlog](backlog.md).

Owner: every repository is under the personal account `George-Nizor`. The `Bonehead-Labs` GitHub
organisation exists (free plan, 8 public repositories of its own) and is the intended long-term
home. LearnChess is GPL-3.0 because its dependencies (chessground, Stockfish) are GPL; the rest are
MIT. Fonts the suite adopts must be OFL so they can be vendored into public repositories.

## Technology at a glance

Every product's interface is HTML, CSS and JavaScript. What differs is the window it runs in and
what runs behind it.

| Shape | Products | Window | Back end |
| --- | --- | --- | --- |
| Static web app | Ludere, LearnChess | an Instrumenta (Electron) window | none; the launcher serves the files |
| Web app + local service | Imago, Discere | an Instrumenta window | Node service the launcher starts (Imago drives Claude Code, Discere the Codex CLI) |
| Own Electron app | Fabula | its own Electron | Node engine + ffmpeg + WhisperX in WSL |
| Own Electron app | Luna | its own Electron | Python (FastAPI, GPU voice models) |
| Own Electron app | Forge3D | its own Electron | Python, driving Blender/Godot |
| Launcher | Instrumenta | Electron | Node (main process) |

## Where each product's knowledge lives

| Product | Start with |
| --- | --- |
| Instrumenta | `Instrumenta/docs/product-lifecycle.md`, `Instrumenta/docs/running-and-testing.md`, workspace `CLAUDE.md` |
| Fabula | `Fabula/CLAUDE.md`, `Fabula/AGENTS.md` |
| Imago | `Imago/CLAUDE.md`, `Imago/docs/redesign-contract.md` |
| Ludere | `Ludere/README.md`, `Ludere/mcp/README.md` |
| Discere | `Discere/AGENTS.md`, `Discere/docs/implementation-status.md` |
| LearnChess | `LearnChess/CLAUDE.md` |
| Luna | `Luna/README.md`, `Luna/docs/identity-and-data.md`, `Luna/docs/voice-library.md` |
| Forge3D | `Forge3D/AGENTS.md`, `Forge3D/docs/desktop-architecture.md` |

## How to check each product works

Run from WSL, inside each product's folder. All passed on 2026-10-06 except Discere, which was not run because other work was in
progress there.

| Product | Command | Result 2026-10-06 |
| --- | --- | --- |
| Instrumenta | `npm test` | 233 pass |
| Fabula | `npm test` | 276 pass |
| Imago | `npm test`, `npx oxlint`, `npx tsc -b --noEmit` | pass |
| Ludere | `npm test` | 17 pass |
| LearnChess | `npx vitest run`, `npm run typecheck`, `npm run lint` | 138 pass, 7 skipped |
| Luna | `uv run --frozen pytest -q` (`npm test` is the Windows PowerShell route) | 46 pass, 1 skipped |
| Forge3D | `uv run --frozen --with pytest pytest -q`; `desktop/`: `npm test` | 38 pass; 42 pass |
| Discere | `pnpm test` (see `Discere/AGENTS.md`) | not run |

Workspace-wide: `./instrumenta.sh status` (registry state) and `./instrumenta.sh doctor` (environment
plus AI/MCP diagnostics). Both are read-only. See [dev-environment.md](dev-environment.md) for the
WSL/Windows rules that keep these commands working.
