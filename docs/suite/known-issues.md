# Known issues and failure register

Updated: 2026-08-12

This file distinguishes the original reported failure from follow-on failures found while making the
workflow safer.

## K-001 — obsolete MSYS2 Qt package name

**Symptom**

Motus preparation stopped during pacman installation with:

```text
error: target not found: mingw-w64-x86_64-qt6-quickcontrols2
Motus toolchain installation failed with exit code 1.
```

**Cause**

Current MSYS2 mingw64 repositories provide Qt Quick Controls 2 through
`mingw-w64-x86_64-qt6-declarative`; they do not provide the old standalone
`mingw-w64-x86_64-qt6-quickcontrols2` target. The old bootstrap also requested a pacman toolchain
group, which can open an interactive member-selection prompt when invoked by Electron.

**Mitigation in the working tree**

`Motus/scripts/bootstrap-windows.ps1` now installs an explicit package list and uses
`mingw-w64-x86_64-qt6-declarative` instead of the removed target. MSYS2 updates use non-interactive
flags and tolerate the runtime-restart pass.

**Status**

Resolved for current MSYS2 package metadata. Re-test on a clean Windows machine when the bootstrap is
changed or MSYS2 publishes another repository transition.

## K-002 — WSL UNC workspace cannot be used as a native CMake build directory

**Symptom**

The Windows compiler/CMake process could not reliably build from a path beginning with
`\\wsl.localhost\...`.

**Mitigation**

The bootstrap mirrors Motus to a local Windows temporary directory for configure/build/test/deploy,
then publishes the verified bundle back to `Motus/dist/windows`. The previous bundle is retained until
the replacement passes its checks.

**Status**

Mitigated in the bootstrap. The local mirror is removed after the run.

## K-003 — Qt 6.11 rejects compact QML sibling syntax

**Symptom**

The QML compiler failed on compact sibling declarations using `};` in `Motus/app/qml/Main.qml`.

**Mitigation**

Sibling objects and separators were expanded to Qt-compatible syntax.

**Status**

Resolved for the current Qt/QML compiler. Keep QML syntax conservative when upgrading Qt.

## K-004 — packaged Motus runtime probe returned `0xC0000135`

**Symptom**

The native bootstrap reported a successful probe while the Instrumenta package workflow failed when
it copied the bundle into its Windows staging workspace:

```text
Motus native runtime check failed with exit code 3221225781.
```

`3221225781` is Windows status `0xC0000135` (a required DLL could not be found). A direct staged
launch did not create the marker file either.

**Cause**

Qt's deployment step copies Qt's own libraries, QML modules, and plugins. It does not copy the MSYS2
libraries that those binaries import. Fifteen were missing from the bundle, including
`libpcre2-16-0.dll`, `libicuuc78.dll`, `libicuin78.dll`, `zlib1.dll`, `libzstd.dll`, `libb2-1.dll`,
and `libdouble-conversion.dll` — all direct imports of `Qt6Core.dll`, so the loader failed before any
Motus code ran. Copying only `libgcc_s_seh-1.dll`, `libstdc++-6.dll`, and `libwinpthread-1.dll`
addressed the compiler runtime but not Qt's own dependency graph.

The bootstrap probe passed because it ran with `C:\msys64\mingw64\bin` prepended to `PATH`, where the
loader found every missing library. The packaging probe inherited a normal `PATH` and therefore saw
what an end user's computer would see. The two probes disagreed because their environments differed,
not because staging corrupted anything.

**Resolution**

- `Motus/scripts/bundle-runtime.cjs` walks the real PE import tables of every executable, DLL, plugin,
  and QML module in the bundle and copies the transitive closure beside `motus.exe`. Twenty-five
  support libraries are now bundled; `libicudt78.dll`, `libbrotlicommon.dll`, `libiconv-2.dll`, and
  others are reached only through libraries that the walk itself copied.
- The same tool has a `check` mode that proves the closure offline, naming the missing library and
  its importer instead of surfacing an opaque Windows status. It runs in the bootstrap, in
  `Instrumenta.cmd test`, and against the staged tree during packaging.
- Both probes now run with a bare system `PATH`, so a developer machine can no longer mask a missing
  library.
- `app/main.cpp`'s `--instrumenta-launch-check` used to write its marker before Qt was initialised, so
  it could only prove that the executable loaded. It now constructs `QGuiApplication` and compiles the
  root QML component, which exercises the platform plugin and the QML import tree, then exits before
  a window is created.
- The redundant `bin` copy of every Qt library is collapsed into the bundle root, so the bundle is
  117 MB rather than 124 MB despite the added libraries.

**Verification**

Configure, build, CTest, and deploy were run against MSYS2 Qt 6.11. The resulting bundle was copied to
a local staging directory and launched with `PATH` reduced to `system32`, `%SystemRoot%`, and `Wbem`.
The launch check exited 0 with `MOTUS_LAUNCH_OK 0.1.0`, and a plain launch from the same directory
opened the real window (`Motus - Rough Cut`).

