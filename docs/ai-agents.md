# Using Instrumenta with an AI agent

Instrumenta exposes Imago and Ludere as local MCP servers, and Discere's too when its checkout is in
the workspace. Each server has a matching Codex skill that teaches an agent the safe,
revision-friendly workflow for that instrument. Only servers the launcher can start are registered:
Forge3D's manifest names a skill of its own plugin, which setup leaves alone. Motus, which had the
first of these servers, is discontinued. LearnChess and Fabula declare no MCP block here: LearnChess has nothing an agent should drive, and
Fabula's pipeline runs inside WSL under a Claude Code session started in its own folder (its
`.mcp.json` registers the tools there), which the host-side Codex setup cannot reach.
This integration is installed from a source workspace with Node.js and the relevant build toolchain;
it is intentionally not embedded in the self-contained end-user Electron package.

## One-time setup

From the workspace root on Windows:

```powershell
.\Instrumenta.cmd setup ai
```

From Linux, macOS, or a Codex session running inside WSL:

```bash
./instrumenta.sh setup ai
```

Setup builds and handshakes every registered MCP server, copies the maintained skills to
`~/.agents/skills`, and updates only the marked Instrumenta block in the active Codex
`config.toml`. It preserves every unrelated MCP server and setting. Restart Codex after the first
setup or after a skill update so the host reloads its catalogue.

Run the same command after pulling changes. It is idempotent. Use `Instrumenta.cmd doctor` (or
`./instrumenta.sh doctor`) to check the server entrypoints, installed skill hashes, configuration,
and live MCP handshakes without changing anything.

## What to ask

Mentioning the skill explicitly is the most predictable way to start:

```text
Use $compose-images-with-imago to make three editable YouTube thumbnail variants from these images.
Use $write-screenplays-with-ludere to outline act two, draft the next scene, and export Final Draft.
```

The skills favour editable project files and stable IDs over one-shot output. They tell the agent to
inspect before changing an existing project, use absolute media paths, reject accidental overwrites,
and report every persisted project/export path. You can move between AI edits and the visual apps:
Imago persists layered `.imago.json` documents and can hand one into its editor, and Ludere uses
portable `.ludere` files.

## Capability boundaries

- Imago MCP covers editable templates, replaceable slots, layers, text, cutout/grade/beauty,
  animation, brand defaults, image export, and visual-editor handoff.
- Ludere MCP covers screenplay metadata and blocks, beat boards, search/validation, atomic portable
  saves, FDX/plain-text import, and Ludere/FDX/text/printable-HTML export. Browser-local autosave,
  theme, and focus-sprint state remain UI-only.

Visible open actions are only used when requested. Existing exports are not overwritten without an
explicit approval or an `overwrite` option supplied by the caller.

## Troubleshooting

```powershell
.\Instrumenta.cmd doctor
.\Instrumenta.cmd setup ai
```

If doctor reports a stale skill after setup, restart the agent host. If an MCP binary is missing,
`setup ai` rebuilds only the AI integration; it does not clean projects, media, or application
settings.
