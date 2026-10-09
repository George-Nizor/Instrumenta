'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const test = require('node:test');

const sources = require('../electron/external-sources.cjs');
const library = require('../electron/external-library.cjs');
const { validateReleaseManifest } = require('../electron/release-lifecycle.cjs');
const { readVersionCache, refreshReleaseVersions, releaseCapable } = require('../electron/update-check.cjs');
const { createInstallQueue } = require('../electron/install-queue.cjs');
const { loadCatalog } = require('../scripts/product-registry.cjs');

const root = path.join(__dirname, '..');
const sourcesDirectory = path.join(root, 'products', 'sources');
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');

function temporary() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-library-'));
  return { root: directory, dispose: () => fs.rmSync(directory, { recursive: true, force: true }) };
}

function storytold() {
  return sources.loadSources(sourcesDirectory).find((source) => source.id === 'storytold');
}

function sourceInput(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'example',
    name: 'example',
    owner: 'example',
    licence: 'Apache-2.0',
    release: {
      asset: '{repo}-{version}-windows-x64-portable.zip',
      checksums: 'SHA256SUMS.txt',
      executable: '{repo}-{version}-windows-x64-portable/{repo}.exe',
    },
    apps: [{ id: 'tool', repo: 'tool', name: 'Tool', description: 'Does things.' }],
    ...overrides,
  };
}

// ---- A scripted GitHub, GET and HEAD ---------------------------------------------------------

function respond(statusCode, body = '', headers = {}) {
  const chunks = body === '' ? [] : [Buffer.from(body)];
  return Object.assign(Readable.from(chunks), { statusCode, headers });
}

function scriptedGitHub(routes) {
  const calls = [];
  const answer = (method) => async (url, { headers }) => {
    calls.push({ method, url: url.href, headers });
    const route = routes[`${method} ${url.href}`];
    return route ? route(headers) : respond(404);
  };
  return { transport: answer('GET'), headTransport: answer('HEAD'), calls };
}

const OBJECTS = 'https://release-assets.githubusercontent.com/github-production-release-asset/1/';

// A storytold-shaped release: the redirect to its tag, its checksum file behind GitHub's object
// store, and a HEAD of its Windows archive that ends in a Content-Length.
function publish(routes, { repo, version, archive, extraSums = '', names = [repo], contentLength = true }) {
  const base = `https://github.com/storytold/${repo}/releases`;
  routes[`HEAD ${base}/latest`] = () => respond(302, '', { location: `${base}/tag/v${version}` });
  routes[`HEAD ${base}/tag/v${version}`] = () => respond(200);
  const lines = names.map((name) => `${digest(archive)}  ${name}-${version}-windows-x64-portable.zip`);
  lines.push(`${'1'.repeat(64)}  ${repo}-${version}-windows-arm64-portable.zip`, `${'2'.repeat(64)}  ${repo}-${version}-windows-x64.msi`, `${'3'.repeat(64)}  ${repo}-web-${version}.zip`);
  const sums = `${lines.join('\n')}\n${extraSums}`;
  routes[`GET ${base}/download/v${version}/SHA256SUMS.txt`] = () => respond(302, '', { location: `${OBJECTS}${repo}-sums` });
  routes[`GET ${OBJECTS}${repo}-sums`] = () => respond(200, sums);
  for (const name of names) {
    const asset = `${name}-${version}-windows-x64-portable.zip`;
    routes[`HEAD ${base}/download/v${version}/${asset}`] = () => respond(302, '', { location: `${OBJECTS}${asset}` });
    routes[`HEAD ${OBJECTS}${asset}`] = () => respond(200, '', contentLength ? { 'content-length': String(archive.length) } : {});
    routes[`GET ${base}/download/v${version}/${asset}`] = () => respond(302, '', { location: `${OBJECTS}${asset}.bytes` });
    routes[`GET ${OBJECTS}${asset}.bytes`] = () => respond(200, archive.toString('latin1'));
  }
}

// ---- Source files ----------------------------------------------------------------------------

test('the storytold source lists the twelve Crafting Apps with their credit and licence', () => {
  const source = storytold();
  assert.equal(source.owner, 'storytold');
  assert.equal(source.licence, 'Apache-2.0');
  assert.deepEqual(source.apps.map((app) => app.id), [
    'photocraft', 'vectorcraft', 'filmcraft', 'lightcraft', 'pdfcraft', 'effectcraft',
    'designcraft', 'gridcraft', 'deckcraft', 'cadcraft', 'soundcraft', 'wordcraft',
  ]);
  assert.deepEqual(source.apps.find((app) => app.id === 'pdfcraft').assetNames, ['pdfcraft', 'printcraft']);
  assert.ok(source.apps.every((app) => app.name && app.description && app.repo === app.id));
});

