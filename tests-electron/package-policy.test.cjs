'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { assertPortableArtifact, endUserEnvironment, waitForFile } = require('../scripts/package-policy.cjs');
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
