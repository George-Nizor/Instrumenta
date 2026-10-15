'use strict';

// managed-service: a web-service product (a server the launcher starts and health-polls) that is
// installed from its own GitHub release like managed-web, instead of run from a checkout.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const test = require('node:test');
const { loadRegistry, productDefinitions, productState } = require('../electron/workspace.cjs');
const {
  installManagedDirectory,
  readPointer,
  resolveManagedInstall,
  rollbackManagedVersion,
  validateReleaseManifest,
} = require('../electron/release-lifecycle.cjs');
const { installLatestProduct } = require('../electron/release-installer.cjs');
const { lifecycleBlocker, rollbackAfterFailedOpen, supportsRollback } = require('../electron/lifecycle-policy.cjs');
const { pickPort, planServiceSpawn, serviceLaunchPlan, startService } = require('../electron/service-process.cjs');
const { releaseCapable } = require('../electron/update-check.cjs');
const { validateManifest } = require('../scripts/product-registry.cjs');
const { buildReleaseManifest } = require('../scripts/instrumenta-release.cjs');
const { packagedWebProducts } = require('../scripts/package-policy.cjs');
const { preparationPlan } = require('../scripts/workspace-manager.cjs');

const repository = { provider: 'github', owner: 'George-Nizor', name: 'Discere', channel: 'stable' };
const catalogEntry = {
  id: 'discere', name: 'Discere', sourceDirectory: '../Discere', adapter: 'managed-service', packagePolicy: 'optional',
  repository, tile: { art: 'brand/artwork/discere-app-art.png', theme: 'discere' },
};

function temporaryRoot(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `instrumenta-${label}-`));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

// The checkout's manifest: Discere's own instrumenta/product.json, which keeps saying web-service.
function checkoutManifest() {
  return {
    schemaVersion: 1, id: 'discere', displayName: 'Discere', kind: 'web', adapter: 'web-service',
    versionSource: { type: 'package-json', path: 'package.json' },
    build: { output: 'apps/web/dist', command: 'pnpm run build' },
    launch: {
      type: 'service', port: 49323, fallbackPort: 45023, health: '/api/health',
      command: ['pnpm', '--filter', '@discere/server', 'start'], cwd: '.', env: { DISCERE_AUTO_MIGRATE: '1' },
    },
  };
}

// The bundle's manifest: the same product, started from the runtime it ships.
function bundleManifest(command = ['runtime/node.exe', 'server/index.mjs'], extra = {}) {
  return {
    schemaVersion: 1, id: 'discere', displayName: 'Discere', kind: 'web', adapter: 'web-service',
    launch: {
      type: 'service', port: 49323, fallbackPort: 45023, health: '/api/health', command, cwd: '.',
      env: { DISCERE_PACKAGED: '1', DISCERE_AUTO_MIGRATE: '1' },
    },
    ...extra,
  };
}

function releaseManifest(version) {
  return {
    schemaVersion: 1, product: 'discere', version, platform: 'windows-x64', minimumInstrumentaVersion: '0.15.0',
    installStrategy: 'managed-service',
    bundle: { asset: `discere-${version}.zip`, size: 6, sha256: crypto.createHash('sha256').update('bundle').digest('hex'), entry: 'package.json' },
  };
}

// The extracted zip: package.json, instrumenta/product.json, the runtime and the server.
function writeBundle(root, version, manifest = bundleManifest()) {
  writeJson(path.join(root, 'package.json'), { name: 'discere', version });
  writeJson(path.join(root, 'instrumenta', 'product.json'), manifest);
  fs.mkdirSync(path.join(root, 'runtime'), { recursive: true });
  fs.writeFileSync(path.join(root, 'runtime', 'node.exe'), 'pretend runtime');
  fs.mkdirSync(path.join(root, 'server'), { recursive: true });
  fs.writeFileSync(path.join(root, 'server', 'index.mjs'), '');
  return root;
}

// A managed install as installManagedDirectory leaves it on disk.
function installVersion(installRoot, version, manifest = bundleManifest()) {
  const staging = writeBundle(temporaryRoot('managed-service-extract'), version, manifest);
  return installManagedDirectory({ sourceRoot: staging, installRoot, manifest: releaseManifest(version), move: true });
}

