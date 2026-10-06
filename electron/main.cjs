const { app, BrowserWindow, crashReporter, dialog, ipcMain, shell } = require('electron');
const { execFile, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createDiagnostics } = require('./diagnostics.cjs');
const {
  assertLaunchCheck,
  consoleMessage,
  launchCheckMarker,
} = require('./launch-check.cjs');
const { createStaticServer } = require('./static-server.cjs');
const { pickPort, startService } = require('./service-process.cjs');
const { planPrepare } = require('./wsl-bridge.cjs');
const { assertTrustedExecutable, probeExecutable, spawnExecutable } = require('./native-launch.cjs');
const { ensureLocalBundle, localBundleRoot } = require('./local-bundle.cjs');
const { installLatestProduct, latestManifest } = require('./release-installer.cjs');
const { confirmManagedVersion, forgetPreviousVersion, readPointer, releaseNotesText, resolveManagedInstall, rollbackManagedVersion } = require('./release-lifecycle.cjs');
const { linkFor } = require('./launcher-links.cjs');
const { cleanStorage, storageReport } = require('./storage-report.cjs');
const readiness = require('./readiness.cjs');
const {
  lifecycleBlocker,
  retireServerPlan,
  rollbackAfterFailedOpen,
  samePath,
  staticServerPlan,
  supportsRollback,
} = require('./lifecycle-policy.cjs');
const { createInstallQueue } = require('./install-queue.cjs');
const {
  applyPreference,
  decide,
  downloadSize,
  knownVersions: summarizeReleases,
  readPreferences,
  skipVersion,
  unskipVersion,
} = require('./update-policy.cjs');
const {
  attachServiceHeaders,
  attachWebContentsPolicy,
  hardenSession,
  registerTrustedIpcHandler,
  secureWebPreferences,
  toolPartition,
} = require('./security-policy.cjs');
const { discover, findWorkspace, isWorkspace, loadRegistry, productDefinitions } = require('./workspace.cjs');
const {
  DEFAULT_TTL_MS,
  cachedRelease,
  readVersionCache,
  refreshReleaseVersions,
  windowsInstallLocation,
  windowsInstalledVersion,
} = require('./update-check.cjs');
const { removeRetiredData, storageLayout } = require('./storage.cjs');
const selfUpdate = require('./self-update.cjs');

const APP_ID = 'com.instrumenta.launcher';
const APP_NAME = 'Instrumenta';
const USER_DATA_NAME = 'instrumenta-launcher';
let launcherWindow;
const webWindows = new Map();
const webServers = new Map();
// Managed services are tracked from the moment they are spawned, not from the
// moment they become healthy, so shutdown can never miss a starting child.
const serviceProcesses = new Map();
const serviceStarts = new Map();
const SERVICE_SHUTDOWN_MS = 6000;
const nativeProcesses = new Map();
let busyTool = '';
let activity = 'Ready.';
let settings = {};
let isQuitting = false;
let updateTimer = null;
const launchCheckFile = launchCheckMarker();
const launchCheckConsole = [];

app.setName(APP_NAME);
// Keep the established storage path when moving the runtime-facing name from
// `instrumenta-launcher` to the correctly branded `Instrumenta` product name.
app.setPath('userData', path.join(app.getPath('appData'), USER_DATA_NAME));
app.setAppUserModelId(APP_ID);
app.setAppLogsPath(path.join(app.getPath('userData'), 'logs'));

const diagnostics = createDiagnostics(app.getPath('logs'));
crashReporter.start({
  productName: APP_NAME,
  uploadToServer: false,
  compress: true,
  globalExtra: { appId: APP_ID },
});
diagnostics.write('launcher-start', {
  version: app.getVersion(),
  packaged: app.isPackaged,
  platform: process.platform,
  architecture: process.arch,
});
process.on('uncaughtExceptionMonitor', (error) => diagnostics.write('main-process-uncaught-exception', { error }));
process.on('unhandledRejection', (reason) => diagnostics.write('main-process-unhandled-rejection', { reason }));

if (launchCheckFile) {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('console-message', (...args) => {
      const message = consoleMessage(args);
      if (message) launchCheckConsole.push(message);
    });
  });
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsPath(), 'utf8').replace(/^\uFEFF/, ''));
    settings = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    if (typeof settings.workspace !== 'string') delete settings.workspace;
  } catch (error) {
    if (error.code !== 'ENOENT') diagnostics.write('settings-load-failed', { error });
    settings = {};
  }
}

