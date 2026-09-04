'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { ensureLocalBundle, fingerprint, isRemotePath, localBundleRoot } = require('../electron/local-bundle.cjs');

function makeBundle(root, { version = '0.1.0', payload = 'binary' } = {}) {
  fs.mkdirSync(path.join(root, 'share', 'qt6', 'plugins'), { recursive: true });
  fs.writeFileSync(path.join(root, 'motus.exe'), payload);
  fs.writeFileSync(path.join(root, 'Qt6Core.dll'), 'library');
  fs.writeFileSync(path.join(root, 'share', 'qt6', 'plugins', 'qwindows.dll'), 'plugin');
  fs.writeFileSync(path.join(root, 'motus-bundle.json'), JSON.stringify({
    schemaVersion: 1, id: 'motus', version, executable: 'motus.exe',
  }));
  return root;
}

function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-stage-test-'));
  return { root, dispose: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('UNC paths are remote on Windows and ordinary paths are not', () => {
  assert.ok(isRemotePath('\\\\wsl.localhost\\Ubuntu\\workspace\\Motus\\dist\\windows', 'win32'));
  assert.ok(isRemotePath('\\\\server\\share\\Motus', 'win32'));
  assert.ok(!isRemotePath('C:\\Users\\George\\Motus\\dist\\windows', 'win32'));
  assert.ok(!isRemotePath('', 'win32'));
  // The same text on Linux is an ordinary path, not a share.
  assert.ok(!isRemotePath('//server/share/Motus', 'linux'));
});

test('a local bundle is launched where it is, with nothing copied', async () => {
  const area = scratch();
  try {
    const source = makeBundle(path.join(area.root, 'source'));
    const result = await ensureLocalBundle({
      source, cacheRoot: path.join(area.root, 'cache'), remote: false,
    });
    assert.equal(result.root, source);
    assert.equal(result.staged, false);
    assert.equal(result.copied, false);
    assert.ok(!fs.existsSync(path.join(area.root, 'cache')));
  } finally {
    area.dispose();
  }
});

test('a bundle on a share is mirrored once and then reused', async () => {
  const area = scratch();
  try {
    const source = makeBundle(path.join(area.root, 'source'));
    const cacheRoot = path.join(area.root, 'cache');
    const progress = [];
    const first = await ensureLocalBundle({
      source, cacheRoot, remote: true, onProgress: (message) => progress.push(message),
    });

    assert.equal(first.root, localBundleRoot(cacheRoot));
    assert.equal(first.copied, true);
    assert.equal(progress.length, 1);
    // The whole tree comes across, not only the executable.
    assert.ok(fs.existsSync(path.join(first.root, 'motus.exe')));
    assert.ok(fs.existsSync(path.join(first.root, 'Qt6Core.dll')));
    assert.ok(fs.existsSync(path.join(first.root, 'share', 'qt6', 'plugins', 'qwindows.dll')));

    const second = await ensureLocalBundle({ source, cacheRoot, remote: true });
    assert.equal(second.root, first.root);
    assert.equal(second.copied, false);
    assert.equal(second.staged, true);
  } finally {
    area.dispose();
  }
});

test('a rebuilt bundle replaces the mirror instead of being reused', async () => {
  const area = scratch();
  try {
    const source = makeBundle(path.join(area.root, 'source'));
    const cacheRoot = path.join(area.root, 'cache');
    await ensureLocalBundle({ source, cacheRoot, remote: true });

    makeBundle(source, { version: '0.2.0', payload: 'rebuilt binary that differs in size' });
    const refreshed = await ensureLocalBundle({ source, cacheRoot, remote: true });
    assert.equal(refreshed.copied, true);
    assert.equal(
      fs.readFileSync(path.join(refreshed.root, 'motus.exe'), 'utf8'),
      'rebuilt binary that differs in size',
    );
  } finally {
    area.dispose();
  }
});

test('an interrupted copy does not leave a mirror that looks complete', async () => {
  const area = scratch();
  try {
    const source = makeBundle(path.join(area.root, 'source'));
    const cacheRoot = path.join(area.root, 'cache');
    const destination = localBundleRoot(cacheRoot);
    // A half-written mirror from a previous run: files present, no stamp.
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(destination, 'motus.exe'), 'truncated');

    const result = await ensureLocalBundle({ source, cacheRoot, remote: true });
    assert.equal(result.copied, true);
    assert.equal(fs.readFileSync(path.join(result.root, 'motus.exe'), 'utf8'), 'binary');
    assert.ok(fs.existsSync(path.join(result.root, 'Qt6Core.dll')));
  } finally {
    area.dispose();
  }
});

test('a bundle is mirrored under its own manifest name, and re-pointing its arguments refreshes the mirror', async () => {
  const area = scratch();
  try {
    const source = path.join(area.root, 'source');
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, 'electron.exe'), 'runtime');
    const write = (args) => fs.writeFileSync(path.join(source, 'fabula-bundle.json'), JSON.stringify({
      schemaVersion: 1, id: 'fabula', version: '0.1.0', executable: 'electron.exe', arguments: args,
    }));
    write(['\\\\wsl.localhost\\Ubuntu\\work\\Fabula']);
    const cacheRoot = path.join(area.root, 'cache');
    // The Motus manifest is not there; naming the right one is what finds the bundle.
    assert.equal(fingerprint(source), null);
    assert.equal(fingerprint(source, 'fabula-bundle.json').executable, 'electron.exe');

    const first = await ensureLocalBundle({ source, cacheRoot, remote: true, id: 'Fabula', manifest: 'fabula-bundle.json' });
    assert.equal(first.root, localBundleRoot(cacheRoot, 'Fabula'));
    assert.equal(first.copied, true);
    const again = await ensureLocalBundle({ source, cacheRoot, remote: true, id: 'Fabula', manifest: 'fabula-bundle.json' });
    assert.equal(again.copied, false);

    write(['C:\\work\\Fabula']);
    const repointed = await ensureLocalBundle({ source, cacheRoot, remote: true, id: 'Fabula', manifest: 'fabula-bundle.json' });
    assert.equal(repointed.copied, true);
  } finally {
    area.dispose();
  }
});

test('a bundle without a manifest or executable is refused', async () => {
  const area = scratch();
  try {
    const source = path.join(area.root, 'source');
    fs.mkdirSync(source, { recursive: true });
    assert.equal(fingerprint(source), null);
    await assert.rejects(
      ensureLocalBundle({ source, cacheRoot: path.join(area.root, 'cache'), remote: true }),
      /launch manifest or executable/,
    );
  } finally {
    area.dispose();
  }
});
