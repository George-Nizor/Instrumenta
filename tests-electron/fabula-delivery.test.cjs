'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { validateManifest } = require('../scripts/product-registry.cjs');
const { productState } = require('../electron/workspace.cjs');
const { installManagedDirectory } = require('../electron/release-lifecycle.cjs');

// Fabula is delivered as a managed bundle (its Windows release, which sets up its engine in WSL)
// and built, in a developer's workspace, as a native bundle: an Electron runtime deployed beside
// the checkout and handed the checkout as its app.
const entry = {
  id: 'fabula', name: 'Fabula', adapter: 'managed-bundle', packagePolicy: 'optional', sourceDirectory: '../Fabula',
  repository: { provider: 'github', owner: 'George-Nizor', name: 'Fabula', channel: 'stable' },
  tile: { art: 'brand/artwork/fabula-app-art.png' },
};

function checkout(area) {
  const root = path.join(area, 'Fabula');
  fs.mkdirSync(path.join(root, 'instrumenta'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dist', 'windows'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fabula', version: '0.1.0' }));
  const manifest = {
    schemaVersion: 1, id: 'fabula', displayName: 'Fabula', kind: 'native', adapter: 'native-bundle',
    versionSource: { type: 'package-json', path: 'package.json' },
    build: { output: 'dist/windows', bundleManifest: 'fabula-bundle.json', prepare: 'scripts/bootstrap-windows.ps1' },
    launch: { type: 'native', manifest: 'fabula-bundle.json', executable: 'electron.exe', checkArgument: '--instrumenta-launch-check' },
  };
  fs.writeFileSync(path.join(root, 'instrumenta', 'product.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(root, 'dist', 'windows', 'electron.exe'), 'runtime');
  fs.writeFileSync(path.join(root, 'dist', 'windows', 'fabula-bundle.json'), JSON.stringify({ schemaVersion: 1, id: 'fabula', executable: 'electron.exe', version: '0.1.0', arguments: [root] }));
  return { root, manifest };
}

test('a workspace opens the Fabula checkout until a release is installed, then the release', () => {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-fabula-'));
  try {
    const { root, manifest } = checkout(area);
    const product = validateManifest(manifest, root, entry);
    assert.equal(product.adapter, 'managed-bundle', 'delivered as the catalog says');
    assert.equal(product.builtAs, 'native-bundle', 'built as the checkout says');

    const installRoot = path.join(area, 'products');
    const developer = productState(product, '', '', installRoot);
    assert.equal(developer.adapter, 'native-bundle', 'opened the native-bundle way: its runtime mirrored, the checkout its argument');
    assert.equal(developer.ready, true);
    assert.deepEqual(developer.launchArguments, [root]);
    assert.equal(developer.canInstall, true, 'the release is still on offer');
    assert.equal(developer.deliveredAs, 'managed-bundle');

    const source = path.join(area, 'release');
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'Fabula.exe'), 'bootstrap');
    installManagedDirectory({
      sourceRoot: source,
      installRoot,
      manifest: {
        schemaVersion: 1, product: 'fabula', version: '0.1.0', platform: 'windows-x64', minimumInstrumentaVersion: '0.10.0',
        installStrategy: 'managed-bundle', bundle: { asset: 'Fabula-0.1.0-windows-x64.zip', size: 9, sha256: 'a'.repeat(64), entry: 'Fabula.exe' },
      },
    });
    const installed = productState(product, '', '', installRoot);
    assert.equal(installed.adapter, 'managed-bundle', 'an installed release is what opens');
    assert.equal(path.basename(installed.location), 'Fabula.exe');
    assert.equal(installed.installedVersion, '0.1.0');
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});

test('only a native bundle may be delivered as a managed one', () => {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-fabula-'));
  try {
    const { root, manifest } = checkout(area);
    assert.throws(() => validateManifest({ ...manifest, adapter: 'web-vite' }, root, entry), /mismatched adapter/);
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});