function saveSettings() {
  const file = settingsPath();
  const temporary = `${file}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function resolvedWorkspace() {
  return findWorkspace({
    configuredWorkspace: settings.workspace,
    environmentWorkspace: process.env.INSTRUMENTA_WORKSPACE,
    appPath: app.getAppPath(),
    cwd: process.cwd(),
    executableDirectory: path.dirname(app.getPath('exe')),
    portableDirectory: process.env.PORTABLE_EXECUTABLE_DIR,
  });
}

function storage() {
  return storageLayout({ localAppData: process.env.LOCALAPPDATA, userData: app.getPath('userData') });
}

function managedInstallRoot() {
  return storage().installRoot;
}

function updateCacheRoot() {
  return storage().updateCacheRoot;
}

// One set of registry inputs for the tiles, installing, and update polling alike. When installing
// and polling built their own from the workspace alone, a machine without one had no Forge3D or Luna
// to install and nothing to poll.
function registryOptions() {
  return {
    workspace: resolvedWorkspace(),
    resourcesPath: process.resourcesPath,
    catalogBase: app.getAppPath(),
    installRoot: managedInstallRoot(),
  };
}

// What the last update check learned. Held in memory so `currentState` stays
// synchronous; refreshed by checkForProductUpdates, never on the render path.
let knownVersions = { latest: {}, installed: {}, releases: {}, launcher: '' };

// The launcher's own newer release (self-update.cjs): whether there is one, and how far its
// download has got. `installer` is the verified setup program once it is ready.
let launcherUpdate = { state: 'none', version: '', progress: null, error: '', installer: '' };
let launcherDownload = null;
let launcherApplying = false;
let launcherProgressAt = 0;
let launcherRelaunch = false;
const launcherRoute = () => selfUpdate.updateRoute({ packaged: app.isPackaged });

function launcherRelease() {
  try {
    return loadRegistry(registryOptions()).launcher || null;
  } catch {
    return null;
  }
}

// Installs run one at a time in the background; each job's progress rides on the state.
const installQueue = createInstallQueue({
  run: (job, report) => runInstallJob(job, report),
  onChange: () => broadcast(),
});

function preferenceState() {
  const preferences = readPreferences(settings);
  return {
    autoUpdate: preferences.autoUpdate,
    products: Object.fromEntries(Object.entries(preferences.products).map(([id, entry]) => [id, { autoUpdate: entry.autoUpdate }])),
    appsChooserSeen: settings.appsChooserSeen === true,
  };
}

// Release notes for the version a product is actually on, so "What's new" describes what the
// person has rather than what is merely available.
function withReleaseNotes(discovered) {
  const releases = knownVersions.releases || {};
  const products = (discovered.products || []).map((product) => {
    const release = releases[product.id];
    const text = release && release.version === product.version ? releaseNotesText(release.notes) : '';
    return text ? { ...product, releaseNotes: { version: product.version, text } } : product;
  });
  const own = releases[selfUpdate.LAUNCHER_ID];
  const launcherText = own && own.version === app.getVersion() ? releaseNotesText(own.notes) : '';
  // discover() also keys each product by its ID, and the window reads that copy first.
  const result = { ...discovered, products, launcherNotes: launcherText ? { version: app.getVersion(), text: launcherText } : null };
  for (const product of products) result[product.id] = product;
  return result;
}

function currentState() {
  const { workspace, resourcesPath, catalogBase, installRoot } = registryOptions();
  return {
    ...withReleaseNotes(discover(workspace, resourcesPath, catalogBase, installRoot, knownVersions)),
    busyTool,
    activity,
    version: app.getVersion(),
    packaged: app.isPackaged,
    queue: installQueue.jobs(),
    preferences: preferenceState(),
    launcherUpdate: {
      route: launcherRoute(),
      state: launcherUpdate.state,
      version: launcherUpdate.version,
      progress: launcherUpdate.progress,
      error: launcherUpdate.error,
    },
  };
}

// Rebuilds what the tiles know from the update cache, without asking GitHub. Called after a
// check, and after anything that changes which versions are skipped.
function recomputeKnownVersions(installed = knownVersions.installed) {
  knownVersions = summarizeReleases({
    cache: readVersionCache(updateCacheRoot()),
    installed,
    preferences: readPreferences(settings),
    launcherVersion: app.getVersion(),
  });
  return knownVersions;
}

function probeInstalledVersions(products) {
  const installed = {};
  for (const product of products) {
    if (product.adapter !== 'installed-desktop' || !product.versionProbe?.displayName) continue;
    try {
      const probed = windowsInstalledVersion(product.versionProbe.displayName);
      if (probed) installed[product.id] = probed;
    } catch {
      // A product that cannot be probed simply has no update state.
    }
  }
  return installed;
}

/**
 * Ask each release-backed product's feed what the newest published release is, and
 * probe what is actually installed, then broadcast so tiles can offer the update and
 * let the update policy act on it. Every failure is swallowed: a launcher that
 * cannot reach GitHub still opens.
 */
async function checkForProductUpdates({ force = false } = {}) {
  let products = [];
  try {
    products = productDefinitions(loadRegistry(registryOptions()));
  } catch {
    return knownVersions;
  }
  const installed = probeInstalledVersions(products);
  const launcher = launcherRelease();
  try {
    await refreshReleaseVersions({
      products: launcher ? [...products, selfUpdate.launcherDefinition(launcher.repository)] : products,
      cacheRoot: updateCacheRoot(),
      force,
      fetchLatest: (product) => latestManifest(product),
    });
  } catch {
    // Keep whatever the cache already knew.
  }
  recomputeKnownVersions(installed);
  refreshLauncherUpdate();
  if (launcherWindow && !launcherWindow.isDestroyed()) broadcast();
  applyUpdatePolicy();
  return knownVersions;
}

// What the cache says about the launcher's own newest release, acted on the way the products'
// are: with automatic updates on, an installed launcher fetches it in the background, and it goes
// in when the person presses Restart or the launcher closes. A version already downloading or
// downloaded is left alone.
function refreshLauncherUpdate() {
  const preferences = readPreferences(settings);
  const entry = readVersionCache(updateCacheRoot())[selfUpdate.LAUNCHER_ID];
  const update = selfUpdate.availableUpdate(entry, app.getVersion(), {
    skipped: preferences.products[selfUpdate.LAUNCHER_ID]?.skippedVersions || [],
  });
  if (!update) {
    if (!launcherDownload) launcherUpdate = { state: 'none', version: '', progress: null, error: '', installer: '' };
    return null;
  }
  if (launcherUpdate.version === update.version && ['downloading', 'ready'].includes(launcherUpdate.state)) return update;
  launcherUpdate = { state: 'available', version: update.version, progress: null, error: '', installer: '' };
  if (launcherRoute() === 'installer' && preferences.autoUpdate) startLauncherDownload(update);
  return update;
}

function startLauncherDownload(update) {
  const release = launcherRelease();
  if (launcherDownload || !release || launcherRoute() !== 'installer') return launcherDownload;
  launcherUpdate = { ...launcherUpdate, state: 'downloading', progress: null, error: '' };
  broadcast();
  launcherDownload = selfUpdate.downloadLauncherUpdate({
    repository: release.repository,
    update,
    downloadsRoot: storage().downloadsRoot,
    onProgress: (progress) => {
      launcherUpdate = { ...launcherUpdate, progress };
      // A few times a second is plenty for a header label.
      if (Date.now() - launcherProgressAt > 250) {
        launcherProgressAt = Date.now();
        broadcast();
      }
    },
  })
    .then((installer) => {
      launcherUpdate = { ...launcherUpdate, state: 'ready', installer, progress: null };
      diagnostics.write('launcher-update-ready', { version: update.version });
    })
    .catch((error) => {
      launcherUpdate = { ...launcherUpdate, state: 'failed', error: String(error?.message || error), progress: null };
      diagnostics.write('launcher-update-failed', { version: update.version, error });
    })
    .finally(() => {
      launcherDownload = null;
      broadcast();
    });
  return launcherDownload;
}

// Runs the verified setup program, detached so it outlives this launcher. Once only: Restart and
// the quit that follows it must not start it twice.
function applyLauncherUpdate({ relaunch }) {
  if (launcherApplying || launcherUpdate.state !== 'ready' || !launcherUpdate.installer || launcherRoute() !== 'installer') return false;
  launcherApplying = true;
  const plan = selfUpdate.planLauncherInstall(launcherUpdate.installer, { relaunch });
  try {
    spawn(plan.command, plan.args, plan.options).unref();
    diagnostics.write('launcher-update-applied', { version: launcherUpdate.version, relaunch });
    return true;
  } catch (error) {
    launcherApplying = false;
    launcherUpdate = { ...launcherUpdate, state: 'failed', error: String(error?.message || error) };
    diagnostics.write('launcher-update-apply-failed', { error });
    broadcast();
    return false;
  }
}

function productDefinition(id) {
  try {
    return productDefinitions(loadRegistry(registryOptions())).find((product) => product.id === id) || null;
  } catch {
    return null;
  }
}

function isRunning(tool) {
  const child = nativeProcesses.get(tool);
  if (child && child.exitCode === null && !child.killed) return true;
  const window = webWindows.get(tool);
  return Boolean(window && !window.isDestroyed()) || serviceProcesses.has(tool);
}

// A new activity line that leaves `busyTool` alone. Installs finish in the background, and
// must not clear the busy state of a Prepare still running in the foreground.
function announce(message) {
  activity = message;
  broadcast();
}

function saveSettingsQuietly() {
  try {
    saveSettings();
  } catch (error) {
    diagnostics.write('settings-save-failed', { error });
  }
}

// A version rolled back from is not offered again automatically; installing it on purpose
// clears that.
function rememberRollback(tool, version) {
  settings = skipVersion(settings, tool, version);
  saveSettingsQuietly();
  recomputeKnownVersions();
}

/**
 * Acts on each installed release-backed product's update as the preferences say: installs it,
 * fetches it to go in once the product is closed, or leaves the tile to offer it. `ids` limits
 * the pass, as when one product has just closed.
 */
function applyUpdatePolicy(ids = null) {
  let state;
  try {
    state = currentState();
  } catch {
    return;
  }
  const preferences = readPreferences(settings);
  const cache = readVersionCache(updateCacheRoot());
  for (const product of state.products) {
    if (ids && !ids.includes(product.id)) continue;
    // `updateAvailable` is the tile's own verdict: installed, compared against a version read from
    // disk or the uninstall record (never Luna's catalog guess), not skipped, and installable by
    // this launcher. Anything it does not offer is not installed behind anyone's back either.
    if (!product.updateAvailable || !product.canInstall || installQueue.has(product.id)) continue;
    const entry = cache[product.id];
    const { action } = decide({
      id: product.id,
      installedVersion: product.installedVersion || '',
      latest: entry?.version ? { version: entry.version, minimumInstrumentaVersion: entry.manifest?.minimumInstrumentaVersion, downloadSize: downloadSize(entry.manifest) } : null,
      running: isRunning(product.id),
      preferences,
      launcherVersion: app.getVersion(),
    });
    if (action === 'install' || action === 'download') installQueue.enqueue(product.id, { kind: action });
  }
}

async function runInstallJob(job, report) {
  const definition = productDefinition(job.id);
  if (!definition?.release?.repository) throw new Error(`No release installer exists for ${job.id}.`);
  const name = definition.displayName || job.id;
  try {
    const result = await installLatestProduct(definition, {
      latest: cachedRelease(updateCacheRoot(), job.id),
      launcherVersion: app.getVersion(),
      cacheRoot: storage().downloadsRoot,
      installRoot: managedInstallRoot(),
      activate: job.kind === 'install',
      onProgress: (progress) => report(progress),
    });
    if (job.kind === 'install') {
      // The tool's server was serving the version just replaced.
      retireWebServer(job.id);
      if (job.explicit) {
        settings = unskipVersion(settings, job.id, result.version);
        saveSettingsQuietly();
      }
      diagnostics.write('product-installed', { tool: job.id, version: result.version, reused: Boolean(result.reused) });
      if (!job.explicit) announce(`${name} was updated to ${result.version}.`);
      // Re-probe so the tile stops offering the update it just applied.
      checkForProductUpdates().catch(() => {});
    }
    return result;
  } catch (error) {
    diagnostics.write('product-install-failed', { tool: job.id, kind: job.kind, error });
    if (!job.explicit) announce(`${name}'s update needs attention: ${error.message}`);
    throw error;
  }
}

