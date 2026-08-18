const fs = require('node:fs');
const path = require('node:path');
const { loadCatalog } = require('../scripts/product-registry.cjs');

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
    try { return loadCatalog({ root: catalogRoot(candidate), allowMissing: true }).missing.length === 0; } catch { return false; }
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

function motusBundle(bundleRoot) {
  if (!bundleRoot || !isDirectory(bundleRoot)) return null;
  const manifestPath = path.join(bundleRoot, 'motus-bundle.json');
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; }
  if (manifest.schemaVersion !== 1 || manifest.id !== 'motus' || typeof manifest.executable !== 'string') return null;
  if (path.basename(manifest.executable) !== manifest.executable || path.win32.basename(manifest.executable) !== manifest.executable) return null;
  const executable = path.join(bundleRoot, manifest.executable);
  if (!isFile(executable)) return null;
  return { executable, version: String(manifest.version || 'unknown'), root: bundleRoot };
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

function productState(product, workspace, resourcesPath) {
  const packagedRoot = resourcesPath
    ? firstDirectory([path.join(resourcesPath, 'apps', product.id), path.join(resourcesPath, 'apps', product.displayName)])
    : '';
  if (product.adapter === 'native-bundle') {
    const packaged = motusBundle(packagedRoot);
    const source = product.sourceRoot
      ? motusBundle(path.join(product.sourceRoot, 'dist', 'windows')) || motusBundle(path.join(product.sourceRoot, 'prebuilt', 'windows'))
      : null;
    const selected = packaged || source;
    const project = product.sourceRoot && isDirectory(product.sourceRoot);
    const state = selected ? 'READY' : project ? 'NEEDS BUILD' : 'CHOOSE WORKSPACE';
    return {
      id: product.id, displayName: product.displayName, kind: product.kind, adapter: product.adapter,
      version: product.version || selected?.version || 'unknown', state, ready: Boolean(selected),
      canPrepare: Boolean(project && isFile(path.join(product.sourceRoot, 'CMakeLists.txt')) && !packaged),
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
      if (manifest.schemaVersion !== 1 || manifest.id !== entry.id || manifest.adapter !== entry.adapter) {
        missing.push(entry);
        continue;
      }
      products.push({
        ...manifest,
        sourceRoot: packagedRoot,
        version: String(manifest.version || entry.version || 'unknown'),
        catalog: entry,
      });
    } catch {
      missing.push(entry);
    }
  }
  return { ...registry, products, missing };
}

function discover(workspace, resourcesPath = '', catalogBase = '') {
  const workspaceReady = Boolean(workspace) && isWorkspace(workspace);
  const registry = workspaceReady
    ? registryFor(workspace)
    : catalogBase && fs.existsSync(path.join(catalogBase, 'products', 'catalog.json'))
      ? loadCatalog({ root: catalogBase, allowMissing: true })
      : fallbackRegistry('');
  const hydratedRegistry = hydratePackagedProducts(registry, resourcesPath);
  const products = hydratedRegistry.products.map((product) => productState(product, workspace, resourcesPath));
  for (const missing of hydratedRegistry.missing) {
    products.push({
      id: missing.id, displayName: missing.id, kind: 'unknown', adapter: missing.adapter,
      version: 'unknown', state: 'CHOOSE WORKSPACE', ready: false, canPrepare: false,
      detail: 'Product is registered but its checkout or manifest is missing.', location: missing.sourceRoot,
      packaged: false, packagePolicy: missing.packagePolicy, sourceRoot: missing.sourceRoot, tile: missing.tile || {},
    });
  }
  const state = {
    workspace: workspaceReady ? path.resolve(workspace) : '', workspaceReady,
    products, registry: { schemaVersion: hydratedRegistry.schemaVersion, missing: hydratedRegistry.missing.map(({ id }) => id) },
  };
  for (const product of products) state[product.id] = product;
  return state;
}

module.exports = { discover, findWorkspace, isFile, isWorkspace, motusBundle, productState, registryFor };
