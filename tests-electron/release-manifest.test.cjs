const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createManifest, verifyManifest } = require('../scripts/release-manifest.cjs');

test('release manifest verifies setup and portable sizes and hashes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-release-'));
  try {
    fs.writeFileSync(path.join(directory, 'Instrumenta-Setup-0.5.0.exe'), 'setup');
    fs.writeFileSync(path.join(directory, 'Instrumenta-Portable-0.5.0.exe'), 'portable');
    const manifest = createManifest(directory, '0.5.0');
    assert.equal(manifest.artifacts.length, 2);
    assert.equal(verifyManifest(directory).version, '0.5.0');
    fs.appendFileSync(path.join(directory, 'Instrumenta-Portable-0.5.0.exe'), 'changed');
    assert.throws(() => verifyManifest(directory), /does not match/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('a legacy release without a manifest is reported as unverifiable', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-legacy-release-'));
  try {
    fs.writeFileSync(path.join(directory, 'Instrumenta-Portable-0.4.0.exe'), 'legacy');
    assert.throws(() => verifyManifest(directory), /ENOENT/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
