'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  assertDownloadUrl,
  planArchiveExtraction,
  selectAsset,
} = require('../electron/release-installer.cjs');

test('release downloads accept only approved GitHub HTTPS hosts', () => {
  assert.equal(assertDownloadUrl('https://github.com/George-Nizor/Forge3D/releases/download/v0.2.0/bundle.zip').hostname, 'github.com');
  assert.equal(assertDownloadUrl('https://release-assets.githubusercontent.com/example').protocol, 'https:');
  assert.throws(() => assertDownloadUrl('http://github.com/file'), /approved GitHub HTTPS/);
  assert.throws(() => assertDownloadUrl('https://github.example.com/file'), /approved GitHub HTTPS/);
  assert.throws(() => assertDownloadUrl('https://user:secret@github.com/file'), /approved GitHub HTTPS/);
});

test('release asset selection is exact and unambiguous', () => {
  const release = {
    assets: [
      { name: 'instrumenta-release.json', browser_download_url: 'https://github.com/example/manifest' },
      { name: 'bundle.zip', browser_download_url: 'https://github.com/example/bundle' },
    ],
  };
  assert.equal(selectAsset(release, 'bundle.zip').name, 'bundle.zip');
  assert.throws(() => selectAsset(release, 'missing.zip'), /exactly one asset/);
  release.assets.push({ name: 'bundle.zip', browser_download_url: 'https://github.com/example/duplicate' });
  assert.throws(() => selectAsset(release, 'bundle.zip'), /exactly one asset/);
});

test('archive extraction passes literal paths outside PowerShell command text', () => {
  const archive = 'C:\\release cache\\Forge3D.zip';
  const destination = 'C:\\installed products\\Forge3D';
  const plan = planArchiveExtraction(archive, destination, { PATH: 'system-only' });
  assert.equal(plan.command, 'powershell.exe');
  assert.equal(plan.options.env.INSTRUMENTA_ARCHIVE, archive);
  assert.equal(plan.options.env.INSTRUMENTA_DESTINATION, destination);
  assert.equal(plan.options.env.PATH, 'system-only');
  assert.ok(plan.args.includes('-NonInteractive'));
  assert.doesNotMatch(plan.args.join(' '), /release cache|installed products/);
  assert.match(plan.args.at(-1), /\$env:INSTRUMENTA_ARCHIVE/);
});

// ---- Release lookup and download against a scripted GitHub ----------------------------------

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const {
  assetUrl,
  downloadFile,
  installLatestProduct,
  latestManifest,
  rateLimitedUntil,
  remainingBytes,
  tagFromRedirects,
} = require('../electron/release-installer.cjs');

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const forge3d = {
  id: 'forge3d',
  release: {
    repository: { provider: 'github', owner: 'George-Nizor', name: 'Forge3D', channel: 'stable' },
    manifestAsset: 'instrumenta-release.json',
  },
};

function respond(statusCode, body = '', headers = {}) {
  const chunks = body === '' ? [] : (Array.isArray(body) ? body : [body]).map((part) => Buffer.from(part));
  return Object.assign(Readable.from(chunks), { statusCode, headers });
}

// Answers requests from a table of URL -> response factory; anything unlisted is a 404.
function scriptedGitHub(routes) {
  const calls = [];
  const transport = async (url, { headers }) => {
    calls.push({ url: url.href, headers });
    const route = routes[url.href];
    return route ? route(headers) : respond(404);
  };
  return { transport, calls };
}

function managedManifest(version, bundle, overrides = {}) {
  return {
    schemaVersion: 1,
    product: 'forge3d',
    version,
    platform: 'windows-x64',
    minimumInstrumentaVersion: '0.9.0',
    installStrategy: 'managed-bundle',
    bundle: { asset: `Forge3D-${version}.zip`, size: bundle.length, sha256: digest(bundle), entry: 'Forge3D.exe' },
    ...overrides,
  };
}

const LATEST = 'https://github.com/George-Nizor/Forge3D/releases/latest/download/instrumenta-release.json';
const TAGGED = (tag) => `https://github.com/George-Nizor/Forge3D/releases/download/${tag}/instrumenta-release.json`;
const OBJECT = 'https://release-assets.githubusercontent.com/github-production-release-asset/123/abc';

