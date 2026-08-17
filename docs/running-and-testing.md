# Running and testing Instrumenta

## Normal Windows use

There is one Windows source entrypoint: `Instrumenta.cmd` at the workspace root. Double-click it to
open Instrumenta, or pass one of the documented commands below. To install desktop and Start menu
shortcuts, run `Instrumenta.cmd install`; it fresh-builds and opens the setup executable.

`Instrumenta.cmd` opens the newest Instrumenta available, comparing the installed application, a
portable package in `Instrumenta\release`, and the source folder. Version is authoritative and build
time breaks equal-version ties. This lets a newer source checkout win and prevents a same-version
artwork rebuild from silently reopening an older installed executable.

The first source-folder launch needs current Node.js LTS and internet access because it downloads
Electron. This is a development bootstrap only. The resulting installer and portable application
carry Chromium and all launcher dependencies themselves.

The window stays open when an application is missing. Selecting its artwork prepares the tool when
possible. The small refresh icon rebuilds a ready source application; preparation output is captured,
and any failure is shown in a persistent in-app dialog.

## What opening a registered product does

- **Native products** accept only a deployed bundle, verify their manifest/path and hidden native-runtime
  handshake, then starts it directly without a shell. If it is unavailable, selecting the card asks
  before installing prerequisites and creating a staged, tested deployment. When the bundle sits on a
  WSL or network share, it is mirrored once into the launcher's own data directory and run from there;
  loading a hundred libraries across a share takes minutes, against a second or two locally. The
  mirror refreshes automatically when Motus is rebuilt.
- **Web products** serve compiled local assets only on their registered `127.0.0.1` port and open them in a dedicated,
  sandboxed Chromium window. It deliberately retains the launcher's historical default browser
  partition so an upgrade preserves the reusable IndexedDB cutout shelf. It does not start Vite or
  open a browser tab.
- The catalog can register additional web products without changing launcher UI or workspace
  discovery. Each product declares its adapter and health contract in `instrumenta/product.json`.
- **Settings** chooses the parent folder containing the registered sibling checkouts.

Keyboard launch uses `1` for Motus, `2` for Imago, and `3` for Ludere. Ctrl/Cmd+R refreshes
readiness; Ctrl/Cmd+, opens settings.

Both local web windows are confined to their assigned loopback origin. Popups, embedded webviews,
cross-origin navigation, capture, device access, and privileged browser permissions are denied. Only
the launcher's own renderer may use the native IPC actions. Unexpected display-process exits offer a
reload/close choice and write a bounded local diagnostic under
`%APPDATA%\instrumenta-launcher\logs`; crash dumps remain local and are never uploaded.

Imago and Ludere intentionally remain in Electron's historical default persistent session for data
compatibility; the distinct fixed ports (`49321` and `49322`) give them separate web origins, so their
local storage, IndexedDB, caches, and service workers do not overlap.

## Setup, updates, and verification

```powershell
.\Instrumenta.cmd setup   # first checkout: launcher runtime + web apps + AI integration
.\Instrumenta.cmd update  # rebuild Imago and Ludere after source changes
.\Instrumenta.cmd build   # rebuild/test all three applications
.\Instrumenta.cmd test    # verify ready components and launcher behavior
.\Instrumenta.cmd doctor  # read-only environment and artifact diagnostics
.\Instrumenta.cmd clean   # remove only regenerable outputs and app-owned caches
```

`setup`, `update`, and `build` accept `all`, `web`, `motus`, `imago`, `ludere`, `launcher`, or `ai`
as an optional second argument. `setup motus` replaces the former standalone Motus setup launcher.
`setup ai` builds and handshakes all three local MCP servers, installs their maintained skills under
the user `.agents/skills` directory, and updates only Instrumenta's marked block in Codex
`config.toml`. Existing MCP servers and the rest of the Codex configuration are preserved. Restart
the agent after setup so it reloads the tool and skill catalog. See [Using Instrumenta with an AI
agent](ai-agents.md) for example prompts and the exact MCP capability boundaries.

