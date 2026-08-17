'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createDiagnostics, diagnosticValue } = require('../electron/diagnostics.cjs');

test('diagnostics serialize errors into a bounded local JSON-lines log', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-diagnostics-'));
  try {
    const diagnostics = createDiagnostics(directory, {
      now: () => new Date('2026-08-13T00:00:00.000Z'),
    });
    diagnostics.write('test-failure', { error: new Error('intentional') });
    const entry = JSON.parse(fs.readFileSync(diagnostics.file, 'utf8'));
    assert.equal(entry.at, '2026-08-13T00:00:00.000Z');
    assert.equal(entry.event, 'test-failure');
    assert.equal(entry.details.error.message, 'intentional');
    assert.match(entry.details.error.stack, /intentional/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('diagnostics rotate instead of growing without bound', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-diagnostics-'));
  try {
    const diagnostics = createDiagnostics(directory, { maxBytes: 180 });
    diagnostics.write('first', { text: 'a'.repeat(120) });
    diagnostics.write('second', { text: 'b'.repeat(120) });
    assert.equal(fs.existsSync(diagnostics.previousFile), true);
    assert.match(fs.readFileSync(diagnostics.file, 'utf8'), /"event":"second"/);
    assert.match(fs.readFileSync(diagnostics.previousFile, 'utf8'), /"event":"first"/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('diagnostic values cap recursive and oversized input', () => {
  const value = diagnosticValue({ text: 'x'.repeat(20_000), nested: { a: { b: { c: { d: 'hidden' } } } } });
  assert.ok(value.text.length < 20_000);
  assert.equal(value.nested.a.b.c, '[depth limit]');
});
