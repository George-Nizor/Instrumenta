'use strict';

const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');

const LOG_LINES = 200;
const HEALTH_INTERVAL_MS = 250;
const HEALTH_TIMEOUT_MS = 30000;
const STOP_ESCALATION_MS = 5000;

function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', () => resolve(0));
    probe.listen(port, '127.0.0.1', () => {
      const address = probe.address();
      const chosen = address && typeof address !== 'string' ? address.port : 0;
      probe.close(() => resolve(chosen));
    });
  });
}

// Registered ports keep each product on a stable local origin, so its stored
// data survives restarts. Fall back only when the port is genuinely taken.
async function pickPort(candidates = []) {
  const ports = candidates.map((value) => Number(value) || 0).filter((value) => value > 0);
  for (const port of ports) {
    const free = await isPortFree(port);
    if (free) return free;
  }
  const ephemeral = await isPortFree(0);
  if (!ephemeral) throw new Error('No local port was available for the product service.');
  return ephemeral;
}

function createLogTail(limit = LOG_LINES) {
  const lines = [];
  return {
    push(line) {
      lines.push(line);
      if (lines.length > limit) lines.splice(0, lines.length - limit);
    },
    text() { return lines.join('\n'); },
  };
}

function readLines(stream, onLine) {
  if (!stream) return;
  let pending = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    pending += chunk;
    let index = pending.indexOf('\n');
    while (index >= 0) {
      onLine(pending.slice(0, index).replace(/\r$/, ''));
      pending = pending.slice(index + 1);
      index = pending.indexOf('\n');
    }
    if (pending.length > 8192) {
      onLine(pending);
      pending = '';
    }
  });
  stream.on('end', () => {
    if (pending) onLine(pending);
    pending = '';
  });
}

function probeHealth(url) {
  return new Promise((resolve) => {
    try {
      const request = http.get(url, { headers: { Connection: 'close' } }, (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      });
      request.setTimeout(2000, () => request.destroy());
      request.once('error', () => resolve(false));
    } catch {
      // A malformed health URL throws synchronously; treat it as not ready so
      // the caller fails on its own deadline instead of on an unhandled throw.
      resolve(false);
    }
  });
}

function stopChild(child, { escalateAfterMs = STOP_ESCALATION_MS } = {}) {
  return new Promise((resolve) => {
    if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    let escalation;
    const finish = () => {
      clearTimeout(escalation);
      resolve();
    };
    child.once('exit', finish);
    // pnpm spawns tsx, which spawns the server. Signalling only the direct child
    // leaves the real server running, so signal the whole process group/tree.
    const signalTree = (signal) => {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }).on('error', () => {});
          return;
        }
        process.kill(-child.pid, signal);
      } catch {
        try { child.kill(signal); } catch { /* already gone */ }
      }
    };
    signalTree('SIGTERM');
    // Deliberately not unref'd: a service that ignores SIGTERM must not be able
    // to outlive the launcher because the escalation timer was collected.
    escalation = setTimeout(() => signalTree('SIGKILL'), escalateAfterMs);
  });
}

function startService(options) {
  const {
    tool = 'service',
    command,
    cwd,
    env = {},
    port,
    healthPath = '/',
    onLog = () => {},
    onSpawn = () => {},
    timeoutMs = HEALTH_TIMEOUT_MS,
    intervalMs = HEALTH_INTERVAL_MS,
    escalateAfterMs = STOP_ESCALATION_MS,
  } = options || {};
  if (!Array.isArray(command) || !command.length) throw new Error(`${tool}: a launch command is required.`);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${tool}: a valid service port is required.`);
  if (typeof healthPath !== 'string' || !healthPath || /[^\x21-\x7e]/.test(healthPath)) {
    throw new Error(`${tool}: a printable health path is required.`);
  }

  const url = `http://127.0.0.1:${port}`;
  const healthUrl = `${url}${healthPath.startsWith('/') ? healthPath : `/${healthPath}`}`;
  const tail = createLogTail();
  const child = spawn(command[0], command.slice(1), {
    cwd,
    // The launcher owns the address the service listens on: manifest variables
    // are merged first so they can never redirect it off the chosen loopback port.
    env: { ...process.env, ...env, PORT: String(port), HOST: '127.0.0.1' },
    detached: process.platform !== 'win32',
    windowsHide: true,
    shell: false,
  });

  const record = (line) => {
    tail.push(line);
    try { onLog(line); } catch { /* logging must never break the launch */ }
  };
  readLines(child.stdout, record);
  readLines(child.stderr, record);

  let stopped = null;
  const stop = () => {
    if (!stopped) stopped = stopChild(child, { escalateAfterMs });
    return stopped;
  };
  // Hand the caller a stoppable handle at spawn time. A launcher quitting while
  // the service is still health-polling must be able to kill this child even
  // though the start promise has not resolved yet.
  try { onSpawn({ tool, url, healthUrl, child, stop }); } catch { /* tracking must never break the launch */ }

  return new Promise((resolve, reject) => {
    let settled = false;
    let poll;
    let deadline;
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(poll);
      clearTimeout(deadline);
      child.off('exit', onExit);
      child.off('error', onError);
      handler(value);
    };
    const failure = (message) => {
      const log = tail.text().trim();
      return new Error(log ? `${message}\n\n${log}` : message);
    };
    function onExit(code, signal) {
      // Give the pipes a moment to flush so the failure carries the log tail
      // that explains it, without waiting on a grandchild holding stdio open.
      const report = () => finish(reject, failure(`${tool} service exited before it became ready (${signal || `code ${code}`}).`));
      const grace = setTimeout(report, 200);
      child.once('close', () => { clearTimeout(grace); report(); });
    }
    function onError(error) {
      finish(reject, failure(`${tool} service could not start: ${error.message}`));
    }
    child.once('exit', onExit);
    child.once('error', onError);

    deadline = setTimeout(() => {
      finish(reject, failure(`${tool} service did not answer ${healthUrl} within ${Math.round(timeoutMs / 1000)}s.`));
      stop().catch(() => {});
    }, timeoutMs);
    if (typeof deadline.unref === 'function') deadline.unref();

    const attempt = async () => {
      if (settled) return;
      let healthy = false;
      try {
        healthy = await probeHealth(healthUrl);
      } catch (error) {
        // Never let a probe failure escape as an unhandled rejection; the
        // deadline above still decides when a service has taken too long.
        record(`health probe failed: ${error.message}`);
      }
      if (settled) return;
      if (healthy) {
        finish(resolve, { tool, url, healthUrl, child, stop });
        return;
      }
      poll = setTimeout(() => { attempt().catch(() => {}); }, intervalMs);
      if (typeof poll.unref === 'function') poll.unref();
    };
    attempt().catch((error) => finish(reject, failure(`${tool} service health check failed: ${error.message}`)));
  });
}

module.exports = { pickPort, startService, stopChild };
