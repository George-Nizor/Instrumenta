![Instrumenta banner](docs/images/instrumenta-banner.png)

# Instrumenta

Instrumenta is the Windows front door for this group of local software projects. It installs release
artifacts, checks versions, launches the apps, and shows enough failure detail to be useful. Each app
keeps its own repository, release history, runtime, and user data.

Current launcher version: **0.11.0**.

Two views. **Console**, the default, gives the selected app the whole window, with the suite in a
dock along the bottom. **Library** is the detailed view: every app as a list, and pages for Updates,
Storage (what the apps use on disk, and safe clean-ups), Readiness (WSL, GPU, Claude Code and Codex,
and what each app needs) and a workshop journal. Apps show their release notes after updating
themselves; an update over 1 GB always waits to be asked. Settings has light and dark themes, and
the organ in the corner plays each app's note if you let it. The brand is described in
[`brand/README.md`](brand/README.md).

## The apps

- **Fabula** cuts a talking-head recording from its transcript and composes visuals around the
  speaker, with Claude as the editor in the loop.
- **Imago** is a local graphics compositor.
- **Ludere** is a screenplay editor and beat board.
- **Discere** is a local learning workspace.
- **LearnChess** trains openings, tactics, endgames, and play against Stockfish.
- **Luna** generates speech with local GPU models.
- **Forge3D** runs prompt-driven 3D asset workflows.

Motus, the native rough-cut editor, is discontinued and no longer in the launcher.

Instrumenta itself is the eighth repository. The parent folder is only a workspace. Git remains the
developer's job; the launcher has enough responsibility already.

## Open it

For an installed copy, use the desktop or Start menu shortcut.

From the sibling source workspace, double-click the top-level `Instrumenta.cmd`. Useful commands are:

```powershell
.\Instrumenta.cmd setup
.\Instrumenta.cmd update
.\Instrumenta.cmd test
.\Instrumenta.cmd doctor
.\Instrumenta.cmd package
.\Instrumenta.cmd install
```

`install` builds and opens the per-user Windows installer. `package` creates the installer and
portable executable without installing either one.

## How products are handled

Every product passes through the same visible lifecycle:

```text
available → downloading → installing → installed → launching → running
```

Updates and failures branch from that flow. The adapter decides what each step means:

- `native-bundle` validates and starts a deployed native folder: Fabula's checkout, an Electron
  runtime its own bootstrap deploys under it. Installed, Fabula is a `managed-bundle` whose
  bootstrap runs the editor from an engine it sets up in WSL.
- `web-vite` and `web-static` serve packaged local files in sandboxed Electron windows, each under
  its own Content-Security-Policy. A product's `launch.health` names that policy and must equal its
  ID, so one product's policy is never applied to another's build.
- `web-service` starts a product-owned loopback service, waits for health, then opens its window.
- `managed-bundle` verifies a release archive, activates a versioned folder, and retains the last
  working version for rollback. Forge3D uses it.
- `managed-web` installs a released web build through the same verified path and serves it like any
  other web product. Imago, Ludere and LearnChess are delivered this way, each from its own
  releases, with the copy baked into the installer as the fallback.
- `installed-desktop` delegates installation and removal to the product installer, then checks the
  Windows installation record. Luna uses it.

The catalog is [`products/catalog.json`](products/catalog.json). Product-owned behavior belongs in
each sibling repository's `instrumenta/product.json`.

## Releases and developer checkouts

Normal installs come from GitHub Releases. Instrumenta reads `instrumenta-release.json`, checks the
declared size and SHA-256 for every artifact, and refuses path traversal or a corrupt download.
Partial downloads can resume.

Managed bundles are installed under:

```text
%LOCALAPPDATA%\Instrumenta\products\<id>\versions\<version>
```

The active-version pointer changes only after extraction and entry-point checks succeed. A failed
first launch restores the previous version. The current and previous versions are kept; older ones
are pruned. Downloads wait in `%LOCALAPPDATA%\Instrumenta\downloads` and are deleted once their
version is active.

Installs run one at a time. Add apps lists every product with its state and download size and
queues the ones picked. Updates to installed products are found in the background and installed
automatically unless that is turned off, globally or per app; an update to an app that is open waits
until it closes.

Instrumenta keeps itself current the same way. A newer launcher downloads in the background and is
verified; the header then offers **Restart to update**, and closing Instrumenta installs it anyway.
Releases are made by tagging `v<version>`: `.github/workflows/release.yml` for the launcher, and each
web product's own `release.yml` through the shared `web-product-release.yml`.

A sibling checkout can act as an explicit developer override. Instrumenta does not pull, reset,
switch, stage, or commit that checkout. Surprise source control inside a launcher would be a fine way
to ruin an afternoon.

## Expected workspace

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

The launcher can remember another parent folder from Settings. `INSTRUMENTA_WORKSPACE` is available
for an explicit command-line override.

## Development

Instrumenta needs Node.js 22.12 or newer.

```powershell
cd Instrumenta
npm install
npm run apps:prepare:web
npm start
npm test
npm run verify
npm run package:windows
```

The package command writes `Instrumenta-Setup-0.11.0.exe` and
`Instrumenta-Portable-0.11.0.exe` to `release/`. Imago, Ludere, and LearnChess are bundled with the
launcher as the copies a fresh install opens with, and update from their own releases after that. Discere stays source-run in WSL. Fabula, Luna and Forge3D install
from their own releases.

## Local boundaries

Web products are confined to their registered `127.0.0.1` origin. Popups, arbitrary navigation,
capture, device access, and privileged Electron permissions are denied. Native launches use named
manifest entries and contained paths. Logs and crash data stay on the machine.

Instrumenta stores launcher settings under Electron's `instrumenta-launcher` application data.
Managed-product state lives below `%LOCALAPPDATA%\Instrumenta`. Product documents remain in the
locations declared by each app.

## Documentation

- [Product manifests, release verification, adapters, and rollback](docs/product-lifecycle.md)
- [Running, testing, packaging, and troubleshooting](docs/running-and-testing.md)
- [Repository layout and migration notes](docs/repository-migration.md)
- [Local MCP servers and Codex skills](docs/ai-agents.md)
- [Brand assets and product marks](brand/README.md)
- [Documentation voice and maintenance](docs/documentation-style.md)

Instrumenta is MIT licensed.
