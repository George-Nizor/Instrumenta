'use strict';

// The decisions behind opening, updating, rolling back and uninstalling a product, kept apart from
// main.cjs so they can be tested without Electron. main.cjs does what these say; nothing here
// touches the disk, a server or a window.

const path = require('node:path');

// Managed products live in versioned folders with the previous version kept beside the current
// one, so they are the ones that can roll back.
const ROLLBACK_ADAPTERS = Object.freeze(new Set(['managed-bundle', 'managed-web']));

function supportsRollback(adapter) {
  return ROLLBACK_ADAPTERS.has(adapter);
}

function samePath(left, right, platform = process.platform) {
  if (!left || !right) return false;
  const pathApi = platform === 'win32' ? path.win32 : path;
  const a = pathApi.resolve(left);
  const b = pathApi.resolve(right);
  return platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/**
 * What to do with a web tool's static server when the tool is opened: `create`, `reuse`, or
 * `replace`. A server is only reused for the folder it was started on. Keyed by tool alone, it
 * went on serving the first build it saw for the rest of the session, through an update, a
 * rollback, and an uninstall that had already moved those files to the Recycle Bin.
 */
function staticServerPlan(cached, root, platform = process.platform) {
  if (!cached?.server) return 'create';
  if (cached.retired || !samePath(cached.root, root, platform)) return 'replace';
  return 'reuse';
}

/**
 * Whether a managed product that failed to open should fall back to its previous version. Only a
 * version still pending, one that has never opened successfully, and only when there is a
 * previous version to return to. A version that has opened before is not judged by one failure.
 */
function rollbackAfterFailedOpen(adapter, managed) {
  return supportsRollback(adapter) && Boolean(managed?.pending && managed?.previous);
}

/**
 * After an install, rollback or uninstall a web tool's server no longer serves the right files.
 * It closes now, unless a window is still showing the build it loaded; then it closes with that
 * window, because cutting a page off mid-session is worse than letting it finish where it is.
 */
function retireServerPlan({ windowOpen }) {
  return windowOpen ? 'close-with-window' : 'close-now';
}

/**
 * The reason an operation has to wait, or '' when it can go ahead. Nothing is uninstalled or
 * rolled back while an install of the same product is queued or running. Uninstalling a managed
 * product moves its folder to the Recycle Bin: under a running executable that fails part-way on
 * Windows, and under an open web window it pulls the files out from under the page. Installing is
 * fine while running; the new version is what opens next time.
 */
function lifecycleBlocker({ operation, adapter, running = false, installing = false, displayName }) {
  if (['uninstall', 'rollback'].includes(operation) && installing) {
    return `${displayName} is being installed. Wait for that to finish first.`;
  }
  if (operation === 'uninstall' && running && supportsRollback(adapter)) {
    return `Close ${displayName} before uninstalling it.`;
  }
  return '';
}

module.exports = {
  lifecycleBlocker,
  retireServerPlan,
  rollbackAfterFailedOpen,
  samePath,
  staticServerPlan,
  supportsRollback,
};
