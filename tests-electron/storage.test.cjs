'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { removeRetiredData, retiredData, storageLayout } = require('../electron/storage.cjs');

test('large launcher data lives in local application data, never in the roaming profile', () => {
  const layout = storageLayout({ localAppData: 'C:\\Users\\G\\AppData\\Local', userData: 'C:\\Users\\G\\AppData\\Roaming\\instrumenta-launcher' });
  const local = path.join('C:\\Users\\G\\AppData\\Local', 'Instrumenta');
  assert.equal(layout.installRoot, path.join(local, 'products'));
  assert.equal(layout.downloadsRoot, path.join(local, 'downloads'));
  assert.equal(layout.updateCacheRoot, path.join(local, 'update-cache'));
  // Off Windows there is no LOCALAPPDATA, so everything nests under userData instead.
  assert.equal(storageLayout({ userData: '/home/g/.config/instrumenta-launcher' }).downloadsRoot,
    path.join('/home/g/.config/instrumenta-launcher', 'Instrumenta', 'downloads'));
});

test('retired launcher data is removed once and anything current is left alone', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-retired-'));
  try {
    const oldDownload = path.join(userData, 'downloads', 'luna', '0.3.0', 'payload.part001');
    const motusMirror = path.join(userData, 'apps', 'Motus', 'motus.exe');
    const fabulaMirror = path.join(userData, 'apps', 'Fabula', 'electron.exe');
    const settings = path.join(userData, 'settings.json');
    for (const file of [oldDownload, motusMirror, fabulaMirror, settings]) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'x');
    }
    const first = await removeRetiredData(userData);
    assert.deepEqual(first.removed.map(({ path: removed }) => path.relative(userData, removed)).sort(), [path.join('apps', 'Motus'), 'downloads']);
    assert.deepEqual(first.failed, []);
    assert.equal(fs.existsSync(path.join(userData, 'downloads')), false);
    assert.equal(fs.existsSync(path.join(userData, 'apps', 'Motus')), false);
    // The Fabula mirror is live launcher data, and settings are the owner's.
    assert.equal(fs.existsSync(fabulaMirror), true);
    assert.equal(fs.existsSync(settings), true);

    const second = await removeRetiredData(userData);
    assert.deepEqual(second.removed, [], 'nothing is left to do on the next start');
  } finally {
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('a retired folder that cannot be removed is reported, not thrown', async () => {
  const userData = path.join(os.tmpdir(), 'instrumenta-retired-busy');
  const busy = Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
  const result = await removeRetiredData(userData, {
    exists: () => true,
    remove: async (target) => { if (target.endsWith('downloads')) throw busy; },
  });
  assert.deepEqual(result.failed.map(({ label }) => label), ['release downloads kept in roaming data']);
  assert.equal(result.removed.length, retiredData(userData).length - 1);
});

// Inside Electron, `fs` treats any `*.asar` path as an archive, and Forge3D's bundle and Fabula's
// runtime both carry one: a recursive delete of such a tree failed with EBUSY on the real machine.
// Node has no asar support, so this guards the wiring rather than the behaviour.
test('every module that copies or deletes product trees uses the unpatched file system', () => {
  const electron = path.join(__dirname, '..', 'electron');
  for (const name of ['release-lifecycle.cjs', 'release-installer.cjs', 'storage.cjs', 'local-bundle.cjs']) {
    const source = fs.readFileSync(path.join(electron, name), 'utf8');
    assert.match(source, /const fs = require\('\.\/plain-fs\.cjs'\);/, name);
    assert.doesNotMatch(source, /require\('(?:node:)?fs'\)/, name);
    assert.doesNotMatch(source, /process\.noAsar\s*=/, name);
  }
  // Under plain Node there is no original-fs, so it is Node's own fs.
  assert.equal(require('../electron/plain-fs.cjs'), require('node:fs'));
});
