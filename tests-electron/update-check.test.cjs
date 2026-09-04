'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
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
} = require('../electron/update-check.cjs');
const { productState } = require('../electron/workspace.cjs');

function temporaryRoot(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `instrumenta-${label}-`));
}

test('version precedence follows semver, prereleases included', () => {
  assert.equal(compareVersions('0.2.4', '0.2.2'), 1);
  assert.equal(compareVersions('0.2.2', '0.2.2'), 0);
  assert.equal(compareVersions('1.0.0', '0.9.9'), 1);
  assert.equal(compareVersions('1.2.10', '1.2.9'), 1, 'numeric, not lexicographic');
  // A prerelease ranks below the release it leads to.
  assert.equal(compareVersions('1.0.0', '1.0.0-rc.1'), 1);
  assert.equal(compareVersions('1.0.0-rc.2', '1.0.0-rc.1'), 1);
  assert.equal(compareVersions('1.0.0-alpha.1', '1.0.0-alpha'), 1);
  assert.equal(compareVersions('1.0.0-alpha', '1.0.0-1'), 1, 'alphanumeric outranks numeric');
  // Build metadata is not part of precedence.
  assert.equal(compareVersions('1.0.0+build.7', '1.0.0'), 0);
});

test('an unreadable version never reports an update', () => {
  // This is the direction that matters: a false positive starts a large download.
  assert.equal(isNewer('', '1.0.0'), false);
  assert.equal(isNewer('1.0.0', ''), false);
  assert.equal(isNewer('latest', '1.0.0'), false);
  assert.equal(isNewer('1.0', '1.0.0'), false);
  assert.equal(isNewer('1.0.1', '1.0.0'), true);
});

test('only release-backed products are ever polled', () => {
  const repository = { provider: 'github', owner: 'o', name: 'n' };
  assert.equal(releaseCapable({ adapter: 'managed-bundle', release: { repository } }), true);
  assert.equal(releaseCapable({ adapter: 'installed-desktop', release: { repository } }), true);
  // Built from a checkout the user controls: there is no feed to ask.
  assert.equal(releaseCapable({ adapter: 'web-vite', release: { repository } }), false);
  assert.equal(releaseCapable({ adapter: 'native-bundle', release: { repository } }), false);
  assert.equal(releaseCapable({ adapter: 'managed-bundle' }), false);
});

test('the version cache round-trips and rejects malformed entries', () => {
  const root = temporaryRoot('update-cache');
  writeVersionCache(root, {
    forge3d: { version: '0.2.4', checkedAt: 1000 },
    broken: { version: 'not-a-version', checkedAt: 1000 },
    undated: { version: '1.0.0', checkedAt: -1 },
  });
  const cache = readVersionCache(root);
  assert.deepEqual(Object.keys(cache), ['forge3d']);
  assert.deepEqual(latestKnownVersions(root), { forge3d: '0.2.4' });

  fs.writeFileSync(path.join(root, 'release-versions.json'), '{ not json', 'utf8');
  assert.deepEqual(readVersionCache(root), {}, 'a corrupt cache reads as empty, never throws');
});

test('a fresh cache entry is not re-fetched, a stale one is', async () => {
  const root = temporaryRoot('update-ttl');
  const product = { id: 'forge3d', adapter: 'managed-bundle', release: { repository: { owner: 'o', name: 'n' } } };
  const now = 10 * DEFAULT_TTL_MS;
  writeVersionCache(root, { forge3d: { version: '0.2.2', checkedAt: now - 60 } });

  let calls = 0;
  const fetchVersion = async () => { calls += 1; return '0.2.4'; };

  assert.equal(isStale({ checkedAt: now - 60 }, now), false);
  const fresh = await refreshReleaseVersions({ products: [product], cacheRoot: root, fetchVersion, now });
  assert.equal(calls, 0, 'a fresh entry costs no request');
  assert.deepEqual(fresh.checked, []);

  const stale = await refreshReleaseVersions({ products: [product], cacheRoot: root, fetchVersion, now: now + DEFAULT_TTL_MS });
  assert.equal(calls, 1);
  assert.deepEqual(stale.checked, ['forge3d']);
  assert.equal(stale.cache.forge3d.version, '0.2.4');

  // An explicit Refresh is the user asking; it ignores the TTL.
  await refreshReleaseVersions({ products: [product], cacheRoot: root, fetchVersion, now: now + DEFAULT_TTL_MS, force: true });
  assert.equal(calls, 2);
});

