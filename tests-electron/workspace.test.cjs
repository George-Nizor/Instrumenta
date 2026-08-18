const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { discover, findWorkspace, isWorkspace, productState } = require('../electron/workspace.cjs');

function withWorkspace(callback) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-workspace-'));
  const workspace = path.join(temporary, 'Instrumenta');
  fs.mkdirSync(path.join(workspace, 'Motus'), { recursive: true });
  fs.mkdirSync(path.join(workspace, 'Imago'), { recursive: true });
  fs.mkdirSync(path.join(workspace, 'Ludere'), { recursive: true });
  try {
    callback(workspace);
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
    fs.writeFileSync(path.join(workspace, 'Motus', 'CMakeLists.txt'), 'project(Motus)\n');
    fs.writeFileSync(path.join(workspace, 'Imago', 'package.json'), '{}\n');
    fs.writeFileSync(path.join(workspace, 'Ludere', 'index.html'), '<!doctype html>');
    let state = discover(workspace);
    assert.equal(state.motus.state, 'NEEDS BUILD');
    assert.equal(state.motus.canPrepare, true);
    assert.equal(state.imago.state, 'NEEDS BUILD');
    assert.equal(state.imago.canPrepare, true);
    assert.equal(state.ludere.ready, true);

    const motusBuild = path.join(workspace, 'Motus', 'build', 'windows-mingw-release');
    const motusBundle = path.join(workspace, 'Motus', 'dist', 'windows');
    const imagoBuild = path.join(workspace, 'Imago', 'dist');
    fs.mkdirSync(motusBuild, { recursive: true });
    fs.mkdirSync(imagoBuild, { recursive: true });
    fs.writeFileSync(path.join(motusBuild, 'motus.exe'), 'test');
    fs.writeFileSync(path.join(imagoBuild, 'index.html'), '<!doctype html>');
    state = discover(workspace);
    assert.equal(state.motus.ready, false, 'a raw build executable is not a deployable application');
    assert.equal(state.imago.ready, true);
    fs.mkdirSync(motusBundle, { recursive: true });
    fs.writeFileSync(path.join(motusBundle, 'motus.exe'), 'test');
    fs.writeFileSync(path.join(motusBundle, 'motus-bundle.json'), JSON.stringify({
      schemaVersion: 1, id: 'motus', version: '0.1.0', executable: 'motus.exe',
    }));
    state = discover(workspace);
    assert.equal(state.motus.ready, true);
    assert.equal(state.motus.location, path.join(motusBundle, 'motus.exe'));
    assert.equal(state.motus.canPrepare, true);
    assert.equal(state.imago.canPrepare, true);
  });
});

test('rejects malformed Motus bundle manifests and escaped executable paths', () => {
  withWorkspace((workspace) => {
    fs.writeFileSync(path.join(workspace, 'Motus', 'CMakeLists.txt'), 'project(Motus)\n');
    const bundle = path.join(workspace, 'Motus', 'dist', 'windows');
    fs.mkdirSync(bundle, { recursive: true });
    fs.writeFileSync(path.join(bundle, 'motus.exe'), 'test');
    fs.writeFileSync(path.join(bundle, 'motus-bundle.json'), JSON.stringify({
      schemaVersion: 1, id: 'motus', version: '0.1.0', executable: '..\\motus.exe',
    }));
    assert.equal(discover(workspace).motus.ready, false);
  });
});

test('finds packaged web applications without requiring a source workspace', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-resources-'));
  const imago = path.join(temporary, 'apps', 'Imago');
  const ludere = path.join(temporary, 'apps', 'Ludere');
  fs.mkdirSync(imago, { recursive: true });
  fs.mkdirSync(ludere, { recursive: true });
  fs.writeFileSync(path.join(imago, 'index.html'), '<!doctype html>');
  fs.writeFileSync(path.join(ludere, 'index.html'), '<!doctype html>');
  try {
    const state = discover('', temporary);
    assert.equal(state.workspaceReady, false);
    assert.equal(state.imago.ready, true);
    assert.equal(state.imago.location, imago);
    assert.equal(state.ludere.ready, true);
    assert.equal(state.ludere.location, ludere);
    assert.equal(state.motus.state, 'CHOOSE WORKSPACE');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('hydrates packaged products from the launcher catalog when source checkouts are absent', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-packaged-catalog-'));
  const catalogRoot = path.join(temporary, 'app');
  const resources = path.join(temporary, 'resources');
  const imago = path.join(resources, 'apps', 'imago');
  fs.mkdirSync(path.join(catalogRoot, 'products'), { recursive: true });
  fs.mkdirSync(path.join(imago, 'instrumenta'), { recursive: true });
  fs.writeFileSync(path.join(catalogRoot, 'products', 'catalog.json'), fs.readFileSync(path.join(__dirname, '..', 'products', 'catalog.json')));
  fs.writeFileSync(path.join(imago, 'index.html'), '<!doctype html>');
  fs.copyFileSync(path.join(__dirname, '..', '..', 'Imago', 'instrumenta', 'product.json'), path.join(imago, 'instrumenta', 'product.json'));
  try {
    const state = discover('', resources, catalogRoot);
    assert.equal(state.imago.ready, true);
    assert.equal(state.imago.packaged, true);
    assert.equal(state.imago.location, imago);
    assert.deepEqual(state.registry.missing, ['motus', 'ludere']);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
