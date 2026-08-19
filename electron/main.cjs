const { app, BrowserWindow, crashReporter, dialog, ipcMain, shell } = require('electron');
const { spawn } = require('node:child_process');
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
const {
  attachServiceHeaders,
  attachWebContentsPolicy,
  hardenSession,
  registerTrustedIpcHandler,
  secureWebPreferences,
  toolPartition,
} = require('./security-policy.cjs');
const { discover, findWorkspace, isWorkspace, registryFor } = require('./workspace.cjs');

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

function currentState() {
  return {
    ...discover(resolvedWorkspace(), process.resourcesPath, app.getAppPath()),
    busyTool,
    activity,
    version: app.getVersion(),
    packaged: app.isPackaged,
  };
}

function productDefinition(id) {
  const root = resolvedWorkspace() || app.getAppPath();
  try { return registryFor(root).products.find((product) => product.id === id) || null; } catch { return null; }
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
    backgroundColor: '#0b0e12',
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

async function openWebTool(tool, buildDirectory, definition = productDefinition(tool)) {
  const existing = webWindows.get(tool);
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return;
  }
  const isService = definition?.adapter === 'web-service';
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
    let server = webServers.get(tool);
    if (!server) {
      server = await createStaticServer(buildDirectory, {
        port: definition?.launch?.port || definition?.port,
        fallbackPort: definition?.launch?.fallbackPort,
        tool,
      });
      webServers.set(tool, server);
    }
    url = server.url;
  }
  const isLudere = definition?.id === 'ludere';
  const displayName = definition?.displayName || tool;
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
  } catch (error) {
    if (webWindows.get(tool) === toolWindow) webWindows.delete(tool);
    if (!toolWindow.isDestroyed()) toolWindow.destroy();
    if (isService) await stopService(tool);
    diagnostics.write('tool-load-failed', { tool, error });
    throw error;
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
  const environment = { ...process.env };
  const mingw = 'C:\\msys64\\mingw64\\bin';
  if (process.platform === 'win32' && fs.existsSync(mingw)) {
    environment.Path = `${mingw};${environment.Path || environment.PATH || ''}`;
  }
  return environment;
}

function trustedMotusRoots(state) {
  const motus = state.products?.find((product) => product.id === 'motus') || state.motus;
  const sourceRoot = motus?.sourceRoot || (state.workspace && path.join(state.workspace, 'Motus'));
  return [
    sourceRoot && path.join(sourceRoot, 'dist', 'windows'),
    sourceRoot && path.join(sourceRoot, 'prebuilt', 'windows'),
    process.resourcesPath && path.join(process.resourcesPath, 'apps', motus?.id || 'motus'),
    localBundleRoot(app.getPath('userData')),
  ].filter(Boolean);
}

async function openMotus(target, state) {
  const running = nativeProcesses.get('motus');
  if (running && running.exitCode === null && !running.killed) {
    setActivity('Motus is already running.', '');
    return;
  }
  const sourceExecutable = assertTrustedExecutable(target.location, trustedMotusRoots(state));
  const env = commandEnvironment();
  setActivity('Checking the Motus native runtime…', 'motus');
  try {
    // A bundle on a WSL or network share loads every one of its libraries across
    // that share. Mirror it to local storage once, then launch the local copy.
    const local = await ensureLocalBundle({
      source: path.dirname(sourceExecutable),
      cacheRoot: app.getPath('userData'),
      onProgress: (message) => setActivity(message, 'motus'),
    });
    if (local.copied) setActivity('Checking the Motus native runtime…', 'motus');
    const executable = assertTrustedExecutable(
      path.join(local.root, path.basename(sourceExecutable)),
      trustedMotusRoots(state),
    );
    await probeExecutable(executable, { env });
    const child = spawnExecutable(executable, { env });
    nativeProcesses.set('motus', child);
    child.once('error', (error) => {
      nativeProcesses.delete('motus');
      setActivity(`Motus could not open: ${error.message}`, '');
    });
    child.once('exit', () => nativeProcesses.delete('motus'));
    setActivity('Motus opened.', '');
  } catch (error) {
    setActivity('Motus launch needs attention.', '');
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
  if (definition.adapter === 'web-vite' || definition.adapter === 'web-static') {
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
  if (definition.adapter === 'native-bundle') {
    const directory = target.sourceRoot || path.join(workspace, definition.catalog.sourceDirectory);
    const preset = process.platform === 'win32' ? 'windows-mingw-release' : 'dev';
    if (process.platform === 'win32') {
      const choice = await dialog.showMessageBox(launcherWindow, {
        type: 'info',
        title: 'Prepare Motus',
        message: 'Prepare the native Motus application?',
        detail: 'Instrumenta will install or update the MSYS2 compiler and Qt prerequisites when needed, then build, test, runtime-check, and deploy Motus. Project files and source media are not modified.',
        buttons: ['Prepare Motus', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });
      if (choice.response !== 0) {
        setActivity('Motus preparation cancelled.', '');
        return currentState();
      }
    }
    setActivity('Preparing and verifying Motus. This can take a few minutes…', 'motus');
    try {
      if (process.platform === 'win32') {
        const bootstrap = path.join(directory, 'scripts', 'bootstrap-windows.ps1');
        if (!fs.existsSync(bootstrap)) throw new Error('Motus is missing scripts\\bootstrap-windows.ps1.');
        await run('powershell.exe', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', bootstrap], directory);
      } else {
        await run('cmake', ['--preset', preset], directory);
        await run('cmake', ['--build', '--preset', preset], directory);
        await run('ctest', ['--test-dir', path.join('build', preset), '--output-on-failure'], directory);
        await run('cmake', ['--install', path.join('build', preset), '--prefix', path.join('dist', 'windows')], directory);
      }
      if (!currentState().products?.find((product) => product.id === tool)?.ready) {
        throw new Error(`The ${definition.displayName} core built successfully, but no verified desktop bundle was produced.`);
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
  return broadcast();
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
    await openMotus(target, state);
  } else {
    await openWebTool(tool, target.location, productDefinition(tool) || target);
    setActivity(`${target.displayName} opened.`, '');
  }
  return currentState();
});
handleLauncher('instrumenta:prepare', (_event, tool) => prepareTool(tool));
handleLauncher('instrumenta:reveal', async (_event, tool) => {
  const state = currentState();
  const target = state[tool];
  if (!target) return;
  const location = target.ready && tool === 'motus' ? path.dirname(target.location) : target.location;
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
    app.on('activate', () => {
      showLauncher().catch(reportWindowCreationFailure);
    });
  }).catch((error) => {
    reportWindowCreationFailure(error);
    if (launchCheckFile) app.exit(1);
    else app.quit();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  let shuttingDown = false;
  app.on('before-quit', (event) => {
    isQuitting = true;
    if (shuttingDown) return;
    shuttingDown = true;
    diagnostics.write('launcher-stop');
    for (const server of webServers.values()) server.close();
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