function broadcast() {
  const state = currentState();
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.webContents.send('instrumenta:state', state);
  }
  return state;
}

function setActivity(message, tool = busyTool) {
  activity = message;
  busyTool = tool;
  broadcast();
}

function reportSecurity(scope) {
  return (event, details = {}) => diagnostics.write(event, { scope, ...details });
}

function attachCrashRecovery(window, label) {
  let recoveryOpen = false;
  window.webContents.on('render-process-gone', async (_event, details) => {
    diagnostics.write('renderer-process-gone', { window: label, ...details });
    if (details.reason === 'clean-exit' || recoveryOpen || window.isDestroyed() || isQuitting) return;
    recoveryOpen = true;
    try {
      const choice = await dialog.showMessageBox(window, {
        type: 'error',
        title: `${label} stopped unexpectedly`,
        message: `${label}'s display process stopped unexpectedly.`,
        detail: `A local diagnostic was written to:\n${diagnostics.file}`,
        buttons: ['Reload window', 'Close window'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });
      if (choice.response === 0 && !window.isDestroyed()) window.reload();
      else if (!window.isDestroyed()) window.close();
    } finally {
      recoveryOpen = false;
    }
  });
}

async function createWindow() {
  const launcherPage = path.join(__dirname, 'renderer', 'index.html');
  const launcherUrl = pathToFileURL(launcherPage).href;
  launcherWindow = new BrowserWindow({
    width: 1160,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#0d0c0a',
    title: 'Instrumenta',
    icon: app.isPackaged ? undefined : path.join(__dirname, '..', 'packaging', 'icon.png'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: secureWebPreferences({
      preload: path.join(__dirname, 'preload.cjs'),
      devTools: !app.isPackaged,
    }),
  });
  const createdWindow = launcherWindow;
  launcherWindow.removeMenu();
  launcherWindow.on('closed', () => {
    if (launcherWindow === createdWindow) launcherWindow = null;
  });
  hardenSession(launcherWindow.webContents.session, { report: reportSecurity('launcher') });
  attachWebContentsPolicy(launcherWindow.webContents, {
    allowedUrl: launcherUrl,
    report: reportSecurity('launcher'),
  });
  attachCrashRecovery(launcherWindow, APP_NAME);
  launcherWindow.once('ready-to-show', () => {
    if (!createdWindow.isDestroyed()) createdWindow.show();
  });
  await launcherWindow.loadFile(launcherPage);
}

async function stopService(tool) {
  const service = serviceProcesses.get(tool);
  if (!service) return;
  serviceProcesses.delete(tool);
  try {
    await service.stop();
  } catch (error) {
    diagnostics.write('service-stop-failed', { tool, error });
  }
}

async function launchProductService(tool, definition) {
  if (serviceProcesses.has(tool)) await stopService(tool);
  const launch = definition.launch || {};
  if (!Array.isArray(launch.command) || !launch.command.length || !definition.sourceRoot) {
    throw new Error(`${definition.displayName || tool} does not declare a validated service launch in instrumenta/product.json.`);
  }
  const port = await pickPort([launch.port, launch.fallbackPort]);
  if (isQuitting) throw new Error(`${definition.displayName || tool} was not started because Instrumenta is closing.`);
  let logged = 0;
  let service;
  try {
    service = await startService({
      tool,
      command: launch.command,
      cwd: path.resolve(definition.sourceRoot, launch.cwd || '.'),
      env: launch.env || {},
      port,
      healthPath: launch.health,
      // Startup output explains a failed launch; steady-state request logging
      // would otherwise churn the bounded launcher diagnostic.
      onLog: (line) => { if (logged++ < 40) diagnostics.write('service-log', { tool, line }); },
      // Registered before the health gate opens, so quitting mid-startup still
      // reaches this child instead of orphaning it.
      onSpawn: (handle) => serviceProcesses.set(tool, handle),
    });
  } catch (error) {
    await stopService(tool);
    throw error;
  }
  serviceProcesses.set(tool, service);
  service.child.once('exit', (code, signal) => {
    if (serviceProcesses.get(tool) === service) serviceProcesses.delete(tool);
    diagnostics.write('service-exited', { tool, code, signal });
  });
  if (isQuitting) {
    await stopService(tool);
    throw new Error(`${definition.displayName || tool} was stopped because Instrumenta is closing.`);
  }
  return service;
}

// One start per tool: two launch requests arriving together must share a single
// port probe and a single child, or the loser orphans a service.
function startProductService(tool, definition) {
  const pending = serviceStarts.get(tool);
  if (pending) return pending;
  const running = serviceProcesses.get(tool);
  if (running?.url && running.child.exitCode === null && !running.child.killed) return Promise.resolve(running);
  const start = launchProductService(tool, definition);
  serviceStarts.set(tool, start);
  const release = () => { if (serviceStarts.get(tool) === start) serviceStarts.delete(tool); };
  start.then(release, release);
  return start;
}

async function shutdownServices() {
  const stopAll = () => Promise.all([...serviceProcesses.keys()].map((tool) => stopService(tool)));
  // Stopping first makes any in-flight start fail fast, so awaiting the starts
  // cannot block on a service that is still waiting for its health path.
  await stopAll();
  await Promise.all([...serviceStarts.values()].map((start) => start.then(() => {}, () => {})));
  await stopAll();
}

function closeWebServer(tool) {
  const cached = webServers.get(tool);
  if (!cached) return Promise.resolve();
  webServers.delete(tool);
  return cached.server.close().catch((error) => diagnostics.write('static-server-close-failed', { tool, error }));
}

// After an install, rollback or uninstall, a tool's server serves the wrong files. It closes now,
// or with the window still showing the build it loaded.
function retireWebServer(tool) {
  const cached = webServers.get(tool);
  if (!cached) return;
  const window = webWindows.get(tool);
  if (retireServerPlan({ windowOpen: Boolean(window && !window.isDestroyed()) }) === 'close-now') closeWebServer(tool);
  else cached.retired = true;
}

// One static server per tool and per folder. It is replaced when the product's folder changes,
// and the old one is closed first: the new server wants the same registered port, because the
// port is the origin and the origin is where the product's saved data lives.
async function staticServerFor(tool, root, definition) {
  const cached = webServers.get(tool);
  const plan = staticServerPlan(cached, root);
  if (plan === 'reuse') return cached.server;
  if (plan === 'replace') await closeWebServer(tool);
  const server = await createStaticServer(root, {
    port: definition?.launch?.port || definition?.port,
    fallbackPort: definition?.launch?.fallbackPort,
    tool,
  });
  webServers.set(tool, { server, root });
  return server;
}

// A managed version that fails its first open goes back to the version before it, and is not
// offered again automatically.
function rollBackFailedFirstOpen(tool, adapter, managed) {
  if (!rollbackAfterFailedOpen(adapter, managed)) return false;
  try {
    rollbackManagedVersion(managedInstallRoot(), tool);
    rememberRollback(tool, managed.version);
    retireWebServer(tool);
    diagnostics.write('managed-product-rolled-back', { tool, version: managed.version, previous: managed.previous });
    return true;
  } catch (rollbackError) {
    diagnostics.write('managed-product-rollback-failed', { tool, rollbackError });
    return false;
  }
}

async function openWebTool(tool, buildDirectory, definition = productDefinition(tool)) {
  const existing = webWindows.get(tool);
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return;
  }
  const isService = definition?.adapter === 'web-service';
  const displayName = definition?.displayName || tool;
  // A managed-web version is provisional until it has served its first window. Confirming it
  // then, and rolling it back when it cannot, gives it the guarantee a managed executable gets
  // when it spawns. Only the managed folder counts: a baked-in or local build is not a version.
  const managed = definition?.adapter === 'managed-web' ? resolveManagedInstall(managedInstallRoot(), tool) : null;
  const servedManaged = Boolean(managed && samePath(managed.root, buildDirectory));
  const openFailure = (error) => {
    diagnostics.write('tool-load-failed', { tool, error });
    if (!servedManaged || !rollBackFailedFirstOpen(tool, definition.adapter, managed)) return error;
    return new Error(`${displayName} ${managed.version} could not open, so Instrumenta went back to ${managed.previous}. Open it again to use that version.\n\n${error.message}`);
  };
  let url;
  if (isService) {
    const service = await startProductService(tool, definition);
    // The launcher may have started quitting while the service was starting;
    // opening a window now would resurrect a process tree that is being torn down.
    if (isQuitting) {
      await stopService(tool);
      return;
    }
    url = service.url;
  } else {
    try {
      url = (await staticServerFor(tool, buildDirectory, definition)).url;
    } catch (error) {
      throw openFailure(error);
    }
  }
  const isLudere = definition?.id === 'ludere';
  const partition = toolPartition(tool);
  const toolWindow = new BrowserWindow({
    width: isLudere ? 1500 : 1440,
    height: isLudere ? 960 : 900,
    minWidth: isLudere ? 900 : 980,
    minHeight: 680,
    title: `${displayName} — Instrumenta`,
    backgroundColor: isLudere ? '#171419' : '#101012',
    icon: app.isPackaged ? undefined : path.join(__dirname, '..', 'packaging', 'icon.png'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: secureWebPreferences({
      ...(partition ? { partition } : {}),
      devTools: !app.isPackaged,
    }),
  });
  toolWindow.removeMenu();
  toolWindow.on('closed', () => {
    if (webWindows.get(tool) === toolWindow) webWindows.delete(tool);
    // Static servers are cheap and stay up; a managed product server is a real
    // child process tree, so closing its window must shut it down.
    if (isService) stopService(tool).catch(() => {});
    // A server retired while this window used it goes with the window.
    if (webServers.get(tool)?.retired) closeWebServer(tool);
    // An update fetched while the product was open can go in now.
    applyUpdatePolicy([tool]);
  });
  toolWindow.once('ready-to-show', () => {
    if (!toolWindow.isDestroyed()) toolWindow.show();
  });
  hardenSession(toolWindow.webContents.session, { report: reportSecurity(tool) });
  if (isService) attachServiceHeaders(toolWindow.webContents.session, tool);
  attachWebContentsPolicy(toolWindow.webContents, {
    allowedUrl: url,
    report: reportSecurity(tool),
  });
  attachCrashRecovery(toolWindow, displayName);
  webWindows.set(tool, toolWindow);
  try {
    await toolWindow.loadURL(url);
    if (servedManaged) confirmManagedVersion(managedInstallRoot(), tool);
  } catch (error) {
    if (webWindows.get(tool) === toolWindow) webWindows.delete(tool);
    if (!toolWindow.isDestroyed()) toolWindow.destroy();
    if (isService) await stopService(tool);
    throw openFailure(error);
  }
}

async function runLaunchCheck() {
  const state = currentState();
  if (!state.imago.ready || !state.ludere.ready) {
    throw new Error('Imago and Ludere production builds must be ready for the launcher smoke check.');
  }
  const launcher = await launcherWindow.webContents.executeJavaScript(`({
    title: document.title,
    api: typeof window.instrumenta?.getState === 'function'
  })`);

  await openWebTool('imago', state.imago.location);
  const imago = await webWindows.get('imago').webContents.executeJavaScript(`(async () => {
    const moduleUrl = URL.createObjectURL(new Blob(['export default 7'], { type: 'text/javascript' }));
    const workerUrl = URL.createObjectURL(new Blob(['postMessage("ready")'], { type: 'text/javascript' }));
    try {
      const blobModule = (await import(moduleUrl)).default === 7;
      const blobWorker = await new Promise((resolve) => {
        const worker = new Worker(workerUrl);
        const timer = setTimeout(() => { worker.terminate(); resolve(false); }, 5000);
        worker.onmessage = (event) => {
          clearTimeout(timer);
          worker.terminate();
          resolve(event.data === 'ready');
        };
        worker.onerror = () => { clearTimeout(timer); worker.terminate(); resolve(false); };
      });
      const wasm = await WebAssembly.compile(new Uint8Array([0,97,115,109,1,0,0,0])).then(() => true, () => false);
      return {
        title: document.title,
        root: Boolean(document.querySelector('#root')),
        isolated: crossOriginIsolated,
        indexedDb: typeof indexedDB !== 'undefined',
        blobModule,
        blobWorker,
        wasm,
        popupDenied: window.open('https://example.invalid/') === null,
      };
    } finally {
      URL.revokeObjectURL(moduleUrl);
      URL.revokeObjectURL(workerUrl);
    }
  })()`);

  await openWebTool('ludere', state.ludere.location);
  const ludere = await webWindows.get('ludere').webContents.executeJavaScript(`(async () => ({
    title: document.title,
    editor: Boolean(document.querySelector('#editor')),
    isolated: crossOriginIsolated,
    localStorage: typeof localStorage !== 'undefined',
    serviceWorker: 'serviceWorker' in navigator
      ? await Promise.race([
          navigator.serviceWorker.ready.then(() => true, () => false),
          new Promise((resolve) => setTimeout(() => resolve(false), 5000)),
        ])
      : false,
    popupDenied: window.open('https://example.invalid/') === null,
  }))()`);

  const report = assertLaunchCheck({ launcher, imago, ludere, consoleMessages: launchCheckConsole });
  const marker = `${launchCheckFile}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(launchCheckFile), { recursive: true });
  try {
    fs.writeFileSync(marker, `INSTRUMENTA_LAUNCH_OK ${app.getVersion()}\n${JSON.stringify(report, null, 2)}\n`, {
      encoding: 'utf8', mode: 0o600,
    });
    fs.renameSync(marker, launchCheckFile);
  } finally {
    fs.rmSync(marker, { force: true });
  }
  diagnostics.write('launcher-smoke-check-passed', { report });
}

function commandEnvironment() {
  return { ...process.env };
}

// Where a native bundle may be launched from: its deployed source folders, the
// copy packaged into this installer, and the launcher's own local mirror.
function trustedNativeRoots(state, tool) {
  const product = state.products?.find((entry) => entry.id === tool) || state[tool];
  const displayName = product?.displayName || tool;
  const sourceRoot = product?.sourceRoot || (state.workspace && path.join(state.workspace, displayName));
  return [
    sourceRoot && path.join(sourceRoot, 'dist', 'windows'),
    sourceRoot && path.join(sourceRoot, 'prebuilt', 'windows'),
    process.resourcesPath && path.join(process.resourcesPath, 'apps', tool),
    localBundleRoot(app.getPath('userData'), displayName),
  ].filter(Boolean);
}

async function openNativeBundle(tool, target, state) {
  const name = target.displayName || tool;
  const running = nativeProcesses.get(tool);
  if (running && running.exitCode === null && !running.killed) {
    setActivity(`${name} is already running.`, '');
    return;
  }
  const roots = trustedNativeRoots(state, tool);
  const sourceExecutable = assertTrustedExecutable(target.location, roots, process.platform, name);
  // The bundle's own launch arguments ride along on the runtime check and the
  // launch alike; the manifest reader has already validated their shape.
  const args = Array.isArray(target.launchArguments) ? target.launchArguments : [];
  const env = commandEnvironment();
  setActivity(`Checking the ${name} native runtime…`, tool);
  try {
    // A bundle on a WSL or network share loads every one of its libraries across
    // that share. Mirror it to local storage once, then launch the local copy.
    const local = await ensureLocalBundle({
      source: path.dirname(sourceExecutable),
      cacheRoot: app.getPath('userData'),
      id: name,
      manifest: `${tool}-bundle.json`,
      onProgress: (message) => setActivity(message, tool),
    });
    if (local.copied) setActivity(`Checking the ${name} native runtime…`, tool);
    const executable = assertTrustedExecutable(
      path.join(local.root, path.basename(sourceExecutable)),
      roots,
      process.platform,
      name,
    );
    await probeExecutable(executable, { env, args, name });
    const child = spawnExecutable(executable, { env, args });
    nativeProcesses.set(tool, child);
    child.once('error', (error) => {
      nativeProcesses.delete(tool);
      setActivity(`${name} could not open: ${error.message}`, '');
    });
    child.once('exit', () => nativeProcesses.delete(tool));
    setActivity(`${name} opened.`, '');
  } catch (error) {
    setActivity(`${name} launch needs attention.`, '');
    throw error;
  }
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    let commandFile = command;
    let commandArgs = args;
    if (process.platform === 'win32' && command === 'npm.cmd') {
      const nodeRoot = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs');
      const npmCli = process.env.npm_execpath || path.join(nodeRoot, 'node_modules', 'npm', 'bin', 'npm-cli.js');
      commandFile = process.env.npm_node_execpath || path.join(nodeRoot, 'node.exe');
      commandArgs = [npmCli, ...args];
    }
    const psQuote = (value) => `'${String(value).replace(/'/g, "''")}'`;
    const powershellCommand = `Set-Location -LiteralPath ${psQuote(cwd)}; & ${psQuote(commandFile)} ${commandArgs.map(psQuote).join(' ')}; exit $LASTEXITCODE`;
    const child = process.platform === 'win32'
      ? spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-Command', powershellCommand], {
          cwd: process.env.SystemRoot || 'C:\\Windows',
          env: commandEnvironment(),
          windowsHide: true,
        })
      : spawn(command, args, {
          cwd,
          env: commandEnvironment(),
          windowsHide: true,
          shell: false,
        });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(output.trim() || `${command} exited with code ${code}.`));
    });
  });
}

