const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  discover,
  findWorkspace,
  isWorkspace,
  loadRegistry,
  productDefinitions,
  productState,
  releaseDefinition,
} = require('../electron/workspace.cjs');
const { releaseCapable } = require('../electron/update-check.cjs');

const launcherCatalog = path.join(__dirname, '..', 'products', 'catalog.json');
const repository = (name) => ({ provider: 'github', owner: 'George-Nizor', name, channel: 'stable' });

// Minimal product manifests, written inline so these tests do not depend on sibling checkouts.
const manifests = {
  fabula: {
    schemaVersion: 1, id: 'fabula', displayName: 'Fabula', kind: 'native', adapter: 'native-bundle',
    build: { output: 'dist/windows' }, launch: { type: 'native' },
  },
  imago: {
    schemaVersion: 1, id: 'imago', displayName: 'Imago', kind: 'web', adapter: 'web-vite',
    build: { output: 'dist', command: 'npm run build' }, launch: { type: 'web', port: 49321, health: 'imago' },
  },
  ludere: {
    schemaVersion: 1, id: 'ludere', displayName: 'Ludere', kind: 'web', adapter: 'web-static',
    build: { output: 'dist', command: 'npm run build' }, launch: { type: 'web', port: 49322, health: 'ludere' },
  },
};

