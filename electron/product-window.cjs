'use strict';

const fs = require('node:fs');
const path = require('node:path');

// A web product's window lives in the launcher's process, so by default Windows groups it under
// Instrumenta's taskbar button with Instrumenta's icon. Giving the window its own AppUserModelID
// and icon makes the shell treat it as a separate program, the way Fabula's own executable is.
const OPEN_PRODUCT_FLAG = '--open-product=';
const PRODUCT_ID = /^[a-z][a-z0-9-]*$/;

function productAppId(id) {
  return `com.instrumenta.product.${id}`;
}

// The shell reads the icon itself, so it must be a real file: inside a packaged launcher that is
// the app.asar.unpacked copy (`asarUnpack` in package.json), never a path into app.asar.
function productIconPath(id, appRoot, extension = 'ico') {
  const folder = extension === 'ico' ? 'ico' : 'png';
  const file = extension === 'ico' ? `${id}.ico` : `${id}-256.png`;
  const relative = path.join('brand', 'icons', folder, file);
  const candidates = [path.join(appRoot.replace(/app\.asar$/, 'app.asar.unpacked'), relative), path.join(appRoot, relative)];
  return candidates.find((candidate) => {
    try { return fs.statSync(candidate).isFile(); } catch { return false; }
  }) || '';
}

function quoteArgument(value) {
  return `"${String(value).replace(/"/g, '')}"`;
}

// What the window tells the shell about itself. `relaunchCommand` is what a pinned taskbar icon
// runs: the launcher, asked to open this product directly.
function productWindowIdentity(definition, { appRoot, execPath, isPackaged, appPath = '' }) {
  const id = definition?.id;
  if (!id || !PRODUCT_ID.test(id)) return null;
  const displayName = definition.displayName || id;
  const launch = isPackaged ? [quoteArgument(execPath)] : [quoteArgument(execPath), quoteArgument(appPath || appRoot)];
  return {
    appId: productAppId(id),
    displayName,
    windowIcon: productIconPath(id, appRoot, 'png') || productIconPath(id, appRoot, 'ico'),
    appIconPath: productIconPath(id, appRoot, 'ico'),
    relaunchCommand: [...launch, `${OPEN_PRODUCT_FLAG}${id}`].join(' '),
  };
}

function applyProductWindowIdentity(window, identity, platform = process.platform) {
  if (!identity || platform !== 'win32' || typeof window.setAppDetails !== 'function') return;
  window.setAppDetails({
    appId: identity.appId,
    ...(identity.appIconPath ? { appIconPath: identity.appIconPath, appIconIndex: 0 } : {}),
    relaunchCommand: identity.relaunchCommand,
    relaunchDisplayName: identity.displayName,
  });
}

function requestedProduct(argv = []) {
  for (const argument of argv) {
    if (typeof argument !== 'string' || !argument.startsWith(OPEN_PRODUCT_FLAG)) continue;
    const id = argument.slice(OPEN_PRODUCT_FLAG.length);
    if (PRODUCT_ID.test(id)) return id;
  }
  return '';
}

module.exports = {
  OPEN_PRODUCT_FLAG,
  applyProductWindowIdentity,
  productAppId,
  productIconPath,
  productWindowIdentity,
  requestedProduct,
};
