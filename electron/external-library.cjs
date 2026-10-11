'use strict';

// The external app library: open-source apps other people make, installed and kept up to date by
// Instrumenta for convenience, and never presented as Instrumenta products.
//
// Where things live
//
//   <library root>\<app id>\current.json                     which version is current, which previous
//   <library root>\<app id>\versions\<version>\<app>.exe     the app's own files, lifted out of its zip
//   %LOCALAPPDATA%\Instrumenta\downloads\library\<id>\<v>     the download, deleted once installed
//   %LOCALAPPDATA%\Instrumenta\update-cache\library\           newest-release cache and discovery cache
//
// The library root defaults to %LOCALAPPDATA%\Instrumenta\library and can be changed in the
// launcher. Changing it applies to new installs only: an app already installed stays where it is,
// keeps updating there, and is shown with its own path. Each installed app's root is recorded in
// settings.json (`library.apps.<id>.root`), and every location the library has used is remembered
// (`library.previousLocations`), so an installed copy is always found again even if a record is lost.
//
// The install itself is release-installer's: the same download with Range resume, free-space check,
// GitHub-only hosts, size and SHA-256 verification before extraction, versioned folders with the
// previous version kept, pruning, and rollback. What is particular to these apps is in
// external-sources.cjs (finding a release and synthesising its manifest) and here (the archive's
// top-level folder, the weaker launch check, and where the files go).

const fs = require('./plain-fs.cjs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const {
  ensureFreeSpace,
  installLatestProduct,
  planArchiveExtraction,
} = require('./release-installer.cjs');
const {
  confirmManagedVersion,
  resolveManagedInstall,
  rollbackManagedVersion,
} = require('./release-lifecycle.cjs');
const {
  DEFAULT_TTL_MS,
  cachedRelease,
  isNewer,
  readVersionCache,
  refreshReleaseVersions,
} = require('./update-check.cjs');
const {
  autoUpdateFor,
  decide,
  downloadSize,
  isSkipped,
  readPreferences,
  skipVersion,
  unskipVersion,
} = require('./update-policy.cjs');
const { directorySize } = require('./storage-report.cjs');
const {
  ADAPTER,
  archiveRootFor,
  cachedSuggestions,
  discoveredApp,
  loadSources,
  refreshDiscovery,
  resolveLatest,
  suggestedName,
} = require('./external-sources.cjs');

const JOB_PREFIX = 'library:';
const idPattern = /^[a-z][a-z0-9-]*$/;
const repoPattern = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$/;
// The executable cannot answer Instrumenta's launch handshake, so a first launch counts as working
// when the process is still running this long after it started.
const LIVENESS_MS = 4000;
const MAX_PREVIOUS_LOCATIONS = 20;

// ---- Layout and settings ----------------------------------------------------------------------

/**
 * Where the library keeps things, beside the launcher's own folders under
 * %LOCALAPPDATA%\Instrumenta: the default root, its own update cache (a separate file, so an app ID
 * can never be mistaken for a suite product's) and its downloads.
 */
function libraryLayout({ installRoot, downloadsRoot, updateCacheRoot }) {
  return {
    defaultRoot: path.join(path.dirname(path.resolve(installRoot)), 'library'),
    cacheRoot: path.join(path.resolve(updateCacheRoot), 'library'),
    downloadsRoot: path.join(path.resolve(downloadsRoot), 'library'),
  };
}

function pathApi(platform) {
  return platform === 'win32' ? path.win32 : path.posix;
}

function absolute(value, platform = process.platform) {
  return typeof value === 'string' && value.length < 1024 && !/[\x00-\x1f]/.test(value) && pathApi(platform).isAbsolute(value)
    ? pathApi(platform).resolve(value)
    : '';
}

