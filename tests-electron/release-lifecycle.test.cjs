'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  assemblePayload,
  confirmManagedVersion,
  installManagedDirectory,
  resolveManagedInstall,
  rollbackManagedVersion,
  validateReleaseManifest,
} = require('../electron/release-lifecycle.cjs');

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');

function releaseBase(overrides = {}) {
  return {
    schemaVersion: 1,
    product: 'forge3d',
    version: '0.2.0',
    platform: 'windows-x64',
    minimumInstrumentaVersion: '0.8.0',
    installStrategy: 'managed-bundle',
    bundle: {
      asset: 'Forge3D-0.2.0-windows-x64.zip',
      size: 10,
      sha256: 'a'.repeat(64),
      entry: 'Forge3D.exe',
    },
    ...overrides,
  };
}

test('validates managed and multipart release contracts', () => {
  assert.equal(validateReleaseManifest(releaseBase(), 'forge3d').bundle.entry, 'Forge3D.exe');
  const first = Buffer.from('first');
  const second = Buffer.from('second');
  const payload = Buffer.concat([first, second]);
  const installed = validateReleaseManifest({
    ...releaseBase({
      product: 'luna',
      version: '0.3.0',
      installStrategy: 'installed-desktop',
      bundle: undefined,
    }),
    installer: { asset: 'Luna-Installer-0.3.0.exe', size: 9, sha256: 'b'.repeat(64) },
    payload: {
      assembledAsset: 'luna-0.3.0-x64.nsis.7z',
      size: payload.length,
      sha256: digest(payload),
      chunks: [
        { asset: 'payload.part001', size: first.length, sha256: digest(first) },
        { asset: 'payload.part002', size: second.length, sha256: digest(second) },
      ],
    },
  }, 'luna');
  assert.equal(installed.payload.chunks.length, 2);
  assert.throws(() => validateReleaseManifest({
    ...releaseBase(),
    bundle: { ...releaseBase().bundle, asset: '../escape.zip' },
  }), /safe file name/);
});

test('assembles chunks only after per-part and complete verification', () => {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-payload-'));
  try {
    const first = Buffer.from('first');
    const second = Buffer.from('second');
    const payload = Buffer.concat([first, second]);
    fs.writeFileSync(path.join(area, 'payload.part001'), first);
    fs.writeFileSync(path.join(area, 'payload.part002'), second);
    const manifest = {
      ...releaseBase({ product: 'luna', version: '0.3.0', installStrategy: 'installed-desktop', bundle: undefined }),
      installer: { asset: 'Luna.exe', size: 1, sha256: 'c'.repeat(64) },
      payload: {
        assembledAsset: 'payload.7z',
        size: payload.length,
        sha256: digest(payload),
        chunks: [
          { asset: 'payload.part001', size: first.length, sha256: digest(first) },
          { asset: 'payload.part002', size: second.length, sha256: digest(second) },
        ],
      },
    };
    const output = assemblePayload(manifest, area, path.join(area, 'payload.7z'));
    assert.deepEqual(fs.readFileSync(output), payload);
    fs.rmSync(output);
    fs.writeFileSync(path.join(area, 'payload.part002'), 'tampered');
    assert.throws(() => assemblePayload(manifest, area, path.join(area, 'payload.7z')), /wrong size|verification/);
    assert.equal(fs.existsSync(path.join(area, 'payload.7z.partial')), false);
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});

test('activates a version atomically and can confirm or roll back', () => {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-managed-'));
  try {
    const installRoot = path.join(area, 'products');
    const makeSource = (version) => {
      const source = path.join(area, `source-${version}`);
      fs.mkdirSync(source);
      fs.writeFileSync(path.join(source, 'Forge3D.exe'), version);
      return source;
    };
    const first = installManagedDirectory({ sourceRoot: makeSource('0.2.0'), installRoot, manifest: releaseBase() });
    assert.equal(first.pointer.pending, true);
    assert.equal(resolveManagedInstall(installRoot, 'forge3d').version, '0.2.0');
    confirmManagedVersion(installRoot, 'forge3d');
    installManagedDirectory({
      sourceRoot: makeSource('0.2.1'),
      installRoot,
      manifest: releaseBase({ version: '0.2.1' }),
    });
    assert.equal(resolveManagedInstall(installRoot, 'forge3d').version, '0.2.1');
    rollbackManagedVersion(installRoot, 'forge3d');
    assert.equal(resolveManagedInstall(installRoot, 'forge3d').version, '0.2.0');
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});
