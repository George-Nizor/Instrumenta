'use strict';

// Sources of external apps: open-source applications other people make, which Instrumenta installs
// and keeps up to date for convenience without presenting them as part of the suite.
//
// A source is one file under products/sources/ describing a provider once: who makes the apps, under
// which licence, how their Windows release asset and checksum file are named, where the executable
// sits inside the archive, and the curated list of apps. None of this touches the suite catalog: an
// external app has no sibling checkout, no brand tile, no Content-Security-Policy and no session
// partition, because it is never served or drawn as an Instrumenta product.
//
// These releases carry no instrumenta-release.json. The newest one is found without the REST API:
// `github.com/<owner>/<repo>/releases/latest` redirects to `/releases/tag/<tag>`, the release's
// SHA256SUMS.txt names every asset with its digest, and a HEAD of the asset (following GitHub's
// redirect to its object store) gives the size. From those a release manifest is synthesised and run
// through the launcher's own validateReleaseManifest, so installing it takes exactly the verified
// path a Forge3D release takes.

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const {
  NoReleaseError,
  RateLimitedError,
  assetUrl,
  rateLimitedUntil,
  request,
} = require('./release-installer.cjs');
const { validateReleaseManifest } = require('./release-lifecycle.cjs');

const ADAPTER = 'external-portable';
const idPattern = /^[a-z][a-z0-9-]{0,39}$/;
const ownerPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const repoPattern = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$/;
const versionPattern = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;
const licencePattern = /^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}$/;
const digestPattern = /^[0-9a-fA-F]{64}$/;
// A name pattern is literal file-name characters and the two placeholders, nothing else: no
// separators, no drive letters, no environment variables.
const patternText = /^(?:[A-Za-z0-9._-]|\{repo\}|\{version\})+$/;
const MAX_CHECKSUMS_BYTES = 256 * 1024;
const MAX_LISTING_BYTES = 2 * 1024 * 1024;
const MAX_TEXT = 200;

// ---- Validation -------------------------------------------------------------------------------

function cleanText(value, label, { required = true, max = MAX_TEXT } = {}) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  const text = value.replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim();
  if (required && !text) throw new Error(`${label} is required.`);
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function safeLeaf(value) {
  return typeof value === 'string' && value !== '' && value !== '.' && value !== '..'
    && !/[\x00-\x1f]/.test(value)
    && path.posix.basename(value) === value && path.win32.basename(value) === value;
}

function validatePattern(value, label, { requireVersion = false } = {}) {
  if (typeof value !== 'string' || !value || value.length > 160 || !patternText.test(value) || /^\.+$/.test(value)) {
    throw new Error(`${label} may contain only file-name characters, {repo} and {version}.`);
  }
  if (!value.includes('{repo}')) throw new Error(`${label} must contain {repo}.`);
  if (requireVersion && !value.includes('{version}')) throw new Error(`${label} must contain {version}.`);
  return value;
}

function expand(pattern, repo, version) {
  return pattern.replace(/\{repo\}/g, repo).replace(/\{version\}/g, version);
}

/**
 * The executable's place inside the archive: `<folder>/<file>.exe`, or just `<file>.exe` when the
 * archive has no top-level folder. Each part is a pattern, and each expands to a safe leaf name, so
 * no expansion can climb out of the version folder it is installed into.
 */
function validateExecutable(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  const parts = value.split('/');
  if (parts.length < 1 || parts.length > 2) throw new Error(`${label} is a file name, or one folder and a file name.`);
  parts.forEach((part, index) => validatePattern(part, `${label} part ${index + 1}`));
  if (!/\.exe$/i.test(parts.at(-1))) throw new Error(`${label} must name a Windows .exe.`);
  return value;
}

