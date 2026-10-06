'use strict';

// Unpatched by Electron's asar support; see plain-fs.cjs.
const fs = require('./plain-fs.cjs');
const https = require('node:https');
const path = require('node:path');
const { spawn } = require('node:child_process');
const {
  assemblePayload,
  installManagedDirectory,
  pruneManagedVersions,
  validInstalledVersion,
  validateReleaseManifest,
  verifyFile,
  within,
} = require('./release-lifecycle.cjs');
const { isNewer } = require('./update-check.cjs');

const USER_AGENT = `Instrumenta/${require('../package.json').version}`;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// No release carries the product's manifest yet. GitHub answers the download route with 404 both
// when a repository has no release and when its latest release lacks the file; today that is every
// product, so this is an answer ("nothing published yet") rather than a failure.
class NoReleaseError extends Error {
  constructor(message = 'No release published yet.') {
    super(message);
    this.name = 'NoReleaseError';
    this.code = 'NO_RELEASE';
  }
}

// GitHub asked for quiet. `blockedUntil` is the moment asking again is welcome, in epoch ms.
class RateLimitedError extends Error {
  constructor(blockedUntil) {
    super(`GitHub is limiting requests until ${new Date(blockedUntil).toISOString()}.`);
    this.name = 'RateLimitedError';
    this.code = 'RATE_LIMITED';
    this.blockedUntil = blockedUntil;
  }
}

function assertDownloadUrl(value) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  const allowed = host === 'api.github.com'
    || host === 'github.com'
    || host.endsWith('.github.com')
    || host.endsWith('.githubusercontent.com');
  if (url.protocol !== 'https:' || !allowed || url.username || url.password) {
    throw new Error('Release download URL is not an approved GitHub HTTPS address.');
  }
  return url;
}

// The one place a request leaves the machine. It is injectable so tests can script GitHub's
// answers, redirects and all, with no network. A transport resolves to a response: `statusCode`,
// `headers`, an async-iterable body, and `resume()`/`destroy()`.
function httpsTransport(url, { headers = {}, timeoutMs = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    const handle = https.get(url, { headers }, resolve);
    handle.setTimeout(timeoutMs, () => handle.destroy(new Error('Release request timed out.')));
    handle.once('error', reject);
  });
}

/**
 * A GET that follows redirects itself, checking every hop against the approved GitHub hosts. The
 * response says where it ended (`url`) and where it passed through (`redirects`): the download
 * route for the latest release names the release's tag only in its redirect, so the chain is
 * information rather than noise.
 */
async function request(urlValue, options = {}) {
  const transport = options.transport || httpsTransport;
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: options.accept || 'application/vnd.github+json',
    ...(options.headers || {}),
  };
  const redirects = [];
  let url = assertDownloadUrl(urlValue);
  for (;;) {
    const response = await transport(url, { headers });
    if (!REDIRECT_STATUSES.has(response.statusCode)) {
      response.url = url.href;
      response.redirects = redirects;
      return response;
    }
    const location = response.headers?.location;
    response.resume?.();
    if (!location) throw new Error('GitHub returned a redirect without a location.');
    if (redirects.length >= MAX_REDIRECTS) throw new Error('Release download redirected too many times.');
    redirects.push(url.href);
    url = assertDownloadUrl(new URL(location, url).href);
  }
}

// When a refused request may be retried. GitHub sends `retry-after` (seconds, or an HTTP date) or
// `x-ratelimit-reset` (epoch seconds) with a 403 or 429 that is a rate limit; a 403 carrying
// neither is an ordinary refusal and returns 0. GitHub's limits reset within the hour, so a hold
// is capped at a day: a garbled header must not silence update checks for good.
const MAX_HOLD_MS = 24 * 60 * 60 * 1000;

function rateLimitedUntil(response, now = Date.now()) {
  if (![403, 429].includes(response?.statusCode)) return 0;
  const headers = response.headers || {};
  const hold = (until) => Math.min(Math.max(now, until), now + MAX_HOLD_MS);
  const retryAfter = String(headers['retry-after'] || '').trim();
  if (/^\d+$/.test(retryAfter)) return hold(now + Number(retryAfter) * 1000);
  if (retryAfter && Number.isFinite(Date.parse(retryAfter))) return hold(Date.parse(retryAfter));
  const reset = String(headers['x-ratelimit-reset'] || '').trim();
  if (/^\d+$/.test(reset)) return hold(Number(reset) * 1000);
  return 0;
}

