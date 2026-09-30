'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  chooserRows,
  formatBytes,
  jobLabel,
  primaryAction,
  railFlag,
  sameRowShape,
  shouldOfferChooser,
} = require('../electron/renderer/launcher-model.js');

// Tiles as discover() reports them for an end user with no workspace: Fabula and Discere run from
// source, Imago is baked into the installer, Forge3D has a release, Luna is installed.
function endUserState(overrides = {}) {
  return {
    products: [
      { id: 'fabula', displayName: 'Fabula', adapter: 'native-bundle', lifecycle: 'developer-only', ready: false, canInstall: false, tile: { art: 'brand/artwork/fabula-app-art.png', theme: 'fabula' } },
      { id: 'imago', displayName: 'Imago', adapter: 'web-vite', ready: true, packaged: true, canInstall: false },
      { id: 'discere', displayName: 'Discere', adapter: 'web-service', lifecycle: 'developer-only', ready: false, canInstall: false },
      { id: 'forge3d', displayName: 'Forge3D', adapter: 'managed-bundle', lifecycle: 'available', ready: false, canInstall: true, releasePublished: true, latestVersion: '0.2.4', downloadSize: 734_003_200 },
      { id: 'luna', displayName: 'Luna', adapter: 'installed-desktop', lifecycle: 'installed', ready: true, canInstall: true, installedVersion: '0.3.0', latestVersion: '0.4.0', updateAvailable: true, downloadSize: 15_200_000_000 },
    ],
    queue: [],
    preferences: { autoUpdate: true, products: {}, appsChooserSeen: false },
    ...overrides,
  };
}

test('the chooser lists every product with what it is now and what installing costs', () => {
  const rows = chooserRows(endUserState());
  assert.deepEqual(rows.map(({ id }) => id), ['fabula', 'imago', 'discere', 'forge3d', 'luna'], 'catalog order, Fabula first');
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  assert.equal(byId.fabula.status, 'Developer only: runs from a source checkout');
  assert.equal(byId.fabula.developerOnly, true);
  assert.equal(byId.fabula.selectable, false);
  assert.equal(byId.imago.status, 'Included with Instrumenta');
  assert.equal(byId.forge3d.status, 'Available, 0.2.4');
  assert.equal(byId.forge3d.size, '734 MB');
  assert.equal(byId.forge3d.selectable, true);
  assert.equal(byId.luna.status, 'Installed 0.3.0, 0.4.0 available');
  assert.equal(byId.luna.selectable, false, 'already installed; updating is the tile\'s job');
  // Only release-backed products that are, or could be, installed keep themselves up to date.
  assert.equal(byId.forge3d.autoUpdate, true);
  assert.equal(byId.luna.autoUpdate, true);
  assert.equal(byId.imago.autoUpdate, null);
  assert.equal(byId.fabula.autoUpdate, null);
});

test('a product with nothing published says so and cannot be picked', () => {
  const state = endUserState();
  state.products[3] = { ...state.products[3], canInstall: false, releasePublished: false, latestVersion: '', downloadSize: 0 };
  const forge = chooserRows(state).find(({ id }) => id === 'forge3d');
  assert.equal(forge.status, 'No release published yet');
  assert.equal(forge.selectable, false);
  assert.equal(forge.size, '');
  assert.equal(primaryAction(state.products[3]), 'unreleased');
  assert.equal(shouldOfferChooser(state), false, 'nothing to offer, so the first run does not interrupt');
});

test('preferences decide the auto-update boxes, per product first', () => {
  const state = endUserState({ preferences: { autoUpdate: false, products: { luna: { autoUpdate: true } }, appsChooserSeen: true } });
  const byId = Object.fromEntries(chooserRows(state).map((row) => [row.id, row]));
  assert.equal(byId.luna.autoUpdate, true);
  assert.equal(byId.forge3d.autoUpdate, false);
});

