'use strict';

// A managed-service product may keep its checkout, dependencies, and CLI
// authentication inside a WSL distribution, where Windows reaches the files
// only through a \\wsl.localhost (or \\wsl$) share. Windows cannot run such a
// service directly: the package manager and native modules exist only inside
// the distribution. When a service's working directory is a WSL share, the
// launch is wrapped in `wsl.exe --exec bash -lc <script>` instead. WSL2
// forwards loopback ports to Windows, so the health gate and the product
// window keep talking to http://127.0.0.1:<port> unchanged.
//
// Lifetime contract: the script starts the service in its own session via
// setsid, records that process-group id in a pid file, and waits on it, so the
// wsl.exe child lives exactly as long as the service. Stopping runs a second
// wsl.exe invocation that signals the recorded group — killing wsl.exe itself
// would strand the Linux tree, which is why stop never relies on taskkill
// alone for a bridged service.

const path = require('node:path');

const SHARE_PATTERN = /^[\\/]{2}(?:wsl\.localhost|wsl\$)[\\/]+([^\\/]+)((?:[\\/].*)?)$/i;
const DISTRO_PATTERN = /^[A-Za-z0-9._-]+$/;
const TOKEN_PATTERN = /^[\x20-\x7e]+$/;

function parseWslShare(candidate) {
  if (typeof candidate !== 'string') return null;
  const match = SHARE_PATTERN.exec(candidate.trim());
  if (!match) return null;
  const distro = match[1];
  if (!DISTRO_PATTERN.test(distro)) return null;
  const remainder = (match[2] || '/').replace(/\\/g, '/');
  // A resolved Windows path never carries dot-dot segments; one that does is
  // not something this bridge should reinterpret.
  if (remainder.split('/').some((segment) => segment === '..')) return null;
  const linuxPath = path.posix.normalize(remainder === '' ? '/' : remainder);
  return { distro, linuxPath };
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function assertToken(value, label) {
  if (typeof value !== 'string' || !value || !TOKEN_PATTERN.test(value)) {
    throw new Error(`A WSL-bridged service ${label} must be printable ASCII, got ${JSON.stringify(value)}.`);
  }
  return value;
}

function wslExecutable() {
  return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wsl.exe');
}

function pidFileFor(tool, port) {
  const safe = String(tool).replace(/[^a-z0-9-]/gi, '') || 'service';
  return `/tmp/instrumenta-service-${safe}-${port}.pid`;
}

// The launcher's environment does not cross the wsl.exe boundary, so the
// service variables travel inside the script as an env(1) prefix. A login
// shell supplies the owner's PATH; everything else is explicit.
function planServiceBridge({ tool = 'service', command, cwd, env = {}, port }) {
  const share = parseWslShare(cwd);
  if (!share) return null;
  if (!Array.isArray(command) || !command.length) throw new Error(`${tool}: a launch command is required.`);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${tool}: a valid service port is required.`);
  const pidFile = pidFileFor(tool, port);
  const envTokens = Object.entries(env)
    .map(([key, value]) => shellQuote(`${assertToken(key, 'environment key')}=${assertToken(String(value), 'environment value')}`));
  const commandTokens = command.map((token) => shellQuote(assertToken(token, 'command token')));
  // One line on purpose: a multi-line -lc script has to survive the Windows
  // argv round-trip through wsl.exe, and a newline is the first thing a
  // quoting layer mangles.
  const script = [
    `cd ${shellQuote(share.linuxPath)} || exit 97`,
    `setsid env ${envTokens.concat(commandTokens).join(' ')} & pid=$!`,
    `printf '%s\\n' "$pid" > ${shellQuote(pidFile)}`,
    'wait "$pid"',
  ].join('; ');
  const stopScript = (signal, { cleanup = false } = {}) => [
    `pid=$(cat ${shellQuote(pidFile)} 2>/dev/null)`,
    '[ -n "$pid" ] || exit 0',
    `kill -${signal} -- "-$pid" 2>/dev/null || kill -${signal} "$pid" 2>/dev/null || true`,
    ...(cleanup ? [`rm -f ${shellQuote(pidFile)}`] : []),
  ].join('; ');
  return {
    executable: wslExecutable(),
    distro: share.distro,
    linuxCwd: share.linuxPath,
    pidFile,
    args: ['-d', share.distro, '--exec', 'bash', '-lc', script],
    stopArgs: (signal) => [
      '-d', share.distro, '--exec', 'bash', '-c',
      stopScript(signal === 'SIGKILL' ? 'KILL' : 'TERM', { cleanup: signal === 'SIGKILL' }),
    ],
  };
}

// Preparation (install and build) needs the same bridge as launching: Windows
// pnpm on a WSL share would write Windows-native modules over the Linux ones
// the service actually loads.
function planPrepare({ cwd, commands }) {
  const share = parseWslShare(cwd);
  if (!share) return null;
  if (!Array.isArray(commands) || !commands.length) throw new Error('A WSL-bridged preparation needs commands.');
  const steps = commands.map((command) => {
    if (!Array.isArray(command) || !command.length) throw new Error('Each WSL-bridged preparation command must be a non-empty array.');
    return command.map((token) => shellQuote(assertToken(token, 'command token'))).join(' ');
  });
  const script = [`cd ${shellQuote(share.linuxPath)} || exit 97`, steps.join(' && ')].join('\n');
  return {
    executable: wslExecutable(),
    distro: share.distro,
    linuxCwd: share.linuxPath,
    args: ['-d', share.distro, '--exec', 'bash', '-lc', script],
  };
}

module.exports = { parseWslShare, pidFileFor, planPrepare, planServiceBridge, shellQuote, wslExecutable };
