'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { productState } = require('../electron/workspace.cjs');
const { resolveManagedInstall, validateReleaseManifest } = require('../electron/release-lifecycle.cjs');
const { validateManifest } = require('../scripts/product-registry.cjs');

const DIGEST = crypto.createHash('sha256').update('bundle').digest('hex');

function releaseManifest(id, version) {
  return {
    schemaVersion: 1,
    product: id,
    version,
    platform: 'windows-x64',
    minimumInstrumentaVersion: '0.9.0',
    installStrategy: 'managed-web',
    bundle: { asset: `${id}-${version}.zip`, size: 6, sha256: DIGEST, entry: 'index.html' },
  };
}

function productManifest(id, displayName, port) {
  return {
    schemaVersion: 1,
    id,
    displayName,
    kind: 'web',
    adapter: 'managed-web',
    versionSource: { type: 'package-json', path: 'package.json' },
    build: { output: '.', command: 'npm run build' },
    launch: { type: 'web', root: '.', port, fallbackPort: port - 4300, entry: 'index.html', health: id },
  };
}

// A managed install as installManagedDirectory would leave it on disk.
function installManagedWeb(installRoot, id, version, { pending = false, previous = '' } = {}) {
  const versionRoot = path.join(installRoot, id, 'versions', version);
  fs.mkdirSync(path.join(versionRoot, 'instrumenta'), { recursive: true });
  fs.writeFileSync(path.join(versionRoot, 'index.html'), '<!doctype html><title>x</title>');
  fs.writeFileSync(path.join(versionRoot, 'instrumenta-release.json'), JSON.stringify(releaseManifest(id, version)));
  fs.writeFileSync(path.join(versionRoot, 'instrumenta', 'product.json'), JSON.stringify(productManifest(id, 'Ludere', 49322)));
  fs.writeFileSync(path.join(installRoot, id, 'current.json'), JSON.stringify({ current: version, previous, pending }));
  return versionRoot;
}

function temporaryRoot(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `instrumenta-${label}-`));
}

function definition(sourceRoot = '') {
  return {
    id: 'ludere', displayName: 'Ludere', kind: 'web', adapter: 'managed-web',
    build: { output: 'dist', command: 'npm run build' },
    launch: { type: 'web', port: 49322, fallbackPort: 45022, entry: 'index.html', health: 'ludere' },
    release: { repository: { provider: 'github', owner: 'George-Nizor', name: 'Ludere' } },
    sourceRoot,
    catalog: { packagePolicy: 'optional', tile: { art: 'brand/artwork/ludere-app-art.png', theme: 'ludere' } },
  };
}

test('a managed-web release manifest is accepted and carries its entry', () => {
  const manifest = validateReleaseManifest(releaseManifest('ludere', '0.5.2'), 'ludere');
  assert.equal(manifest.installStrategy, 'managed-web');
  assert.equal(manifest.bundle.entry, 'index.html');
  // The same leaf-name rule that protects an executable protects the web entry.
  assert.throws(
    () => validateReleaseManifest({ ...releaseManifest('ludere', '0.5.2'), bundle: { ...releaseManifest('ludere', '0.5.2').bundle, entry: '../escape.html' } }, 'ludere'),
    /safe file name/,
  );
});

test('a managed-web product manifest answers the same health contract as web-vite', () => {
  const root = temporaryRoot('managed-web-manifest');
  const entry = { id: 'ludere', adapter: 'managed-web', packagePolicy: 'optional', tile: { art: 'brand/artwork/ludere-app-art.png' } };
  const resolved = validateManifest(productManifest('ludere', 'Ludere', 49322), root, entry);
  assert.equal(resolved.adapter, 'managed-web');
  assert.equal(resolved.launch.health, 'ludere');

  const mismatched = productManifest('ludere', 'Ludere', 49322);
  mismatched.launch.health = 'imago';
  assert.throws(() => validateManifest(mismatched, root, entry), /health contract is invalid/);

  const unported = productManifest('ludere', 'Ludere', 49322);
  delete unported.launch.port;
  assert.throws(() => validateManifest(unported, root, entry), /valid launch.port/);
});

