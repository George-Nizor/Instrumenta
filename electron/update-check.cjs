'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { releaseAdapters } = require('../scripts/product-registry.cjs');
const { validateReleaseManifest } = require('./release-lifecycle.cjs');

const versionPattern = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;
const CACHE_FILE = 'release-versions.json';
const CACHE_SCHEMA = 2;
// Six hours. Long enough that opening the launcher repeatedly costs no requests,
// short enough that a release published this morning is offered this afternoon.
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
// Refresh is the person asking, so it skips the six hours, but not without limit:
// one forced check per product per minute, however often the button is pressed.
const REFRESH_FLOOR_MS = 60 * 1000;

function parseVersion(value) {
  const raw = String(value || '');
  if (!versionPattern.test(raw)) return null;
  // Build metadata is explicitly not part of precedence.
  const [withoutBuild] = raw.split('+', 1);
  const separator = withoutBuild.indexOf('-');
  const core = separator === -1 ? withoutBuild : withoutBuild.slice(0, separator);
  const prerelease = separator === -1 ? '' : withoutBuild.slice(separator + 1);
  return {
    core: core.split('.').map(Number),
    prerelease: prerelease ? prerelease.split('.') : [],
  };
}

function comparePrerelease(a, b) {
  // A version with no prerelease outranks the same core with one: 1.2.3 > 1.2.3-rc.1.
  if (!a.length && !b.length) return 0;
  if (!a.length) return 1;
  if (!b.length) return -1;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const left = a[index];
    const right = b[index];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    const leftNumeric = /^[0-9]+$/.test(left);
    const rightNumeric = /^[0-9]+$/.test(right);
    if (leftNumeric && rightNumeric) {
      if (Number(left) !== Number(right)) return Number(left) < Number(right) ? -1 : 1;
    } else if (leftNumeric !== rightNumeric) {
      // Numeric identifiers always have lower precedence than alphanumeric ones.
      return leftNumeric ? -1 : 1;
    } else if (left !== right) {
      return left < right ? -1 : 1;
    }
  }
  return 0;
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a.core[index] !== b.core[index]) return a.core[index] < b.core[index] ? -1 : 1;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

// An unreadable or unparsable version on either side means "no update", never
// "update available". A false positive here sends the user into a 15 GB download.
function isNewer(candidate, installed) {
  if (!parseVersion(candidate) || !parseVersion(installed)) return false;
  return compareVersions(candidate, installed) > 0;
}

function cacheFile(cacheRoot) {
  return path.join(path.resolve(cacheRoot), CACHE_FILE);
}

const EMPTY_ENTRY = Object.freeze({ version: '', tag: '', manifest: null, checkedAt: 0, attemptedAt: 0, blockedUntil: 0 });