function checkout(root = temporaryRoot('managed-service-checkout'), { prepared = true } = {}) {
  writeJson(path.join(root, 'package.json'), { name: 'discere-workspace', version: '1.0.0' });
  writeJson(path.join(root, 'instrumenta', 'product.json'), checkoutManifest());
  if (prepared) {
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
    fs.mkdirSync(path.join(root, 'apps', 'web', 'dist'), { recursive: true });
    fs.writeFileSync(path.join(root, 'apps', 'web', 'dist', 'index.html'), '<!doctype html>');
  }
  return root;
}

function checkoutDefinition(root = checkout()) {
  return validateManifest(checkoutManifest(), root, catalogEntry);
}

// ---- Release manifest -----------------------------------------------------------------------

test('a managed-service release manifest is accepted and names package.json as its entry', () => {
  const manifest = validateReleaseManifest(releaseManifest('1.1.0'), 'discere');
  assert.equal(manifest.installStrategy, 'managed-service');
  assert.equal(manifest.bundle.entry, 'package.json');
  assert.throws(() => validateReleaseManifest({ ...releaseManifest('1.1.0'), bundle: { ...releaseManifest('1.1.0').bundle, entry: 'server/index.mjs' } }), /safe file name/);
});

test('instrumenta-release writes a managed-service manifest the launcher accepts, and checks the bundle', () => {
  const area = temporaryRoot('managed-service-release');
  const zip = path.join(area, 'discere-1.1.0.zip');
  fs.writeFileSync(zip, 'pretend zip');
  const root = writeBundle(path.join(area, 'discere-1.1.0'), '1.1.0');
  const manifest = buildReleaseManifest({ product: 'discere', version: '1.1.0', strategy: 'managed-service', bundle: zip, minimum: '0.15.0', serviceRoot: root });
  assert.equal(manifest.installStrategy, 'managed-service');
  assert.equal(manifest.bundle.entry, 'package.json');
  assert.equal(manifest.bundle.asset, 'discere-1.1.0.zip');
  assert.equal(manifest.minimumInstrumentaVersion, '0.15.0');
  // A launcher older than 0.15.0 cannot install a managed service, so the release may not say it can.
  assert.throws(() => buildReleaseManifest({ product: 'discere', version: '1.1.0', strategy: 'managed-service', bundle: zip, minimum: '0.14.0' }), /--minimum 0\.15\.0/);
  // The folder the zip was made from has to be a service the launcher can start, at this version.
  assert.throws(() => buildReleaseManifest({ product: 'discere', version: '1.2.0', strategy: 'managed-service', bundle: zip, minimum: '0.15.0', serviceRoot: root }), /not 1\.2\.0/);
  fs.rmSync(path.join(root, 'runtime', 'node.exe'));
  assert.throws(() => buildReleaseManifest({ product: 'discere', version: '1.1.0', strategy: 'managed-service', bundle: zip, minimum: '0.15.0', serviceRoot: root }), /not a file/);
});

// ---- Registry --------------------------------------------------------------------------------

test('the catalog delivers Discere as managed-service while its checkout manifest says web-service', () => {
  const product = checkoutDefinition();
  assert.equal(product.adapter, 'managed-service');
  assert.equal(product.builtAs, 'web-service');
  assert.equal(product.managedRoot, undefined, 'a checkout is not an installed release');
  assert.deepEqual(product.release, { repository, manifestAsset: 'instrumenta-release.json' });
  assert.equal(releaseCapable(product), true, 'an installable product is also a polled one');
  // Only web-service can be delivered this way.
  assert.throws(() => validateManifest({ ...checkoutManifest(), adapter: 'web-vite' }, checkout(), catalogEntry), /mismatched adapter/);
});