test('a source file is refused when it could name another host, a path, or an ambiguous app', () => {
  const refuse = (overrides, pattern) => assert.throws(() => sources.validateSource(sourceInput(overrides)), pattern);
  refuse({ owner: '../evil' }, /owner/);
  refuse({ owner: 'evil.example.com' }, /owner/);
  refuse({ apps: [{ id: 'tool', repo: '..', name: 'Tool' }] }, /repo/);
  refuse({ apps: [{ id: 'tool', repo: 'a/b', name: 'Tool' }] }, /repo/);
  refuse({ apps: [{ id: 'Tool', repo: 'tool', name: 'Tool' }] }, /id/);
  refuse({ apps: [{ id: 'tool', repo: 'tool', name: '' }] }, /name/);
  refuse({ apps: [{ id: 'tool', repo: 'tool', name: 'Tool', assetNames: ['../x'] }] }, /assetNames/);
  refuse({ apps: [{ id: 'a', repo: 'tool', name: 'A' }, { id: 'a', repo: 'other', name: 'B' }] }, /duplicate app id/);
  refuse({ apps: [{ id: 'a', repo: 'tool', name: 'A' }, { id: 'b', repo: 'TOOL', name: 'B' }] }, /duplicate repository/);
  const release = (change) => ({ release: { ...sourceInput().release, ...change } });
  refuse(release({ asset: '../{repo}-{version}.zip' }), /file-name characters/);
  refuse(release({ asset: '{repo}\\{version}.zip' }), /file-name characters/);
  refuse(release({ asset: '{repo}.zip' }), /\{version\}/);
  refuse(release({ asset: '{repo}-{version}.exe' }), /\.zip/);
  refuse(release({ asset: '{repo}-{version}-%TEMP%.zip' }), /file-name characters/);
  refuse(release({ checksums: '../SHA256SUMS.txt' }), /checksums/);
  refuse(release({ executable: '../{repo}.exe' }), /file-name characters/);
  refuse(release({ executable: '{repo}/../{repo}.exe' }), /one folder and a file name/);
  refuse(release({ executable: 'C:/{repo}.exe' }), /file-name characters/);
  refuse(release({ executable: '{repo}-{version}/{repo}.dll' }), /\.exe/);
  refuse({ licence: 'Apache 2.0; rm -rf' }, /licence/);
  refuse({ schemaVersion: 2 }, /schemaVersion/);
  assert.equal(sources.validateSource(sourceInput()).apps[0].assetNames[0], 'tool');
});

test('app IDs share one namespace across source files, and each file is named for its source', () => {
  const area = temporary();
  try {
    fs.writeFileSync(path.join(area.root, 'example.json'), JSON.stringify(sourceInput()));
    fs.writeFileSync(path.join(area.root, 'other.json'), JSON.stringify(sourceInput({ id: 'other', owner: 'other' })));
    assert.throws(() => sources.loadSources(area.root), /already used by example/);
    fs.rmSync(path.join(area.root, 'other.json'));
    fs.writeFileSync(path.join(area.root, 'misnamed.json'), JSON.stringify(sourceInput({ id: 'third', apps: [{ id: 'x', repo: 'x', name: 'X' }] })));
    assert.throws(() => sources.loadSources(area.root), /file name must be the source id/);
    assert.deepEqual(sources.loadSources(path.join(area.root, 'missing')), []);
  } finally {
    area.dispose();
  }
});

// ---- Release files ---------------------------------------------------------------------------

test('a SHA256SUMS listing is read the way sha256sum writes it, and nothing doubtful is kept', () => {
  const a = 'a'.repeat(64);
  const b = 'B'.repeat(64);
  const listing = [
    `${a}  photocraft-0.5.0-windows-x64-portable.zip`,
    `${b} *photocraft-0.5.0-windows-x64.msi\r`,
    'not a digest  file.zip',
    `${a}  folder/escape.zip`,
    `${a}  ..`,
    `${a}  twice.zip`,
    `${'c'.repeat(64)}  twice.zip`,
    '',
  ].join('\n');
  const parsed = sources.parseChecksums(listing);
  assert.equal(parsed.get('photocraft-0.5.0-windows-x64-portable.zip'), a);
  assert.equal(parsed.get('photocraft-0.5.0-windows-x64.msi'), 'b'.repeat(64), 'binary marker, CRLF and case handled');
  assert.equal(parsed.has('folder/escape.zip'), false);
  assert.equal(parsed.has('..'), false);
  assert.equal(parsed.has('twice.zip'), false, 'two digests for one name verify nothing');
  assert.equal(parsed.size, 2);
});