function timestamp(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

// One cached answer, or null when it cannot be trusted. Schema 2 keeps what installing needs
// (the release manifest and the tag its assets live under) as well as the version, and may record
// an empty version: "no release published yet" is an answer worth remembering for six hours.
// Schema 1 knew only a version and when it learned it; the rest arrives on the next check.
function cacheEntry(id, entry, schemaVersion) {
  if (!entry || typeof entry !== 'object') return null;
  const checkedAt = timestamp(entry.checkedAt);
  if (checkedAt === null) return null;
  const version = String(entry.version || '');
  if (schemaVersion === 1) {
    return versionPattern.test(version) ? { ...EMPTY_ENTRY, version, checkedAt, attemptedAt: checkedAt } : null;
  }
  if (version && !versionPattern.test(version)) return null;
  let manifest = null;
  if (entry.manifest) {
    try {
      manifest = validateReleaseManifest(entry.manifest, id);
    } catch {
      return null;
    }
    if (manifest.version !== version) return null;
  }
  const tag = typeof entry.tag === 'string' && !/[\x00-\x1f]/.test(entry.tag) ? entry.tag : '';
  return {
    version, tag, manifest, checkedAt,
    attemptedAt: timestamp(entry.attemptedAt) ?? checkedAt,
    blockedUntil: timestamp(entry.blockedUntil) ?? 0,
  };
}

function readVersionCache(cacheRoot) {
  try {
    const parsed = JSON.parse(fs.readFileSync(cacheFile(cacheRoot), 'utf8').replace(/^\uFEFF/, ''));
    if (!parsed || ![1, CACHE_SCHEMA].includes(parsed.schemaVersion) || !parsed.products || typeof parsed.products !== 'object') return {};
    const entries = {};
    for (const [id, entry] of Object.entries(parsed.products)) {
      const normalized = cacheEntry(id, entry, parsed.schemaVersion);
      if (normalized) entries[id] = normalized;
    }
    return entries;
  } catch {
    return {};
  }
}

function writeVersionCache(cacheRoot, products) {
  const target = cacheFile(cacheRoot);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify({ schemaVersion: CACHE_SCHEMA, products }, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, target);
  return target;
}

function isStale(entry, now, ttl = DEFAULT_TTL_MS) {
  return !entry || !Number.isSafeInteger(entry.checkedAt) || now - entry.checkedAt >= ttl;
}

function recentlyAttempted(entry, now, floor = REFRESH_FLOOR_MS) {
  return Boolean(entry?.attemptedAt) && now - entry.attemptedAt < floor;
}

// Products whose newest version lives behind a release feed. Everything else is
// built from a checkout the user controls, so there is nothing to poll. The list
// is the registry's, so an adapter that can be installed is always one that is
// polled: managed-web was once installable here and never checked.
function releaseCapable(product) {
  // The launcher itself rides along as a pseudo-product (self-update.cjs), so its own newest
  // release shares the cache, the TTL and the rate-limit hold with everything else.
  return Boolean(product?.release?.repository) && (releaseAdapters.has(product.adapter) || product.adapter === 'launcher');
}

/**
 * Refresh the cached newest release for every release-backed product. `fetchLatest` resolves to
 * `{ manifest, tag }` and is injected, so the network stays out of the unit tests and out of
 * `discover`, which must remain synchronous.
 *
 * A stale entry is checked; with `force` (Refresh) any entry not tried in the last minute is.
 * Nothing is asked while GitHub's `blockedUntil` lies ahead, Refresh included, and a rate limit
 * met on one product holds the rest of the pass too, since the limit is on this machine rather
 * than on that product.
 */
async function refreshReleaseVersions({
  products = [], cacheRoot, fetchLatest, now = Date.now(), ttl = DEFAULT_TTL_MS, force = false, floor = REFRESH_FLOOR_MS,
}) {
  const cache = readVersionCache(cacheRoot);
  const checked = [];
  let changed = false;
  let touched = false;
  let blockedUntil = 0;
  for (const product of products.filter(releaseCapable)) {
    const entry = cache[product.id];
    if (blockedUntil) {
      cache[product.id] = { ...(entry || EMPTY_ENTRY), blockedUntil };
      touched = true;
      continue;
    }
    if (entry?.blockedUntil > now) continue;
    if (force ? recentlyAttempted(entry, now, floor) : !isStale(entry, now, ttl)) continue;
    touched = true;
    try {
      const latest = await fetchLatest(product);
      const version = String(latest?.manifest?.version || '');
      if (!versionPattern.test(version)) {
        cache[product.id] = { ...(entry || EMPTY_ENTRY), attemptedAt: now };
        continue;
      }
      if (entry?.version !== version) changed = true;
      cache[product.id] = { version, tag: String(latest.tag || ''), manifest: latest.manifest, checkedAt: now, attemptedAt: now, blockedUntil: 0 };
      checked.push(product.id);
    } catch (error) {
      if (error?.code === 'NO_RELEASE') {
        // Nothing published: a real answer, cached like any other.
        if (entry?.version) changed = true;
        cache[product.id] = { ...EMPTY_ENTRY, checkedAt: now, attemptedAt: now };
        checked.push(product.id);
      } else if (error?.code === 'RATE_LIMITED' && timestamp(error.blockedUntil) > now) {
        blockedUntil = error.blockedUntil;
        cache[product.id] = { ...(entry || EMPTY_ENTRY), attemptedAt: now, blockedUntil };
      } else {
        // A failed check leaves the last known answer in place. Losing the network
        // must not make a product look up to date when it is not.
        cache[product.id] = { ...(entry || EMPTY_ENTRY), attemptedAt: now };
      }
    }
  }
  if (touched) writeVersionCache(cacheRoot, cache);
  return { cache, checked, changed };
}

function latestKnownVersions(cacheRoot) {
  const cache = readVersionCache(cacheRoot);
  return Object.fromEntries(Object.entries(cache).filter(([, entry]) => entry.version).map(([id, entry]) => [id, entry.version]));
}

// What installing can start from without asking GitHub again: a checked answer that is still
// fresh, with the manifest and the tag its assets live under.
function cachedRelease(cacheRoot, id, now = Date.now(), ttl = DEFAULT_TTL_MS) {
  const entry = readVersionCache(cacheRoot)[id];
  if (!entry?.manifest || !entry.tag || isStale(entry, now, ttl)) return null;
  return { manifest: entry.manifest, tag: entry.tag };
}

/**
 * The DisplayVersion the Windows uninstall record carries for an installed-desktop
 * product. Without this its installed version is only ever the catalog's guess,
 * which would report an update forever after the first one shipped.
 */
function windowsInstalledVersion(displayName, options = {}) {
  const platform = options.platform || process.platform;
  if (platform !== 'win32' || !displayName) return '';
  const run = options.run || ((file, args) => execFileSync(file, args, { encoding: 'utf8', timeout: 10_000, windowsHide: true }));
  const roots = [
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  ];
  for (const root of roots) {
    let output;
    try {
      output = String(run('reg.exe', ['query', root, '/s', '/v', 'DisplayName']) || '');
    } catch {
      continue;
    }
    for (const block of output.split(/\r?\n\r?\n/)) {
      if (!new RegExp(`DisplayName\\s+REG_SZ\\s+${displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm').test(block)) continue;
      // reg.exe echoes the long form (HKEY_CURRENT_USER) even when queried by the
      // HKCU shorthand, so the key line is matched on the long prefix.
      const key = block.split(/\r?\n/).find((line) => line.trim().startsWith('HKEY_'));
      if (!key) continue;
      try {
        const detail = String(run('reg.exe', ['query', key.trim(), '/v', 'DisplayVersion']) || '');
        const match = detail.match(/DisplayVersion\s+REG_SZ\s+(\S+)/);
        if (match && versionPattern.test(match[1])) return match[1];
      } catch {
        // Fall through to the next root.
      }
    }
  }
  return '';
}

module.exports = {
  DEFAULT_TTL_MS,
  REFRESH_FLOOR_MS,
  cachedRelease,
  compareVersions,
  isNewer,
  isStale,
  latestKnownVersions,
  readVersionCache,
  refreshReleaseVersions,
  releaseCapable,
  windowsInstalledVersion,
  writeVersionCache,
};