test('a checkout keeps the bare-name command allowlist', () => {
  const root = checkout();
  const manifest = checkoutManifest();
  manifest.launch.command = ['runtime/node.exe', 'server/index.mjs'];
  assert.throws(() => validateManifest(manifest, root, catalogEntry), /bare name/);
  manifest.launch.command = ['python', 'server.py'];
  assert.throws(() => validateManifest(manifest, root, catalogEntry), /bare name/);
});

test('an installed bundle names an executable inside its version folder', () => {
  const root = writeBundle(temporaryRoot('managed-service-bundle'), '1.1.0');
  const product = validateManifest(bundleManifest(), root, catalogEntry, { managedInstall: true });
  assert.equal(product.adapter, 'managed-service');
  assert.equal(product.managedRoot, root);
  assert.equal(product.version, '1.1.0', 'read from the bundle\'s package.json');
  assert.equal(product.launch.port, 49323);
  assert.deepEqual(product.launch.env, { DISCERE_PACKAGED: '1', DISCERE_AUTO_MIGRATE: '1' });
  // A bare name is a file in the folder or nothing: PATH is never searched for an installed release.
  assert.throws(() => validateManifest(bundleManifest(['node', 'server/index.mjs']), root, catalogEntry, { managedInstall: true }), /not a file/);
});

test('an installed bundle command cannot escape its version folder', () => {
  const area = temporaryRoot('managed-service-escape');
  const root = writeBundle(path.join(area, 'versions', '1.1.0'), '1.1.0');
  fs.writeFileSync(path.join(area, 'outside.exe'), 'not part of the bundle');
  const attempts = {
    '../../outside.exe': /segments/,
    'runtime/../../../outside.exe': /segments/,
    './runtime/node.exe': /segments/,
    'runtime//node.exe': /segments/,
    'runtime\\node.exe': /forward slashes/,
    '..\\..\\outside.exe': /forward slashes/,
    'C:/Windows/System32/cmd.exe': /forward slashes/,
    'C:cmd.exe': /forward slashes/,
    '\\\\server\\share\\node.exe': /forward slashes/,
    '//server/share/node.exe': /relative/,
    [path.join(area, 'outside.exe').replace(/\\/g, '/')]: /relative|forward slashes/,
    'runtime/node.exe:stream': /forward slashes/,
    'runtime/node\u0000.exe': /forward slashes/,
    runtime: /not a file/,
    'runtime/missing.exe': /not a file/,
  };
  for (const [binary, reason] of Object.entries(attempts)) {
    assert.throws(
      () => validateManifest(bundleManifest([binary, 'server/index.mjs']), root, catalogEntry, { managedInstall: true }),
      reason,
      `${JSON.stringify(binary)} was accepted`,
    );
  }
  // The working directory stays inside the folder too, and the launcher keeps its own variables.
  const outside = bundleManifest();
  outside.launch.cwd = '..';
  assert.throws(() => validateManifest(outside, root, catalogEntry, { managedInstall: true }), /cwd escapes/);
  const port = bundleManifest();
  port.launch.env = { PORT: '1' };
  assert.throws(() => validateManifest(port, root, catalogEntry, { managedInstall: true }), /launcher-owned variable PORT/);
});

test('a release whose bundle cannot start its service is refused before it is installed', async () => {
  const area = temporaryRoot('managed-service-refused');
  const bundle = Buffer.from('pretend zip');
  const manifest = {
    ...releaseManifest('1.1.0'),
    bundle: { asset: 'discere-1.1.0.zip', size: bundle.length, sha256: crypto.createHash('sha256').update(bundle).digest('hex'), entry: 'package.json' },
  };
  const transport = async () => Object.assign(Readable.from([bundle]), { statusCode: 200, headers: {} });
  const definition = { id: 'discere', displayName: 'Discere', adapter: 'managed-service', catalog: catalogEntry, release: { repository } };
  const options = (extract) => ({
    latest: { manifest, tag: 'v1.1.0' }, launcherVersion: '0.15.0', transport,
    cacheRoot: path.join(area, 'downloads'), installRoot: path.join(area, 'products'), extractZip: extract,
  });
  await assert.rejects(installLatestProduct(definition, options(async (_archive, destination) => {
    writeBundle(destination, '1.1.0', bundleManifest(['../escape.exe']));
  })), /segments/);
  assert.equal(resolveManagedInstall(path.join(area, 'products'), 'discere'), null, 'nothing was activated');

  const installed = await installLatestProduct(definition, options(async (_archive, destination) => writeBundle(destination, '1.1.0')));
  assert.equal(installed.strategy, 'managed-service');
  assert.equal(resolveManagedInstall(path.join(area, 'products'), 'discere').version, '1.1.0');

  // A service release is never installed for a product delivered another way, or the reverse.
  await assert.rejects(installLatestProduct({ ...definition, adapter: 'managed-web' }, options(async () => {})), /does not match/);
});

