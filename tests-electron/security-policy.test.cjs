'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const {
  attachWebContentsPolicy,
  hardenSession,
  isAllowedNavigation,
  registerTrustedIpcHandler,
  secureWebPreferences,
  toolPartition,
} = require('../electron/security-policy.cjs');

test('both editors preserve historical default-session user data', () => {
  assert.equal(toolPartition('imago'), undefined);
  assert.equal(toolPartition('ludere'), undefined);
  assert.throws(() => toolPartition('unknown'), /Unknown Instrumenta web tool/);
});

test('secure web preferences cannot be weakened by caller options', () => {
  const preferences = secureWebPreferences({
    nodeIntegration: true,
    sandbox: false,
    webSecurity: false,
    preload: '/trusted/preload.cjs',
  });
  assert.equal(preferences.preload, '/trusted/preload.cjs');
  assert.equal(preferences.contextIsolation, true);
  assert.equal(preferences.nodeIntegration, false);
  assert.equal(preferences.sandbox, true);
  assert.equal(preferences.webSecurity, true);
  assert.equal(preferences.webviewTag, false);
});

test('navigation stays on its assigned local origin or exact launcher file', () => {
  assert.equal(isAllowedNavigation('http://127.0.0.1:49321/editor?id=1', 'http://127.0.0.1:49321/'), true);
  assert.equal(isAllowedNavigation('http://127.0.0.1:49322/', 'http://127.0.0.1:49321/'), false);
  assert.equal(isAllowedNavigation('https://example.com/', 'http://127.0.0.1:49321/'), false);
  assert.equal(isAllowedNavigation('data:text/html,unsafe', 'http://127.0.0.1:49321/'), false);
  assert.equal(isAllowedNavigation('file:///app/index.html#settings', 'file:///app/index.html'), true);
  assert.equal(isAllowedNavigation('file:///app/other.html', 'file:///app/index.html'), false);
});

test('window, navigation, webview, and bluetooth escape routes are denied', () => {
  const contents = new EventEmitter();
  let openHandler;
  contents.setWindowOpenHandler = (handler) => { openHandler = handler; };
  const reports = [];
  attachWebContentsPolicy(contents, {
    allowedUrl: 'http://127.0.0.1:49321/',
    report: (event, details) => reports.push([event, details]),
  });

  assert.deepEqual(openHandler({ url: 'https://example.com/' }), { action: 'deny' });
  let blocked = false;
  contents.emit('will-frame-navigate', {
    url: 'https://example.com/',
    preventDefault: () => { blocked = true; },
  });
  assert.equal(blocked, true);

  let allowedBlocked = false;
  contents.emit('will-frame-navigate', {
    url: 'http://127.0.0.1:49321/project/1',
    preventDefault: () => { allowedBlocked = true; },
  });
  assert.equal(allowedBlocked, false);

  let modernAllowedBlocked = false;
  contents.emit('will-frame-navigate', { preventDefault: () => { modernAllowedBlocked = true; } }, {
    url: 'http://127.0.0.1:49321/project/2',
  });
  assert.equal(modernAllowedBlocked, false);

  let modernForeignBlocked = false;
  contents.emit('will-redirect', { preventDefault: () => { modernForeignBlocked = true; } }, {
    url: 'http://127.0.0.1:49322/',
  });
  assert.equal(modernForeignBlocked, true);

  let webviewBlocked = false;
  contents.emit('will-attach-webview', { preventDefault: () => { webviewBlocked = true; } });
  assert.equal(webviewBlocked, true);

  let selected = 'device';
  contents.emit('select-bluetooth-device', { preventDefault() {} }, [], (value) => { selected = value; });
  assert.equal(selected, '');
  assert.ok(reports.some(([event]) => event === 'navigation-blocked'));
});

test('browser sessions deny privileged permission and capture requests', () => {
  const session = {
    setPermissionCheckHandler(handler) { this.check = handler; },
    setPermissionRequestHandler(handler) { this.request = handler; },
    setDevicePermissionHandler(handler) { this.device = handler; },
    setDisplayMediaRequestHandler(handler) { this.display = handler; },
  };
  assert.equal(hardenSession(session), true);
  assert.equal(session.check(null, 'geolocation', 'http://127.0.0.1:49321'), false);
  let granted = true;
  session.request(null, 'media', (value) => { granted = value; }, {});
  assert.equal(granted, false);
  assert.equal(session.device({ deviceType: 'usb' }), false);
  let streams = null;
  session.display({}, (value) => { streams = value; });
  assert.deepEqual(streams, {});
  assert.equal(hardenSession(session), false);
});

test('IPC handlers accept only the current launcher renderer', async () => {
  let registered;
  const ipcMain = { handle: (_channel, handler) => { registered = handler; } };
  const trusted = { isDestroyed: () => false };
  registerTrustedIpcHandler(ipcMain, 'instrumenta:test', () => trusted, (_event, value) => value * 2);
  assert.equal(await registered({ sender: trusted }, 4), 8);
  assert.throws(() => registered({ sender: { isDestroyed: () => false } }, 4), /untrusted renderer/);
});
