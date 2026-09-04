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
  assert.match(renderer, /instrumenta-mark\.png\?v=gateway-1/);
  assert.doesNotMatch(renderer, /instrumenta-mark\.svg/);
});

test('every launcher product uses production RGBA artwork', () => {
  for (const product of ['motus', 'imago', 'ludere', 'discere', 'luna', 'fabula']) {
    assert.deepEqual(pngInfo(path.join(root, 'brand', 'artwork', `${product}-app-art.png`)), {
      width: 1024,
      height: 1024,
      colorType: 6,
    });
  }
});

test('canonical product colours remain distinct', () => {
  const tokens = JSON.parse(fs.readFileSync(path.join(root, 'brand', 'tokens.json'), 'utf8'));
  const accents = ['motus', 'imago', 'ludere', 'discere', 'luna', 'fabula'].map((id) => tokens[id].accent);
  assert.equal(new Set(accents).size, accents.length);
});