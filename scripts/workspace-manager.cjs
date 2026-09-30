const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { discover } = require('../electron/workspace.cjs');
const { registryFor } = require('./product-registry.cjs');

const launcherRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(launcherRoot, '..');
function registry() { return registryFor(launcherRoot); }
function product(id) {
  const result = registry().products.find((entry) => entry.id === id);
  if (!result) throw new Error(`Instrumenta has no registered product named ${id}.`);
  return result;
}
function root(id) { return product(id).sourceRoot; }

function executable(name) {
  if (process.platform === 'win32' && name === 'npm') return 'npm.cmd';
  return name;
}

function run(command, args, cwd) {
  console.log(`\n› ${path.basename(cwd)} · ${command} ${args.join(' ')}`);
  const environment = process.env;
  let commandFile = executable(command);
  let commandArgs = args;
  if (process.platform === 'win32' && commandFile === 'npm.cmd') {
    const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    commandFile = process.execPath;
    commandArgs = [npmCli, ...args];
  }
  const psQuote = (value) => `'${String(value).replace(/'/g, "''")}'`;
  const powershellCommand = `Set-Location -LiteralPath ${psQuote(cwd)}; & ${psQuote(commandFile)} ${commandArgs.map(psQuote).join(' ')}; exit $LASTEXITCODE`;
  const result = process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-Command', powershellCommand], {
        cwd: process.env.SystemRoot || 'C:\\Windows', stdio: 'inherit', env: environment,
      })
    : spawnSync(executable(command), args, { cwd, stdio: 'inherit', shell: false, env: environment });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status || 1}.`);
}

function prepareWebVite(id = 'imago') {
  const install = (directory) => {
    run('npm', [fs.existsSync(path.join(directory, 'package-lock.json')) ? 'ci' : 'install', '--no-audit', '--no-fund'], directory);
    run('npm', ['run', 'build'], directory);
  };
  const imagoRoot = root(id);
  if (process.platform !== 'win32' || !imagoRoot.startsWith('\\\\')) {
    install(imagoRoot);
    return;
  }

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-imago-'));
  const mirror = path.join(temporaryRoot, 'Imago');
  console.log(`\nImago is on a WSL share; building in a local mirror at ${mirror}.`);
  try {
    fs.cpSync(imagoRoot, mirror, {
      recursive: true,
      filter: (candidate) => {
        const relative = path.relative(imagoRoot, candidate);
        const first = relative.split(path.sep)[0];
        return !['node_modules', 'dist', '.git'].includes(first);
      },
    });
    install(mirror);
    fs.rmSync(path.join(imagoRoot, 'dist'), { recursive: true, force: true });
    fs.cpSync(path.join(mirror, 'dist'), path.join(imagoRoot, 'dist'), { recursive: true });
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function prepareStaticWeb(id = 'ludere') {
  const ludereRoot = root(id);
  const tests = fs.readdirSync(path.join(ludereRoot, 'tests')).filter((name) => name.endsWith('.test.mjs')).map((name) => path.join('tests', name));
  run(process.execPath, ['--test', ...tests], ludereRoot);
  run(process.execPath, ['scripts/build.mjs'], ludereRoot);
}

// A managed-service product runs its server from source, so preparation keeps
// its workspace dependencies installed as well as building its client bundle.
function prepareWebService(id) {
  const serviceRoot = root(id);
  const attempt = (args) => {
    try {
      run('pnpm', args, serviceRoot);
    } catch (error) {
      if (error.code !== 'ENOENT' && !/ENOENT|not (?:be )?(?:found|recognized)/i.test(error.message || '')) throw error;
      run('corepack', ['pnpm', ...args], serviceRoot);
    }
  };
  attempt(['install', '--frozen-lockfile']);
  attempt(['run', 'build']);
}

function prepareImagoMcp(imagoRoot) {
  const mcpRoot = path.join(imagoRoot, 'mcp');
  const install = (directory) => {
    run('npm', [fs.existsSync(path.join(directory, 'package-lock.json')) ? 'ci' : 'install', '--no-audit', '--no-fund'], directory);
    run('npm', ['run', 'typecheck'], directory);
    run('npm', ['run', 'build'], directory);
  };
  if (process.platform !== 'win32' || !imagoRoot.startsWith('\\\\')) {
    install(mcpRoot);
    return;
  }

  // Windows npm cannot reliably replace node_modules/.bin on a WSL/9p share.
  // Build the MCP in a local mirror, then publish only its generated dist tree.
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-imago-mcp-'));
  const mirror = path.join(temporaryRoot, 'Imago');
  try {
    fs.cpSync(imagoRoot, mirror, {
      recursive: true,
      filter: (candidate) => {
        const relative = path.relative(imagoRoot, candidate);
        if (!relative) return true;
        const segments = relative.split(path.sep);
        return !segments.includes('node_modules') && !segments.includes('dist') && !segments.includes('.git');
      },
    });
    install(path.join(mirror, 'mcp'));
    fs.rmSync(path.join(mcpRoot, 'dist'), { recursive: true, force: true });
    fs.cpSync(path.join(mirror, 'mcp', 'dist'), path.join(mcpRoot, 'dist'), { recursive: true });
    const mirrorModules = path.join(mirror, 'mcp', 'node_modules');
    const sourceModules = path.join(mcpRoot, 'node_modules');
    fs.mkdirSync(sourceModules, { recursive: true });
    for (const entry of fs.readdirSync(mirrorModules, { withFileTypes: true })) {
      // npm's .bin links are share-specific and are not needed by the direct
      // Node entrypoint used by Instrumenta's MCP launcher.
      if (entry.name === '.bin') continue;
      fs.cpSync(path.join(mirrorModules, entry.name), path.join(sourceModules, entry.name), { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function prepareAi({ install = false } = {}) {
  const ludereRoot = root('ludere');
  const imagoRoot = root('imago');
  const ludereTests = fs.readdirSync(path.join(ludereRoot, 'tests')).filter((name) => name.endsWith('.test.mjs')).map((name) => path.join('tests', name));
  run(process.execPath, ['--test', ...ludereTests], ludereRoot);
  prepareImagoMcp(imagoRoot);
  if (install) run(process.execPath, [path.join(launcherRoot, 'ai', 'setup-agent.cjs'), 'install'], launcherRoot);
  else run(process.execPath, [path.join(launcherRoot, 'ai', 'mcp-smoke.cjs')], launcherRoot);
}

// A native product is prepared by its own scripts/bootstrap-windows.ps1 (Fabula's
// deploys an Electron runtime). That script is Windows PowerShell, so a native
// product can only be prepared on Windows.
function prepareNative(id) {
  const productRoot = root(id);
  const bootstrap = path.join(productRoot, 'scripts', 'bootstrap-windows.ps1');
  if (process.platform !== 'win32') {
    throw new Error(`${id} is prepared by its Windows bootstrap script; run Instrumenta.cmd build ${id} on Windows.`);
  }
  if (!fs.existsSync(bootstrap)) throw new Error(`${id} has no scripts/bootstrap-windows.ps1 to prepare it with.`);
  run('powershell.exe', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', bootstrap], productRoot);
  if (!discover(workspaceRoot)[id]?.ready) {
    throw new Error(`${id} built, but no verified desktop bundle was produced.`);
  }
}

function status() {
  const state = discover(workspaceRoot);
  for (const tool of state.products) {
    console.log(`${tool.id.padEnd(12)} ${tool.state.padEnd(12)} ${tool.location || tool.detail}`);
  }
}

const preparationSteps = Object.freeze({
  'web-vite': 'web-vite',
  'web-static': 'web-static',
  'web-service': 'web-service',
  'native-bundle': 'native',
});

// What `prepare <target>` does with each registered product. `all` and `web` prepare what can be
// prepared here and say what they pass over: a release-managed product installs from its own
// releases, and a native product's bootstrap script is Windows PowerShell. A product named on its
// own is never passed over; if it cannot be prepared, that is the error the person needs to see.
function preparationPlan(entries, target, platform = process.platform) {
  const selected = target === 'all' ? entries
    : target === 'web' ? entries.filter((entry) => entry.kind === 'web')
      : entries.filter((entry) => entry.id === target);
  const group = target === 'all' || target === 'web';
  return selected.map((entry) => {
    // By how it is built: a web product delivered as managed-web still builds from its checkout.
    const step = preparationSteps[entry.builtAs || entry.adapter] || '';
    const name = entry.displayName || entry.id;
    if (group && !step) return { id: entry.id, step: 'skip', reason: `${name} installs from its own releases.` };
    if (group && step === 'native' && platform !== 'win32') {
      return { id: entry.id, step: 'skip', reason: `${name} is prepared by its Windows bootstrap script.` };
    }
    return { id: entry.id, step, reason: '' };
  });
}

const preparers = Object.freeze({
  'web-vite': prepareWebVite,
  'web-static': prepareStaticWeb,
  'web-service': prepareWebService,
  native: prepareNative,
});

function prepare(target, { installAi = false } = {}) {
  const plan = preparationPlan(registry().products, target);
  if (target !== 'ai' && !plan.length && target !== 'launcher') throw new Error(`Unknown Instrumenta target: ${target}`);
  for (const { id, step, reason } of plan) {
    if (step === 'skip') console.log(`\nSkipping ${id}: ${reason}`);
    else if (!step) throw new Error(`No preparation adapter exists for ${id}; it installs from its own releases.`);
    else preparers[step](id);
  }
  if (target === 'all' || target === 'ai' || installAi) prepareAi({ install: installAi });
  status();
}

function verify() {
  const launcherTests = fs.readdirSync(path.join(launcherRoot, 'tests-electron')).filter((name) => name.endsWith('.test.cjs')).map((name) => path.join('tests-electron', name));
  run(process.execPath, ['--test', ...launcherTests], launcherRoot);
  prepareWebVite('imago');
  const ludereRoot = root('ludere');
  const ludereTests = fs.readdirSync(path.join(ludereRoot, 'tests')).filter((name) => name.endsWith('.test.mjs')).map((name) => path.join('tests', name));
  run(process.execPath, ['--test', ...ludereTests], ludereRoot);
}

if (require.main === module) {
  const command = process.argv[2] || 'status';
  const target = process.argv[3] || 'all';
  const installAi = process.argv.includes('--install-ai');
  try {
    if (command === 'status') status();
    else if (command === 'prepare') prepare(target, { installAi });
    else if (command === 'verify') verify();
    else throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    console.error(`\nInstrumenta workspace command failed:\n${error.message}`);
    process.exit(1);
  }
}

module.exports = { preparationPlan };
