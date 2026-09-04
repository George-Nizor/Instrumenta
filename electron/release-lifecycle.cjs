'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
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
  if (!['managed-bundle', 'managed-web', 'installed-desktop'].includes(manifest.installStrategy)) {
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
  if (manifest.installStrategy === 'managed-bundle' || manifest.installStrategy === 'managed-web') {
    normalized.bundle = {
      ...validateFileSpec(manifest.bundle, 'bundle'),
      entry: String(manifest.bundle.entry || ''),
    };
    safeLeaf(normalized.bundle.entry, 'bundle.entry');
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
  if (fs.existsSync(target) || fs.existsSync(temporary)) throw new Error('Refusing to replace an existing assembled payload.');
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

function installManagedDirectory({ sourceRoot, installRoot, manifest: manifestInput }) {
  const manifest = validateReleaseManifest(manifestInput);
  if (!['managed-bundle', 'managed-web'].includes(manifest.installStrategy)) {
    throw new Error('Expected a managed-bundle or managed-web release manifest.');
  }
  const source = path.resolve(sourceRoot);
  assertTreeSafe(source);
  const entry = path.resolve(source, manifest.bundle.entry);
  if (!within(source, entry) || !fs.statSync(entry).isFile()) throw new Error('Managed bundle entry is missing or escaped its root.');
  const productRoot = path.join(path.resolve(installRoot), manifest.product);
  const versionsRoot = path.join(productRoot, 'versions');
  const destination = path.join(versionsRoot, manifest.version);
  if (fs.existsSync(destination)) throw new Error(`${manifest.product} ${manifest.version} is already installed.`);
  fs.mkdirSync(versionsRoot, { recursive: true });
  const staging = `${destination}.staging-${process.pid}`;
  if (fs.existsSync(staging)) throw new Error('Managed bundle staging directory already exists.');
  try {
    fs.cpSync(source, staging, { recursive: true, errorOnExist: true, force: false });
    fs.writeFileSync(path.join(staging, 'instrumenta-release.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    fs.renameSync(staging, destination);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  const prior = readPointer(productRoot);
  writePointer(productRoot, { current: manifest.version, previous: prior.current || prior.previous || '', pending: true });
  return { productRoot, destination, executable: path.join(destination, manifest.bundle.entry), pointer: readPointer(productRoot) };
}

function resolveManagedInstall(installRoot, productId) {
  if (!idPattern.test(String(productId || ''))) return null;
  const productRoot = path.join(path.resolve(installRoot), productId);
  const pointer = readPointer(productRoot);
  if (!pointer.current) return null;
  const root = path.join(productRoot, 'versions', pointer.current);
  const manifestFile = path.join(root, 'instrumenta-release.json');
  try {
    const manifest = validateReleaseManifest(JSON.parse(fs.readFileSync(manifestFile, 'utf8')), productId);
    const executable = path.resolve(root, manifest.bundle.entry);
    if (!within(root, executable) || !fs.statSync(executable).isFile()) return null;
    return {
      root, executable, version: manifest.version, strategy: manifest.installStrategy,
      pending: pointer.pending, previous: pointer.previous,
    };
  } catch {
    return null;
  }
}

function confirmManagedVersion(installRoot, productId) {
  const productRoot = path.join(path.resolve(installRoot), productId);
  const pointer = readPointer(productRoot);
  if (!pointer.current) return pointer;
  writePointer(productRoot, { ...pointer, pending: false });
  return readPointer(productRoot);
}

function rollbackManagedVersion(installRoot, productId) {
  const productRoot = path.join(path.resolve(installRoot), productId);
  const pointer = readPointer(productRoot);
  if (!pointer.pending || !pointer.previous) throw new Error('No pending managed version can be rolled back.');
  writePointer(productRoot, { current: pointer.previous, previous: pointer.current, pending: false });
  return readPointer(productRoot);
}

module.exports = {
  assemblePayload,
  confirmManagedVersion,
  installManagedDirectory,
  readPointer,
  resolveManagedInstall,
  rollbackManagedVersion,
  sha256File,
  validateReleaseManifest,
  verifyFile,
  within,
};
