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

function addLudereRuntime(root) {
  fs.writeFileSync(path.join(root, 'service-worker.js'), 'self.addEventListener("fetch", () => {});');
}

function addLearnChessRuntime(root) {
  fs.writeFileSync(path.join(root, 'stockfish.wasm'), 'wasm');
  fs.writeFileSync(path.join(root, 'puzzles.db'), 'sqlite');
  fs.mkdirSync(path.join(root, 'fonts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'fonts', 'fraunces-400-latin.woff2'), 'woff2');
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
  // Imago is a service now; its policy lives in security-policy.cjs, not here.
  assert.throws(() => contentSecurityPolicy('imago'), /Unknown Instrumenta web tool/);
  const ludere = contentSecurityPolicy('ludere');
  assert.match(ludere, /script-src 'self'(?:;|$)/);
  assert.match(ludere, /worker-src 'self'/);
  assert.match(ludere, /style-src 'self' 'unsafe-inline'/);
  assert.doesNotMatch(ludere, /blob: 'wasm-unsafe-eval'/);

  const learnchess = contentSecurityPolicy('learnchess');
  assert.match(learnchess, /default-src 'none'/);
  // Stockfish and sqlite-wasm run from a worker; chessground positions pieces with style attributes.
  assert.match(learnchess, /script-src 'self' blob: 'wasm-unsafe-eval'/);
  assert.match(learnchess, /worker-src 'self' blob:/);
  assert.match(learnchess, /style-src 'self' 'unsafe-inline'/);
  assert.match(learnchess, /font-src 'self'(?:;|$)/);
  // The endgame tablebase is the only outward destination anywhere in the suite, and it is the
  // only one this policy grants. A second host appearing here is a change worth noticing.
  assert.deepEqual(learnchess.match(/https:\/\/[^ ;]+/g), ['https://tablebase.lichess.ovh']);

  assert.throws(() => contentSecurityPolicy('unknown'), /Unknown Instrumenta web tool/);
});

test('production build audit rejects inline or remote entrypoint code', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-policy-'));
  try {
    addLudereRuntime(root);
    fs.writeFileSync(path.join(root, 'index.html'), '<script>window.unsafe = true</script>');
    assert.throws(() => auditWebBuild(root, 'ludere'), /inline script/);
    fs.writeFileSync(path.join(root, 'index.html'), '<script src="https://example.com/app.js"></script>');
    assert.throws(() => auditWebBuild(root, 'ludere'), /non-local resource/);

    // A comment that names a tag or a URL is prose, not markup, and must not fail the audit.
    fs.writeFileSync(
      path.join(root, 'index.html'),
      [
        '<!-- A classic <script src> in <head> still blocks parsing.',
        '     Not loaded from https://fonts.googleapis.com any more. -->',
        '<script type="module" src="./app.js"></script>',
      ].join('\n'),
    );
    assert.equal(auditWebBuild(root, 'ludere').tool, 'ludere');

    // Commenting out a real inline script does not make it inline again, but an actual one after
    // a comment must still be caught.
    fs.writeFileSync(
      path.join(root, 'index.html'),
      '<!-- explanation --><script>window.unsafe = true</script>',
    );
    assert.throws(() => auditWebBuild(root, 'ludere'), /inline script/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('production build audit enforces each editor runtime closure', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-policy-'));
  try {
    fs.writeFileSync(path.join(root, 'index.html'), '<script type="module" src="./app.js"></script>');
    fs.writeFileSync(path.join(root, 'app.js'), 'export {};');
    assert.throws(() => auditWebBuild(root, 'ludere'), /service worker/);
    addLudereRuntime(root);
    assert.equal(auditWebBuild(root, 'ludere').tool, 'ludere');

    // LearnChess is playable offline only if the engine, the puzzles, and the fonts all shipped.
    // Each one missing looks like a working build until a learner asks it to do something.
    const chess = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-policy-chess-'));
    try {
      fs.writeFileSync(path.join(chess, 'index.html'), '<script type="module" src="./app.js"></script>');
      assert.throws(() => auditWebBuild(chess, 'learnchess'), /engine and database WASM/);
      fs.writeFileSync(path.join(chess, 'stockfish.wasm'), 'wasm');
      assert.throws(() => auditWebBuild(chess, 'learnchess'), /puzzle database/);
      fs.writeFileSync(path.join(chess, 'puzzles.db'), 'sqlite');
      assert.throws(() => auditWebBuild(chess, 'learnchess'), /vendored fonts/);
      addLearnChessRuntime(chess);
      assert.equal(auditWebBuild(chess, 'learnchess').tool, 'learnchess');
    } finally {
      fs.rmSync(chess, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('serves a local application with cross-origin isolation headers', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-site-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>Ludere</title>');
  addLudereRuntime(root);
  const server = await createStaticServer(root, { tool: 'ludere' });
  try {
    const response = await fetch(server.url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.equal(response.headers.get('cross-origin-embedder-policy'), 'require-corp');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('permissions-policy'), /camera=\(\)/);
    assert.match(response.headers.get('content-security-policy'), /worker-src 'self'/);
    assert.match(await response.text(), /Ludere/);
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
  addLudereRuntime(root);
  const server = await createStaticServer(root, { tool: 'ludere' });
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
  addLudereRuntime(root);
  const probe = await createStaticServer(root, { tool: 'ludere' });
  const port = Number(new URL(probe.url).port);
  await probe.close();
  const server = await createStaticServer(root, { port, tool: 'ludere' });
  try {
    assert.equal(server.url, `http://127.0.0.1:${port}`);
  } finally {
    await server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a replacement server for a new build gets the same port while a keep-alive socket is open', async () => {
  // After an update the launcher closes the old build's server and starts one for the new folder.
  // The port is the origin, and the origin is where the product's saved data lives, so the new
  // server must not be pushed onto the fallback port by a connection the old one kept alive.
  const oldBuild = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-old-build-'));
  const newBuild = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-new-build-'));
  for (const [root, title] of [[oldBuild, 'old'], [newBuild, 'new']]) {
    fs.writeFileSync(path.join(root, 'index.html'), `<!doctype html><title>${title}</title>`);
    addLudereRuntime(root);
  }
  const agent = new http.Agent({ keepAlive: true });
  const get = (url, via = agent) => new Promise((resolve, reject) => {
    http.get(url, { agent: via }, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve(body));
    }).on('error', reject);
  });
  const first = await createStaticServer(oldBuild, { tool: 'ludere' });
  const port = Number(new URL(first.url).port);
  let second;
  try {
    assert.match(await get(first.url), /old/);
    await first.close();
    second = await createStaticServer(newBuild, { port, fallbackPort: port + 1, tool: 'ludere' });
    assert.equal(second.url, `http://127.0.0.1:${port}`);
    // A browser opens a fresh connection once its pooled one is gone; so does this client.
    assert.match(await get(second.url, false), /new/);
  } finally {
    agent.destroy();
    await second?.close();
    fs.rmSync(oldBuild, { recursive: true, force: true });
    fs.rmSync(newBuild, { recursive: true, force: true });
  }
});