// ---- Resolution order --------------------------------------------------------------------------

test('without an installed release a checkout runs the web-service way', () => {
  const installRoot = temporaryRoot('managed-service-none');
  const ready = productState(checkoutDefinition(), '', '', installRoot, { latest: { discere: '1.1.0' }, releases: { discere: { published: true } } });
  assert.equal(ready.adapter, 'managed-service');
  assert.equal(ready.ready, true);
  assert.equal(ready.location, path.join(ready.sourceRoot, 'apps', 'web', 'dist'));
  assert.equal(ready.canInstall, true, 'the release can still be installed over a checkout');
  assert.equal(ready.canUninstall, false);
  assert.equal(ready.updateAvailable, false, 'a checkout is not an installed version');
  assert.equal(ready.installedVersion, '');

  // Unprepared, it says so, as a web-service checkout does.
  const unprepared = productState(checkoutDefinition(checkout(undefined, { prepared: false })), '', '', installRoot);
  assert.equal(unprepared.ready, false);
  assert.equal(unprepared.canPrepare, true);
});

test('before anything is published a checkout still works, and without one the tile says so', () => {
  const installRoot = temporaryRoot('managed-service-unpublished');
  const versions = { releases: { discere: { published: false } } };
  const fromCheckout = productState(checkoutDefinition(), '', '', installRoot, versions);
  assert.equal(fromCheckout.ready, true);
  assert.equal(fromCheckout.canInstall, false);
  assert.equal(fromCheckout.releasePublished, false);

  const area = temporaryRoot('managed-service-catalog');
  const catalogBase = path.join(area, 'app');
  writeJson(path.join(catalogBase, 'products', 'catalog.json'), { schemaVersion: 2, products: [catalogEntry] });
  const [definition] = productDefinitions(loadRegistry({ catalogBase, installRoot }));
  const nothing = productState(definition, '', '', installRoot, versions);
  assert.equal(nothing.ready, false);
  assert.equal(nothing.canInstall, false);
  assert.equal(nothing.detail, 'No release has been published yet.');
  const offered = productState(definition, '', '', installRoot, { releases: { discere: { published: true } } });
  assert.equal(offered.canInstall, true);
  assert.equal(offered.detail, 'Install the latest verified release.');
});

test('an installed release wins over the checkout beside it, and its own manifest is what starts', () => {
  const area = temporaryRoot('managed-service-order');
  const catalogBase = path.join(area, 'Instrumenta');
  writeJson(path.join(catalogBase, 'products', 'catalog.json'), { schemaVersion: 2, products: [catalogEntry] });
  const source = checkout(path.join(area, 'Discere'));
  const installRoot = path.join(area, 'products');

  const [fromCheckout] = productDefinitions(loadRegistry({ catalogBase, installRoot }));
  assert.equal(fromCheckout.sourceRoot, source);
  assert.equal(fromCheckout.managedRoot, undefined);

  const { destination } = installVersion(installRoot, '1.1.0');
  const [fromRelease] = productDefinitions(loadRegistry({ catalogBase, installRoot }));
  assert.equal(fromRelease.managedRoot, destination);
  assert.equal(fromRelease.sourceRoot, destination);
  assert.equal(fromRelease.checkoutRoot, source);
  assert.deepEqual(fromRelease.launch.command, ['runtime/node.exe', 'server/index.mjs']);

  const state = productState(fromRelease, '', '', installRoot, { latest: { discere: '1.2.0' } });
  assert.equal(state.ready, true);
  assert.equal(state.location, destination);
  assert.equal(state.installedVersion, '1.1.0');
  assert.equal(state.lifecycle, 'installed');
  assert.equal(state.canPrepare, false);
  assert.equal(state.canUninstall, true);
  assert.equal(state.updateAvailable, true);
  assert.match(state.detail, /1\.2\.0/);
  // The same answer from the checkout's definition: productState resolves the release itself.
  assert.equal(productState(fromCheckout, '', '', installRoot).location, destination);
});

