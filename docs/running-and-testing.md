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

Instrumenta 0.9.1 reads seven product entries from `products/catalog.json` and lists them in that
order, Fabula first. Motus, the native editor that used to head the list, is discontinued.

### Fabula

Fabula uses `native-bundle`. Its bundle is an Electron runtime rather than a built program, and
Instrumenta accepts only a deployed folder with `fabula-bundle.json`, contained paths, and a passing
hidden launch handshake.

Prepare runs `scripts/bootstrap-windows.ps1` in the Fabula checkout, which downloads the Electron
release matching Fabula's `node_modules/electron`, verifies its SHA-256 against the release's
`SHASUMS256.txt`, deploys it under `dist/windows`, and writes `fabula-bundle.json` with the checkout
path as the launch argument. The runtime is only re-downloaded when the Electron version changes.

Open mirrors the runtime into launcher-owned local data (Chromium cannot spawn its helper processes
from a `\\wsl.localhost` path), runs the launch check with the checkout as the application, and then
launches `electron.exe` the same way. The application code stays in the checkout, so edits are live.
Fabula's transcription and render pipeline runs inside WSL and is driven from a Claude Code session
started in the Fabula folder; the launcher opens the review window and nothing more.

### Imago and Ludere

Imago uses `web-vite`. Ludere uses `web-static`. Instrumenta serves their built files on separate
registered `127.0.0.1` origins and opens sandboxed Electron windows.

Both keep their historical persistent browser session, so Imago's IndexedDB cutout shelf and Ludere's
autosave survive launcher upgrades. Their fixed ports keep site data separate.

### LearnChess

LearnChess uses `web-vite` like Imago, served the same way on its own registered origin. Unlike the
two historical products it runs in its own `persist:tool-learnchess` session partition, and its
content policy carries the suite's single outward `connect-src` exception, the read-only Lichess
tablebase.

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

The previous version remains available until the new executable launches successfully, and after
that as the target of Roll back. Older versions are pruned after each install; one still running is
left for the next prune rather than deleted from under it.

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

The source orchestration commands primarily cover Instrumenta, Imago, and Ludere; packaging also
builds and stages LearnChess. Discere has its own pnpm setup in WSL. Luna and Forge3D build and
release from their repositories, so `build all` passes over them and says so. `build fabula` deploys
Fabula's Electron runtime; the runtime is never staged into the installer, since it is a per-machine
deploy of about 250 MB. Off Windows, `build all` passes over Fabula as well, because its bootstrap
is Windows PowerShell.

`setup ai` builds and handshakes the maintained local MCP servers, installs their skills under the
user's agents directory, and updates only Instrumenta's marked Codex configuration block. Restart
Codex after that command.

`doctor` is read-only. It reports source checkouts, product builds, registered installs, bundle
integrity, release hashes, and distribution gates.

`clean` removes launcher-owned diagnostics and regenerable build/cache material. It keeps source,
settings, product documents, deployed native bundles, and installed applications. Read the
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

`npm test` covers the registry, lifecycle, security, release lookup and verification, rollback,
update detection and policy, the install queue, and adapter behavior. The renderer's decisions (the
verb on each button, the rail flags, the Add apps rows) live in `electron/renderer/launcher-model.js`
and are tested; the drawing and animation around them are not. `npm run verify` also checks the
sibling products that belong to the source-bundled suite path.

Individual products keep their own test suites. Instrumenta does not replace them.

## Release downloads

A product release carries `instrumenta-release.json`. The manifest states the product, semantic
version, platform, minimum Instrumenta version, artifact names, byte sizes, SHA-256 values, entry
point, and install strategy.

The newest release is found through GitHub's download route,
`github.com/<owner>/<repo>/releases/latest/download/instrumenta-release.json`, whose redirect names
the release tag. It costs no REST API request; the API is used only for the prerelease channel and as
a fallback. A 404 there means no release is published yet, and the tile says so instead of offering
an Install that cannot work.

Instrumenta downloads through GitHub HTTPS into `%LOCALAPPDATA%\Instrumenta\downloads\<id>\<version>`,
resumes partial files, checks free space for what is still to be written, and validates every size
and digest before extraction or installer launch. The folder is deleted once the version is active,
or once an installer exits cleanly; after a failure it is kept, so a retry resumes rather than
starting again, and Luna's assembled payload is reused if it still verifies. A release whose
`minimumInstrumentaVersion` is newer than the running launcher is refused before anything
downloads. An offline release lookup does not stop an already installed product from opening.

Managed ZIP entries must remain regular contained files or directories. Links, traversal, control
characters, and absolute paths are rejected.

For release-backed products the launcher also polls the newest published release in the
background — at startup, every six hours, after any install or uninstall, and on Refresh — and
caches the answer for six hours. Refresh skips the wait but asks at most once a minute per product,
and a GitHub rate limit holds every check until the time GitHub gives. An unreadable version on
either side reports no update, and a failed check keeps the last known answer, so a network problem
never disguises a stale product as current.

## Adding apps and automatic updates

Add apps, at the foot of the product list, shows every catalog product with its state (included with
Instrumenta, installed, available, no release published yet, or developer-only), the download size
of anything installable, and an auto-update switch for each release-backed app. It opens by itself
once, on the first run that has something to install. Picked apps are queued and installed one at a
time in the background, each tile showing its own progress.

Automatic updates are on unless turned off, for all apps or one. They apply only to apps already
installed: an update to an app that is closed is installed straight away, and one to an app that is
open is downloaded and verified now and activated once it closes. A version rolled back from, by
hand or after it failed its first launch, is not offered again until someone installs it on
purpose. The choices live in the launcher's `settings.json` beside the workspace.

## Packaging Instrumenta

From the workspace root:

```powershell
.\Instrumenta.cmd package
.\Instrumenta.cmd install
```

The package step:

1. builds Imago, Ludere, and LearnChess, each with its own `npm run build`;
2. packages the Electron launcher;
3. runs the real portable launch smoke;
4. writes the installer, portable app, and `release-manifest.json`.

Artifacts land in `Instrumenta\release`:

```text
Instrumenta-Setup-0.9.1.exe
Instrumenta-Portable-0.9.1.exe
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
A workspace is the Instrumenta checkout with its catalog plus at least one product checkout; which
products are cloned beside it is up to the owner.

`INSTRUMENTA_WORKSPACE` can provide an explicit override for scripts or unusual layouts. It points to
the parent folder, not the Instrumenta repository inside it.

Linux and macOS source checkouts can use `./instrumenta.sh` for supported developer orchestration.
The packaged launcher and native product set remain Windows-focused.