function validateApp(entry, label, owner) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`${label} must be an object.`);
  if (!idPattern.test(String(entry.id || ''))) throw new Error(`${label}: id must be a lowercase identifier.`);
  const repo = String(entry.repo || '');
  if (!repoPattern.test(repo) || repo.endsWith('.git') || /\.\./.test(repo)) throw new Error(`${entry.id}: repo is not a GitHub repository name.`);
  const assetNames = entry.assetNames === undefined ? [repo] : entry.assetNames;
  if (!Array.isArray(assetNames) || !assetNames.length || assetNames.length > 5
    || !assetNames.every((name) => typeof name === 'string' && repoPattern.test(name) && !/\.\./.test(name))) {
    throw new Error(`${entry.id}: assetNames must be a short list of release file-name prefixes.`);
  }
  return {
    id: entry.id,
    repo,
    owner,
    name: cleanText(entry.name, `${entry.id}: name`, { max: 40 }),
    description: cleanText(entry.description, `${entry.id}: description`, { required: false }),
    assetNames: [...new Set(assetNames)],
  };
}

/**
 * A source definition, checked strictly. Anything that could produce a path outside the version
 * folder, a host other than github.com, or an ambiguous app ID is refused here, before any request.
 */
function validateSource(input, label = 'source') {
  if (!input || typeof input !== 'object' || input.schemaVersion !== 1) throw new Error(`${label}: schemaVersion must be 1.`);
  if (!idPattern.test(String(input.id || ''))) throw new Error(`${label}: id must be a lowercase identifier.`);
  const owner = String(input.owner || '');
  if (!ownerPattern.test(owner)) throw new Error(`${input.id}: owner is not a GitHub account name.`);
  const licence = String(input.licence || '');
  if (!licencePattern.test(licence)) throw new Error(`${input.id}: licence must be an SPDX identifier.`);
  const release = input.release;
  if (!release || typeof release !== 'object') throw new Error(`${input.id}: release is required.`);
  const asset = validatePattern(release.asset, `${input.id}: release.asset`, { requireVersion: true });
  if (!/\.zip$/i.test(asset)) throw new Error(`${input.id}: release.asset must be a .zip archive.`);
  const checksums = String(release.checksums || '');
  if (!/^[A-Za-z0-9._-]+$/.test(checksums) || !safeLeaf(checksums)) throw new Error(`${input.id}: release.checksums must be a file name.`);
  const executable = validateExecutable(release.executable, `${input.id}: release.executable`);
  const discovery = input.discovery && typeof input.discovery === 'object' ? input.discovery : {};
  const maxCandidates = discovery.maxCandidates === undefined ? 10 : discovery.maxCandidates;
  if (!Number.isInteger(maxCandidates) || maxCandidates < 0 || maxCandidates > 30) throw new Error(`${input.id}: discovery.maxCandidates must be 0 to 30.`);
  if (discovery.licence !== undefined && !licencePattern.test(String(discovery.licence))) throw new Error(`${input.id}: discovery.licence must be an SPDX identifier.`);
  if (!Array.isArray(input.apps) || !input.apps.length) throw new Error(`${input.id}: apps must list at least one app.`);
  const apps = input.apps.map((entry, index) => validateApp(entry, `${input.id}: apps[${index}]`, owner));
  const ids = new Set();
  const repos = new Set();
  for (const app of apps) {
    if (ids.has(app.id)) throw new Error(`${input.id}: duplicate app id ${app.id}.`);
    if (repos.has(app.repo.toLowerCase())) throw new Error(`${input.id}: duplicate repository ${app.repo}.`);
    ids.add(app.id);
    repos.add(app.repo.toLowerCase());
  }
  return {
    id: input.id,
    name: cleanText(input.name, `${input.id}: name`, { max: 60 }),
    collection: cleanText(input.collection, `${input.id}: collection`, { required: false, max: 60 }),
    owner,
    licence,
    release: { asset, checksums, executable },
    discovery: { enabled: discovery.enabled === true, licence: discovery.licence ? String(discovery.licence) : licence, maxCandidates },
    apps,
  };
}

