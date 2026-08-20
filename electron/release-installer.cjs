'use strict';

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { spawn } = require('node:child_process');
const {
  assemblePayload,
  installManagedDirectory,
  validateReleaseManifest,
  verifyFile,
  within,
} = require('./release-lifecycle.cjs');

const USER_AGENT = 'Instrumenta/0.8.0';
const MAX_MANIFEST_BYTES = 1024 * 1024;

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

function request(urlValue, options = {}, redirects = 0) {
  const url = assertDownloadUrl(urlValue);
  if (redirects > 5) return Promise.reject(new Error('Release download redirected too many times.'));
  return new Promise((resolve, reject) => {
    const requestHandle = https.get(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/vnd.github+json', ...(options.headers || {}) },
    }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const location = response.headers.location;
        response.resume();
        if (!location) {
          reject(new Error('GitHub returned a redirect without a location.'));
          return;
        }
        request(new URL(location, url).href, options, redirects + 1).then(resolve, reject);
        return;
      }
      resolve(response);
    });
    requestHandle.setTimeout(30000, () => requestHandle.destroy(new Error('Release request timed out.')));
    requestHandle.once('error', reject);
  });
}

async function requestBuffer(url, maximum = MAX_MANIFEST_BYTES) {
  const response = await request(url);
  if (response.statusCode !== 200) {
    response.resume();
    throw new Error('GitHub release request failed with HTTP ' + response.statusCode + '.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of response) {
    size += chunk.length;
    if (size > maximum) {
      response.destroy();
      throw new Error('GitHub release metadata exceeded its size limit.');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function repositoryApi(repository, suffix) {
  if (!repository || repository.provider !== 'github') throw new Error('Product does not declare a GitHub release repository.');
  const owner = encodeURIComponent(repository.owner);
  const name = encodeURIComponent(repository.name);
  return 'https://api.github.com/repos/' + owner + '/' + name + suffix;
}

async function latestRelease(repository) {
  const endpoint = repositoryApi(repository, repository.channel === 'prerelease' ? '/releases' : '/releases/latest');
  const payload = JSON.parse((await requestBuffer(endpoint)).toString('utf8'));
  const release = Array.isArray(payload) ? payload.find((item) => !item.draft && !item.prerelease) : payload;
  if (!release || release.draft || !Array.isArray(release.assets)) throw new Error('No published release is available.');
  return release;
}

function selectAsset(release, name) {
  const matches = release.assets.filter((asset) => asset && asset.name === name && typeof asset.browser_download_url === 'string');
  if (matches.length !== 1) throw new Error('Release must contain exactly one asset named ' + name + '.');
  assertDownloadUrl(matches[0].browser_download_url);
  return matches[0];
}

async function releaseManifest(definition, release = null) {
  const repository = definition.release?.repository;
  const selectedRelease = release || await latestRelease(repository);
  const manifestName = definition.release?.manifestAsset || 'instrumenta-release.json';
  const asset = selectAsset(selectedRelease, manifestName);
  const manifest = validateReleaseManifest(JSON.parse((await requestBuffer(asset.browser_download_url)).toString('utf8')), definition.id);
  return { release: selectedRelease, manifest };
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

async function downloadFile(url, destination, spec, onProgress = () => {}) {
  const root = path.resolve(path.dirname(destination));
  const target = path.resolve(destination);
  if (!within(root, target)) throw new Error('Release asset escaped its download directory.');
  fs.mkdirSync(root, { recursive: true });
  if (fs.existsSync(target)) return verifyFile(target, spec);
  const partial = target + '.partial';
  let offset = fs.existsSync(partial) ? fs.statSync(partial).size : 0;
  if (offset > spec.size) {
    fs.rmSync(partial, { force: true });
    offset = 0;
  }
  const headers = offset ? { Range: 'bytes=' + offset + '-' } : {};
  const response = await request(url, { headers });
  if (![200, 206].includes(response.statusCode)) {
    response.resume();
    throw new Error('Asset download failed with HTTP ' + response.statusCode + '.');
  }
  if (offset && response.statusCode === 200) {
    fs.rmSync(partial, { force: true });
    offset = 0;
  }
  const output = fs.createWriteStream(partial, { flags: offset ? 'a' : 'wx' });
  let received = offset;
  try {
    for await (const chunk of response) {
      received += chunk.length;
      if (received > spec.size) throw new Error(spec.asset + ' exceeded its declared size.');
      if (!output.write(chunk)) await new Promise((resolve) => output.once('drain', resolve));
      onProgress({ asset: spec.asset, received, total: spec.size });
    }
  } catch (error) {
    output.destroy();
    throw error;
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

async function defaultExtractZip(archive, destination) {
  fs.mkdirSync(destination, { recursive: true });
  const child = spawn('powershell.exe', [
    '-NoLogo', '-NoProfile', '-Command',
    'Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force',
    archive, destination,
  ], { windowsHide: true, stdio: 'ignore' });
  await waitForChild(child, 'Archive extraction');
}

async function defaultSpawnInstaller(installer) {
  await waitForChild(spawn(installer, [], { cwd: path.dirname(installer), windowsHide: false, stdio: 'ignore' }), 'Installer');
}

async function installLatestProduct(definition, options) {
  const { release, manifest } = await releaseManifest(definition, options.release);
  const releaseRoot = path.join(path.resolve(options.cacheRoot), definition.id, manifest.version);
  const specs = manifest.installStrategy === 'managed-bundle'
    ? [manifest.bundle]
    : [manifest.installer, ...manifest.payload.chunks];
  ensureFreeSpace(releaseRoot, specs.reduce((total, spec) => total + spec.size, 0) + (manifest.payload?.size || 0));
  for (const spec of specs) {
    const asset = selectAsset(release, spec.asset);
    await downloadFile(asset.browser_download_url, path.join(releaseRoot, spec.asset), spec, options.onProgress);
  }

  if (manifest.installStrategy === 'installed-desktop') {
    const payload = assemblePayload(manifest, releaseRoot, path.join(releaseRoot, manifest.payload.assembledAsset));
    verifyFile(payload, { asset: manifest.payload.assembledAsset, size: manifest.payload.size, sha256: manifest.payload.sha256 });
    const installer = path.join(releaseRoot, manifest.installer.asset);
    await (options.spawnInstaller || defaultSpawnInstaller)(installer, manifest);
    return { strategy: manifest.installStrategy, version: manifest.version, installer, payload };
  }

  const archive = path.join(releaseRoot, manifest.bundle.asset);
  const extracted = path.join(releaseRoot, 'extracted');
  if (fs.existsSync(extracted)) fs.rmSync(extracted, { recursive: true, force: true });
  await (options.extractZip || defaultExtractZip)(archive, extracted);
  const installed = installManagedDirectory({ sourceRoot: extracted, installRoot: options.installRoot, manifest });
  return { strategy: manifest.installStrategy, version: manifest.version, ...installed };
}

module.exports = {
  assertDownloadUrl,
  downloadFile,
  ensureFreeSpace,
  installLatestProduct,
  latestRelease,
  releaseManifest,
  selectAsset,
};
