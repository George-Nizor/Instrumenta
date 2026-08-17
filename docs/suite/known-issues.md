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
