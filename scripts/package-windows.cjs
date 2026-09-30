const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateIconSources } = require('./workspace-maintenance.cjs');
const {
  assertPortableArtifact,
  endUserEnvironment,
  packagedWebProducts: selectPackagedWebProducts,
  waitForFile,
  webBuildSteps,
} = require('./package-policy.cjs');
const { auditWebBuild } = require('../electron/static-server.cjs');
const { verifyLaunchCheckMarker } = require('../electron/launch-check.cjs');
const { registryFor } = require('./product-registry.cjs');

const launcherRoot = path.resolve(__dirname, '..');
const registry = registryFor(launcherRoot);
// Reading the catalog leniently is right for the launcher and wrong here. A product the registry
// understood but rejected must stop the build: shipping an installer that is quietly missing an
// application is worse than not shipping one. An absent checkout stays tolerated, because
// packaging without every product's source is a normal thing to do.
const invalidProducts = registry.missing.filter((entry) => entry.reason);
if (invalidProducts.length) {
  const detail = invalidProducts.map((entry) => `${entry.id}: ${entry.reason}`).join('\n  ');
  throw new Error(`Cannot package while a catalog product is invalid:\n  ${detail}`);
}
const stagingApps = path.join(launcherRoot, 'packaging', 'staging', 'apps');

function execute(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: options.env || process.env,
    shell: process.platform === 'win32' && /\.cmd$/i.test(command),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

function verifyPortableRuntime(executable, version) {
  const probeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-package-probe-'));
  const marker = path.join(probeRoot, 'ready.txt');
  try {
    const environment = endUserEnvironment({
      ...process.env,
      APPDATA: path.join(probeRoot, 'AppData', 'Roaming'),
      LOCALAPPDATA: path.join(probeRoot, 'AppData', 'Local'),
    });
    const result = spawnSync(executable, ['--instrumenta-launch-check', marker], {
      cwd: path.dirname(executable),
      stdio: 'inherit',
      shell: false,
      env: environment,
      timeout: 60_000,
    });
    if (result.error) throw result.error;
    if (result.status !== null && result.status !== 0) {
      throw new Error(`Instrumenta packaged runtime check failed with exit code ${result.status ?? 'unknown'}.`);
    }
    // Windows GUI launchers can return before their child application exits.
    // The atomic marker, not the wrapper lifetime, is the completion contract.
    if (!waitForFile(marker)) throw new Error('Instrumenta packaged runtime check did not write its success marker.');
    verifyLaunchCheckMarker(fs.readFileSync(marker, 'utf8'), version);
  } finally {
    fs.rmSync(probeRoot, { recursive: true, force: true });
  }
}

if (process.platform !== 'win32') {
  console.error('Instrumenta Windows packages must be built on Windows.');
  process.exit(1);
}

validateIconSources(launcherRoot);

// A managed-service product runs its server from the source workspace (for
// Discere, inside WSL) and cannot ship in the installer; the installed
// launcher reaches it through the workspace instead.
const packagedWebProducts = selectPackagedWebProducts(registry.products);
for (const skipped of registry.products.filter((entry) => entry.adapter === 'web-service')) {
  console.log(`\nLeaving ${skipped.displayName} out of the package: managed services launch from the source workspace.`);
}

// Each product is built by its own package.json. The adapter only says how the launcher serves a
// build, so a product that changes adapter (onto managed-web, say) keeps building the way it did.
const npm = 'npm.cmd';
for (const product of packagedWebProducts) {
  console.log(`\nPreparing ${product.displayName} for the Instrumenta desktop package…`);
  for (const args of webBuildSteps(product.sourceRoot)) execute(npm, args, product.sourceRoot);
}

fs.rmSync(path.join(launcherRoot, 'packaging', 'staging'), { recursive: true, force: true });
fs.mkdirSync(stagingApps, { recursive: true });
for (const product of packagedWebProducts) {
  const staged = path.join(stagingApps, product.id);
  fs.cpSync(path.join(product.sourceRoot, product.build.output), staged, { recursive: true });
  fs.mkdirSync(path.join(staged, 'instrumenta'), { recursive: true });
  fs.copyFileSync(path.join(product.sourceRoot, 'instrumenta', 'product.json'), path.join(staged, 'instrumenta', 'product.json'));
  // The version this copy was built at, where the manifest's versionSource looks: the launcher
  // compares it with the product's releases, so a baked copy is updated like an installed one.
  fs.writeFileSync(path.join(staged, 'package.json'), `${JSON.stringify({ name: product.id, version: product.version, private: true }, null, 2)}\n`);
  auditWebBuild(staged, product.id);
}

console.log('\nCreating the Instrumenta installer and portable application…');
const builder = path.join(launcherRoot, 'node_modules', '.bin', 'electron-builder.cmd');
// Never publish from here: in CI electron-builder would otherwise try to on its own, and the
// release workflow publishes what this builds, with the manifests beside it.
execute(builder, ['--win', 'nsis', 'portable', '--x64', '--publish', 'never'], launcherRoot);

const version = JSON.parse(fs.readFileSync(path.join(launcherRoot, 'package.json'), 'utf8')).version;
const portable = assertPortableArtifact(launcherRoot, version);
console.log('Runtime-checking the packaged Instrumenta application…');
verifyPortableRuntime(portable, version);

console.log('\nInstrumenta packages are ready in Instrumenta\\release.');
