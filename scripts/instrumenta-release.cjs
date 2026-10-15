#!/usr/bin/env node
'use strict';

// Writes the instrumenta-release.json a GitHub release carries, from the files it will attach.
// Every size and SHA-256 is measured here, never typed, and the result goes through the same
// validator the launcher installs with: a manifest this writes is one the launcher accepts.
//
//   node scripts/instrumenta-release.cjs --product ludere --version 0.2.0 --strategy managed-web \
//     --bundle release/ludere-0.2.0.zip --entry index.html --out release/instrumenta-release.json
//
//   node scripts/instrumenta-release.cjs --product instrumenta --version 0.10.0 --strategy launcher \
//     --installer release/Instrumenta-Setup-0.10.0.exe --out release/instrumenta-release.json
//
//   node scripts/instrumenta-release.cjs --product discere --version 0.3.0 --strategy managed-service \
//     --bundle release/discere-0.3.0.zip --service-root release/discere-0.3.0 --out release/instrumenta-release.json
//
// managed-bundle takes --bundle and --entry (the executable inside it). managed-service takes
// --bundle, and its entry defaults to package.json, the file that marks the bundle root; what
// starts the service is the bundle's own instrumenta/product.json. --service-root, the folder the
// zip was made from, has that product.json checked the way the launcher checks it before it
// installs, so a release it would refuse fails here instead. installed-desktop takes
// --installer, --payload-asset (the name the chunks assemble into) and --chunk once per chunk, in
// order. --minimum is the oldest launcher that can install the release; it defaults to the version
// of the launcher checkout this script runs from, the launcher the release is made alongside.
// The release workflows (.github/workflows) are its callers.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { validateReleaseManifest } = require('../electron/release-lifecycle.cjs');
const { validateManifest } = require('./product-registry.cjs');
const { isNewer } = require('../electron/update-check.cjs');

const launcherVersion = () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;

function sha256(file) {
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

// A release asset as the manifest names it: the file's leaf name, as uploaded, and what it measures.
function fileSpec(file) {
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error(`${file} is not a file.`);
  return { asset: path.basename(file), size: stat.size, sha256: sha256(file) };
}

// The chunks, read in order as one stream: the payload they assemble into.
function assembledSpec(name, chunks) {
  const hash = crypto.createHash('sha256');
  let size = 0;
  for (const chunk of chunks) {
    const descriptor = fs.openSync(chunk, 'r');
    const buffer = Buffer.allocUnsafe(8 * 1024 * 1024);
    try {
      let bytes;
      while ((bytes = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
        hash.update(buffer.subarray(0, bytes));
        size += bytes;
      }
    } finally {
      fs.closeSync(descriptor);
    }
  }
  return { assembledAsset: name, size, sha256: hash.digest('hex') };
}

const DEFAULT_ENTRY = Object.freeze({ 'managed-web': 'index.html', 'managed-service': 'package.json' });
// The first launcher that can install each strategy. A release declaring an older minimum would be
// offered to launchers that refuse it, so that is a mistake in the release, caught here.
const STRATEGY_MINIMUM = Object.freeze({ 'managed-service': '0.15.0' });

function buildReleaseManifest({ product, version, strategy, bundle, entry, installer, payloadAsset, chunks = [], minimum, platform = 'windows-x64', notes = '', serviceRoot = '' }) {
  const manifest = {
    schemaVersion: 1,
    product,
    version,
    platform,
    minimumInstrumentaVersion: minimum || launcherVersion(),
    installStrategy: strategy,
  };
  // "What's new" for the launcher: plain text, usually the release tag's message.
  if (notes) manifest.notes = notes;
  if (['managed-bundle', 'managed-web', 'managed-service'].includes(strategy)) {
    if (!bundle) throw new Error(`${strategy} needs --bundle.`);
    manifest.bundle = { ...fileSpec(bundle), entry: entry || DEFAULT_ENTRY[strategy] || '' };
    if (serviceRoot) {
      if (strategy !== 'managed-service') throw new Error('--service-root only applies to managed-service.');
      assertServiceRoot(serviceRoot, product, version, manifest.bundle.entry);
    }
  } else if (strategy === 'launcher') {
    if (!installer) throw new Error('launcher needs --installer.');
    manifest.installer = fileSpec(installer);
  } else if (strategy === 'installed-desktop') {
    if (!installer || !payloadAsset || !chunks.length) throw new Error('installed-desktop needs --installer, --payload-asset and at least one --chunk.');
    manifest.installer = fileSpec(installer);
    manifest.payload = { ...assembledSpec(payloadAsset, chunks), chunks: chunks.map(fileSpec) };
  }
  const floor = STRATEGY_MINIMUM[strategy];
  if (floor && isNewer(floor, manifest.minimumInstrumentaVersion)) {
    throw new Error(`${strategy} releases need --minimum ${floor} or newer; Instrumenta before ${floor} cannot install them.`);
  }
  // The launcher's own rules, so a mistake fails the release and not someone's install.
  return validateReleaseManifest(manifest, product);
}

// The unzipped bundle, checked as the launcher will check it once extracted: its entry is there,
// its package.json carries this version, and its instrumenta/product.json starts a service from
// an executable inside it.
function assertServiceRoot(root, product, version, entry) {
  const resolved = path.resolve(root);
  if (!fs.existsSync(path.join(resolved, entry))) throw new Error(`${root} has no ${entry} at its root.`);
  const packageVersion = JSON.parse(fs.readFileSync(path.join(resolved, 'package.json'), 'utf8').replace(/^\uFEFF/, '')).version;
  if (packageVersion !== version) throw new Error(`${root}/package.json says ${packageVersion}, not ${version}.`);
  const manifest = JSON.parse(fs.readFileSync(path.join(resolved, 'instrumenta', 'product.json'), 'utf8').replace(/^\uFEFF/, ''));
  validateManifest(manifest, resolved, { id: product, adapter: 'managed-service' }, { managedInstall: true });
}

function parseArguments(argv) {
  const options = { chunks: [] };
  const names = { '--product': 'product', '--version': 'version', '--strategy': 'strategy', '--bundle': 'bundle', '--entry': 'entry', '--installer': 'installer', '--payload-asset': 'payloadAsset', '--minimum': 'minimum', '--platform': 'platform', '--out': 'out', '--notes-file': 'notesFile', '--service-root': 'serviceRoot' };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === '--chunk') { options.chunks.push(value); index += 1; continue; }
    if (!names[flag] || value === undefined) throw new Error(`Unknown or incomplete option ${flag}.`);
    options[names[flag]] = value;
    index += 1;
  }
  for (const required of ['product', 'version', 'strategy', 'out']) {
    if (!options[required]) throw new Error(`--${required} is required.`);
  }
  return options;
}

if (require.main === module) {
  try {
    const options = parseArguments(process.argv.slice(2));
    // A missing or empty notes file means no notes, never a failed release.
    if (options.notesFile && fs.existsSync(options.notesFile)) options.notes = fs.readFileSync(options.notesFile, 'utf8').trim();
    const manifest = buildReleaseManifest(options);
    fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true });
    fs.writeFileSync(options.out, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`${options.out}: ${manifest.product} ${manifest.version}, ${manifest.installStrategy}, needs Instrumenta ${manifest.minimumInstrumentaVersion}+`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { STRATEGY_MINIMUM, buildReleaseManifest, fileSpec, parseArguments };