test('the Windows x64 portable archive is matched by pattern, older names included', () => {
  const source = storytold();
  const app = (id) => source.apps.find((entry) => entry.id === id);
  const sums = (...names) => new Map(names.map((name, index) => [name, String(index).repeat(64).slice(0, 64)]));
  const soundcraft = sums(
    'soundcraft-0.3.0-windows-arm64-portable.zip', 'soundcraft-0.3.0-windows-x86-portable.zip',
    'soundcraft-0.3.0-windows-x64.msi', 'soundcraft-web-0.3.0.zip', 'soundcraft-0.3.0-windows-x64-portable.zip',
  );
  assert.equal(sources.matchAsset(source, app('soundcraft'), soundcraft, 'v0.3.0').asset, 'soundcraft-0.3.0-windows-x64-portable.zip');
  // pdfcraft's older releases were printcraft-*; its current ones are pdfcraft-*.
  const old = sources.matchAsset(source, app('pdfcraft'), sums('printcraft-0.2.0-windows-x64-portable.zip'), 'v0.2.0');
  assert.equal(old.name, 'printcraft');
  assert.equal(old.version, '0.2.0');
  const both = sums('printcraft-0.4.0-windows-x64-portable.zip', 'pdfcraft-0.4.0-windows-x64-portable.zip');
  assert.equal(sources.matchAsset(source, app('pdfcraft'), both, 'v0.4.0').asset, 'pdfcraft-0.4.0-windows-x64-portable.zip');
  // Nothing installable, or nothing unambiguous, is null rather than a guess.
  assert.equal(sources.matchAsset(source, app('pdfcraft'), sums('pdfcraft-0.4.0-windows-arm64-portable.zip'), 'v0.4.0'), null);
  assert.equal(sources.matchAsset(source, app('photocraft'), sums('photocraft-0.4.0-windows-x64-portable.zip', 'photocraft-0.5.0-windows-x64-portable.zip'), 'v0.6.0'), null);
  assert.equal(sources.matchAsset(source, app('photocraft'), sums('photocraft-0.4.0-windows-x64-portable.zip', 'photocraft-0.5.0-windows-x64-portable.zip'), 'v0.5.0').version, '0.5.0');
  assert.equal(sources.matchAsset(source, app('photocraft'), sums('photocraft-0.5.0-windows-x64-portable.zip'), 'release-five').version, '0.5.0', 'a tag that is not v<version>');
});

test('the newest tag is read from where releases/latest redirects, with no REST request', async () => {
  const routes = {};
  publish(routes, { repo: 'soundcraft', version: '0.3.0', archive: Buffer.from('zip') });
  const github = scriptedGitHub(routes);
  assert.equal(await sources.latestTag('storytold', 'soundcraft', github), 'v0.3.0');
  assert.equal(sources.tagFromLatestRedirect(['https://github.com/storytold/x/releases/tag/v1.0.0%2Bbuild'], 'storytold', 'x'), 'v1.0.0+build');
  assert.equal(sources.tagFromLatestRedirect(['https://example.com/storytold/x/releases/tag/v1.0.0'], 'storytold', 'x'), '');

  // A repository with no release is sent to its release list instead: nothing published.
  routes['HEAD https://github.com/storytold/empty/releases/latest'] = () => respond(302, '', { location: 'https://github.com/storytold/empty/releases' });
  routes['HEAD https://github.com/storytold/empty/releases'] = () => respond(200);
  await assert.rejects(sources.latestTag('storytold', 'empty', github), (error) => error.code === 'NO_RELEASE');
  await assert.rejects(sources.latestTag('storytold', 'missing', github), (error) => error.code === 'NO_RELEASE');
  routes['HEAD https://github.com/storytold/busy/releases/latest'] = () => respond(429, '', { 'retry-after': '60' });
  await assert.rejects(sources.latestTag('storytold', 'busy', github), (error) => error.code === 'RATE_LIMITED' && error.blockedUntil > Date.now());
  assert.ok(github.calls.every(({ url }) => !url.includes('api.github.com')));
});

test('a synthesised manifest passes validateReleaseManifest and lifts the archive folder out', async () => {
  const source = storytold();
  const archive = Buffer.from('pretend soundcraft zip');
  const routes = {};
  publish(routes, { repo: 'soundcraft', version: '0.3.0', archive });
  const github = scriptedGitHub(routes);
  const latest = await sources.resolveLatest(source, source.apps.find((app) => app.id === 'soundcraft'), github);
  assert.equal(latest.tag, 'v0.3.0');
  assert.equal(latest.root, 'soundcraft-0.3.0-windows-x64-portable');
  assert.deepEqual(latest.manifest.bundle, {
    asset: 'soundcraft-0.3.0-windows-x64-portable.zip', size: archive.length, sha256: digest(archive), entry: 'soundcraft.exe',
  });
  assert.deepEqual(validateReleaseManifest(latest.manifest, 'soundcraft'), latest.manifest);
  assert.equal(sources.archiveRootFor(source, source.apps.find((app) => app.id === 'soundcraft'), latest.manifest), latest.root);
  assert.ok(github.calls.every(({ url }) => !url.includes('api.github.com')), 'size came from a HEAD, not the API');
  assert.ok(github.calls.some(({ method, url }) => method === 'HEAD' && url.startsWith(OBJECTS)), 'the HEAD followed GitHub to its object store');
});

