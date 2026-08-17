'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { registryFor } = require('../scripts/product-registry.cjs');

const launcher = path.join(__dirname, 'launch-mcp.cjs');

function smoke(app, { timeoutMs = 30_000, nodePath = process.execPath } = {}) {
  const requests = [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'instrumenta-doctor', version: '1.0.0' },
      },
    },
    { jsonrpc: '2.0', method: 'notifications/initialized', params: {} },
    { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  ];
  const result = spawnSync(nodePath, [launcher, app], {
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
    input: `${requests.map((request) => JSON.stringify(request)).join('\n')}\n`,
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw new Error(`${app} MCP could not complete: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${app} MCP exited ${result.status}: ${(result.stderr || '').trim() || 'no diagnostic'}`);
  }
  const messages = String(result.stdout || '').split(/\r?\n/).filter(Boolean).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`${app} MCP wrote non-JSON data to stdout`);
    }
  });
  const initialized = messages.find((message) => message.id === 1);
  const listed = messages.find((message) => message.id === 2);
  if (initialized?.error || !initialized?.result?.serverInfo?.name) {
    throw new Error(`${app} MCP initialization failed: ${JSON.stringify(initialized?.error || initialized || {})}`);
  }
  if (listed?.error || !Array.isArray(listed?.result?.tools) || !listed.result.tools.length) {
    throw new Error(`${app} MCP tool discovery failed: ${JSON.stringify(listed?.error || listed || {})}`);
  }
  return {
    app,
    server: initialized.result.serverInfo,
    protocolVersion: initialized.result.protocolVersion,
    toolCount: listed.result.tools.length,
    tools: listed.result.tools.map((tool) => tool.name),
  };
}

function smokeAll(options) {
  return registryFor(path.resolve(__dirname, '..')).products.map((product) => smoke(product.id, options));
}

if (require.main === module) {
  try {
    process.stdout.write(`${JSON.stringify({ ready: true, results: smokeAll() }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Instrumenta MCP smoke failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { smoke, smokeAll };