async function openDesktopProduct(tool, target) {
  const executable = target.location;
  if (!executable || !fs.existsSync(executable)) throw new Error(`${target.displayName} executable was not found.`);
  const trustedRoot = target.adapter === 'managed-bundle'
    ? path.join(managedInstallRoot(), tool)
    : path.dirname(executable);
  const trusted = assertTrustedExecutable(executable, [trustedRoot], process.platform, target.displayName);
  const managed = target.adapter === 'managed-bundle' ? resolveManagedInstall(managedInstallRoot(), tool) : null;
  setActivity(`Opening ${target.displayName}…`, tool);
  try {
    const child = spawnExecutable(trusted, { env: commandEnvironment() });
    nativeProcesses.set(tool, child);
    child.once('spawn', () => {
      if (managed) confirmManagedVersion(managedInstallRoot(), tool);
      setActivity(`${target.displayName} opened.`, '');
    });
    child.once('error', (error) => {
      nativeProcesses.delete(tool);
      rollBackFailedFirstOpen(tool, target.adapter, managed);
      setActivity(`${target.displayName} could not open: ${error.message}`, '');
    });
    child.once('exit', () => {
      nativeProcesses.delete(tool);
      // An update fetched while the product was running can go in now.
      applyUpdatePolicy([tool]);
    });
  } catch (error) {
    rollBackFailedFirstOpen(tool, target.adapter, managed);
    setActivity(`${target.displayName} launch needs attention.`, '');
    throw error;
  }
}

