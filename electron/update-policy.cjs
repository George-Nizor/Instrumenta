'use strict';

// Whether an update is installed, downloaded for later, offered, or left alone, and the
// preferences that decide it. Pure: main.cjs reads settings.json, asks `decide`, and acts.
//
// Preferences live in settings.json beside the workspace:
//
//   { "autoUpdate": true,
//     "products": { "luna": { "autoUpdate": false, "skippedVersions": ["0.4.0"] } } }
//
// `autoUpdate` is on unless turned off. A product's own `autoUpdate` overrides it either way.
// `skippedVersions` holds versions rolled back from, which are not offered again until someone
// installs one on purpose. `appsChooserSeen` records that the first-run app chooser has been shown.

const { isNewer } = require('./update-check.cjs');

const idPattern = /^[a-z][a-z0-9-]*$/;
const versionPattern = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;
// Enough history to cover a run of bad releases without letting the list grow forever.
const MAX_SKIPPED = 20;

function readPreferences(settings = {}) {
  const products = {};
  const source = settings?.products && typeof settings.products === 'object' && !Array.isArray(settings.products)
    ? settings.products
    : {};
  for (const [id, entry] of Object.entries(source)) {
    if (!idPattern.test(id) || !entry || typeof entry !== 'object') continue;
    products[id] = {
      autoUpdate: typeof entry.autoUpdate === 'boolean' ? entry.autoUpdate : null,
      skippedVersions: Array.isArray(entry.skippedVersions)
        ? entry.skippedVersions.filter((version) => versionPattern.test(String(version))).slice(-MAX_SKIPPED)
        : [],
    };
  }
  return { autoUpdate: settings?.autoUpdate !== false, products };
}

function autoUpdateFor(preferences, id) {
  const own = preferences.products[id]?.autoUpdate;
  return typeof own === 'boolean' ? own : preferences.autoUpdate;
}

function isSkipped(preferences, id, version) {
  return Boolean(version) && (preferences.products[id]?.skippedVersions || []).includes(version);
}

function productPreferences(settings, id) {
  const existing = settings?.products?.[id];
  return existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
}

function withProduct(settings, id, change) {
  const products = settings?.products && typeof settings.products === 'object' && !Array.isArray(settings.products)
    ? { ...settings.products }
    : {};
  const next = change(productPreferences(settings, id));
  if (!Object.keys(next).length) delete products[id];
  else products[id] = next;
  return { ...settings, products };
}

/**
 * A new settings object with one change applied. Anything malformed is refused with an error
 * rather than written: this is reached from the renderer, and settings.json also holds the
 * workspace. `{ autoUpdate }` sets the default; `{ product, autoUpdate }` sets one product's own
 * preference, and `autoUpdate: null` returns that product to the default.
 */
function applyPreference(settings, change) {
  if (!change || typeof change !== 'object') throw new Error('A preference change is an object.');
  if (change.appsChooserSeen !== undefined) {
    if (change.appsChooserSeen !== true || Object.keys(change).length !== 1) throw new Error('appsChooserSeen can only be set, on its own.');
    return { ...settings, appsChooserSeen: true };
  }
  if (change.product === undefined) {
    if (typeof change.autoUpdate !== 'boolean') throw new Error('autoUpdate must be true or false.');
    return { ...settings, autoUpdate: change.autoUpdate };
  }
  if (!idPattern.test(String(change.product))) throw new Error('A product preference needs a product ID.');
  if (change.autoUpdate !== null && typeof change.autoUpdate !== 'boolean') throw new Error('autoUpdate must be true, false, or null.');
  return withProduct(settings, change.product, (entry) => {
    if (change.autoUpdate === null) delete entry.autoUpdate;
    else entry.autoUpdate = change.autoUpdate;
    return entry;
  });
}

