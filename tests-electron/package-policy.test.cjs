'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  assertPortableArtifact,
  endUserEnvironment,
  packagedWebProducts,
  waitForFile,
  webBuildSteps,
} = require('../scripts/package-policy.cjs');
const releaseVersion = require('../package.json').version;

test('packaged runtime checks use an end-user system PATH', () => {
  const environment = endUserEnvironment({ SystemRoot: 'D:\\Windows', Path: 'C:\\toolchain', TOKEN: 'keep' });
  assert.equal(environment.Path, 'D:\\Windows\\system32;D:\\Windows;D:\\Windows\\system32\\Wbem');
  assert.equal(environment.PATH, undefined);
  assert.equal(environment.ELECTRON_RUN_AS_NODE, undefined);
  assert.equal(environment.NODE_OPTIONS, undefined);
  assert.equal(environment.TOKEN, 'keep');
});

test('portable artifact resolution requires the exact release version', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-package-policy-'));
  try {
    fs.mkdirSync(path.join(root, 'release'));
    fs.writeFileSync(path.join(root, 'release', `Instrumenta-Portable-${releaseVersion}.exe`), 'portable');
    assert.equal(
      assertPortableArtifact(root, releaseVersion),
      path.join(root, 'release', `Instrumenta-Portable-${releaseVersion}.exe`),
    );
    assert.throws(() => assertPortableArtifact(root, '0.0.0'), /was not produced/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('portable smoke marker polling is bounded and handles detached GUI launchers', () => {
  let elapsed = 0;
  let attempts = 0;
  const options = {
    fileSystem: { existsSync: () => ++attempts === 3 },
    timeoutMs: 100,
    intervalMs: 10,
    now: () => elapsed,
    delay: (milliseconds) => { elapsed += milliseconds; },
  };
  assert.equal(waitForFile('ready.txt', options), true);
  assert.equal(attempts, 3);

  elapsed = 0;
  assert.equal(waitForFile('missing.txt', {
    ...options,
    fileSystem: { existsSync: () => false },
  }), false);
  assert.ok(elapsed >= 100);
});

function productSource(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-build-steps-'));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, name), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return root;
}

test('a packaged web product is built by its own package.json, whatever its adapter', () => {
  // Imago and LearnChess: a lockfile, so a clean install, then their build script.
  const vite = productSource({ 'package.json': { scripts: { build: 'tsc -b && vite build' }, devDependencies: { vite: '1' } }, 'package-lock.json': '{}' });
  // Ludere: no dependencies at all, so nothing to install; its build script runs scripts/build.mjs.
  const plain = productSource({ 'package.json': { scripts: { build: 'node scripts/build.mjs' } } });
  // Dependencies but no lockfile: an ordinary install.
  const unlocked = productSource({ 'package.json': { scripts: { build: 'vite build' }, dependencies: { vite: '1' } } });
  const unbuildable = productSource({ 'package.json': { scripts: { test: 'node --test' } } });
  try {
    assert.deepEqual(webBuildSteps(vite), [['ci'], ['run', 'build']]);
    assert.deepEqual(webBuildSteps(plain), [['run', 'build']]);
    assert.deepEqual(webBuildSteps(unlocked), [['install'], ['run', 'build']]);
    assert.throws(() => webBuildSteps(unbuildable), /declares no build script/);
    assert.throws(() => webBuildSteps(path.join(plain, 'absent')), /no readable package\.json/);
  } finally {
    for (const root of [vite, plain, unlocked, unbuildable]) fs.rmSync(root, { recursive: true, force: true });
  }
});

test('every static web product is baked into the installer and a service never is', () => {
  const products = [
    { id: 'fabula', kind: 'native', adapter: 'native-bundle' },
    { id: 'imago', kind: 'web', adapter: 'web-vite' },
    { id: 'ludere', kind: 'web', adapter: 'web-static' },
    { id: 'discere', kind: 'web', adapter: 'web-service' },
    { id: 'moved', kind: 'web', adapter: 'managed-web' },
  ];
  assert.deepEqual(packagedWebProducts(products).map(({ id }) => id), ['imago', 'ludere', 'moved']);
});