test('the latest manifest and its tag come from the download route, not the API', async () => {
  const manifest = managedManifest('0.2.4', Buffer.from('zip'));
  const github = scriptedGitHub({
    [LATEST]: () => respond(302, '', { location: TAGGED('v0.2.4') }),
    [TAGGED('v0.2.4')]: () => respond(302, '', { location: OBJECT }),
    [OBJECT]: () => respond(200, JSON.stringify(manifest)),
  });
  const latest = await latestManifest(forge3d, { transport: github.transport });
  assert.equal(latest.tag, 'v0.2.4', 'the tag is read from the redirect');
  assert.equal(latest.manifest.version, '0.2.4');
  assert.ok(github.calls.every(({ url }) => !url.includes('api.github.com')), 'no API request was spent');
  // Every asset is then addressed by that tag on an approved host.
  const url = assetUrl(forge3d.release.repository, latest.tag, manifest.bundle.asset);
  assert.equal(url, 'https://github.com/George-Nizor/Forge3D/releases/download/v0.2.4/Forge3D-0.2.4.zip');
  assert.equal(assertDownloadUrl(url).hostname, 'github.com');
  assert.throws(() => assetUrl(forge3d.release.repository, '', 'x.zip'), /tag is required/);
  assert.throws(() => assetUrl(forge3d.release.repository, 'v1', '../x.zip'), /plain file name/);
});

test('a tag the redirects do not show falls back to v<version>', async () => {
  const manifest = managedManifest('0.2.5', Buffer.from('zip'));
  const github = scriptedGitHub({ [LATEST]: () => respond(200, JSON.stringify(manifest)) });
  assert.equal((await latestManifest(forge3d, { transport: github.transport })).tag, 'v0.2.5');
  assert.equal(tagFromRedirects([TAGGED('release%2Fcandidate')], forge3d.release.repository, 'instrumenta-release.json'), 'release/candidate');
  assert.equal(tagFromRedirects([LATEST, OBJECT], forge3d.release.repository, 'instrumenta-release.json'), '');
});

test('no published release reads as exactly that', async () => {
  const github = scriptedGitHub({});
  await assert.rejects(latestManifest(forge3d, { transport: github.transport }), (error) => {
    assert.equal(error.code, 'NO_RELEASE');
    assert.equal(error.message, 'No release published yet.');
    return true;
  });
  assert.equal(github.calls.length, 1, 'a 404 is an answer, so the API is not asked as well');
});

test('a rate limit says when asking again is welcome', async () => {
  const now = Date.UTC(2026, 8, 30, 12);
  const reset = Math.floor(now / 1000) + 1800;
  const github = scriptedGitHub({ [LATEST]: () => respond(403, '', { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) }) });
  await assert.rejects(latestManifest(forge3d, { transport: github.transport, now: () => now }), (error) => {
    assert.equal(error.code, 'RATE_LIMITED');
    assert.equal(error.blockedUntil, reset * 1000);
    return true;
  });
  assert.equal(github.calls.length, 1, 'a limited machine does not go on to spend API requests');
  assert.equal(rateLimitedUntil({ statusCode: 429, headers: { 'retry-after': '120' } }, now), now + 120_000);
  assert.equal(rateLimitedUntil({ statusCode: 403, headers: {} }, now), 0, 'a plain refusal is not a rate limit');
  assert.equal(rateLimitedUntil({ statusCode: 500, headers: { 'retry-after': '5' } }, now), 0);
  // A garbled reset far in the future holds for a day at most.
  assert.equal(rateLimitedUntil({ statusCode: 403, headers: { 'x-ratelimit-reset': '99999999999' } }, now), now + 24 * 60 * 60 * 1000);
});

test('the API is the fallback when the download route fails for another reason', async () => {
  const manifest = managedManifest('0.2.4', Buffer.from('zip'));
  const release = {
    tag_name: 'v0.2.4', draft: false, prerelease: false,
    assets: [{ name: 'instrumenta-release.json', browser_download_url: TAGGED('v0.2.4') }],
  };
  const github = scriptedGitHub({
    [LATEST]: () => respond(502, 'bad gateway'),
    'https://api.github.com/repos/George-Nizor/Forge3D/releases/latest': () => respond(200, JSON.stringify(release)),
    [TAGGED('v0.2.4')]: () => respond(200, JSON.stringify(manifest)),
  });
  const latest = await latestManifest(forge3d, { transport: github.transport });
  assert.deepEqual([latest.tag, latest.manifest.version], ['v0.2.4', '0.2.4']);
});

test('the prerelease channel offers a prerelease', async () => {
  const manifest = managedManifest('0.3.0-rc.1', Buffer.from('zip'));
  const releases = [
    { tag_name: 'v0.3.0-rc.2', draft: true, prerelease: true, assets: [] },
    {
      tag_name: 'v0.3.0-rc.1', draft: false, prerelease: true,
      assets: [{ name: 'instrumenta-release.json', browser_download_url: TAGGED('v0.3.0-rc.1') }],
    },
    { tag_name: 'v0.2.4', draft: false, prerelease: false, assets: [] },
  ];
  const github = scriptedGitHub({
    'https://api.github.com/repos/George-Nizor/Forge3D/releases': () => respond(200, JSON.stringify(releases)),
    [TAGGED('v0.3.0-rc.1')]: () => respond(200, JSON.stringify(manifest)),
  });
  const prerelease = { ...forge3d, release: { ...forge3d.release, repository: { ...forge3d.release.repository, channel: 'prerelease' } } };
  const latest = await latestManifest(prerelease, { transport: github.transport });
  assert.equal(latest.tag, 'v0.3.0-rc.1', 'the newest non-draft release, prerelease or not');
  assert.equal(latest.manifest.version, '0.3.0-rc.1');
});