// Queues an install someone asked for and waits for it, so a failure comes back as an error
// dialog. The queue runs one install at a time; asking while another runs used to be dropped in
// silence by the busy check this replaces.
async function installTool(tool) {
  const definition = productDefinition(tool);
  if (!definition?.release?.repository) throw new Error(`No release installer exists for ${tool}.`);
  const name = definition.displayName || tool;
  announce(installQueue.jobs().length ? `${name} is queued to install.` : `Checking the latest ${name} release…`);
  try {
    const result = await installQueue.enqueue(tool, { kind: 'install', explicit: true });
    announce(result.alreadyCurrent ? `${name} ${result.version} is already installed.` : `${name} ${result.version} installed.`);
    return currentState();
  } catch (error) {
    announce(`${name} installation needs attention.`);
    throw new Error(`Could not install ${name}.\n\n${error.message}`);
  }
}

// The app chooser's Install: every picked product is queued at once, and the answer waits for
// all of them. One failure does not stop the others; each is named in the error.
async function installManyTools(tools) {
  if (!Array.isArray(tools) || !tools.length || !tools.every((tool) => typeof tool === 'string' && /^[a-z][a-z0-9-]*$/.test(tool))) {
    throw new Error('Choose at least one app to install.');
  }
  const unique = [...new Set(tools)];
  const results = await Promise.allSettled(unique.map((tool) => installTool(tool)));
  const failures = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason?.message || String(result.reason));
  if (failures.length) throw new Error(failures.join('\n\n'));
  return currentState();
}

