const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { assertTrustedExecutable, isInside, probeExecutable } = require('../electron/native-launch.cjs');

function probeChild(output, code, marker = '') {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => {};
  setImmediate(() => {
    if (marker) fs.writeFileSync(marker, 'MOTUS_LAUNCH_OK 0.1.0\n');
    child.stdout.emit('data', Buffer.from(output));
    child.emit('close', code);
  });
  return child;
}

test('accepts a real executable only inside its trusted bundle root', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-native-'));
  const bundle = path.join(temporary, 'Motus');
  const executable = path.join(bundle, 'motus.exe');
  fs.mkdirSync(bundle, { recursive: true });
  fs.writeFileSync(executable, 'test');
  try {
    assert.equal(isInside(executable, bundle), true);
    assert.equal(assertTrustedExecutable(executable, [bundle], 'win32'), fs.realpathSync.native(executable));
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('rejects launch targets outside the allowed application root', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-native-'));
  const bundle = path.join(temporary, 'Motus');
  const escaped = path.join(temporary, 'other.exe');
  fs.mkdirSync(bundle, { recursive: true });
  fs.writeFileSync(escaped, 'test');
  try {
    assert.throws(() => assertTrustedExecutable(escaped, [bundle], 'win32'), /outside its trusted/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('a bundle with launch arguments is probed with them ahead of the check flag', async () => {
  let spawned = null;
  await probeExecutable('/trusted/electron.exe', {
    timeoutMs: 100,
    name: 'Fabula',
    args: ['\\\\wsl.localhost\\Ubuntu\\work\\Fabula'],
    spawnProcess: (executable, args) => {
      spawned = { executable, args };
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = () => {};
      setImmediate(() => {
        // The product answers with its own name, not Motus's.
        fs.writeFileSync(args[2], 'FABULA_LAUNCH_OK 0.1.0\n');
        child.emit('close', 0);
      });
      return child;
    },
  });
  assert.equal(spawned.executable, '/trusted/electron.exe');
  assert.equal(spawned.args[0], '\\\\wsl.localhost\\Ubuntu\\work\\Fabula');
  assert.equal(spawned.args[1], '--instrumenta-launch-check');
  assert.match(spawned.args[2], /ready\.txt$/);

  // A marker that is not a launch acknowledgement still fails, in the product's name.
  await assert.rejects(() => probeExecutable('/trusted/electron.exe', {
    timeoutMs: 100,
    name: 'Fabula',
    spawnProcess: (_executable, args) => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = () => {};
      setImmediate(() => {
        fs.writeFileSync(args[1], 'hello\n');
        child.emit('close', 0);
      });
      return child;
    },
  }), /Fabula is installed but its native runtime is incomplete/);
});

test('requires the Motus runtime handshake before launch', async () => {
  await probeExecutable('/trusted/motus.exe', {
    timeoutMs: 100,
    spawnProcess: (_executable, args) => {
      return probeChild('', 0, args[1]);
    },
  });
  await assert.rejects(() => probeExecutable('/trusted/motus.exe', {
    timeoutMs: 100,
    spawnProcess: () => probeChild('unexpected output\n', 0),
  }), /native runtime is incomplete/);
});