**Status**

Resolved. Re-run `Instrumenta.cmd test` after any Qt or MSYS2 upgrade; new upstream dependencies are
picked up automatically by the walk, but the check is what proves it.

## K-005 — Motus build warning

The native build currently warns that `ProjectController::appendMediaReference` ignores a
`[[nodiscard]]` return value. It did not fail the build or the existing CTest suite, but it should be
addressed before treating the native editor as production-ready.

## K-006 — a fresh clone has no Motus bundle

**Symptom**

`Motus/dist/` is ignored by Git, so a clone on a computer without the native toolchain shows Motus as
`NEEDS BUILD` and the Instrumenta package omits it.

**Mitigation**

The bundle is 117 MB of binaries and does not belong in Git history. A verified bundle produced on one
machine can be copied into `Motus/prebuilt/windows` on another; the launcher, the packaging step, and
the self-containment check all accept that location, and `MOTUS_BUNDLE` overrides it explicitly.
`Instrumenta.cmd package` embeds whichever it finds, so the installer it produces carries Motus even
though the source tree did not.

**Status**

Mitigated. Publishing the bundle as a GitHub release asset would remove the manual copy step.

## K-007 — Motus runtime check timed out when launched from the WSL share

**Symptom**

Launching Motus from Instrumenta failed with:

```text
Error invoking remote method 'instrumenta:launch': Error: Motus did not complete its native runtime
check. Rebuild it from Instrumenta.
```

Rebuilding did not help, because nothing was wrong with the build.

**Cause**

The workspace lives on `\\wsl.localhost\...`, so `Motus\dist\windows` is on a WSL share. Windows will
execute from there, but every one of the bundle's libraries is then loaded across the 9p filesystem.
Measured on this machine, the launch check takes **125 seconds** from the share and **1–2 seconds**
from local disk. The launcher's probe timed out at 12 seconds and reported the failure as a broken
runtime, which sent the owner to the rebuild action repeatedly.

Note that this is the read pattern, not raw throughput: copying the same 117 MB bundle off the share
takes 1.4 seconds. Bulk sequential reads are fast; thousands of small mapped reads during process
start are not.

**Resolution**

- `Instrumenta/electron/local-bundle.cjs` mirrors a bundle that sits on a UNC path into
  `%APPDATA%\instrumenta-launcher\apps\Motus` and launches the local copy. A bundle already on local
  disk, including the one inside a packaged installation, is launched where it is and never copied.
- The mirror is stamped with the manifest version and the executable's size and timestamp, so a
  rebuild replaces it and an unchanged bundle is reused. The reuse check costs about 5 ms. The copy
  goes to a `.incoming` directory and is renamed into place, so an interrupted copy is never mistaken
  for a complete one.
- The probe timeout is 60 seconds, and its message now says the likely cause is slow storage rather
  than a broken build.

**Verification**

From the share: 125 s, timing out. After staging: copy 1.4 s, launch check 2.1 s with
`MOTUS_LAUNCH_OK 0.1.0`, and the real `Motus - Rough Cut` window opens. Second launch reuses the
mirror in 5 ms.

**Status**

Resolved.

## K-008 — packaging mirror omitted Motus's scripts

**Symptom**

`Instrumenta.cmd install` and `Instrumenta.cmd package` stopped after building Imago and Ludere:

```text
Staging and runtime-checking the Motus Windows application bundle…
Error: Motus is missing scripts\bundle-runtime.cjs.
```

**Cause**

`Copy-PackageWorkspace` in `Instrumenta/scripts/instrumenta.ps1` mirrors the workspace to a local
Windows path, because a UNC workspace cannot be used for the native build (K-002). For Motus it copied
only the bundle — `dist\windows`, `prebuilt\windows`, or `package\windows` — and never `Motus\scripts`.
`package-windows.cjs` then resolves the closure checker at `Motus\scripts\bundle-runtime.cjs` inside
that mirror, so the self-containment proof added for K-004 could not run and packaging aborted.

Nothing was wrong with the bundle. The two paths disagreed about what the mirror contains: the checker
was introduced alongside the mirror but was never added to the list of things the mirror copies. The
earlier session that added both recorded that packaging itself was not run, so the first real
end-to-end packaging run is what exposed it.

**Resolution**

`Copy-PackageWorkspace` now copies `Motus\scripts` into the mirror alongside the bundle.

**Verification**

`Instrumenta.cmd install` ran end to end: closure verified ("no external libraries are required"),
`Instrumenta-Setup-0.4.0.exe` and `Instrumenta-Portable-0.4.0.exe` produced, and the installer applied.
The installed `resources\apps` now contains Imago, Ludere, and Motus. The installed
`motus.exe --instrumenta-launch-check` exits 0 with `MOTUS_LAUNCH_OK 0.1.0` under a bare system `PATH`.

**Status**

Resolved.

## Non-blocking product gaps

