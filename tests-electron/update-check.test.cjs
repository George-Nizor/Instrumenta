'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
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
} = require('../electron/update-check.cjs');
const { productState } = require('../electron/workspace.cjs');

function temporaryRoot(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `instrumenta-${label}-`));
}

// What latestManifest resolves to: the release manifest and the tag its assets live under.
function published(version, product = 'forge3d') {
  return {
    tag: `v${version}`,
    manifest: {
      schemaVersion: 1, product, version, platform: 'windows-x64', minimumInstrumentaVersion: '0.9.0',
      installStrategy: 'managed-bundle',
      bundle: { asset: `${product}-${version}.zip`, size: 10, sha256: 'a'.repeat(64), entry: 'Forge3D.exe' },
    },
  };
}

const forge3d = { id: 'forge3d', adapter: 'managed-bundle', release: { repository: { owner: 'o', name: 'n' } } };

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
  // A managed-web product installs from releases, so it is polled like any other (K-010).
  assert.equal(releaseCapable({ adapter: 'managed-web', release: { repository } }), true);
  // Built from a checkout the user controls: there is no feed to ask.
  assert.equal(releaseCapable({ adapter: 'web-vite', release: { repository } }), false);
  assert.equal(releaseCapable({ adapter: 'web-service', release: { repository } }), false);
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
  const product = forge3d;
  const now = 10 * DEFAULT_TTL_MS;
  writeVersionCache(root, { forge3d: { version: '0.2.2', checkedAt: now - 60 } });

  let calls = 0;
  const fetchLatest = async () => { calls += 1; return published('0.2.4'); };

  assert.equal(isStale({ checkedAt: now - 60 }, now), false);
  const fresh = await refreshReleaseVersions({ products: [product], cacheRoot: root, fetchLatest, now });
  assert.equal(calls, 0, 'a fresh entry costs no request');
  assert.deepEqual(fresh.checked, []);

  const stale = await refreshReleaseVersions({ products: [product], cacheRoot: root, fetchLatest, now: now + DEFAULT_TTL_MS });
  assert.equal(calls, 1);
  assert.deepEqual(stale.checked, ['forge3d']);
  assert.equal(stale.cache.forge3d.version, '0.2.4');
  assert.equal(stale.cache.forge3d.tag, 'v0.2.4');

  // An explicit Refresh is the user asking; it ignores the TTL once the minute's floor has passed.
  await refreshReleaseVersions({ products: [product], cacheRoot: root, fetchLatest, now: now + DEFAULT_TTL_MS + REFRESH_FLOOR_MS, force: true });
  assert.equal(calls, 2);
});

test('Refresh asks at most once a minute per product', async () => {
  const root = temporaryRoot('update-floor');
  let calls = 0;
  const fetchLatest = async () => { calls += 1; return published('0.2.4'); };
  const refresh = (now) => refreshReleaseVersions({ products: [forge3d], cacheRoot: root, fetchLatest, now, force: true });
  await refresh(1_000_000);
  await refresh(1_000_000 + 5_000);
  await refresh(1_000_000 + REFRESH_FLOOR_MS - 1);
  assert.equal(calls, 1, 'pressing Refresh again within the minute costs nothing');
  await refresh(1_000_000 + REFRESH_FLOOR_MS);
  assert.equal(calls, 2);

  // The floor counts attempts, so a check failing offline is not retried on every press either.
  const offline = temporaryRoot('update-floor-offline');
  let failures = 0;
  const failing = async () => { failures += 1; throw new Error('getaddrinfo ENOTFOUND github.com'); };
  await refreshReleaseVersions({ products: [forge3d], cacheRoot: offline, fetchLatest: failing, now: 5_000_000, force: true });
  await refreshReleaseVersions({ products: [forge3d], cacheRoot: offline, fetchLatest: failing, now: 5_000_500, force: true });
  assert.equal(failures, 1);
});

test('no published release is remembered as an answer, and offers nothing', async () => {
  const root = temporaryRoot('update-none');
  let calls = 0;
  const fetchLatest = async () => { calls += 1; throw Object.assign(new Error('No release published yet.'), { code: 'NO_RELEASE' }); };
  const result = await refreshReleaseVersions({ products: [forge3d], cacheRoot: root, fetchLatest, now: 1000 });
  assert.deepEqual(result.checked, ['forge3d']);
  assert.equal(result.cache.forge3d.version, '');
  assert.deepEqual(latestKnownVersions(root), {});
  await refreshReleaseVersions({ products: [forge3d], cacheRoot: root, fetchLatest, now: 2000 });
  assert.equal(calls, 1, 'within six hours, "nothing yet" is not asked again');
});

