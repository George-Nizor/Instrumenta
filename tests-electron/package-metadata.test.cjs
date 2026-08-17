'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

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
  assert.match(packageJson.copyright, /Instrumenta/);
});

test('package contents include the hardened runtime and canonical brand', () => {
  assert.ok(packageJson.build.files.includes('electron/**/*'));
  assert.ok(packageJson.build.files.includes('brand/**/*'));
  assert.ok(packageJson.build.files.includes('package.json'));
});
