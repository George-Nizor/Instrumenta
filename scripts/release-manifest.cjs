'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { loadCatalog } = require('./product-registry.cjs');

const MANIFEST = 'release-manifest.json';

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function expectedNames(version) {
  return [`Instrumenta-Setup-${version}.exe`, `Instrumenta-Portable-${version}.exe`];
}

function createManifest(directory, version) {
  const artifacts = expectedNames(version).map((name) => {
    const file = path.join(directory, name);
    if (!fs.existsSync(file)) throw new Error(`Missing release artifact: ${name}`);
    return { name, bytes: fs.statSync(file).size, sha256: digest(file) };
  });
  let products = [];
  try {
    products = loadCatalog({ root: path.resolve(__dirname, '..'), allowMissing: true }).products
      .map((product) => ({ id: product.id, displayName: product.displayName, version: product.version || 'unknown', adapter: product.adapter }));
  } catch {
    products = [];
  }
  const manifest = { schemaVersion: 1, product: 'Instrumenta', version, generatedAt: new Date().toISOString(), products, artifacts };
  fs.writeFileSync(path.join(directory, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

function verifyManifest(directory) {
  const file = path.join(directory, MANIFEST);
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  if (manifest.schemaVersion !== 1 || manifest.product !== 'Instrumenta' || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    throw new Error('Invalid Instrumenta release manifest header.');
  }
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length !== 2) {
    throw new Error('Release manifest must list Setup and Portable artifacts.');
  }
  if (!Array.isArray(manifest.products) || manifest.products.some((product) => !product || typeof product.id !== 'string' || typeof product.version !== 'string')) {
    throw new Error('Release manifest must list a valid product inventory.');
  }
  const wanted = expectedNames(manifest.version);
  for (let index = 0; index < wanted.length; index += 1) {
    const artifact = manifest.artifacts[index];
    if (!artifact || artifact.name !== wanted[index] || path.basename(artifact.name) !== artifact.name) {
      throw new Error('Release manifest contains an unexpected artifact name or order.');
    }
    const artifactPath = path.join(directory, artifact.name);
    if (!fs.existsSync(artifactPath) || fs.statSync(artifactPath).size !== artifact.bytes || digest(artifactPath) !== artifact.sha256) {
      throw new Error(`Release artifact does not match its SHA-256 manifest: ${artifact.name}`);
    }
  }
  return manifest;
}

function main(argv) {
  const [command, directory, version] = argv;
  if (command === 'create' && directory && version) {
    createManifest(path.resolve(directory), version);
    console.log(`  wrote ${MANIFEST} for Instrumenta ${version}`);
  } else if (command === 'verify' && directory) {
    const manifest = verifyManifest(path.resolve(directory));
    console.log(`release hashes verified for Instrumenta ${manifest.version}`);
  } else {
    throw new Error('Usage: release-manifest.cjs <create DIR VERSION|verify DIR>');
  }
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { createManifest, digest, verifyManifest };
