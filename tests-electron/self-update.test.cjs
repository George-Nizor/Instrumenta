'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const test = require('node:test');

const {
  LAUNCHER_ID,
  availableUpdate,
  downloadLauncherUpdate,
  launcherDefinition,
  planLauncherInstall,
  staleLauncherDownloads,
  updateRoute,
} = require('../electron/self-update.cjs');
const { validateReleaseManifest } = require('../electron/release-lifecycle.cjs');
const { installLatestProduct } = require('../electron/release-installer.cjs');
const { refreshReleaseVersions } = require('../electron/update-check.cjs');
const { launcherReleaseFrom } = require('../scripts/product-registry.cjs');
const { launcherUpdateView } = require('../electron/renderer/launcher-model.js');

const repository = { provider: 'github', owner: 'George-Nizor', name: 'Instrumenta', channel: 'stable' };
const digest = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

function launcherManifest(version, setup, overrides = {}) {
  return {
    schemaVersion: 1,
    product: 'instrumenta',
    version,
    platform: 'windows-x64',
    minimumInstrumentaVersion: '0.9.0',
    installStrategy: 'launcher',
    installer: { asset: `Instrumenta-Setup-${version}.exe`, size: setup.length, sha256: digest(setup) },
    ...overrides,
  };
}

function respond(statusCode, body = '') {
  const chunks = body === '' ? [] : [Buffer.from(body)];
  return Object.assign(Readable.from(chunks), { statusCode, headers: {} });
}

test('a launcher release is its own setup program and nothing beside it', () => {
  const setup = Buffer.from('MZ setup');
  const manifest = validateReleaseManifest(launcherManifest('0.10.0', setup), 'instrumenta');
  assert.equal(manifest.installStrategy, 'launcher');
  assert.equal(manifest.installer.sha256, digest(setup));
  assert.equal(manifest.payload, undefined);
  // Only Instrumenta itself is released this way.
  assert.throws(() => validateReleaseManifest({ ...launcherManifest('0.10.0', setup), product: 'forge3d' }), /Only Instrumenta itself/);
  // And no product install path will take it.
  return assert.rejects(installLatestProduct({ id: 'instrumenta', release: { repository } }, {
    latest: { manifest: launcherManifest('0.10.0', setup), tag: 'v0.10.0' }, cacheRoot: os.tmpdir(), installRoot: os.tmpdir(),
  }), /updates itself/);
});

test('only an installed launcher updates itself', () => {
  assert.equal(updateRoute({ packaged: true, platform: 'win32', env: {} }), 'installer');
  assert.equal(updateRoute({ packaged: true, platform: 'win32', env: { PORTABLE_EXECUTABLE_FILE: 'C:\\x.exe' } }), 'portable');
  assert.equal(updateRoute({ packaged: false, platform: 'win32', env: {} }), 'source');
  assert.equal(updateRoute({ packaged: true, platform: 'linux', env: {} }), 'source');
});

test('a newer release is offered, the same or an older one is not, nor a skipped one', () => {
  const setup = Buffer.from('MZ');
  const entry = (version) => ({ version, tag: `v${version}`, manifest: launcherManifest(version, setup) });
  assert.equal(availableUpdate(entry('0.10.0'), '0.9.1').version, '0.10.0');
  assert.equal(availableUpdate(entry('0.9.1'), '0.9.1'), null);
  assert.equal(availableUpdate(entry('0.9.0'), '0.9.1'), null);
  assert.equal(availableUpdate(entry('0.10.0'), '0.9.1', { skipped: ['0.10.0'] }), null);
  assert.equal(availableUpdate({ version: '0.10.0', tag: 'v0.10.0' }, '0.9.1'), null, 'no manifest, nothing to install');
  const bundle = { ...entry('0.10.0'), manifest: { ...launcherManifest('0.10.0', setup), installStrategy: 'managed-bundle', bundle: { asset: 'x.zip', size: 1, sha256: digest(setup), entry: 'x.exe' } } };
  assert.equal(availableUpdate(bundle, '0.9.1'), null, 'a bundle is not a launcher release');
});

test('the launcher shares the version cache with the products', async () => {
  const cacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-self-cache-'));
  try {
    const setup = Buffer.from('MZ');
    const seen = [];
    const { cache } = await refreshReleaseVersions({
      products: [launcherDefinition(repository)],
      cacheRoot,
      fetchLatest: async (product) => { seen.push(product.id); return { manifest: launcherManifest('0.10.0', setup), tag: 'v0.10.0' }; },
    });
    assert.deepEqual(seen, [LAUNCHER_ID]);
    assert.equal(cache[LAUNCHER_ID].version, '0.10.0');
    assert.equal(availableUpdate(cache[LAUNCHER_ID], '0.9.1').tag, 'v0.10.0');
  } finally {
    fs.rmSync(cacheRoot, { recursive: true, force: true });
  }
});