test('with no checkout at all the product is hydrated from its installed bundle', () => {
  const area = temporaryRoot('managed-service-hydrate');
  const catalogBase = path.join(area, 'app');
  writeJson(path.join(catalogBase, 'products', 'catalog.json'), { schemaVersion: 2, products: [catalogEntry] });
  const installRoot = path.join(area, 'products');
  const { destination } = installVersion(installRoot, '1.1.0');
  const [discere] = productDefinitions(loadRegistry({ catalogBase, installRoot }));
  assert.equal(discere.managedRoot, destination);
  assert.equal(releaseCapable(discere), true);
  assert.equal(productState(discere, '', '', installRoot).ready, true);
});

test('an installed release that cannot start is reported, not replaced by the checkout', () => {
  const installRoot = temporaryRoot('managed-service-broken');
  installVersion(installRoot, '1.1.0');
  const root = resolveManagedInstall(installRoot, 'discere').root;
  fs.rmSync(path.join(root, 'runtime', 'node.exe'));
  const state = productState(checkoutDefinition(), '', '', installRoot);
  assert.equal(state.ready, false);
  assert.equal(state.canUninstall, true);
  assert.match(state.detail, /Discere 1\.1\.0 cannot start: .*not a file/);
});

// ---- Launching ---------------------------------------------------------------------------------

test('an installed release is started from its version folder, natively', () => {
  const installRoot = temporaryRoot('managed-service-plan');
  const { destination } = installVersion(installRoot, '1.1.0');
  const definition = validateManifest(bundleManifest(), destination, catalogEntry, { managedInstall: true });
  const plan = serviceLaunchPlan(definition);
  assert.deepEqual(plan.command, [path.join(destination, 'runtime', 'node.exe'), 'server/index.mjs']);
  assert.equal(plan.cwd, destination);
  assert.equal(plan.native, true);
  assert.deepEqual(plan.ports, [49323, 45023]);
  assert.equal(plan.healthPath, '/api/health');
  assert.deepEqual(plan.env, { DISCERE_PACKAGED: '1', DISCERE_AUTO_MIGRATE: '1' });

  // The executable is checked again at launch: a folder changed since the registry was read fails.
  fs.rmSync(path.join(destination, 'runtime', 'node.exe'));
  assert.throws(() => serviceLaunchPlan(definition), /not a file/);
});

test('a checkout is started with its bare command, through the WSL bridge when it lives on a share', () => {
  const plan = serviceLaunchPlan(checkoutDefinition());
  assert.deepEqual(plan.command, ['pnpm', '--filter', '@discere/server', 'start']);
  assert.equal(plan.native, false);

  const share = '\\\\wsl.localhost\\Ubuntu\\home\\me\\Discere';
  const env = { PORT: '49323', HOST: '127.0.0.1' };
  const bridged = planServiceSpawn({ tool: 'discere', command: plan.command, cwd: share, env, port: 49323, platform: 'win32', baseEnv: {} });
  assert.ok(bridged.bridge, 'a checkout on a WSL share goes through wsl.exe');
  // An installed release never does, whatever its folder looks like.
  const native = planServiceSpawn({ tool: 'discere', command: ['C:\\Users\\me\\Discere\\runtime\\node.exe', 'server/index.mjs'], cwd: share, env, port: 49323, native: true, platform: 'win32', baseEnv: { Path: 'x' } });
  assert.equal(native.bridge, null);
  assert.equal(native.executable, 'C:\\Users\\me\\Discere\\runtime\\node.exe');
  assert.deepEqual(native.args, ['server/index.mjs']);
  assert.equal(native.options.cwd, share);
  assert.equal(native.options.env.PORT, '49323');
  assert.equal(native.options.detached, false, 'taskkill /T stops the tree on Windows');
  assert.equal(native.options.shell, false);
});