// A version rolled back from is not offered again automatically.
function skipVersion(settings, id, version) {
  if (!idPattern.test(String(id)) || !versionPattern.test(String(version))) return settings;
  return withProduct(settings, id, (entry) => {
    const skipped = Array.isArray(entry.skippedVersions) ? entry.skippedVersions.filter((item) => item !== version) : [];
    return { ...entry, skippedVersions: [...skipped, version].slice(-MAX_SKIPPED) };
  });
}

// Installing a skipped version on purpose is the person changing their mind.
function unskipVersion(settings, id, version) {
  const entry = productPreferences(settings, id);
  if (!Array.isArray(entry.skippedVersions) || !entry.skippedVersions.includes(version)) return settings;
  return withProduct(settings, id, (current) => {
    const skippedVersions = current.skippedVersions.filter((item) => item !== version);
    const next = { ...current, skippedVersions };
    if (!skippedVersions.length) delete next.skippedVersions;
    return next;
  });
}

/**
 * What to do about a product's newest release: 'install', 'download' (fetch it now, activate it
 * once the product is closed), 'prompt' (offer it and let the person decide), or 'none', with the
 * reason. Only updates are decided here. A product that is not installed is installed when someone
 * picks it, never behind their back.
 */
// Above this an update is never fetched on its own: a 15 GB Luna arriving unasked is not a favour.
// The tile offers it instead, unless the person turned on automatic updates for that app itself.
const LARGE_UPDATE_BYTES = 1024 ** 3;

function decide({ id, installedVersion, latest, running = false, preferences, launcherVersion = '' }) {
  if (!installedVersion) return { action: 'none', reason: 'not-installed' };
  const version = latest?.version || '';
  if (!isNewer(version, installedVersion)) return { action: 'none', reason: 'current' };
  if (isSkipped(preferences, id, version)) return { action: 'none', reason: 'skipped' };
  const minimum = latest?.minimumInstrumentaVersion || '';
  if (launcherVersion && minimum && isNewer(minimum, launcherVersion)) return { action: 'none', reason: 'needs-newer-launcher' };
  if (!autoUpdateFor(preferences, id)) return { action: 'prompt', reason: 'auto-update-off' };
  if ((latest?.downloadSize || 0) > LARGE_UPDATE_BYTES && preferences.products[id]?.autoUpdate !== true) {
    return { action: 'prompt', reason: 'large-download' };
  }
  return running ? { action: 'download', reason: 'running' } : { action: 'install', reason: 'auto-update' };
}

// Bytes a release downloads: its bundle, or its installer and every payload chunk.
function downloadSize(manifest) {
  if (!manifest) return 0;
  if (manifest.bundle) return manifest.bundle.size;
  return (manifest.installer?.size || 0) + (manifest.payload?.chunks || []).reduce((total, chunk) => total + chunk.size, 0);
}

/**
 * What the tiles are told about releases, from the update cache: the newest version of each
 * product (a skipped version is left out, so it is not offered again), whether anything is
 * published at all (null until a check has answered), how much installing downloads, and the
 * oldest launcher the release accepts.
 */
function knownVersions({ cache = {}, installed = {}, preferences = readPreferences({}), launcherVersion = '' }) {
  const latest = {};
  const releases = {};
  for (const [id, entry] of Object.entries(cache)) {
    releases[id] = {
      published: entry.version ? true : entry.checkedAt ? false : null,
      version: entry.version,
      downloadSize: downloadSize(entry.manifest),
      minimumInstrumentaVersion: entry.manifest?.minimumInstrumentaVersion || '',
      // Plain text from the release manifest; main.cjs cleans it again before the window sees it.
      notes: typeof entry.manifest?.notes === 'string' ? entry.manifest.notes : '',
    };
    if (entry.version && !isSkipped(preferences, id, entry.version)) latest[id] = entry.version;
  }
  return { latest, installed, releases, launcher: launcherVersion };
}

module.exports = {
  LARGE_UPDATE_BYTES,
  applyPreference,
  autoUpdateFor,
  decide,
  downloadSize,
  isSkipped,
  knownVersions,
  readPreferences,
  skipVersion,
  unskipVersion,
};