test('the asset size falls back to the REST asset list when the HEAD has none', async () => {
  const source = storytold();
  const archive = Buffer.from('zip bytes');
  const routes = {};
  publish(routes, { repo: 'pdfcraft', version: '0.2.0', archive, names: ['printcraft'], contentLength: false });
  routes['GET https://api.github.com/repos/storytold/pdfcraft/releases/tags/v0.2.0'] = () => respond(200, JSON.stringify({
    assets: [{ name: 'printcraft-0.2.0-windows-x64-portable.zip', size: archive.length }],
  }));
  const github = scriptedGitHub(routes);
  const app = source.apps.find((entry) => entry.id === 'pdfcraft');
  const latest = await sources.resolveLatest(source, app, github);
  assert.equal(latest.manifest.bundle.size, archive.length);
  assert.equal(latest.manifest.bundle.entry, 'printcraft.exe');
  assert.equal(latest.root, 'printcraft-0.2.0-windows-x64-portable');
  assert.equal(sources.archiveRootFor(source, app, latest.manifest), 'printcraft-0.2.0-windows-x64-portable');
  assert.equal(github.calls.filter(({ url }) => url.includes('api.github.com')).length, 1);
});

test('a release with no Windows archive is "no installable release", cached, never a crash', async () => {
  const area = temporary();
  try {
    const source = storytold();
    const routes = {};
    const base = 'https://github.com/storytold/gridcraft/releases';
    routes[`HEAD ${base}/latest`] = () => respond(302, '', { location: `${base}/tag/v0.3.0` });
    routes[`HEAD ${base}/tag/v0.3.0`] = () => respond(200);
    routes[`GET ${base}/download/v0.3.0/SHA256SUMS.txt`] = () => respond(200, `${'d'.repeat(64)}  gridcraft-0.3.0-linux-x86_64.tar.gz\n`);
    const github = scriptedGitHub(routes);
    const app = source.apps.find((entry) => entry.id === 'gridcraft');
    await assert.rejects(sources.resolveLatest(source, app, github), (error) => error.code === 'NO_RELEASE' && /no Windows x64 portable build/.test(error.message));
    const definition = library.definitionFor({ ...app, source });
    assert.equal(definition.adapter, 'external-portable');
    assert.equal(releaseCapable(definition), true, 'an external app is polled like a release-backed product');
    const result = await refreshReleaseVersions({ products: [definition], cacheRoot: area.root, fetchLatest: () => sources.resolveLatest(source, app, github) });
    assert.deepEqual(result.checked, ['gridcraft']);
    assert.equal(readVersionCache(area.root).gridcraft.version, '');
  } finally {
    area.dispose();
  }
});

// ---- Locations -------------------------------------------------------------------------------

test('the library defaults beside the launcher\'s products folder and keeps its own cache', () => {
  const layout = library.libraryLayout({ installRoot: '/data/Instrumenta/products', downloadsRoot: '/data/Instrumenta/downloads', updateCacheRoot: '/data/Instrumenta/update-cache' });
  assert.deepEqual(layout, {
    defaultRoot: '/data/Instrumenta/library',
    cacheRoot: '/data/Instrumenta/update-cache/library',
    downloadsRoot: '/data/Instrumenta/downloads/library',
  });
  assert.equal(library.currentLocation({}, layout, 'linux'), '/data/Instrumenta/library');
  assert.equal(library.currentLocation({ library: { location: '/apps/lib' } }, layout, 'linux'), '/apps/lib');
  assert.equal(library.currentLocation({ library: { location: 'relative/lib' } }, layout, 'linux'), '/data/Instrumenta/library', 'a relative location is ignored');
  // Windows paths are judged as Windows paths.
  const windows = library.librarySettings({ library: { location: 'D:\\Apps\\Library', apps: { photocraft: { root: 'relative' }, Bad: {} } } }, 'win32');
  assert.equal(windows.location, 'D:\\Apps\\Library');
  assert.equal(windows.apps.photocraft.root, undefined);
  assert.equal(windows.apps.Bad, undefined);
});