`clean` removes launcher releases/staging, web production builds, the Motus CMake build tree,
unfinished deployment directories, temporary package mirrors, and Instrumenta's Chromium/native
launch caches, diagnostic logs, and local crash dumps. It deliberately retains source, `node_modules`, launcher settings, installed apps,
projects/media, Imago/Ludere IndexedDB and local storage, `Motus/prebuilt`, and the last verified
`Motus/dist/windows` bundle.

Verification covers launcher discovery/security, the Motus portable-bundle tests and its
self-containment check, an Imago production build, Ludere's screenplay domain tests, and an existing
Motus CTest build when present. A full Motus build requires the native
toolchain documented in its repository. Installed and portable packages need none of these commands.

`doctor` reports Motus runtime availability and Motus distribution readiness as separate lines. A
bundle that carries `ffmpeg.exe`/`ffprobe.exe` must also carry a valid sibling
`third-party-packages.json` and `THIRD_PARTY_NOTICES.txt`; missing or malformed evidence is a `FIX`.
Only the inventory's explicit `Distribution-ready` state passes this release gate. The currently
staged MSYS2 FFmpeg/x264 inventory intentionally reports `Release-blocked` pending corresponding-source
publication and license-compatibility review, independently of artifact hashes and code signing.

Release QA can additionally invoke Electron with `--instrumenta-launch-check <marker-file>`. This
opens the actual launcher and both editor windows, exercises Imago's blob module/worker and WASM path,
waits for Ludere's service worker, confirms both historical storage APIs and popup denial, and fails
without a marker if any content-policy violation appears in Chromium's console.

Linux and macOS source checkouts use the matching `./instrumenta.sh` commands. The launcher and both
web instruments are cross-platform; Motus remains Windows-first until its native media gates pass.

## Creating Windows applications

From the workspace root:

```powershell
.\Instrumenta.cmd package
.\Instrumenta.cmd install  # same fresh build, then opens the installer
```

The command builds Imago and Ludere, packages them with Electron, and includes Motus from
`Motus\dist\windows`, `Motus\prebuilt\windows`, or `MOTUS_BUNDLE`. The Motus bundle is staged first,
then proved self-contained and runtime-checked with an end-user `PATH`, so an installer never ships a
Motus that cannot open. The result is an installer plus portable application in `Instrumenta\release`.
Each run recreates the local package workspace, validates the canonical mark and Windows icon, and
atomically replaces `release` only after both executables exist. Open the setup executable to install;
it is per-user, requires no administrator access, creates desktop and Start menu shortcuts, and starts
Instrumenta when complete. The executable, shortcut, taskbar AppUserModelID, uninstall entry, and
window identity all use the stable Instrumenta product name and canonical package icon.

Packaging also launches the freshly built portable executable with the release smoke hook under a
minimal end-user `PATH` and requires `INSTRUMENTA_LAUNCH_OK <exact-version>` before publication. The
`install` command waits for setup to finish, locates the installed executable in either supported
per-user location, verifies its Windows product version matches the source package, then prints the
verified version and full executable path.

`release-manifest.json` records the version, byte size, and SHA-256 digest of both artifacts. `doctor`
rechecks those hashes. Public distribution remains gated on both the Motus distribution-readiness
finding above and a valid Authenticode signature; the build does not pretend to clear either gate and
doctor reports each independently.

## Entrypoint ownership

The old layout accumulated forwarding wrappers as the projects were brought into one workspace: an
install shortcut forwarded to the root CMD, the root CMD forwarded to a launcher-repository CMD, and
Motus had a separate setup CMD. Those files did not contain independent build logic, and the extra
hop discarded target arguments. They have been retired. The stable boundary is now:

- `Instrumenta.cmd` — the one human-facing Windows command.
- `Instrumenta/scripts/instrumenta.ps1` — internal suite orchestration used by the CMD and WSL adapter.
- `Motus/scripts/bootstrap-windows.ps1` — internal native provisioning used by the suite orchestrator
  and launcher UI.
- `instrumenta.sh` — a POSIX/WSL compatibility adapter, not a second Windows UX.

## Optional override

`INSTRUMENTA_WORKSPACE` may point to the parent folder containing the registered product checkouts.
The graphical workspace chooser is preferred for ordinary use.
