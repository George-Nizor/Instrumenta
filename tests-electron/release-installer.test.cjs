'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  assertDownloadUrl,
  selectAsset,
} = require('../electron/release-installer.cjs');

test('release downloads accept only approved GitHub HTTPS hosts', () => {
  assert.equal(assertDownloadUrl('https://github.com/George-Nizor/Forge3D/releases/download/v0.2.0/bundle.zip').hostname, 'github.com');
  assert.equal(assertDownloadUrl('https://release-assets.githubusercontent.com/example').protocol, 'https:');
  assert.throws(() => assertDownloadUrl('http://github.com/file'), /approved GitHub HTTPS/);
  assert.throws(() => assertDownloadUrl('https://github.example.com/file'), /approved GitHub HTTPS/);
  assert.throws(() => assertDownloadUrl('https://user:secret@github.com/file'), /approved GitHub HTTPS/);
});

test('release asset selection is exact and unambiguous', () => {
  const release = {
    assets: [
      { name: 'instrumenta-release.json', browser_download_url: 'https://github.com/example/manifest' },
      { name: 'bundle.zip', browser_download_url: 'https://github.com/example/bundle' },
    ],
  };
  assert.equal(selectAsset(release, 'bundle.zip').name, 'bundle.zip');
  assert.throws(() => selectAsset(release, 'missing.zip'), /exactly one asset/);
  release.assets.push({ name: 'bundle.zip', browser_download_url: 'https://github.com/example/duplicate' });
  assert.throws(() => selectAsset(release, 'bundle.zip'), /exactly one asset/);
});
