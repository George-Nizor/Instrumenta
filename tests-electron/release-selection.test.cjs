const assert = require('node:assert/strict');
const test = require('node:test');
const { newestCandidate } = require('../scripts/release-selection.cjs');

test('newer source version wins over an installed or portable executable', () => {
  assert.equal(newestCandidate([
    { kind: 'installed', version: '0.4.0', builtAt: 300 },
    { kind: 'portable', version: '0.4.0', builtAt: 400 },
    { kind: 'source', version: '0.5.0', builtAt: 100 },
  ]).kind, 'source');
});

test('newer build wins when release versions are equal', () => {
  assert.equal(newestCandidate([
    { kind: 'installed', version: '0.5.0', builtAt: 300 },
    { kind: 'portable', version: '0.5.0', builtAt: 400 },
    { kind: 'source', version: '0.5.0', builtAt: 500 },
  ]).kind, 'source');
});

test('semantic versions are compared numerically', () => {
  assert.equal(newestCandidate([
    { kind: 'installed', version: '0.9.0', builtAt: 900 },
    { kind: 'portable', version: '0.10.0', builtAt: 100 },
  ]).kind, 'portable');
});
