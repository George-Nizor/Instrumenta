'use strict';

// Keeps a native bundle on local disk before it is launched.
//
// A source workspace often lives on a WSL share (`\\wsl.localhost\...`). Windows
// can execute from there, but every DLL load crosses the 9p filesystem: the
// Motus launch check takes about 125 seconds from the share against about one
// second from local disk, so the launcher's runtime probe times out and the
// editor would be unusable even if it did not. Nothing is wrong with the bundle;
// it is simply in the wrong place to be run from.
//
// A bundle on a local path is launched where it is. A bundle on a share is
// mirrored once into the launcher's own data directory, and reused until the
// source changes.

const fs = require('node:fs');
const path = require('node:path');

const STAMP = 'instrumenta-stage.json';

// UNC paths cover WSL shares and ordinary network drives alike. Everything else
// is treated as local, so a normal checkout keeps launching in place.
function isRemotePath(target, platform = process.platform) {
  if (!target) return false;
  if (platform !== 'win32') return false;
  // Resolve with Windows rules explicitly. The host's own `path` is POSIX when
  // these tests run on Linux, which would mangle a UNC path into a relative one.
  return /^[\\/]{2}[^\\/]/.test(path.win32.resolve(target));
}

// Identity of the source bundle, cheap enough to compute on every launch. The
// executable's size and timestamp change on any rebuild, and the manifest
// version changes on any release, so a stale mirror is never reused.
function fingerprint(root) {
  const manifestPath = path.join(root, 'motus-bundle.json');
  let version = 'unknown';
  let executable = 'motus.exe';
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^﻿/, ''));
    version = String(manifest.version || 'unknown');
    if (typeof manifest.executable === 'string' && manifest.executable) executable = manifest.executable;
  } catch {
    return null;
  }
  let stat;
  try {
    stat = fs.statSync(path.join(root, executable));
  } catch {
    return null;
  }
  return {
    version,
    executable,
    size: stat.size,
    modified: Math.round(stat.mtimeMs),
    entries: fs.readdirSync(root).length,
  };
}

function readStamp(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, STAMP), 'utf8'));
  } catch {
    return null;
  }
}

function matches(left, right) {
  if (!left || !right) return false;
  return left.version === right.version
    && left.executable === right.executable
    && left.size === right.size
    && left.modified === right.modified
    && left.entries === right.entries;
}

// Returns the directory the bundle should be launched from, mirroring it first
// when that is needed. `onProgress` reports the one-time copy so the window does
// not look frozen while it runs.
async function ensureLocalBundle(options) {
  const { source, cacheRoot, id = 'Motus', onProgress = () => {}, platform = process.platform } = options;
  if (!source) throw new Error('No bundle directory was supplied.');
  // `remote` is derived from the path in normal use; tests supply it directly so
  // the copy behaviour can be exercised without a real share.
  const remote = options.remote ?? isRemotePath(source, platform);
  if (!remote) return { root: source, staged: false, copied: false };

  const destination = path.join(cacheRoot, 'apps', id);
  const wanted = fingerprint(source);
  if (!wanted) throw new Error('The bundle is missing its launch manifest or executable.');
  if (matches(readStamp(destination), wanted)) return { root: destination, staged: true, copied: false };

  onProgress(`Copying ${id} to local storage for the first time. This runs once…`);
  const staging = `${destination}.incoming`;
  await fs.promises.rm(staging, { recursive: true, force: true });
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  // fs.promises.cp yields to the event loop, so the launcher stays responsive
  // for the minutes this can take across a share.
  await fs.promises.cp(source, staging, { recursive: true });
  await fs.promises.rm(destination, { recursive: true, force: true });
  await fs.promises.rename(staging, destination);
  await fs.promises.writeFile(path.join(destination, STAMP), JSON.stringify(wanted, null, 2));
  return { root: destination, staged: true, copied: true };
}

module.exports = { ensureLocalBundle, fingerprint, isRemotePath, localBundleRoot: (cacheRoot, id = 'Motus') => path.join(cacheRoot, 'apps', id) };
