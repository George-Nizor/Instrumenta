#!/usr/bin/env node
'use strict';

// Writes the instrumenta-release.json a GitHub release carries, from the files it will attach.
// Every size and SHA-256 is measured here, never typed, and the result goes through the same
// validator the launcher installs with: a manifest this writes is one the launcher accepts.
//
//   node scripts/instrumenta-release.cjs --product imago --version 0.2.0 --strategy managed-web \
//     --bundle release/imago-0.2.0.zip --entry index.html --out release/instrumenta-release.json
//
//   node scripts/instrumenta-release.cjs --product instrumenta --version 0.10.0 --strategy launcher \
//     --installer release/Instrumenta-Setup-0.10.0.exe --out release/instrumenta-release.json
//
// managed-bundle takes --bundle and --entry (the executable inside it). installed-desktop takes
// --installer, --payload-asset (the name the chunks assemble into) and --chunk once per chunk, in
// order. --minimum is the oldest launcher that can install the release; it defaults to the version
// of the launcher checkout this script runs from, the launcher the release is made alongside.
// The release workflows (.github/workflows) are its callers.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { validateReleaseManifest } = require('../electron/release-lifecycle.cjs');

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

function buildReleaseManifest({ product, version, strategy, bundle, entry, installer, payloadAsset, chunks = [], minimum, platform = 'windows-x64' }) {
  const manifest = {
    schemaVersion: 1,
    product,
    version,
    platform,
    minimumInstrumentaVersion: minimum || launcherVersion(),
    installStrategy: strategy,
  };
  if (strategy === 'managed-bundle' || strategy === 'managed-web') {
    if (!bundle) throw new Error(`${strategy} needs --bundle.`);
    manifest.bundle = { ...fileSpec(bundle), entry: entry || (strategy === 'managed-web' ? 'index.html' : '') };
  } else if (strategy === 'launcher') {
    if (!installer) throw new Error('launcher needs --installer.');
    manifest.installer = fileSpec(installer);
  } else if (strategy === 'installed-desktop') {
    if (!installer || !payloadAsset || !chunks.length) throw new Error('installed-desktop needs --installer, --payload-asset and at least one --chunk.');
    manifest.installer = fileSpec(installer);
    manifest.payload = { ...assembledSpec(payloadAsset, chunks), chunks: chunks.map(fileSpec) };
  }
  // The launcher's own rules, so a mistake fails the release and not someone's install.
  return validateReleaseManifest(manifest, product);
}

function parseArguments(argv) {
  const options = { chunks: [] };
  const names = { '--product': 'product', '--version': 'version', '--strategy': 'strategy', '--bundle': 'bundle', '--entry': 'entry', '--installer': 'installer', '--payload-asset': 'payloadAsset', '--minimum': 'minimum', '--platform': 'platform', '--out': 'out' };
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
    const manifest = buildReleaseManifest(options);
    fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true });
    fs.writeFileSync(options.out, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`${options.out}: ${manifest.product} ${manifest.version}, ${manifest.installStrategy}, needs Instrumenta ${manifest.minimumInstrumentaVersion}+`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { buildReleaseManifest, fileSpec, parseArguments };
