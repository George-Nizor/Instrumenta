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
  const environment = process.platform === 'win32' && fs.existsSync('C:\\msys64\\mingw64\\bin')
    ? { ...process.env, Path: `C:\\msys64\\mingw64\\bin;${process.env.Path || process.env.PATH || ''}` }
    : process.env;
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

function prepareAi({ install = false } = {}) {
  const ludereRoot = root('ludere');
  const imagoRoot = root('imago');
  const motusRoot = root('motus');
  const ludereTests = fs.readdirSync(path.join(ludereRoot, 'tests')).filter((name) => name.endsWith('.test.mjs')).map((name) => path.join('tests', name));
  run(process.execPath, ['--test', ...ludereTests], ludereRoot);
  const mcpRoot = path.join(imagoRoot, 'mcp');
  run('npm', [fs.existsSync(path.join(mcpRoot, 'package-lock.json')) ? 'ci' : 'install', '--no-audit', '--no-fund'], mcpRoot);
  run('npm', ['run', 'typecheck'], mcpRoot);
  run('npm', ['run', 'build'], mcpRoot);
  const motusMcp = process.platform === 'win32'
    ? path.join(motusRoot, 'dist', 'windows', 'motus-mcp.exe')
    : path.join(motusRoot, 'build', 'agent', 'motus-mcp');
  if (!fs.existsSync(motusMcp)) {
    const buildScript = path.join(motusRoot, 'scripts', 'build-mcp.cjs');
    if (!fs.existsSync(buildScript)) {
      throw new Error('Motus MCP has no current native build or build helper.');
    }
    run(process.execPath, [buildScript], motusRoot);
  }
  if (install) run(process.execPath, [path.join(launcherRoot, 'ai', 'setup-agent.cjs'), 'install'], launcherRoot);
  else run(process.execPath, [path.join(launcherRoot, 'ai', 'mcp-smoke.cjs')], launcherRoot);
}

function prepareMotus() {
  const motusRoot = root('motus');
  const preset = process.platform === 'win32' ? 'windows-mingw-release' : 'dev';
  if (process.platform === 'win32') {
    run('powershell.exe', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(motusRoot, 'scripts', 'bootstrap-windows.ps1')], motusRoot);
  } else {
    run('cmake', ['--preset', preset], motusRoot);
    run('cmake', ['--build', '--preset', preset], motusRoot);
    run('ctest', ['--test-dir', path.join('build', preset), '--output-on-failure'], motusRoot);
    run('cmake', ['--install', path.join('build', preset), '--prefix', path.join('dist', 'windows')], motusRoot);
  }
  if (!discover(workspaceRoot).motus.ready) {
    throw new Error('Motus core built, but no verified desktop bundle was produced.');
  }
}

function status() {
  const state = discover(workspaceRoot);
  for (const tool of state.products) {
    console.log(`${tool.id.padEnd(12)} ${tool.state.padEnd(12)} ${tool.location || tool.detail}`);
  }
}

function prepare(target, { installAi = false } = {}) {
  const entries = registry().products;
  const selected = target === 'all' ? entries : target === 'web' ? entries.filter((entry) => entry.kind === 'web') : entries.filter((entry) => entry.id === target);
  if (target !== 'ai' && !selected.length && target !== 'launcher') throw new Error(`Unknown Instrumenta target: ${target}`);
  for (const entry of selected) {
    if (entry.adapter === 'web-vite') prepareWebVite(entry.id);
    else if (entry.adapter === 'web-static') prepareStaticWeb(entry.id);
    else if (entry.adapter === 'native-bundle') prepareMotus();
    else throw new Error(`No preparation adapter exists for ${entry.id}.`);
  }
  if (target === 'all' || target === 'ai' || installAi) prepareAi({ install: installAi });
  status();
}

function verify() {
  const launcherTests = fs.readdirSync(path.join(launcherRoot, 'tests-electron')).filter((name) => name.endsWith('.test.cjs')).map((name) => path.join('tests-electron', name));
  run(process.execPath, ['--test', ...launcherTests], launcherRoot);
  prepareWebVite('imago');
  const ludereRoot = root('ludere');
  const motusRoot = root('motus');
  const ludereTests = fs.readdirSync(path.join(ludereRoot, 'tests')).filter((name) => name.endsWith('.test.mjs')).map((name) => path.join('tests', name));
  run(process.execPath, ['--test', ...ludereTests], ludereRoot);
  run(process.execPath, ['--test', path.join('tests', 'bundle_runtime_tests.cjs')], motusRoot);
  const motusBundle = path.join(motusRoot, 'dist', 'windows');
  if (fs.existsSync(motusBundle)) {
    // Proves the deployed bundle carries every library it imports, so it opens
    // on a computer with no MSYS2, Qt, or MinGW installed.
    run(process.execPath, [path.join('scripts', 'bundle-runtime.cjs'), 'check', motusBundle], motusRoot);
  }
  const preset = process.platform === 'win32' ? 'windows-mingw-release' : 'dev';
  if (fs.existsSync(path.join(motusRoot, 'build', preset))) {
    run('ctest', ['--test-dir', path.join('build', preset), '--output-on-failure'], motusRoot);
  } else {
    console.log('\nMotus has no configured build yet; run `Instrumenta.cmd build motus` on Windows to build and test it.');
  }
}

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
  if (/cmake|Qt|ninja|compiler/i.test(error.message)) {
    console.error('Motus needs its native toolchain. On Windows, run `Instrumenta.cmd setup motus`; otherwise see Motus/docs/windows-bootstrap.md.');
  }
  process.exit(1);
}
