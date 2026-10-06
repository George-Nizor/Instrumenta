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
| uv + Python 3.12 | Luna, Forge3D | present |
| `powershell.exe`, `wsl.exe` | packaging, Windows builds, Fabula engine | present |
| `gh` | releases | present |
| Codex CLI, Claude Code | Discere generation, Fabula assistant, Forge3D | present |
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

## Open items

- `doctor` reports `ready: false` because `~/.codex/config.toml` has no Instrumenta-managed block,
  so the Ludere and Discere MCP servers are not registered with Codex in WSL. The fix is
  `./instrumenta.sh setup ai`. It was deliberately not run on 2026-10-06 because it also installs
  the Discere skill from a checkout another session was editing. Run it once that work lands.
- The `learn-with-discere` skill shows not ready for the same reason: its installed copy differs from
  the source.