test('a new location may not be one of the launcher\'s own folders, a drive, or inside an app', () => {
  const forbidden = ['C:\\Users\\me\\AppData\\Local\\Instrumenta\\products', 'C:\\Users\\me\\AppData\\Local\\Instrumenta\\downloads'];
  const check = (candidate, extra = {}) => library.validateLocation(candidate, { forbidden, platform: 'win32', ...extra });
  assert.equal(check('D:\\Apps\\Library'), 'D:\\Apps\\Library');
  assert.throws(() => check('c:\\users\\me\\appdata\\local\\instrumenta\\products\\more'), /keeps for itself/, 'case does not hide a forbidden folder');
  assert.throws(() => check('C:\\Users\\me\\AppData\\Local\\Instrumenta'), /keeps for itself/, 'nor does holding one');
  assert.throws(() => check('D:\\'), /top of a drive/);
  assert.throws(() => check('Apps\\Library'), /full path/);
  assert.throws(() => check('D:\\Apps\\Library\\photocraft\\inner', { appFolders: ['D:\\Apps\\Library\\photocraft'] }), /inside an installed app/);
  assert.equal(check('C:\\Users\\me\\AppData\\Local\\Instrumenta\\library'), 'C:\\Users\\me\\AppData\\Local\\Instrumenta\\library');
});

test('changing the location pins what is installed and remembers the old location', () => {
  const layout = { defaultRoot: '/local/library', cacheRoot: '/local/cache', downloadsRoot: '/local/downloads' };
  let settings = { autoUpdate: true, workspace: '/w' };
  settings = library.changeLocation(settings, '/d/apps', { installed: { photocraft: '/local/library' }, layout, platform: 'linux' });
  assert.equal(settings.workspace, '/w', 'the rest of settings.json is left alone');
  assert.equal(settings.library.location, '/d/apps');
  assert.equal(settings.library.apps.photocraft.root, '/local/library');
  assert.deepEqual(settings.library.previousLocations, ['/local/library']);
  assert.deepEqual(library.candidateRoots(settings, layout, 'photocraft', 'linux'), ['/local/library', '/d/apps']);
  assert.deepEqual(library.candidateRoots(settings, layout, 'soundcraft', 'linux'), ['/d/apps', '/local/library']);
  settings = library.changeLocation(settings, '', { installed: {}, layout, platform: 'linux' });
  assert.equal(settings.library.location, undefined, 'back to the default');
  assert.deepEqual(settings.library.previousLocations, ['/local/library', '/d/apps']);
});

test('an installed copy is found again from a remembered location even with its record lost', () => {
  const area = temporary();
  try {
    const old = path.join(area.root, 'old');
    const version = path.join(old, 'soundcraft', 'versions', '0.3.0');
    fs.mkdirSync(version, { recursive: true });
    fs.writeFileSync(path.join(version, 'soundcraft.exe'), 'exe');
    const manifest = { schemaVersion: 1, product: 'soundcraft', version: '0.3.0', platform: 'windows-x64', minimumInstrumentaVersion: '0.0.0', installStrategy: 'managed-bundle', bundle: { asset: 'a.zip', size: 1, sha256: 'a'.repeat(64), entry: 'soundcraft.exe' } };
    fs.writeFileSync(path.join(version, 'instrumenta-release.json'), JSON.stringify(manifest));
    fs.writeFileSync(path.join(old, 'soundcraft', 'current.json'), JSON.stringify({ current: '0.3.0', previous: '', pending: false }));
    const layout = { defaultRoot: path.join(area.root, 'default') };
    const settings = { library: { location: path.join(area.root, 'new'), previousLocations: [old], apps: {} } };
    const found = library.locateInstall('soundcraft', library.candidateRoots(settings, layout, 'soundcraft'));
    assert.equal(found.root, old);
    assert.equal(found.install.version, '0.3.0');
    assert.equal(library.locateInstall('soundcraft', [old], { forbidden: [area.root] }), null, 'never inside a forbidden folder');
  } finally {
    area.dispose();
  }
});

test('an archive without its expected top-level folder is refused', async () => {
  const area = temporary();
  try {
    const destination = path.join(area.root, 'extracted');
    await assert.rejects(library.extractPortable('archive.zip', destination, {
      root: 'tool-1.0.0-windows-x64-portable',
      extract: async (_archive, target) => { fs.mkdirSync(path.join(target, 'something-else'), { recursive: true }); },
    }), /does not hold the tool-1\.0\.0-windows-x64-portable folder/);
    assert.equal(fs.existsSync(destination), false);
    assert.equal(fs.existsSync(`${destination}.archive`), false, 'the staging folder is cleaned up');
  } finally {
    area.dispose();
  }
});

// ---- The whole path ------------------------------------------------------------------------

