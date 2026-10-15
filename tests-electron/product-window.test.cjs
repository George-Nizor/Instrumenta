'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  applyProductWindowIdentity,
  productAppId,
  productWindowIdentity,
  requestedProduct,
} = require('../electron/product-window.cjs');

const appRoot = path.join(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(appRoot, 'products', 'catalog.json'), 'utf8'));
const webAdapters = new Set(['web-service', 'managed-web', 'managed-service', 'web-vite', 'web-static']);

test('every web product gets its own taskbar identity and icon', () => {
  const webProducts = catalog.products.filter((product) => webAdapters.has(product.adapter));
  assert.ok(webProducts.length >= 4, 'expected the web products in the catalog');
  const appIds = new Set();
  for (const product of webProducts) {
    const identity = productWindowIdentity(product, { appRoot, execPath: 'C:\\Instrumenta\\Instrumenta.exe', isPackaged: true });
    assert.equal(identity.appId, productAppId(product.id));
    assert.notEqual(identity.appId, 'com.instrumenta.launcher', `${product.id} must not share the launcher's taskbar group`);
    assert.ok(identity.appIconPath.endsWith(`${product.id}.ico`), `${product.id} has an .ico for the taskbar`);
    assert.ok(identity.windowIcon, `${product.id} has a window icon`);
    assert.equal(identity.relaunchCommand, `"C:\\Instrumenta\\Instrumenta.exe" --open-product=${product.id}`);
    appIds.add(identity.appId);
  }
  assert.equal(appIds.size, webProducts.length);
});

test('a source run relaunches through Electron with the app path', () => {
  const identity = productWindowIdentity({ id: 'imago', displayName: 'Imago' }, {
    appRoot, appPath: '/work/Instrumenta', execPath: '/work/electron', isPackaged: false,
  });
  assert.equal(identity.relaunchCommand, '"/work/electron" "/work/Instrumenta" --open-product=imago');
});

test('the packaged icon is read from the unpacked copy beside app.asar', () => {
  const unpacked = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'product-window-'));
  try {
    const icoFolder = path.join(unpacked, 'app.asar.unpacked', 'brand', 'icons', 'ico');
    fs.mkdirSync(icoFolder, { recursive: true });
    fs.writeFileSync(path.join(icoFolder, 'ludere.ico'), '');
    const identity = productWindowIdentity({ id: 'ludere' }, {
      appRoot: path.join(unpacked, 'app.asar'), execPath: 'Instrumenta.exe', isPackaged: true,
    });
    assert.equal(identity.appIconPath, path.join(icoFolder, 'ludere.ico'));
  } finally {
    fs.rmSync(unpacked, { recursive: true, force: true });
  }
});

test('setAppDetails is applied only on Windows', () => {
  const calls = [];
  const window = { setAppDetails: (details) => calls.push(details) };
  const identity = productWindowIdentity({ id: 'discere', displayName: 'Discere' }, { appRoot, execPath: 'x', isPackaged: true });
  applyProductWindowIdentity(window, identity, 'linux');
  assert.equal(calls.length, 0);
  applyProductWindowIdentity(window, identity, 'win32');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].appId, 'com.instrumenta.product.discere');
  assert.equal(calls[0].relaunchDisplayName, 'Discere');
  assert.equal(calls[0].appIconIndex, 0);
});

test('--open-product accepts only a product ID', () => {
  assert.equal(requestedProduct(['Instrumenta.exe', '--open-product=learnchess']), 'learnchess');
  assert.equal(requestedProduct(['Instrumenta.exe']), '');
  assert.equal(requestedProduct(['--open-product=../evil']), '');
  assert.equal(requestedProduct(['--open-product=Imago']), '');
  assert.equal(productWindowIdentity({ id: '../x' }, { appRoot, execPath: 'x', isPackaged: true }), null);
});
