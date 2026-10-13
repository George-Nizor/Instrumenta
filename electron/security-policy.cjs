'use strict';

const { fileURLToPath } = require('node:url');

const TOOL_PARTITIONS = Object.freeze({
  // Ludere's autosaved screenplay and preferences also live in the historical
  // default session. Stable per-tool ports still give both apps distinct origins.
  ludere: undefined,
  // Managed-service products are new, so they start in their own partition and
  // never share storage with the historical default session. Imago moved here
  // when it became a service with its own server-side project store; its old
  // static build's IndexedDB stays behind in the default session, unread.
  discere: 'persist:tool-discere',
  imago: 'persist:tool-imago',
  // LearnChess is new too, and keeps real user work in IndexedDB and
  // localStorage: puzzle history, review scheduling, opening and endgame
  // progress. Its own persistent partition keeps that durable without putting
  // it in the session Imago and Ludere share.
  learnchess: 'persist:tool-learnchess',
  // Delineare keeps the learner's progress, session log and photos of their drawings in
  // IndexedDB, so it gets its own persistent partition like LearnChess.
  delineare: 'persist:tool-delineare',
});

// Delineare's job is to send the learner to lessons hosted by the people who made them, so a
// link it opens goes to the system browser instead of being dropped. Only this product, only
// https, no credentials in the address, and never a local or private address. The tool window
// itself still never navigates away from its own origin.
const EXTERNAL_LINK_TOOLS = new Set(['delineare']);

// A managed service supplies its own HTTP responses, so Instrumenta cannot set
// its headers at the server. These are injected on the tool's own session and
// deliberately replace anything the service sent.
const SERVICE_CSP = Object.freeze({
  discere: [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self' data: blob:",
  ].join('; '),
  // Imago frames its own same-origin /projects/:id/design.html preview, so it
  // needs frame-src 'self'. Background removal runs server-side: no wasm, blob
  // workers or cross-origin isolation.
  imago: [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self' data: blob:",
  ].join('; '),
});

// Services whose own pages are framed by the same origin. Everything else is
// never framable, by anyone.
const SAME_ORIGIN_FRAMING = new Set(['imago']);

// Services whose own, stricter per-route policy (Imago's on the generated
// design.html pages) must survive beside the launcher's. Browsers enforce every
// policy sent, so the two intersect: the service can only narrow the launcher's.
const KEEP_SERVICE_POLICY = new Set(['imago']);

const hardenedSessions = new WeakSet();

function toolPartition(tool) {
  if (!Object.hasOwn(TOOL_PARTITIONS, tool)) throw new Error(`Unknown Instrumenta web tool: ${tool}`);
  return TOOL_PARTITIONS[tool];
}

function serviceHeaders(tool) {
  if (!Object.hasOwn(SERVICE_CSP, tool)) throw new Error(`Unknown Instrumenta service tool: ${tool}`);
  return {
    'Content-Security-Policy': [SERVICE_CSP[tool]],
    'Referrer-Policy': ['no-referrer'],
    'X-Content-Type-Options': ['nosniff'],
    'X-Frame-Options': [SAME_ORIGIN_FRAMING.has(tool) ? 'SAMEORIGIN' : 'DENY'],
    'Permissions-Policy': ['camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), usb=(), serial=(), hid=()'],
  };
}

function attachServiceHeaders(session, tool) {
  const headers = serviceHeaders(tool);
  const owned = Object.keys(headers).map((name) => name.toLowerCase());
  session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...(details.responseHeaders || {}) };
    const own = { ...headers };
    // Overwrite rather than append: a service-supplied policy must never widen
    // or duplicate the launcher's policy for the same header.
    for (const name of Object.keys(responseHeaders)) {
      if (!owned.includes(name.toLowerCase())) continue;
      if (KEEP_SERVICE_POLICY.has(tool) && name.toLowerCase() === 'content-security-policy') {
        own['Content-Security-Policy'] = [...own['Content-Security-Policy'], ...[].concat(responseHeaders[name])];
      }
      delete responseHeaders[name];
    }
    callback({ responseHeaders: { ...responseHeaders, ...own } });
  });
  return headers;
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

function opensLinksExternally(tool) {
  return EXTERNAL_LINK_TOOLS.has(tool);
}

function isExternalLink(candidate) {
  if (typeof candidate !== 'string' || candidate.length > 2048) return false;
  try {
    const target = new URL(candidate);
    if (target.protocol !== 'https:' || target.username || target.password) return false;
    const host = target.hostname.toLowerCase();
    // A named public host only: no localhost, no bare names, no IP literals of any kind.
    if (!host.includes('.') || host.endsWith('.localhost') || host.endsWith('.local')) return false;
    if (/^[\d.]+$/.test(host) || host.startsWith('[')) return false;
    return true;
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
  const { allowedUrl, report = () => {}, openExternal = null } = options;
  if (!allowedUrl) throw new Error('A trusted navigation URL is required.');

  const stopUnexpectedNavigation = (event, legacyUrl) => {
    const requestedUrl = eventUrl(event, legacyUrl);
    if (isAllowedNavigation(requestedUrl, allowedUrl)) return;
    event.preventDefault();
    report('navigation-blocked', { requestedUrl });
  };

  webContents.setWindowOpenHandler((details) => {
    const requestedUrl = details.url || '';
    if (openExternal && isExternalLink(requestedUrl)) {
      report('external-link-opened', { requestedUrl });
      Promise.resolve().then(() => openExternal(requestedUrl)).catch(() => {});
      return { action: 'deny' };
    }
    report('window-open-blocked', { requestedUrl });
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
  attachServiceHeaders,
  attachWebContentsPolicy,
  hardenSession,
  serviceHeaders,
  isAllowedNavigation,
  isExternalLink,
  opensLinksExternally,
  registerTrustedIpcHandler,
  secureWebPreferences,
  toolPartition,
};