function fakeChild() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.killed = false;
  setImmediate(() => child.emit('spawn'));
  return child;
}

function harness(area, routes) {
  const github = scriptedGitHub(routes);
  const local = path.join(area.root, 'Local', 'Instrumenta');
  const state = { settings: { autoUpdate: true }, notified: 0, spawned: [], trashed: [], confirm: true, chosen: '' };
  let controller;
  const queue = createInstallQueue({ run: (job, report) => controller.runJob(job, report) });
  controller = library.createExternalLibrary({
    sourcesDirectory,
    platform: process.platform,
    storage: () => ({ installRoot: path.join(local, 'products'), downloadsRoot: path.join(local, 'downloads'), updateCacheRoot: path.join(local, 'update-cache') }),
    getSettings: () => state.settings,
    setSettings: (next) => { state.settings = next; },
    queue,
    launcherVersion: '0.11.2',
    network: { transport: github.transport, headTransport: github.headTransport },
    ttl: 60 * 60 * 1000,
    livenessMs: 20,
    extract: async (archive, target) => {
      // Stands in for Expand-Archive: the zip's one folder, holding the executable and its notices.
      const name = path.basename(archive).replace(/\.zip$/, '');
      const app = name.split('-')[0];
      fs.mkdirSync(path.join(target, name), { recursive: true });
      fs.writeFileSync(path.join(target, name, `${app}.exe`), fs.readFileSync(archive));
      fs.writeFileSync(path.join(target, name, 'LICENSE-APACHE'), 'licence');
    },
    confirm: async () => state.confirm,
    chooseFolder: async () => state.chosen,
    openPath: async () => '',
    openExternal: async (url) => { state.opened = url; },
    trashItem: async (folder) => { state.trashed.push(folder); fs.rmSync(folder, { recursive: true, force: true }); },
    assertTrustedExecutable: (executable, roots) => {
      assert.ok(roots.some((rootFolder) => executable.startsWith(rootFolder)), 'launched only from its own folder');
      return executable;
    },
    spawnExecutable: (executable) => {
      const child = fakeChild();
      state.spawned.push({ executable, child });
      return child;
    },
    notify: () => { state.notified += 1; },
  });
  return { controller, state, github, local, queue };
}

