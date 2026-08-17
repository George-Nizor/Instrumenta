# Launcher functionality audit

This is the acceptance matrix for the image-first Electron launcher in `electron/`, which is the only
Instrumenta launcher. The superseded Qt/QML proof of concept and its CMake project were removed in
version 0.4.

| Area | Expected behavior | Coverage |
| --- | --- | --- |
| Workspace | Finds a parent containing Motus, Imago, and Ludere from settings, environment, app path, executable path, portable path, or current directory | Automated |
| Packaged apps | Finds bundled Imago and Ludere without a source workspace; prefers a deployed Motus bundle | Automated |
| Source apps | Detects Imago `dist`, Ludere's build or static root, and manifest-backed Motus deploy bundles; raw build executables remain unavailable | Automated |
| Launch | Trust-checks and runtime-probes Motus before direct shell-free spawn; reuses one secure Chromium window and local server per web instrument | Automated + IPC sender allowlist |
| Renderer boundary | Accepts IPC only from the current launcher renderer; prevents popup, webview, cross-origin frame/navigation, redirect, Bluetooth, device, media-capture, and permission escapes | Automated |
| Session isolation | Preserves historical Imago IndexedDB cutouts and Ludere autosaves in the default session; separates their storage/service workers by stable loopback origin and denies permissions in both | Automated + real Windows storage smoke |
| Local staging | Mirrors a Motus bundle that lives on a WSL or network share into launcher data and launches the local copy; refreshes on rebuild, reuses otherwise | Automated |
| Rebuild | Rebuilds ready Imago/Motus from card actions and displays captured failure output | Toolchain smoke test |
| Static serving | Binds only to stable per-tool `127.0.0.1` origins, checks Host and final real paths, blocks traversal/symlink escape, and applies app-specific CSP plus isolation, framing, permission, referrer, and no-store headers | Automated + real Windows CSP/runtime smoke |
| Recovery | Restores a closed launcher on second activation; records bounded local diagnostics, stores crash dumps without upload, and offers reload/close after a renderer crash | Automated + smoke test |
| Failure state | Keeps the launcher open and shows a persistent, selectable error dialog | Smoke test |
| Interaction | Full-card launch, keyboard 1/2/3, Ctrl/Cmd+R, Ctrl/Cmd+,, reveal and rebuild actions | Smoke test |
| Motion | Staggered entry, artwork zoom, sheen, subtle pointer tilt, ambient drift; reduced-motion disables movement | CSS + smoke test |
| Packaging | Builds/stages Imago and Ludere; proves staged Motus closure/runtime; builds packages; then launches the portable app with an end-user `PATH` and requires the exact-version launcher/editor smoke marker before publication | Automated metadata + Windows package smoke test |
| Motus distribution | Reads bundle-root third-party inventory/notices without changing them; reports missing/invalid FFmpeg evidence and every status other than explicit `Distribution-ready` as a distinct release `FIX` | Automated helper + doctor smoke test |
| Install | Waits for the one-click installer, verifies the installed executable exists in a supported per-user path, matches the exact source product version, and prints the verified path | Automated helper + Windows install smoke test |
| Version dispatch | `Instrumenta.cmd` opens the highest-versioned build among installed application, `release/` package, and source; reports when a newer one exists | Manual check against installed/packaged versions |

The hidden `--instrumenta-launch-check <marker>` acceptance hook opens the real Windows source app,
loads both editor windows, and proves preload IPC, cross-origin isolation, Imago IndexedDB + blob
module/worker + WASM execution, Ludere local storage + service-worker readiness, popup denial, and zero
CSP console violations before writing an atomic success marker. It is intended for release QA, not
ordinary user startup.

The launcher deliberately does not claim that a source-only Motus checkout is an end-user video
editor. Its tile exposes native build/deploy failures directly, and the packaged suite includes
Motus only when a manifest-backed bundle is present and proved self-contained. This keeps readiness
honest while Motus's playback and M0 media gates remain open.