/**
 * Every source file in `directory`, validated. App IDs share one namespace across all sources, so
 * an app is addressed by its ID alone; a second source reusing one is refused. A missing directory
 * is no sources rather than an error.
 */
function loadSources(directory, options = {}) {
  const reader = options.fs || fs;
  let names;
  try {
    names = reader.readdirSync(directory).filter((name) => /^[a-z][a-z0-9-]*\.json$/.test(name)).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const sources = [];
  const appIds = new Map();
  for (const name of names) {
    const parsed = JSON.parse(reader.readFileSync(path.join(directory, name), 'utf8').replace(/^﻿/, ''));
    const source = validateSource(parsed, name);
    if (`${source.id}.json` !== name) throw new Error(`${name}: the file name must be the source id.`);
    for (const app of source.apps) {
      if (appIds.has(app.id)) throw new Error(`${name}: app id ${app.id} is already used by ${appIds.get(app.id)}.`);
      appIds.set(app.id, source.id);
    }
    sources.push(source);
  }
  return sources;
}

// ---- Release files ----------------------------------------------------------------------------

/**
 * A `sha256sum` listing as `Map<file name, lowercase digest>`. Accepts the text and binary markers
 * (`<hex>  name`, `<hex> *name`) and CRLF line ends. Lines that are not a digest and a plain file
 * name are skipped, and a name listed twice with different digests is dropped: an ambiguous digest
 * verifies nothing.
 */
function parseChecksums(text) {
  const result = new Map();
  const conflicted = new Set();
  for (const line of String(text || '').replace(/^﻿/, '').split(/\r?\n/)) {
    const match = line.match(/^([0-9a-fA-F]{64}) [ *](.+)$/);
    if (!match) continue;
    const name = match[2].trim();
    if (!safeLeaf(name) || !digestPattern.test(match[1])) continue;
    const digest = match[1].toLowerCase();
    if (result.has(name) && result.get(name) !== digest) conflicted.add(name);
    result.set(name, digest);
  }
  for (const name of conflicted) result.delete(name);
  return result;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The Windows archive in a release's checksum listing for one app, or null when there is none. The
 * app's own repository name is tried first, then each older name its releases went by (pdfcraft's
 * were once printcraft-*). The tag's version is preferred; failing that, the one archive whose name
 * carries a version is taken. Two candidates with different versions and none matching the tag is
 * ambiguous, and ambiguous is "nothing installable", never a guess.
 */
function matchAsset(source, app, checksums, tag = '') {
  const tagVersion = String(tag).replace(/^v/i, '');
  for (const name of app.assetNames) {
    const [before, after] = source.release.asset.replace(/\{repo\}/g, name).split('{version}');
    const pattern = new RegExp(`^${escapeRegExp(before)}([0-9]+\\.[0-9]+\\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?)${escapeRegExp(after ?? '')}$`);
    const found = [];
    for (const [file, sha256] of checksums) {
      const match = file.match(pattern);
      if (match && versionPattern.test(match[1])) found.push({ asset: file, sha256, version: match[1], name });
    }
    const exact = found.find((candidate) => candidate.version === tagVersion);
    if (exact) return exact;
    if (found.length === 1) return found[0];
  }
  return null;
}

/**
 * The release manifest for one archive, in the shape every Instrumenta release takes, validated by
 * the same function a published manifest goes through. The archive's single top-level folder is
 * recorded as `root` beside the manifest (validateReleaseManifest keeps only what it knows), and the
 * entry is the executable's leaf name: the folder is lifted out on extraction, so the version folder
 * holds the app's files directly. `minimumInstrumentaVersion` is 0.0.0 because this launcher wrote
 * the manifest itself.
 */
function synthesizeManifest(source, app, match, size) {
  const [first, second] = source.release.executable.split('/');
  const root = second === undefined ? '' : expand(first, match.name, match.version);
  const entry = expand(second === undefined ? first : second, match.name, match.version);
  if ((root && !safeLeaf(root)) || !safeLeaf(entry) || !safeLeaf(match.asset)) throw new Error(`${app.id}: the release names an unsafe file.`);
  const manifest = validateReleaseManifest({
    schemaVersion: 1,
    product: app.id,
    version: match.version,
    platform: 'windows-x64',
    minimumInstrumentaVersion: '0.0.0',
    installStrategy: 'managed-bundle',
    bundle: { asset: match.asset, size, sha256: match.sha256, entry },
  }, app.id);
  return { manifest, root };
}

// The archive folder a validated manifest's asset was packed in, worked out again from the source:
// the update cache keeps only the validated manifest, which has no room for it.
function archiveRootFor(source, app, manifest) {
  const [first, second] = source.release.executable.split('/');
  if (second === undefined) return '';
  for (const name of app.assetNames) {
    if (expand(source.release.asset, name, manifest.version) === manifest.bundle.asset) {
      const root = expand(first, name, manifest.version);
      return safeLeaf(root) ? root : '';
    }
  }
  return '';
}

// ---- Network ----------------------------------------------------------------------------------

function headTransport(url, { headers = {}, timeoutMs = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    const handle = https.request(url, { method: 'HEAD', headers }, resolve);
    handle.setTimeout(timeoutMs, () => handle.destroy(new Error('Release request timed out.')));
    handle.once('error', reject);
    handle.end();
  });
}

