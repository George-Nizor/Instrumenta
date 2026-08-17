'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  READY_DISTRIBUTION_STATUS,
  inspectMotusDistribution,
} = require('../scripts/distribution-readiness.cjs');

function createFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-distribution-'));
  fs.writeFileSync(path.join(directory, 'ffmpeg.exe'), 'ffmpeg');
  fs.writeFileSync(path.join(directory, 'ffprobe.exe'), 'ffprobe');
  return directory;
}

function writeInventory(directory, distributionStatus) {
  const inventory = {
    schemaVersion: 1,
    distributionStatus,
    ffmpeg: {
      buildReport: 'ffmpeg version test --enable-gpl --enable-libx264',
      licenseNotice: 'GPL notice',
    },
    packages: [{
      name: 'mingw-w64-x86_64-ffmpeg',
      sourcePackage: 'https://example.invalid/ffmpeg.src.tar.zst',
      bundledFiles: ['ffmpeg.exe', 'ffprobe.exe'],
      licenseFiles: [],
    }],
  };
  fs.writeFileSync(path.join(directory, 'third-party-packages.json'), JSON.stringify(inventory));
  fs.writeFileSync(path.join(directory, 'THIRD_PARTY_NOTICES.txt'), 'Third-party notices');
}

test('missing Motus bundle and media tools remain FIX findings', () => {
  const missing = path.join(os.tmpdir(), `instrumenta-no-bundle-${process.pid}-${Date.now()}`);
  assert.deepEqual(inspectMotusDistribution(missing), {
    ready: false,
    code: 'bundle-missing',
    detail: 'Motus bundle is missing; run Instrumenta.cmd build motus',
  });

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-distribution-incomplete-'));
  try {
    const finding = inspectMotusDistribution(directory);
    assert.equal(finding.ready, false);
    assert.equal(finding.code, 'media-tools-missing');
    assert.match(finding.detail, /ffmpeg\.exe/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('staged FFmpeg requires its inventory and sibling notices', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-distribution-evidence-'));
  try {
    fs.writeFileSync(path.join(directory, 'ffmpeg.exe'), 'ffmpeg');
    let finding = inspectMotusDistribution(directory);
    assert.equal(finding.ready, false);
    assert.equal(finding.code, 'inventory-missing');

    fs.writeFileSync(path.join(directory, 'third-party-packages.json'), '{}');
    finding = inspectMotusDistribution(directory);
    assert.equal(finding.ready, false);
    assert.equal(finding.code, 'notices-missing');

    fs.writeFileSync(path.join(directory, 'THIRD_PARTY_NOTICES.txt'), '   ');
    finding = inspectMotusDistribution(directory);
    assert.equal(finding.ready, false);
    assert.equal(finding.code, 'notices-invalid');

    writeInventory(directory, READY_DISTRIBUTION_STATUS);
    finding = inspectMotusDistribution(directory);
    assert.equal(finding.ready, false);
    assert.equal(finding.code, 'media-tools-incomplete');
    assert.match(finding.detail, /ffprobe\.exe/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('malformed or incomplete inventory cannot claim distribution readiness', () => {
  const directory = createFixture();
  try {
    fs.writeFileSync(path.join(directory, 'THIRD_PARTY_NOTICES.txt'), 'Third-party notices');
    fs.writeFileSync(path.join(directory, 'third-party-packages.json'), '{not json');
    assert.equal(inspectMotusDistribution(directory).code, 'inventory-invalid');

    writeInventory(directory, READY_DISTRIBUTION_STATUS);
    const inventoryPath = path.join(directory, 'third-party-packages.json');
    const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    delete inventory.ffmpeg.buildReport;
    fs.writeFileSync(inventoryPath, JSON.stringify(inventory));
    const finding = inspectMotusDistribution(directory);
    assert.equal(finding.ready, false);
    assert.equal(finding.code, 'inventory-invalid');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('current Motus distribution status is exposed as a distinct release block', () => {
  const directory = createFixture();
  try {
    const blocked = 'Release-blocked pending corresponding-source publication and license-compatibility review.';
    writeInventory(directory, blocked);
    const finding = inspectMotusDistribution(directory);
    assert.deepEqual(finding, { ready: false, code: 'release-blocked', detail: blocked });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('only the explicit Distribution-ready state passes the gate', () => {
  const directory = createFixture();
  try {
    writeInventory(directory, `${READY_DISTRIBUTION_STATUS} pending review`);
    assert.equal(inspectMotusDistribution(directory).ready, false);

    writeInventory(directory, READY_DISTRIBUTION_STATUS);
    assert.deepEqual(inspectMotusDistribution(directory), {
      ready: true,
      code: 'distribution-ready',
      detail: READY_DISTRIBUTION_STATUS,
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
