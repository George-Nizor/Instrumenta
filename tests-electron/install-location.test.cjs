'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const location = require('../electron/install-location.cjs');
const { storageReport } = require('../electron/storage-report.cjs');

const DEFAULT = 'C:\\Users\\G\\AppData\\Local\\Instrumenta\\products';
const win = { defaultRoot: DEFAULT, platform: 'win32' };

test('new installs go to the chosen folder, or the default when none is chosen', () => {
  assert.equal(location.currentLocation({}, DEFAULT, 'win32'), DEFAULT);
  assert.equal(location.currentLocation({ install: { location: 'D:\\Apps' } }, DEFAULT, 'win32'), 'D:\\Apps');
  // A malformed value is ignored rather than trusted.
  assert.equal(location.currentLocation({ install: { location: 'relative\\apps' } }, DEFAULT, 'win32'), DEFAULT);
});

test('a product is found where it was installed, wherever new installs now go', () => {
  const installedIn = new Map([['forge3d', 'D:\\Apps'], ['fabula', DEFAULT]]);
  const resolve = (root, id) => installedIn.get(id) === root;
  const settings = { install: { location: 'E:\\New', previousLocations: ['D:\\Apps'] } };
  // Recorded, found by scanning earlier locations, or not installed at all.
  assert.equal(location.productRoot({ ...settings, products: { forge3d: { installRoot: 'D:\\Apps' } } }, 'forge3d', { ...win, resolve }), 'D:\\Apps');
  assert.equal(location.productRoot(settings, 'forge3d', { ...win, resolve }), 'D:\\Apps', 'a lost record is recovered from the previous locations');
  assert.equal(location.productRoot(settings, 'fabula', { ...win, resolve }), DEFAULT);
  assert.equal(location.productRoot(settings, 'luna', { ...win, resolve }), 'E:\\New', 'a product not installed goes to the current location');
});

test('an install is recorded beside the product preferences, and forgotten on uninstall', () => {
  const start = { products: { forge3d: { autoUpdate: false } } };
  const recorded = location.recordInstall(start, 'forge3d', 'D:\\Apps');
  assert.deepEqual(recorded.products.forge3d, { autoUpdate: false, installRoot: 'D:\\Apps' });
  assert.deepEqual(location.forgetInstall(recorded, 'forge3d').products.forge3d, { autoUpdate: false });
  assert.deepEqual(location.forgetInstall(location.recordInstall({}, 'luna', 'D:\\Apps'), 'luna').products, {});
});

test('changing the location pins what is installed and remembers where it was', () => {
  const changed = location.changeLocation({}, 'D:\\Apps', { installed: { forge3d: DEFAULT }, ...win });
  assert.equal(changed.install.location, 'D:\\Apps');
  assert.deepEqual(changed.install.previousLocations, [DEFAULT]);
  assert.equal(changed.products.forge3d.installRoot, DEFAULT);
  const back = location.changeLocation(changed, '', { installed: {}, ...win });
  assert.equal(back.install.location, undefined, 'the default is stored as no choice');
  assert.deepEqual(back.install.previousLocations, [DEFAULT, 'D:\\Apps']);
});

test('a location may not be a drive, the launcher\'s own folders, or the workspace', () => {
  const forbidden = ['C:\\Users\\G\\AppData\\Local\\Instrumenta', 'C:\\dev\\Instrumenta'];
  assert.equal(location.validateLocation('D:\\Apps', { forbidden, platform: 'win32' }), 'D:\\Apps');
  assert.throws(() => location.validateLocation('D:\\', { forbidden, platform: 'win32' }), /top of a drive/);
  assert.throws(() => location.validateLocation('apps', { forbidden, platform: 'win32' }), /full path/);
  assert.throws(() => location.validateLocation('c:\\users\\g\\appdata\\local\\instrumenta\\downloads', { forbidden, platform: 'win32' }), /keeps for itself/);
  assert.throws(() => location.validateLocation('C:\\dev', { forbidden, platform: 'win32' }), /keeps for itself/, 'around the workspace too');
});

test('the storage report measures each product where it is installed', async () => {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-locations-'));
  try {
    const roots = { forge3d: path.join(area, 'D'), fabula: path.join(area, 'default') };
    for (const [id, root] of Object.entries(roots)) {
      fs.mkdirSync(path.join(root, id, 'versions', '1.0.0'), { recursive: true });
    }
    const report = await storageReport({
      installRoot: (id) => roots[id] || path.join(area, 'default'),
      freeSpaceRoot: area,
      downloadsRoot: path.join(area, 'downloads'),
      products: [{ id: 'forge3d' }, { id: 'fabula' }, { id: 'luna' }],
      readPointer: () => ({ current: '1.0.0', previous: '', pending: false }),
      size: async () => 10,
      statfs: async () => ({ bavail: 1, bsize: 1 }),
    });
    assert.deepEqual(report.items.map((item) => item.path).sort(), [path.join(roots.fabula, 'fabula'), path.join(roots.forge3d, 'forge3d')].sort());
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});