function httpFailure(response, what, options = {}) {
  const now = typeof options.now === 'function' ? options.now() : Date.now();
  const blockedUntil = rateLimitedUntil(response, now);
  if (blockedUntil) return new RateLimitedError(blockedUntil);
  const error = new Error(`${what} failed with HTTP ${response.statusCode}.`);
  error.statusCode = response.statusCode;
  return error;
}

async function requestBuffer(url, options = {}) {
  const response = await request(url, options);
  if (response.statusCode !== 200) {
    response.resume?.();
    throw httpFailure(response, 'GitHub release request', options);
  }
  const maximum = options.maximum || MAX_MANIFEST_BYTES;
  const chunks = [];
  let size = 0;
  for await (const chunk of response) {
    size += chunk.length;
    if (size > maximum) {
      response.destroy?.();
      throw new Error('GitHub release metadata exceeded its size limit.');
    }
    chunks.push(chunk);
  }
  return { body: Buffer.concat(chunks), response };
}

function repositoryPath(repository) {
  if (!repository || repository.provider !== 'github') throw new Error('Product does not declare a GitHub release repository.');
  return `${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`;
}

function repositoryApi(repository, suffix) {
  return `https://api.github.com/repos/${repositoryPath(repository)}${suffix}`;
}

// A release asset's address, built from the release's tag rather than looked up through the API.
function assetUrl(repository, tag, asset) {
  if (typeof tag !== 'string' || !tag || /[\x00-\x1f]/.test(tag)) throw new Error('A release tag is required to download its assets.');
  if (typeof asset !== 'string' || !asset || /[\x00-\x1f/\\]/.test(asset)) throw new Error('A release asset is named by a plain file name.');
  const encodedTag = tag.split('/').map(encodeURIComponent).join('/');
  return assertDownloadUrl(`https://github.com/${repositoryPath(repository)}/releases/download/${encodedTag}/${encodeURIComponent(asset)}`).href;
}

// The tag a download redirect went through: `github.com/<owner>/<repo>/releases/download/<tag>/<asset>`.
function tagFromRedirects(urls, repository, asset) {
  const prefix = `/${repository.owner}/${repository.name}/releases/download/`.toLowerCase();
  for (const value of urls) {
    let url;
    try {
      url = new URL(value);
    } catch {
      continue;
    }
    if (url.hostname.toLowerCase() !== 'github.com' || !url.pathname.toLowerCase().startsWith(prefix)) continue;
    const segments = url.pathname.slice(prefix.length).split('/');
    if (segments.length < 2) continue;
    try {
      if (decodeURIComponent(segments.at(-1)) !== asset) continue;
      const tag = segments.slice(0, -1).map((segment) => decodeURIComponent(segment)).join('/');
      if (tag && !/[\x00-\x1f]/.test(tag)) return tag;
    } catch {
      // A malformed escape is not a tag.
    }
  }
  return '';
}

function parseManifest(body, productId) {
  let manifest;
  try {
    manifest = JSON.parse(body.toString('utf8').replace(/^﻿/, ''));
  } catch {
    throw new Error('The release manifest is not valid JSON.');
  }
  return validateReleaseManifest(manifest, productId);
}

// The REST API's view of the newest release. Only the prerelease channel needs it: GitHub's
// "latest" is by definition the newest stable release. It is also the fallback when the download
// route fails for a reason other than 404.
async function latestRelease(repository, options = {}) {
  const prerelease = repository?.channel === 'prerelease';
  let body;
  try {
    ({ body } = await requestBuffer(repositoryApi(repository, prerelease ? '/releases' : '/releases/latest'), options));
  } catch (error) {
    if (error.statusCode === 404) throw new NoReleaseError();
    throw error;
  }
  const payload = JSON.parse(body.toString('utf8'));
  // The newest published release of either kind, which is what choosing the prerelease channel
  // means. The list used to skip prereleases as well, so the channel was stable by another name.
  const release = Array.isArray(payload) ? payload.find((item) => item && !item.draft) : payload;
  if (!release || release.draft || !Array.isArray(release.assets)) throw new NoReleaseError();
  return release;
}

function selectAsset(release, name) {
  const matches = release.assets.filter((asset) => asset && asset.name === name && typeof asset.browser_download_url === 'string');
  if (matches.length !== 1) throw new Error('Release must contain exactly one asset named ' + name + '.');
  assertDownloadUrl(matches[0].browser_download_url);
  return matches[0];
}

