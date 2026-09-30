'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createInstallQueue } = require('../electron/install-queue.cjs');

// A run function whose jobs finish only when the test says so.
function controlledRun() {
  const started = [];
  const finish = new Map();
  const run = (job, report) => new Promise((resolve, reject) => {
    started.push(`${job.kind}:${job.id}`);
    finish.set(job.id, { resolve, reject, report });
  });
  return { run, started, finish };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('installs run one at a time, in the order asked', async () => {
  const control = controlledRun();
  const queue = createInstallQueue({ run: control.run });
  const forge = queue.enqueue('forge3d');
  const luna = queue.enqueue('luna');
  await settle();
  assert.deepEqual(control.started, ['install:forge3d'], 'Luna waits for Forge3D');
  assert.deepEqual(queue.jobs().map(({ id, state }) => [id, state]), [['forge3d', 'running'], ['luna', 'queued']]);
  control.finish.get('forge3d').resolve('0.2.4');
  assert.equal(await forge, '0.2.4');
  await settle();
  assert.deepEqual(control.started, ['install:forge3d', 'install:luna']);
  control.finish.get('luna').resolve('0.4.0');
  assert.equal(await luna, '0.4.0');
  assert.deepEqual(queue.jobs(), []);
});

test('asking twice is one job, and a queued download becomes the install', async () => {
  const control = controlledRun();
  const queue = createInstallQueue({ run: control.run });
  const first = queue.enqueue('forge3d');
  const download = queue.enqueue('luna', { kind: 'download' });
  const install = queue.enqueue('luna', { kind: 'install', explicit: true });
  assert.equal(queue.enqueue('forge3d'), first, 'the running install is handed back');
  assert.equal(install, download, 'merged into the one queued job');
  assert.deepEqual(queue.jobFor('luna'), { id: 'luna', kind: 'install', state: 'queued', explicit: true, progress: null });
  control.finish.get('forge3d').resolve();
  await settle();
  assert.deepEqual(control.started, ['install:forge3d', 'install:luna']);
  control.finish.get('luna').resolve();
  await install;
});

test('an install asked for while that product downloads waits behind the download', async () => {
  const control = controlledRun();
  const queue = createInstallQueue({ run: control.run });
  const download = queue.enqueue('luna', { kind: 'download' });
  await settle();
  const install = queue.enqueue('luna', { kind: 'install' });
  assert.notEqual(install, download);
  assert.equal(queue.enqueue('luna', { kind: 'download' }), install, 'the queued install already covers another download');
  control.finish.get('luna').resolve('downloaded');
  assert.equal(await download, 'downloaded');
  await settle();
  assert.deepEqual(control.started, ['download:luna', 'install:luna']);
  control.finish.get('luna').resolve('installed');
  assert.equal(await install, 'installed');
});

test('each job reports its own progress', async () => {
  const control = controlledRun();
  const snapshots = [];
  const queue = createInstallQueue({ run: control.run, onChange: (jobs) => snapshots.push(jobs) });
  const job = queue.enqueue('luna');
  queue.enqueue('forge3d');
  await settle();
  control.finish.get('luna').report({ asset: 'luna.7z.001', received: 50, total: 200 });
  assert.deepEqual(queue.jobFor('luna').progress, { asset: 'luna.7z.001', received: 50, total: 200 });
  assert.equal(queue.jobFor('forge3d').progress, null);
  assert.deepEqual(snapshots.at(-1).find(({ id }) => id === 'luna').progress.received, 50);
  control.finish.get('luna').resolve();
  await job;
});

test('a failed install rejects its own promise and the queue carries on', async () => {
  const control = controlledRun();
  const queue = createInstallQueue({ run: control.run });
  const broken = queue.enqueue('forge3d');
  const next = queue.enqueue('luna');
  await settle();
  control.finish.get('forge3d').reject(new Error('Asset download failed with HTTP 500.'));
  await assert.rejects(broken, /HTTP 500/);
  await settle();
  assert.deepEqual(control.started, ['install:forge3d', 'install:luna']);
  control.finish.get('luna').resolve();
  await next;
  // An automatic job nobody awaits does not become an unhandled rejection.
  const unawaited = createInstallQueue({ run: async () => { throw new Error('offline'); } });
  unawaited.enqueue('luna', { kind: 'download' });
  await settle();
  assert.throws(() => queue.enqueue('luna', { kind: 'repair' }), /Unknown install job/);
});
