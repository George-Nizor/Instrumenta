'use strict';

// Where each suite product is installed.
//
// A release-managed product (Dimensio, Fabula, a managed-web product's release) installs into
// `<root>\<id>\versions\<version>`. The root a new install goes to is the person's choice, made in
// Add apps (`settings.install.location`; absent means the default, %LOCALAPPDATA%\Instrumenta\products).
// Changing it never moves anything: each installed product records the root it went into
// (`settings.products.<id>.installRoot`), and every root used before is remembered
// (`settings.install.previousLocations`), so an installed product is always found again and keeps
// updating where it is, even if its record is lost. The same rules the External library follows
// for its own location (external-library.cjs).

const fs = require('./plain-fs.cjs');
const path = require('node:path');
const { resolveManagedInstall } = require('./release-lifecycle.cjs');

const idPattern = /^[a-z][a-z0-9-]*$/;
const MAX_PREVIOUS_LOCATIONS = 20;

function pathApi(platform) {
  return platform === 'win32' ? path.win32 : path.posix;
}

function absolute(value, platform = process.platform) {
  return typeof value === 'string' && value.length < 1024 && !/[\x00-\x1f]/.test(value) && pathApi(platform).isAbsolute(value)
    ? pathApi(platform).resolve(value)
    : '';
}

function samePath(a, b, platform = process.platform) {
  if (!a || !b) return false;
  const api = pathApi(platform);
  const left = api.resolve(a);
  const right = api.resolve(b);
  return platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function inside(root, candidate, platform = process.platform) {
  const api = pathApi(platform);
  const fold = (value) => (platform === 'win32' ? api.resolve(value).toLowerCase() : api.resolve(value));
  const relative = api.relative(fold(root), fold(candidate));
  return relative === '' || (!relative.startsWith('..') && !api.isAbsolute(relative));
}

function uniquePaths(values, platform) {
  const result = [];
  for (const value of values) {
    if (value && !result.some((existing) => samePath(existing, value, platform))) result.push(value);
  }
  return result;
}

function objectOr(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/** `settings.install`, normalised; anything malformed is dropped rather than trusted. */
function installSettings(settings = {}, platform = process.platform) {
  const raw = objectOr(settings?.install);
  return {
    location: absolute(raw.location, platform),
    previousLocations: Array.isArray(raw.previousLocations)
      ? uniquePaths(raw.previousLocations.map((value) => absolute(value, platform)), platform).slice(-MAX_PREVIOUS_LOCATIONS)
      : [],
  };
}

/** The root a new install goes to. */
function currentLocation(settings, defaultRoot, platform = process.platform) {
  return installSettings(settings, platform).location || defaultRoot;
}

function recordedRoot(settings, id, platform = process.platform) {
  return absolute(objectOr(objectOr(settings?.products)[id]).installRoot, platform);
}

/**
 * The root `id` is installed in: its recorded root, else the first known root holding a valid
 * install of it, else the current location (where an install of it would go now).
 */
function productRoot(settings, id, { defaultRoot, platform = process.platform, resolve = resolveManagedInstall } = {}) {
  const install = installSettings(settings, platform);
  const location = install.location || defaultRoot;
  if (!idPattern.test(String(id || ''))) return location;
  const candidates = uniquePaths([
    recordedRoot(settings, id, platform),
    location,
    defaultRoot,
    ...install.previousLocations.slice().reverse(),
  ], platform);
  for (const root of candidates) {
    if (resolve(root, id)) return root;
  }
  return location;
}

function withProductEntry(settings, id, change) {
  const products = { ...objectOr(settings?.products) };
  const entry = change({ ...objectOr(products[id]) });
  if (!Object.keys(entry).length) delete products[id];
  else products[id] = entry;
  return { ...settings, products };
}

/** Settings recording that `id` was installed into `root`. */
function recordInstall(settings, id, root) {
  if (!idPattern.test(String(id || ''))) return settings;
  return withProductEntry(settings, id, (entry) => ({ ...entry, installRoot: root }));
}

/** Settings with `id`'s install record removed (it was uninstalled). */
function forgetInstall(settings, id) {
  if (!idPattern.test(String(id || ''))) return settings;
  return withProductEntry(settings, id, (entry) => {
    delete entry.installRoot;
    return entry;
  });
}

/**
 * The root a new location may be: an absolute folder, not the top of a drive, and neither inside
 * nor around one of the launcher's own folders or the workspace (whose checkouts share the
 * products' names). Returns the resolved path, or throws why not.
 */
function validateLocation(candidate, { forbidden = [], platform = process.platform } = {}) {
  const location = absolute(candidate, platform);
  if (!location) throw new Error('Choose a folder by its full path.');
  if (pathApi(platform).parse(location).root === location) throw new Error('Choose a folder rather than the top of a drive.');
  for (const root of forbidden.filter(Boolean)) {
    if (inside(root, location, platform) || inside(location, root, platform)) {
      throw new Error(`That folder is one Instrumenta keeps for itself (${root}). Choose another.`);
    }
  }
  return location;
}

/**
 * Settings with new installs going to `location` ('' for the default). Every product found
 * installed is pinned to the root it is in, and the location being left is remembered.
 */
function changeLocation(settings, location, { installed = {}, defaultRoot, platform = process.platform } = {}) {
  const before = currentLocation(settings, defaultRoot, platform);
  let next = settings;
  for (const [id, root] of Object.entries(installed)) next = recordInstall(next, id, root);
  const install = { ...objectOr(next.install) };
  const previous = Array.isArray(install.previousLocations) ? install.previousLocations : [];
  install.previousLocations = uniquePaths([...previous, before], platform).slice(-MAX_PREVIOUS_LOCATIONS);
  if (!location || samePath(location, defaultRoot, platform)) delete install.location;
  else install.location = location;
  return { ...next, install };
}

/** Writes and removes a probe file, so a folder that cannot be written is refused up front. */
function assertWritable(location) {
  fs.mkdirSync(location, { recursive: true });
  const probe = path.join(location, `.instrumenta-write-check-${process.pid}`);
  fs.writeFileSync(probe, 'ok');
  fs.rmSync(probe, { force: true });
}

module.exports = {
  assertWritable,
  changeLocation,
  currentLocation,
  forgetInstall,
  installSettings,
  productRoot,
  recordInstall,
  validateLocation,
};