test('an installed service starts from its folder, answers its health path, and stops', { skip: process.platform === 'win32' }, async () => {
  const installRoot = temporaryRoot('managed-service-run');
  const { destination } = installVersion(installRoot, '1.1.0', bundleManifest(['runtime/start', 'server/index.cjs']));
  // A runtime of its own, as Discere ships node.exe: here a script that runs this Node.
  fs.writeFileSync(path.join(destination, 'runtime', 'start'), `#!/bin/sh\nexec "${process.execPath}" "$@"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(destination, 'server', 'index.cjs'), `
    const http = require('node:http');
    http.createServer((request, response) => {
      response.writeHead(request.url === '/api/health' && process.env.DISCERE_PACKAGED === '1' && process.cwd() === ${JSON.stringify(destination)} ? 200 : 500);
      response.end('ok');
    }).listen(Number(process.env.PORT), process.env.HOST);
  `);
  const definition = validateManifest(bundleManifest(['runtime/start', 'server/index.cjs']), destination, catalogEntry, { managedInstall: true });
  const plan = serviceLaunchPlan(definition);
  const service = await startService({ tool: 'discere', command: plan.command, cwd: plan.cwd, env: plan.env, port: await pickPort([]), healthPath: plan.healthPath, native: plan.native, timeoutMs: 10000 });
  try {
    assert.match(service.url, /^http:\/\/127\.0\.0\.1:\d+$/);
  } finally {
    await service.stop();
  }
  assert.notEqual(service.child.exitCode === null && service.child.signalCode === null, true, 'the process has gone');
});

// ---- Install, update, rollback ------------------------------------------------------------------

test('a managed service rolls back like any managed release, and only a pending version automatically', () => {
  assert.equal(supportsRollback('managed-service'), true);
  const installRoot = temporaryRoot('managed-service-rollback');
  installVersion(installRoot, '1.0.0');
  // The first version has opened once.
  fs.writeFileSync(path.join(installRoot, 'discere', 'current.json'), JSON.stringify({ current: '1.0.0', previous: '', pending: false }));
  installVersion(installRoot, '1.1.0');
  const pending = resolveManagedInstall(installRoot, 'discere');
  assert.equal(pending.version, '1.1.0');
  assert.equal(pending.strategy, 'managed-service');
  assert.equal(pending.pending, true, 'provisional until its service first answers its health check');
  assert.equal(pending.previous, '1.0.0');
  // Its service never became healthy: back to 1.0.0.
  assert.equal(rollbackAfterFailedOpen('managed-service', pending), true);
  rollbackManagedVersion(installRoot, 'discere');
  assert.deepEqual(readPointer(path.join(installRoot, 'discere')), { current: '1.0.0', previous: '1.1.0', pending: false });
  // A version that has started once is not judged by one failure.
  assert.equal(rollbackAfterFailedOpen('managed-service', { ...pending, pending: false }), false);
  const state = productState(checkoutDefinition(), '', '', installRoot);
  assert.equal(state.installedVersion, '1.0.0');
  assert.equal(state.canRollback, true);
});

test('a running service is not uninstalled; it has to be closed first', () => {
  assert.equal(
    lifecycleBlocker({ operation: 'uninstall', adapter: 'managed-service', running: true, displayName: 'Discere' }),
    'Close Discere before uninstalling it.',
  );
  assert.equal(lifecycleBlocker({ operation: 'uninstall', adapter: 'managed-service', running: false, displayName: 'Discere' }), '');
});

test('a managed service is prepared from its checkout and never baked into the installer', () => {
  const product = checkoutDefinition();
  assert.deepEqual(preparationPlan([product], 'all'), [{ id: 'discere', step: 'web-service', reason: '' }]);
  assert.deepEqual(packagedWebProducts([product]), []);
});
