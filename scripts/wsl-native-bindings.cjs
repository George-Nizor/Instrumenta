'use strict';

// A node_modules installed from Windows inside a WSL checkout carries only the win32 native
// bindings and .bin shims without execute bits, so the same tree fails in WSL. This finds every
// linux-x64-gnu optional binding a package declares but the tree lacks, and with --fix adds it
// beside the Windows one (npm pack + extract, never a reinstall) so both sides keep working.
//
//   node scripts/wsl-native-bindings.cjs [--fix] [product-dir ...]

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const workspaceRoot = path.resolve(__dirname, '..', '..');
const bindingPattern = /-linux-x64-gnu$/;

function nodeModulesRoots(dir) {
  const roots = [];
  for (const candidate of [dir, ...safeList(dir).map((name) => path.join(dir, name))]) {
    if (fs.existsSync(path.join(candidate, 'node_modules'))) roots.push(candidate);
  }
  return roots;
}

function safeList(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules')
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function packagesIn(modulesDir, depth = 0) {
  const found = [];
  for (const name of safeList(modulesDir)) {
    const dir = path.join(modulesDir, name);
    if (name.startsWith('@')) {
      found.push(...packagesIn(dir, depth));
      continue;
    }
    found.push(dir);
    if (depth < 3 && fs.existsSync(path.join(dir, 'node_modules'))) {
      found.push(...packagesIn(path.join(dir, 'node_modules'), depth + 1));
    }
  }
  return found;
}

function missingBindings(root) {
  const modulesDir = path.join(root, 'node_modules');
  const missing = new Map();
  for (const dir of packagesIn(modulesDir)) {
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    } catch {
      continue;
    }
    for (const [name, range] of Object.entries(manifest.optionalDependencies || {})) {
      if (!bindingPattern.test(name)) continue;
      if (fs.existsSync(path.join(modulesDir, name)) || fs.existsSync(path.join(dir, 'node_modules', name))) continue;
      // Pin to the parent's own version: native bindings are released in lockstep with it.
      missing.set(name, /^\d/.test(range) ? range : manifest.version);
    }
  }
  return missing;
}

function unexecutableShims(root) {
  const bin = path.join(root, 'node_modules', '.bin');
  if (!fs.existsSync(bin)) return [];
  return fs.readdirSync(bin).map((name) => path.join(bin, name)).filter((file) => {
    try {
      const stat = fs.statSync(file);
      return stat.isFile() && (stat.mode & 0o100) === 0;
    } catch {
      return false;
    }
  });
}

function addBinding(root, name, version, scratch) {
  const tarball = execFileSync('npm', ['pack', `${name}@${version}`, '--silent'], { cwd: scratch, encoding: 'utf8' }).trim();
  const target = path.join(root, 'node_modules', name);
  fs.mkdirSync(target, { recursive: true });
  execFileSync('tar', ['-xzf', path.join(scratch, tarball), '-C', target, '--strip-components=1']);
}

function main(argv) {
  if (process.platform !== 'linux') {
    console.log('Nothing to do: this repairs a Windows-installed tree for use from Linux/WSL.');
    return 0;
  }
  const fix = argv.includes('--fix');
  const named = argv.filter((arg) => !arg.startsWith('--'));
  const products = named.length
    ? named.map((dir) => path.resolve(dir))
    : safeList(workspaceRoot).map((name) => path.join(workspaceRoot, name));
  const scratch = fix ? fs.mkdtempSync(path.join(os.tmpdir(), 'wsl-bindings-')) : '';
  let problems = 0;
  try {
    for (const product of products) {
      for (const root of nodeModulesRoots(product)) {
        const label = path.relative(workspaceRoot, root) || root;
        const missing = missingBindings(root);
        const shims = unexecutableShims(root);
        if (!missing.size && !shims.length) continue;
        problems += missing.size + (shims.length ? 1 : 0);
        for (const [name, version] of missing) {
          if (fix) addBinding(root, name, version, scratch);
          console.log(`${label}: ${fix ? 'added' : 'missing'} ${name}@${version}`);
        }
        if (shims.length) {
          if (fix) for (const file of shims) fs.chmodSync(file, fs.statSync(file).mode | 0o111);
          console.log(`${label}: ${fix ? 'made executable' : 'not executable'} ${shims.length} .bin shim(s)`);
        }
      }
    }
  } finally {
    if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
  }
  if (!problems) console.log('Every node_modules tree has its Linux bindings.');
  return problems && !fix ? 1 : 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { missingBindings, unexecutableShims };
