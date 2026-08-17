# Instrumenta agent session log

Use one dated entry per substantial session. Keep entries factual and link to the issue or knowledge
entry that future agents should read first.

## 2026-08-12 — machine cleaned to one install; K-008 resolved

### User-reported problem

Several Instrumenta entry points and a stale installation had accumulated on the machine. The request
was to remove everything not needed and leave a clean starting point for a fresh install.

### Removed — 1.75 GB

- Installed **Instrumenta 0.2.0** (375 MB, `resources/apps` held only Imago), through its own
  per-user uninstaller. Desktop and Start menu shortcuts and the `HKCU` uninstall entry went with it.
- `%LOCALAPPDATA%\instrumenta-launcher-updater` — the cached 0.2.0 installer, 108 MB.
- `%LOCALAPPDATA%\Instrumenta\package-workspace` — 408 MB of packaging staging, rebuilt per run.
- Thirteen `%TEMP%\instrumenta-*` build mirrors, 880 MB, from earlier bootstrap and packaging attempts.
- `Instrumenta/release` 0.3.1 installer and portable, 228 MB, both predating Motus.
- `Motus/build/manual`, 78 MB of Linux test binaries including the pre-rename `ve_core_tests*`;
  `./instrumenta.sh test-core` rebuilds them.
- The launcher's Electron profile caches. `settings.json` and its workspace pointer were preserved.

Kept deliberately: `%LOCALAPPDATA%\Instrumenta\developer-runtime` (362 MB, the Electron runtime that
source runs and packaging need), `Motus/dist/windows` (117 MB, verified, not reproducible without the
native toolchain), `Imago/node_modules`, and both web `dist/` folders.

Historical note: these source entrypoints were later consolidated. The one public Windows command is
now the root `Instrumenta.cmd`; `setup motus` reaches the internal Motus bootstrap directly.

### Bug found by running packaging for the first time

