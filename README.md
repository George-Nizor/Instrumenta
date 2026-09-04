![Instrumenta banner](docs/images/instrumenta-banner.png)

# Instrumenta

Instrumenta is the Windows front door for this group of local software projects. It installs release
artifacts, checks versions, launches the apps, and shows enough failure detail to be useful. Each app
keeps its own repository, release history, runtime, and user data.

Current launcher version: **0.9.1**.

## The apps

- **Motus** is a native rough-cut video editor.
- **Imago** is a local graphics compositor.
- **Ludere** is a screenplay editor and beat board.
- **Discere** is a local learning workspace.
- **LearnChess** trains openings, tactics, endgames, and play against Stockfish.
- **Luna** generates speech with local GPU models.
- **Forge3D** runs prompt-driven 3D asset workflows.
- **Fabula** cuts a talking-head recording from its transcript and composes visuals around the
  speaker, with Claude as the editor in the loop.

Instrumenta itself is the ninth repository. The parent folder is only a workspace. Git remains the
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

- `native-bundle` validates and starts a deployed native folder. Motus uses it.
- `web-vite` and `web-static` serve packaged local files in sandboxed Electron windows, each under
  its own Content-Security-Policy. A product's `launch.health` names that policy and must equal its
  ID, so one product's policy is never applied to another's build.
- `web-service` starts a product-owned loopback service, waits for health, then opens its window.
- `managed-bundle` verifies a release archive, activates a versioned folder, and retains the last
  working version for rollback. Forge3D uses it.
- `managed-web` installs a released web build through the same verified path and serves it like any
  other web product. Nothing uses it yet; it exists so a baked-in web product can move onto releases.
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
first launch restores the previous version.

A sibling checkout can act as an explicit developer override. Instrumenta does not pull, reset,
switch, stage, or commit that checkout. Surprise source control inside a launcher would be a fine way
to ruin an afternoon.

## Expected workspace

```text
Instrumenta/
├── Instrumenta/
├── Motus/
├── Imago/
├── Ludere/
├── Discere/
├── LearnChess/
├── Luna/
├── Forge3D/
└── Fabula/
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

The package command writes `Instrumenta-Setup-0.9.1.exe` and
`Instrumenta-Portable-0.9.1.exe` to `release/`. Imago, Ludere, and LearnChess are bundled with the
launcher.
Motus is included only when a verified portable bundle is available. Discere stays source-run in WSL.
Luna and Forge3D keep their own release channels.

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