test('a rate limit holds every check, Refresh included, until GitHub says so', async () => {
  const root = temporaryRoot('update-limited');
  const luna = { id: 'luna', adapter: 'installed-desktop', release: { repository: { owner: 'o', name: 'l' } } };
  const asked = [];
  const limited = Object.assign(new Error('limited'), { code: 'RATE_LIMITED', blockedUntil: 90_000 });
  const fetchLatest = async (product) => { asked.push(product.id); throw limited; };
  const first = await refreshReleaseVersions({ products: [forge3d, luna], cacheRoot: root, fetchLatest, now: 10_000 });
  assert.deepEqual(asked, ['forge3d'], 'the limit is on this machine, so Luna is not asked into it');
  assert.equal(first.cache.forge3d.blockedUntil, 90_000);
  assert.equal(first.cache.luna.blockedUntil, 90_000);

  const answer = async (product) => { asked.push(product.id); return published('0.2.4', product.id); };
  await refreshReleaseVersions({ products: [forge3d, luna], cacheRoot: root, fetchLatest: answer, now: 89_999, force: true });
  assert.deepEqual(asked, ['forge3d'], 'not even a forced check before blockedUntil');
  const after = await refreshReleaseVersions({ products: [forge3d, luna], cacheRoot: root, fetchLatest: answer, now: 90_000, force: true });
  assert.deepEqual(after.checked, ['forge3d', 'luna']);
  assert.equal(after.cache.forge3d.blockedUntil, 0);
});

test('a version-1 cache is still read, and a v2 entry keeps what installing needs', () => {
  const root = temporaryRoot('update-v1');
  fs.writeFileSync(path.join(root, 'release-versions.json'), JSON.stringify({
    schemaVersion: 1, products: { forge3d: { version: '0.2.4', checkedAt: 5000 }, broken: { version: 'nope', checkedAt: 1 } },
  }));
  const v1 = readVersionCache(root);
  assert.deepEqual(Object.keys(v1), ['forge3d']);
  assert.deepEqual(v1.forge3d, { version: '0.2.4', tag: '', manifest: null, checkedAt: 5000, attemptedAt: 5000, blockedUntil: 0 });
  assert.equal(cachedRelease(root, 'forge3d', 5001), null, 'a v1 entry cannot be installed from; it has no tag');

  const { manifest, tag } = published('0.2.5');
  writeVersionCache(root, { forge3d: { version: '0.2.5', tag, manifest, checkedAt: 7000, attemptedAt: 7000, blockedUntil: 0 } });
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'release-versions.json'), 'utf8')).schemaVersion, 2);
  assert.deepEqual(cachedRelease(root, 'forge3d', 7001), { manifest: readVersionCache(root).forge3d.manifest, tag: 'v0.2.5' });
  assert.equal(cachedRelease(root, 'forge3d', 7000 + DEFAULT_TTL_MS), null, 'a stale answer is looked up again');

  // A cached manifest that does not belong to the product, or disagrees with its version, is dropped.
  writeVersionCache(root, { forge3d: { version: '0.2.6', tag, manifest, checkedAt: 7000 } });
  assert.deepEqual(readVersionCache(root), {});
  writeVersionCache(root, { luna: { version: '0.2.5', tag, manifest, checkedAt: 7000 } });
  assert.deepEqual(readVersionCache(root), {});
});

test('a failed check keeps the last known version rather than clearing it', async () => {
  const root = temporaryRoot('update-offline');
  writeVersionCache(root, { forge3d: { version: '0.2.4', checkedAt: 0 } });
  const result = await refreshReleaseVersions({
    products: [forge3d],
    cacheRoot: root,
    now: DEFAULT_TTL_MS * 2,
    fetchLatest: async () => { throw new Error('getaddrinfo ENOTFOUND github.com'); },
  });
  assert.equal(result.cache.forge3d.version, '0.2.4', 'losing the network must not look like being up to date');
  assert.deepEqual(result.checked, []);
});

test('a garbage version from the feed is refused', async () => {
  const root = temporaryRoot('update-garbage');
  const result = await refreshReleaseVersions({
    products: [forge3d], cacheRoot: root, now: 1, fetchLatest: async () => ({ tag: 'x', manifest: { version: 'v0.2.4-latest-final' } }),
  });
  assert.equal(result.cache.forge3d.version, '');
  assert.deepEqual(result.checked, []);
  assert.deepEqual(latestKnownVersions(root), {});
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

test('the Windows uninstall probe accepts NSIS versioned names without matching other products', () => {
  const key = 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Luna';
  for (const [registeredName, expected] of [
    ['Luna 0.4.0', '0.4.0'],
    ['Luna 0.3.0', ''],
    ['Luna Voice Studio 0.4.0', ''],
    ['Luna Tools', ''],
    ['Lunar 0.4.0', ''],
  ]) {
    const run = (_file, args) => args.includes('/s')
      ? `${key}\r\n    DisplayName    REG_SZ    ${registeredName}\r\n\r\n`
      : `${key}\r\n    DisplayVersion    REG_SZ    0.4.0\r\n\r\n`;
    assert.equal(windowsInstalledVersion('Luna', { platform: 'win32', run }), expected, registeredName);
  }
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
