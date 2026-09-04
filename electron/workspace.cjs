const fs = require('node:fs');
const path = require('node:path');
const { loadCatalog, validateManifest } = require('../scripts/product-registry.cjs');
const { resolveManagedInstall } = require('./release-lifecycle.cjs');
const { isNewer } = require('./update-check.cjs');

const legacyProducts = [
  { id: 'motus', displayName: 'Motus', kind: 'native', adapter: 'native-bundle', sourceDirectory: 'Motus', packagePolicy: 'optional', requiredForSuite: true },
  { id: 'imago', displayName: 'Imago', kind: 'web', adapter: 'web-vite', sourceDirectory: 'Imago', packagePolicy: 'required', requiredForSuite: true, launch: { port: 49321 } },
  { id: 'ludere', displayName: 'Ludere', kind: 'web', adapter: 'web-static', sourceDirectory: 'Ludere', packagePolicy: 'required', requiredForSuite: true, launch: { port: 49322 } },
];

function isDirectory(candidate) {
  try { return fs.statSync(candidate).isDirectory(); } catch { return false; }
}

function isFile(candidate) {
  try { return fs.statSync(candidate).isFile(); } catch { return false; }
}

function catalogRoot(workspace) { return path.join(workspace, 'Instrumenta'); }

function legacyWorkspace(candidate) {
  return Boolean(candidate) && legacyProducts.every((product) => isDirectory(path.join(candidate, product.sourceDirectory)));
}

function isWorkspace(candidate) {
  if (!candidate || !isDirectory(candidate)) return false;
  const catalog = path.join(catalogRoot(candidate), 'products', 'catalog.json');
  if (isFile(catalog)) {
    try {
      return loadCatalog({ root: catalogRoot(candidate), allowMissing: true })
        .missing.every((entry) => !entry.requiredForSuite);
    } catch { return false; }
  }
  return legacyWorkspace(candidate);
}

