const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const launcherRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(launcherRoot, '..');

test('the package mirror includes Imago build-time script inputs', () => {
  const inputs = JSON.parse(fs.readFileSync(path.join(launcherRoot, 'scripts', 'package-inputs.json'), 'utf8'));
  const imagoPackage = JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'Imago', 'package.json'), 'utf8'));
  assert.ok(inputs.imago.includes('scripts'), 'Imago scripts must be copied into the Windows-local package workspace');
  for (const command of Object.values(imagoPackage.scripts || {})) {
    for (const match of command.matchAll(/(?:^|\s)(scripts[\\/][^\s;&|]+)/g)) {
      const referenced = match[1].replace(/['"]/g, '');
      assert.ok(inputs.imago.includes('scripts'));
      assert.ok(fs.existsSync(path.join(workspaceRoot, 'Imago', referenced)), `missing Imago build input: ${referenced}`);
    }
  }
});

test('the package mirror includes Ludere MCP modules used by its tests', () => {
  const orchestrator = fs.readFileSync(path.join(launcherRoot, 'scripts', 'instrumenta.ps1'), 'utf8');
  assert.match(orchestrator, /'tests', 'mcp'/, 'Ludere MCP must accompany MCP protocol tests in the package mirror');
  assert.ok(fs.existsSync(path.join(workspaceRoot, 'Ludere', 'mcp', 'index.mjs')));
});
