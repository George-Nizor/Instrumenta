'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

test('release metadata is synchronized at the current suite version', () => {
  assert.equal(packageJson.version, '0.7.0');
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[''].version, packageJson.version);
});

test('Windows executable and shortcuts carry stable Instrumenta identity metadata', () => {
  assert.equal(packageJson.productName, 'Instrumenta');
  assert.equal(packageJson.build.productName, 'Instrumenta');
  assert.equal(packageJson.build.appId, 'com.instrumenta.launcher');
  assert.equal(packageJson.build.executableName, 'Instrumenta');
  assert.equal(packageJson.build.win.icon, 'packaging/icon.svg');
  assert.equal(packageJson.build.win.requestedExecutionLevel, 'asInvoker');
  assert.equal(packageJson.build.nsis.shortcutName, 'Instrumenta');
  assert.equal(packageJson.build.nsis.createDesktopShortcut, true);
  assert.equal(packageJson.build.nsis.createStartMenuShortcut, true);
  assert.equal(packageJson.build.nsis.include, 'packaging/installer.nsh');
  assert.match(packageJson.copyright, /Instrumenta/);
});

test('package contents include the hardened runtime and canonical brand', () => {
  assert.ok(packageJson.build.files.includes('electron/**/*'));
  assert.ok(packageJson.build.files.includes('brand/**/*'));
  assert.ok(packageJson.build.files.includes('package.json'));
  assert.ok(packageJson.build.files.includes('scripts/product-registry.cjs'));
});