function addAncestors(candidates, start, maximumDepth = 8) {
  if (!start) return;
  let current = path.resolve(start);
  for (let depth = 0; depth < maximumDepth; depth += 1) {
    candidates.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function findWorkspace(options = {}) {
  const configured = options.environmentWorkspace || options.configuredWorkspace;
  if (configured && isWorkspace(configured)) return path.resolve(configured);
  const candidates = [];
  addAncestors(candidates, options.cwd);
  addAncestors(candidates, options.appPath);
  addAncestors(candidates, options.executableDirectory);
  addAncestors(candidates, options.portableDirectory);
  return candidates.find(isWorkspace) || '';
}

// A deployed native bundle: `<id>-bundle.json` beside the executable it names.
// The manifest may carry `arguments`, passed to the executable on every launch
// and every runtime check \u2014 an Electron runtime, for instance, is only an
// application once it is handed the directory holding one.
function nativeBundle(bundleRoot, id) {
  if (!bundleRoot || !id || !isDirectory(bundleRoot)) return null;
  const manifestPath = path.join(bundleRoot, `${id}-bundle.json`);
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; }
  if (manifest.schemaVersion !== 1 || manifest.id !== id || typeof manifest.executable !== 'string') return null;
  if (path.basename(manifest.executable) !== manifest.executable || path.win32.basename(manifest.executable) !== manifest.executable) return null;
  const executable = path.join(bundleRoot, manifest.executable);
  if (!isFile(executable)) return null;
  let launchArguments = [];
  if (manifest.arguments !== undefined) {
    if (!Array.isArray(manifest.arguments)) return null;
    if (!manifest.arguments.every((argument) => typeof argument === 'string' && argument.length > 0)) return null;
    launchArguments = [...manifest.arguments];
  }
  return { executable, version: String(manifest.version || 'unknown'), root: bundleRoot, arguments: launchArguments };
}

function motusBundle(bundleRoot) {
  return nativeBundle(bundleRoot, 'motus');
}

function fallbackRegistry(workspace) {
  return {
    schemaVersion: 1,
    catalogPath: '',
    products: legacyProducts.map((product) => ({
      ...product,
      sourceRoot: path.join(workspace, product.sourceDirectory),
      version: '',
      build: product.id === 'motus'
        ? { output: 'dist/windows' }
        : { output: 'dist', command: product.id === 'imago' ? 'npm run build' : 'npm run build' },
      launch: product.launch || { type: product.kind },
      mcp: { skill: '' },
      assets: {},
    })),
    missing: [],
  };
}

function registryFor(workspace) {
  try {
    return loadCatalog({ root: catalogRoot(workspace), allowMissing: true });
  } catch {
    return fallbackRegistry(workspace);
  }
}

function firstDirectory(candidates) {
  return candidates.find(isDirectory) || '';
}

function webBuild(product, packagedRoot) {
  const packaged = packagedRoot && isFile(path.join(packagedRoot, 'index.html')) ? packagedRoot : '';
  const sourceOutput = product.sourceRoot && product.build?.output
    ? path.join(product.sourceRoot, product.build.output)
    : '';
  const sourceRoot = product.adapter === 'web-static' ? product.sourceRoot : '';
  return firstDirectory([packaged, sourceOutput, sourceRoot].filter((candidate) => candidate && isFile(path.join(candidate, 'index.html'))));
}

function expandCandidate(candidate, sourceRoot = '') {
  if (typeof candidate !== 'string' || !candidate) return '';
  const expanded = candidate.replace(/%([A-Z][A-Z0-9_]*)%/g, (_match, key) => process.env[key] || '');
  if (/%[A-Z][A-Z0-9_]*%/.test(expanded)) return '';
  const platformPath = process.platform === 'win32' ? expanded : expanded.replace(/\\/g, path.sep);
  if (path.isAbsolute(platformPath) || path.win32.isAbsolute(platformPath)) return path.normalize(platformPath);
  return sourceRoot ? path.resolve(sourceRoot, platformPath) : '';
}

function firstFile(candidates) {
  return candidates.find((candidate) => candidate && isFile(candidate)) || '';
}

// `versions` carries what only an async pass can know: `latest` is the newest
// published release per product, `installed` the version actually on this machine
// for an installed-desktop product. Both arrive from update-check.cjs; `discover`
// itself stays synchronous.
function productState(product, workspace, resourcesPath, installRoot = '', versions = {}) {
  const latestVersion = versions.latest?.[product.id] || '';
  const packagedRoot = resourcesPath
    ? firstDirectory([path.join(resourcesPath, 'apps', product.id), path.join(resourcesPath, 'apps', product.displayName)])
    : '';
  if (product.adapter === 'managed-bundle') {
    const managed = installRoot ? resolveManagedInstall(installRoot, product.id) : null;
    const developerExecutable = firstFile((product.launch?.candidates || []).map((candidate) => expandCandidate(candidate, product.sourceRoot)));
    const executable = managed?.executable || developerExecutable;
    const project = Boolean(product.sourceRoot && isDirectory(product.sourceRoot));
    const ready = Boolean(executable);
    return {
      id: product.id, displayName: product.displayName, kind: 'native', adapter: product.adapter,
      version: managed?.version || product.version || 'unknown',
      installedVersion: managed?.version || '', lifecycle: ready ? 'installed' : 'available',
      state: ready ? 'READY' : 'AVAILABLE', ready,
      canPrepare: Boolean(project && product.build?.command), canInstall: Boolean(product.release?.repository),
      canUninstall: Boolean(managed), canRollback: Boolean(managed?.previous),
      // Only ever computed against a version actually resolved from disk, so a
      // missing or unreadable install reports "no update" rather than offering one.
      updateAvailable: Boolean(managed?.version && isNewer(latestVersion, managed.version)),
      latestVersion,
      detail: managed && isNewer(latestVersion, managed.version)
        ? `A newer release, ${latestVersion}, is available.`
        : managed
          ? `Managed release ${managed.version} is installed.`
          : developerExecutable ? 'Developer bundle is ready.' : 'Install the latest verified release or build the developer checkout.',
      location: executable || product.sourceRoot || '', packaged: Boolean(managed),
      packagePolicy: product.catalog?.packagePolicy || 'optional', sourceRoot: product.sourceRoot || '',
      tile: product.catalog?.tile || {}, release: product.release || null, pending: Boolean(managed?.pending),
    };
  }
  if (product.adapter === 'installed-desktop') {
    const executable = firstFile((product.launch?.candidates || []).map((candidate) => expandCandidate(candidate, product.sourceRoot)));
    const project = Boolean(product.sourceRoot && isDirectory(product.sourceRoot));
    const ready = Boolean(executable);
    // The catalog version is only what this build of the launcher shipped knowing.
    // Update state is computed from the probed version or not at all -- comparing
    // a release against a static catalog number would report an update forever.
    const probedVersion = versions.installed?.[product.id] || '';
    const updateAvailable = Boolean(ready && probedVersion && isNewer(latestVersion, probedVersion));
    return {
      id: product.id, displayName: product.displayName, kind: 'native', adapter: product.adapter,
      version: probedVersion || product.version || 'unknown',
      installedVersion: ready ? probedVersion || product.version || 'unknown' : '',
      lifecycle: ready ? 'installed' : 'available', state: ready ? 'READY' : 'AVAILABLE', ready,
      canPrepare: false, canInstall: Boolean(product.release?.repository), canUninstall: ready,
      updateAvailable, latestVersion,
      detail: updateAvailable
        ? `A newer release, ${latestVersion}, is available.`
        : ready ? 'Installed desktop application is ready.' : 'Install the latest verified desktop release.',
      location: executable || product.sourceRoot || '', packaged: ready && !project,
      packagePolicy: product.catalog?.packagePolicy || 'optional', sourceRoot: product.sourceRoot || '',
      tile: product.catalog?.tile || {}, release: product.release || null,
    };
  }
  if (product.adapter === 'native-bundle') {
    const packaged = nativeBundle(packagedRoot, product.id);
    const source = product.sourceRoot
      ? nativeBundle(path.join(product.sourceRoot, 'dist', 'windows'), product.id)
        || nativeBundle(path.join(product.sourceRoot, 'prebuilt', 'windows'), product.id)
      : null;
    const selected = packaged || source;
    const project = product.sourceRoot && isDirectory(product.sourceRoot);
    const state = selected ? 'READY' : project ? 'NEEDS BUILD' : 'CHOOSE WORKSPACE';
    // A product can be prepared from source by a CMake tree (Motus) or by its
    // own Windows bootstrap script (Fabula deploys an Electron runtime).
    const preparable = Boolean(project) && (
      isFile(path.join(product.sourceRoot, 'CMakeLists.txt'))
      || isFile(path.join(product.sourceRoot, 'scripts', 'bootstrap-windows.ps1'))
    );
    return {
      id: product.id, displayName: product.displayName, kind: product.kind, adapter: product.adapter,
      version: product.version || selected?.version || 'unknown', state, ready: Boolean(selected),
      canPrepare: preparable && !packaged,
      launchArguments: selected?.arguments ?? [],
      detail: selected
        ? `${packaged ? 'Bundled' : 'Deployed'} native application ${selected.version} ready`
        : project ? 'Source found. Prepare a verified portable bundle, then launch it here.' : 'Choose the workspace containing this product.',
      location: selected?.executable || product.sourceRoot || '',
      packaged: Boolean(packaged),
      packagePolicy: product.catalog?.packagePolicy || 'optional',
      sourceRoot: product.sourceRoot || '',
      tile: product.catalog?.tile || {},
    };
  }

  if (product.adapter === 'managed-web') {
    const managed = installRoot ? resolveManagedInstall(installRoot, product.id) : null;
    const managedRoot = managed?.root && isFile(path.join(managed.root, 'index.html')) ? managed.root : '';
    // Resolution order is deliberate and additive: a managed release wins, then the
    // copy baked into this installer, then a local build. Giving a product a release
    // must never strand the build that already ships inside the launcher.
    const build = managedRoot || webBuild(product, packagedRoot);
    const ready = Boolean(build);
    const updateAvailable = Boolean(managed?.version && isNewer(latestVersion, managed.version));
    return {
      id: product.id, displayName: product.displayName, kind: 'web', adapter: product.adapter,
      version: managed?.version || product.version || 'unknown',
      installedVersion: managed?.version || '',
      lifecycle: managed ? 'installed' : ready ? 'bundled' : 'available',
      state: ready ? 'READY' : 'AVAILABLE', ready,
      canPrepare: Boolean(product.sourceRoot && isDirectory(product.sourceRoot) && product.build?.command && !managedRoot),
      canInstall: Boolean(product.release?.repository),
      canUninstall: Boolean(managed), canRollback: Boolean(managed?.previous),
      updateAvailable, latestVersion,
      detail: updateAvailable
        ? `A newer release, ${latestVersion}, is available.`
        : managed ? `Managed release ${managed.version} is installed.`
          : ready ? 'Bundled application ready'
            : 'Install the latest verified release.',
      location: build || product.sourceRoot || '', packaged: Boolean(build) && build === packagedRoot,
      packagePolicy: product.catalog?.packagePolicy || 'optional', sourceRoot: product.sourceRoot || '',
      tile: product.catalog?.tile || {}, release: product.release || null,
      pending: Boolean(managed?.pending), port: product.launch?.port || 0,
    };
  }

  const build = webBuild(product, packagedRoot);
  const project = product.sourceRoot && isDirectory(product.sourceRoot);
  const packaged = Boolean(build && packagedRoot && build === packagedRoot);
  // A managed service is launched from its own checkout, so its installed
  // dependencies are part of readiness, not just its built client bundle.
  const dependencies = product.adapter !== 'web-service'
    || Boolean(product.sourceRoot && isDirectory(path.join(product.sourceRoot, 'node_modules')));
  const ready = Boolean(build) && dependencies;
  return {
    id: product.id, displayName: product.displayName, kind: product.kind, adapter: product.adapter,
    version: product.version || 'unknown', state: ready ? 'READY' : project ? 'NEEDS BUILD' : 'CHOOSE WORKSPACE',
    ready, canPrepare: Boolean(project && !packaged && product.build?.command),
    detail: ready ? `${packaged ? 'Bundled' : 'Local'} application ready` : project ? 'Source found. Prepare this product once, then open it here.' : 'Choose the workspace containing this product.',
    location: build || product.sourceRoot || '', packaged,
    packagePolicy: product.catalog?.packagePolicy || 'required', sourceRoot: product.sourceRoot || '',
    tile: product.catalog?.tile || {},
    port: product.launch?.port || 0,
  };
}

function packagedProductRoot(resourcesPath, product) {
  if (!resourcesPath || !product) return '';
  const displayName = product.displayName || product.id;
  return firstDirectory([
    path.join(resourcesPath, 'apps', product.id),
    path.join(resourcesPath, 'apps', displayName),
  ].filter((candidate) => isFile(path.join(candidate, 'instrumenta', 'product.json'))));
}

// A managed-web release carries its own instrumenta/product.json, so once installed
// the launch port and CSP profile come from the product itself rather than being
// duplicated into the catalog and left to drift.
function hydrateManagedProducts(registry, installRoot) {
  if (!installRoot || !registry?.missing?.length) return registry;
  const products = [...registry.products];
  const missing = [];
  for (const entry of registry.missing) {
    const managed = entry.adapter === 'managed-web' ? resolveManagedInstall(installRoot, entry.id) : null;
    const manifestFile = managed?.root ? path.join(managed.root, 'instrumenta', 'product.json') : '';
    if (!manifestFile || !isFile(manifestFile)) {
      missing.push(entry);
      continue;
    }
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8').replace(/^\uFEFF/, ''));
      products.push(validateManifest(manifest, managed.root, entry));
    } catch {
      missing.push(entry);
    }
  }
  return { ...registry, products, missing };
}

