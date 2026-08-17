'use strict';

const path = require('node:path');

const MARKER_PATTERN = /^INSTRUMENTA_LAUNCH_OK (\d+\.\d+\.\d+)\r?\n/;

function launchCheckMarker(argv = process.argv) {
  const index = argv.indexOf('--instrumenta-launch-check');
  if (index < 0) return '';
  const value = argv[index + 1];
  if (!value || value.startsWith('--') || value.length > 4096) {
    throw new Error('--instrumenta-launch-check requires a marker-file path.');
  }
  return path.resolve(value);
}

function consoleMessage(args) {
  const details = args[1];
  if (details && typeof details === 'object' && typeof details.message === 'string') return details.message;
  return typeof args[2] === 'string' ? args[2] : '';
}

function cspViolations(messages) {
  return messages.filter((message) => (
    /content security policy/i.test(message)
    || /refused to (?:load|execute|create|connect|apply|frame)/i.test(message)
  ));
}

function assertLaunchCheck(report) {
  if (!report.launcher?.api || report.launcher?.title !== 'Instrumenta') {
    throw new Error('Instrumenta launcher renderer or preload API did not initialize.');
  }
  if (!report.imago?.root || !report.imago?.isolated || !report.imago?.wasm
      || !report.imago?.blobWorker || !report.imago?.blobModule || !report.imago?.popupDenied) {
    throw new Error('Imago did not pass the secure local-runtime smoke check.');
  }
  if (!report.ludere?.editor || !report.ludere?.isolated
      || !report.ludere?.serviceWorker || !report.ludere?.popupDenied) {
    throw new Error('Ludere did not pass the secure local-runtime smoke check.');
  }
  const violations = cspViolations(report.consoleMessages || []);
  if (violations.length) throw new Error(`Content policy violation during launch check: ${violations[0]}`);
  return report;
}

function verifyLaunchCheckMarker(contents, expectedVersion) {
  const match = String(contents || '').match(MARKER_PATTERN);
  if (!match) throw new Error('Instrumenta launch check did not write a valid success marker.');
  if (match[1] !== expectedVersion) {
    throw new Error(`Instrumenta launch check reported ${match[1]}, expected ${expectedVersion}.`);
  }
  return match[1];
}

module.exports = {
  assertLaunchCheck,
  consoleMessage,
  cspViolations,
  launchCheckMarker,
  verifyLaunchCheckMarker,
};