test('an external app installs through the verified path into the library, updates, opens, moves and uninstalls', async () => {
  const area = temporary();
  try {
    const routes = {};
    const v1 = Buffer.from('soundcraft 0.3.0');
    publish(routes, { repo: 'soundcraft', version: '0.3.0', archive: v1 });
    const { controller, state, github, local } = harness(area, routes);
    const defaultRoot = path.join(local, 'library');

    await controller.install(['soundcraft']);
    const app = (snapshot) => snapshot.apps.find((entry) => entry.id === 'soundcraft');
    let snapshot = await controller.state();
    assert.equal(snapshot.location.path, defaultRoot);
    assert.equal(snapshot.location.isDefault, true);
    assert.equal(app(snapshot).installed, true);
    assert.equal(app(snapshot).installedVersion, '0.3.0');
    assert.equal(app(snapshot).credit, 'by storytold \u00b7 Apache-2.0');
    assert.equal(app(snapshot).repository, 'github.com/storytold/soundcraft');
    assert.equal(app(snapshot).folder, path.join(defaultRoot, 'soundcraft'));
    assert.equal(app(snapshot).versionFolder, path.join(defaultRoot, 'soundcraft', 'versions', '0.3.0'));
    assert.equal(app(snapshot).executable, path.join(defaultRoot, 'soundcraft', 'versions', '0.3.0', 'soundcraft.exe'), 'the archive folder was lifted out');
    assert.ok(fs.existsSync(path.join(defaultRoot, 'soundcraft', 'versions', '0.3.0', 'LICENSE-APACHE')));
    assert.ok(app(snapshot).bytes > 0, 'its size on disk is measured');
    assert.equal(snapshot.total, app(snapshot).bytes);
    assert.equal(state.settings.library.apps.soundcraft.root, defaultRoot, 'where it went is recorded');
    assert.equal(fs.existsSync(path.join(local, 'downloads', 'library', 'soundcraft')), false, 'the download is cleared once installed');
    assert.ok(github.calls.every(({ url }) => !url.includes('api.github.com')));
    assert.ok(!fs.existsSync(path.join(local, 'products', 'soundcraft')), 'nothing lands among the suite products');

    // The first launch is judged by the process staying up.
    await controller.open('soundcraft');
    assert.equal((await controller.state()).apps.find((entry) => entry.id === 'soundcraft').pending, false);

    // A newer release is installed automatically once the check sees it.
    const v2 = Buffer.from('soundcraft 0.3.1, longer');
    publish(routes, { repo: 'soundcraft', version: '0.3.1', archive: v2 });
    await controller.checkUpdates({ force: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    while (controller.isRunning('soundcraft')) state.spawned.at(-1).child.emit('exit', 0);
    for (let tries = 0; tries < 50 && (await controller.state()).apps.find((entry) => entry.id === 'soundcraft').installedVersion !== '0.3.1'; tries += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    snapshot = await controller.state();
    assert.equal(app(snapshot).installedVersion, '0.3.1');
    assert.equal(app(snapshot).previous, '0.3.0', 'the previous version is kept for rolling back');

    // A first launch that fails goes back to the previous version and is not offered again.
    const opening = controller.open('soundcraft');
    await new Promise((resolve) => setImmediate(resolve));
    const child = state.spawned.at(-1).child;
    child.exitCode = 3;
    child.emit('exit', 3);
    await assert.rejects(opening, /went back to 0\.3\.0/);
    snapshot = await controller.state();
    assert.equal(app(snapshot).installedVersion, '0.3.0');
    assert.deepEqual(state.settings.library.apps.soundcraft.skippedVersions, ['0.3.1']);
    assert.equal(app(snapshot).updateAvailable, false, 'a version rolled back from is not offered');

    // A new location applies to new installs; the installed app stays and is still found.
    const elsewhere = path.join(area.root, 'D', 'Apps');
    state.chosen = elsewhere;
    await controller.location('choose');
    const v3 = Buffer.from('wordcraft');
    publish(routes, { repo: 'wordcraft', version: '0.3.0', archive: v3 });
    await controller.install('wordcraft');
    snapshot = await controller.state();
    assert.equal(snapshot.location.path, elsewhere);
    assert.equal(app(snapshot).folder, path.join(defaultRoot, 'soundcraft'));
    assert.equal(app(snapshot).elsewhere, true);
    assert.equal(snapshot.apps.find((entry) => entry.id === 'wordcraft').folder, path.join(elsewhere, 'wordcraft'));
    // Losing the record still finds it, in the location remembered from before the change.
    delete state.settings.library.apps.soundcraft.root;
    assert.equal(app(await controller.state()).folder, path.join(defaultRoot, 'soundcraft'));

    // The launcher's own folders are refused as a location.
    state.chosen = path.join(local, 'products');
    await assert.rejects(controller.location('choose'), /keeps for itself/);

    // Uninstalling moves the app's folder to the Recycle Bin and nothing else.
    assert.equal(await controller.uninstall('soundcraft'), true);
    assert.deepEqual(state.trashed, [path.join(defaultRoot, 'soundcraft')]);
    snapshot = await controller.state();
    assert.equal(app(snapshot).installed, false);
    assert.equal(state.settings.library.apps.soundcraft.root, undefined);
    assert.ok(fs.existsSync(path.join(elsewhere, 'wordcraft')), 'other apps are untouched');

    await controller.openRepository('wordcraft');
    assert.equal(state.opened, 'https://github.com/storytold/wordcraft');
    await assert.rejects(Promise.resolve().then(() => controller.open('../evil')), /Unknown library app/);
  } finally {
    area.dispose();
  }
});

test('a tampered download is never installed', async () => {
  const area = temporary();
  try {
    const routes = {};
    publish(routes, { repo: 'cadcraft', version: '0.3.0', archive: Buffer.from('the real archive') });
    // Same length, different bytes: the size check passes and the SHA-256 must not.
    routes[`GET ${OBJECTS}cadcraft-0.3.0-windows-x64-portable.zip.bytes`] = () => respond(200, 'the fake archive');
    const { controller, local } = harness(area, routes);
    await assert.rejects(controller.install('cadcraft'), /SHA-256/);
    assert.equal(fs.existsSync(path.join(local, 'library', 'cadcraft', 'versions')), false);
  } finally {
    area.dispose();
  }
});

// ---- Discovery -------------------------------------------------------------------------------

test('discovery suggests only unlisted, licensed, original repositories with a Windows build', async () => {
  const source = storytold();
  const repos = [
    { name: 'photocraft', license: { spdx_id: 'Apache-2.0' } },
    { name: 'artcraft', license: { spdx_id: 'NOASSERTION' } },
    { name: 'forked', fork: true, license: { spdx_id: 'Apache-2.0' } },
    { name: 'old', archived: true, license: { spdx_id: 'Apache-2.0' } },
    { name: 'craft-fonts', license: { spdx_id: 'Apache-2.0' }, description: 'Fonts\u0007 for the apps' },
    { name: 'newcraft', license: { spdx_id: 'Apache-2.0' }, description: 'Something new.', pushed_at: '2026-10-08T00:00:00Z' },
    { name: 'dismissed', license: { spdx_id: 'Apache-2.0' } },
    { name: '../evil', license: { spdx_id: 'Apache-2.0' } },
  ];
  const candidates = sources.discoveryCandidates(source, repos, { dismissed: ['dismissed'] });
  assert.deepEqual(candidates.map((candidate) => candidate.repo), ['newcraft', 'craft-fonts']);
  assert.equal(candidates[1].description, 'Fonts for the apps', 'control characters are stripped');

  const area = temporary();
  try {
    const routes = {};
    routes['GET https://api.github.com/users/storytold/repos?per_page=100&sort=pushed'] = () => respond(200, JSON.stringify(repos));
    publish(routes, { repo: 'newcraft', version: '0.1.0', archive: Buffer.from('new') });
    const github = scriptedGitHub(routes);
    const run = (now) => sources.refreshDiscovery({ sources: [source], cacheRoot: area.root, dismissed: { storytold: ['dismissed'] }, now, ttl: 6 * 60 * 60 * 1000, options: github });
    await run(1_000_000);
    assert.deepEqual(sources.cachedSuggestions(area.root, 'storytold').map((item) => [item.repo, item.version]), [['newcraft', '0.1.0']], 'craft-fonts has no release, so it is not suggested');
    const asked = github.calls.length;
    await run(1_000_000 + 60_000);
    assert.equal(github.calls.length, asked, 'the repository list is asked at most once per cache window');
    assert.equal(github.calls.filter(({ url }) => url.includes('api.github.com')).length, 1);

    // Adding a suggestion lists it like a curated app; nothing is installed.
    const settings = { library: { added: { storytold: [{ repo: 'newcraft', name: 'Newcraft', description: 'Something new.' }, { repo: '../evil' }] } } };
    const apps = library.libraryApps([source], settings);
    const added = apps.find((app) => app.id === 'newcraft');
    assert.equal(added.discovered, true);
    assert.equal(added.source.id, 'storytold');
    assert.equal(apps.length, source.apps.length + 1, 'an unsafe added entry is ignored');
  } finally {
    area.dispose();
  }
});

// ---- The suite is unchanged ----------------------------------------------------------------

test('the suite catalog and its validation are untouched by the library', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'products', 'catalog.json'), 'utf8'));
  const appIds = new Set(storytold().apps.map((app) => app.id));
  assert.ok(catalog.products.every((entry) => !appIds.has(entry.id) && entry.adapter !== 'external-portable'));
  assert.deepEqual(loadCatalog({ allowMissing: true }).order, catalog.products.map((entry) => entry.id));

  // external-portable is a library adapter, never a catalog one.
  const area = temporary();
  try {
    const launcher = path.join(area.root, 'Instrumenta');
    fs.mkdirSync(path.join(launcher, 'products'), { recursive: true });
    fs.writeFileSync(path.join(launcher, 'products', 'catalog.json'), JSON.stringify({
      schemaVersion: 2,
      products: [{
        id: 'photocraft', name: 'PhotoCraft', sourceDirectory: '../PhotoCraft', adapter: 'external-portable',
        repository: { provider: 'github', owner: 'storytold', name: 'photocraft', channel: 'stable' },
        packagePolicy: 'optional', tile: { art: 'brand/artwork/x.png' },
      }],
    }));
    assert.throws(() => loadCatalog({ root: launcher, allowMissing: true }), /unsupported adapter external-portable/);
  } finally {
    area.dispose();
  }
});

