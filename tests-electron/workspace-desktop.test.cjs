'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { installManagedDirectory } = require('../electron/release-lifecycle.cjs');
const { productState } = require('../electron/workspace.cjs');

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');

test('a managed bundle is available before installation and ready after atomic activation', () => {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-forge-state-'));
  try {
    const product = {
      id: 'forge3d',
      displayName: 'Forge3D',
      version: '0.2.0',
      adapter: 'managed-bundle',
      kind: 'native',
      sourceRoot: '',
      launch: { candidates: [] },
      release: { repository: { provider: 'github', owner: 'George-Nizor', name: 'Forge3D' } },
      catalog: { packagePolicy: 'optional', tile: { theme: 'forge3d' } },
    };
    assert.equal(productState(product, '', '', path.join(area, 'products')).state, 'AVAILABLE');
    const source = path.join(area, 'source');
    fs.mkdirSync(source);
    const executable = Buffer.from('forge');
    fs.writeFileSync(path.join(source, 'Forge3D.exe'), executable);
    installManagedDirectory({
      sourceRoot: source,
      installRoot: path.join(area, 'products'),
      manifest: {
        schemaVersion: 1,
        product: 'forge3d',
        version: '0.2.0',
        platform: 'windows-x64',
        minimumInstrumentaVersion: '0.8.0',
        installStrategy: 'managed-bundle',
        bundle: {
          asset: 'Forge3D.zip',
          size: executable.length,
          sha256: digest(executable),
          entry: 'Forge3D.exe',
        },
      },
    });
    const state = productState(product, '', '', path.join(area, 'products'));
    assert.equal(state.ready, true);
    assert.equal(state.installedVersion, '0.2.0');
    assert.equal(state.pending, true);
    assert.equal(state.canUninstall, true);
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});

test('an installed desktop product expands its declared local application path', () => {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-luna-state-'));
  const old = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = area;
  try {
    const executable = path.join(area, 'Programs', 'Luna', 'Luna.exe');
    fs.mkdirSync(path.dirname(executable), { recursive: true });
    fs.writeFileSync(executable, 'luna');
    const state = productState({
      id: 'luna',
      displayName: 'Luna',
      version: '0.3.0',
      adapter: 'installed-desktop',
      kind: 'native',
      sourceRoot: '',
      launch: { candidates: ['%LOCALAPPDATA%\\Programs\\Luna\\Luna.exe'] },
      release: { repository: { provider: 'github', owner: 'George-Nizor', name: 'Luna' } },
      catalog: { packagePolicy: 'optional' },
    }, '', '', path.join(area, 'products'));
    assert.equal(state.ready, true);
    assert.equal(state.location, executable);
    assert.equal(state.canUninstall, true);
  } finally {
    if (old === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = old;
    fs.rmSync(area, { recursive: true, force: true });
  }
});
