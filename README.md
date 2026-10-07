![Instrumenta banner](docs/images/instrumenta-banner.png)

<p align="center"><img src="docs/brand/instrumenta-animated.svg" alt="Instrumenta organ" width="96" /></p>

# Instrumenta

Local apps for learning and creative work, opened from one launcher.

Instrumenta is the Windows launcher for this group of apps. It installs their releases, checks
versions, opens them, and shows enough failure detail to be useful. Each app keeps its own
repository, release history, runtime, and user data.

Current launcher version: **0.11.2**.

**Console**, the default view, gives the selected app the whole window, with the suite in a dock
along the bottom. **Library** lists every app and has pages for Updates, Storage (disk use and safe
clean-ups), Readiness (WSL, NVIDIA GPU, Claude Code and Codex, free space, and what each app needs)
and a workshop journal. Settings has a System, Light or Dark theme, and an organ that plays each
app's note if you turn it on. The brand is described in [`brand/README.md`](brand/README.md).

## The apps

- **Fabula** cuts a talking-head video by its words, then Claude Code or Codex makes it into a film.
- **Imago** designs thumbnails, photo edits and graphics with your own Claude Code.
- **Ludere** is a screenplay editor with a beat board. It autosaves as you write.
- **Discere** is a learning workspace: lessons, review scheduling and a notebook that keep working
  offline.
- **LearnChess** teaches chess with Stockfish, two hundred thousand Lichess puzzles and an opening
  book, all offline.
- **Luna** generates speech on a local GPU.
- **Forge3D** does prompt-driven 3D modelling on the Codex App Server.

Motus, the native rough-cut editor, is discontinued and no longer in the launcher.

## Open it

An installed copy opens from the desktop or Start menu shortcut.

In a source workspace, double-click the workspace-level `Instrumenta.cmd` (it is not in this
repository; [`scripts/instrumenta.ps1`](scripts/instrumenta.ps1) does the work). `.\Instrumenta.cmd
help` lists its commands: `setup`, `update`, `build`, `test`, `doctor`, `clean`, `package` and
`install`. `package` builds the installer and portable executable; `install` also opens the
installer. [Running and testing](docs/running-and-testing.md) covers each one.

## How apps are delivered

The catalog, [`products/catalog.json`](products/catalog.json), names each app's adapter.

| App | Adapter | Delivered as |
| --- | --- | --- |
| Ludere, LearnChess | `managed-web` | Its own GitHub release; the copy baked into the installer is the fallback |
| Fabula, Forge3D | `managed-bundle` | Its own GitHub release, kept with the previous version for rollback |
| Luna | `installed-desktop` | Its own Windows installer, which Instrumenta downloads and runs |
| Imago, Discere | `web-service` | A service started from the source checkout (inside WSL when the checkout is there) |

Every release carries `instrumenta-release.json`. Instrumenta checks each artifact's size and
SHA-256 before anything runs, resumes partial downloads, and installs one app at a time. **Add apps**
lists every app with its state and download size.

Updates are found in the background and installed automatically unless that is turned off, for all
apps or one. An update to an app that is open waits until it closes. An update over 1 GB waits to be
asked unless that app's own auto-update switch is on. When a release has notes, the app shows
them after updating until they are read.
Instrumenta updates itself the same way: the header offers **Restart to update**, and closing the
launcher installs it anyway.

A sibling checkout can act as a developer override. Instrumenta does not pull, reset, switch, stage,
or commit it. Surprise source control inside a launcher would be a fine way to ruin an afternoon.

Install paths, verification, rollback, update policy and the release workflows are in
[Product lifecycle](docs/product-lifecycle.md).

## Workspace

```text
Instrumenta/
├── Instrumenta/
├── Fabula/
├── Imago/
├── Ludere/
├── Discere/
├── LearnChess/
├── Luna/
└── Forge3D/
```

The parent folder is a container, not a repository. Settings can point the launcher at another
parent folder, and `INSTRUMENTA_WORKSPACE` overrides it from the command line.

## Development

Instrumenta needs Node.js 22.12 or newer.

```powershell
npm install
npm run apps:prepare:web
npm start
npm test
npm run verify
npm run package:windows
```

`npm run package:windows` runs on Windows only. It writes `Instrumenta-Setup-0.11.2.exe` and
`Instrumenta-Portable-0.11.2.exe` to `release/`, with Ludere and LearnChess built in.

## Local boundaries

Web apps are confined to their registered `127.0.0.1` origin. Popups, arbitrary navigation,
capture, device access, and privileged Electron permissions are denied. Logs and crash dumps stay on
the machine. Launcher settings live under Electron's `instrumenta-launcher` application data,
installed apps under `%LOCALAPPDATA%\Instrumenta`, and each app's documents where that app keeps
them.

## Documentation

- [Product lifecycle](docs/product-lifecycle.md): manifests, release verification, adapters, rollback, updates
- [Running and testing](docs/running-and-testing.md): workspace commands, packaging, troubleshooting
- [Repository layout and migration notes](docs/repository-migration.md)
- [Local MCP servers and Codex skills](docs/ai-agents.md)
- [Brand assets and product marks](brand/README.md); [`brand/scripts/build-readme-banner.mjs`](brand/scripts/build-readme-banner.mjs) renders the README banners
- [Documentation style](docs/documentation-style.md)

## Family

Instrumenta is made by [Bonehead Labs](https://boneheadlabs.org) ([GitHub](https://github.com/Bonehead-Labs)),
and the apps it launches are part of it. It follows its own brand v2: an organ with one pipe in each
app's colour, in brass, drawn as a freestanding object. The interface type (Fraunces, Commissioner,
Spline Sans Mono) is SIL OFL 1.1, vendored in `brand/fonts` with its licences. Licence: MIT.
