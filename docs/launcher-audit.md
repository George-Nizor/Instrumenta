# Launcher functionality audit

This is the acceptance matrix for the image-first Electron launcher in `electron/`, which is the only
Instrumenta launcher. The superseded Qt/QML proof of concept and its CMake project were removed in
version 0.4.

| Area | Expected behavior | Coverage |
| --- | --- | --- |
| Workspace | Finds a parent holding the launcher catalog and at least one product checkout from settings, environment, app path, executable path, portable path, or current directory | Automated |
| Packaged apps | Finds bundled Imago, Ludere, and LearnChess without a source workspace, and defines Forge3D and Luna from the catalog so they install and update without one | Automated |
| Product order | Lists products in catalog order, Fabula first, however they were found | Automated |
| Source apps | Detects Imago `dist`, Ludere's build or static root, and manifest-backed Fabula runtime bundles; an undeployed runtime remains unavailable | Automated |
| Launch | Trust-checks and runtime-probes a native bundle before direct shell-free spawn; reuses one secure Chromium window per web instrument, and one local server per instrument and build folder | Automated + IPC sender allowlist |
| Renderer boundary | Accepts IPC only from the current launcher renderer; prevents popup, webview, cross-origin frame/navigation, redirect, Bluetooth, device, media-capture, and permission escapes | Automated |
| Session isolation | Preserves historical Imago IndexedDB cutouts and Ludere autosaves in the default session; separates their storage/service workers by stable loopback origin and denies permissions in both | Automated + real Windows storage smoke |
| Local staging | Mirrors a native bundle that lives on a WSL or network share into launcher data and launches the local copy; refreshes on rebuild, reuses otherwise | Automated |
| Rebuild | Prepares Imago, Ludere, and Fabula from tile actions and displays captured failure output | Toolchain smoke test |
| Release lookup | Reads the latest manifest and tag through GitHub's download redirect; treats 404 as nothing published and a rate limit as a hold; falls back to the REST API; refuses a release that needs a newer launcher | Automated with a scripted GitHub |
| Install and update | Installs one product at a time with per-job progress; updates installed products automatically unless turned off, deferring activation while the product is open; skips a version rolled back from | Automated |
| Storage | Downloads under local app data and deletes them after activation; prunes all but the current and previous version; reuses a verified payload on retry; removes the retired roaming download cache and Motus mirror once | Automated |
| Static serving | Binds only to stable per-tool `127.0.0.1` origins, checks Host and final real paths, blocks traversal/symlink escape, and applies app-specific CSP plus isolation, framing, permission, referrer, and no-store headers | Automated + real Windows CSP/runtime smoke |
| Recovery | Restores a closed launcher on second activation; records bounded local diagnostics, stores crash dumps without upload, and offers reload/close after a renderer crash | Automated + smoke test |
| Failure state | Keeps the launcher open and shows a persistent, selectable error dialog | Smoke test |
| Interaction | Full-card launch, keyboard 1/2/3, Ctrl/Cmd+R, Ctrl/Cmd+,, reveal and rebuild actions | Smoke test |
| Motion | Staggered entry, artwork zoom, sheen, subtle pointer tilt, ambient drift; reduced-motion disables movement | CSS + smoke test |
| Packaging | Builds/stages Imago, Ludere, and LearnChess, each with its own build script; builds packages; then launches the portable app with an end-user `PATH` and requires the exact-version launcher/editor smoke marker before publication | Automated metadata + Windows package smoke test |
| Install | Waits for the one-click installer, verifies the installed executable exists in a supported per-user path, matches the exact source product version, and prints the verified path | Automated helper + Windows install smoke test |
| Version dispatch | `Instrumenta.cmd` opens the highest-versioned build among installed application, `release/` package, and source; reports when a newer one exists | Manual check against installed/packaged versions |

The hidden `--instrumenta-launch-check <marker>` acceptance hook opens the real Windows source app,
loads both editor windows, and proves preload IPC, cross-origin isolation, Imago IndexedDB + blob
module/worker + WASM execution, Ludere local storage + service-worker readiness, popup denial, and zero
CSP console violations before writing an atomic success marker. It is intended for release QA, not
ordinary user startup.

Motus, the native editor this matrix was first written around, is discontinued. Its rows went with
it, including the distribution-evidence check that only its FFmpeg bundle needed. A product that runs
from source (Discere, Fabula) is shown as developer-only on a machine without a workspace rather
than as something to install.