function failure(response, what, options) {
  const now = typeof options.now === 'function' ? options.now() : Date.now();
  const blockedUntil = rateLimitedUntil(response, now);
  if (blockedUntil) return new RateLimitedError(blockedUntil);
  const error = new Error(`${what} failed with HTTP ${response.statusCode}.`);
  error.statusCode = response.statusCode;
  return error;
}

async function fetchText(url, options, maximum) {
  const response = await request(url, { ...options, accept: options.accept || 'application/octet-stream' });
  if (response.statusCode !== 200) {
    response.resume?.();
    throw failure(response, 'GitHub release request', options);
  }
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
  return Buffer.concat(chunks).toString('utf8');
}

function repositoryPath(owner, repo) {
  return `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

// The tag a `releases/latest` redirect landed on: `github.com/<owner>/<repo>/releases/tag/<tag>`.
function tagFromLatestRedirect(urls, owner, repo) {
  const prefix = `/${owner}/${repo}/releases/tag/`.toLowerCase();
  for (const value of urls) {
    let url;
    try { url = new URL(value); } catch { continue; }
    if (url.hostname.toLowerCase() !== 'github.com' || !url.pathname.toLowerCase().startsWith(prefix)) continue;
    try {
      const tag = url.pathname.slice(prefix.length).split('/').map((segment) => decodeURIComponent(segment)).join('/');
      if (tag && !/[\x00-\x1f]/.test(tag)) return tag;
    } catch {
      // A malformed escape is not a tag.
    }
  }
  return '';
}

/**
 * The newest stable release's tag, from where `releases/latest` redirects. A repository with no
 * release redirects to its release list instead, which is "nothing published" (NoReleaseError).
 */
async function latestTag(owner, repo, options = {}) {
  const head = options.headTransport || headTransport;
  const response = await request(`https://github.com/${repositoryPath(owner, repo)}/releases/latest`, { ...options, transport: head, accept: 'text/html' });
  response.resume?.();
  if (response.statusCode === 404) throw new NoReleaseError();
  if (response.statusCode !== 200) throw failure(response, 'GitHub latest release', options);
  const tag = tagFromLatestRedirect([...(response.redirects || []), response.url], owner, repo);
  if (!tag) throw new NoReleaseError();
  return tag;
}