- Motus's native editor shell is still an early functional surface, not a complete end-user video
  editor.
- The launcher and artwork should continue to be refined toward the owner's modern-software/Latin-
  mysticism direction.
- Ludere needs continued parity work around screenplay conveniences and dedicated icon toggles.

## K-009 — accepted-risk register from the Discere/web-service adversarial review (2026-08-19)

A Codex review of the new web-service adapter and Discere seams produced 18 findings. The
lifecycle and injection classes were fixed on `Instrumenta feat/web-service-adapter` and
`Discere rebuild/discere-v1`. The following are **documented as accepted risks** for a
single-user, localhost, first-party-manifest deployment; revisit before any multi-user or
packaged distribution:

- **Port identity (TOCTOU)** — the launcher's port probe closes before the spawn, so another
  local process could claim the port and answer the health check. No health-response
  authentication exists.
- **Registry symlink containment** — `launch.cwd`/`sourceDirectory` containment is lexical;
  a symlinked directory could point outside the product root.
- **Tutor prompt injection (semantic)** — learner questions and lesson text share the model's
  instruction stream; the answer-leak gate catches exact strings and unit-converted numerics
  but not paraphrases ("five volts" for a hidden `5 V`). A trusted instruction boundary and
  semantic boundary checks are the eventual fix.
- **Provider queue is unbounded** — many queued tutor requests behind a stuck codex run retain
  their payloads; a cap + busy error is the fix.
- **Per-attempt timeouts** — a generation with one retry plus a style repair can spend up to
  ~3x its nominal `timeoutMs` wall clock; a single propagated deadline is the fix.
- **Windows process-tree kill in the Discere provider** — `child.kill()` on Windows leaves
  codex's own children running (the hub-side service manager already uses `taskkill /T`;
  the in-app provider does not). Linux/WSL unaffected.
- **Store close on failed boot** — if server init fails between opening SQLite and registering
  the close hook, the handle leaks until process exit.

## K-010 — managed-web loose ends and the untested launcher renderer (2026-09-04)

The 0.9.0 launcher work landed the `managed-web` adapter ahead of any consumer, and a review of the
uncommitted diff before it was committed found four inconsistencies. None bites today because no
catalog product uses `managed-web` yet; all four must be fixed before migrating Imago, Ludere, or
LearnChess onto releases.

- **Update polling excludes managed-web.** `electron/update-check.cjs` `releaseCapable()` accepts
  only `managed-bundle` and `installed-desktop`, so `workspace.cjs` computes `updateAvailable` for
  managed-web from a `versions.latest` that is never populated. `tests-electron/update-check.test.cjs`
  bakes the two-adapter list into an assertion, and the managed-web test proves the feature only by
  injecting `versions` by hand — both pass while the runtime path is dead.
- **Rollback is offered but not implemented.** `workspace.cjs` sets `canRollback` for managed-web,
  but the rollback IPC in `electron/main.cjs` still throws `Only managed bundles support rollback.`
- **No rollback on a failed first serve.** The managed-web confirm path in `main.cjs` confirms the
  pending version on a successful `loadURL` but its catch path never calls
  `rollbackManagedVersion`, unlike the managed-bundle spawn path.
- **The rewritten renderer (hero/rail/particles) has no automated coverage**, and
  `tests-electron/brand.test.cjs` still iterates only the original five products, so the LearnChess
  and Forge3D art and accent tokens are unverified. The release smoke also still opens only Imago
  and Ludere although LearnChess is staged into the installer.

**Status (2026-09-30)**

The three managed-web defects are fixed in the Instrumenta working tree (launcher 0.9.1, not yet
committed); the renderer item is partly addressed.

- Update polling: `releaseCapable()` now reads the registry's single `releaseAdapters` list, so
  managed-web is polled like the other release adapters. `update-check.test.cjs` asserts the three
  adapters, and `managed-web.test.cjs` builds its definition through `validateManifest` (the
  release comes from the catalog entry) instead of injecting one by hand, then checks `canInstall`
  and polling after hydrating from an installed bundle.
- Rollback: `rollbackTool` accepts managed-web, and Roll back now works on any version with a kept
  previous one, not only a pending one, so the button the tile shows always does something.
- Failed first serve: `openWebTool` rolls back a pending managed-web version when its static server
  refuses the build or the page fails to load, and skips that version for automatic updates. The
  static server is now cached per folder and retired by install, rollback and uninstall, so an
  update no longer leaves the old build being served for the rest of the session. The decisions
  are in `electron/lifecycle-policy.cjs`, with `tests-electron/lifecycle-policy.test.cjs`.
- Renderer: `brand.test.cjs` walks the catalog, so LearnChess and Forge3D art and accents are
  checked, and the renderer's decisions (button verbs, rail flags, Add apps rows) moved to
  `electron/renderer/launcher-model.js` with `launcher-model.test.cjs`. **Still open:** the DOM and
  animation layer has no automated coverage, and the release smoke still opens only Imago and
  Ludere, not LearnChess.
