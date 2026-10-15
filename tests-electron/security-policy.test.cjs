'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');
const {
  attachServiceHeaders,
  attachWebContentsPolicy,
  hardenSession,
  isAllowedEmbed,
  isAllowedNavigation,
  isExternalLink,
  opensLinksExternally,
  registerTrustedIpcHandler,
  secureWebPreferences,
  serviceHeaders,
  toolPartition,
} = require('../electron/security-policy.cjs');
const { contentSecurityPolicy } = require('../electron/static-server.cjs');

test('Ludere preserves its historical default-session user data', () => {
  assert.equal(toolPartition('ludere'), undefined);
  assert.throws(() => toolPartition('unknown'), /Unknown Instrumenta web tool/);
});

test('a managed-service product gets its own storage partition', () => {
  assert.equal(toolPartition('discere'), 'persist:tool-discere');
  assert.equal(toolPartition('imago'), 'persist:tool-imago');
});

test('Imago may frame its own pages and Discere may not frame anything', () => {
  const imago = serviceHeaders('imago');
  assert.equal(imago['X-Frame-Options'][0], 'SAMEORIGIN');
  assert.match(imago['Content-Security-Policy'][0], /frame-ancestors 'self'/);
  assert.match(imago['Content-Security-Policy'][0], /frame-src 'self'/);
  assert.doesNotMatch(imago['Content-Security-Policy'][0], /wasm-unsafe-eval|blob:[^;]*script|script-src[^;]*blob/);
  const discere = serviceHeaders('discere');
  assert.equal(discere['X-Frame-Options'][0], 'DENY');
  assert.match(discere['Content-Security-Policy'][0], /frame-ancestors 'none'/);
  // Delineare's video player changed nothing here: Imago frames only itself, Discere nothing.
  assert.deepEqual(imago['Content-Security-Policy'][0].match(/frame-src[^;]*/g), ["frame-src 'self'"]);
  assert.doesNotMatch(discere['Content-Security-Policy'][0], /frame-src|child-src/);
});

test('LearnChess gets its own persistent partition for its saved progress', () => {
  assert.equal(toolPartition('learnchess'), 'persist:tool-learnchess');
});

test('Delineare keeps its progress and drawings in its own persistent partition', () => {
  assert.equal(toolPartition('delineare'), 'persist:tool-delineare');
});

test('only Delineare sends links to the browser, and only public https addresses', () => {
  assert.equal(opensLinksExternally('delineare'), true);
  for (const tool of ['ludere', 'learnchess', 'imago', 'discere']) assert.equal(opensLinksExternally(tool), false, tool);
  for (const url of ['https://drawabox.com/lesson/1', 'https://www.youtube.com/watch?v=abc', 'https://www.proko.com/course-lesson/x']) {
    assert.equal(isExternalLink(url), true, url);
  }
  for (const url of ['http://drawabox.com/', 'file:///C:/Windows/', 'javascript:alert(1)', 'https://user:pw@example.com/',
    'https://localhost/', 'https://intranet/', 'https://127.0.0.1/', 'https://192.168.1.1/', 'https://[::1]/',
    'https://printer.local/', 'https://app.localhost/', `https://example.com/${'a'.repeat(2100)}`, '', null]) {
    assert.equal(isExternalLink(url), false, String(url).slice(0, 40));
  }
});

