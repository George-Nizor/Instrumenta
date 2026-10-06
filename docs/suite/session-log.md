# Instrumenta agent session log

Use one dated entry per substantial session. Keep entries factual and link to the issue or knowledge
entry that future agents should read first.

## 2026-09-04 — workspace assessment: the unlogged 2026-08-21…27 work committed, docs realigned

### Problem

The sessions between 2026-08-21 and 2026-08-27 (LearnChess onboarding, the managed-web adapter,
update detection, the hero renderer, Discere recovery v2, the Forge3D desktop round) rewrote the
workspace `CLAUDE.md` but logged nothing here and committed nothing: roughly 200 dirty files sat
across four repositories, and the owner had lost track of where things stood.

### Change

- Reviewed every uncommitted diff, ran every suite, and committed the work on each `main`:
  Instrumenta `eeb187c` (0.8.0 → 0.9.0; 141 tests), LearnChess `bcfa6b8` (138 tests, 7 skipped),
  Forge3D `4fd94d7` (42 + 38 tests), Discere `9893c5b` (typecheck clean, 368 unit tests).
  Nothing is pushed; all four are ahead of their remotes by one commit.
- Review findings fixed before committing: Forge3D's `BUNDLE_VERSION` and codex-client version now
  derive from `package.json` (the hardcoded `0.2.2` would have reported a permanent plugin
  version-mismatch after the bump to `0.2.2+codex.20260822.desktop1`), and its release template
  matches what `build_desktop.ps1` produces.
