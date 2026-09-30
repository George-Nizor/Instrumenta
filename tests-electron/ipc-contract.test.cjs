'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const electron = path.join(__dirname, '..', 'electron');

// The renderer can only call what preload exposes, and preload can only reach what main.cjs
// registers. A channel on one side and not the other fails at the click, not at startup.
test('every channel preload exposes is handled by the launcher, and nothing else is', () => {
  const preload = fs.readFileSync(path.join(electron, 'preload.cjs'), 'utf8');
  const main = fs.readFileSync(path.join(electron, 'main.cjs'), 'utf8');
  const exposed = [...preload.matchAll(/ipcRenderer\.invoke\('(instrumenta:[a-z-]+)'/g)].map((match) => match[1]).sort();
  const handled = [...main.matchAll(/handleLauncher\('(instrumenta:[a-z-]+)'/g)].map((match) => match[1]).sort();
  assert.deepEqual(exposed, handled);
  for (const channel of ['instrumenta:install-many', 'instrumenta:set-preferences']) assert.ok(handled.includes(channel), channel);
});

test('the renderer calls only what preload exposes', () => {
  const preload = fs.readFileSync(path.join(electron, 'preload.cjs'), 'utf8');
  const renderer = fs.readFileSync(path.join(electron, 'renderer', 'renderer.js'), 'utf8');
  const exposed = new Set([...preload.matchAll(/^\s{2}([a-zA-Z]+): /gm)].map((match) => match[1]));
  const called = new Set([...renderer.matchAll(/window\.instrumenta\.([a-zA-Z]+)\(/g)].map((match) => match[1]));
  assert.deepEqual([...called].filter((name) => !exposed.has(name)), []);
});
