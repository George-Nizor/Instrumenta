'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { registryFor } = require('../scripts/product-registry.cjs');

const launcherRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(launcherRoot, '..');

function productDefinition(app) {
  return registryFor(launcherRoot).products.find((product) => product.id === app) || null;
}

function firstFile(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function resolveServer(app, platform = process.platform) {
  const product = productDefinition(app);
  if (!product) throw new Error(`Unknown Instrumenta MCP: ${app}`);
  // LearnChess and Fabula declare no MCP block: nothing here should be driven
  // from the host by an agent, and the smoke test must say so, not crash.
  if (!product.mcp) throw new Error(`${product.displayName} declares no MCP server.`);
  if (product.adapter === 'native-bundle') {
    const candidates = platform === 'win32'
      ? [product.mcp.windows, 'build/windows-mingw-release/motus-mcp.exe']
      : [...(product.mcp.posix || [])];
    const executable = firstFile(candidates.filter(Boolean).map((candidate) => path.join(product.sourceRoot, candidate)));
    if (!executable) {
      throw new Error(`${product.displayName} MCP is not built for ${platform}. Run Instrumenta's AI setup again.`);
    }
    return { command: executable, args: [], cwd: product.sourceRoot };
  }

  if (product.kind === 'web') {
    const entry = firstFile([
      path.join(product.sourceRoot, product.mcp.entry),
      path.join(product.sourceRoot, 'mcp', 'dist', 'index.js'),
      path.join(product.sourceRoot, 'mcp', 'dist', 'index.mjs'),
    ]);
    if (entry) {
      return { command: process.execPath, args: [entry], cwd: product.sourceRoot, module: entry };
    }
    const tsx = path.join(product.sourceRoot, 'mcp', 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const source = path.join(product.sourceRoot, 'mcp', 'src', 'index.ts');
    if (fs.existsSync(tsx) && fs.existsSync(source)) {
      return { command: process.execPath, args: [tsx, source], cwd: product.sourceRoot };
    }
    throw new Error(`${product.displayName} MCP is not built. Run Instrumenta's AI setup again.`);
  }
  throw new Error(`${product.displayName} does not declare a supported MCP adapter.`);
}

async function run(app) {
  const server = resolveServer(app);
  if (server.module) {
    process.chdir(server.cwd);
    await import(pathToFileURL(server.module).href);
    return;
  }
  const child = spawn(server.command, server.args, {
    cwd: server.cwd,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  process.stdin.pipe(child.stdin);
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  let stopping = false;
  const stopChild = (signal) => {
    if (stopping || child.exitCode !== null || child.signalCode !== null) return;
    stopping = true;
    child.kill(signal);
  };
  const forwardInterrupt = () => stopChild('SIGINT');
  const forwardTermination = () => stopChild('SIGTERM');
  // MCP hosts normally close stdin for an orderly shutdown. Forward explicit wrapper termination
  // too, so a native server cannot be orphaned if the host stops the Node shim first.
  process.once('SIGINT', forwardInterrupt);
  process.once('SIGTERM', forwardTermination);
  process.stdin.once('error', (error) => {
    if (error.code !== 'EPIPE') {
      process.stderr.write(`Instrumenta lost ${app} MCP stdin: ${error.message}\n`);
      stopChild('SIGTERM');
    }
  });
  child.stdin.once('error', (error) => {
    if (error.code !== 'EPIPE') process.stderr.write(`Instrumenta could not write to ${app} MCP: ${error.message}\n`);
  });
  child.once('error', (error) => {
    process.stderr.write(`Instrumenta could not start ${app} MCP: ${error.message}\n`);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    process.removeListener('SIGINT', forwardInterrupt);
    process.removeListener('SIGTERM', forwardTermination);
    if (signal && !stopping) {
      process.stderr.write(`${app} MCP stopped after signal ${signal}.\n`);
      process.exitCode = 1;
    } else {
      process.exitCode = code ?? 1;
    }
  });
}

if (require.main === module) {
  run(process.argv[2] || '').catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { resolveServer };
