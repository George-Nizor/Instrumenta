'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  applyPreference,
  autoUpdateFor,
  decide,
  downloadSize,
  knownVersions,
  readPreferences,
  skipVersion,
  unskipVersion,
} = require('../electron/update-policy.cjs');

const latest = (version, minimumInstrumentaVersion = '0.9.0') => ({ version, minimumInstrumentaVersion });

test('automatic updates are on unless turned off, and a product can override either way', () => {
  const defaults = readPreferences({});
  assert.equal(defaults.autoUpdate, true);
  assert.equal(autoUpdateFor(defaults, 'luna'), true);

  const off = readPreferences({ autoUpdate: false, products: { forge3d: { autoUpdate: true } } });
  assert.equal(autoUpdateFor(off, 'luna'), false);
  assert.equal(autoUpdateFor(off, 'forge3d'), true);
  const lunaOff = readPreferences({ products: { luna: { autoUpdate: false } } });
  assert.equal(autoUpdateFor(lunaOff, 'luna'), false);
  assert.equal(autoUpdateFor(lunaOff, 'forge3d'), true);

  // Garbage in settings.json is read as the default, not as a crash.
  const junk = readPreferences({ autoUpdate: 'yes', products: { 'Bad ID': {}, luna: { autoUpdate: 1, skippedVersions: ['x', '0.4.0'] } } });
  assert.equal(junk.autoUpdate, true);
  assert.deepEqual(junk.products, { luna: { autoUpdate: null, skippedVersions: ['0.4.0'] } });
});

test('an update is installed, downloaded for later, offered, or left alone', () => {
  const preferences = readPreferences({});
  const base = { id: 'forge3d', installedVersion: '0.2.2', latest: latest('0.2.4'), preferences, launcherVersion: '0.9.1' };
  assert.deepEqual(decide(base), { action: 'install', reason: 'auto-update' });
  // Never swapped under a product that is open; fetched now, activated once it closes.
  assert.deepEqual(decide({ ...base, running: true }), { action: 'download', reason: 'running' });
  assert.deepEqual(decide({ ...base, preferences: readPreferences({ autoUpdate: false }) }), { action: 'prompt', reason: 'auto-update-off' });
  assert.equal(decide({ ...base, latest: latest('0.2.2') }).action, 'none');
  assert.equal(decide({ ...base, latest: null }).action, 'none');
  // A product nobody installed is never installed behind their back.
  assert.deepEqual(decide({ ...base, installedVersion: '' }), { action: 'none', reason: 'not-installed' });
  // A release for a newer launcher waits for the launcher.
  assert.deepEqual(decide({ ...base, latest: latest('0.3.0', '1.0.0') }), { action: 'none', reason: 'needs-newer-launcher' });
});

test('a version rolled back from is not offered again until installed on purpose', () => {
  let settings = { workspace: 'W:\\Instrumenta', products: { luna: { autoUpdate: false } } };
  settings = skipVersion(settings, 'forge3d', '0.2.4');
  settings = skipVersion(settings, 'forge3d', '0.2.4');
  assert.deepEqual(settings.products.forge3d, { skippedVersions: ['0.2.4'] });
  assert.equal(settings.workspace, 'W:\\Instrumenta', 'the rest of settings.json is kept');
  const preferences = readPreferences(settings);
  const base = { id: 'forge3d', installedVersion: '0.2.2', preferences, launcherVersion: '0.9.1' };
  assert.deepEqual(decide({ ...base, latest: latest('0.2.4') }), { action: 'none', reason: 'skipped' });
  // A later fix is offered as usual.
  assert.equal(decide({ ...base, latest: latest('0.2.5') }).action, 'install');

  settings = unskipVersion(settings, 'forge3d', '0.2.4');
  assert.equal(settings.products.forge3d, undefined, 'an emptied entry is removed');
  assert.deepEqual(settings.products.luna, { autoUpdate: false });
  assert.equal(skipVersion(settings, 'forge3d', 'not-a-version'), settings);
});

