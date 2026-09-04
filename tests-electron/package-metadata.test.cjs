'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const installerNsh = fs.readFileSync(path.join(root, 'packaging', 'installer.nsh'), 'utf8');

test('release metadata is synchronized at the current suite version', () => {
  assert.equal(packageJson.version, '0.9.1');
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[''].version, packageJson.version);
});

test('Windows executable and shortcuts carry stable Instrumenta identity metadata', () => {
  assert.equal(packageJson.productName, 'Instrumenta');
  assert.equal(packageJson.build.productName, 'Instrumenta');
  assert.equal(packageJson.build.appId, 'com.instrumenta.launcher');
  assert.equal(packageJson.build.executableName, 'Instrumenta');
  assert.equal(packageJson.build.win.icon, 'packaging/icon.png');
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

test('silent upgrades cannot block on the interactive replacement prompt', () => {
  const silentGuard = installerNsh.indexOf('IfSilent instrumenta_upgrade_check_done');
  const prompt = installerNsh.indexOf('MessageBox MB_YESNO|MB_ICONQUESTION');
  const done = installerNsh.indexOf('instrumenta_upgrade_check_done:');
  assert.ok(silentGuard >= 0 && prompt > silentGuard, 'silent mode must branch around the upgrade prompt');
  assert.ok(done > prompt, 'the silent-mode target must follow every interactive prompt');
});