function samePath(a, b, platform = process.platform) {
  if (!a || !b) return false;
  const api = pathApi(platform);
  const left = api.resolve(a);
  const right = api.resolve(b);
  return platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function inside(root, candidate, platform = process.platform) {
  const api = pathApi(platform);
  const fold = (value) => (platform === 'win32' ? api.resolve(value).toLowerCase() : api.resolve(value));
  const relative = api.relative(fold(root), fold(candidate));
  return relative === '' || (!relative.startsWith('..') && !api.isAbsolute(relative));
}

function uniquePaths(values, platform) {
  const result = [];
  for (const value of values) {
    if (value && !result.some((existing) => samePath(existing, value, platform))) result.push(value);
  }
  return result;
}

/**
 * `settings.library`, normalised. Anything malformed is dropped rather than trusted: this is read
 * on every state and the file is the person's to edit.
 */
function librarySettings(settings = {}, platform = process.platform) {
  const raw = settings?.library && typeof settings.library === 'object' && !Array.isArray(settings.library) ? settings.library : {};
  const apps = {};
  if (raw.apps && typeof raw.apps === 'object' && !Array.isArray(raw.apps)) {
    for (const [id, entry] of Object.entries(raw.apps)) {
      if (!idPattern.test(id) || !entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      apps[id] = { ...entry };
      if (entry.root !== undefined) {
        const root = absolute(entry.root, platform);
        if (root) apps[id].root = root;
        else delete apps[id].root;
      }
    }
  }
  const lists = (value, check) => {
    const result = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    for (const [source, items] of Object.entries(value)) {
      if (!idPattern.test(source) || !Array.isArray(items)) continue;
      result[source] = items.filter(check).slice(0, 100);
    }
    return result;
  };
  return {
    location: absolute(raw.location, platform),
    previousLocations: Array.isArray(raw.previousLocations)
      ? uniquePaths(raw.previousLocations.map((value) => absolute(value, platform)), platform).slice(-MAX_PREVIOUS_LOCATIONS)
      : [],
    apps,
    added: lists(raw.added, (item) => item && typeof item === 'object' && repoPattern.test(String(item.repo || ''))),
    dismissed: lists(raw.dismissed, (item) => typeof item === 'string' && repoPattern.test(item)),
  };
}

function withLibrary(settings, change) {
  const current = settings?.library && typeof settings.library === 'object' && !Array.isArray(settings.library) ? settings.library : {};
  const next = change({ ...current });
  return { ...settings, library: next };
}

function withApp(settings, id, change) {
  return withLibrary(settings, (library) => {
    const apps = library.apps && typeof library.apps === 'object' && !Array.isArray(library.apps) ? { ...library.apps } : {};
    const entry = change(apps[id] && typeof apps[id] === 'object' ? { ...apps[id] } : {});
    if (!entry || !Object.keys(entry).length) delete apps[id];
    else apps[id] = entry;
    return { ...library, apps };
  });
}

// The update preferences of library apps: the launcher's one automatic-updates switch, and each
// app's own override and skipped versions, read by update-policy exactly as a product's are.
function libraryPreferences(settings = {}) {
  return readPreferences({ autoUpdate: settings?.autoUpdate, products: librarySettings(settings).apps });
}

function currentLocation(settings, layout, platform = process.platform) {
  return librarySettings(settings, platform).location || layout.defaultRoot;
}

/**
 * The library root a new location may be: an absolute folder that is none of the launcher's own
 * (its products, downloads, caches, or its installed program), neither inside nor around one of
 * them, and not inside an installed app's folder. Returns the resolved path, or throws why not.
 */
function validateLocation(candidate, { forbidden = [], appFolders = [], platform = process.platform } = {}) {
  const location = absolute(candidate, platform);
  if (!location) throw new Error('Choose a folder by its full path.');
  if (pathApi(platform).parse(location).root === location) throw new Error('Choose a folder rather than the top of a drive.');
  for (const root of forbidden.filter(Boolean)) {
    if (inside(root, location, platform) || inside(location, root, platform)) {
      throw new Error(`That folder is one Instrumenta keeps for itself (${root}). Choose another.`);
    }
  }
  for (const folder of appFolders.filter(Boolean)) {
    if (inside(folder, location, platform)) throw new Error(`That folder is inside an installed app (${folder}). Choose another.`);
  }
  return location;
}

/**
 * Settings with the library moved to `location` for new installs. The location being left is
 * remembered, and every app found installed is pinned to the root it is in, so nothing installed
 * before the change is lost track of. `location` '' returns to the default.
 */
function changeLocation(settings, location, { installed = {}, layout, platform = process.platform } = {}) {
  const before = currentLocation(settings, layout, platform);
  let next = settings;
  for (const [id, root] of Object.entries(installed)) {
    next = withApp(next, id, (entry) => ({ ...entry, root }));
  }
  return withLibrary(next, (library) => {
    const previous = Array.isArray(library.previousLocations) ? library.previousLocations : [];
    const updated = { ...library, previousLocations: uniquePaths([...previous, before], platform).slice(-MAX_PREVIOUS_LOCATIONS) };
    if (!location || samePath(location, layout.defaultRoot, platform)) delete updated.location;
    else updated.location = location;
    return updated;
  });
}

// ---- Apps -------------------------------------------------------------------------------------

/**
 * Every app the library lists: each source's curated apps, then the ones the person added from
 * "New from <source>", which go through the same validation and may not reuse an ID.
 */
function libraryApps(sources, settings = {}) {
  const library = librarySettings(settings);
  const apps = [];
  const taken = new Set();
  for (const source of sources) {
    for (const app of source.apps) {
      apps.push({ ...app, source });
      taken.add(app.id);
    }
  }
  for (const source of sources) {
    for (const entry of library.added[source.id] || []) {
      if (source.apps.some((app) => app.repo.toLowerCase() === String(entry.repo).toLowerCase())) continue;
      const app = discoveredApp(source, entry, taken);
      if (!app) continue;
      apps.push({ ...app, source });
      taken.add(app.id);
    }
  }
  return apps;
}

function definitionFor(app) {
  return {
    id: app.id,
    displayName: app.name,
    adapter: ADAPTER,
    release: { repository: { provider: 'github', owner: app.source.owner, name: app.repo, channel: 'stable' } },
  };
}

function candidateRoots(settings, layout, id, platform = process.platform) {
  const library = librarySettings(settings, platform);
  return uniquePaths([
    library.apps[id]?.root,
    library.location,
    layout.defaultRoot,
    ...library.previousLocations.slice().reverse(),
  ], platform);
}

/**
 * Where an app is installed: the first candidate root holding a valid current version of it, as
 * `{ root, folder, install }`, or null. `folder` is `<root>\<id>`, the folder Open folder shows and
 * uninstalling removes.
 */
function locateInstall(id, roots, { forbidden = [], platform = process.platform } = {}) {
  for (const root of roots) {
    if (forbidden.some((blocked) => blocked && (inside(blocked, root, platform) || inside(root, blocked, platform)))) continue;
    const install = resolveManagedInstall(root, id);
    if (install) return { root, folder: path.join(root, id), install };
  }
  return null;
}

// ---- Extraction -------------------------------------------------------------------------------

function waitForChild(child, label) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${label} exited with code ${code}.`))));
  });
}

// Windows' own Expand-Archive, as release-installer uses for Forge3D. Off Windows (development
// only) `unzip`, so the path can be exercised on Linux.
async function defaultExtract(archive, destination) {
  fs.mkdirSync(destination, { recursive: true });
  if (process.platform === 'win32') {
    const plan = planArchiveExtraction(archive, destination);
    await waitForChild(spawn(plan.command, plan.args, plan.options), 'Archive extraction');
    return;
  }
  await waitForChild(spawn('unzip', ['-q', '-o', archive, '-d', destination], { stdio: 'ignore' }), 'Archive extraction');
}

function treeSize(root) {
  let total = 0;
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile()) total += fs.statSync(target).size;
    }
  };
  visit(root);
  return total;
}

/**
 * Unpacks a portable archive so that `destination` holds the app's files directly. These zips
 * carry one top-level folder (`photocraft-0.5.0-windows-x64-portable\`); it is lifted out, so the
 * version folder is `versions\0.5.0\photocraft.exe` and its entry point is a plain file name like
 * every other managed bundle's. An archive without that folder is refused. The library's drive is
 * checked for room for the unpacked files before they are copied there.
 */
async function extractPortable(archive, destination, { root = '', installRoot = '', extract = defaultExtract } = {}) {
  const staging = `${destination}.archive`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.rmSync(destination, { recursive: true, force: true });
  try {
    await extract(archive, staging);
    let source = staging;
    if (root) {
      const top = path.join(staging, root);
      let stat = null;
      try { stat = fs.lstatSync(top); } catch { /* reported below */ }
      if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`The archive does not hold the ${root} folder it should.`);
      source = top;
    }
    if (installRoot) ensureFreeSpace(installRoot, treeSize(source));
    fs.renameSync(source, destination);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

// ---- The controller main.cjs wires to the window --------------------------------------------

/**
 * Everything the launcher window can ask of the library. Electron and the launcher's own state come
 * in as `deps`, so this file loads in the Node tests.
 *
 *   deps.sourcesDirectory   products/sources
 *   deps.storage()          { installRoot, downloadsRoot, updateCacheRoot } (storage.cjs)
 *   deps.getSettings()      the launcher's settings object; deps.setSettings(next) saves it
 *   deps.queue              the launcher's install queue (install-queue.cjs)
 *   deps.launcherVersion    app.getVersion()
 *   deps.forbiddenRoots()   folders the library may never be put in
 *   deps.confirm(options)   resolves true when the person agrees
 *   deps.chooseFolder(path) resolves a chosen folder or ''
 *   deps.openPath, deps.openExternal, deps.trashItem, deps.getFileIcon
 *   deps.notify()           tells the window the library changed
 *   deps.spawnExecutable, deps.assertTrustedExecutable (native-launch.cjs)
 *   deps.network            { transport, headTransport } for tests
 */
function createExternalLibrary(deps) {
  const platform = deps.platform || process.platform;
  const processes = new Map();
  const icons = new Map();
  const report = (event, details) => { try { deps.diagnostics?.write(event, details); } catch { /* never fatal */ } };
  let sourcesCache = null;

  function sources() {
    if (!sourcesCache) {
      try {
        sourcesCache = loadSources(deps.sourcesDirectory);
      } catch (error) {
        report('library-sources-invalid', { error });
        sourcesCache = [];
      }
    }
    return sourcesCache;
  }

  const layout = () => libraryLayout(deps.storage());
  const settings = () => deps.getSettings() || {};
  const forbidden = () => {
    const storage = deps.storage();
    return [storage.installRoot, storage.downloadsRoot, storage.updateCacheRoot, ...(deps.forbiddenRoots?.() || [])].filter(Boolean);
  };
  const apps = () => libraryApps(sources(), settings());
  const appFor = (id) => apps().find((app) => app.id === id) || null;
  const jobId = (id) => `${JOB_PREFIX}${id}`;

  function requireApp(id) {
    const app = typeof id === 'string' ? appFor(id) : null;
    if (!app) throw new Error(`Unknown library app: ${id}`);
    return app;
  }

  function locate(app) {
    return locateInstall(app.id, candidateRoots(settings(), layout(), app.id, platform), { forbidden: forbidden(), platform });
  }

  function save(next) {
    deps.setSettings(next);
  }

  function isRunning(id) {
    const children = processes.get(id);
    return Boolean(children && [...children].some((child) => child.exitCode === null && !child.killed));
  }

  // Records where each installed app was found, so a later location change or a lost record never
  // loses one. Writes only when something changed.
  function pinInstalled() {
    let next = settings();
    let changed = false;
    for (const app of apps()) {
      const found = locate(app);
      if (!found) continue;
      const recorded = librarySettings(next, platform).apps[app.id]?.root;
      if (samePath(recorded, found.root, platform)) continue;
      next = withApp(next, app.id, (entry) => ({ ...entry, root: found.root }));
      changed = true;
    }
    if (changed) save(next);
  }

  function installedRoots() {
    const result = {};
    for (const app of apps()) {
      const found = locate(app);
      if (found) result[app.id] = found.root;
    }
    return result;
  }

  // ---- Update checks and policy ----

  async function checkUpdates({ force = false } = {}) {
    const list = apps();
    const bySource = new Map(list.map((app) => [app.id, app]));
    const { cacheRoot } = layout();
    try {
      await refreshReleaseVersions({
        products: list.map(definitionFor),
        cacheRoot,
        force,
        fetchLatest: (definition) => resolveLatest(bySource.get(definition.id).source, bySource.get(definition.id), deps.network || {}),
      });
    } catch (error) {
      report('library-update-check-failed', { error });
    }
    try {
      const library = librarySettings(settings(), platform);
      const known = Object.fromEntries(Object.entries(library.added).map(([source, items]) => [source, items.map((item) => item.repo)]));
      await refreshDiscovery({ sources: sources(), cacheRoot, known, dismissed: library.dismissed, ttl: deps.ttl ?? DEFAULT_TTL_MS, options: deps.network || {} });
    } catch (error) {
      report('library-discovery-failed', { error });
    }
    try { pinInstalled(); } catch (error) { report('library-pin-failed', { error }); }
    applyPolicy();
    deps.notify?.();
  }

  /**
   * Acts on each installed app's newest release the way the suite's are acted on: installed now,
   * fetched to go in once the app is closed, offered, or left alone. An app nobody installed is
   * never installed automatically.
   */
  function applyPolicy(ids = null) {
    const cache = readVersionCache(layout().cacheRoot);
    const preferences = libraryPreferences(settings());
    for (const app of apps()) {
      if (ids && !ids.includes(app.id)) continue;
      const entry = cache[app.id];
      if (!entry?.version || deps.queue.has(jobId(app.id))) continue;
      const found = locate(app);
      if (!found) continue;
      const { action } = decide({
        id: app.id,
        installedVersion: found.install.version,
        latest: { version: entry.version, minimumInstrumentaVersion: entry.manifest?.minimumInstrumentaVersion, downloadSize: downloadSize(entry.manifest) },
        running: isRunning(app.id),
        preferences,
        launcherVersion: deps.launcherVersion,
      });
      if (action === 'install' || action === 'download') deps.queue.enqueue(jobId(app.id), { kind: action });
    }
  }

  // ---- Installing ----

  const ownsJob = (id) => typeof id === 'string' && id.startsWith(JOB_PREFIX);

  async function runJob(job, onProgress) {
    const app = requireApp(job.id.slice(JOB_PREFIX.length));
    const found = locate(app);
    // An installed app updates where it is; a new one goes to the current location.
    const root = found ? found.root : currentLocation(settings(), layout(), platform);
    const { cacheRoot, downloadsRoot } = layout();
    try {
      let latest = cachedRelease(cacheRoot, app.id);
      if (!latest) {
        const resolved = await resolveLatest(app.source, app, deps.network || {});
        latest = { manifest: resolved.manifest, tag: resolved.tag };
      }
      const archiveRoot = archiveRootFor(app.source, app, latest.manifest);
      const result = await installLatestProduct(definitionFor(app), {
        ...(deps.network || {}),
        latest,
        launcherVersion: deps.launcherVersion,
        cacheRoot: downloadsRoot,
        installRoot: root,
        activate: job.kind === 'install',
        onProgress: (progress) => onProgress(progress),
        extractZip: (archive, destination) => extractPortable(archive, destination, { root: archiveRoot, installRoot: root, extract: deps.extract }),
      });
      if (job.kind === 'install') {
        let next = withApp(settings(), app.id, (entry) => ({ ...entry, root }));
        // Installing a version rolled back from, on purpose, is the person changing their mind.
        if (job.explicit) {
          const unskipped = unskipVersion({ products: librarySettings(next, platform).apps }, app.id, result.version).products || {};
          next = withLibrary(next, (library) => ({ ...library, apps: unskipped }));
        }
        save(next);
        icons.clear();
        report('library-app-installed', { app: app.id, version: result.version, root, reused: Boolean(result.reused) });
        deps.notify?.();
      }
      return result;
    } catch (error) {
      report('library-app-install-failed', { app: app.id, kind: job.kind, error });
      deps.notify?.();
      throw error;
    }
  }

  // Install (or update) the apps someone picked. Each is queued at once; one failure does not stop
  // the others, and each is named in the error.
  async function install(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length || !list.every((id) => typeof id === 'string' && idPattern.test(id))) throw new Error('Choose at least one app to install.');
    const unique = [...new Set(list)].map(requireApp);
    const results = await Promise.allSettled(unique.map((app) => deps.queue.enqueue(jobId(app.id), { kind: 'install', explicit: true })));
    const failures = results
      .map((result, index) => (result.status === 'rejected' ? `Could not install ${unique[index].name}.\n\n${result.reason?.message || result.reason}` : ''))
      .filter(Boolean);
    deps.notify?.();
    if (failures.length) throw new Error(failures.join('\n\n'));
    return results.map((result) => result.value);
  }

  // ---- Opening ----

  function rollBack(app, found, reason) {
    try {
      rollbackManagedVersion(found.root, app.id);
      save(withLibrary(settings(), (library) => ({
        ...library,
        apps: skipVersion({ products: librarySettings({ library }, platform).apps }, app.id, found.install.version).products,
      })));
      report('library-app-rolled-back', { app: app.id, version: found.install.version, previous: found.install.previous, reason });
      deps.notify?.();
      return true;
    } catch (error) {
      report('library-app-rollback-failed', { app: app.id, error });
      return false;
    }
  }

  /**
   * Starts an installed app, detached so closing Instrumenta leaves it running. A version still
   * pending its first launch is judged by the only thing these apps offer: it counts as working if
   * the process is still running a few seconds after it started. One that fails to start, or exits
   * with an error in that time, is rolled back to the previous version when there is one. One that
   * exits cleanly that fast is left pending rather than judged either way.
   */
  async function open(id) {
    const app = requireApp(id);
    const found = locate(app);
    if (!found) throw new Error(`${app.name} is not installed.`);
    const executable = deps.assertTrustedExecutable(found.install.executable, [found.folder], platform, app.name);
    const pending = found.install.pending;
    const child = deps.spawnExecutable(executable, { env: process.env });
    if (!processes.has(app.id)) processes.set(app.id, new Set());
    processes.get(app.id).add(child);
    deps.notify?.();
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve({ app: app.id, version: found.install.version });
      };
      const failedFirstLaunch = (detail) => {
        if (!pending) return finish(new Error(`${app.name} could not open: ${detail}`));
        const rolledBack = found.install.previous && rollBack(app, found, detail);
        return finish(new Error(rolledBack
          ? `${app.name} ${found.install.version} did not start (${detail}), so Instrumenta went back to ${found.install.previous}. Open it again to use that version.`
          : `${app.name} ${found.install.version} did not start: ${detail}`));
      };
      child.once('spawn', () => {
        if (!pending) return finish();
        timer = setTimeout(() => {
          if (child.exitCode === null) {
            try { confirmManagedVersion(found.root, app.id); } catch (error) { report('library-app-confirm-failed', { app: app.id, error }); }
            deps.notify?.();
          }
          finish();
        }, deps.livenessMs ?? LIVENESS_MS);
      });
      child.once('error', (error) => {
        processes.get(app.id)?.delete(child);
        failedFirstLaunch(error.message);
      });
      child.once('exit', (code) => {
        processes.get(app.id)?.delete(child);
        if (!settled && code !== 0) failedFirstLaunch(`it exited with code ${code}`);
        else finish();
        deps.notify?.();
        // An update fetched while the app was open can go in now.
        applyPolicy([app.id]);
      });
    });
  }

  // ---- Removing and rolling back ----

  async function uninstall(id) {
    const app = requireApp(id);
    const found = locate(app);
    if (!found) throw new Error(`${app.name} is not installed.`);
    if (deps.queue.has(jobId(app.id))) throw new Error(`${app.name} is being installed. Wait for that to finish first.`);
    if (isRunning(app.id)) throw new Error(`Close ${app.name} before uninstalling it.`);
    const agreed = await deps.confirm({
      title: `Uninstall ${app.name}`,
      message: `Remove ${app.name} from this computer?`,
      detail: `Instrumenta moves ${found.folder} to the Recycle Bin: ${app.name}'s installed versions and nothing else. `
        + `Settings ${app.name} keeps for itself and anything you made with it are not removed.`,
      button: `Uninstall ${app.name}`,
    });
    if (!agreed) return false;
    try {
      await deps.trashItem(found.folder);
    } catch (error) {
      // A drive without a Recycle Bin. The person already agreed to the removal itself.
      report('library-trash-failed', { app: app.id, error });
      const aside = `${found.folder}.removing-${process.pid}-${Date.now()}`;
      fs.renameSync(found.folder, aside);
      fs.rmSync(aside, { recursive: true, force: true });
    }
    save(withApp(settings(), app.id, (entry) => {
      delete entry.root;
      return entry;
    }));
    icons.delete(app.id);
    report('library-app-uninstalled', { app: app.id, folder: found.folder });
    deps.notify?.();
    return true;
  }

  function rollback(id) {
    const app = requireApp(id);
    const found = locate(app);
    if (!found?.install.previous) throw new Error(`${app.name} has no previous version to go back to.`);
    if (deps.queue.has(jobId(app.id))) throw new Error(`${app.name} is being installed. Wait for that to finish first.`);
    rollbackManagedVersion(found.root, app.id, { requirePending: false });
    save(withLibrary(settings(), (library) => ({
      ...library,
      apps: skipVersion({ products: librarySettings({ library }, platform).apps }, app.id, found.install.version).products,
    })));
    deps.notify?.();
    return true;
  }

  // ---- Preferences, location and suggestions ----

  function setPreference(change) {
    const app = requireApp(change?.app);
    if (change.autoUpdate !== null && typeof change.autoUpdate !== 'boolean') throw new Error('autoUpdate must be true, false, or null.');
    save(withApp(settings(), app.id, (entry) => {
      if (change.autoUpdate === null) delete entry.autoUpdate;
      else entry.autoUpdate = change.autoUpdate;
      return entry;
    }));
    if (change.autoUpdate === true) applyPolicy([app.id]);
    deps.notify?.();
    return true;
  }

  function appFolders() {
    return Object.entries(installedRoots()).map(([id, root]) => path.join(root, id));
  }

  // Probes that a folder can be written before the library is pointed at it.
  function assertWritable(location) {
    fs.mkdirSync(location, { recursive: true });
    const probe = path.join(location, `.instrumenta-write-check-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.rmSync(probe, { force: true });
  }

  async function location(action) {
    let target = '';
    if (action === 'choose') {
      const chosen = await deps.chooseFolder(currentLocation(settings(), layout(), platform));
      if (!chosen) return false;
      target = validateLocation(chosen, { forbidden: forbidden(), appFolders: appFolders(), platform });
      assertWritable(target);
    } else if (action !== 'default') {
      throw new Error('Unknown library location action.');
    }
    save(changeLocation(settings(), target, { installed: installedRoots(), layout: layout(), platform }));
    report('library-location-changed', { location: target || layout().defaultRoot });
    deps.notify?.();
    return true;
  }

  // Add apps' one "Install to" folder: library apps chosen there go to the same place as the
  // suite's. '' returns to the library's default. Checked by the library's own rules; throws why
  // not before anything is saved.
  function useLocation(folder) {
    const target = folder ? validateLocation(folder, { forbidden: forbidden(), appFolders: appFolders(), platform }) : '';
    if (target) assertWritable(target);
    save(changeLocation(settings(), target, { installed: installedRoots(), layout: layout(), platform }));
    report('library-location-changed', { location: target || layout().defaultRoot, from: 'add-apps' });
    deps.notify?.();
    return true;
  }

  function suggestion(change) {
    const source = sources().find((item) => item.id === change?.source);
    if (!source || !repoPattern.test(String(change?.repo || ''))) throw new Error('Unknown suggestion.');
    const offered = cachedSuggestions(layout().cacheRoot, source.id).find((item) => item.repo === change.repo);
    if (change.action === 'add') {
      if (!offered) throw new Error('That app is no longer suggested. Refresh and try again.');
      const entry = { repo: offered.repo, name: suggestedName(offered.repo), description: offered.description || '' };
      if (!discoveredApp(source, entry, new Set(apps().map((app) => app.id)))) throw new Error(`${offered.repo} cannot be added: its name clashes with an app already listed.`);
      save(withLibrary(settings(), (library) => {
        const added = library.added && typeof library.added === 'object' ? { ...library.added } : {};
        const list = Array.isArray(added[source.id]) ? added[source.id].filter((item) => item?.repo !== entry.repo) : [];
        added[source.id] = [...list, entry];
        return { ...library, added };
      }));
    } else if (change.action === 'dismiss') {
      save(withLibrary(settings(), (library) => {
        const dismissed = library.dismissed && typeof library.dismissed === 'object' ? { ...library.dismissed } : {};
        dismissed[source.id] = [...new Set([...(Array.isArray(dismissed[source.id]) ? dismissed[source.id] : []), change.repo])];
        return { ...library, dismissed };
      }));
    } else if (change.action === 'remove') {
      // Takes an added app back off the list. Only one that is not installed.
      const app = apps().find((item) => item.discovered && item.repo === change.repo && item.source.id === source.id);
      if (!app) throw new Error('That app was not added from a suggestion.');
      if (locate(app)) throw new Error(`Uninstall ${app.name} first.`);
      save(withLibrary(settings(), (library) => {
        const added = { ...(library.added || {}) };
        added[source.id] = (Array.isArray(added[source.id]) ? added[source.id] : []).filter((item) => item?.repo !== change.repo);
        return { ...library, added };
      }));
    } else {
      throw new Error('Unknown suggestion action.');
    }
    deps.notify?.();
    return true;
  }

  // ---- Folders, links and icons ----

  async function reveal(target) {
    let folder;
    if (target === 'root') {
      folder = currentLocation(settings(), layout(), platform);
      fs.mkdirSync(folder, { recursive: true });
    } else {
      const app = requireApp(target);
      const found = locate(app);
      if (!found) throw new Error(`${app.name} is not installed.`);
      folder = found.install.root;
    }
    const failure = await deps.openPath(folder);
    if (failure) throw new Error(`Could not open that folder.\n\n${failure}`);
    return true;
  }

  // The repository page, built from the validated source rather than taken from the window.
  async function openRepository(id) {
    const app = requireApp(id);
    await deps.openExternal(`https://github.com/${encodeURIComponent(app.source.owner)}/${encodeURIComponent(app.repo)}`);
    return true;
  }

  // The app's own icon, read from its executable once it is installed. Null when it is not, or when
  // Windows has none to give; the window then draws a plain monogram.
  async function icon(id) {
    const app = requireApp(id);
    if (icons.has(app.id)) return icons.get(app.id);
    const found = locate(app);
    if (!found || !deps.getFileIcon) return null;
    let url = null;
    try {
      const image = await deps.getFileIcon(found.install.executable);
      url = image && !image.isEmpty?.() ? image.toDataURL() : null;
    } catch {
      url = null;
    }
    icons.set(app.id, url);
    return url;
  }

  // ---- State ----

  async function measure(folder) {
    try { return await directorySize(folder); } catch { return 0; }
  }

  /**
   * What the Library page shows: the location (and whether it is the default), the total on disk,
   * and per app its credit, versions, size, the folder it is in, and what can be done with it.
   */
  async function state() {
    const current = settings();
    const library = librarySettings(current, platform);
    const where = currentLocation(current, layout(), platform);
    const { cacheRoot } = layout();
    const cache = readVersionCache(cacheRoot);
    const preferences = libraryPreferences(current);
    const queue = deps.queue.jobs();
    const rows = [];
    for (const app of apps()) {
      const found = locate(app);
      const entry = cache[app.id];
      const installedVersion = found?.install.version || '';
      const latestVersion = entry?.version || '';
      const skipped = isSkipped(preferences, app.id, latestVersion);
      const job = queue.find((item) => item.id === jobId(app.id)) || null;
      rows.push({
        id: app.id,
        source: app.source.id,
        name: app.name,
        description: app.description,
        repo: app.repo,
        repository: `github.com/${app.source.owner}/${app.repo}`,
        credit: `by ${app.source.name} · ${app.source.licence}`,
        discovered: Boolean(app.discovered),
        installed: Boolean(found),
        installedVersion,
        latestVersion,
        releasePublished: entry ? Boolean(entry.version) : null,
        updateAvailable: Boolean(found && isNewer(latestVersion, installedVersion) && !skipped),
        downloadSize: downloadSize(entry?.manifest),
        bytes: found ? await measure(found.folder) : 0,
        folder: found?.folder || '',
        versionFolder: found?.install.root || '',
        executable: found?.install.executable || '',
        elsewhere: Boolean(found && !samePath(found.root, where, platform)),
        pending: Boolean(found?.install.pending),
        previous: found?.install.previous || '',
        running: isRunning(app.id),
        autoUpdate: autoUpdateFor(preferences, app.id),
        autoUpdateOwn: typeof preferences.products[app.id]?.autoUpdate === 'boolean' ? preferences.products[app.id].autoUpdate : null,
        job: job ? { kind: job.kind, state: job.state, progress: job.progress } : null,
      });
    }
    let free = null;
    try {
      const target = fs.existsSync(where) ? where : path.dirname(where);
      const stats = await fs.promises.statfs(target);
      free = Number(stats.bavail) * Number(stats.bsize);
    } catch { /* unknown */ }
    const listed = new Set(apps().map((app) => app.repo.toLowerCase()));
    const suggestions = [];
    for (const source of sources()) {
      const dismissed = new Set((library.dismissed[source.id] || []).map((repo) => repo.toLowerCase()));
      for (const item of cachedSuggestions(cacheRoot, source.id)) {
        if (listed.has(item.repo.toLowerCase()) || dismissed.has(item.repo.toLowerCase())) continue;
        suggestions.push({ source: source.id, sourceName: source.name, repo: item.repo, name: suggestedName(item.repo), description: item.description || '', version: item.version || '', credit: `by ${source.name} · ${source.licence}` });
      }
    }
    return {
      location: { path: where, default: layout().defaultRoot, isDefault: samePath(where, layout().defaultRoot, platform), free },
      total: rows.reduce((sum, row) => sum + row.bytes, 0),
      sources: sources().map((source) => ({ id: source.id, name: source.name, collection: source.collection, licence: source.licence, profile: `github.com/${source.owner}` })),
      apps: rows,
      suggestions,
    };
  }

  // One row for the Storage panel: everything in the library, wherever it is.
  function storageExtra() {
    return {
      product: 'library',
      label: 'External library',
      note: 'Open-source apps installed from the External library. Uninstall them there.',
      measure: async () => {
        const roots = Object.entries(installedRoots());
        if (!roots.length) return null;
        let bytes = 0;
        for (const [id, root] of roots) bytes += await measure(path.join(root, id));
        return { bytes, path: currentLocation(settings(), layout(), platform) };
      },
    };
  }

  return {
    applyPolicy,
    checkUpdates,
    icon,
    install,
    isRunning,
    location,
    useLocation,
    open,
    openRepository,
    ownsJob,
    reveal,
    rollback,
    runJob,
    setPreference,
    sources,
    state,
    storageExtra,
    suggestion,
    uninstall,
  };
}

module.exports = {
  JOB_PREFIX,
  LIVENESS_MS,
  candidateRoots,
  changeLocation,
  createExternalLibrary,
  currentLocation,
  definitionFor,
  extractPortable,
  libraryApps,
  libraryLayout,
  libraryPreferences,
  librarySettings,
  locateInstall,
  validateLocation,
};