test('a failed check keeps the last known version rather than clearing it', async () => {
  const root = temporaryRoot('update-offline');
  const product = { id: 'forge3d', adapter: 'managed-bundle', release: { repository: { owner: 'o', name: 'n' } } };
  writeVersionCache(root, { forge3d: { version: '0.2.4', checkedAt: 0 } });
  const result = await refreshReleaseVersions({
    products: [product],
    cacheRoot: root,
    now: DEFAULT_TTL_MS * 2,
    fetchVersion: async () => { throw new Error('getaddrinfo ENOTFOUND api.github.com'); },
  });
  assert.equal(result.cache.forge3d.version, '0.2.4', 'losing the network must not look like being up to date');
  assert.deepEqual(result.checked, []);
});

test('a garbage version from the feed is refused', async () => {
  const root = temporaryRoot('update-garbage');
  const product = { id: 'forge3d', adapter: 'managed-bundle', release: { repository: { owner: 'o', name: 'n' } } };
  const result = await refreshReleaseVersions({
    products: [product], cacheRoot: root, now: 1, fetchVersion: async () => 'v0.2.4-latest-final',
  });
  assert.deepEqual(result.cache, {});
});

test('the Windows uninstall probe is inert off Windows', () => {
  assert.equal(windowsInstalledVersion('Luna', { platform: 'linux' }), '');
  assert.equal(windowsInstalledVersion('', { platform: 'win32' }), '');
});

test('the Windows uninstall probe reads DisplayVersion for the matching product', () => {
  const key = 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Luna';
  const run = (_file, args) => {
    if (args.includes('/s')) {
      if (!args[1].startsWith('HKCU')) throw new Error('ERROR: The system was unable to find the specified registry key');
      return [
        'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Other',
        '    DisplayName    REG_SZ    Something Else',
        '',
        key,
        '    DisplayName    REG_SZ    Luna',
        '',
      ].join('\r\n');
    }
    assert.equal(args[1], key);
    return `\r\n${key}\r\n    DisplayVersion    REG_SZ    0.3.1\r\n\r\n`;
  };
  assert.equal(windowsInstalledVersion('Luna', { platform: 'win32', run }), '0.3.1');
  assert.equal(windowsInstalledVersion('Absent', { platform: 'win32', run }), '');
});

test('an installed-desktop tile offers an update only against a probed version', () => {
  const root = temporaryRoot('desktop-state');
  const executable = path.join(root, 'Luna.exe');
  fs.writeFileSync(executable, 'stub');
  const product = {
    id: 'luna', displayName: 'Luna', adapter: 'installed-desktop', version: '0.3.0',
    launch: { candidates: [executable] },
    release: { repository: { owner: 'o', name: 'n' } },
    versionProbe: { type: 'windows-uninstall', displayName: 'Luna' },
  };

  const unprobed = productState(product, '', '', '', { latest: { luna: '0.4.0' } });
  assert.equal(unprobed.ready, true);
  assert.equal(unprobed.updateAvailable, false, 'the catalog version is a guess, not an installed version');

  const probed = productState(product, '', '', '', { latest: { luna: '0.4.0' }, installed: { luna: '0.3.0' } });
  assert.equal(probed.updateAvailable, true);
  assert.equal(probed.installedVersion, '0.3.0');
  assert.match(probed.detail, /0\.4\.0/);

  const current = productState(product, '', '', '', { latest: { luna: '0.4.0' }, installed: { luna: '0.4.0' } });
  assert.equal(current.updateAvailable, false, 'the update clears once it is applied');
  assert.equal(current.version, '0.4.0');
});

test('a product with no update state reports none', () => {
  const root = temporaryRoot('desktop-plain');
  const executable = path.join(root, 'Luna.exe');
  fs.writeFileSync(executable, 'stub');
  const product = {
    id: 'luna', displayName: 'Luna', adapter: 'installed-desktop', version: '0.3.0',
    launch: { candidates: [executable] }, release: { repository: { owner: 'o', name: 'n' } },
    versionProbe: { type: 'windows-uninstall', displayName: 'Luna' },
  };
  const state = productState(product, '', '', '', {});
  assert.equal(state.updateAvailable, false);
  assert.equal(state.latestVersion, '');
  assert.equal(state.detail, 'Installed desktop application is ready.');
});
