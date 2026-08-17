const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const MAX_PROBE_OUTPUT = 8_192;

function canonical(candidate) {
  try {
    return fs.realpathSync.native(candidate);
  } catch {
    return path.resolve(candidate);
  }
}

function isInside(candidate, root) {
  const relative = path.relative(canonical(root), canonical(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertTrustedExecutable(executable, allowedRoots, platform = process.platform) {
  if (!path.isAbsolute(executable || '')) throw new Error('Motus supplied a non-absolute executable path.');
  let stat;
  try {
    stat = fs.statSync(executable);
  } catch {
    throw new Error('The deployed Motus executable is missing. Rebuild Motus from Instrumenta.');
  }
  if (!stat.isFile()) throw new Error('The deployed Motus launch target is not a file.');
  if (platform === 'win32' && path.extname(executable).toLowerCase() !== '.exe') {
    throw new Error('Motus must be a Windows .exe application.');
  }
  if (!allowedRoots.some((root) => root && isInside(executable, root))) {
    throw new Error('Instrumenta refused to open Motus outside its trusted application directory.');
  }
  return canonical(executable);
}

function probeExecutable(executable, options = {}) {
  // Generous, because the first run of a freshly copied bundle pays for Windows
  // scanning a hundred new libraries. A healthy local bundle answers in about a
  // second; a bundle being run across a share takes minutes, which is what the
  // local staging step exists to prevent.
  const timeoutMs = options.timeoutMs || 60_000;
  const spawnProcess = options.spawnProcess || spawn;
  return new Promise((resolve, reject) => {
    let output = '';
    let settled = false;
    let timer;
    const probeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-motus-probe-'));
    const marker = path.join(probeRoot, 'ready.txt');
    const child = spawnProcess(executable, ['--instrumenta-launch-check', marker], {
      cwd: path.dirname(executable),
      env: options.env || process.env,
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fs.rmSync(probeRoot, { recursive: true, force: true });
      if (error) reject(error);
      else resolve();
    };
    const collect = (chunk) => {
      if (output.length < MAX_PROBE_OUTPUT) output += chunk.toString().slice(0, MAX_PROBE_OUTPUT - output.length);
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);
    child.once('error', (error) => finish(new Error(`Motus could not start its runtime check: ${error.message}`)));
    child.once('close', (code) => {
      if (code === 0 && fs.existsSync(marker) && /MOTUS_LAUNCH_OK\s+\d+\.\d+\.\d+/.test(fs.readFileSync(marker, 'utf8'))) return finish();
      const detail = output.trim() || `runtime check exited with code ${code}`;
      finish(new Error(`Motus is installed but its native runtime is incomplete (${detail}). Rebuild it from Instrumenta.`));
    });
    timer = setTimeout(() => {
      child.kill();
      finish(new Error(
        `Motus did not answer its native runtime check within ${Math.round(timeoutMs / 1000)} seconds. `
        + 'This usually means it is being run from slow storage rather than that the build is broken.',
      ));
    }, timeoutMs);
  });
}

function spawnExecutable(executable, options = {}) {
  const spawnProcess = options.spawnProcess || spawn;
  const child = spawnProcess(executable, [], {
    cwd: path.dirname(executable),
    env: options.env || process.env,
    detached: true,
    windowsHide: false,
    shell: false,
    stdio: 'ignore',
  });
  child.unref();
  return child;
}

module.exports = { assertTrustedExecutable, isInside, probeExecutable, spawnExecutable };