test('the setup program is downloaded, verified, and resumed', async () => {
  const downloadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-self-dl-'));
  try {
    const setup = Buffer.from('MZ this is the setup program');
    const update = { version: '0.10.0', tag: 'v0.10.0', manifest: validateReleaseManifest(launcherManifest('0.10.0', setup), 'instrumenta') };
    const url = 'https://github.com/George-Nizor/Instrumenta/releases/download/v0.10.0/Instrumenta-Setup-0.10.0.exe';
    const transport = async (requested) => (requested.href === url ? respond(200, setup.toString()) : respond(404));
    const file = await downloadLauncherUpdate({ repository, update, downloadsRoot, options: { transport } });
    assert.equal(file, path.join(downloadsRoot, 'instrumenta', '0.10.0', 'Instrumenta-Setup-0.10.0.exe'));
    assert.deepEqual(fs.readFileSync(file), setup);
    // A corrupt download never becomes something to run.
    const tampered = { ...update, version: '0.10.1', manifest: validateReleaseManifest(launcherManifest('0.10.1', setup), 'instrumenta') };
    const bad = async () => respond(200, 'MZ this is not the setup program');
    await assert.rejects(downloadLauncherUpdate({ repository, update: tampered, downloadsRoot, options: { transport: bad } }), /size|SHA-256/);
  } finally {
    fs.rmSync(downloadsRoot, { recursive: true, force: true });
  }
});

test('Restart relaunches; an update applied on quit does not', () => {
  const setup = path.join('C:\\', 'Downloads', 'Instrumenta-Setup-0.10.0.exe');
  const restart = planLauncherInstall(setup, { relaunch: true });
  assert.deepEqual(restart.args, ['/S', '--updated', '--force-run']);
  assert.equal(restart.options.detached, true, 'the setup outlives the launcher it replaces');
  assert.deepEqual(planLauncherInstall(setup).args, ['/S', '--updated']);
});

test('downloads of versions already installed are cleared at start-up', () => {
  const downloadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-self-stale-'));
  try {
    for (const version of ['0.9.1', '0.10.0', '0.11.0']) fs.mkdirSync(path.join(downloadsRoot, 'instrumenta', version), { recursive: true });
    const stale = staleLauncherDownloads(downloadsRoot, '0.10.0').map((dir) => path.basename(dir)).sort();
    assert.deepEqual(stale, ['0.10.0', '0.9.1']);
    assert.deepEqual(staleLauncherDownloads(path.join(downloadsRoot, 'missing'), '0.10.0'), []);
  } finally {
    fs.rmSync(downloadsRoot, { recursive: true, force: true });
  }
});

test('the catalog names the launcher repository, validated like a product one', () => {
  assert.equal(launcherReleaseFrom({}), null);
  assert.deepEqual(launcherReleaseFrom({ launcher: { repository: { provider: 'github', owner: 'George-Nizor', name: 'Instrumenta' } } }).repository.channel, 'stable');
  assert.throws(() => launcherReleaseFrom({ launcher: { repository: { provider: 'gitlab', owner: 'x', name: 'y' } } }), /launcher: repository/);
  const shipped = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'products', 'catalog.json'), 'utf8'));
  assert.equal(launcherReleaseFrom(shipped).repository.name, 'Instrumenta');
});

test('the header says what can be done with a newer launcher, and nothing when there is none', () => {
  assert.equal(launcherUpdateView(null), null);
  assert.equal(launcherUpdateView({ route: 'installer', state: 'none', version: '' }), null);
  assert.equal(launcherUpdateView({ route: 'installer', state: 'available', version: '0.10.0' }).action, 'download');
  assert.equal(launcherUpdateView({ route: 'installer', state: 'downloading', version: '0.10.0', progress: { received: 1, total: 4 } }).label, 'Downloading 0.10.0 · 25%');
  const ready = launcherUpdateView({ route: 'installer', state: 'ready', version: '0.10.0' });
  assert.deepEqual([ready.label, ready.action, ready.tone], ['Restart to update', 'restart', 'ready']);
  assert.equal(launcherUpdateView({ route: 'installer', state: 'failed', version: '0.10.0', error: 'bad' }).action, 'download');
  assert.equal(launcherUpdateView({ route: 'portable', state: 'available', version: '0.10.0' }).action, 'open-release');
  assert.equal(launcherUpdateView({ route: 'source', state: 'available', version: '0.10.0' }).action, null, 'a checkout is git\'s to update');
});