async function releaseManifest(definition, release = null, options = {}) {
  const repository = definition.release?.repository;
  const selectedRelease = release || await latestRelease(repository, options);
  const manifestName = definition.release?.manifestAsset || 'instrumenta-release.json';
  const asset = selectAsset(selectedRelease, manifestName);
  const { body } = await requestBuffer(asset.browser_download_url, { ...options, accept: 'application/octet-stream' });
  return { release: selectedRelease, manifest: parseManifest(body, definition.id) };
}

async function manifestFromApi(definition, options) {
  const { release, manifest } = await releaseManifest(definition, null, options);
  if (typeof release.tag_name !== 'string' || !release.tag_name) throw new Error('The GitHub release has no tag.');
  return { manifest, tag: release.tag_name };
}

/**
 * The newest release's manifest and the tag its assets live under, as `{ manifest, tag }`.
 *
 * GitHub answers `github.com/<owner>/<repo>/releases/latest/download/<asset>` with a redirect to
 * `/releases/download/<tag>/<asset>` and on to the file. One unauthenticated request therefore
 * gives the manifest and the tag, and never spends the REST API's allowance of sixty requests an
 * hour. The tag comes from that redirect, or failing that from the version (`v<version>`).
 *
 * A 404 means no release carries the manifest yet (NoReleaseError). A rate limit is reported as
 * such (RateLimitedError). Any other failure falls back to the REST API, which is also the only
 * route for the prerelease channel.
 */
async function latestManifest(definition, options = {}) {
  const repository = definition.release?.repository;
  const manifestName = definition.release?.manifestAsset || 'instrumenta-release.json';
  if (repository?.channel === 'prerelease') return manifestFromApi(definition, options);
  const url = `https://github.com/${repositoryPath(repository)}/releases/latest/download/${encodeURIComponent(manifestName)}`;
  let fetched;
  try {
    fetched = await requestBuffer(url, { ...options, accept: 'application/octet-stream' });
  } catch (error) {
    if (error.statusCode === 404) throw new NoReleaseError();
    if (error.code === 'RATE_LIMITED') throw error;
    return manifestFromApi(definition, options);
  }
  const manifest = parseManifest(fetched.body, definition.id);
  const tag = tagFromRedirects([...fetched.response.redirects, fetched.response.url], repository, manifestName)
    || `v${manifest.version}`;
  return { manifest, tag };
}

// A release names the oldest launcher able to install it. One meant for a newer launcher is
// refused before anything is downloaded, rather than half-installed by a launcher that predates it.
function launcherSupports(manifest, launcherVersion) {
  return !launcherVersion || !isNewer(manifest.minimumInstrumentaVersion, launcherVersion);
}

function assertLauncherSupports(manifest, launcherVersion) {
  if (launcherSupports(manifest, launcherVersion)) return;
  throw new Error(
    `${manifest.product} ${manifest.version} needs Instrumenta ${manifest.minimumInstrumentaVersion} or newer, `
    + `and this is ${launcherVersion}. Update Instrumenta first.`,
  );
}

function fileSize(file) {
  try { return fs.statSync(file).size; } catch { return 0; }
}

// Bytes this release still has to write: a file already downloaded counts for nothing, a partial
// one for what it lacks, Luna's assembled payload only if it is not there yet, and a managed
// bundle its size again for extraction. A retry after a failed installer used to demand room for
// the whole 30 GB a second time and could refuse to start.
function remainingBytes(releaseRoot, specs, manifest) {
  let total = 0;
  for (const spec of specs) {
    const target = path.join(releaseRoot, spec.asset);
    if (fileSize(target) === spec.size) continue;
    total += spec.size - Math.min(spec.size, fileSize(`${target}.partial`));
  }
  if (manifest.payload && fileSize(path.join(releaseRoot, manifest.payload.assembledAsset)) !== manifest.payload.size) {
    total += manifest.payload.size;
  }
  if (manifest.bundle) total += manifest.bundle.size;
  return total;
}

function ensureFreeSpace(directory, requiredBytes) {
  fs.mkdirSync(directory, { recursive: true });
  if (typeof fs.statfsSync !== 'function') return;
  const stats = fs.statfsSync(directory);
  const available = Number(stats.bavail) * Number(stats.bsize);
  const required = Math.ceil(requiredBytes * 1.15) + 256 * 1024 * 1024;
  if (Number.isFinite(available) && available < required) {
    throw new Error('Not enough free disk space for this release and its installation staging area.');
  }
}