async function uninstallTool(tool) {
  if (busyTool) return currentState();
  const state = currentState();
  const target = state[tool];
  if (!target || !target.canUninstall) throw new Error(`${tool} is not installed by Instrumenta.`);
  const blocker = lifecycleBlocker({
    operation: 'uninstall', adapter: target.adapter, running: isRunning(tool), installing: installQueue.has(tool), displayName: target.displayName,
  });
  if (blocker) throw new Error(blocker);
  const managed = supportsRollback(target.adapter);
  const choice = await dialog.showMessageBox(launcherWindow, {
    type: 'warning',
    title: `Uninstall ${target.displayName}`,
    message: `Remove ${target.displayName} from this computer?`,
    detail: managed
      ? 'The managed application versions will be moved to the Recycle Bin. User-created files are not removed.'
      : 'The application uninstaller will open. User-created files are not removed.',
    buttons: [`Uninstall ${target.displayName}`, 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (choice.response !== 0) return currentState();
  setActivity(`Uninstalling ${target.displayName}…`, tool);
  try {
    if (managed) {
      // Nothing may go on serving files that are about to be in the Recycle Bin.
      await closeWebServer(tool);
      await shell.trashItem(path.join(managedInstallRoot(), tool));
    } else {
      const uninstaller = path.join(path.dirname(target.location), `Uninstall ${target.displayName}.exe`);
      if (!fs.existsSync(uninstaller)) throw new Error(`Could not find the registered ${target.displayName} uninstaller.`);
      await new Promise((resolve, reject) => {
        const child = spawn(uninstaller, [], { cwd: path.dirname(uninstaller), windowsHide: false, stdio: 'ignore' });
        child.once('error', reject);
        child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Uninstaller exited with code ${code}.`)));
      });
    }
  } catch (error) {
    setActivity(`${target.displayName} could not be uninstalled.`, '');
    throw error;
  }
  setActivity(`${target.displayName} uninstalled.`, '');
  checkForProductUpdates().catch(() => {});
  return broadcast();
}

// Roll back is offered whenever a previous version is kept, so it works on a version that did
// launch too. The version rolled back from is not offered again until installed on purpose.
function rollbackTool(tool) {
  const definition = productDefinition(tool);
  if (!definition || !supportsRollback(definition.adapter)) throw new Error('Only managed releases can be rolled back.');
  const name = definition.displayName || tool;
  const blocker = lifecycleBlocker({ operation: 'rollback', adapter: definition.adapter, installing: installQueue.has(tool), displayName: name });
  if (blocker) throw new Error(blocker);
  const rolledBackFrom = resolveManagedInstall(managedInstallRoot(), tool);
  rollbackManagedVersion(managedInstallRoot(), tool, { requirePending: false });
  if (rolledBackFrom?.version) rememberRollback(tool, rolledBackFrom.version);
  retireWebServer(tool);
  announce(`${name} rolled back to its previous version.`);
  return currentState();
}

async function prepareTool(tool) {
  if (busyTool) return currentState();
  const state = currentState();
  const workspace = state.workspace;
  if (!workspace) throw new Error('Choose the Instrumenta workspace first.');
  const definition = productDefinition(tool);
  const target = state.products?.find((product) => product.id === tool);
  if (!definition || !target) throw new Error(`Unknown Instrumenta product: ${tool}`);
  if (definition.adapter === 'web-service') {
    setActivity(`Preparing ${definition.displayName}. This can take a few minutes the first time…`, tool);
    const directory = target.sourceRoot || path.join(workspace, definition.catalog.sourceDirectory);
    // A checkout on a WSL share holds Linux dependencies; Windows pnpm would
    // overwrite them with Windows-native modules the service cannot load.
    // Preparation runs inside the distribution, exactly like the launch.
    const preparePlan = process.platform === 'win32'
      ? planPrepare({ cwd: directory, commands: [['pnpm', 'install', '--frozen-lockfile'], ['pnpm', 'run', 'build']] })
      : null;
    const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const runPnpm = async (args) => {
      try {
        await run(pnpm, args, directory);
      } catch (error) {
        // A workspace product may rely on Corepack rather than a global pnpm.
        if (error.code !== 'ENOENT' && !/ENOENT|not (?:be )?(?:found|recognized)/i.test(error.message || '')) throw error;
        await run(process.platform === 'win32' ? 'corepack.cmd' : 'corepack', ['pnpm', ...args], directory);
      }
    };
    try {
      if (preparePlan) {
        await run(preparePlan.executable, preparePlan.args, path.dirname(preparePlan.executable));
      } else {
        await runPnpm(['install', '--frozen-lockfile']);
        await runPnpm(['run', 'build']);
      }
      setActivity(`${definition.displayName} is ready.`, '');
    } catch (error) {
      setActivity(`${definition.displayName} setup needs attention.`, '');
      throw new Error(`Could not prepare ${definition.displayName}.\n\n${error.message}`);
    }
    return currentState();
  }
  // How the product is built, not how it is delivered: a web product released as managed-web
  // still builds from its checkout the way it always did.
  const builtAs = definition.builtAs || definition.adapter;
  if (builtAs === 'web-vite' || builtAs === 'web-static') {
    setActivity(`Preparing ${definition.displayName}. This can take a few minutes the first time…`, tool);
    const directory = target.sourceRoot || path.join(workspace, definition.catalog.sourceDirectory);
    try {
      if (process.platform === 'win32' && directory.startsWith('\\\\')) {
        const node = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe');
        const manager = path.join(__dirname, '..', 'scripts', 'workspace-manager.cjs');
        await run(node, [manager, 'prepare', tool], path.dirname(manager));
      } else {
        await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci'], directory);
        await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], directory);
      }
      setActivity(`${definition.displayName} is ready.`, '');
    } catch (error) {
      setActivity(`${definition.displayName} setup needs attention.`, '');
      throw new Error(`Could not prepare ${definition.displayName}.\n\n${error.message}`);
    }
    return currentState();
  }
  if ((definition.builtAs || definition.adapter) === 'native-bundle') {
    const name = definition.displayName || tool;
    const directory = target.sourceRoot || path.join(workspace, definition.catalog.sourceDirectory);
    const bootstrap = path.join(directory, 'scripts', 'bootstrap-windows.ps1');
    // The product's own bootstrap script says what preparing means for it (Fabula's deploys an
    // Electron runtime). It is Windows PowerShell, so nothing else can prepare a native product.
    if (process.platform !== 'win32') {
      throw new Error(`${name} is prepared by its Windows bootstrap script; run Instrumenta on Windows to prepare it.`);
    }
    const choice = await dialog.showMessageBox(launcherWindow, {
      type: 'info',
      title: `Prepare ${name}`,
      message: `Prepare the native ${name} application?`,
      detail: `Instrumenta will run ${name}'s own Windows bootstrap script (scripts\\bootstrap-windows.ps1), which deploys or refreshes its runtime under dist\\windows. Project files and source media are not modified.`,
      buttons: [`Prepare ${name}`, 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (choice.response !== 0) {
      setActivity(`${name} preparation cancelled.`, '');
      return currentState();
    }
    setActivity(`Preparing and verifying ${name}. This can take a few minutes…`, tool);
    try {
      if (!fs.existsSync(bootstrap)) throw new Error(`${name} is missing scripts\\bootstrap-windows.ps1.`);
      await run('powershell.exe', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', bootstrap], directory);
      if (!currentState().products?.find((product) => product.id === tool)?.ready) {
        throw new Error(`${definition.displayName}'s bootstrap finished, but no verified desktop bundle was produced.`);
      }
      setActivity(`${definition.displayName} is ready.`, '');
    } catch (error) {
      setActivity(`${definition.displayName} build needs attention.`, '');
      throw new Error(`Could not build ${definition.displayName}.\n\n${error.message}`);
    }
    return currentState();
  }
  throw new Error(`No preparation adapter exists for ${tool}.`);
}

const launcherContents = () => (
  launcherWindow && !launcherWindow.isDestroyed() ? launcherWindow.webContents : null
);
const handleLauncher = (channel, handler) => (
  registerTrustedIpcHandler(ipcMain, channel, launcherContents, handler)
);

handleLauncher('instrumenta:get-state', () => currentState());
handleLauncher('instrumenta:refresh', () => {
  activity = 'Workspace refreshed.';
  const state = broadcast();
  // An explicit Refresh is the user asking "is anything new?", so it bypasses the
  // cache TTL. It resolves after the state has already gone back, so the window
  // never waits on the network.
  checkForProductUpdates({ force: true }).catch(() => {});
  return state;
});
handleLauncher('instrumenta:choose-workspace', async () => {
  const selection = await dialog.showOpenDialog(launcherWindow, {
    title: 'Choose the Instrumenta workspace',
    defaultPath: resolvedWorkspace() || app.getPath('documents'),
    properties: ['openDirectory'],
  });
  if (selection.canceled || !selection.filePaths[0]) return currentState();
  const selected = selection.filePaths[0];
  if (!isWorkspace(selected)) {
    await dialog.showMessageBox(launcherWindow, {
      type: 'warning',
      title: 'That is not the Instrumenta workspace',
      message: 'Choose the Instrumenta workspace folder containing the registered product checkouts.',
      detail: selected,
    });
    return currentState();
  }
  settings.workspace = selected;
  saveSettings();
  activity = 'Workspace selected.';
  return broadcast();
});
handleLauncher('instrumenta:launch', async (_event, tool) => {
  const state = currentState();
  const target = state[tool];
  if (!target) throw new Error(`Unknown Instrumenta product: ${tool}`);
  if (!target.ready) throw new Error(target.detail);
  if (target.adapter === 'native-bundle') {
    await openNativeBundle(tool, target, state);
  } else if (['managed-bundle', 'installed-desktop'].includes(target.adapter)) {
    await openDesktopProduct(tool, target);
  } else {
    await openWebTool(tool, target.location, productDefinition(tool) || target);
    setActivity(`${target.displayName} opened.`, '');
  }
  return currentState();
});
handleLauncher('instrumenta:prepare', (_event, tool) => prepareTool(tool));
handleLauncher('instrumenta:install', (_event, tool) => installTool(tool));
handleLauncher('instrumenta:install-many', (_event, tools) => installManyTools(tools));
handleLauncher('instrumenta:set-preferences', (_event, change) => {
  settings = applyPreference(settings, change);
  saveSettings();
  // Turning automatic updates on should act on what is already known, not wait six hours.
  if (change?.autoUpdate === true) applyUpdatePolicy(change.product ? [change.product] : null);
  return broadcast();
});
// The launcher's own update, from the header: fetch it (automatic updates off), install it now
// (Restart), or, for the portable launcher, open the release to download by hand.
handleLauncher('instrumenta:launcher-update', async (_event, action) => {
  const entry = readVersionCache(updateCacheRoot())[selfUpdate.LAUNCHER_ID];
  const update = selfUpdate.availableUpdate(entry, app.getVersion());
  if (action === 'download') {
    if (!update) throw new Error('There is no newer Instrumenta to download.');
    await startLauncherDownload(update);
    return broadcast();
  }
  if (action === 'restart') {
    if (launcherUpdate.state !== 'ready' || launcherRoute() !== 'installer') throw new Error('The update is not ready to install yet.');
    launcherRelaunch = true;
    app.quit();
    return null;
  }
  if (action === 'open-release') {
    const release = launcherRelease();
    if (!release || !update) throw new Error('There is no newer Instrumenta release to open.');
    const { owner, name } = release.repository;
    await shell.openExternal(`https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/releases/tag/${encodeURIComponent(update.tag)}`);
    return null;
  }
  throw new Error('Unknown launcher update action.');
});
handleLauncher('instrumenta:uninstall', (_event, tool) => uninstallTool(tool));
handleLauncher('instrumenta:rollback', (_event, tool) => rollbackTool(tool));
handleLauncher('instrumenta:reveal', async (_event, tool) => {
  const state = currentState();
  const target = state[tool];
  if (!target) return;
  // A ready native bundle's location is its executable; reveal the folder around it.
  const location = target.ready && target.adapter === 'native-bundle' ? path.dirname(target.location) : target.location;
  if (location) {
    const failure = await shell.openPath(location);
    if (failure) throw new Error(`Could not open that folder.\n\n${failure}`);
  }
});
handleLauncher('instrumenta:open-workspace', async () => {
  const workspace = resolvedWorkspace();
  if (workspace) {
    const failure = await shell.openPath(workspace);
    if (failure) throw new Error(`Could not open the Instrumenta workspace.\n\n${failure}`);
  }
});

// ---- About, storage and readiness ----------------------------------------------------------
// Links are opened by key, from the catalogue that shipped with this launcher; see launcher-links.cjs.
function shippedCatalog() {
  return JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'products', 'catalog.json'), 'utf8'));
}
handleLauncher('instrumenta:open-link', async (_event, key) => {
  await shell.openExternal(linkFor(key, shippedCatalog()));
  return null;
});

function runQuietly(command, args, timeout = 20_000) {
  return new Promise((resolve) => {
    execFile(command, args, { encoding: 'utf8', timeout, windowsHide: true }, (error, stdout) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout: stdout || '' });
    });
  });
}

function storageOptions() {
  const layout = storage();
  const definitions = productDefinitions(loadRegistry(registryOptions()));
  const extras = [];
  for (const product of definitions) {
    if (product.adapter === 'installed-desktop' && product.versionProbe?.displayName) {
      extras.push({
        product: product.id, label: product.displayName, note: 'Installed by its own installer. Uninstall it from its tile to free this.',
        measure: async () => {
          const location = windowsInstallLocation(product.versionProbe.displayName);
          if (!location) return null;
          const { directorySize } = require('./storage-report.cjs');
          return { bytes: await directorySize(location), path: location };
        },
      });
    }
  }
  if (definitions.some((product) => product.id === 'fabula')) {
    // Fabula's engine lives in WSL and is Fabula's to manage; it is measured, never cleaned here.
    extras.push({
      product: 'fabula', label: 'Fabula engine (WSL)', note: 'Fabula\'s editor, Node, ffmpeg and WhisperX, inside WSL. Managed by Fabula.',
      measure: async () => {
        const script = 'du -sb "$HOME/.local/share/fabula" 2>/dev/null | cut -f1';
        const result = process.platform === 'win32' ? await runQuietly('wsl.exe', ['-e', 'bash', '-lc', script], 60_000) : await runQuietly('bash', ['-lc', script], 60_000);
        const bytes = Number.parseInt(String(result.stdout).trim(), 10);
        return Number.isSafeInteger(bytes) ? { bytes, path: '~/.local/share/fabula' } : null;
      },
    });
  }
  return {
    installRoot: layout.installRoot,
    downloadsRoot: layout.downloadsRoot,
    products: definitions,
    readPointer,
    downloading: installQueue.jobs().length > 0 || Boolean(launcherDownload),
    forgetPrevious: async (productRoot) => { forgetPreviousVersion(layout.installRoot, path.basename(productRoot)); },
    extras,
  };
}
handleLauncher('instrumenta:storage', () => storageReport(storageOptions()));
handleLauncher('instrumenta:clean', async (_event, key) => {
  await cleanStorage(key, storageOptions());
  return broadcast();
});

handleLauncher('instrumenta:readiness', async () => {
  let freeBytes = null;
  try {
    const root = storage().installRoot;
    const stats = await fs.promises.statfs(fs.existsSync(root) ? root : path.dirname(root));
    freeBytes = Number(stats.bavail) * Number(stats.bsize);
  } catch { /* unknown */ }
  const checks = await readiness.checkAll({ run: (command, args) => runQuietly(command, args), freeBytes });
  return { checks, products: readiness.productReadiness(productDefinitions(loadRegistry(registryOptions())), checks) };
});

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  diagnostics.write('secondary-instance-exit');
  app.quit();
} else {
  const showLauncher = async () => {
    if (!launcherWindow || launcherWindow.isDestroyed()) {
      await createWindow();
      return;
    }
    if (launcherWindow.isMinimized()) launcherWindow.restore();
    launcherWindow.show();
    launcherWindow.focus();
  };
  const reportWindowCreationFailure = (error) => {
    diagnostics.write('launcher-window-load-failed', { error });
    if (launchCheckFile) {
      console.error(`Instrumenta launch check failed: ${error.message || error}`);
      return;
    }
    dialog.showErrorBox(
      'Instrumenta could not open',
      `${error.message || error}\n\nDiagnostic: ${diagnostics.file}`,
    );
  };
  app.on('second-instance', () => {
    showLauncher().catch(reportWindowCreationFailure);
  });
  app.on('child-process-gone', (_event, details) => {
    diagnostics.write('electron-child-process-gone', details);
  });
  app.whenReady().then(async () => {
    loadSettings();
    await showLauncher();
    if (launchCheckFile) {
      await runLaunchCheck();
      app.quit();
      return;
    }
    // Data earlier launchers left behind (the roaming download cache, the Motus mirror) goes on the
    // first real start that finds it; a launch check is a probe and changes nothing. Not awaited:
    // removing several gigabytes must not hold the window.
    for (const stale of selfUpdate.staleLauncherDownloads(storage().downloadsRoot, app.getVersion())) {
      fs.promises.rm(stale, { recursive: true, force: true }).catch(() => {});
    }
    removeRetiredData(app.getPath('userData'))
      .then(({ removed, failed }) => {
        if (removed.length || failed.length) {
          diagnostics.write('retired-data-removed', {
            removed: removed.map((entry) => entry.path),
            failed: failed.map((entry) => ({ path: entry.path, error: entry.error })),
          });
        }
      })
      .catch((error) => diagnostics.write('retired-data-removal-failed', { error }));
    app.on('activate', () => {
      showLauncher().catch(reportWindowCreationFailure);
    });
    // Deliberately not awaited: the window is already up, and the first update
    // answer arrives as a state broadcast whenever the network gets round to it.
    // The cache is read first, so what is already known shows before any request.
    recomputeKnownVersions();
    broadcast();
    checkForProductUpdates().catch((error) => diagnostics.write('update-check-failed', { error }));
    // A launcher left open for days still hears about releases: every six hours, the
    // same span the cache keeps an answer for.
    updateTimer = setInterval(() => {
      checkForProductUpdates().catch((error) => diagnostics.write('update-check-failed', { error }));
    }, DEFAULT_TTL_MS);
    updateTimer.unref?.();
  }).catch((error) => {
    reportWindowCreationFailure(error);
    if (launchCheckFile) app.exit(1);
    else app.quit();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  // A verified update of the launcher itself goes in once the launcher has finished closing — its
  // services shut down, its windows gone — so the setup program replaces a program that is no
  // longer running anything. Restart asks for it with a relaunch; an ordinary quit applies it
  // when updates are automatic.
  app.on('quit', () => {
    if (launcherRelaunch || readPreferences(settings).autoUpdate) applyLauncherUpdate({ relaunch: launcherRelaunch });
  });
  let shuttingDown = false;
  app.on('before-quit', (event) => {
    isQuitting = true;
    if (shuttingDown) return;
    shuttingDown = true;
    diagnostics.write('launcher-stop');
    if (updateTimer) clearInterval(updateTimer);
    for (const { server } of webServers.values()) server.close().catch(() => {});
    if (!serviceProcesses.size && !serviceStarts.size) return;
    // A managed service is a real process tree. Hold the quit until it is gone,
    // with a bounded deadline so a stuck service cannot keep Instrumenta open.
    event.preventDefault();
    const deadline = new Promise((resolve) => { setTimeout(resolve, SERVICE_SHUTDOWN_MS); });
    Promise.race([shutdownServices(), deadline])
      .catch((error) => diagnostics.write('service-shutdown-failed', { error }))
      .finally(() => app.quit());
  });
}
