'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { buildReleaseManifest, parseArguments } = require('../scripts/instrumenta-release.cjs');

const script = path.join(__dirname, '..', 'scripts', 'instrumenta-release.cjs');
const digest = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

function area() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-release-'));
  const file = (name, content) => {
    const target = path.join(root, name);
    fs.writeFileSync(target, content);
    return target;
  };
  return { root, file, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('a web release measures its bundle and names its entry', () => {
  const files = area();
  try {
    const zip = files.file('imago-0.2.0.zip', 'PK the bundle');
    const manifest = buildReleaseManifest({ product: 'imago', version: '0.2.0', strategy: 'managed-web', bundle: zip, minimum: '0.10.0' });
    assert.deepEqual(manifest.bundle, { asset: 'imago-0.2.0.zip', size: 13, sha256: digest('PK the bundle'), entry: 'index.html' });
    assert.equal(manifest.minimumInstrumentaVersion, '0.10.0');
    assert.equal(manifest.platform, 'windows-x64');
  } finally {
    files.done();
  }
});

test('the launcher release is its setup program', () => {
  const files = area();
  try {
    const setup = files.file('Instrumenta-Setup-0.10.0.exe', 'MZ setup');
    const manifest = buildReleaseManifest({ product: 'instrumenta', version: '0.10.0', strategy: 'launcher', installer: setup });
    assert.equal(manifest.installer.asset, 'Instrumenta-Setup-0.10.0.exe');
    // The minimum defaults to the launcher checkout the release is made alongside.
    assert.equal(manifest.minimumInstrumentaVersion, JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version);
  } finally {
    files.done();
  }
});

test('an installed-desktop release assembles its chunks in order', () => {
  const files = area();
  try {
    const setup = files.file('Luna-Setup.exe', 'MZ luna');
    const chunks = [files.file('payload.001', 'first-'), files.file('payload.002', 'second')];
    const manifest = buildReleaseManifest({ product: 'luna', version: '0.4.0', strategy: 'installed-desktop', installer: setup, payloadAsset: 'payload.bin', chunks });
    assert.equal(manifest.payload.size, 12);
    assert.equal(manifest.payload.sha256, digest('first-second'));
    assert.deepEqual(manifest.payload.chunks.map((chunk) => chunk.asset), ['payload.001', 'payload.002']);
  } finally {
    files.done();
  }
});

test('what the launcher would refuse fails here, before anything is published', () => {
  const files = area();
  try {
    const zip = files.file('x.zip', 'PK');
    assert.throws(() => buildReleaseManifest({ product: 'imago', version: 'one', strategy: 'managed-web', bundle: zip }), /version is invalid/);
    assert.throws(() => buildReleaseManifest({ product: 'imago', version: '0.2.0', strategy: 'managed-web' }), /needs --bundle/);
    assert.throws(() => buildReleaseManifest({ product: 'imago', version: '0.2.0', strategy: 'launcher', installer: zip }), /Only Instrumenta itself/);
    assert.throws(() => buildReleaseManifest({ product: 'imago', version: '0.2.0', strategy: 'managed-web', bundle: zip, entry: '../x.html' }), /entry/);
    assert.throws(() => parseArguments(['--product', 'imago']), /--version is required/);
    assert.throws(() => parseArguments(['--nonsense', 'x']), /Unknown or incomplete option/);
  } finally {
    files.done();
  }
});

test('the command line writes the manifest a release attaches', () => {
  const files = area();
  try {
    const zip = files.file('ludere-0.1.0.zip', 'PK ludere');
    const out = path.join(files.root, 'out', 'instrumenta-release.json');
    const result = spawnSync(process.execPath, [script, '--product', 'ludere', '--version', '0.1.0', '--strategy', 'managed-web', '--bundle', zip, '--minimum', '0.10.0', '--out', out], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const written = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(written.product, 'ludere');
    assert.equal(written.bundle.size, 9);
    const failed = spawnSync(process.execPath, [script, '--product', 'ludere', '--version', '0.1.0', '--strategy', 'managed-web', '--out', out], { encoding: 'utf8' });
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /needs --bundle/);
  } finally {
    files.done();
  }
});


test('desktop payload hashing preserves bytes across streaming block boundaries', () => {
  const files = area();
  try {
    const first = Buffer.alloc(8 * 1024 * 1024 + 73, 0x19);
    const second = Buffer.alloc(16387, 0xaf);
    const setup = files.file('Luna-Setup.exe', 'MZ luna');
    const chunks = [files.file('large.001', first), files.file('large.002', second)];
    const result = buildReleaseManifest({ product: 'luna', version: '0.4.0', strategy: 'installed-desktop', installer: setup, payloadAsset: 'large.7z', chunks });
    assert.equal(result.payload.size, first.length + second.length);
    assert.equal(result.payload.sha256, digest(Buffer.concat([first, second])));
    assert.deepEqual(result.payload.chunks.map(chunk => chunk.sha256), [digest(first), digest(second)]);
  } finally { files.done(); }
});