async function downloadFile(url, destination, spec, onProgress = () => {}, options = {}) {
  const root = path.resolve(path.dirname(destination));
  const target = path.resolve(destination);
  if (!within(root, target)) throw new Error('Release asset escaped its download directory.');
  fs.mkdirSync(root, { recursive: true });
  if (fs.existsSync(target)) {
    // Downloaded on an earlier attempt. One that no longer verifies is fetched again rather than
    // failing every retry for as long as it sits there.
    try {
      return verifyFile(target, spec);
    } catch {
      fs.rmSync(target, { force: true });
    }
  }
  const partial = target + '.partial';
  let offset = fs.existsSync(partial) ? fs.statSync(partial).size : 0;
  if (offset && offset === spec.size) {
    // Every byte arrived last time and only the rename was missed. Asking for more would earn a 416.
    try {
      verifyFile(partial, spec);
      fs.renameSync(partial, target);
      return target;
    } catch {
      offset = spec.size + 1;
    }
  }
  if (offset > spec.size) {
    fs.rmSync(partial, { force: true });
    offset = 0;
  }
  const headers = offset ? { Range: 'bytes=' + offset + '-' } : {};
  const response = await request(url, { ...options, headers, accept: 'application/octet-stream' });
  if (![200, 206].includes(response.statusCode)) {
    response.resume?.();
    throw httpFailure(response, `${spec.asset} download`, options);
  }
  if (offset && response.statusCode === 200) {
    fs.rmSync(partial, { force: true });
    offset = 0;
  }
  const output = fs.createWriteStream(partial, { flags: offset ? 'a' : 'w' });
  let received = offset;
  // A connection that sends its headers and then falls silent would otherwise sit at the same
  // percentage forever (seen on 2026-10-06 with the 0.11.0 self-update). With no bytes for this
  // long the download fails, and the retry resumes from the partial file.
  const stallMs = options.stallMs ?? 60_000;
  let lastByteAt = Date.now();
  const watchdog = setInterval(() => {
    if (Date.now() - lastByteAt > stallMs) response.destroy?.(new Error(`${spec.asset} stopped arriving; it will resume on the next try.`));
  }, Math.min(5_000, Math.max(50, Math.floor(stallMs / 4))));
  try {
    for await (const chunk of response) {
      lastByteAt = Date.now();
      received += chunk.length;
      if (received > spec.size) throw new Error(spec.asset + ' exceeded its declared size.');
      if (!output.write(chunk)) await new Promise((resolve) => output.once('drain', resolve));
      onProgress({ asset: spec.asset, received, total: spec.size });
    }
  } catch (error) {
    response.destroy?.();
    await new Promise((resolve) => output.end(resolve));
    throw error;
  } finally {
    clearInterval(watchdog);
  }
  await new Promise((resolve, reject) => output.end((error) => error ? reject(error) : resolve()));
  verifyFile(partial, spec);
  fs.renameSync(partial, target);
  return target;
}

function waitForChild(child, label) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(label + ' exited with code ' + code + '.')));
  });
}

function planArchiveExtraction(archive, destination, environment = process.env) {
  return {
    command: 'powershell.exe',
    args: [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
      'Expand-Archive -LiteralPath $env:INSTRUMENTA_ARCHIVE -DestinationPath $env:INSTRUMENTA_DESTINATION -Force',
    ],
    options: {
      windowsHide: true,
      stdio: 'ignore',
      env: {
        ...environment,
        INSTRUMENTA_ARCHIVE: archive,
        INSTRUMENTA_DESTINATION: destination,
      },
    },
  };
}

async function defaultExtractZip(archive, destination) {
  fs.mkdirSync(destination, { recursive: true });
  const plan = planArchiveExtraction(archive, destination);
  await waitForChild(spawn(plan.command, plan.args, plan.options), 'Archive extraction');
}

async function defaultSpawnInstaller(installer) {
  await waitForChild(spawn(installer, [], { cwd: path.dirname(installer), windowsHide: false, stdio: 'ignore' }), 'Installer');
}

