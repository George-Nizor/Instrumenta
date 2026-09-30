# Instrumenta AI integration

This directory is the maintained source for Instrumenta's local agent integration:

- `launch-mcp.cjs` resolves and starts the host-appropriate stdio server for a product that declares
  one (Imago, Ludere, Discere).
- `mcp-smoke.cjs` negotiates MCP and verifies the advertised tool contracts.
- `setup-agent.cjs` installs each declared product's skill and updates only Instrumenta's marked Codex
  config block.
- product manifests own the canonical, versioned skills; setup discovers them from each registered
  checkout and copies them to `~/.agents/skills`.

Use the suite entrypoint rather than invoking these scripts directly:

```powershell
.\Instrumenta.cmd setup ai
.\Instrumenta.cmd doctor
```

On a Linux/macOS/WSL agent host, use `./instrumenta.sh setup ai`. Setup is idempotent and preserves
unrelated agent configuration. See [`../docs/ai-agents.md`](../docs/ai-agents.md) for workflows and
capability boundaries.
