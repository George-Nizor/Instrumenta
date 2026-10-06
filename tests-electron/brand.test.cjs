const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function pngInfo(file) {
  const png = fs.readFileSync(file);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    colorType: png[25],
  };
}

test('the toolbar and packaged application use approved transparent Instrumenta artwork', () => {
  assert.deepEqual(pngInfo(path.join(root, 'brand', 'instrumenta-mark.png')), {
    width: 512,
    height: 512,
    colorType: 6,
  });
  assert.deepEqual(pngInfo(path.join(root, 'packaging', 'icon.png')), {
    width: 1024,
    height: 1024,
    colorType: 6,
  });
  const renderer = fs.readFileSync(path.join(root, 'electron', 'renderer', 'index.html'), 'utf8');
  assert.match(renderer, /instrumenta-mark\.png\?v=brand-2/);
  assert.match(renderer, /brand\/icons\/instrumenta-icons\.js/);
  assert.match(renderer, /brand\/fonts\/fonts\.css/);
  assert.doesNotMatch(renderer, /instrumenta-mark\.svg/);
});

// The catalog is the list the launcher shows, so it is the list whose art and colours are checked.
// A hard-coded list here once lagged the catalog by two products and verified neither of them.
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'products', 'catalog.json'), 'utf8'));
const tokens = JSON.parse(fs.readFileSync(path.join(root, 'brand', 'tokens.json'), 'utf8'));

test('every launcher product uses production RGBA artwork', () => {
  assert.ok(catalog.products.length >= 7);
  for (const product of catalog.products) {
    assert.match(product.tile.art, new RegExp(`^brand/artwork/${product.id}-app-art\\.png$`));
    assert.deepEqual(pngInfo(path.join(root, product.tile.art)), {
      width: 1024,
      height: 1024,
      colorType: 6,
    }, `${product.id} artwork`);
  }
});

test('canonical product colours remain distinct', () => {
  const accents = catalog.products.map((product) => tokens[product.tile.theme]?.accent);
  for (const [index, accent] of accents.entries()) {
    assert.match(String(accent), /^#[0-9A-F]{6}$/, `${catalog.products[index].id} has no accent token`);
  }
  assert.equal(new Set(accents).size, accents.length);
});

test('the launcher theme uses the token accent for every product', () => {
  const styles = fs.readFileSync(path.join(root, 'electron', 'renderer', 'styles.css'), 'utf8');
  for (const product of catalog.products) {
    const theme = product.tile.theme;
    const declared = styles.match(new RegExp(`--${theme}:\\s*(#[0-9a-fA-F]{6});`))?.[1] || '';
    assert.equal(declared.toUpperCase(), tokens[theme].accent, `--${theme} disagrees with brand/tokens.json`);
  }
});

test('a retired product leaves no token or artwork behind', () => {
  const themes = new Set(['family', ...catalog.products.map((product) => product.tile.theme)]);
  assert.deepEqual(Object.keys(tokens).filter((key) => !themes.has(key)), []);
  const artwork = fs.readdirSync(path.join(root, 'brand', 'artwork')).filter((name) => name.endsWith('-app-art.png'));
  const expected = new Set(catalog.products.map((product) => path.basename(product.tile.art)));
  assert.deepEqual(artwork.filter((name) => !expected.has(name)), []);
});
