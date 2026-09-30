'use strict';

// The file system for installed products and their downloads.
//
// Inside Electron, `fs` opens any path ending in .asar as an archive. Installed products hold real
// .asar files (Forge3D ships resources\app.asar), so a copy, prune or delete that walks such a
// tree steps into the archive and fails part-way: removing an old download stopped with
// "EBUSY: resource busy or locked, rmdir '...\resources\app.asar'" and left the rest behind.
// Electron's `original-fs` is the same module without that interception. These trees never hold
// the launcher's own code, so they are handled with it; plain Node has no asar support and no
// `original-fs`, and uses `fs`.

function plainFs() {
  try {
    return require('original-fs');
  } catch {
    return require('node:fs');
  }
}

module.exports = plainFs();
