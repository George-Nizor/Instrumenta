'use strict';

const fs = require('node:fs');
const path = require('node:path');

function endUserEnvironment(environment = process.env) {
  const systemRoot = environment.SystemRoot || 'C:\\Windows';
  return {
    ...environment,
    Path: [`${systemRoot}\\system32`, systemRoot, `${systemRoot}\\system32\\Wbem`].join(';'),
    PATH: undefined,
    ELECTRON_RUN_AS_NODE: undefined,
    NODE_OPTIONS: undefined,
  };
}

function assertPortableArtifact(launcherRoot, version) {
  const executable = path.join(launcherRoot, 'release', `Instrumenta-Portable-${version}.exe`);
  if (!fs.existsSync(executable)) {
    throw new Error(`Instrumenta portable package was not produced: ${executable}`);
  }
  return executable;
}

function waitForFile(file, options = {}) {
  const fileSystem = options.fileSystem || fs;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const intervalMs = options.intervalMs ?? 100;
  const now = options.now || Date.now;
  const delay = options.delay || ((milliseconds) => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
  });
  const deadline = now() + timeoutMs;
  while (now() <= deadline) {
    if (fileSystem.existsSync(file)) return true;
    delay(intervalMs);
  }
  return false;
}

module.exports = { assertPortableArtifact, endUserEnvironment, waitForFile };
