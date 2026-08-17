const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function glyphPath(svg) {
  const match = svg.match(/<path fill="#E8E3D8" d="([^"]+)"/);
  assert.ok(match, 'expected one canonical limestone glyph path');
  return match[1];
}

test('the toolbar and packaged application use the same Instrumenta glyph', () => {
  const mark = fs.readFileSync(path.join(root, 'brand', 'instrumenta-mark.svg'), 'utf8');
  const packageIcon = fs.readFileSync(path.join(root, 'packaging', 'icon.svg'), 'utf8');
  assert.equal(glyphPath(packageIcon), glyphPath(mark));
  assert.match(mark, /viewBox="0 0 64 64"/);
  assert.doesNotMatch(mark, /<circle|<line|stroke=/);
});

test('canonical product colours preserve distinct editor semantics', () => {
  const tokens = JSON.parse(fs.readFileSync(path.join(root, 'brand', 'tokens.json'), 'utf8'));
  assert.deepEqual(
    [tokens.imago.accent, tokens.imago.secondary],
    ['#729488', '#B89C67'],
  );
  assert.deepEqual(
    [tokens.motus.accent, tokens.motus.accentMuted, tokens.motus.secondary],
    ['#E27A67', '#BD6B55', '#62D3E8'],
  );
});
