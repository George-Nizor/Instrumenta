![Instrumenta banner](docs/images/instrumenta-banner.png)

<p align="center"><img src="docs/brand/instrumenta-animated.svg" alt="Instrumenta organ" width="96" /></p>

# Instrumenta

A suite of local creative tools. Everything runs on this computer.

Instrumenta is the Windows launcher for the suite. It installs and updates the apps from their GitHub
Releases, checks every download, opens each app, and shows enough failure detail to be useful. Each
app keeps its own repository, release history, runtime, and user data. Current version: **0.16.0**.

<p align="center"><a href="https://github.com/George-Nizor/Instrumenta/releases/latest/download/Instrumenta-Setup.exe"><strong>⬇ Download Instrumenta for Windows</strong></a><br />
<sub>Windows 10 or 11, 64-bit · <a href="https://github.com/George-Nizor/Instrumenta/releases/latest">release notes and other downloads</a></sub></p>

## Install

1. [Download the installer](https://github.com/George-Nizor/Instrumenta/releases/latest/download/Instrumenta-Setup.exe)
   and run it. It installs for your user only, so there is no administrator prompt.
2. If Windows SmartScreen says *Windows protected your PC*, choose **More info**, then **Run
   anyway**. The installer is not code-signed.
3. Open Instrumenta from the desktop or Start menu and pick apps under **Add apps**.

From then on Instrumenta updates itself and the apps it installed. Every version, and a portable
build that runs without installing, is on the [releases page](https://github.com/George-Nizor/Instrumenta/releases).

## Run it from source

From the source workspace (see [Expected workspace](#expected-workspace)), run the top-level
`Instrumenta.cmd`:

```powershell
.\Instrumenta.cmd setup      # launcher, web apps and AI tools, once
.\Instrumenta.cmd            # open Instrumenta
.\Instrumenta.cmd update     # rebuild the web apps after source changes
.\Instrumenta.cmd test       # launcher tests and source-suite checks
.\Instrumenta.cmd doctor     # read-only environment check
.\Instrumenta.cmd package    # build the installer and portable executable
.\Instrumenta.cmd install    # build the installer and open it
```

`.\Instrumenta.cmd help` lists the rest (`build`, `status`, `clean`). `./instrumenta.sh` takes the same
commands from WSL and hands most of them to Windows PowerShell.

## The apps

- **Fabula** cuts a talking-head video by its words, then lets Claude Code or Codex make it into a film.
- **Imago** designs thumbnails, photo edits and graphics with your own Claude Code.
- **Ludere** formats screenplays and autosaves as you write.
- **Discere** is a learning workspace with lessons, review scheduling and a notebook that keep working
  offline.
- **LearnChess** trains with Stockfish, Lichess puzzles and an opening book, all local.
- **Luna** is private, local GPU voice generation.
- **Dimensio** teaches Blender from your first cube to game-ready models, with a workshop that
  builds a model from a prompt.
- **Delineare** teaches drawing: today's session, the reference and the clock, and where to learn
  each step.

Instrumenta is the ninth repository. The parent folder is only a workspace, and Git stays the
developer's job: the launcher never pulls, resets, switches, or commits in a checkout.

## Using the launcher

**Console**, the default view, gives the selected app the whole window, with the suite in a dock along
the bottom. **Library** lists every app and adds pages for:

- **Updates**, the newest release found for each app.
- **Storage**, which shows what the apps use on disk and offers safe clean-ups.
- **Readiness**, which checks WSL, the GPU, Claude Code and Codex, and what each app needs.
- **Journal**, a workshop log of launches and milestones, kept on this computer.

Add apps lists every product with its state and download size, and queues the ones you pick. Installs
run one at a time. Updates to installed apps download in the background and install automatically
unless that is turned off, globally or per app. An update to an open app waits until it closes, and
one over 1 GB always waits to be asked. Each app has a roll-back button and shows its release notes after updating. Settings has
light and dark themes and a switch for the organ in the corner, which plays each app's note.

## How apps are delivered

The catalog, [`products/catalog.json`](products/catalog.json), gives each app an adapter:

| Adapter | Apps | What the launcher does |
| --- | --- | --- |
| `managed-bundle` | Fabula, Dimensio | Verifies a release archive, activates a versioned folder, keeps the last working version for rollback |
| `managed-web` | Ludere, LearnChess, Delineare | Installs a released web build the same way and serves it locally, with a copy baked into the installer as fallback when one was built |
| `managed-service` | Discere | Installs a released service the same way, then starts it from its version folder with the runtime it ships, and stops it when its window closes |
| `installed-desktop` | Luna | Runs the app's own installer and checks the Windows uninstall record |
| `web-service` | Imago | Starts the app's loopback service from its source checkout, in WSL on Windows |

Releases are found through `instrumenta-release.json`. Every asset is checked against its declared size
and SHA-256 before anything runs, and a failed first launch restores the previous version. Managed
apps live under `%LOCALAPPDATA%\Instrumenta\products\<id>`. Product-owned behaviour belongs in each
sibling repository's `instrumenta/product.json`. The full rules are in
[`docs/product-lifecycle.md`](docs/product-lifecycle.md); where each version number comes from, and how
to bring a checkout up to date, is in the workspace `CLAUDE.md`.

Web apps are confined to their registered `127.0.0.1` origin, each under its own
Content-Security-Policy. Popups, arbitrary navigation, capture, device access, and privileged
Electron permissions are denied. Settings are stored under Electron's `instrumenta-launcher`
application data; managed-app state lives below `%LOCALAPPDATA%\Instrumenta`.

## Expected workspace

```text
Instrumenta/
├── Instrumenta/    this repository
├── Fabula/
├── Imago/
├── Ludere/
├── Discere/
├── LearnChess/
├── Luna/
├── Dimensio/
└── Delineare/
```

The launcher finds the apps by relative path, so a source checkout has to sit beside this one. A
different parent folder can be chosen in Settings, or set with `INSTRUMENTA_WORKSPACE`.

## Development

Node.js 22.12 or newer.

```powershell
cd Instrumenta
npm install
npm run apps:prepare:web   # build Ludere and LearnChess
npm start
npm test
npm run verify
npm run package:windows
```

The package command writes `Instrumenta-Setup-0.16.0.exe` and `Instrumenta-Portable-0.16.0.exe` to
`release/`. A `v<version>` tag publishes a launcher release through
`.github/workflows/release.yml`.

## Documentation

- [Product manifests, release verification, adapters, and rollback](docs/product-lifecycle.md)
- [Running, testing, packaging, and troubleshooting](docs/running-and-testing.md)
- [Repository layout and migration notes](docs/repository-migration.md)
- [Local MCP servers and Codex skills](docs/ai-agents.md)
- [Brand assets and product marks](brand/README.md)
- [Documentation voice and maintenance](docs/documentation-style.md)

---

<sub>Made by [Bonehead Labs](https://boneheadlabs.org) ([GitHub](https://github.com/Bonehead-Labs)). Brand v2: an organ with one pipe in each app's colour, in brass, interface type Fraunces, Commissioner and Spline Sans Mono (SIL OFL 1.1, vendored in `brand/fonts` with its licences). Licence: MIT.</sub>
