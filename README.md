# Instrumenta desktop

Instrumenta is the lightweight Electron front door for the Instrumenta creative suite. It opens
Motus as a native desktop process, opens Imago and Ludere in separate secure Chromium windows, and
runs Discere as a managed background service with its own window.
Both editors deliberately keep their established browser storage so upgrades preserve Imago's
reusable IndexedDB cutout shelf and Ludere's autosaved screenplay. Their preferred stable loopback
ports still give them separate origins; if Windows reserves one of those ports (as Hyper-V/WSL can),
the launcher uses a documented stable fallback port. Navigation, popups, embedded webviews, device access, capture, and other
privileged browser permissions are denied by default.

## Repository boundary

Instrumenta is a standalone repository. Motus, Imago, and Ludere are independent sibling checkouts;
the suite does not use Git submodules and does not require their source to be committed here. The
`products/catalog.json` registry describes available checkouts, while each product's
`instrumenta/product.json` declares its build, launch, MCP, and health-check contract.

To add a product that uses an existing adapter, add its repository manifest and one catalog entry.
Only a genuinely new lifecycle requires an adapter implementation in this repository. Product
versions remain independent; suite packages record the exact product inventory they embed.

## Everyday use

From the parent workspace folder, double-click `Instrumenta.cmd`. This is the only public Windows
source entrypoint. For a conventional Windows installation with desktop and Start menu shortcuts,
run `Instrumenta.cmd install`; `package` builds the same artifacts without opening the installer.

The end-user path is the generated `Instrumenta-Setup-0.7.0.exe`: double-click it once, accept the
upgrade prompt if an older Instrumenta is installed, and then use the Start menu or desktop shortcut.
The installer upgrades the same per-user application, preserves settings and product documents, and
removes the old application files. `Instrumenta.cmd` remains a developer/source-workspace helper.

Discere is not embedded in the installer: its server, dependencies, and Codex CLI authentication
live in the WSL checkout. The installed launcher reaches it through the source workspace — choose
the workspace once inside Instrumenta (for a WSL checkout, the share path such as
`\\wsl.localhost\Ubuntu\...\Instrumenta`) and the Discere tile starts the service inside the
distribution over a `wsl.exe` bridge (`electron/wsl-bridge.cjs`). WSL2 forwards the loopback port,
so the window talks to `http://127.0.0.1:49323` like any other product. The distribution's login
shell must resolve `pnpm` (a symlink in `~/.local/bin` beside the existing `node` one suffices).

`Instrumenta.cmd` opens the newest Instrumenta available across the installed application, a portable
package in `release/`, and this source folder. Version is authoritative; build time breaks
equal-version ties, so a newer source checkout or same-version artwork rebuild is not hidden behind
an older installed executable.

The Electron launcher in `electron/` is the only launcher. The superseded Qt/QML proof of concept and
its CMake project were removed; no Qt or CMake toolchain is needed for Instrumenta itself.

## Development

If Node.js LTS is installed:

```powershell
npm install
npm run apps:prepare:web
npm start
npm test
npm run verify
npm run package:windows
```

`npm run package:windows` builds Imago and Ludere, stages both inside Instrumenta, includes the
deployed Motus bundle when available, then emits two files in
`release/`:

- `Instrumenta-Setup-<version>.exe` — one-click per-user installer with shortcuts.
- `Instrumenta-Portable-<version>.exe` — self-contained application with no installation.

Before publishing those files, packaging opens the freshly built portable app under an end-user
environment and requires its real launcher/Imago/Ludere security smoke marker for the exact release
version. `Instrumenta.cmd install` then verifies that the installed executable exists and reports its
matching product version and path, so a completed update is unambiguous.

The package metadata fixes the executable, shortcut, taskbar identity, and product name to
`Instrumenta`; the installer and installed shortcuts use the canonical `packaging/icon.svg` mark.
The launcher stores its existing settings under `instrumenta-launcher` so upgrading does not lose a
previously selected workspace.

Local MCP servers, Codex configuration, and agent skills are source/developer-host integration. They
are not embedded in the installed Electron GUI; run
`Instrumenta.cmd setup ai` (or `./instrumenta.sh setup ai`) from a source workspace.

Instrumenta automatically finds a workspace when the executable lives anywhere below the folder
containing `Motus`, `Imago`, and `Ludere`. An installed copy lets the user choose that folder once and stores
the selection in Electron's per-user application data.

## Motus launch safety

Instrumenta never opens a raw Motus build artifact. Motus becomes ready only after its deploy step
creates `dist/windows/motus-bundle.json` beside the portable executable and Qt runtime. Before every
launch, Instrumenta verifies that the executable remains inside that trusted bundle, invokes its hidden
`--instrumenta-launch-check` marker-file handshake, and then starts it directly without a command shell.

On a fresh Windows computer, click the unavailable Motus card (or its refresh icon) and approve the
preparation dialog. Instrumenta runs the checked-in bootstrap, installs the MSYS2/Qt prerequisites when
needed, builds and tests Motus into a staging folder, validates the deployed Qt runtime, and only then
replaces the previous working bundle. A failed update leaves the last verified bundle in place.

Unexpected renderer or Electron utility-process exits are recorded locally in the launcher's bounded
`logs/launcher.log`; renderer failures offer reload/close recovery and crash dumps are retained
locally without upload. `Instrumenta.cmd clean` removes these diagnostics along with regenerable
caches while retaining settings and application data.

See [`docs/running-and-testing.md`](docs/running-and-testing.md) for the complete workflow.

The parent workspace is intentionally not a fifth repository. It is simply the folder containing
the four sibling checkouts and is selected by `INSTRUMENTA_WORKSPACE` or the launcher settings.
