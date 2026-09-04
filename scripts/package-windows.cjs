const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateIconSources } = require('./workspace-maintenance.cjs');
const { assertPortableArtifact, endUserEnvironment, waitForFile } = require('./package-policy.cjs');
const { auditWebBuild } = require('../electron/static-server.cjs');
const { verifyLaunchCheckMarker } = require('../electron/launch-check.cjs');
const { registryFor } = require('./product-registry.cjs');

const launcherRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(launcherRoot, '..');
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
const products = new Map(registry.products.map((product) => [product.id, product]));
const imagoRoot = products.get('imago')?.sourceRoot || path.join(workspaceRoot, 'Imago');
const motusRoot = products.get('motus')?.sourceRoot || path.join(workspaceRoot, 'Motus');
const ludereRoot = products.get('ludere')?.sourceRoot || path.join(workspaceRoot, 'Ludere');
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

function validMotusBundle(candidate) {
  if (!candidate || !fs.existsSync(path.join(candidate, 'motus-bundle.json'))) return false;
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(candidate, 'motus-bundle.json'), 'utf8').replace(/^\uFEFF/, ''));
    return manifest.schemaVersion === 1
      && manifest.id === 'motus'
      && path.basename(manifest.executable || '') === manifest.executable
      && path.win32.basename(manifest.executable || '') === manifest.executable
      && fs.existsSync(path.join(candidate, manifest.executable));
  } catch {
    return false;
  }
}

// An end user's computer has no MSYS2, Qt, or MinGW on PATH. Both runtime
// probes use the bare system environment supplied by package-policy.cjs.
// Static proof, before anything is launched: every library the bundle's
// executables and DLLs import is either inside the bundle or supplied by
// Windows. This names the missing file instead of reporting 0xC0000135.
function verifyMotusClosure(bundle) {
  const checker = path.join(motusRoot, 'scripts', 'bundle-runtime.cjs');
  if (!fs.existsSync(checker)) throw new Error('Motus is missing scripts\\bundle-runtime.cjs.');
  const result = spawnSync(process.execPath, [checker, 'check', bundle], { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('The Motus bundle is not self-contained. Rebuild it with Instrumenta.cmd build motus, then package again.');
  }
}

function verifyMotusRuntime(bundle, executable) {
  const probeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-motus-package-probe-'));
  const marker = path.join(probeRoot, 'ready.txt');
  try {
    const result = spawnSync(executable, ['--instrumenta-launch-check', marker], {
      cwd: bundle, stdio: 'ignore', shell: false, env: endUserEnvironment(),
    });
    if (result.error) throw result.error;
    if (result.status !== 0 || !fs.existsSync(marker) || !/MOTUS_LAUNCH_OK\s+\d+\.\d+\.\d+/.test(fs.readFileSync(marker, 'utf8'))) {
      throw new Error(`Motus native runtime check failed with exit code ${result.status ?? 'unknown'}.`);
    }
  } finally {
    fs.rmSync(probeRoot, { recursive: true, force: true });
  }
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
const packagedWebProducts = registry.products.filter((entry) => entry.kind === 'web' && entry.adapter !== 'web-service');
for (const skipped of registry.products.filter((entry) => entry.adapter === 'web-service')) {
  console.log(`\nLeaving ${skipped.displayName} out of the package: managed services launch from the source workspace.`);
}

const npm = 'npm.cmd';
for (const product of packagedWebProducts) {
  console.log(`\nPreparing ${product.displayName} for the Instrumenta desktop package…`);
  const sourceRoot = product.sourceRoot;
  if (product.adapter === 'web-vite') {
    execute(npm, [fs.existsSync(path.join(sourceRoot, 'package-lock.json')) ? 'ci' : 'install'], sourceRoot);
    execute(npm, ['run', 'build'], sourceRoot);
  } else {
    execute(process.execPath, ['scripts/build.mjs'], sourceRoot);
  }
}

fs.rmSync(path.join(launcherRoot, 'packaging', 'staging'), { recursive: true, force: true });
fs.mkdirSync(stagingApps, { recursive: true });
for (const product of packagedWebProducts) {
  const staged = path.join(stagingApps, product.id);
  fs.cpSync(path.join(product.sourceRoot, product.build.output), staged, { recursive: true });
  fs.mkdirSync(path.join(staged, 'instrumenta'), { recursive: true });
  fs.copyFileSync(path.join(product.sourceRoot, 'instrumenta', 'product.json'), path.join(staged, 'instrumenta', 'product.json'));
  auditWebBuild(staged, product.id);
}

const motusBundle = [
  process.env.MOTUS_BUNDLE,
  path.join(motusRoot, 'dist', 'windows'),
  path.join(motusRoot, 'prebuilt', 'windows'),
  path.join(motusRoot, 'package', 'windows'),
].filter(Boolean).find(validMotusBundle);
if (motusBundle) {
  console.log('Staging and runtime-checking the Motus Windows application bundle…');
  const motusManifest = JSON.parse(fs.readFileSync(path.join(motusBundle, 'motus-bundle.json'), 'utf8').replace(/^\uFEFF/, ''));
  // Check the copied payload before adding Instrumenta-owned metadata. Motus's
  // provenance inventory intentionally covers the portable third-party payload,
  // while the subsequent runtime probe still exercises the final staged tree.
  const stagedMotus = path.join(stagingApps, 'Motus');
  fs.cpSync(motusBundle, stagedMotus, { recursive: true });
  verifyMotusClosure(stagedMotus);
  fs.mkdirSync(path.join(stagedMotus, 'instrumenta'), { recursive: true });
  fs.copyFileSync(path.join(motusRoot, 'instrumenta', 'product.json'), path.join(stagedMotus, 'instrumenta', 'product.json'));
  verifyMotusRuntime(stagedMotus, path.join(stagedMotus, motusManifest.executable));
} else {
  console.log('Motus has no verified self-contained Windows bundle yet; prepare it before packaging to include it.');
}

console.log('\nCreating the Instrumenta installer and portable application…');
const builder = path.join(launcherRoot, 'node_modules', '.bin', 'electron-builder.cmd');
execute(builder, ['--win', 'nsis', 'portable', '--x64'], launcherRoot);

const version = JSON.parse(fs.readFileSync(path.join(launcherRoot, 'package.json'), 'utf8')).version;
const portable = assertPortableArtifact(launcherRoot, version);
console.log('Runtime-checking the packaged Instrumenta application…');
verifyPortableRuntime(portable, version);

console.log('\nInstrumenta packages are ready in Instrumenta\\release.');
