const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  auditWebBuild,
  contentSecurityPolicy,
  createStaticServer,
  resolveFile,
  resolveRequest,
} = require('../electron/static-server.cjs');

function addImagoRuntime(root) {
  fs.writeFileSync(path.join(root, 'runtime.wasm'), 'wasm');
  fs.writeFileSync(path.join(root, 'worker.mjs'), 'export default true;');
}

function addLudereRuntime(root) {
  fs.writeFileSync(path.join(root, 'service-worker.js'), 'self.addEventListener("fetch", () => {});');
}

test('maps the site root to index.html', () => {
  const root = path.resolve('example-site');
  assert.equal(resolveRequest(root, '/'), path.join(root, 'index.html'));
});

test('rejects path traversal outside the application build', () => {
  const root = path.resolve('example-site');
  assert.equal(resolveRequest(root, '/../private.txt'), '');
  assert.equal(resolveRequest(root, '/%2e%2e/private.txt'), '');
});

test('resolves real files only when their final path remains inside the application build', () => {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-realpath-'));
  const root = path.join(area, 'site');
  const inside = path.join(root, 'index.html');
  const outside = path.join(area, 'private.txt');
  fs.mkdirSync(root);
  fs.writeFileSync(inside, 'inside');
  fs.writeFileSync(outside, 'outside');
  try {
    assert.equal(resolveFile(root, inside), fs.realpathSync(inside));
    assert.equal(resolveFile(root, outside), '');
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});

test('app-specific content policies preserve only required local capabilities', () => {
  const imago = contentSecurityPolicy('imago');
  assert.match(imago, /default-src 'none'/);
  assert.match(imago, /script-src 'self' blob: 'wasm-unsafe-eval'/);
  assert.match(imago, /worker-src 'self' blob:/);
  assert.doesNotMatch(imago, /style-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(imago, /https:/);

  const ludere = contentSecurityPolicy('ludere');
  assert.match(ludere, /script-src 'self'(?:;|$)/);
  assert.match(ludere, /worker-src 'self'/);
  assert.match(ludere, /style-src 'self' 'unsafe-inline'/);
  assert.doesNotMatch(ludere, /blob: 'wasm-unsafe-eval'/);
  assert.throws(() => contentSecurityPolicy('unknown'), /Unknown Instrumenta web tool/);
});

test('production build audit rejects inline or remote entrypoint code', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-policy-'));
  try {
    addImagoRuntime(root);
    fs.writeFileSync(path.join(root, 'index.html'), '<script>window.unsafe = true</script>');
    assert.throws(() => auditWebBuild(root, 'imago'), /inline script/);
    fs.writeFileSync(path.join(root, 'index.html'), '<script src="https://example.com/app.js"></script>');
    assert.throws(() => auditWebBuild(root, 'imago'), /non-local resource/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('production build audit enforces each editor runtime closure', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-policy-'));
  try {
    fs.writeFileSync(path.join(root, 'index.html'), '<script type="module" src="./app.js"></script>');
    fs.writeFileSync(path.join(root, 'app.js'), 'export {};');
    assert.throws(() => auditWebBuild(root, 'imago'), /WASM cutout runtime/);
    addImagoRuntime(root);
    assert.equal(auditWebBuild(root, 'imago').tool, 'imago');
    assert.throws(() => auditWebBuild(root, 'ludere'), /service worker/);
    addLudereRuntime(root);
    assert.equal(auditWebBuild(root, 'ludere').tool, 'ludere');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('serves a local application with cross-origin isolation headers', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-site-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>Imago</title>');
  addImagoRuntime(root);
  const server = await createStaticServer(root, { tool: 'imago' });
  try {
    const response = await fetch(server.url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.equal(response.headers.get('cross-origin-embedder-policy'), 'require-corp');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('permissions-policy'), /camera=\(\)/);
    assert.match(response.headers.get('content-security-policy'), /wasm-unsafe-eval/);
    assert.match(await response.text(), /Imago/);
  } finally {
    await server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rejects a foreign Host header on the loopback server', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-host-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html>');
  addLudereRuntime(root);
  const server = await createStaticServer(root, { tool: 'ludere' });
  try {
    const status = await new Promise((resolve, reject) => {
      const request = http.get(server.url, { headers: { Host: 'instrumenta.invalid' } }, (response) => {
        response.resume();
        resolve(response.statusCode);
      });
      request.on('error', reject);
    });
    assert.equal(status, 421);
  } finally {
    await server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('serves JavaScript modules used by local-first applications', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-module-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html>');
  fs.writeFileSync(path.join(root, 'core.mjs'), 'export const ready = true;');
  fs.writeFileSync(path.join(root, 'runtime.wasm'), 'wasm');
  const server = await createStaticServer(root, { tool: 'imago' });
  try {
    const response = await fetch(`${server.url}/core.mjs`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/javascript/);
  } finally {
    await server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('can use a stable loopback port so browser storage survives launcher restarts', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-origin-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html>');
  addImagoRuntime(root);
  const probe = await createStaticServer(root, { tool: 'imago' });
  const port = Number(new URL(probe.url).port);
  await probe.close();
  const server = await createStaticServer(root, { port, tool: 'imago' });
  try {
    assert.equal(server.url, `http://127.0.0.1:${port}`);
  } finally {
    await server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
