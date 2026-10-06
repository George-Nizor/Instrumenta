const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const icons = require('../brand/icons/instrumenta-icons.js');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'products', 'catalog.json'), 'utf8'));
const tokens = JSON.parse(fs.readFileSync(path.join(root, 'brand', 'tokens.json'), 'utf8'));

test('every catalogue product and the launcher have an icon', () => {
  const drawn = new Set(icons.PRODUCTS.map((product) => product.id));
  assert.ok(drawn.has('instrumenta'));
  for (const product of catalog.products) assert.ok(drawn.has(product.id), `${product.id} has no glyph`);
});

test('icons can be inserted under a CSP that forbids inline styles', () => {
  for (const { id } of icons.PRODUCTS) {
    for (const size of [16, 24, 48]) {
      const svg = icons.render(id, { size });
      assert.doesNotMatch(svg, /\sstyle=|<style/, `${id} at ${size} carries inline style`);
      assert.match(svg, /^<svg [^>]*viewBox="0 0 48 48"/);
    }
  }
});

test('rendering is deterministic and small sizes drop detail', () => {
  assert.equal(icons.render('fabula', { size: 64 }), icons.render('fabula', { size: 64 }));
  const full = icons.render('ludere', { size: 64 });
  const small = icons.render('ludere', { size: 16 });
  assert.ok(small.length < full.length);
  assert.equal(icons.tierFor(16), 'small');
  assert.equal(icons.tierFor(24), 'medium');
  assert.equal(icons.tierFor(32), 'full');
});

test('tokens.json is the icon library\'s palette, not a second copy', () => {
  assert.equal(tokens.family.brass, icons.colours('instrumenta').accent);
  for (const product of catalog.products) {
    const colours = icons.colours(product.id);
    assert.equal(tokens[product.tile.theme].accent, colours.accent, `${product.id} accent drifted; rerun brand/scripts/build-brand.py`);
    assert.equal(tokens[product.tile.theme].secondary, colours.light);
  }
});

test('the generated icon files exist for every product', () => {
  for (const { id } of icons.PRODUCTS) {
    for (const file of [`svg/${id}.svg`, `svg/${id}-16.svg`, `svg/${id}-24.svg`, `svg/${id}-animated.svg`, `ico/${id}.ico`, `png/${id}-16.png`, `png/${id}-512.png`]) {
      assert.ok(fs.existsSync(path.join(root, 'brand', 'icons', file)), `missing brand/icons/${file}; run brand/scripts/build-brand.py`);
    }
  }
});

test('the vendored fonts are present with their licences, and the installer leaves the archive out', () => {
  const css = fs.readFileSync(path.join(root, 'brand', 'fonts', 'fonts.css'), 'utf8');
  for (const family of ['Fraunces', 'Commissioner', 'Spline Sans Mono']) assert.match(css, new RegExp(`font-family: '${family}'`));
  for (const file of css.match(/[\w-]+\.woff2/g)) assert.ok(fs.existsSync(path.join(root, 'brand', 'fonts', file)), file);
  assert.doesNotMatch(css, /https?:/);
  for (const licence of ['fraunces', 'commissioner', 'splinesansmono']) assert.ok(fs.existsSync(path.join(root, 'brand', 'fonts', `OFL-${licence}.txt`)));
  const files = require('../package.json').build.files;
  for (const excluded of ['!brand/archive/**', '!brand/concepts/**', '!brand/scripts/**']) assert.ok(files.includes(excluded), excluded);
});