`Copy-PackageWorkspace` mirrored the Motus bundle but not `Motus\scripts`, so the closure checker that
K-004 added could not be found inside the mirror and `install`/`package` aborted. See
[K-008](known-issues.md#k-008--packaging-mirror-omitted-motuss-scripts).

- `Instrumenta/scripts/instrumenta.ps1` — the mirror now copies `Motus\scripts` alongside the bundle.

### Verification

`Instrumenta.cmd install` ran end to end: Imago and Ludere built, the Motus closure verified with no
external libraries required, and `Instrumenta-Setup-0.4.0.exe` plus `Instrumenta-Portable-0.4.0.exe`
produced and installed. The machine now carries exactly one Instrumenta, **0.4.0**, whose
`resources\apps` contains Imago, Ludere, and Motus. The installed `motus.exe --instrumenta-launch-check`
exits 0 with `MOTUS_LAUNCH_OK 0.1.0` under a bare system `PATH`, so Motus opens from the installed
application rather than from the share.

### Note for the owner

Motus now runs from local disk inside the installation, so the K-007 mirror-from-the-share path is no
longer exercised in ordinary use. It still applies when opening Instrumenta from the source folder.

## 2026-08-12 — Motus launch timeout from the WSL share; K-007 resolved

### User-reported problem

Launching Motus repeatedly failed with "Motus did not complete its native runtime check. Rebuild it
from Instrumenta." Rebuilding did not help.

### Cause

Location, not the build. The workspace is on `\\wsl.localhost\...`, so every library in the bundle was
being loaded across the 9p filesystem. Measured here: the launch check takes 125 s from the share and
1–2 s locally, against a 12 s probe timeout. The error text then blamed the build and pointed at the
rebuild action, which could never fix it.

Worth recording: copying the same 117 MB off the share takes 1.4 s. The problem is thousands of small
mapped reads during process start, not throughput.

### Changes

- `Instrumenta/electron/local-bundle.cjs` — mirrors a UNC-hosted bundle into
  `%APPDATA%\instrumenta-launcher\apps\Motus` and launches the local copy. Local bundles, including
  the one inside a packaged installation, are launched in place and never copied. The mirror is
  stamped with manifest version plus executable size and timestamp, so rebuilds replace it and
  unchanged bundles are reused in about 5 ms. Copy goes to `.incoming` and is renamed into place.
- `Instrumenta/electron/main.cjs` — stages before probing, reports the one-time copy in the window,
  and trusts the staged location.
- `Instrumenta/electron/native-launch.cjs` — probe timeout raised to 60 s; the timeout message now
  names slow storage as the likely cause instead of blaming the build.
- `Instrumenta/tests-electron/local-bundle.test.cjs` — six tests covering UNC detection, local
  passthrough, mirror-once-then-reuse, refresh after rebuild, recovery from an interrupted copy, and
  refusal of a bundle with no manifest.

### Verification

On the real share: 125 s and timing out before, then copy 1.4 s, launch check 2.1 s with
`MOTUS_LAUNCH_OK 0.1.0`, and the real `Motus - Rough Cut` window opening. 19 launcher tests pass.

## 2026-08-12 — one launcher; version-aware dispatch; dead artefacts removed

### User-reported problem

`Instrumenta.cmd` opened something that looked nothing like the release application.

### Cause

`Open-Instrumenta` preferred the installed application unconditionally. The installed copy was 0.2.0
from 9 August — before the artwork and before Ludere — while 0.3.1 packages sat unopened in
`release/`. Nothing was broken in the current launcher; the command was simply dispatching to the
oldest build on the machine. Its installed `resources/apps` contained only Imago.

### Changes

- `Instrumenta/scripts/instrumenta.ps1` — `run` now compares versions across the installed
  application, the newest `release/` package, and `package.json`, opens the highest, and says so when
  the one it opens is newer than the installed application or when the source folder is newer than
  both. Portable packages are ranked by parsed version rather than by file timestamp.
- Removed the superseded Qt/QML launcher: `Instrumenta/app/`, `CMakeLists.txt`, `CMakePresets.json`,
  `tests/discovery_tests.cpp`, and `build/`. Nothing referenced it; the Electron launcher in
  `electron/` is the only launcher. A copy is in this session's scratchpad only, so recover it from
  there if it is ever wanted.
- `Instrumenta/.github/workflows/windows.yml` built that dead Qt launcher and installed
  `mingw-w64-x86_64-qt6-quickcontrols2`, the package removed from MSYS2 in K-001, so CI could not have
  passed. It now runs the launcher tests.
- `Motus/.github/workflows/core-windows.yml` gained the portable-bundle tests.
- `Instrumenta/scripts/test-workspace-core.sh` compiled the deleted discovery tests. It now covers the
  Motus C++ core and the bundle-runtime tests.
- Deleted `Motus/build/windows-mingw-release`, an abandoned configure against the `\\wsl.localhost`
  UNC path (K-002). `workspace-manager verify` ran `ctest` there and failed; `Instrumenta.cmd test`
  now completes.
- Deleted the 0.2.0 and 0.3.0 release artefacts (460 MB) and two empty `.agents`/`.codex` directories.
- Version bumped to 0.4.0, the first build that carries all three instruments; `Instrumenta.code-workspace`
  now includes Ludere.

### Verification

Version selection was evaluated against the real machine state: installed 0.2.0, portable 0.3.1 — it
now selects 0.3.1 where it previously selected 0.2.0. `workspace-manager verify` passes end to end,
as does `./instrumenta.sh test-core`.

### Follow-up for the owner

The 0.3.1 packages predate the Motus fix and contain no Motus. Run `.\Instrumenta.cmd install` to
build and install 0.4.0 with all three instruments; that also replaces the stale 0.2.0 installation
and its shortcuts.

## 2026-08-12 — Motus made portable; K-004 resolved

### Goal

Make Motus a portable application that Instrumenta can embed and launch, so installing Instrumenta
delivers all three instruments in one folder structure.

### Root cause found

Qt's deployment step never copied the MSYS2 libraries that Qt itself imports. Fifteen were missing,
including `libpcre2-16-0.dll`, `libicuuc78.dll`, `zlib1.dll`, and `libzstd.dll` — all direct imports of
`Qt6Core.dll`. The bootstrap probe passed only because it ran with `C:\msys64\mingw64\bin` on `PATH`;
the packaging probe used a normal `PATH` and saw what an end user's computer would see. Staging was
never the problem.

### Changes

- `Motus/scripts/bundle-runtime.cjs` — PE import-table walker. `complete` copies the transitive
  dependency closure into the bundle and collapses Qt's duplicate `bin` folder; `check` proves the
  closure offline and names the missing library and its importer.
- `Motus/tests/bundle_runtime_tests.cjs` — seven tests over synthetic PE images, so the walk is covered
  on any host including Linux.
- `Motus/scripts/bootstrap-windows.ps1` — runs `complete` and `check` in place of the previous
  three-DLL copy, resolves Node (installing MSYS2's if the machine has none), and probes with a bare
  system `PATH`.
- `Motus/app/main.cpp` — `--instrumenta-launch-check` now initialises `QGuiApplication` and compiles the
  root QML component before writing its marker, so it proves the platform plugin and QML imports load
  rather than only that the executable starts.
- `Instrumenta/scripts/package-windows.cjs` — stages first, then closure-checks and probes the staged
  tree with an end-user environment; accepts `MOTUS_BUNDLE` and `Motus/prebuilt/windows`.
- `Instrumenta/scripts/workspace-manager.cjs` — `Instrumenta.cmd test` runs the bundle tests and the
  self-containment check.
- `Instrumenta/electron/workspace.cjs`, `main.cjs` — `prebuilt/windows` is a discovered and trusted
  bundle location.

### Verification

Configure, build, CTest, and deploy ran against MSYS2 Qt 6.11. The bundle was staged to a local
directory and launched with `PATH` reduced to `system32`, `%SystemRoot%`, and `Wbem`: the launch check
exited 0 with `MOTUS_LAUNCH_OK 0.1.0`, and a plain launch opened the real `Motus - Rough Cut` window.
`Motus/dist/windows` now holds that verified 117 MB bundle, and `workspace-manager status` reports all
three instruments READY. Twenty tests pass across the launcher and bundle suites.

### Follow-ups

- K-005 (`[[nodiscard]]` warning) is still open.
- K-006: a fresh clone still has no bundle, since `dist/` is not in Git. A release asset would remove
  the manual copy step.
- Packaging itself was not run here; it requires a Windows host with the launcher's npm dependencies
  installed.

## 2026-08-12 — Motus preparation and handoff documentation

### User-reported problem

Instrumenta failed to prepare Motus after MSYS2 installed successfully. Pacman could not find
`mingw-w64-x86_64-qt6-quickcontrols2` and the bootstrap exited with code 1.

### Work observed/completed before this documentation pass

- Replaced the obsolete standalone Quick Controls package with the current Qt declarative package.
- Made the MSYS2 package list explicit and non-interactive.
- Added local Windows mirroring for WSL UNC workspaces.
- Corrected Qt 6.11-incompatible compact QML sibling syntax.
- Added Motus's marker-file launch handshake and launcher/package-side probes.
- Added runtime staging logic for Qt and MinGW DLLs.
- Motus native configure/build/CTest/deploy completed in the latest bootstrap run.

### Current blocker

The exact Instrumenta package staging workflow still fails its Motus probe with Windows status
`0xC0000135` (`3221225781`), even after the staged bundle received root-level Qt and MinGW runtime
DLLs. See [K-004](known-issues.md#k-004--packaged-motus-runtime-probe-still-returns-0xc0000135).

### Documentation added

- [Product brief](product-brief.md)
- [Known issues](known-issues.md)
- [Knowledge base](knowledge-base.md)
- [Session template](session-template.md)

### Handoff

The next agent should investigate transitive Windows DLL dependencies from the exact package staging
directory and should not publish an installer until the no-developer-runtime probe passes there.
