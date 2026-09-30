const fs = require('node:fs');
const path = require('node:path');
const { loadCatalog, releaseAdapters, releaseFor, validateManifest } = require('../scripts/product-registry.cjs');
const { resolveManagedInstall } = require('./release-lifecycle.cjs');
const { isNewer } = require('./update-check.cjs');

function isDirectory(candidate) {
  try { return fs.statSync(candidate).isDirectory(); } catch { return false; }
}

function isFile(candidate) {
  try { return fs.statSync(candidate).isFile(); } catch { return false; }
}

function catalogRoot(workspace) { return path.join(workspace, 'Instrumenta'); }

// A workspace is the launcher checkout with its catalog, plus at least one registered product
// checkout beside it. Which products those are is the owner's choice; only an entry marked
// `requiredForSuite` has to be present, and the catalog marks none.
function isWorkspace(candidate) {
  if (!candidate || !isDirectory(candidate)) return false;
  if (!isFile(path.join(catalogRoot(candidate), 'products', 'catalog.json'))) return false;
  try {
    const registry = loadCatalog({ root: catalogRoot(candidate), allowMissing: true });
    const checkouts = registry.products.length + registry.missing.filter((entry) => entry.reason).length;
    return checkouts > 0 && registry.missing.every((entry) => !entry.requiredForSuite);
  } catch { return false; }
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

function firstDirectory(candidates) {
  return candidates.find(isDirectory) || '';
}

function webBuild(product, packagedRoot) {
  const packaged = packagedRoot && isFile(path.join(packagedRoot, 'index.html')) ? packagedRoot : '';
  const sourceOutput = product.sourceRoot && product.build?.output
    ? path.join(product.sourceRoot, product.build.output)
    : '';
  // A static product is its own build; one delivered as managed-web keeps that in a workspace.
  const sourceRoot = (product.builtAs || product.adapter) === 'web-static' ? product.sourceRoot : '';
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

// What the update check learned about a release-backed product. `versions` is
// update-policy.cjs's knownVersions: `latest` the newest offered version per product,
// `releases` whether anything is published (null until a check answers), the download
// size and the oldest launcher that release accepts, and `launcher` this launcher's
// version. A release meant for a newer launcher is described, never offered.
function releaseFacts(product, versions) {
  const latestVersion = versions.latest?.[product.id] || '';
  const release = versions.releases?.[product.id] || null;
  const minimum = release?.minimumInstrumentaVersion || '';
  const needsLauncher = latestVersion && versions.launcher && minimum && isNewer(minimum, versions.launcher) ? minimum : '';
  return {
    latestVersion,
    needsLauncher,
    downloadSize: release?.downloadSize || 0,
    releasePublished: release ? release.published : null,
  };
}

function updateDetail(facts) {
  return facts.needsLauncher
    ? `A newer release, ${facts.latestVersion}, needs Instrumenta ${facts.needsLauncher} or newer.`
    : `A newer release, ${facts.latestVersion}, is available.`;
}

// Installing needs a repository and, once a check has answered, a published release.
// Until then Install stays offered; afterwards a product with nothing published says so.
// The version a copy baked into the installer was built at. package-windows stages a minimal
// package.json beside it (a managed-web release zip carries one too), which is where the
// manifest's versionSource already looks.
function bakedVersion(packagedRoot) {
  if (!packagedRoot) return '';
  try {
    return String(JSON.parse(fs.readFileSync(path.join(packagedRoot, 'package.json'), 'utf8').replace(/^\uFEFF/, '')).version || '');
  } catch {
    return '';
  }
}

function installable(product, facts) {
  return Boolean(product.release?.repository) && facts.releasePublished !== false;
}

const NOTHING_PUBLISHED = 'No release has been published yet.';

// `versions` carries what only an async pass can know: the newest published release
// per product, and `installed`, the version actually on this machine for an
// installed-desktop product. Both arrive from main.cjs; `discover` itself stays
// synchronous.
function productState(product, workspace, resourcesPath, installRoot = '', versions = {}) {
  const facts = releaseFacts(product, versions);
  const { latestVersion } = facts;
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
      canPrepare: Boolean(project && product.build?.command), canInstall: installable(product, facts),
      canUninstall: Boolean(managed), canRollback: Boolean(managed?.previous),
      // Only ever computed against a version actually resolved from disk, so a
      // missing or unreadable install reports "no update" rather than offering one.
      updateAvailable: Boolean(managed?.version && isNewer(latestVersion, managed.version) && !facts.needsLauncher),
      ...facts,
      detail: managed && isNewer(latestVersion, managed.version)
        ? updateDetail(facts)
        : managed
          ? `Managed release ${managed.version} is installed.`
          : developerExecutable ? 'Developer bundle is ready.'
            : facts.releasePublished === false ? NOTHING_PUBLISHED : 'Install the latest verified release or build the developer checkout.',
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
    const newer = Boolean(ready && probedVersion && isNewer(latestVersion, probedVersion));
    return {
      id: product.id, displayName: product.displayName, kind: 'native', adapter: product.adapter,
      version: probedVersion || product.version || 'unknown',
      installedVersion: ready ? probedVersion || product.version || 'unknown' : '',
      lifecycle: ready ? 'installed' : 'available', state: ready ? 'READY' : 'AVAILABLE', ready,
      canPrepare: false, canInstall: installable(product, facts), canUninstall: ready,
      updateAvailable: newer && !facts.needsLauncher, ...facts,
      detail: newer
        ? updateDetail(facts)
        : ready ? 'Installed desktop application is ready.'
          : facts.releasePublished === false ? NOTHING_PUBLISHED : 'Install the latest verified desktop release.',
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
    // A native product is prepared by its own Windows bootstrap script, which
    // says what preparing means for it (Fabula's deploys an Electron runtime).
    const preparable = Boolean(project) && isFile(path.join(product.sourceRoot, 'scripts', 'bootstrap-windows.ps1'));
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
    // A baked copy being served counts as installed at the version it was built at, so a newer
    // release updates it like any installed one (the baked copy stays as the fallback). Without
    // this a fresh install's web products never moved past the installer they came in.
    const baked = !managedRoot && build && build === packagedRoot ? bakedVersion(packagedRoot) : '';
    const current = managed?.version || baked;
    const newer = Boolean(current && isNewer(latestVersion, current));
    return {
      id: product.id, displayName: product.displayName, kind: 'web', adapter: product.adapter,
      version: current || product.version || 'unknown',
      installedVersion: current,
      lifecycle: managed ? 'installed' : ready ? 'bundled' : 'available',
      state: ready ? 'READY' : 'AVAILABLE', ready,
      canPrepare: Boolean(product.sourceRoot && isDirectory(product.sourceRoot) && product.build?.command && !managedRoot),
      canInstall: installable(product, facts),
      canUninstall: Boolean(managed), canRollback: Boolean(managed?.previous),
      updateAvailable: newer && !facts.needsLauncher, ...facts,
      detail: newer
        ? updateDetail(facts)
        : managed ? `Managed release ${managed.version} is installed.`
          : ready ? 'Bundled application ready'
            : facts.releasePublished === false ? NOTHING_PUBLISHED : 'Install the latest verified release.',
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

const EMPTY_REGISTRY = Object.freeze({ schemaVersion: 2, catalogPath: '', order: [], products: [], missing: [] });

function readCatalog(root) {
  if (!root || !isFile(path.join(root, 'products', 'catalog.json'))) return null;
  try { return loadCatalog({ root, allowMissing: true }); } catch { return null; }
}

/**
 * The registry half of discovery: which products exist and what their manifests say. The tiles,
 * installing, and update polling all read it, with the same arguments. Installing and polling used
 * to build their own from a workspace alone; on a machine without one (every end user's) that found
 * no catalog, fell back to a three-product list with no release-backed product in it, and turned
 * Install into "No release installer exists for forge3d".
 *
 * The catalog comes from the selected workspace when there is one, otherwise from the launcher's own
 * copy. Products without a checkout are then filled in from the builds baked into this installer and
 * from managed installs.
 */
function loadRegistry({ workspace = '', resourcesPath = '', catalogBase = '', installRoot = '' } = {}) {
  const workspaceReady = Boolean(workspace) && isWorkspace(workspace);
  const registry = (workspaceReady && readCatalog(catalogRoot(workspace))) || readCatalog(catalogBase) || EMPTY_REGISTRY;
  const hydrated = hydrateManagedProducts(hydratePackagedProducts(registry, resourcesPath), installRoot);
  return { ...hydrated, workspace: workspaceReady ? path.resolve(workspace) : '', workspaceReady };
}

/**
 * A release-backed product known only from its catalog entry: no checkout, nothing installed yet.
 * That is every end user's Forge3D and Luna, so this is the definition an install starts from.
 * Anything else without a checkout has nothing to install and gets no definition.
 */
function releaseDefinition(entry) {
  const release = entry && releaseAdapters.has(entry.adapter) ? releaseFor(entry) : null;
  if (!release) return null;
  const web = entry.adapter === 'managed-web';
  return {
    id: entry.id,
    displayName: entry.name || entry.id,
    version: String(entry.version || 'unknown'),
    kind: web ? 'web' : 'native',
    adapter: entry.adapter,
    sourceRoot: entry.sourceRoot || '',
    launch: web ? { type: 'web' } : { type: 'native', candidates: entry.launchCandidates || [] },
    release,
    versionProbe: entry.versionProbe || null,
    uninstall: entry.uninstall || null,
    catalog: entry,
  };
}

function inCatalogOrder(items, order = []) {
  const rank = new Map(order.map((id, index) => [id, index]));
  const position = (item) => (rank.has(item.id) ? rank.get(item.id) : order.length);
  return items.map((item, index) => ({ item, index }))
    .sort((left, right) => position(left.item) - position(right.item) || left.index - right.index)
    .map(({ item }) => item);
}

// Every product the launcher can act on, in catalog order: those whose manifest was read, then the
// release-backed ones known only from the catalog.
function productDefinitions(registry) {
  return inCatalogOrder([
    ...registry.products,
    ...registry.missing.map(releaseDefinition).filter(Boolean),
  ], registry.order);
}

// A registered product with no checkout and no release to install. Without a workspace that is a
// product run from source (Discere, Fabula): it exists for developers, not as something to install.
function unavailableProduct(entry, workspaceReady) {
  const developerOnly = !workspaceReady && !entry.reason;
  return {
    id: entry.id, displayName: entry.name || entry.id, kind: 'unknown', adapter: entry.adapter,
    version: 'unknown', lifecycle: developerOnly ? 'developer-only' : 'unavailable', state: 'CHOOSE WORKSPACE',
    ready: false, canPrepare: false, canInstall: false, canUninstall: false, updateAvailable: false,
    detail: entry.reason || (developerOnly
      ? `${entry.name || entry.id} runs from a source checkout. Choose a workspace that has one.`
      : 'Product is registered but its checkout or manifest is missing.'),
    location: entry.sourceRoot, packaged: false, packagePolicy: entry.packagePolicy,
    sourceRoot: entry.sourceRoot, tile: entry.tile || {},
  };
}

function discover(workspace, resourcesPath = '', catalogBase = '', installRoot = '', versions = {}) {
  const registry = loadRegistry({ workspace, resourcesPath, catalogBase, installRoot });
  const definitions = productDefinitions(registry);
  const defined = new Set(definitions.map(({ id }) => id));
  const products = inCatalogOrder([
    ...definitions.map((product) => productState(product, workspace, resourcesPath, installRoot, versions)),
    ...registry.missing.filter((entry) => !defined.has(entry.id)).map((entry) => unavailableProduct(entry, registry.workspaceReady)),
  ], registry.order);
  const state = {
    workspace: registry.workspace, workspaceReady: registry.workspaceReady,
    products, registry: { schemaVersion: registry.schemaVersion, missing: registry.missing.map(({ id }) => id) },
  };
  for (const product of products) state[product.id] = product;
  return state;
}

module.exports = {
  discover,
  expandCandidate,
  findWorkspace,
  isFile,
  isWorkspace,
  loadRegistry,
  nativeBundle,
  productDefinitions,
  productState,
  releaseDefinition,
};
