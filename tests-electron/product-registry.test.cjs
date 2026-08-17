const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { loadCatalog } = require('../scripts/product-registry.cjs');

test('loads the three independent product manifests and preserves stable IDs', () => {
  const registry = loadCatalog();
  assert.deepEqual(registry.products.map((product) => product.id), ['motus', 'imago', 'ludere']);
  assert.deepEqual(registry.products.map((product) => product.adapter), ['native-bundle', 'web-vite', 'web-static']);
  assert.equal(registry.missing.length, 0);
  assert.equal(registry.products.find((product) => product.id === 'imago').launch.port, 49321);
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
