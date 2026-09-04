'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const versionPattern = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;
const CACHE_FILE = 'release-versions.json';
// Six hours. Long enough that opening the launcher repeatedly costs no requests,
// short enough that a release published this morning is offered this afternoon.
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

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

function readVersionCache(cacheRoot) {
  try {
    const parsed = JSON.parse(fs.readFileSync(cacheFile(cacheRoot), 'utf8').replace(/^﻿/, ''));
    if (!parsed || parsed.schemaVersion !== 1 || !parsed.products || typeof parsed.products !== 'object') return {};
    const entries = {};
    for (const [id, entry] of Object.entries(parsed.products)) {
      if (!entry || !versionPattern.test(String(entry.version || ''))) continue;
      if (!Number.isSafeInteger(entry.checkedAt) || entry.checkedAt < 0) continue;
      entries[id] = { version: entry.version, checkedAt: entry.checkedAt };
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
  fs.writeFileSync(temporary, `${JSON.stringify({ schemaVersion: 1, products }, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, target);
  return target;
}

function isStale(entry, now, ttl = DEFAULT_TTL_MS) {
  return !entry || !Number.isSafeInteger(entry.checkedAt) || now - entry.checkedAt >= ttl;
}

// Products whose newest version lives behind a release feed. Everything else is
// built from a checkout the user controls, so there is nothing to poll.
function releaseCapable(product) {
  return Boolean(product?.release?.repository)
    && ['managed-bundle', 'installed-desktop'].includes(product.adapter);
}

/**
 * Refresh the cached "latest published version" for every release-backed product.
 * `fetchVersion` is injected so the network stays out of the unit tests and out of
 * `discover`, which must remain synchronous.
 */
async function refreshReleaseVersions({ products = [], cacheRoot, fetchVersion, now = Date.now(), ttl = DEFAULT_TTL_MS, force = false }) {
  const cache = readVersionCache(cacheRoot);
  const checked = [];
  let changed = false;
  for (const product of products.filter(releaseCapable)) {
    if (!force && !isStale(cache[product.id], now, ttl)) continue;
    try {
      const version = String(await fetchVersion(product) || '');
      if (!versionPattern.test(version)) continue;
      if (cache[product.id]?.version !== version) changed = true;
      cache[product.id] = { version, checkedAt: now };
      checked.push(product.id);
    } catch {
      // A failed check leaves the last known answer in place. Losing the network
      // must not make a product look up to date when it is not.
    }
  }
  if (checked.length) writeVersionCache(cacheRoot, cache);
  return { cache, checked, changed };
}

function latestKnownVersions(cacheRoot) {
  const cache = readVersionCache(cacheRoot);
  return Object.fromEntries(Object.entries(cache).map(([id, entry]) => [id, entry.version]));
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
