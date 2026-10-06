'use strict';

const crypto = require('node:crypto');
// Unpatched by Electron's asar support; see plain-fs.cjs.
const fs = require('./plain-fs.cjs');
const path = require('node:path');

const idPattern = /^[a-z][a-z0-9-]*$/;
const versionPattern = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;
const digestPattern = /^[0-9a-f]{64}$/;

function within(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (
    relative
    && relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

function safeLeaf(value, label) {
  if (typeof value !== 'string' || !value || /[\x00-\x1f]/.test(value)
    || path.basename(value) !== value || path.win32.basename(value) !== value) {
    throw new Error(`${label} must be a safe file name.`);
  }
  return value;
}

function validateFileSpec(spec, label) {
  if (!spec || typeof spec !== 'object') throw new Error(`${label} is required.`);
  const asset = safeLeaf(spec.asset, `${label}.asset`);
  if (!Number.isSafeInteger(spec.size) || spec.size < 0) throw new Error(`${label}.size must be a non-negative integer.`);
  const sha256 = String(spec.sha256 || '').toLowerCase();
  if (!digestPattern.test(sha256)) throw new Error(`${label}.sha256 must be a SHA-256 digest.`);
  return { asset, size: spec.size, sha256 };
}

const NOTES_LIMIT = 4000;
function releaseNotesText(value) {
  if (typeof value !== 'string') return '';
  // Control characters out (tabs and newlines stay), line endings normalised, length capped.
  const text = value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim();
  return text.length > NOTES_LIMIT ? `${text.slice(0, NOTES_LIMIT - 1).trimEnd()}\u2026` : text;
}

function validateReleaseManifest(manifest, expectedProduct = '') {
  if (!manifest || manifest.schemaVersion !== 1) throw new Error('Release manifest schemaVersion must be 1.');
  if (!idPattern.test(String(manifest.product || ''))) throw new Error('Release manifest product ID is invalid.');
  if (expectedProduct && manifest.product !== expectedProduct) throw new Error('Release manifest product does not match the requested product.');
  if (!versionPattern.test(String(manifest.version || ''))) throw new Error('Release manifest version is invalid.');
  if (manifest.platform !== 'windows-x64') throw new Error('Release manifest platform must be windows-x64.');
  if (!versionPattern.test(String(manifest.minimumInstrumentaVersion || ''))) {
    throw new Error('Release manifest minimumInstrumentaVersion is invalid.');
  }
  // managed-web ships a built web bundle instead of an executable; the download,
  // verification and atomic-install path is deliberately identical, so a web product
  // gets the same checksum and rollback guarantees an executable does.
  // launcher is Instrumenta itself: its own setup program and nothing beside it, run by the
  // launcher's self-update (self-update.cjs), never installed as a product.
  if (!['managed-bundle', 'managed-web', 'installed-desktop', 'launcher'].includes(manifest.installStrategy)) {
    throw new Error('Release manifest installStrategy is unsupported.');
  }

  const normalized = {
    schemaVersion: 1,
    product: manifest.product,
    version: manifest.version,
    platform: manifest.platform,
    minimumInstrumentaVersion: manifest.minimumInstrumentaVersion,
    installStrategy: manifest.installStrategy,
  };
  // Optional release notes, shown as "What's new". Plain text only, and never a reason to refuse
  // a release: notes that are not a string are simply dropped.
  const notes = releaseNotesText(manifest.notes);
  if (notes) normalized.notes = notes;
  if (manifest.installStrategy === 'managed-bundle' || manifest.installStrategy === 'managed-web') {
    normalized.bundle = {
      ...validateFileSpec(manifest.bundle, 'bundle'),
      entry: String(manifest.bundle.entry || ''),
    };
    safeLeaf(normalized.bundle.entry, 'bundle.entry');
  } else if (manifest.installStrategy === 'launcher') {
    if (manifest.product !== 'instrumenta') throw new Error('Only Instrumenta itself is released as the launcher.');
    normalized.installer = validateFileSpec(manifest.installer, 'installer');
  } else {
    normalized.installer = validateFileSpec(manifest.installer, 'installer');
    if (!manifest.payload || typeof manifest.payload !== 'object') throw new Error('payload is required.');
    safeLeaf(manifest.payload.assembledAsset, 'payload.assembledAsset');
    if (!Number.isSafeInteger(manifest.payload.size) || manifest.payload.size < 0) throw new Error('payload.size must be a non-negative integer.');
    const sha256 = String(manifest.payload.sha256 || '').toLowerCase();
    if (!digestPattern.test(sha256)) throw new Error('payload.sha256 must be a SHA-256 digest.');
    if (!Array.isArray(manifest.payload.chunks) || !manifest.payload.chunks.length) throw new Error('payload.chunks must not be empty.');
    normalized.payload = {
      assembledAsset: manifest.payload.assembledAsset,
      size: manifest.payload.size,
      sha256,
      chunks: manifest.payload.chunks.map((chunk, index) => validateFileSpec(chunk, `payload.chunks[${index}]`)),
    };
    const names = new Set(normalized.payload.chunks.map(({ asset }) => asset));
    if (names.size !== normalized.payload.chunks.length) throw new Error('payload chunk names must be unique.');
  }
  return normalized;
}

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(8 * 1024 * 1024);
  try {
    let bytes;
    while ((bytes = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, bytes));
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
}

function verifyFile(file, spec, label = spec.asset) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size !== spec.size) throw new Error(`${label} has the wrong size.`);
  if (sha256File(file) !== spec.sha256) throw new Error(`${label} failed SHA-256 verification.`);
  return file;
}

