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

// The web products baked into the installer. A managed service runs from its source checkout and
// never ships inside the package.
function packagedWebProducts(products) {
  return products.filter((product) => product.kind === 'web' && product.adapter !== 'web-service');
}

function readPackageJson(sourceRoot, fileSystem) {
  try {
    return JSON.parse(fileSystem.readFileSync(path.join(sourceRoot, 'package.json'), 'utf8').replace(/^﻿/, ''));
  } catch {
    throw new Error(`${path.basename(sourceRoot)} has no readable package.json to build from.`);
  }
}

// The npm commands that build one packaged web product, read from its own package.json rather than
// guessed from its adapter. The adapter says how the launcher serves a build, not how the build is
// made: every product that isn't web-vite used to be run through `node scripts/build.mjs`, which is
// only ever true of Ludere. Dependencies are installed only when the product declares some.
function webBuildSteps(sourceRoot, fileSystem = fs) {
  const manifest = readPackageJson(sourceRoot, fileSystem);
  if (typeof manifest.scripts?.build !== 'string' || !manifest.scripts.build.trim()) {
    throw new Error(`${path.basename(sourceRoot)} declares no build script in package.json.`);
  }
  const declaresDependencies = ['dependencies', 'devDependencies', 'optionalDependencies']
    .some((key) => manifest[key] && typeof manifest[key] === 'object' && Object.keys(manifest[key]).length);
  const steps = [];
  if (fileSystem.existsSync(path.join(sourceRoot, 'package-lock.json'))) steps.push(['ci']);
  else if (declaresDependencies) steps.push(['install']);
  steps.push(['run', 'build']);
  return steps;
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

module.exports = { assertPortableArtifact, endUserEnvironment, packagedWebProducts, waitForFile, webBuildSteps };