// A release's downloads have done their job once its version is active, or once its installer
// has exited cleanly: Luna's alone are about 30 GB. Removal is best effort. What a failed install
// leaves behind is kept, so the retry resumes instead of starting over.
function removeDownload(releaseRoot, cacheRoot) {
  const root = path.resolve(cacheRoot);
  const target = path.resolve(releaseRoot);
  if (!within(root, target) || target === root) return false;
  try {
    fs.rmSync(target, { recursive: true, force: true });
    const productRoot = path.dirname(target);
    if (productRoot !== root && !fs.readdirSync(productRoot).length) fs.rmdirSync(productRoot);
    return true;
  } catch {
    return false;
  }
}

/**
 * Installs the newest release of a product, or the one in `options.latest` (`{ manifest, tag }`,
 * normally what the update check cached) so installing costs no second lookup.
 *
 * With `activate: false` it stops once every asset is downloaded and verified. That is how an
 * update to a product that is open is fetched without being swapped in under it; installing
 * later finds the same files and goes straight to activation.
 */
async function installLatestProduct(definition, options) {
  const repository = definition.release?.repository;
  const latest = options.latest?.manifest && options.latest?.tag
    ? { manifest: validateReleaseManifest(options.latest.manifest, definition.id), tag: String(options.latest.tag) }
    : await latestManifest(definition, options);
  const { manifest, tag } = latest;
  if (manifest.installStrategy === 'launcher') throw new Error('Instrumenta updates itself; it is not installed as a product.');
  assertLauncherSupports(manifest, options.launcherVersion);
  const releaseRoot = path.join(path.resolve(options.cacheRoot), definition.id, manifest.version);
  const managed = manifest.installStrategy !== 'installed-desktop';

  // Already on disk (installed before, rolled back from, and wanted again): point at it.
  if (managed && validInstalledVersion(path.join(path.resolve(options.installRoot), definition.id), definition.id, manifest.version)) {
    if (options.activate === false) return { strategy: manifest.installStrategy, version: manifest.version, tag, downloaded: true };
    const installed = installManagedDirectory({ sourceRoot: releaseRoot, installRoot: options.installRoot, manifest });
    removeDownload(releaseRoot, options.cacheRoot);
    const pruned = pruneManagedVersions(options.installRoot, definition.id, options.prune);
    return { strategy: manifest.installStrategy, version: manifest.version, tag, ...installed, pruned };
  }

  const specs = managed ? [manifest.bundle] : [manifest.installer, ...manifest.payload.chunks];
  ensureFreeSpace(releaseRoot, remainingBytes(releaseRoot, specs, manifest));
  for (const spec of specs) {
    await downloadFile(assetUrl(repository, tag, spec.asset), path.join(releaseRoot, spec.asset), spec, options.onProgress, options);
  }
  if (options.activate === false) return { strategy: manifest.installStrategy, version: manifest.version, tag, downloaded: true };

  if (!managed) {
    // assemblePayload verifies every chunk and then the complete payload.
    assemblePayload(manifest, releaseRoot, path.join(releaseRoot, manifest.payload.assembledAsset));
    const installer = path.join(releaseRoot, manifest.installer.asset);
    await (options.spawnInstaller || defaultSpawnInstaller)(installer, manifest);
    const downloadsRemoved = removeDownload(releaseRoot, options.cacheRoot);
    return { strategy: manifest.installStrategy, version: manifest.version, tag, downloadsRemoved };
  }

  const archive = path.join(releaseRoot, manifest.bundle.asset);
  const extracted = path.join(releaseRoot, 'extracted');
  if (fs.existsSync(extracted)) fs.rmSync(extracted, { recursive: true, force: true });
  await (options.extractZip || defaultExtractZip)(archive, extracted);
  const installed = installManagedDirectory({ sourceRoot: extracted, installRoot: options.installRoot, manifest });
  const downloadsRemoved = removeDownload(releaseRoot, options.cacheRoot);
  const pruned = pruneManagedVersions(options.installRoot, definition.id, options.prune);
  return { strategy: manifest.installStrategy, version: manifest.version, tag, ...installed, downloadsRemoved, pruned };
}

module.exports = {
  NoReleaseError,
  RateLimitedError,
  assertDownloadUrl,
  assetUrl,
  downloadFile,
  ensureFreeSpace,
  httpsTransport,
  installLatestProduct,
  latestManifest,
  latestRelease,
  launcherSupports,
  planArchiveExtraction,
  rateLimitedUntil,
  releaseManifest,
  remainingBytes,
  request,
  selectAsset,
  tagFromRedirects,
};
