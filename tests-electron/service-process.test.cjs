'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const test = require('node:test');
const { pickPort, startService } = require('../electron/service-process.cjs');

const HEALTH_SERVER = `
  const http = require('node:http');
  const server = http.createServer((request, response) => {
    if (request.url === '/api/health') { response.writeHead(200).end('ok'); return; }
    response.writeHead(404).end();
  });
  server.listen(Number(process.env.PORT), process.env.HOST, () => console.log('service listening'));
`;

function listen() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, close: () => new Promise((done) => server.close(done)) }));
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => { response.resume(); resolve(response.statusCode); }).once('error', reject);
  });
}

test('a managed service opens only after its health path answers', async () => {
  const port = await pickPort([]);
  const service = await startService({
    tool: 'discere',
    command: [process.execPath, '-e', HEALTH_SERVER],
    port,
    healthPath: '/api/health',
    intervalMs: 50,
    timeoutMs: 10000,
  });
  try {
    assert.equal(service.url, `http://127.0.0.1:${port}`);
    assert.equal(await get(`${service.url}/api/health`), 200);
  } finally {
    await service.stop();
  }
});

test('a service that exits during startup fails with its captured output', async () => {
  await assert.rejects(
    startService({
      tool: 'discere',
      command: [process.execPath, '-e', 'console.error("missing workspace dependency"); process.exit(3);'],
      port: await pickPort([]),
      healthPath: '/api/health',
      intervalMs: 50,
      timeoutMs: 10000,
    }),
    (error) => /exited before it became ready/.test(error.message) && /missing workspace dependency/.test(error.message),
  );
});

test('a service that never becomes healthy is stopped and reported', async () => {
  await assert.rejects(
    startService({
      tool: 'discere',
      command: [process.execPath, '-e', HEALTH_SERVER],
      port: await pickPort([]),
      healthPath: '/api/not-implemented',
      intervalMs: 50,
      timeoutMs: 700,
      escalateAfterMs: 200,
    }),
    /did not answer/,
  );
});

test('stopping a service terminates its process even when it ignores SIGTERM', async () => {
  const port = await pickPort([]);
  const service = await startService({
    tool: 'discere',
    command: [process.execPath, '-e', `process.on('SIGTERM', () => {});${HEALTH_SERVER}`],
    port,
    healthPath: '/api/health',
    intervalMs: 50,
    timeoutMs: 10000,
    escalateAfterMs: 300,
  });
  const { pid } = service.child;
  await service.stop();
  assert.ok(service.child.exitCode !== null || service.child.signalCode !== null);
  assert.throws(() => process.kill(pid, 0), /ESRCH/);
  await service.stop();
  await assert.rejects(get(`http://127.0.0.1:${port}/api/health`));
});

test('the registered port is preferred and a busy port falls back', async () => {
  const primary = await listen();
  const spare = await listen();
  const fallback = spare.port;
  await spare.close();
  try {
    assert.equal(await pickPort([fallback]), fallback);
    assert.equal(await pickPort([primary.port, fallback]), fallback);
    assert.ok((await pickPort([])) > 0);
  } finally {
    await primary.close();
  }
});