function downloadArea() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-download-'));
  return { root, dispose: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('an interrupted download resumes with a range request', async () => {
  const area = downloadArea();
  try {
    const payload = Buffer.from('0123456789abcdef');
    const spec = { asset: 'bundle.zip', size: payload.length, sha256: digest(payload) };
    const target = path.join(area.root, 'bundle.zip');
    fs.writeFileSync(`${target}.partial`, payload.subarray(0, 6));
    const url = 'https://github.com/George-Nizor/Forge3D/releases/download/v1/bundle.zip';
    const github = scriptedGitHub({
      [url]: (headers) => {
        assert.equal(headers.Range, 'bytes=6-');
        return respond(206, payload.subarray(6).toString());
      },
    });
    const progress = [];
    await downloadFile(url, target, spec, (event) => progress.push(event.received), { transport: github.transport });
    assert.deepEqual(fs.readFileSync(target), payload);
    assert.equal(fs.existsSync(`${target}.partial`), false);
    assert.equal(progress.at(-1), payload.length);
  } finally {
    area.dispose();
  }
});

test('a download larger than declared is stopped, and a corrupt one never promoted', async () => {
  const area = downloadArea();
  try {
    const url = 'https://github.com/George-Nizor/Forge3D/releases/download/v1/bundle.zip';
    const target = path.join(area.root, 'bundle.zip');
    const spec = { asset: 'bundle.zip', size: 4, sha256: digest('abcd') };
    const oversize = scriptedGitHub({ [url]: () => respond(200, ['abc', 'defgh']) });
    await assert.rejects(downloadFile(url, target, spec, () => {}, { transport: oversize.transport }), /exceeded its declared size/);
    assert.equal(fs.existsSync(target), false);

    fs.rmSync(`${target}.partial`, { force: true });
    const corrupt = scriptedGitHub({ [url]: () => respond(200, 'abce') });
    await assert.rejects(downloadFile(url, target, spec, () => {}, { transport: corrupt.transport }), /failed SHA-256 verification/);
    assert.equal(fs.existsSync(target), false);
  } finally {
    area.dispose();
  }
});

test('a release meant for a newer launcher is refused before anything downloads', async () => {
  const area = downloadArea();
  try {
    const manifest = managedManifest('1.0.0', Buffer.from('zip'), { minimumInstrumentaVersion: '1.0.0' });
    const github = scriptedGitHub({});
    await assert.rejects(installLatestProduct(forge3d, {
      latest: { manifest, tag: 'v1.0.0' },
      launcherVersion: '0.9.1',
      cacheRoot: path.join(area.root, 'downloads'),
      installRoot: path.join(area.root, 'products'),
      transport: github.transport,
    }), /needs Instrumenta 1\.0\.0 or newer, and this is 0\.9\.1/);
    assert.equal(github.calls.length, 0);
    assert.equal(fs.existsSync(path.join(area.root, 'downloads')), false);
  } finally {
    area.dispose();
  }
});

test('a managed install downloads by tag, activates, then clears its downloads and old versions', async () => {
  const area = downloadArea();
  try {
    const cacheRoot = path.join(area.root, 'downloads');
    const installRoot = path.join(area.root, 'products');
    const bundle = Buffer.from('pretend zip');
    const routes = {};
    const github = scriptedGitHub(routes);
    const install = async (version) => {
      const manifest = managedManifest(version, bundle);
      routes[`https://github.com/George-Nizor/Forge3D/releases/download/v${version}/Forge3D-${version}.zip`] = () => respond(200, bundle.toString());
      return installLatestProduct(forge3d, {
        latest: { manifest, tag: `v${version}` },
        launcherVersion: '0.9.1',
        cacheRoot,
        installRoot,
        transport: github.transport,
        extractZip: async (_archive, destination) => {
          fs.mkdirSync(destination, { recursive: true });
          fs.writeFileSync(path.join(destination, 'Forge3D.exe'), version);
        },
      });
    };
    for (const version of ['0.2.2', '0.2.3', '0.2.4']) {
      const result = await install(version);
      assert.equal(result.downloadsRemoved, true);
      assert.equal(fs.existsSync(path.join(cacheRoot, 'forge3d', version)), false, 'the zip and extraction are gone');
    }
    assert.deepEqual(fs.readdirSync(path.join(installRoot, 'forge3d', 'versions')).sort(), ['0.2.3', '0.2.4']);
    assert.deepEqual(github.calls.map(({ url }) => path.basename(url)), ['Forge3D-0.2.2.zip', 'Forge3D-0.2.3.zip', 'Forge3D-0.2.4.zip']);
    // Installing a version already on disk points at it and downloads nothing.
    const again = await install('0.2.4');
    assert.equal(again.reused, true);
    assert.equal(github.calls.length, 3);
  } finally {
    area.dispose();
  }
});

test('an installer download is cleared only once the installer succeeds', async () => {
  const area = downloadArea();
  try {
    const cacheRoot = path.join(area.root, 'downloads');
    const installer = Buffer.from('setup');
    const part = Buffer.from('payload');
    const manifest = {
      schemaVersion: 1, product: 'luna', version: '0.4.0', platform: 'windows-x64', minimumInstrumentaVersion: '0.9.0',
      installStrategy: 'installed-desktop',
      installer: { asset: 'Luna-Setup.exe', size: installer.length, sha256: digest(installer) },
      payload: { assembledAsset: 'luna.7z', size: part.length, sha256: digest(part), chunks: [{ asset: 'luna.7z.001', size: part.length, sha256: digest(part) }] },
    };
    const base = 'https://github.com/George-Nizor/Luna/releases/download/v0.4.0';
    const github = scriptedGitHub({
      [`${base}/Luna-Setup.exe`]: () => respond(200, installer.toString()),
      [`${base}/luna.7z.001`]: () => respond(200, part.toString()),
    });
    const luna = { id: 'luna', release: { repository: { provider: 'github', owner: 'George-Nizor', name: 'Luna' } } };
    const options = { latest: { manifest, tag: 'v0.4.0' }, launcherVersion: '0.9.1', cacheRoot, installRoot: path.join(area.root, 'products'), transport: github.transport };
    const releaseRoot = path.join(cacheRoot, 'luna', '0.4.0');

    await assert.rejects(installLatestProduct(luna, { ...options, spawnInstaller: async () => { throw new Error('Installer exited with code 2.'); } }), /code 2/);
    assert.equal(fs.existsSync(path.join(releaseRoot, 'luna.7z')), true, 'kept, so the retry does not start over');

    const requests = github.calls.length;
    const result = await installLatestProduct(luna, { ...options, spawnInstaller: async () => {} });
    assert.equal(result.downloadsRemoved, true);
    assert.equal(fs.existsSync(releaseRoot), false);
    assert.equal(github.calls.length, requests, 'the retry reused every verified download');
  } finally {
    area.dispose();
  }
});

test('free space is asked only for what a retry still has to write', () => {
  const area = downloadArea();
  try {
    const specs = [{ asset: 'a', size: 100 }, { asset: 'b', size: 50 }];
    const manifest = { payload: { assembledAsset: 'p', size: 150 } };
    assert.equal(remainingBytes(area.root, specs, manifest), 300);
    fs.writeFileSync(path.join(area.root, 'a'), Buffer.alloc(100));
    fs.writeFileSync(path.join(area.root, 'b.partial'), Buffer.alloc(20));
    assert.equal(remainingBytes(area.root, specs, manifest), 30 + 150);
    fs.writeFileSync(path.join(area.root, 'p'), Buffer.alloc(150));
    assert.equal(remainingBytes(area.root, specs, manifest), 30);
  } finally {
    area.dispose();
  }
});

test('an update for an open product is downloaded now and activated later from the same files', async () => {
  const area = downloadArea();
  try {
    const cacheRoot = path.join(area.root, 'downloads');
    const installRoot = path.join(area.root, 'products');
    const bundle = Buffer.from('pretend zip');
    const manifest = managedManifest('0.2.4', bundle);
    const github = scriptedGitHub({
      'https://github.com/George-Nizor/Forge3D/releases/download/v0.2.4/Forge3D-0.2.4.zip': () => respond(200, bundle.toString()),
    });
    const options = {
      latest: { manifest, tag: 'v0.2.4' }, launcherVersion: '0.9.1', cacheRoot, installRoot, transport: github.transport,
      extractZip: async (_archive, destination) => {
        fs.mkdirSync(destination, { recursive: true });
        fs.writeFileSync(path.join(destination, 'Forge3D.exe'), 'new');
      },
    };
    const fetched = await installLatestProduct(forge3d, { ...options, activate: false });
    assert.equal(fetched.downloaded, true);
    assert.equal(fs.existsSync(path.join(installRoot, 'forge3d')), false, 'nothing was activated');
    assert.equal(fs.existsSync(path.join(cacheRoot, 'forge3d', '0.2.4', 'Forge3D-0.2.4.zip')), true);

    const installed = await installLatestProduct(forge3d, options);
    assert.equal(installed.pointer.current, '0.2.4');
    assert.equal(github.calls.length, 1, 'activation reused the verified download');
  } finally {
    area.dispose();
  }
});
