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
  pruneManagedVersions,
  readPointer,
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

function payloadManifest(first, second) {
  const payload = Buffer.concat([first, second]);
  return {
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
}

test('a retried install reuses a payload already assembled and verified', () => {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-payload-retry-'));
  try {
    const first = Buffer.from('first');
    const second = Buffer.from('second');
    fs.writeFileSync(path.join(area, 'payload.part001'), first);
    fs.writeFileSync(path.join(area, 'payload.part002'), second);
    const manifest = payloadManifest(first, second);
    const target = path.join(area, 'payload.7z');
    assemblePayload(manifest, area, target);
    const assembledAt = fs.statSync(target).mtimeMs;

    // The installer failed and the person pressed Install again: no "refusing to replace".
    fs.rmSync(path.join(area, 'payload.part001'));
    assert.equal(assemblePayload(manifest, area, target), target, 'reused without needing the chunks again');
    assert.equal(fs.statSync(target).mtimeMs, assembledAt);

    // A payload that no longer verifies is rebuilt from its chunks, and a stale partial is cleared.
    fs.writeFileSync(path.join(area, 'payload.part001'), first);
    fs.writeFileSync(target, 'corrupt');
    fs.writeFileSync(`${target}.partial`, 'left by an interrupted assembly');
    assemblePayload(manifest, area, target);
    assert.deepEqual(fs.readFileSync(target), Buffer.concat([first, second]));
    assert.equal(fs.existsSync(`${target}.partial`), false);
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});

function managedArea(label) {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), `instrumenta-${label}-`));
  const installRoot = path.join(area, 'products');
  const install = (version) => {
    const source = path.join(area, `source-${version}-${Math.random().toString(16).slice(2)}`);
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'Forge3D.exe'), version);
    return installManagedDirectory({ sourceRoot: source, installRoot, manifest: releaseBase({ version }) });
  };
  return { area, installRoot, install, dispose: () => fs.rmSync(area, { recursive: true, force: true }) };
}

test('installing a version already on disk points at it instead of failing', () => {
  const managed = managedArea('managed-repoint');
  try {
    managed.install('0.2.0');
    confirmManagedVersion(managed.installRoot, 'forge3d');
    managed.install('0.2.1');
    confirmManagedVersion(managed.installRoot, 'forge3d');
    // The person goes back to 0.2.0, then asks for the update again.
    rollbackManagedVersion(managed.installRoot, 'forge3d', { requirePending: false });
    assert.equal(resolveManagedInstall(managed.installRoot, 'forge3d').version, '0.2.0');
    const again = managed.install('0.2.1');
    assert.equal(again.reused, true, 'nothing was copied a second time');
    assert.deepEqual(readPointer(path.join(managed.installRoot, 'forge3d')), { current: '0.2.1', previous: '0.2.0', pending: true });

    // Installing the version that is already current changes nothing and says so.
    confirmManagedVersion(managed.installRoot, 'forge3d');
    const current = managed.install('0.2.1');
    assert.equal(current.alreadyCurrent, true);
    assert.deepEqual(readPointer(path.join(managed.installRoot, 'forge3d')), { current: '0.2.1', previous: '0.2.0', pending: false });
  } finally {
    managed.dispose();
  }
});

test('a broken folder with the version name is replaced, not pointed at', () => {
  const managed = managedArea('managed-broken');
  try {
    const broken = path.join(managed.installRoot, 'forge3d', 'versions', '0.2.0');
    fs.mkdirSync(broken, { recursive: true });
    fs.writeFileSync(path.join(broken, 'half-copied.dll'), 'x');
    const installed = managed.install('0.2.0');
    assert.equal(installed.reused, false);
    assert.equal(fs.readFileSync(path.join(broken, 'Forge3D.exe'), 'utf8'), '0.2.0');
    assert.equal(fs.existsSync(path.join(broken, 'half-copied.dll')), false);
  } finally {
    managed.dispose();
  }
});

test('pruning keeps the current and previous versions and nothing else', () => {
  const managed = managedArea('managed-prune');
  try {
    for (const version of ['0.1.0', '0.2.0', '0.2.1', '0.3.0']) {
      managed.install(version);
      confirmManagedVersion(managed.installRoot, 'forge3d');
    }
    const versions = path.join(managed.installRoot, 'forge3d', 'versions');
    // Leftovers of interrupted work: another run's staging folder and a half-deleted retiree.
    fs.mkdirSync(path.join(versions, '0.4.0.staging-99999'));
    fs.mkdirSync(path.join(versions, '0.0.9.retired-1-2'));
    const result = pruneManagedVersions(managed.installRoot, 'forge3d');
    assert.deepEqual(result.removed.sort(), ['0.0.9.retired-1-2', '0.1.0', '0.2.0', '0.4.0.staging-99999']);
    assert.deepEqual(fs.readdirSync(versions).sort(), ['0.2.1', '0.3.0']);
    assert.equal(resolveManagedInstall(managed.installRoot, 'forge3d').version, '0.3.0');
    // The kept previous version is still a working rollback target.
    rollbackManagedVersion(managed.installRoot, 'forge3d', { requirePending: false });
    assert.equal(resolveManagedInstall(managed.installRoot, 'forge3d').version, '0.2.1');
  } finally {
    managed.dispose();
  }
});

test('a version still in use is skipped whole, never half-deleted', () => {
  const managed = managedArea('managed-busy');
  try {
    for (const version of ['0.1.0', '0.2.0', '0.3.0']) managed.install(version);
    const busyFolder = path.join(managed.installRoot, 'forge3d', 'versions', '0.1.0');
    const removed = [];
    const result = pruneManagedVersions(managed.installRoot, 'forge3d', {
      rename: (from, to) => {
        // Windows will not rename a folder while an executable inside it is running.
        if (from === busyFolder) throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
        fs.renameSync(from, to);
      },
      remove: (target) => { removed.push(target); fs.rmSync(target, { recursive: true, force: true }); },
    });
    assert.deepEqual(result.busy, ['0.1.0']);
    assert.equal(fs.readFileSync(path.join(busyFolder, 'Forge3D.exe'), 'utf8'), '0.1.0', 'untouched');
    assert.ok(removed.every((target) => !target.startsWith(busyFolder + path.sep) && target !== busyFolder));
  } finally {
    managed.dispose();
  }
});

test('Roll back also undoes a version that launched, but never to one that is gone', () => {
  const managed = managedArea('managed-manual-rollback');
  try {
    managed.install('0.2.0');
    confirmManagedVersion(managed.installRoot, 'forge3d');
    managed.install('0.2.1');
    confirmManagedVersion(managed.installRoot, 'forge3d');
    // The automatic path is only for a version that has not launched yet.
    assert.throws(() => rollbackManagedVersion(managed.installRoot, 'forge3d'), /No pending managed version/);
    rollbackManagedVersion(managed.installRoot, 'forge3d', { requirePending: false });
    assert.deepEqual(readPointer(path.join(managed.installRoot, 'forge3d')), { current: '0.2.0', previous: '0.2.1', pending: false });

    fs.rmSync(path.join(managed.installRoot, 'forge3d', 'versions', '0.2.1'), { recursive: true });
    assert.throws(() => rollbackManagedVersion(managed.installRoot, 'forge3d', { requirePending: false }), /no longer installed/);
    assert.equal(resolveManagedInstall(managed.installRoot, 'forge3d').version, '0.2.0', 'the pointer did not move');
  } finally {
    managed.dispose();
  }
});