function catalogEntry(id, name, adapter) {
  return {
    id, name, sourceDirectory: `../${name}`, repository: repository(name), requiredForSuite: false,
    packagePolicy: 'optional', adapter, tile: { art: `brand/artwork/${id}-app-art.png`, theme: id },
  };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

// A workspace as the owner has one: the launcher checkout with its catalog, and product checkouts
// beside it. `checkouts` picks which of the three products are actually there.
function withWorkspace(callback, checkouts = ['fabula', 'imago', 'ludere']) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-workspace-'));
  const workspace = path.join(temporary, 'Instrumenta');
  writeJson(path.join(workspace, 'Instrumenta', 'products', 'catalog.json'), {
    schemaVersion: 2,
    products: [
      catalogEntry('fabula', 'Fabula', 'native-bundle'),
      catalogEntry('imago', 'Imago', 'web-vite'),
      catalogEntry('ludere', 'Ludere', 'web-static'),
    ],
  });
  for (const id of checkouts) {
    writeJson(path.join(workspace, manifests[id].displayName, 'instrumenta', 'product.json'), manifests[id]);
  }
  try {
    callback(workspace);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

// The launcher's own catalog, copied somewhere with no sibling checkouts: an installed launcher on
// a machine that has never seen a source workspace.
function withLauncherCatalogOnly(callback) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-end-user-'));
  const catalogBase = path.join(temporary, 'app');
  fs.mkdirSync(path.join(catalogBase, 'products'), { recursive: true });
  fs.copyFileSync(launcherCatalog, path.join(catalogBase, 'products', 'catalog.json'));
  try {
    callback({ temporary, catalogBase });
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

test('a managed-service product is ready only once its server can run from source', () => {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-service-state-'));
  const sourceRoot = path.join(area, 'Discere');
  const output = path.join(sourceRoot, 'apps', 'web', 'dist');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'index.html'), '<!doctype html><title>Discere</title>');
  const product = {
    id: 'discere', displayName: 'Discere', kind: 'web', adapter: 'web-service', sourceRoot,
    build: { output: path.join('apps', 'web', 'dist'), command: 'pnpm run build' },
    launch: { type: 'service', port: 49323 }, catalog: { packagePolicy: 'required' },
  };
  try {
    const built = productState(product, area, '');
    assert.equal(built.ready, false);
    assert.equal(built.state, 'NEEDS BUILD');
    assert.equal(built.canPrepare, true);
    fs.mkdirSync(path.join(sourceRoot, 'node_modules'));
    const ready = productState(product, area, '');
    assert.equal(ready.ready, true);
    assert.equal(ready.state, 'READY');
    assert.equal(ready.port, 49323);
    assert.equal(ready.location, output);
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});

test('recognizes and finds a workspace from a nested launcher directory', () => {
  withWorkspace((workspace) => {
    const nested = path.join(workspace, 'Instrumenta', 'release', 'win-unpacked');
    fs.mkdirSync(nested, { recursive: true });
    assert.equal(isWorkspace(workspace), true);
    assert.equal(findWorkspace({ appPath: nested }), workspace);
  });
});

test('a workspace holds whichever products its owner chose, but at least one', () => {
  // Only Fabula checked out: a workspace, even though Imago and Ludere are absent.
  withWorkspace((workspace) => {
    assert.equal(isWorkspace(workspace), true);
    const state = discover(workspace);
    assert.equal(state.workspaceReady, true);
    assert.equal(state.imago.lifecycle, 'unavailable', 'inside a workspace, an absent checkout is simply missing');
  }, ['fabula']);
  // The launcher checkout alone is not a workspace: nothing beside it to find.
  withWorkspace((workspace) => {
    assert.equal(isWorkspace(workspace), false);
  }, []);
  // Nor is a folder of product checkouts with no launcher catalog.
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-no-catalog-'));
  try {
    for (const name of ['Fabula', 'Imago', 'Ludere']) fs.mkdirSync(path.join(area, name));
    assert.equal(isWorkspace(area), false);
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});

test('configured workspace takes priority over automatic discovery', () => {
  withWorkspace((workspace) => {
    const found = findWorkspace({
      configuredWorkspace: workspace,
      cwd: path.parse(workspace).root,
    });
    assert.equal(found, workspace);
  });
});

test('reports source projects as preparable and built tools as ready', () => {
  withWorkspace((workspace) => {
    fs.mkdirSync(path.join(workspace, 'Fabula', 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(workspace, 'Fabula', 'scripts', 'bootstrap-windows.ps1'), '# deploy');
    fs.writeFileSync(path.join(workspace, 'Imago', 'package.json'), '{}\n');
    fs.writeFileSync(path.join(workspace, 'Ludere', 'index.html'), '<!doctype html>');
    let state = discover(workspace);
    assert.equal(state.fabula.state, 'NEEDS BUILD');
    assert.equal(state.fabula.canPrepare, true);
    assert.equal(state.imago.state, 'NEEDS BUILD');
    assert.equal(state.imago.canPrepare, true);
    assert.equal(state.ludere.ready, true);

    const rawBuild = path.join(workspace, 'Fabula', 'node_modules', 'electron', 'dist');
    const fabulaBundle = path.join(workspace, 'Fabula', 'dist', 'windows');
    const imagoBuild = path.join(workspace, 'Imago', 'dist');
    fs.mkdirSync(rawBuild, { recursive: true });
    fs.mkdirSync(imagoBuild, { recursive: true });
    fs.writeFileSync(path.join(rawBuild, 'electron.exe'), 'test');
    fs.writeFileSync(path.join(imagoBuild, 'index.html'), '<!doctype html>');
    state = discover(workspace);
    assert.equal(state.fabula.ready, false, 'a runtime that was never deployed is not an application');
    assert.equal(state.imago.ready, true);
    fs.mkdirSync(fabulaBundle, { recursive: true });
    fs.writeFileSync(path.join(fabulaBundle, 'electron.exe'), 'test');
    fs.writeFileSync(path.join(fabulaBundle, 'fabula-bundle.json'), JSON.stringify({
      schemaVersion: 1, id: 'fabula', version: '0.1.0', executable: 'electron.exe', arguments: [path.join(workspace, 'Fabula')],
    }));
    state = discover(workspace);
    assert.equal(state.fabula.ready, true);
    assert.equal(state.fabula.location, path.join(fabulaBundle, 'electron.exe'));
    assert.equal(state.fabula.canPrepare, true);
    assert.equal(state.imago.canPrepare, true);
  });
});

test('a native bundle carries its launch arguments and is prepared by its own bootstrap script', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-native-args-'));
  const sourceRoot = path.join(temporary, 'Fabula');
  const bundle = path.join(sourceRoot, 'dist', 'windows');
  fs.mkdirSync(path.join(sourceRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(bundle, { recursive: true });
  const product = {
    id: 'fabula', displayName: 'Fabula', kind: 'native', adapter: 'native-bundle', sourceRoot, version: '0.1.0',
    build: { output: path.join('dist', 'windows') }, launch: { type: 'native' }, catalog: { packagePolicy: 'optional' },
  };
  try {
    // Source only: preparable through scripts/bootstrap-windows.ps1, and through nothing else.
    fs.writeFileSync(path.join(sourceRoot, 'CMakeLists.txt'), 'project(Something)\n');
    assert.equal(productState(product, temporary, '').canPrepare, false, 'a CMake tree is not a way to prepare a product');
    fs.writeFileSync(path.join(sourceRoot, 'scripts', 'bootstrap-windows.ps1'), '# deploy');
    const unprepared = productState(product, temporary, '');
    assert.equal(unprepared.ready, false);
    assert.equal(unprepared.canPrepare, true);
    assert.deepEqual(unprepared.launchArguments, []);

    // Deployed: the manifest names the runtime and the application it runs.
    fs.writeFileSync(path.join(bundle, 'electron.exe'), 'runtime');
    const write = (manifest) => fs.writeFileSync(path.join(bundle, 'fabula-bundle.json'), JSON.stringify(manifest));
    write({ schemaVersion: 1, id: 'fabula', version: '0.1.0', executable: 'electron.exe', arguments: ['\\\\wsl.localhost\\Ubuntu\\work\\Fabula'] });
    const ready = productState(product, temporary, '');
    assert.equal(ready.ready, true);
    assert.equal(ready.location, path.join(bundle, 'electron.exe'));
    assert.deepEqual(ready.launchArguments, ['\\\\wsl.localhost\\Ubuntu\\work\\Fabula']);

    // A manifest for another product, or malformed arguments, is not a bundle.
    write({ schemaVersion: 1, id: 'imago', version: '0.1.0', executable: 'electron.exe' });
    assert.equal(productState(product, temporary, '').ready, false);
    write({ schemaVersion: 1, id: 'fabula', version: '0.1.0', executable: 'electron.exe', arguments: 'app' });
    assert.equal(productState(product, temporary, '').ready, false);
    write({ schemaVersion: 1, id: 'fabula', version: '0.1.0', executable: 'electron.exe', arguments: ['app', 7] });
    assert.equal(productState(product, temporary, '').ready, false);
    write({ schemaVersion: 1, id: 'fabula', version: '0.1.0', executable: 'electron.exe', arguments: [''] });
    assert.equal(productState(product, temporary, '').ready, false);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('rejects malformed native bundle manifests and escaped executable paths', () => {
  withWorkspace((workspace) => {
    fs.mkdirSync(path.join(workspace, 'Fabula', 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(workspace, 'Fabula', 'scripts', 'bootstrap-windows.ps1'), '# deploy');
    const bundle = path.join(workspace, 'Fabula', 'dist', 'windows');
    fs.mkdirSync(bundle, { recursive: true });
    fs.writeFileSync(path.join(workspace, 'Fabula', 'dist', 'electron.exe'), 'test');
    fs.writeFileSync(path.join(bundle, 'fabula-bundle.json'), JSON.stringify({
      schemaVersion: 1, id: 'fabula', version: '0.1.0', executable: '..\\electron.exe',
    }));
    assert.equal(discover(workspace).fabula.ready, false);
  });
});

test('finds packaged web applications without requiring a source workspace', () => {
  withLauncherCatalogOnly(({ temporary, catalogBase }) => {
    const resources = path.join(temporary, 'resources');
    for (const id of ['imago', 'ludere']) {
      const root = path.join(resources, 'apps', id);
      fs.mkdirSync(root, { recursive: true });
      fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html>');
      writeJson(path.join(root, 'instrumenta', 'product.json'), manifests[id]);
    }
    const state = discover('', resources, catalogBase);
    assert.equal(state.workspaceReady, false);
    assert.equal(state.imago.ready, true);
    assert.equal(state.imago.location, path.join(resources, 'apps', 'imago'));
    assert.equal(state.ludere.ready, true);
    assert.equal(state.ludere.location, path.join(resources, 'apps', 'ludere'));
    // Fabula runs from a source checkout; without a workspace it is a developer's product.
    assert.equal(state.fabula.state, 'CHOOSE WORKSPACE');
    assert.equal(state.fabula.lifecycle, 'developer-only');
    assert.equal(state.discere.lifecycle, 'developer-only');
  });
});

test('hydrates packaged products from the launcher catalog when source checkouts are absent', () => {
  withLauncherCatalogOnly(({ temporary, catalogBase }) => {
    const resources = path.join(temporary, 'resources');
    const imago = path.join(resources, 'apps', 'imago');
    fs.mkdirSync(imago, { recursive: true });
    fs.writeFileSync(path.join(imago, 'index.html'), '<!doctype html>');
    writeJson(path.join(imago, 'instrumenta', 'product.json'), manifests.imago);
    const state = discover('', resources, catalogBase);
    assert.equal(state.imago.ready, true);
    assert.equal(state.imago.packaged, true);
    assert.equal(state.imago.location, imago);
    assert.deepEqual(state.registry.missing, ['fabula', 'ludere', 'discere', 'learnchess', 'luna', 'forge3d']);
  });
});

test('Fabula heads the product list, in the order the catalog gives', () => {
  const catalog = JSON.parse(fs.readFileSync(launcherCatalog, 'utf8'));
  assert.equal(catalog.products[0].id, 'fabula');
  assert.equal(catalog.products.some((entry) => entry.id === 'motus'), false, 'Motus is discontinued');
  withLauncherCatalogOnly(({ temporary, catalogBase }) => {
    // Imago is hydrated from the installer and so read before anything else; the list still
    // follows the catalog rather than the order products happened to be found in.
    const imago = path.join(temporary, 'resources', 'apps', 'imago');
    fs.mkdirSync(imago, { recursive: true });
    fs.writeFileSync(path.join(imago, 'index.html'), '<!doctype html>');
    writeJson(path.join(imago, 'instrumenta', 'product.json'), manifests.imago);
    const state = discover('', path.join(temporary, 'resources'), catalogBase);
    assert.deepEqual(state.products.map(({ id }) => id), catalog.products.map(({ id }) => id));
  });
});

// The review's reproduction: with no workspace, installing and update polling used to build their
// own registry, look for a catalog under a workspace that did not exist, and fall back to a legacy
// list without Forge3D or Luna in it.
test('without a workspace every release-backed catalog product still has a release to install', () => {
  const catalog = JSON.parse(fs.readFileSync(launcherCatalog, 'utf8'));
  const releaseBacked = catalog.products.filter((entry) => ['managed-bundle', 'managed-web', 'installed-desktop'].includes(entry.adapter));
  assert.ok(releaseBacked.some(({ id }) => id === 'forge3d') && releaseBacked.some(({ id }) => id === 'luna'));
  withLauncherCatalogOnly(({ catalogBase }) => {
    const registry = loadRegistry({ workspace: '', resourcesPath: '', catalogBase, installRoot: '' });
    assert.ok(registry.catalogPath, 'the launcher catalog was read, not a fallback list');
    const definitions = productDefinitions(registry);
    for (const entry of releaseBacked) {
      const definition = definitions.find(({ id }) => id === entry.id);
      assert.ok(definition, `${entry.id} has no definition`);
      assert.deepEqual(definition.release.repository, entry.repository);
      assert.equal(definition.release.manifestAsset, entry.releaseManifestAsset || 'instrumenta-release.json');
      assert.equal(releaseCapable(definition), true, `${entry.id} would never be polled`);
    }
  });
});

test('what installing can act on is exactly what the tiles offer', () => {
  withLauncherCatalogOnly(({ temporary, catalogBase }) => {
    const installRoot = path.join(temporary, 'products');
    const state = discover('', '', catalogBase, installRoot);
    const definitions = productDefinitions(loadRegistry({ workspace: '', resourcesPath: '', catalogBase, installRoot }));
    const ids = definitions.map(({ id }) => id);
    // Every tile with an Install button resolves to a definition carrying a release...
    for (const product of state.products.filter(({ canInstall }) => canInstall)) {
      assert.ok(ids.includes(product.id), `${product.id} offers Install but has no definition`);
      assert.ok(definitions.find(({ id }) => id === product.id).release?.repository);
    }
    // ...every definition is a tile, and both lists come out in the same order.
    assert.deepEqual(ids, state.products.map(({ id }) => id).filter((id) => ids.includes(id)));
    assert.deepEqual(ids, ['luna', 'forge3d']);
  });
});

test('a release definition comes only from a release-backed catalog entry', () => {
  const entry = {
    id: 'forge3d', name: 'Forge3D', version: '0.2.2', adapter: 'managed-bundle', repository: repository('Forge3D'),
    releaseManifestAsset: 'instrumenta-release.json', launchCandidates: ['Forge3D.exe'], packagePolicy: 'optional',
  };
  const definition = releaseDefinition(entry);
  assert.equal(definition.kind, 'native');
  assert.deepEqual(definition.launch.candidates, ['Forge3D.exe']);
  assert.equal(releaseDefinition({ ...entry, adapter: 'managed-web' }).kind, 'web');
  assert.equal(releaseDefinition({ ...entry, adapter: 'web-service' }), null, 'a source-run product has nothing to install');
  assert.equal(releaseDefinition({ ...entry, repository: undefined }), null);
});