function assemblePayload(manifestInput, assetsRoot, destination) {
  const manifest = validateReleaseManifest(manifestInput);
  if (manifest.installStrategy !== 'installed-desktop') throw new Error('Only installed-desktop manifests have a multipart payload.');
  const root = path.resolve(assetsRoot);
  const target = path.resolve(destination);
  if (!within(root, target)) throw new Error('Assembled payload must remain inside the download directory.');
  const temporary = `${target}.partial`;
  const payloadSpec = { asset: manifest.payload.assembledAsset, size: manifest.payload.size, sha256: manifest.payload.sha256 };
  // A payload assembled and verified on an earlier attempt is used again. Luna's is 15 GB, and a
  // retry after its installer failed used to stop here with "Refusing to replace an existing
  // assembled payload". One that no longer verifies is rebuilt from its chunks, as is anything an
  // interrupted assembly left behind.
  if (fs.existsSync(target)) {
    try {
      return verifyFile(target, payloadSpec);
    } catch {
      fs.rmSync(target, { force: true });
    }
  }
  fs.rmSync(temporary, { force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const output = fs.openSync(temporary, 'wx');
  let total = 0;
  try {
    for (const chunk of manifest.payload.chunks) {
      const chunkPath = path.join(root, chunk.asset);
      if (!within(root, chunkPath)) throw new Error('Payload chunk escaped the download directory.');
      verifyFile(chunkPath, chunk);
      const input = fs.openSync(chunkPath, 'r');
      const buffer = Buffer.allocUnsafe(8 * 1024 * 1024);
      try {
        let bytes;
        while ((bytes = fs.readSync(input, buffer, 0, buffer.length, null)) > 0) {
          fs.writeSync(output, buffer, 0, bytes);
          total += bytes;
        }
      } finally {
        fs.closeSync(input);
      }
    }
  } catch (error) {
    fs.closeSync(output);
    fs.rmSync(temporary, { force: true });
    throw error;
  }
  fs.closeSync(output);
  if (total !== manifest.payload.size || sha256File(temporary) !== manifest.payload.sha256) {
    fs.rmSync(temporary, { force: true });
    throw new Error('Reassembled payload failed complete-file verification.');
  }
  fs.renameSync(temporary, target);
  return target;
}

function readPointer(productRoot) {
  try {
    const pointer = JSON.parse(fs.readFileSync(path.join(productRoot, 'current.json'), 'utf8').replace(/^\uFEFF/, ''));
    for (const key of ['current', 'previous']) {
      if (pointer[key] !== '' && pointer[key] !== undefined && !versionPattern.test(String(pointer[key]))) {
        throw new Error('Managed product pointer contains an invalid version.');
      }
    }
    return {
      current: String(pointer.current || ''),
      previous: String(pointer.previous || ''),
      pending: Boolean(pointer.pending),
    };
  } catch (error) {
    if (error.code === 'ENOENT') return { current: '', previous: '', pending: false };
    throw error;
  }
}

function writePointer(productRoot, pointer) {
  fs.mkdirSync(productRoot, { recursive: true });
  const file = path.join(productRoot, 'current.json');
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(pointer, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  fs.renameSync(temporary, file);
}

function assertTreeSafe(root) {
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (!within(root, candidate)) throw new Error('Bundle entry escaped its root.');
      const stat = fs.lstatSync(candidate);
      if (stat.isSymbolicLink()) throw new Error('Managed bundles may not contain symbolic links.');
      if (stat.isDirectory()) visit(candidate);
      else if (!stat.isFile()) throw new Error('Managed bundles may contain only files and directories.');
    }
  };
  visit(root);
}

// An installed version folder that is what it says it is: its own release manifest names this
// product and this version, and the entry it declares is a file inside it. Anything else is a
// leftover and is never pointed at.
function validInstalledVersion(productRoot, productId, version) {
  if (!versionPattern.test(String(version || ''))) return null;
  const root = path.join(productRoot, 'versions', version);
  try {
    const manifest = validateReleaseManifest(
      JSON.parse(fs.readFileSync(path.join(root, 'instrumenta-release.json'), 'utf8').replace(/^\uFEFF/, '')),
      productId,
    );
    if (manifest.version !== version || !manifest.bundle) return null;
    const executable = path.resolve(root, manifest.bundle.entry);
    if (!within(root, executable) || !fs.statSync(executable).isFile()) return null;
    return { root, executable, manifest };
  } catch {
    return null;
  }
}

// Makes an installed version current. The version it replaces becomes the previous one, and the
// new current is pending until it opens once. Making the current version current is a no-op.
function activateVersion(productRoot, version) {
  const prior = readPointer(productRoot);
  if (prior.current === version) return prior;
  writePointer(productRoot, { current: version, previous: prior.current || prior.previous || '', pending: true });
  return readPointer(productRoot);
}

function installManagedDirectory({ sourceRoot, installRoot, manifest: manifestInput }) {
  const manifest = validateReleaseManifest(manifestInput);
  if (!['managed-bundle', 'managed-web'].includes(manifest.installStrategy)) {
    throw new Error('Expected a managed-bundle or managed-web release manifest.');
  }
  const productRoot = path.join(path.resolve(installRoot), manifest.product);
  const versionsRoot = path.join(productRoot, 'versions');
  const destination = path.join(versionsRoot, manifest.version);
  // The version is already on disk, most often because the person rolled back from it and is now
  // updating again. It is pointed at rather than copied a second time; installing over it used to
  // fail with "is already installed".
  const existing = validInstalledVersion(productRoot, manifest.product, manifest.version);
  if (existing) {
    const alreadyCurrent = readPointer(productRoot).current === manifest.version;
    const pointer = activateVersion(productRoot, manifest.version);
    return { productRoot, destination, executable: existing.executable, pointer, reused: true, alreadyCurrent };
  }
  const source = path.resolve(sourceRoot);
  assertTreeSafe(source);
  const entry = path.resolve(source, manifest.bundle.entry);
  if (!within(source, entry) || !fs.statSync(entry).isFile()) throw new Error('Managed bundle entry is missing or escaped its root.');
  fs.mkdirSync(versionsRoot, { recursive: true });
  // A folder by this name that is not a valid install is what an interrupted copy leaves. It is
  // moved aside first, so a failure part-way through removing it never leaves a half-folder in
  // the place a valid version belongs.
  if (fs.existsSync(destination)) {
    const discarded = `${destination}.retired-${process.pid}-${Date.now()}`;
    fs.renameSync(destination, discarded);
    fs.rmSync(discarded, { recursive: true, force: true });
  }
  const staging = `${destination}.staging-${process.pid}`;
  fs.rmSync(staging, { recursive: true, force: true });
  try {
    fs.cpSync(source, staging, { recursive: true, errorOnExist: true, force: false });
    fs.writeFileSync(path.join(staging, 'instrumenta-release.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    fs.renameSync(staging, destination);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  const pointer = activateVersion(productRoot, manifest.version);
  return { productRoot, destination, executable: path.join(destination, manifest.bundle.entry), pointer, reused: false, alreadyCurrent: false };
}

// Errors a prune reads as "in use" rather than "broken": Windows refuses to rename a folder while a
// program inside it is running, and says so with one of these.
const IN_USE = new Set(['EBUSY', 'EPERM', 'EACCES']);

/**
 * Removes installed versions other than the current and previous ones, plus what interrupted
 * installs left behind. Each folder is renamed aside before it is deleted, so a version still in
 * use (an old Forge3D left running) fails the rename and is skipped whole, rather than deleted
 * file by file until Windows stops at the locked executable. It is pruned on a later install.
 */
function pruneManagedVersions(installRoot, productId, options = {}) {
  const rename = options.rename || fs.renameSync;
  const remove = options.remove || ((target) => fs.rmSync(target, { recursive: true, force: true }));
  const productRoot = path.join(path.resolve(installRoot), productId);
  const versionsRoot = path.join(productRoot, 'versions');
  const pointer = readPointer(productRoot);
  const keep = new Set([pointer.current, pointer.previous].filter(Boolean));
  let entries;
  try {
    entries = fs.readdirSync(versionsRoot, { withFileTypes: true });
  } catch {
    return { removed: [], busy: [], kept: [...keep] };
  }
  const removed = [];
  const busy = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || keep.has(entry.name)) continue;
    // This process's own staging folder belongs to an install that has not finished.
    if (entry.name.endsWith(`.staging-${process.pid}`)) continue;
    const folder = path.join(versionsRoot, entry.name);
    let target = folder;
    if (!entry.name.includes('.retired-')) {
      target = `${folder}.retired-${process.pid}-${Date.now()}`;
      try {
        rename(folder, target);
      } catch (error) {
        if (IN_USE.has(error.code)) {
          busy.push(entry.name);
          continue;
        }
        throw error;
      }
    }
    try {
      remove(target);
      removed.push(entry.name);
    } catch {
      // Renamed aside, so it is out of every version path already; the next prune retries it.
      busy.push(entry.name);
    }
  }
  return { removed, busy, kept: [...keep] };
}

function resolveManagedInstall(installRoot, productId) {
  if (!idPattern.test(String(productId || ''))) return null;
  const productRoot = path.join(path.resolve(installRoot), productId);
  let pointer;
  try {
    pointer = readPointer(productRoot);
  } catch {
    return null;
  }
  if (!pointer.current) return null;
  const installed = validInstalledVersion(productRoot, productId, pointer.current);
  if (!installed) return null;
  return {
    root: installed.root, executable: installed.executable, version: installed.manifest.version,
    strategy: installed.manifest.installStrategy, pending: pointer.pending, previous: pointer.previous,
  };
}

function confirmManagedVersion(installRoot, productId) {
  const productRoot = path.join(path.resolve(installRoot), productId);
  const pointer = readPointer(productRoot);
  if (!pointer.current) return pointer;
  writePointer(productRoot, { ...pointer, pending: false });
  return readPointer(productRoot);
}

// The automatic rollback after a failed first launch only ever undoes a version still pending.
// A person pressing Roll back may also undo one that did launch: the previous version is kept
// for exactly that, and the tile offers the button whenever there is one.
function rollbackManagedVersion(installRoot, productId, { requirePending = true } = {}) {
  const productRoot = path.join(path.resolve(installRoot), productId);
  const pointer = readPointer(productRoot);
  if (requirePending && (!pointer.pending || !pointer.previous)) throw new Error('No pending managed version can be rolled back.');
  if (!pointer.previous) throw new Error('No previous managed version is installed.');
  if (!validInstalledVersion(productRoot, productId, pointer.previous)) {
    throw new Error(`${productId} ${pointer.previous} is no longer installed, so there is nothing to roll back to.`);
  }
  writePointer(productRoot, { current: pointer.previous, previous: pointer.current, pending: false });
  return readPointer(productRoot);
}

// Gives up the previous version kept for rollback, to free its space (Storage offers this). Not
// while the current version is still pending its first launch: that previous version is the
// automatic rollback's safety net. Deletion goes through pruning, so a folder in use is skipped.
function forgetPreviousVersion(installRoot, productId, options = {}) {
  if (!idPattern.test(String(productId || ''))) throw new Error('Invalid product ID.');
  const productRoot = path.join(path.resolve(installRoot), productId);
  const pointer = readPointer(productRoot);
  if (!pointer.previous) return { removed: [], busy: [], kept: [pointer.current].filter(Boolean) };
  if (pointer.pending) throw new Error(`${productId} ${pointer.current} has not finished its first launch yet. Open it once, then try again.`);
  writePointer(productRoot, { ...pointer, previous: '' });
  return pruneManagedVersions(installRoot, productId, options);
}

module.exports = {
  assemblePayload,
  confirmManagedVersion,
  forgetPreviousVersion,
  installManagedDirectory,
  pruneManagedVersions,
  readPointer,
  releaseNotesText,
  resolveManagedInstall,
  rollbackManagedVersion,
  sha256File,
  validInstalledVersion,
  validateReleaseManifest,
  verifyFile,
  within,
};
