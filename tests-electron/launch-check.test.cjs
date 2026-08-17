'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {
  assertLaunchCheck,
  consoleMessage,
  cspViolations,
  launchCheckMarker,
  verifyLaunchCheckMarker,
} = require('../electron/launch-check.cjs');
const releaseVersion = require('../package.json').version;

test('launch check marker parsing is explicit and bounded', () => {
  assert.equal(launchCheckMarker(['electron', '.']), '');
  assert.equal(
    launchCheckMarker(['electron', '.', '--instrumenta-launch-check', 'result.txt']),
    path.resolve('result.txt'),
  );
  assert.throws(() => launchCheckMarker(['electron', '.', '--instrumenta-launch-check']), /requires/);
});

test('console messages normalize modern and legacy Electron event signatures', () => {
  assert.equal(consoleMessage([{}, { message: 'modern' }]), 'modern');
  assert.equal(consoleMessage([{}, 2, 'legacy']), 'legacy');
  assert.deepEqual(cspViolations(['ordinary', 'Refused to load a script due to Content Security Policy']), [
    'Refused to load a script due to Content Security Policy',
  ]);
});

test('launch check requires both editors and rejects CSP violations', () => {
  const passing = {
    launcher: { api: true, title: 'Instrumenta' },
    imago: { root: true, isolated: true, wasm: true, blobWorker: true, blobModule: true, popupDenied: true },
    ludere: { editor: true, isolated: true, serviceWorker: true, popupDenied: true },
    consoleMessages: [],
  };
  assert.equal(assertLaunchCheck(passing), passing);
  assert.throws(() => assertLaunchCheck({ ...passing, imago: { ...passing.imago, wasm: false } }), /Imago/);
  assert.throws(() => assertLaunchCheck({ ...passing, consoleMessages: ['Content Security Policy blocked code'] }), /Content policy/);
});

test('packaging accepts only a success marker for the exact release version', () => {
  assert.equal(
    verifyLaunchCheckMarker(`INSTRUMENTA_LAUNCH_OK ${releaseVersion}\n{}\n`, releaseVersion),
    releaseVersion,
  );
  assert.throws(() => verifyLaunchCheckMarker('INSTRUMENTA_LAUNCH_OK 0.0.0\n', releaseVersion), /expected/);
  assert.throws(() => verifyLaunchCheckMarker(`MAYBE_OK ${releaseVersion}\n`, releaseVersion), /valid success marker/);
});