test('the library page calls only what preload exposes, and main handles every library channel', () => {
  const electron = path.join(root, 'electron');
  const preload = fs.readFileSync(path.join(electron, 'preload.cjs'), 'utf8');
  const main = fs.readFileSync(path.join(electron, 'main.cjs'), 'utf8');
  const page = fs.readFileSync(path.join(electron, 'renderer', 'library.js'), 'utf8');
  const exposed = new Set([...preload.matchAll(/^\s{2}([a-zA-Z]+): /gm)].map((match) => match[1]));
  const called = [...page.matchAll(/api\.([a-zA-Z]+)\??\.?\(/g)].map((match) => match[1]);
  assert.ok(called.length > 8);
  assert.deepEqual(called.filter((name) => !exposed.has(name)), []);
  for (const channel of [...preload.matchAll(/'(instrumenta:library[a-z-]*)'/g)].map((match) => match[1])) {
    if (channel === 'instrumenta:library' && !main.includes("handleLauncher('instrumenta:library',")) assert.fail('instrumenta:library is not handled');
    if (channel !== 'instrumenta:library') assert.ok(main.includes(`handleLauncher('${channel}'`), channel);
  }
  // The page draws no Instrumenta glyph for these apps.
  assert.doesNotMatch(page, /InstrumentaIcons|icons\.render/);
});
