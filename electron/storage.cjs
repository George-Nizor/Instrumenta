'use strict';

// Where the launcher keeps what it downloads, installs and remembers.
//
// Everything large lives under %LOCALAPPDATA%\Instrumenta, which Windows never roams: installed
// product versions, the release download cache, and the update cache. The launcher's own settings,
// logs and browser data stay in Electron's userData (%APPDATA%\instrumenta-launcher), where they
// have always been. Release downloads used to sit there too, and roaming a 15 GB Luna payload
// between machines is nobody's idea of a profile.

// Unpatched by Electron's asar support; see plain-fs.cjs.
const fs = require('./plain-fs.cjs');
const path = require('node:path');

function storageLayout({ localAppData = '', userData }) {
  const localRoot = path.join(localAppData || userData, 'Instrumenta');
  return {
    installRoot: path.join(localRoot, 'products'),
    downloadsRoot: path.join(localRoot, 'downloads'),
    updateCacheRoot: path.join(localRoot, 'update-cache'),
  };
}

// Launcher data that nothing reads any more. Each entry is regenerable or dead: the old download
// cache (completed payloads were never deleted from it), and the local mirror of the discontinued
// Motus bundle, left behind on every machine that ever opened Motus from a share.
function retiredData(userData) {
  return [
    { label: 'release downloads kept in roaming data', path: path.join(userData, 'downloads') },
    { label: 'local mirror of the discontinued Motus bundle', path: path.join(userData, 'apps', 'Motus') },
    { label: 'unfinished Motus mirror', path: path.join(userData, 'apps', 'Motus.incoming') },
  ];
}

// Removes whatever of `retiredData` is still there. Cheap when there is nothing to do, so it can
// simply run at every start; in practice it does its work once. A failure is reported and left for
// the next start rather than stopping the launcher.
async function removeRetiredData(userData, options = {}) {
  const remove = options.remove || ((target) => fs.promises.rm(target, { recursive: true, force: true }));
  const exists = options.exists || fs.existsSync;
  const removed = [];
  const failed = [];
  for (const entry of retiredData(userData)) {
    if (!exists(entry.path)) continue;
    try {
      await remove(entry.path);
      removed.push(entry);
    } catch (error) {
      failed.push({ ...entry, error });
    }
  }
  return { removed, failed };
}

module.exports = { removeRetiredData, retiredData, storageLayout };
