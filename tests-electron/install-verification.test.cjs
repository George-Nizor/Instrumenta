'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizeVersion,
  sameReleaseVersion,
  verifyInstalledCandidates,
} = require('../scripts/install-verification.cjs');
const releaseVersion = require('../package.json').version;
const windowsVersion = `${releaseVersion}.0`;

test('Windows four-part product versions match their three-part release', () => {
  assert.deepEqual(normalizeVersion(windowsVersion), [...releaseVersion.split('.').map(Number), 0]);
  assert.equal(sameReleaseVersion(releaseVersion, windowsVersion), true);
  assert.equal(sameReleaseVersion(releaseVersion, '0.0.0.0'), false);
  assert.equal(sameReleaseVersion('invalid', windowsVersion), false);
});

test('post-install verification finds the matching supported location', () => {
  const installed = verifyInstalledCandidates(releaseVersion, [
    { path: 'old.exe', exists: true, version: '0.0.0.0' },
    { path: 'Instrumenta.exe', exists: true, version: windowsVersion },
  ]);
  assert.equal(installed.path, 'Instrumenta.exe');
});

test('post-install verification clearly rejects missing or stale installs', () => {
  assert.throws(() => verifyInstalledCandidates(releaseVersion, [
    { path: 'Instrumenta.exe', exists: false, version: '' },
  ]), /was not found/);
  assert.throws(() => verifyInstalledCandidates(releaseVersion, [
    { path: 'Instrumenta.exe', exists: true, version: '0.0.0.0' },
  ]), /is not installed/);
});
