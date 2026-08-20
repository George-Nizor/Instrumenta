'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  assertDownloadUrl,
  planArchiveExtraction,
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

test('archive extraction passes literal paths outside PowerShell command text', () => {
  const archive = 'C:\\release cache\\Forge3D.zip';
  const destination = 'C:\\installed products\\Forge3D';
  const plan = planArchiveExtraction(archive, destination, { PATH: 'system-only' });
  assert.equal(plan.command, 'powershell.exe');
  assert.equal(plan.options.env.INSTRUMENTA_ARCHIVE, archive);
  assert.equal(plan.options.env.INSTRUMENTA_DESTINATION, destination);
  assert.equal(plan.options.env.PATH, 'system-only');
  assert.ok(plan.args.includes('-NonInteractive'));
  assert.doesNotMatch(plan.args.join(' '), /release cache|installed products/);
  assert.match(plan.args.at(-1), /\$env:INSTRUMENTA_ARCHIVE/);
});