test('an installed managed-web release is what gets served', () => {
  const installRoot = temporaryRoot('managed-web-install');
  const versionRoot = installManagedWeb(installRoot, 'ludere', '0.5.2');
  const managed = resolveManagedInstall(installRoot, 'ludere');
  assert.equal(managed.version, '0.5.2');
  assert.equal(managed.strategy, 'managed-web');

  const state = productState(definition(), '', '', installRoot);
  assert.equal(state.kind, 'web');
  assert.equal(state.ready, true);
  assert.equal(state.state, 'READY');
  assert.equal(state.location, versionRoot, 'the served root is the managed version directory');
  assert.equal(state.version, '0.5.2');
  assert.equal(state.installedVersion, '0.5.2');
  assert.equal(state.canUninstall, true);
  assert.equal(state.packaged, false);
});

test('a managed release outranks the copy baked into the installer', () => {
  const installRoot = temporaryRoot('managed-web-order');
  const resources = temporaryRoot('managed-web-resources');
  const baked = path.join(resources, 'apps', 'ludere');
  fs.mkdirSync(baked, { recursive: true });
  fs.writeFileSync(path.join(baked, 'index.html'), '<!doctype html><title>baked</title>');

  // With nothing installed the baked build still runs: adding a release must not
  // strand a product whose build ships inside the launcher.
  const bakedState = productState(definition(), '', resources, installRoot);
  assert.equal(bakedState.ready, true);
  assert.equal(bakedState.location, baked);
  assert.equal(bakedState.packaged, true);
  assert.equal(bakedState.lifecycle, 'bundled');
  assert.equal(bakedState.canInstall, true, 'it can still be moved onto releases');

  const versionRoot = installManagedWeb(installRoot, 'ludere', '0.5.2');
  const managedState = productState(definition(), '', resources, installRoot);
  assert.equal(managedState.location, versionRoot);
  assert.equal(managedState.lifecycle, 'installed');
});

test('a managed-web product with nothing installed offers an install, not a launch', () => {
  const installRoot = temporaryRoot('managed-web-empty');
  const state = productState(definition(), '', '', installRoot);
  assert.equal(state.ready, false);
  assert.equal(state.state, 'AVAILABLE');
  assert.equal(state.canInstall, true);
  assert.equal(state.canUninstall, false);
  assert.equal(state.updateAvailable, false);
  assert.equal(state.detail, 'Install the latest verified release.');
});

test('a managed-web tile offers an update only against the installed release', () => {
  const installRoot = temporaryRoot('managed-web-update');
  installManagedWeb(installRoot, 'ludere', '0.5.2');

  const current = productState(definition(), '', '', installRoot, { latest: { ludere: '0.5.2' } });
  assert.equal(current.updateAvailable, false);

  const stale = productState(definition(), '', '', installRoot, { latest: { ludere: '0.6.0' } });
  assert.equal(stale.updateAvailable, true);
  assert.match(stale.detail, /0\.6\.0/);

  // Nothing installed means nothing to compare against, whatever the feed says.
  const empty = productState(definition(), '', '', temporaryRoot('managed-web-none'), { latest: { ludere: '0.6.0' } });
  assert.equal(empty.updateAvailable, false);
});

test('a pending managed-web version is reported until its first serve confirms it', () => {
  const installRoot = temporaryRoot('managed-web-pending');
  installManagedWeb(installRoot, 'ludere', '0.5.2', { pending: true, previous: '0.5.1' });
  const state = productState(definition(), '', '', installRoot);
  assert.equal(state.pending, true);
  assert.equal(state.canRollback, true, 'the previous version is still there to fall back to');
});