test('the chooser offers itself once, on a first run with something to install', () => {
  assert.equal(shouldOfferChooser(endUserState()), true);
  assert.equal(shouldOfferChooser(endUserState({ preferences: { autoUpdate: true, products: {}, appsChooserSeen: true } })), false);
  assert.equal(shouldOfferChooser(null), false);
  // Before any check has answered, Install stays on the tile but the first run is not interrupted.
  const unknown = endUserState();
  unknown.products[3] = { ...unknown.products[3], releasePublished: null };
  assert.equal(chooserRows(unknown).find(({ id }) => id === 'forge3d').selectable, true);
  assert.equal(shouldOfferChooser(unknown), false);
});

test('an open chooser is updated in place while only its text changes', () => {
  const before = chooserRows(endUserState());
  const progressed = chooserRows(endUserState({ queue: [{ id: 'luna', kind: 'download', state: 'running', progress: { received: 1, total: 2 } }] }));
  assert.equal(sameRowShape(before, progressed), true, 'a download ticking over is text, not shape');
  const installed = endUserState();
  installed.products[3] = { ...installed.products[3], ready: true, installedVersion: '0.2.4' };
  assert.equal(sameRowShape(before, chooserRows(installed)), false, 'Forge3D can no longer be picked');
  assert.equal(sameRowShape([], before), false);
});

test('an install in the queue owns the button and the flag; a background update download does not', () => {
  const state = endUserState();
  const forge = state.products[3];
  const luna = state.products[4];
  const queued = { id: 'forge3d', kind: 'install', state: 'queued', progress: null };
  const running = { id: 'forge3d', kind: 'install', state: 'running', progress: { asset: 'Forge3D.zip', received: 367_001_600, total: 734_003_200 } };
  assert.equal(primaryAction(forge, queued), 'busy');
  assert.equal(jobLabel(queued), 'Queued');
  assert.equal(jobLabel(running), 'Downloading 50%');
  assert.equal(jobLabel({ ...running, progress: { received: 10, total: 10 } }), 'Installing…', 'fully downloaded, now activating');
  assert.deepEqual(railFlag(forge, running), { text: '50%', dot: false });
  assert.deepEqual(railFlag(forge, queued), { text: 'Queued', dot: false });

  const download = { id: 'luna', kind: 'download', state: 'running', progress: null };
  assert.equal(primaryAction(luna, download), 'update', 'Luna is open and usable while its update downloads');
  assert.equal(jobLabel(download), 'Downloading…');

  const rows = chooserRows({ ...state, queue: [running] });
  const row = rows.find(({ id }) => id === 'forge3d');
  assert.equal(row.selectable, false, 'already on its way');
  assert.equal(row.status, 'Downloading 50%');
  assert.equal(row.size, '734 MB');
});

test('the verbs follow the state, as before the queue', () => {
  assert.equal(primaryAction({ ready: true }), 'open');
  assert.equal(primaryAction({ ready: true, updateAvailable: true, canInstall: true }), 'update');
  assert.equal(primaryAction({ ready: false, canInstall: true }), 'install');
  assert.equal(primaryAction({ ready: false, canPrepare: true }), 'prepare');
  assert.equal(primaryAction({ ready: false, lifecycle: 'developer-only', releasePublished: false }), 'locate');
  assert.equal(primaryAction(null), null);
  assert.deepEqual(railFlag({ ready: false }), { text: '', dot: true });
  assert.deepEqual(railFlag({ ready: true }), { text: '', dot: false });
});

test('sizes read the way a download dialog shows them', () => {
  assert.equal(formatBytes(734_003_200), '734 MB');
  assert.equal(formatBytes(15_200_000_000), '15.2 GB');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(0), '');
  assert.equal(formatBytes(undefined), '');
});

test('the page loads the model before the renderer that uses it, from its own origin', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'electron', 'renderer', 'index.html'), 'utf8');
  const model = html.indexOf('<script src="launcher-model.js"></script>');
  const renderer = html.indexOf('<script src="renderer.js"></script>');
  assert.ok(model > 0 && renderer > model);
  assert.match(html, /<dialog id="apps-dialog"/);
  assert.match(html, /<span>Add apps<\/span>/);
});