test('a preference change from the renderer is validated before it is kept', () => {
  const settings = { workspace: 'W:\\Instrumenta' };
  assert.deepEqual(applyPreference(settings, { autoUpdate: false }), { workspace: 'W:\\Instrumenta', autoUpdate: false });
  const own = applyPreference(settings, { product: 'luna', autoUpdate: false });
  assert.deepEqual(own.products, { luna: { autoUpdate: false } });
  assert.deepEqual(applyPreference(own, { product: 'luna', autoUpdate: null }).products, {}, 'back to the default');
  assert.throws(() => applyPreference(settings, { autoUpdate: 'off' }), /true or false/);
  assert.throws(() => applyPreference(settings, { product: '../x', autoUpdate: true }), /product ID/);
  assert.throws(() => applyPreference(settings, { product: 'luna', autoUpdate: 'maybe' }), /true, false, or null/);
  assert.throws(() => applyPreference(settings, null), /is an object/);
  assert.deepEqual(applyPreference(settings, { appsChooserSeen: true }), { workspace: 'W:\\Instrumenta', appsChooserSeen: true });
  assert.throws(() => applyPreference(settings, { appsChooserSeen: true, autoUpdate: false }), /on its own/);
});

test('the tiles hear the newest version, whether anything is published, and its size', () => {
  const bundle = { schemaVersion: 1, product: 'forge3d', version: '0.2.4', minimumInstrumentaVersion: '0.9.0', bundle: { size: 734003200 } };
  const installer = {
    schemaVersion: 1, product: 'luna', version: '0.4.0', minimumInstrumentaVersion: '1.0.0',
    installer: { size: 100 }, payload: { size: 900, chunks: [{ size: 400 }, { size: 500 }] },
  };
  assert.equal(downloadSize(bundle), 734003200);
  assert.equal(downloadSize(installer), 1000);
  assert.equal(downloadSize(null), 0);
  const cache = {
    forge3d: { version: '0.2.4', manifest: bundle, checkedAt: 10 },
    luna: { version: '0.4.0', manifest: installer, checkedAt: 10 },
    discere: { version: '', manifest: null, checkedAt: 10 },
    fabula: { version: '', manifest: null, checkedAt: 0 },
  };
  const preferences = readPreferences(skipVersion({}, 'forge3d', '0.2.4'));
  const known = knownVersions({ cache, installed: { luna: '0.3.0' }, preferences, launcherVersion: '0.9.1' });
  assert.deepEqual(known.latest, { luna: '0.4.0' }, 'a skipped version is not offered');
  assert.deepEqual(known.installed, { luna: '0.3.0' });
  assert.equal(known.launcher, '0.9.1');
  assert.deepEqual(known.releases.luna, { published: true, version: '0.4.0', downloadSize: 1000, minimumInstrumentaVersion: '1.0.0', notes: '' });
  const noted = knownVersions({ cache: { luna: { version: '0.4.0', manifest: { ...installer, notes: 'Voices load faster.' }, checkedAt: 10 } } });
  assert.equal(noted.releases.luna.notes, 'Voices load faster.', 'release notes ride along for "What\'s new"');
  assert.equal(known.releases.forge3d.published, true);
  assert.equal(known.releases.discere.published, false, 'checked: nothing published yet');
  assert.equal(known.releases.fabula.published, null, 'never answered');
});

test('a large update is offered, never fetched unasked, unless that app was set to update itself', () => {
  const latest = { version: '0.4.1', downloadSize: 15 * 1024 ** 3 };
  const defaults = readPreferences({});
  assert.deepEqual(decide({ id: 'luna', installedVersion: '0.3.0', latest, preferences: defaults }), { action: 'prompt', reason: 'large-download' });
  const small = { version: '0.4.1', downloadSize: 40 * 1024 ** 2 };
  assert.equal(decide({ id: 'imago', installedVersion: '0.1.0', latest: small, preferences: defaults }).action, 'install');
  const chosen = readPreferences({ products: { luna: { autoUpdate: true } } });
  assert.equal(decide({ id: 'luna', installedVersion: '0.3.0', latest, preferences: chosen }).action, 'install');
  const off = readPreferences({ products: { luna: { autoUpdate: false } } });
  assert.equal(decide({ id: 'luna', installedVersion: '0.3.0', latest, preferences: off }).reason, 'auto-update-off');
});