// An asset's size: a HEAD that follows GitHub's redirect to its object store, whose answer carries
// Content-Length. The REST API's asset list is the fallback when it does not.
async function assetSize(owner, repo, tag, asset, options = {}) {
  const head = options.headTransport || headTransport;
  const url = assetUrl({ provider: 'github', owner, name: repo }, tag, asset);
  try {
    const response = await request(url, { ...options, transport: head, accept: 'application/octet-stream' });
    response.resume?.();
    if (response.statusCode === 200) {
      const length = String(response.headers?.['content-length'] ?? '');
      if (/^\d+$/.test(length) && Number(length) > 0 && Number.isSafeInteger(Number(length))) return Number(length);
    } else if (rateLimitedUntil(response)) {
      throw failure(response, `${asset} size`, options);
    }
  } catch (error) {
    if (error.code === 'RATE_LIMITED') throw error;
  }
  const body = await fetchText(
    `https://api.github.com/repos/${repositoryPath(owner, repo)}/releases/tags/${encodeURIComponent(tag)}`,
    { ...options, accept: 'application/vnd.github+json' },
    MAX_LISTING_BYTES,
  );
  const listed = (JSON.parse(body).assets || []).find((item) => item && item.name === asset);
  if (!listed || !Number.isSafeInteger(listed.size) || listed.size <= 0) throw new Error(`${asset} has no published size.`);
  return listed.size;
}

/**
 * The newest installable release of one external app, as `{ manifest, tag, root }`: the shape the
 * update cache and installLatestProduct take. A release with no Windows archive this source can
 * install is "no installable release" (NoReleaseError, cached like an unpublished one), never a
 * crash.
 */
async function resolveLatest(source, app, options = {}) {
  const tag = await latestTag(source.owner, app.repo, options);
  const checksumName = expand(source.release.checksums, app.repo, tag.replace(/^v/i, ''));
  let text;
  try {
    text = await fetchText(assetUrl({ provider: 'github', owner: source.owner, name: app.repo }, tag, checksumName), options, MAX_CHECKSUMS_BYTES);
  } catch (error) {
    if (error.statusCode === 404) throw new NoReleaseError(`${app.name}'s latest release (${tag}) has no ${checksumName}.`);
    throw error;
  }
  const match = matchAsset(source, app, parseChecksums(text), tag);
  if (!match) throw new NoReleaseError(`${app.name}'s latest release (${tag}) has no Windows x64 portable build.`);
  const size = await assetSize(source.owner, app.repo, tag, match.asset, options);
  const { manifest, root } = synthesizeManifest(source, app, match, size);
  return { manifest, tag, root };
}

// ---- Discovery --------------------------------------------------------------------------------

const DISCOVERY_FILE = 'discovery.json';

function readDiscovery(cacheRoot) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(cacheRoot, DISCOVERY_FILE), 'utf8').replace(/^﻿/, ''));
    return parsed && parsed.schemaVersion === 1 && parsed.sources && typeof parsed.sources === 'object' ? parsed.sources : {};
  } catch {
    return {};
  }
}

function writeDiscovery(cacheRoot, sources) {
  fs.mkdirSync(cacheRoot, { recursive: true });
  const target = path.join(cacheRoot, DISCOVERY_FILE);
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify({ schemaVersion: 1, sources }, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, target);
}

/**
 * Which of an owner's repositories might be apps the curated list does not have yet: public, not a
 * fork, not archived, under the source's licence, named like a repository, and not already listed,
 * added or dismissed. Pure; whether each one actually has an installable release is asked after.
 */
function discoveryCandidates(source, repositories, { known = [], dismissed = [] } = {}) {
  const skip = new Set([...source.apps.map((app) => app.repo), ...known, ...dismissed].map((name) => String(name).toLowerCase()));
  return (Array.isArray(repositories) ? repositories : [])
    .filter((repo) => repo && typeof repo.name === 'string' && repoPattern.test(repo.name) && !/\.\./.test(repo.name))
    .filter((repo) => !repo.fork && !repo.archived && !repo.private && !repo.disabled)
    .filter((repo) => String(repo.license?.spdx_id || '') === source.discovery.licence)
    .filter((repo) => !skip.has(repo.name.toLowerCase()))
    .sort((a, b) => String(b.pushed_at || '').localeCompare(String(a.pushed_at || '')))
    .slice(0, source.discovery.maxCandidates)
    .map((repo) => ({ repo: repo.name, description: cleanText(repo.description || '', 'description', { required: false }) }));
}

