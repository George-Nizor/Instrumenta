'use strict';

const { fileURLToPath } = require('node:url');

const TOOL_PARTITIONS = Object.freeze({
  // Imago historically used Electron's default persistent session. Keep it
  // there so an upgrade cannot strand the user's IndexedDB cutout shelf.
  imago: undefined,
  // Ludere's autosaved screenplay and preferences also live in the historical
  // default session. Stable per-tool ports still give both apps distinct origins.
  ludere: undefined,
});

const hardenedSessions = new WeakSet();

function toolPartition(tool) {
  if (!Object.hasOwn(TOOL_PARTITIONS, tool)) throw new Error(`Unknown Instrumenta web tool: ${tool}`);
  return TOOL_PARTITIONS[tool];
}

function secureWebPreferences(extra = {}) {
  return {
    ...extra,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false,
    safeDialogs: true,
    navigateOnDragDrop: false,
    spellcheck: false,
  };
}

function isAllowedNavigation(candidate, allowedUrl) {
  try {
    const requested = new URL(candidate);
    const allowed = new URL(allowedUrl);
    if (requested.username || requested.password) return false;
    if (allowed.protocol === 'file:') {
      return requested.protocol === 'file:'
        && requested.host === allowed.host
        && fileURLToPath(requested) === fileURLToPath(allowed);
    }
    return (allowed.protocol === 'http:' || allowed.protocol === 'https:')
      && requested.origin === allowed.origin;
  } catch {
    return false;
  }
}

function eventUrl(event, legacyUrl = '') {
  if (event && typeof event.url === 'string') return event.url;
  if (typeof legacyUrl === 'string') return legacyUrl;
  return legacyUrl && typeof legacyUrl.url === 'string' ? legacyUrl.url : '';
}

function attachWebContentsPolicy(webContents, options) {
  const { allowedUrl, report = () => {} } = options;
  if (!allowedUrl) throw new Error('A trusted navigation URL is required.');

  const stopUnexpectedNavigation = (event, legacyUrl) => {
    const requestedUrl = eventUrl(event, legacyUrl);
    if (isAllowedNavigation(requestedUrl, allowedUrl)) return;
    event.preventDefault();
    report('navigation-blocked', { requestedUrl });
  };

  webContents.setWindowOpenHandler((details) => {
    report('window-open-blocked', { requestedUrl: details.url || '' });
    return { action: 'deny' };
  });
  webContents.on('will-frame-navigate', stopUnexpectedNavigation);
  webContents.on('will-redirect', stopUnexpectedNavigation);
  webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
    report('webview-blocked');
  });
  webContents.on('select-bluetooth-device', (event, _devices, callback) => {
    event.preventDefault();
    callback('');
    report('bluetooth-blocked');
  });
}

function hardenSession(session, options = {}) {
  if (hardenedSessions.has(session)) return false;
  const report = options.report || (() => {});
  session.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    report('permission-check-blocked', { permission, requestingOrigin });
    return false;
  });
  session.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    report('permission-request-blocked', {
      permission,
      requestingOrigin: details?.requestingUrl || details?.securityOrigin || '',
    });
    callback(false);
  });
  if (typeof session.setDevicePermissionHandler === 'function') {
    session.setDevicePermissionHandler((details) => {
      report('device-permission-blocked', { deviceType: details.deviceType || '' });
      return false;
    });
  }
  if (typeof session.setDisplayMediaRequestHandler === 'function') {
    session.setDisplayMediaRequestHandler((_request, callback) => {
      report('display-capture-blocked');
      callback({});
    });
  }
  hardenedSessions.add(session);
  return true;
}

function registerTrustedIpcHandler(ipcMain, channel, getTrustedSender, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    const trustedSender = getTrustedSender();
    if (!trustedSender || event.sender !== trustedSender || trustedSender.isDestroyed()) {
      throw new Error('Instrumenta rejected an untrusted renderer request.');
    }
    return handler(event, ...args);
  });
}

module.exports = {
  attachWebContentsPolicy,
  hardenSession,
  isAllowedNavigation,
  registerTrustedIpcHandler,
  secureWebPreferences,
  toolPartition,
};
