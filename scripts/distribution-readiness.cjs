'use strict';

const fs = require('node:fs');
const path = require('node:path');

const INVENTORY_FILE = 'third-party-packages.json';
const NOTICES_FILE = 'THIRD_PARTY_NOTICES.txt';
const MEDIA_TOOLS = Object.freeze(['ffmpeg.exe', 'ffprobe.exe']);
const READY_DISTRIBUTION_STATUS = 'Distribution-ready';

function result(code, detail, ready = false) {
  return Object.freeze({ ready, code, detail });
}

function singleLine(value, maximumLength = 320) {
  const normalized = String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maximumLength) return normalized;
  return `${normalized.slice(0, maximumLength - 1)}…`;
}

function fileExists(fileSystem, filePath) {
  try {
    return fileSystem.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function inspectMotusDistribution(bundleRoot, options = {}) {
  const fileSystem = options.fileSystem || fs;
  const resolvedRoot = path.resolve(String(bundleRoot || ''));

  let rootIsDirectory = false;
  try {
    rootIsDirectory = fileSystem.statSync(resolvedRoot).isDirectory();
  } catch {
    // A missing build is a normal doctor finding, not a helper failure.
  }
  if (!rootIsDirectory) {
    return result('bundle-missing', 'Motus bundle is missing; run Instrumenta.cmd build motus');
  }

  const presentMediaTools = MEDIA_TOOLS.filter((name) => fileExists(fileSystem, path.join(resolvedRoot, name)));
  if (presentMediaTools.length === 0) {
    return result(
      'media-tools-missing',
      `Motus media bundle is incomplete (missing ${MEDIA_TOOLS.join(', ')}); run Instrumenta.cmd build motus`,
    );
  }

  const inventoryPath = path.join(resolvedRoot, INVENTORY_FILE);
  if (!fileExists(fileSystem, inventoryPath)) {
    return result(
      'inventory-missing',
      `${INVENTORY_FILE} is missing beside staged FFmpeg; rebuild Motus before release`,
    );
  }

  const noticesPath = path.join(resolvedRoot, NOTICES_FILE);
  if (!fileExists(fileSystem, noticesPath)) {
    return result(
      'notices-missing',
      `${NOTICES_FILE} is missing beside staged FFmpeg; rebuild Motus before release`,
    );
  }

  let inventory;
  try {
    inventory = JSON.parse(fileSystem.readFileSync(inventoryPath, 'utf8'));
  } catch {
    return result('inventory-invalid', `${INVENTORY_FILE} is not valid JSON; rebuild Motus before release`);
  }

  let notices;
  try {
    notices = fileSystem.readFileSync(noticesPath, 'utf8').trim();
  } catch {
    return result('notices-invalid', `${NOTICES_FILE} cannot be read; rebuild Motus before release`);
  }
  if (!notices) {
    return result('notices-invalid', `${NOTICES_FILE} is empty; rebuild Motus before release`);
  }

  if (!inventory || inventory.schemaVersion !== 1) {
    return result('inventory-invalid', `${INVENTORY_FILE} must use schemaVersion 1; rebuild Motus before release`);
  }

  const status = singleLine(inventory.distributionStatus);
  if (!status) {
    return result('inventory-invalid', `${INVENTORY_FILE} has no distributionStatus; rebuild Motus before release`);
  }

  const ffmpegEvidence = inventory.ffmpeg;
  if (!ffmpegEvidence || !singleLine(ffmpegEvidence.buildReport) || !singleLine(ffmpegEvidence.licenseNotice)) {
    return result('inventory-invalid', `${INVENTORY_FILE} has incomplete FFmpeg build/license evidence; rebuild Motus before release`);
  }

  const packages = Array.isArray(inventory.packages) ? inventory.packages : [];
  const ffmpegPackage = packages.find((entry) => {
    if (!entry || !Array.isArray(entry.bundledFiles)) return false;
    const files = new Set(entry.bundledFiles.map((file) => String(file).toLowerCase()));
    return MEDIA_TOOLS.every((tool) => files.has(tool));
  });
  if (!ffmpegPackage || !singleLine(ffmpegPackage.sourcePackage) || !Array.isArray(ffmpegPackage.licenseFiles)) {
    return result('inventory-invalid', `${INVENTORY_FILE} has incomplete FFmpeg package provenance; rebuild Motus before release`);
  }

  if (presentMediaTools.length !== MEDIA_TOOLS.length) {
    const missing = MEDIA_TOOLS.filter((name) => !presentMediaTools.includes(name));
    return result(
      'media-tools-incomplete',
      `Motus media bundle is incomplete (missing ${missing.join(', ')}); run Instrumenta.cmd build motus`,
    );
  }

  if (status !== READY_DISTRIBUTION_STATUS) {
    return result('release-blocked', status);
  }

  return result('distribution-ready', status, true);
}

function main(argv) {
  if (argv.length !== 1) {
    process.stderr.write('Usage: node distribution-readiness.cjs <motus-bundle-root>\n');
    return 2;
  }
  process.stdout.write(`${JSON.stringify(inspectMotusDistribution(argv[0]))}\n`);
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = {
  INVENTORY_FILE,
  MEDIA_TOOLS,
  NOTICES_FILE,
  READY_DISTRIBUTION_STATUS,
  inspectMotusDistribution,
  main,
};