// A display name for a discovered app: its repository name with the first letter capitalised.
function suggestedName(repo) {
  const text = String(repo).replace(/[-_]+/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// What an app discovered and added by the person looks like as a library app: the same shape and
// the same validation as a curated one, so a hand-edited settings file can name nothing unsafe.
function discoveredApp(source, entry, takenIds = new Set()) {
  const repo = String(entry?.repo || '');
  const id = repo.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^[^a-z]+/, '').slice(0, 40);
  if (!idPattern.test(id) || takenIds.has(id)) return null;
  try {
    return { ...validateApp({ id, repo, name: entry.name || suggestedName(repo), description: entry.description || '' }, `${source.id}: added app`, source.owner), discovered: true };
  } catch {
    return null;
  }
}

/**
 * Looks for new apps from each source that has discovery on, at most once per `ttl` per source:
 * the owner's repository list is the one REST request (sixty an hour is GitHub's allowance, and this
 * spends one per source per six hours), and each candidate's latest release is then checked the
 * no-REST way. Only a candidate whose release holds an archive this source can install is
 * suggested. A rate limit holds the source until GitHub says; any other failure keeps the last list.
 */
async function refreshDiscovery({ sources, cacheRoot, known = {}, dismissed = {}, now = Date.now(), ttl, options = {} }) {
  const cache = readDiscovery(cacheRoot);
  let touched = false;
  for (const source of sources) {
    if (!source.discovery.enabled) continue;
    const entry = cache[source.id] && typeof cache[source.id] === 'object' ? cache[source.id] : {};
    if (Number(entry.blockedUntil) > now) continue;
    if (Number.isSafeInteger(entry.checkedAt) && now - entry.checkedAt < ttl) continue;
    touched = true;
    try {
      const body = await fetchText(
        `https://api.github.com/users/${encodeURIComponent(source.owner)}/repos?per_page=100&sort=pushed`,
        { ...options, accept: 'application/vnd.github+json' },
        MAX_LISTING_BYTES,
      );
      const candidates = discoveryCandidates(source, JSON.parse(body), { known: known[source.id] || [], dismissed: dismissed[source.id] || [] });
      const suggestions = [];
      for (const candidate of candidates) {
        const app = discoveredApp(source, candidate);
        if (!app) continue;
        try {
          const latest = await resolveLatest(source, app, options);
          suggestions.push({ repo: candidate.repo, description: candidate.description, version: latest.manifest.version });
        } catch (error) {
          if (error.code === 'RATE_LIMITED') throw error;
          // No installable release: not a suggestion.
        }
      }
      cache[source.id] = { checkedAt: now, blockedUntil: 0, suggestions };
    } catch (error) {
      cache[source.id] = error.code === 'RATE_LIMITED'
        ? { ...entry, blockedUntil: error.blockedUntil }
        : { ...entry, checkedAt: Number.isSafeInteger(entry.checkedAt) ? entry.checkedAt : 0, failedAt: now };
    }
  }
  if (touched) writeDiscovery(cacheRoot, cache);
  return cache;
}

function cachedSuggestions(cacheRoot, sourceId) {
  const entry = readDiscovery(cacheRoot)[sourceId];
  return Array.isArray(entry?.suggestions)
    ? entry.suggestions.filter((item) => item && typeof item.repo === 'string' && repoPattern.test(item.repo))
    : [];
}

module.exports = {
  ADAPTER,
  archiveRootFor,
  cachedSuggestions,
  discoveredApp,
  discoveryCandidates,
  headTransport,
  latestTag,
  loadSources,
  matchAsset,
  parseChecksums,
  readDiscovery,
  refreshDiscovery,
  resolveLatest,
  suggestedName,
  synthesizeManifest,
  tagFromLatestRedirect,
  validateSource,
};