test('a product allowed to open links hands public https links to the browser and keeps its window', async () => {
  const contents = new EventEmitter();
  let openHandler;
  contents.setWindowOpenHandler = (handler) => { openHandler = handler; };
  const reports = [];
  const opened = [];
  attachWebContentsPolicy(contents, {
    allowedUrl: 'http://127.0.0.1:49325/',
    report: (event, details) => reports.push([event, details]),
    openExternal: (url) => { opened.push(url); },
  });
  assert.deepEqual(openHandler({ url: 'https://drawabox.com/lesson/1' }), { action: 'deny' });
  assert.deepEqual(openHandler({ url: 'http://drawabox.com/lesson/1' }), { action: 'deny' });
  assert.deepEqual(openHandler({ url: 'https://127.0.0.1:9000/' }), { action: 'deny' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(opened, ['https://drawabox.com/lesson/1']);
  assert.deepEqual(reports.map(([event]) => event), ['external-link-opened', 'window-open-blocked', 'window-open-blocked']);
  let blocked = false;
  contents.emit('will-frame-navigate', { url: 'https://drawabox.com/', preventDefault: () => { blocked = true; } });
  assert.equal(blocked, true, 'the tool window itself never navigates to the link');
});

const EMBED = 'https://www.youtube-nocookie.com/embed/LkJG6pKTuRc';

test('only Delineare may embed, and only YouTube nocookie /embed/ pages', () => {
  for (const url of [EMBED, `${EMBED}?start=30&rel=0`, 'https://WWW.YOUTUBE-NOCOOKIE.COM/embed/x',
    'https://www.youtube-nocookie.com:443/embed/x', 'https://www.youtube-nocookie.com/embed/videoseries?list=PL1']) {
    assert.equal(isAllowedEmbed(url, 'delineare'), true, url);
  }
  for (const url of ['https://www.youtube.com/embed/LkJG6pKTuRc', 'http://www.youtube-nocookie.com/embed/x',
    'https://youtube-nocookie.com/embed/x', 'https://www.youtube-nocookie.com.example.com/embed/x',
    'https://www.youtube-nocookie.com:8443/embed/x', 'https://user:pw@www.youtube-nocookie.com/embed/x',
    'https://www.youtube-nocookie.com/', 'https://www.youtube-nocookie.com/watch?v=x',
    'https://www.youtube-nocookie.com/embed', 'https://www.youtube-nocookie.com/embed/',
    'https://www.youtube-nocookie.com/embedded/x', 'https://www.youtube-nocookie.com/embed%2fx',
    'https://www.youtube-nocookie.com/embed/../watch?v=x', 'https://www.youtube-nocookie.com/embed/%2e%2e/watch?v=x',
    `${EMBED}?${'a'.repeat(2100)}`, 'javascript:alert(1)', '', null]) {
    assert.equal(isAllowedEmbed(url, 'delineare'), false, String(url).slice(0, 60));
  }
  for (const tool of ['ludere', 'learnchess', 'imago', 'discere', 'launcher', '', undefined, 'toString', '__proto__']) {
    assert.equal(isAllowedEmbed(EMBED, tool), false, String(tool));
  }
});

function navigationHarness(tool) {
  const contents = new EventEmitter();
  contents.setWindowOpenHandler = () => {};
  const reports = [];
  attachWebContentsPolicy(contents, {
    allowedUrl: 'http://127.0.0.1:49327/',
    report: (event, details) => reports.push([event, details]),
    ...(tool === undefined ? {} : { tool }),
  });
  const navigate = (eventName, details) => {
    let blocked = false;
    contents.emit(eventName, { ...details, preventDefault: () => { blocked = true; } });
    return blocked;
  };
  return { navigate, reports };
}

test('a Delineare subframe may load the embedded player, and the window itself may not', () => {
  const { navigate, reports } = navigationHarness('delineare');
  assert.equal(navigate('will-frame-navigate', { url: EMBED, isMainFrame: false }), false);
  assert.equal(navigate('will-frame-navigate', { url: `${EMBED}?autoplay=1`, isMainFrame: false }), false);
  assert.equal(navigate('will-redirect', { url: EMBED, isMainFrame: false }), false);
  assert.equal(navigate('will-frame-navigate', { url: 'http://127.0.0.1:49327/lesson/1', isMainFrame: false }), false);
  assert.deepEqual(reports, [], 'an allowed embed is not reported as blocked');

  // The main frame never leaves its own origin, for the player as for anything else.
  assert.equal(navigate('will-frame-navigate', { url: EMBED, isMainFrame: true }), true);
  assert.equal(navigate('will-redirect', { url: EMBED, isMainFrame: true }), true);
  // An event that does not say which frame it is counts as the main frame.
  assert.equal(navigate('will-frame-navigate', { url: EMBED }), true);
  assert.equal(navigate('will-frame-navigate', { url: EMBED, isMainFrame: 'false' }), true);

  // Subframes may go nowhere else: not YouTube itself, not another nocookie page, not anywhere.
  for (const url of ['https://www.youtube.com/embed/LkJG6pKTuRc', 'https://www.youtube-nocookie.com/watch?v=LkJG6pKTuRc',
    'https://www.youtube-nocookie.com/', 'https://accounts.google.com/', 'https://example.com/',
    'http://127.0.0.1:49328/', 'data:text/html,unsafe']) {
    assert.equal(navigate('will-frame-navigate', { url, isMainFrame: false }), true, url);
  }
  assert.equal(reports.length, 11);
  assert.ok(reports.every(([event]) => event === 'navigation-blocked'));
  assert.deepEqual(reports[0][1], { requestedUrl: EMBED });
});

test('every other tool still blocks every off-origin subframe, the player included', () => {
  for (const tool of ['ludere', 'learnchess', 'imago', 'discere', undefined]) {
    const { navigate, reports } = navigationHarness(tool);
    assert.equal(navigate('will-frame-navigate', { url: EMBED, isMainFrame: false }), true, String(tool));
    assert.equal(navigate('will-redirect', { url: EMBED, isMainFrame: false }), true, String(tool));
    assert.equal(navigate('will-frame-navigate', { url: 'https://example.com/', isMainFrame: false }), true, String(tool));
    assert.equal(navigate('will-frame-navigate', { url: 'http://127.0.0.1:49327/same-origin', isMainFrame: false }), false, String(tool));
    assert.equal(reports.length, 3, String(tool));
  }
});

// LearnChess shipped in the catalog with a CSP profile but no partition entry, so its tile
// built, staged, and reported READY, and then threw the moment Open reached toolPartition.
// The catalog is the list the launcher actually opens; read it here so the next web product
// fails this test instead of failing in front of the person who installed it.
test('every web product the launcher can open is wired for its own session', () => {
  const catalog = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'products', 'catalog.json'), 'utf8').replace(/^\uFEFF/, ''),
  );
  const webAdapters = new Set(['web-vite', 'web-static', 'web-service', 'managed-web', 'managed-service']);
  const web = catalog.products.filter((product) => webAdapters.has(product.adapter));
  assert.ok(web.length >= 4, 'expected the catalog to register several web products');

  for (const product of web) {
    // Every one of these reaches openWebTool, which asks for a partition before it opens a window.
    assert.doesNotThrow(() => toolPartition(product.id), `${product.id} has no session partition`);
    if (product.adapter === 'web-service' || product.adapter === 'managed-service') {
      assert.doesNotThrow(() => serviceHeaders(product.id), `${product.id} has no service CSP`);
    } else {
      assert.doesNotThrow(() => contentSecurityPolicy(product.id), `${product.id} has no CSP profile`);
    }
  }
});