function hydratePackagedProducts(registry, resourcesPath) {
  if (!resourcesPath || !registry?.missing?.length) return registry;
  const products = [...registry.products];
  const missing = [];
  for (const entry of registry.missing) {
    const packagedRoot = packagedProductRoot(resourcesPath, entry);
    if (!packagedRoot) {
      missing.push(entry);
      continue;
    }
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(packagedRoot, 'instrumenta', 'product.json'), 'utf8').replace(/^\uFEFF/, ''));
      products.push(validateManifest(manifest, packagedRoot, entry));
    } catch {
      missing.push(entry);
    }
  }
  return { ...registry, products, missing };
}

function discover(workspace, resourcesPath = '', catalogBase = '', installRoot = '', versions = {}) {
  const workspaceReady = Boolean(workspace) && isWorkspace(workspace);
  const registry = workspaceReady
    ? registryFor(workspace)
    : catalogBase && fs.existsSync(path.join(catalogBase, 'products', 'catalog.json'))
      ? loadCatalog({ root: catalogBase, allowMissing: true })
      : fallbackRegistry('');
  const hydratedRegistry = hydrateManagedProducts(hydratePackagedProducts(registry, resourcesPath), installRoot);
  const products = hydratedRegistry.products.map((product) => productState(product, workspace, resourcesPath, installRoot, versions));
  for (const missing of hydratedRegistry.missing) {
    const releaseCapable = ['managed-bundle', 'managed-web', 'installed-desktop'].includes(missing.adapter);
    if (releaseCapable) {
      products.push(productState({
        id: missing.id,
        displayName: missing.name || missing.id,
        version: String(missing.version || 'unknown'),
        kind: missing.adapter === 'managed-web' ? 'web' : 'native',
        adapter: missing.adapter,
        sourceRoot: missing.sourceRoot || '',
        launch: { type: 'native', candidates: missing.launchCandidates || [] },
        release: {
          repository: missing.repository,
          manifestAsset: missing.releaseManifestAsset || 'instrumenta-release.json',
        },
        versionProbe: missing.versionProbe || null,
        uninstall: missing.uninstall || null,
        catalog: missing,
      }, workspace, resourcesPath, installRoot, versions));
      continue;
    }
    products.push({
      id: missing.id, displayName: missing.name || missing.id, kind: 'unknown', adapter: missing.adapter,
      version: 'unknown', lifecycle: 'unavailable', state: 'CHOOSE WORKSPACE', ready: false, canPrepare: false,
      canInstall: false, canUninstall: false, updateAvailable: false,
      detail: missing.reason || 'Product is registered but its checkout or manifest is missing.',
      location: missing.sourceRoot, packaged: false, packagePolicy: missing.packagePolicy,
      sourceRoot: missing.sourceRoot, tile: missing.tile || {},
    });
  }
  const state = {
    workspace: workspaceReady ? path.resolve(workspace) : '', workspaceReady,
    products, registry: { schemaVersion: hydratedRegistry.schemaVersion, missing: hydratedRegistry.missing.map(({ id }) => id) },
  };
  for (const product of products) state[product.id] = product;
  return state;
}

module.exports = { discover, expandCandidate, findWorkspace, isFile, isWorkspace, motusBundle, nativeBundle, productState, registryFor };
