'use strict';

const fs = require('node:fs');
const path = require('node:path');

const launcherRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(launcherRoot, '..');
const catalogPath = path.join(launcherRoot, 'products', 'catalog.json');
const supportedAdapters = new Set(['native-bundle', 'web-vite', 'web-static', 'web-service']);
const idPattern = /^[a-z][a-z0-9-]*$/;
const environmentKeyPattern = /^[A-Z][A-Z0-9_]*$/;
// A managed service is started by Instrumenta itself, so only package-manager
// and Node entrypoints may be named by a product manifest.
const serviceCommands = new Set(['node', 'npm', 'pnpm', 'corepack']);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function within(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function versionFromManifest(root, manifest) {
  const source = manifest.versionSource;
  if (!source || typeof source.path !== 'string') return '';
  const file = path.join(root, source.path);
  if (!within(root, file) || !fs.existsSync(file)) return '';
  try {
    if (source.type === 'package-json') return String(readJson(file).version || '');
    const text = fs.readFileSync(file, 'utf8');
    const match = text.match(/project\s*\(\s*Motus\s+VERSION\s+([0-9]+\.[0-9]+\.[0-9]+)/i);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

function validPort(value) {
  return Number.isInteger(value) && value >= 1024 && value <= 65535;
}

// Each web adapter states its own readiness contract instead of the launcher
// carrying per-product conditionals.
const healthContracts = Object.freeze({
  'web-vite': (health) => health === 'imago',
  'web-static': (health) => health === 'ludere',
  'web-service': (health) => typeof health === 'string' && health.startsWith('/'),
});

function validateServiceLaunch(manifest, sourceRoot, entry) {
  const launch = manifest.launch;
  if (!Array.isArray(launch.command) || !launch.command.length
    || !launch.command.every((part) => typeof part === 'string' && part.trim())) {
    throw new Error(`${entry.id}: web-service launch.command must be a non-empty array of strings.`);
  }
  const binary = path.basename(String(launch.command[0])).replace(/\.(cmd|exe|bat|ps1)$/i, '');
  if (!serviceCommands.has(binary)) {
    throw new Error(`${entry.id}: web-service launch.command must start with one of ${[...serviceCommands].join(', ')}.`);
  }
  if (launch.cwd !== undefined && typeof launch.cwd !== 'string') {
    throw new Error(`${entry.id}: web-service launch.cwd must be a relative path string.`);
  }
  const cwd = path.resolve(sourceRoot, launch.cwd || '.');
  if (!within(sourceRoot, cwd)) throw new Error(`${entry.id}: web-service launch.cwd escapes the product root.`);
  if (launch.env !== undefined) {
    if (!launch.env || typeof launch.env !== 'object' || Array.isArray(launch.env)) {
      throw new Error(`${entry.id}: web-service launch.env must be an object of environment variables.`);
    }
    for (const [key, value] of Object.entries(launch.env)) {
      if (!environmentKeyPattern.test(key) || typeof value !== 'string') {
        throw new Error(`${entry.id}: web-service launch.env entry ${key} is not a valid environment variable.`);
      }
    }
  }
}

function validateManifest(manifest, sourceRoot, entry) {
  if (!manifest || manifest.schemaVersion !== 1) throw new Error(`${entry.id}: product manifest schemaVersion must be 1.`);
  if (manifest.id !== entry.id || !idPattern.test(manifest.id)) throw new Error(`${entry.id}: product manifest ID does not match the catalog.`);
  if (typeof manifest.displayName !== 'string' || !manifest.displayName.trim()) throw new Error(`${entry.id}: displayName is required.`);
  if (!supportedAdapters.has(manifest.adapter) || manifest.adapter !== entry.adapter) throw new Error(`${entry.id}: unsupported or mismatched adapter.`);
  if (!['web', 'native'].includes(manifest.kind)) throw new Error(`${entry.id}: kind must be web or native.`);
  if (!manifest.build || typeof manifest.build.output !== 'string') throw new Error(`${entry.id}: build.output is required.`);
  if (!manifest.launch || !['web', 'native', 'service'].includes(manifest.launch.type)) throw new Error(`${entry.id}: launch.type is required.`);
  if (manifest.adapter.startsWith('web-')) {
    const expectedType = manifest.adapter === 'web-service' ? 'service' : 'web';
    if (manifest.launch.type !== expectedType || !validPort(manifest.launch.port)) {
      throw new Error(`${entry.id}: web products need a valid launch.port.`);
    }
    if (manifest.launch.fallbackPort !== undefined && !validPort(manifest.launch.fallbackPort)) {
      throw new Error(`${entry.id}: web products need a valid launch.fallbackPort when one is declared.`);
    }
    if (!healthContracts[manifest.adapter](manifest.launch.health)) {
      throw new Error(`${entry.id}: ${manifest.adapter} health contract is invalid.`);
    }
    if (manifest.adapter === 'web-service') validateServiceLaunch(manifest, sourceRoot, entry);
  }
  if (!manifest.mcp || typeof manifest.mcp.skill !== 'string') throw new Error(`${entry.id}: MCP skill path is required.`);
  const output = path.resolve(sourceRoot, manifest.build.output);
  if (!within(sourceRoot, output)) throw new Error(`${entry.id}: build output escapes the product root.`);
  return {
    ...manifest,
    version: versionFromManifest(sourceRoot, manifest),
    sourceRoot,
    catalog: entry,
  };
}

function loadCatalog({ root = launcherRoot, allowMissing = false } = {}) {
  const file = path.join(root, 'products', 'catalog.json');
  const catalog = readJson(file);
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.products) || !catalog.products.length) {
    throw new Error('Instrumenta product catalog must have schemaVersion 1 and a non-empty products array.');
  }
  const seenIds = new Set();
  const seenPorts = new Set();
  const products = [];
  const missing = [];
  const allowedRoot = path.resolve(root, '..');
  for (const entry of catalog.products) {
    if (!entry || !idPattern.test(String(entry.id || ''))) throw new Error('Every catalog product needs a lowercase stable ID.');
    if (seenIds.has(entry.id)) throw new Error(`Duplicate product ID: ${entry.id}`);
    seenIds.add(entry.id);
    if (!supportedAdapters.has(entry.adapter)) throw new Error(`${entry.id}: unsupported adapter ${entry.adapter}.`);
    if (!['required', 'optional'].includes(entry.packagePolicy)) throw new Error(`${entry.id}: packagePolicy must be required or optional.`);
    if (!entry.tile || typeof entry.tile.art !== 'string' || !entry.tile.art.startsWith('brand/')) throw new Error(`${entry.id}: tile.art must point into Instrumenta brand assets.`);
    if (!within(root, path.resolve(root, entry.tile.art))) throw new Error(`${entry.id}: tile artwork escapes Instrumenta.`);
    if (typeof entry.sourceDirectory !== 'string' || !entry.sourceDirectory) throw new Error(`${entry.id}: sourceDirectory is required.`);
    const sourceRoot = path.resolve(root, entry.sourceDirectory);
    if (!within(allowedRoot, sourceRoot)) throw new Error(`${entry.id}: sourceDirectory must remain inside the workspace parent.`);
    const manifestFile = path.join(sourceRoot, 'instrumenta', 'product.json');
    if (!fs.existsSync(sourceRoot) || !fs.existsSync(manifestFile)) {
      missing.push({ ...entry, sourceRoot, manifestFile });
      if (!allowMissing) throw new Error(`${entry.id}: missing product checkout or instrumenta/product.json at ${sourceRoot}.`);
      continue;
    }
    const manifest = validateManifest(readJson(manifestFile), sourceRoot, entry);
    const port = manifest.launch?.port;
    if (port && seenPorts.has(port)) throw new Error(`Duplicate web port: ${port}`);
    if (port) seenPorts.add(port);
    products.push(manifest);
  }
  return { schemaVersion: catalog.schemaVersion, catalogPath: file, products, missing };
}

function productById(registry, id) {
  return registry.products.find((product) => product.id === id) || null;
}

function registryFor(root = launcherRoot) {
  return loadCatalog({ root, allowMissing: true });
}

if (require.main === module) {
  try {
    const allowMissing = process.argv.includes('--allow-missing');
    const registry = loadCatalog({ allowMissing });
    process.stdout.write(`${JSON.stringify({ ready: true, products: registry.products.map(({ id, displayName, adapter, version }) => ({ id, displayName, adapter, version })), missing: registry.missing.map(({ id }) => id) }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Instrumenta product registry failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { catalogPath, loadCatalog, productById, registryFor, validateManifest, versionFromManifest };