test('launcher headers replace whatever a managed service sends', () => {
  let received;
  const session = { webRequest: { onHeadersReceived: (handler) => { received = handler; } } };
  attachServiceHeaders(session, 'discere');
  let headers;
  received({
    responseHeaders: {
      'content-security-policy': ["default-src * 'unsafe-inline'"],
      'X-Frame-Options': ['SAMEORIGIN'],
      'Content-Type': ['text/html'],
    },
  }, (result) => { headers = result.responseHeaders; });

  assert.equal(headers['content-security-policy'], undefined);
  assert.match(headers['Content-Security-Policy'][0], /default-src 'none'/);
  assert.match(headers['Content-Security-Policy'][0], /connect-src 'self'(?:;|$)/);
  assert.match(headers['Content-Security-Policy'][0], /script-src 'self'(?:;|$)/);
  assert.doesNotMatch(headers['Content-Security-Policy'][0], /https:|\*/);
  assert.deepEqual(headers['X-Frame-Options'], ['DENY']);
  assert.deepEqual(headers['Referrer-Policy'], ['no-referrer']);
  assert.deepEqual(headers['Content-Type'], ['text/html']);
  assert.throws(() => attachServiceHeaders(session, 'ludere'), /Unknown Instrumenta service tool/);
  assert.throws(() => attachServiceHeaders(session, 'unknown'), /Unknown Instrumenta service tool/);
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
  // File URLs as this platform writes them: on Windows a drive letter is part of the path.
  const launcherPage = pathToFileURL(path.resolve('/app/index.html')).href;
  assert.equal(isAllowedNavigation(`${launcherPage}#settings`, launcherPage), true);
  assert.equal(isAllowedNavigation(pathToFileURL(path.resolve('/app/other.html')).href, launcherPage), false);
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

function permissionHarness(tool) {
  const reports = [];
  const session = {
    setPermissionCheckHandler(handler) { this.check = handler; },
    setPermissionRequestHandler(handler) { this.request = handler; },
  };
  hardenSession(session, { report: (event, details) => reports.push([event, details]), ...(tool ? { tool } : {}) });
  const ask = (permission, details) => {
    let granted = null;
    session.request(null, permission, (value) => { granted = value; }, details);
    return granted;
  };
  return { ask, reports, session };
}

test('Delineare grants fullscreen to its embedded player and to nothing else', () => {
  const { ask, reports, session } = permissionHarness('delineare');
  assert.equal(ask('fullscreen', { isMainFrame: false, requestingUrl: `${EMBED}?rel=0` }), true);
  assert.deepEqual(reports, [], 'the grant is not reported as blocked');

  // The lesson page itself, any other frame, any other permission: still refused.
  assert.equal(ask('fullscreen', { isMainFrame: true, requestingUrl: 'http://127.0.0.1:49327/' }), false);
  assert.equal(ask('fullscreen', { isMainFrame: true, requestingUrl: EMBED }), false);
  assert.equal(ask('fullscreen', { requestingUrl: EMBED }), false);
  assert.equal(ask('fullscreen', { isMainFrame: false, requestingUrl: 'https://www.youtube.com/embed/LkJG6pKTuRc' }), false);
  assert.equal(ask('fullscreen', { isMainFrame: false, requestingUrl: 'https://www.youtube-nocookie.com/watch?v=x' }), false);
  assert.equal(ask('fullscreen', undefined), false);
  for (const permission of ['media', 'pointerLock', 'keyboardLock', 'clipboard-read', 'notifications', 'storage-access', 'openExternal']) {
    assert.equal(ask(permission, { isMainFrame: false, requestingUrl: EMBED }), false, permission);
  }
  assert.equal(reports.length, 13);
  assert.ok(reports.every(([event]) => event === 'permission-request-blocked'));
  // Permission checks are untouched: the player's frame is refused like everything else.
  assert.equal(session.check(null, 'fullscreen', 'https://www.youtube-nocookie.com', { isMainFrame: false }), false);
});

test('no other session grants fullscreen to the player', () => {
  for (const tool of ['ludere', 'learnchess', 'imago', 'discere', undefined]) {
    const { ask } = permissionHarness(tool);
    assert.equal(ask('fullscreen', { isMainFrame: false, requestingUrl: EMBED }), false, String(tool));
  }
});

test('IPC handlers accept only the current launcher renderer', async () => {
  let registered;
  const ipcMain = { handle: (_channel, handler) => { registered = handler; } };
  const trusted = { isDestroyed: () => false };
  registerTrustedIpcHandler(ipcMain, 'instrumenta:test', () => trusted, (_event, value) => value * 2);
  assert.equal(await registered({ sender: trusted }, 4), 8);
  assert.throws(() => registered({ sender: { isDestroyed: () => false } }, 4), /untrusted renderer/);
});