- Launcher managed-web loose ends recorded as [K-010](known-issues.md#k-010) rather than fixed:
  update polling excludes managed-web, rollback is offered but the IPC throws, no first-serve
  rollback, and the rewritten renderer has no automated coverage.
- Docs realigned with the committed state: launcher `README`/`running-and-testing`/
  `product-lifecycle`/`products/README` (0.9.0, seven products, managed-web, update detection),
  workspace `README` (the launcher now detects newer releases for release-backed products),
  Forge3D `desktop-architecture` (cloud checkbox gone, PLY routing, export section), Discere
  roadmap/visual-comparison gate statuses (Gates 1–3 approved, Gate 4 implemented and verified).
- Housekeeping: four stray files removed from the workspace root (two zero-byte `=…` redirect
  accidents, an unreferenced mockup PNG, a stale session-resume note); Discere's 14 dead `/tmp`
  worktree records pruned; every fully merged local branch deleted across all repositories.

### Open decisions

- Discere Gate 4 (essay experience) awaits George's visual approval; Gate 5 (review) is unstarted.
- Discere keeps five `fleet/*` branches with 2–3 unmerged commits each, dated 2026-08-17 — probably
  superseded by main, except `fleet/curriculum-visuals`, which holds a sourced series-circuit
  lesson that exists nowhere else. Diff before deleting.
- Nothing has been pushed anywhere; pushing remains an owner action.

### Handoff

The "new avenue of Motus" became **Fabula**, the ninth workspace repo, bootstrapped the same day
(`Fabula` commits `073c212`, `a190d7a`): a standalone Electron app for transcript-driven
talking-head editing — WhisperX cuts reviewed as strikethrough text, Claude-planned visuals
composited by Fabula's own runtime. Claude Design was dropped from the pipeline by owner decision
after the investigation found no official Design MCP exists. Read `Fabula/docs/product-brief.md`
before touching it; it records the decisions, the toolchain (ffmpeg 7.0.2, WhisperX 3.8.6, CUDA on
the 4080 SUPER), and the export-spike findings — including a Chromium shared-memory flake on this
WSL host that a `wsl --shutdown` likely clears.
Motus itself stays clean at `095f7cc`, frozen per `Motus/docs/milestones.md`; Fabula does not
change Motus's milestone gates.

## 2026-08-19 — release 0.7.0: Discere launchable from the installed Windows launcher

### Problem

The previous session left Discere launchable only from a WSL terminal, and the new catalog entry
silently broke `Instrumenta.cmd install`: `package-windows.cjs` staged every `kind: "web"` product
regardless of `packagePolicy`, so packaging would have tried to build Discere as a static site and
aborted. Windows also cannot run Discere's service directly — no pnpm on the Windows PATH, Linux
native modules in `node_modules`, and the Codex CLI authentication lives inside WSL.

### Change

- Both feature branches merged to main: Discere `rebuild/discere-v1` and hub
  `feat/web-service-adapter`; suite version bumped to 0.7.0.
- New `electron/wsl-bridge.cjs`: when a managed service's working directory is a
  `\\wsl.localhost` / `\\wsl$` share, the launch is wrapped in `wsl.exe --exec bash -lc` (login
  shell), service env travels inline, the service runs in its own session with its process-group id
  in a pid file, and stop signals that group through a second `wsl.exe` call (TERM, then KILL plus
  taskkill of the local bridge child). Preparation follows the same bridge so Windows pnpm never
  writes into the Linux checkout. `package-windows.cjs` now leaves web-service products out of the
  installer by design.
- Machine setup: `pnpm` and `corepack` symlinked into `~/.local/bin` so the WSL login shell used by
  the bridge resolves them (node/npm already followed that pattern).

### Verification

Hub tests 103/103 and registry validation clean on main. Live end-to-end against the exact spawn the
launcher performs: healthy in ~2s, Windows-side `curl.exe` served `/api/health`, both course ids,
and the SPA on `127.0.0.1:49323`; bridge stop freed the port, removed the pid file, left no stray
processes. WSL2 loopback forwarding proven with a probe server before the design was committed.

### Handoff

The owner runs `Instrumenta.cmd install` on Windows (packaging must run there), then in the
installed launcher chooses this workspace once via the `\\wsl.localhost\Ubuntu\...` share path.
Windows packaging of Discere itself remains deferred; K-009 accepted risks unchanged.

## 2026-08-19 — Discere rebuilt and enrolled as the fourth product

### Problem

Codex's original Discere build had excellent docs but ~1/30th of the specified product: no AI
integration (copy/paste packets only), a never-rendered two-design-system UI, 2 lessons/2 questions
of content, and no hub integration.

### What happened (Claude Code session, all phases in one night)

- **Discere `rebuild/discere-v1`** (17 commits): hygiene (canonical DB path, consolidated Drizzle
  migrations, prompts loaded from disk with clause snapshot tests); a real tutor provider spawning
  the local Codex CLI (`codex exec`, ChatGPT-subscription auth, writing-gate + one style-editor
  repair, image-attached workings review); `apps/web` rewritten from scratch to the approved
  Interactive Story design (React Router, white/black/green tokens, black rail + bottom navigator);
  a codex authoring pipeline plus two full courses (Electronics Foundations 5 lessons/20 questions,
  The Rise of the Roman Empire 3 lessons/13 questions with retrieved Wikimedia visuals and a
  timeline activity); FSRS scheduling (`ts-fsrs`), real streaks, per-course review interleaving,
  notebook with pen canvas; single-origin serving (`DISCERE_WEB_ROOT`), `instrumenta/product.json`,
  a real stdio MCP server (7 tools) and the `learn-with-discere` skill.
- **Hub `feat/web-service-adapter`** (5 commits): new `web-service` adapter — registry validation
  (command allowlist, contained cwd, env shape, path health contract), `electron/service-process.cjs`
  (port pick, health gate, process-group kill), `openWebTool`/`prepareTool`/workspace-manager
  branches, per-tool CSP header injection, Discere partition, brand assets (mark, generated tile
  art, tokens), catalog enrollment (`packagePolicy: optional`).

### Verified

Discere: `pnpm verify` green; Playwright 18/18 in a real Chromium (first-ever browser render of this
app); 36 committed screenshots reviewed against the approved mockup. Live codex calls verified:
tutor ask (10 s, coach mode, no answer leak) and a workings-review image transcription. Hub: 91/91
tests; `service-process.cjs` driven against the real manifest picked port 49323, health-gated the
pnpm→tsx tree, served SPA + `/api/courses` from one origin, and killed the whole tree cleanly;
Electron launcher booted under WSLg with the four-product catalog.

### Known limits / handoff

Windows packaging of Discere is deferred (`packagePolicy: optional`; a tsx-from-source server cannot
run from `resources/apps` without Node). Playwright/Electron on this WSL2 machine need
`sudo apt-get install -y libnspr4 libnss3 libasound2t64` for a permanent fix (a scratchpad
`LD_LIBRARY_PATH` extraction works meanwhile — see Discere `docs/ui-ux/screenshots/README.md`).
The MCP defaults to port 49323 and honestly reports unreachable if the launcher ever falls back to
45023. Inter is specified but not self-hosted; the system font stack ships.

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

## 2026-10-06 — coordination uplift: environment, catalogue, backlog, brand directions

- Environment: every product's tests pass from WSL (Discere not run; another session was working there).
  Imago, Imago MCP, Forge3D desktop and the launcher had Windows-only `node_modules`. Added the Linux
  bindings beside the Windows ones and restored `.bin` execute bits; new
  `Instrumenta/scripts/wsl-native-bindings.cjs` reports and fixes this. See `dev-environment.md`.
- `doctor` handshake now passes. Still `ready: false`: Codex config has no managed block. Run
  `./instrumenta.sh setup ai` after the Discere work lands.
- Notes consolidated: the workspace `docs/` folder (unversioned, and ahead of this copy by K-009 and
  four session entries) moved here into `docs/suite/`. New: `catalogue.md`, `backlog.md`,
  `decisions.md`, `dev-environment.md`, and working practices in `README.md`. No Notion connector
  was available, so the owner chose to keep tracking in the repository.
- Brand: `brand/concepts/brand-directions-2026-10.html` previews three directions (also published as
  an artifact). The owner has not chosen yet; no production assets changed.

## 2026-10-06 (later) — brand v2 foundation and the launcher rebuild

- Branch `feat/brand-v2-launcher`. Brand v2 foundation: `brand/icons/instrumenta-icons.js` (single
  source for every icon), generated SVG/PNG/ICO/art/tokens via `uv run brand/scripts/build-brand.py`,
  vendored Fraunces/Commissioner/Spline Sans Mono, v1 and Luna's 1-bit look archived.
- Launcher window rebuilt in v2; every existing behaviour kept. New: About (Bonehead Labs links,
  per-app "Report a problem", licences), credits roll, What's new (release notes from the tag
  message via `--notes-file`), Storage (measure, delete unfinished downloads, forget a rollback
  version), Readiness, the organ (notes, startup chord, a tune after seven clicks; sound off by
  default), Latin names, seasonal ambience, update celebrations, workshop journal.
- 250 tests pass. Checked in headless Chromium with a mocked API; **not yet run as the real
  Electron app on Windows**. Storage, Readiness, links and self-update notes need that check.
- `brand/ALIGNMENT.md`: the guide for per-app brand reviews in fresh chats.

## 2026-10-06 (evening) — Instrumenta 0.11.0 released and installed

- Released v0.11.0 (brand v2, Console and Library views, About/What's new/Storage/Readiness/journal,
  large updates wait, themes). CI built and published it; the tag message is its What's new.
- The owner's installed 0.10.1 found 0.11.0 and started its self-update, but the download sat at
  0 bytes for 8+ minutes on a stuck CDN connection. The same code downloaded it in 6 s from WSL and
  from Electron's Node on Windows, so it was that connection, not the logic. 0.11.0 was installed
  directly (setup downloaded, SHA-256 checked against the manifest, `/S`), and is running.
- Hardening on `main`, not yet released: release downloads fail after 60 s without a byte and
  resume on retry, instead of hanging. Ship it with the next launcher release.
