'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  lifecycleBlocker,
  retireServerPlan,
  rollbackAfterFailedOpen,
  samePath,
  staticServerPlan,
  supportsRollback,
} = require('../electron/lifecycle-policy.cjs');

test('a static server is reused only for the folder it was started on', () => {
  const server = { url: 'http://127.0.0.1:49322' };
  const v1 = 'C:\\Users\\G\\AppData\\Local\\Instrumenta\\products\\ludere\\versions\\0.5.1';
  const v2 = 'C:\\Users\\G\\AppData\\Local\\Instrumenta\\products\\ludere\\versions\\0.5.2';
  assert.equal(staticServerPlan(undefined, v1, 'win32'), 'create');
  assert.equal(staticServerPlan({ server, root: v1 }, v1, 'win32'), 'reuse');
  // An update, rollback or uninstall moves the product to another folder; the old server goes.
  assert.equal(staticServerPlan({ server, root: v1 }, v2, 'win32'), 'replace');
  assert.equal(staticServerPlan({ server, root: v1 }, 'C:\\Program Files\\Instrumenta\\resources\\apps\\ludere', 'win32'), 'replace');
  // Windows paths compare without regard to case; POSIX paths do not.
  assert.equal(staticServerPlan({ server, root: v1 }, v1.toUpperCase(), 'win32'), 'reuse');
  assert.equal(staticServerPlan({ server, root: '/opt/a/dist' }, '/opt/A/dist', 'linux'), 'replace');
  // A server already retired by a lifecycle change is never handed out again.
  assert.equal(staticServerPlan({ server, root: v1, retired: true }, v1, 'win32'), 'replace');
});

test('paths are compared resolved', () => {
  assert.equal(samePath('/opt/app/dist/', '/opt/app/./dist', 'linux'), true);
  assert.equal(samePath('', '/opt/app', 'linux'), false);
  assert.equal(samePath('C:\\Apps\\Ludere', 'c:\\apps\\ludere\\', 'win32'), true);
});

test('both managed adapters can roll back, and nothing else can', () => {
  assert.equal(supportsRollback('managed-bundle'), true);
  assert.equal(supportsRollback('managed-web'), true);
  for (const adapter of ['installed-desktop', 'web-vite', 'web-static', 'web-service', 'native-bundle']) {
    assert.equal(supportsRollback(adapter), false, adapter);
  }
});

test('a failed first open rolls back only a pending version with somewhere to go', () => {
  const pending = { version: '0.5.2', pending: true, previous: '0.5.1' };
  assert.equal(rollbackAfterFailedOpen('managed-web', pending), true);
  assert.equal(rollbackAfterFailedOpen('managed-bundle', pending), true);
  // Opened successfully before: one failure is not a verdict on the version.
  assert.equal(rollbackAfterFailedOpen('managed-web', { ...pending, pending: false }), false);
  // A first install has nothing to return to.
  assert.equal(rollbackAfterFailedOpen('managed-web', { ...pending, previous: '' }), false);
  // A baked-in or source build was served, not a managed version.
  assert.equal(rollbackAfterFailedOpen('managed-web', null), false);
  assert.equal(rollbackAfterFailedOpen('web-vite', pending), false);
});

test('a retired server closes now, or with the window still showing it', () => {
  assert.equal(retireServerPlan({ windowOpen: false }), 'close-now');
  assert.equal(retireServerPlan({ windowOpen: true }), 'close-with-window');
});

test('uninstalling a running managed product waits until it is closed', () => {
  assert.equal(
    lifecycleBlocker({ operation: 'uninstall', adapter: 'managed-web', running: true, displayName: 'Ludere' }),
    'Close Ludere before uninstalling it.',
  );
  assert.match(lifecycleBlocker({ operation: 'uninstall', adapter: 'managed-bundle', running: true, displayName: 'Forge3D' }), /Close Forge3D/);
  assert.equal(lifecycleBlocker({ operation: 'uninstall', adapter: 'managed-web', running: false, displayName: 'Ludere' }), '');
  // An update installs beside the running version and is what opens next time.
  assert.equal(lifecycleBlocker({ operation: 'install', adapter: 'managed-bundle', running: true, displayName: 'Forge3D' }), '');
  // Luna's own uninstaller deals with a running Luna.
  assert.equal(lifecycleBlocker({ operation: 'uninstall', adapter: 'installed-desktop', running: true, displayName: 'Luna' }), '');
});

test('nothing is uninstalled or rolled back under an install of the same product', () => {
  for (const operation of ['uninstall', 'rollback']) {
    assert.match(
      lifecycleBlocker({ operation, adapter: 'installed-desktop', installing: true, displayName: 'Luna' }),
      /Luna is being installed/,
    );
  }
  assert.equal(lifecycleBlocker({ operation: 'rollback', adapter: 'managed-bundle', running: true, displayName: 'Forge3D' }), '');
});
