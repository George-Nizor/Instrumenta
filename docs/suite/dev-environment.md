# Development environment

Updated: 2026-10-06

The workspace lives on the WSL filesystem and is worked on from both sides: agents and tests run in
WSL, while packaging, installing and the GUI run on Windows. Most environment breakage comes from
that split.

## What is needed

| Tool | Used by | Checked 2026-10-06 |
| --- | --- | --- |
| Node 22 (nvm, linked into `~/.local/bin`) | every JS product | v22.22.2 |
| npm / pnpm | everything / Discere | 10.9.7 / 11.17.0 |
| uv + Python 3.12 | Luna, Dimensio | present |
| `powershell.exe`, `wsl.exe` | packaging, Windows builds, Fabula engine | present |
| `gh` | releases | present |
| Codex CLI, Claude Code | Discere generation, Fabula assistant, Dimensio workshop | present |
| ffmpeg | Fabula engine (installed by its own setup into the engine) | not on the WSL `PATH`, by design |

## The one rule: one `node_modules`, two operating systems

When `npm install` runs from Windows inside a WSL checkout, npm installs only the Windows native
bindings (`*-win32-x64-msvc`) and writes `node_modules/.bin` shims without execute bits. In WSL
the same tree then fails with `Cannot find native binding`, or `oxlint: Permission denied`.

On 2026-10-06 this had broken Imago's tests and build, the Imago MCP server (so `doctor`'s handshake
failed), and Forge3D desktop's Vite build. Each was fixed by adding the matching
`*-linux-x64-gnu` package beside the Windows one and restoring execute bits. Nothing was
reinstalled, so the Windows side still works.

To find and fix it again:

Run from the workspace root:

```bash
node Instrumenta/scripts/wsl-native-bindings.cjs           # report, every product
node Instrumenta/scripts/wsl-native-bindings.cjs --fix     # add the Linux bindings, chmod .bin
```

Do not "fix" it by deleting `node_modules` and reinstalling from WSL. That gives the reverse
problem: Windows packaging breaks.

## Fabula: the checkout and the installed engine share WhisperX and ffmpeg

Since 2026-10-13 the owner uses the **installed** Fabula (through Instrumenta). Its engine is in WSL at
`~/.local/share/fabula`, and the owner's real projects are in `~/.local/share/fabula/projects`. The
checkout (`Fabula/`) is for development only. Its `media/` holds throwaway test projects, and tests
use a scratch `FABULA_PROJECTS_ROOT`. Never point either at the engine's projects folder.

To avoid a second 7.5 GB copy, the checkout does not have its own WhisperX environment or ffmpeg.
They are links into the engine:

| Checkout path | Links to |
| --- | --- |
| `Fabula/.venv-whisperx` | `~/.local/share/fabula/venv-whisperx` (WhisperX 3.8.6, torch 2.8.0+cu128, Python 3.12) |
| `Fabula/tools/ffmpeg` | `~/.local/share/fabula/tools/ffmpeg` |
| `Fabula/tools/wsl-libs` | `~/.local/share/fabula/tools/wsl-libs` |

The Whisper models are in `~/.cache/huggingface`, which both use anyway.

**The consequence:** anything done to these from the checkout happens to the installed Fabula too.
This includes `npm run setup:tools`, a `pip install`, or swapping ffmpeg. Before experimenting with
other WhisperX, torch or ffmpeg versions, give the checkout its own copy first:

```bash
cd Fabula
rm .venv-whisperx tools/ffmpeg tools/wsl-libs   # removes the links only
npm run setup:tools                             # builds the checkout's own copies
```

Each engine update reuses the engine's copies and never upgrades WhisperX once it is there
(`scripts/setup-engine.sh`), so the links stay valid across Fabula releases. If the engine is ever
removed, the links break: rerun `npm run setup:tools` in the checkout.

## Open items

- `doctor` reports `ready: false` because `~/.codex/config.toml` has no Instrumenta-managed block,
  so the Ludere and Discere MCP servers are not registered with Codex in WSL. The fix is
  `./instrumenta.sh setup ai`. It was deliberately not run on 2026-10-06 because it also installs
  the Discere skill from a checkout another session was editing. Run it once that work lands.
- The `learn-with-discere` skill shows not ready for the same reason: its installed copy differs from
  the source.
