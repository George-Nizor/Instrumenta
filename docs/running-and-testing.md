# Running and testing Instrumenta

## Normal Windows use

An installed copy opens from the desktop or Start menu shortcut.

The source workspace has one human-facing Windows command at its root:

```powershell
.\Instrumenta.cmd
```

With no argument it opens the newest Instrumenta found among the source checkout, `release/` portable
build, and installed application. Version wins first; build time breaks an equal-version tie. This
keeps a same-version artwork or renderer rebuild from hiding behind an older executable.

The first source launch needs Node.js and may download Electron. Installed and portable builds carry
their own runtime.

## Registered products

Instrumenta 0.8.0 reads six product entries from `products/catalog.json`.

### Motus

Motus uses `native-bundle`. Instrumenta accepts only a deployed folder with `motus-bundle.json`,
contained paths, the expected runtime files, and a passing hidden launch handshake.

A bundle on WSL or a network share is mirrored into launcher-owned local data before it runs. Loading
a native Qt tree across a share is technically possible in the same sense that waiting several
minutes is technically possible.

### Imago and Ludere

Imago uses `web-vite`. Ludere uses `web-static`. Instrumenta serves their built files on separate
registered `127.0.0.1` origins and opens sandboxed Electron windows.

Both keep their historical persistent browser session, so Imago's IndexedDB cutout shelf and Ludere's
autosave survive launcher upgrades. Their fixed ports keep site data separate.

### Discere

Discere uses `web-service`. The launcher starts its Fastify service from the WSL sibling checkout,
waits for `/api/health`, and then opens the built learner app. Closing the window stops the owned
process tree.

The chosen WSL distribution must resolve `node` and `pnpm` in its login shell.

### Luna

Luna uses `installed-desktop`. Instrumenta invokes a verified installer when a cleared release exists,
then checks the Windows uninstall record and executable. An existing registered Luna 0.3.0 install can
be launched directly. Removal delegates to Luna's uninstaller.

### Forge3D

Forge3D uses `managed-bundle`. Instrumenta downloads and verifies the ZIP, extracts into a staging
folder, validates the declared executable, and atomically activates the version below
`%LOCALAPPDATA%\Instrumenta\products\forge3d`.

The previous version remains available until the new executable launches successfully.

## Workspace commands

```powershell
.\Instrumenta.cmd setup
.\Instrumenta.cmd update
.\Instrumenta.cmd build
.\Instrumenta.cmd test
.\Instrumenta.cmd doctor
.\Instrumenta.cmd clean
.\Instrumenta.cmd package
.\Instrumenta.cmd install
```

The source orchestration commands primarily cover Instrumenta, Motus, Imago, and Ludere. Discere has
its own pnpm setup in WSL. Luna and Forge3D build and release from their repositories.

`setup ai` builds and handshakes the maintained local MCP servers, installs their skills under the
user's agents directory, and updates only Instrumenta's marked Codex configuration block. Restart
Codex after that command.

`doctor` is read-only. It reports source checkouts, product builds, registered installs, bundle
integrity, release hashes, and distribution gates.

`clean` removes launcher-owned diagnostics and regenerable build/cache material. It keeps source,
settings, product documents, the last verified Motus bundle, and installed applications. Read the
printed targets before confirming; “clean” is not meant as a synonym for “surprise”.

## Direct Electron development

From the Instrumenta repository:

```powershell
npm install
npm run apps:prepare:web
npm start
npm test
npm run verify
```

`npm test` covers the launcher renderer, registry, lifecycle, security, release verification,
rollback, and adapter behavior. `npm run verify` also checks the sibling products that belong to the
source-bundled suite path.

Individual products keep their own test suites. Instrumenta does not replace them.

## Release downloads

A product release carries `instrumenta-release.json`. The manifest states the product, semantic
version, platform, minimum Instrumenta version, artifact names, byte sizes, SHA-256 values, entry
point, and install strategy.

Instrumenta downloads through GitHub HTTPS, resumes partial files, checks free space, and validates
every size and digest before extraction or installer launch. An offline release lookup does not stop
an already installed product from opening.

Managed ZIP entries must remain regular contained files or directories. Links, traversal, control
characters, and absolute paths are rejected.

## Packaging Instrumenta

From the workspace root:

```powershell
.\Instrumenta.cmd package
.\Instrumenta.cmd install
```

The package step:

1. builds Imago and Ludere;
2. includes Motus when a distribution-ready portable bundle exists;
3. packages the Electron launcher;
4. runs the real portable launch smoke;
5. writes the installer, portable app, and `release-manifest.json`.

Artifacts land in `Instrumenta\release`:

```text
Instrumenta-Setup-0.8.0.exe
Instrumenta-Portable-0.8.0.exe
release-manifest.json
```

The installer is per-user, creates Start menu and desktop shortcuts, and keeps launcher settings on
upgrade.

Luna and Forge3D are not folded into these executables. Their release size, licences, and update
cycles belong to their own repositories.

## Local security and diagnostics

Product web windows are locked to their registered loopback origin. Popups, webviews, cross-origin
navigation, capture, device access, and privileged permissions are denied. Only the trusted launcher
renderer can call native IPC operations.

Bounded diagnostics live under the launcher's application data. Crash dumps stay local and are never
uploaded.

Release QA can run Electron with `--instrumenta-launch-check <marker-file>`. The smoke opens the real
launcher and bundled web apps, checks local storage and worker/WASM paths, and refuses a marker when a
content-policy violation appears.

## Workspace selection

Settings chooses the parent folder containing the sibling repositories. The selection is remembered.

`INSTRUMENTA_WORKSPACE` can provide an explicit override for scripts or unusual layouts. It points to
the parent folder, not the Instrumenta repository inside it.

Linux and macOS source checkouts can use `./instrumenta.sh` for supported developer orchestration.
The packaged launcher and native product set remain Windows-focused.
