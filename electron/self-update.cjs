'use strict';

// Instrumenta keeping itself current.
//
// The launcher takes the route every product takes: the newest GitHub release's
// instrumenta-release.json, every byte checked against it before anything runs. What is at the end
// is its own setup program instead of a bundle (installStrategy "launcher"). The download happens
// in the background; the swap waits for the person to press Restart, or for the launcher to close
// with automatic updates on. Replacing the program that serves Imago, Ludere and LearnChess under
// someone's open document would not be an update, it would be a crash.
//
// Only an installed launcher updates itself. A source run is a developer's checkout, which git
// owns, and the portable build has no installer to run: both are told a version exists and
// nothing more.

const path = require('node:path');
const fs = require('./plain-fs.cjs');
const { isNewer } = require('./update-check.cjs');
const { assetUrl, downloadFile, ensureFreeSpace, remainingBytes } = require('./release-installer.cjs');
const { validateReleaseManifest } = require('./release-lifecycle.cjs');

const LAUNCHER_ID = 'instrumenta';

// The launcher as the update check sees it: a release-backed entry in the same version cache as
// the products, so it shares the six-hour TTL, the Refresh floor and the rate-limit hold.
function launcherDefinition(repository) {
  return { id: LAUNCHER_ID, displayName: 'Instrumenta', adapter: 'launcher', release: { repository } };
}

// How this copy can be updated: 'installer' (the per-user NSIS install), 'portable' (the portable
// exe is replaced by hand) or 'source' (a checkout, or anything that is not Windows).
function updateRoute({ packaged, env = process.env, platform = process.platform } = {}) {
  if (!packaged || platform !== 'win32') return 'source';
  if (env.PORTABLE_EXECUTABLE_FILE || env.PORTABLE_EXECUTABLE_DIR) return 'portable';
  return 'installer';
}

// A newer release than this launcher, from the version cache entry, or null. A version the person
// skipped is not offered again, the same as for a product.
function availableUpdate(entry, currentVersion, { skipped = [] } = {}) {
  if (!entry?.version || !entry.manifest || !entry.tag) return null;
  if (!isNewer(entry.version, currentVersion) || skipped.includes(entry.version)) return null;
  let manifest;
  try {
    manifest = validateReleaseManifest(entry.manifest, LAUNCHER_ID);
  } catch {
    return null;
  }
  if (manifest.installStrategy !== 'launcher') return null;
  return { version: manifest.version, tag: entry.tag, manifest };
}

// Where a version's setup program is downloaded to.
function downloadDirectory(downloadsRoot, version) {
  return path.join(downloadsRoot, LAUNCHER_ID, version);
}

// Downloads the setup program and checks it against the manifest; resumes a partial download.
// Returns the verified file.
async function downloadLauncherUpdate({ repository, update, downloadsRoot, onProgress = () => {}, options = {} }) {
  const { manifest, tag } = update;
  const root = downloadDirectory(downloadsRoot, manifest.version);
  ensureFreeSpace(root, remainingBytes(root, [manifest.installer], manifest));
  const file = path.join(root, manifest.installer.asset);
  await downloadFile(assetUrl(repository, tag, manifest.installer.asset), file, manifest.installer, onProgress, options);
  return file;
}

// The setup program's command line. /S is silent (packaging/installer.nsh never shows its replace
// prompt when silent). --updated tells electron-builder's installer this is an update, and
// --force-run starts Instrumenta again when it is done: that is Restart, not an update applied as
// the launcher closes. Detached, so it outlives the launcher it replaces.
function planLauncherInstall(installer, { relaunch = false } = {}) {
  return {
    command: installer,
    args: ['/S', '--updated', ...(relaunch ? ['--force-run'] : [])],
    options: { cwd: path.dirname(installer), detached: true, stdio: 'ignore', windowsHide: true },
  };
}

// Downloads of this version or older are finished with: the setup ran and this is what it
// installed (or a newer one already superseded it). Removed at start-up.
function staleLauncherDownloads(downloadsRoot, currentVersion) {
  const root = path.join(downloadsRoot, LAUNCHER_ID);
  let entries = [];
  try {
    entries = fs.readdirSync(root);
  } catch {
    return [];
  }
  return entries.filter((version) => !isNewer(version, currentVersion)).map((version) => path.join(root, version));
}

module.exports = {
  LAUNCHER_ID,
  availableUpdate,
  downloadDirectory,
  downloadLauncherUpdate,
  launcherDefinition,
  planLauncherInstall,
  staleLauncherDownloads,
  updateRoute,
};
