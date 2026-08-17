# Instrumenta knowledge base

This is the durable context for future agents. Verify changing facts against the source tree before
acting on them.

## Workspace map

```text
Instrumenta/                 workspace root (this folder)
├── Instrumenta/             Electron launcher, packaging, shared brand
├── Motus/                    C++/Qt native application
├── Imago/                    TypeScript/Vite image application
├── Ludere/                   local-first screenplay application
└── docs/                     cross-project handoff notes
```

App-specific documentation lives beside each app. The root `docs/` folder is for decisions and
cross-project workflows.

## Launch and packaging boundaries

- Instrumenta is the desktop front door.
- Imago and Ludere open in secure Chromium windows from the Electron launcher.
- Motus opens as a native process and must be represented by a verified bundle manifest
  (`motus-bundle.json`) beside its executable.
- The launcher uses Motus's hidden `--instrumenta-launch-check <marker-path>` contract before launch.
- A successful check writes `MOTUS_LAUNCH_OK <version>` to the marker and exits successfully.
- Package builds should include Motus only after the same check passes from the exact staged bundle.

Useful source files:

- `Instrumenta/electron/native-launch.cjs` — trusted Motus discovery and probe.
- `Instrumenta/scripts/package-windows.cjs` — Imago/Ludere build, Motus staging, Electron Builder.
- `Instrumenta/scripts/instrumenta.ps1` — Windows setup/update/package orchestration.
- `Motus/scripts/bootstrap-windows.ps1` — MSYS2, local mirror, native build, deploy, probe, publish.
- `Motus/packaging/motus-bundle.json.in` — bundle manifest template.

## Safe Motus update sequence

1. Ensure MSYS2 package names match the live repository.
2. Build from a local Windows path when the workspace is a WSL UNC path.
3. Run the Motus CTest suite.
4. Deploy Qt/QML runtime into a new staging directory.
5. Run the marker-file probe without relying on MSYS2 `PATH`.
6. Replace `Motus/dist/windows` only after the probe passes.
7. Copy that exact bundle into Instrumenta's package staging directory.
8. Run the package-time probe again from the staged directory.
9. Build installer/portable artifacts only after step 8 passes.

## Current toolchain facts

- The current MSYS2 mingw64 Qt set uses `mingw-w64-x86_64-qt6-base` and
  `mingw-w64-x86_64-qt6-declarative`.
- `mingw-w64-x86_64-qt6-quickcontrols2` is obsolete/not found in the current repository.
- The Qt deployment helper may place DLLs under `bin`; the portable layout must be tested as a
  Windows application, not inferred from a successful CMake install log.
- A Windows GUI process can make shell exit-code checks misleading; the marker file is the reliable
  readiness signal.

## Brand and UI direction

- Instrumenta uses image-first app artwork and shared muted tokens.
- Imago and Motus artwork exists under `Instrumenta/brand/artwork/`.
- Marks live under `Instrumenta/brand/` and Motus/Ludere also have app-local public/assets marks.
- Keep Latin-inspired symbolism abstract and contemporary: modern software first, mystic undertone
  second.
- High-frequency settings should be icon buttons with accessible labels/tooltips; hover can reveal the
  full word without making the default UI text-heavy.
- The cross-editor interaction, geometry, and semantic-colour contract is documented in
  [`editor-ui-system.md`](editor-ui-system.md). Imago and Motus share this contract without becoming
  visual clones.

## Verification commands

From Windows PowerShell, using the source-folder launcher:

```powershell
.\Instrumenta.cmd setup
.\Instrumenta.cmd update
.\Instrumenta.cmd test
.\Instrumenta.cmd package
```

For Motus specifically:

```powershell
.\Instrumenta.cmd setup motus
```

Do not call a package successful merely because CMake and CTest pass. Confirm the native executable
launches from the published/staged bundle with no MSYS2 or developer-runtime `PATH` assistance.
