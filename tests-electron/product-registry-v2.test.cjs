'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { validateManifest } = require('../scripts/product-registry.cjs');

function lunaManifest() {
  return {
    schemaVersion: 2,
    id: 'luna',
    name: 'Luna',
    version: '0.3.0',
    description: 'Local voice studio',
    repository: { provider: 'github', owner: 'George-Nizor', name: 'Luna', channel: 'stable' },
    developer: { source: '../Luna' },
    platforms: ['windows-x64'],
    adapter: {
      type: 'installed-desktop',
      releaseManifestAsset: 'instrumenta-release.json',
      versionProbe: { type: 'windows-uninstall', displayName: 'Luna' },
      launch: { type: 'installed-executable', candidates: ['%LOCALAPPDATA%\\Programs\\Luna\\Luna.exe'] },
      uninstall: { type: 'windows-uninstall', displayName: 'Luna' },
    },
  };
}

test('normalizes schema v2 installed desktop manifests without weakening v1', () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-v2-'));
  const entry = { id: 'luna', adapter: 'installed-desktop', packagePolicy: 'optional' };
  try {
    const product = validateManifest(lunaManifest(), source, entry);
    assert.equal(product.schemaVersion, 2);
    assert.equal(product.displayName, 'Luna');
    assert.equal(product.adapter, 'installed-desktop');
    assert.equal(product.release.repository.name, 'Luna');
    assert.equal(product.launch.candidates.length, 1);
  } finally {
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('schema v2 rejects adapter mismatch, path-like assets, and non-GitHub repositories', () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-v2-invalid-'));
  const entry = { id: 'luna', adapter: 'installed-desktop' };
  try {
    assert.throws(() => validateManifest({
      ...lunaManifest(),
      adapter: { ...lunaManifest().adapter, type: 'managed-bundle' },
    }, source, entry), /mismatched adapter/);
    assert.throws(() => validateManifest({
      ...lunaManifest(),
      adapter: { ...lunaManifest().adapter, releaseManifestAsset: '../manifest.json' },
    }, source, entry), /safe file name/);
    assert.throws(() => validateManifest({
      ...lunaManifest(),
      repository: { provider: 'other', owner: 'George-Nizor', name: 'Luna' },
    }, source, entry), /GitHub/);
  } finally {
    fs.rmSync(source, { recursive: true, force: true });
  }
});

test('schema v2 describes executables; a managed-web product keeps its schema-v1 manifest', () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-v2-web-'));
  try {
    assert.throws(() => validateManifest({
      ...lunaManifest(),
      id: 'ludere',
      name: 'Ludere',
      adapter: { ...lunaManifest().adapter, type: 'managed-web' },
    }, source, { id: 'ludere', adapter: 'managed-web' }), /managed-web product keeps a schema-v1 manifest/);
  } finally {
    fs.rmSync(source, { recursive: true, force: true });
  }
});
