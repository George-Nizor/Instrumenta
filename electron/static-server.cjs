const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

const CONTENT_SECURITY_POLICIES = Object.freeze({
  imago: [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self' blob: 'wasm-unsafe-eval'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' data: blob:",
  ].join('; '),
  ludere: [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self'",
    // Ludere positions the local character-suggestion popup through element.style.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self' data: blob:",
  ].join('; '),
});

function contentSecurityPolicy(tool = '') {
  if (!Object.hasOwn(CONTENT_SECURITY_POLICIES, tool)) {
    throw new Error(`Unknown Instrumenta web tool for static serving: ${tool || '(missing)'}`);
  }
  return CONTENT_SECURITY_POLICIES[tool];
}

function listBuildFiles(root, maximum = 5000) {
  const files = [];
  const pending = [path.resolve(root)];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) pending.push(candidate);
      else if (entry.isFile()) files.push(candidate);
      if (files.length > maximum) throw new Error('Local web build contains too many files to audit safely.');
    }
  }
  return files;
}

function auditWebBuild(root, tool) {
  const documentRoot = path.resolve(root);
  const csp = contentSecurityPolicy(tool);
  const indexFile = resolveFile(documentRoot, path.join(documentRoot, 'index.html'));
  if (!indexFile) throw new Error(`${tool} is missing a contained index.html production entrypoint.`);
  const html = fs.readFileSync(indexFile, 'utf8').replace(/^\uFEFF/, '');
  if (Buffer.byteLength(html) > 1024 * 1024) throw new Error(`${tool} index.html is unexpectedly large.`);
  if (/<script\b(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(html)) {
    throw new Error(`${tool} index.html contains an inline script, but the launcher requires external scripts.`);
  }
  if (/\son[a-z]+\s*=/i.test(html)) {
    throw new Error(`${tool} index.html contains an inline event handler.`);
  }
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const reference = match[1].trim();
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) {
      throw new Error(`${tool} index.html references a non-local resource: ${reference}`);
    }
  }

  const files = listBuildFiles(documentRoot);
  if (tool === 'imago') {
    if (!files.some((file) => path.extname(file).toLowerCase() === '.wasm')) {
      throw new Error('Imago production build is missing its local WASM cutout runtime.');
    }
    if (!files.some((file) => path.extname(file).toLowerCase() === '.mjs')) {
      throw new Error('Imago production build is missing its local module worker runtime.');
    }
    if (!/script-src[^;]*blob:[^;]*'wasm-unsafe-eval'/.test(csp) || !/worker-src[^;]*blob:/.test(csp)) {
      throw new Error('Imago CSP does not permit its bundled WASM and blob worker runtime.');
    }
  } else if (tool === 'ludere') {
    if (!files.some((file) => path.basename(file) === 'service-worker.js')) {
      throw new Error('Ludere production build is missing its local service worker.');
    }
    if (!/worker-src 'self'/.test(csp)) throw new Error('Ludere CSP does not permit its local service worker.');
  }
  return { files: files.length, indexFile, tool };
}

function resolveRequest(root, requestUrl) {
  let pathname;
  try {
    // Inspect the raw path so URL normalization cannot hide `..` traversal.
    const rawPath = String(requestUrl).split(/[?#]/, 1)[0];
    pathname = decodeURIComponent(rawPath);
  } catch {
    return '';
  }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);
  const rootPrefix = `${path.resolve(root)}${path.sep}`;
  return resolved.startsWith(rootPrefix) ? resolved : '';
}

function resolveFile(root, candidate) {
  try {
    if (!fs.statSync(candidate).isFile()) return '';
    const realRoot = fs.realpathSync(root);
    const realCandidate = fs.realpathSync(candidate);
    const relative = path.relative(realRoot, realCandidate);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return '';
    return realCandidate;
  } catch {
    return '';
  }
}

function createStaticServer(root, options = {}) {
  const documentRoot = path.resolve(root);
  const csp = contentSecurityPolicy(options.tool);
  auditWebBuild(documentRoot, options.tool);
  let server;

  return new Promise((resolve, reject) => {
    server = http.createServer((request, response) => {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' }).end();
        return;
      }

      const address = server.address();
      const expectedHost = address && typeof address !== 'string' ? `127.0.0.1:${address.port}` : '';
      if (request.headers.host !== expectedHost) {
        response.writeHead(421).end();
        return;
      }

      let filename = resolveRequest(documentRoot, request.url || '/');
      if (!filename) {
        response.writeHead(400).end();
        return;
      }

      try {
        if (fs.statSync(filename).isFile()) {
          const resolvedFile = resolveFile(documentRoot, filename);
          if (!resolvedFile) {
            response.writeHead(403).end();
            return;
          }
          filename = resolvedFile;
        } else {
          filename = resolveFile(documentRoot, path.join(documentRoot, 'index.html'));
        }
      } catch {
        filename = resolveFile(documentRoot, path.join(documentRoot, 'index.html'));
      }
      if (!filename) {
        response.writeHead(404).end();
        return;
      }

      const headers = {
        'Content-Type': MIME_TYPES.get(path.extname(filename).toLowerCase()) || 'application/octet-stream',
        'Content-Length': fs.statSync(filename).size,
        'Cache-Control': 'no-store',
        'Content-Security-Policy': csp,
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Permissions-Policy': 'camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), usb=(), serial=(), hid=()',
        'Referrer-Policy': 'no-referrer',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
      };

      if (request.method === 'HEAD') {
        response.writeHead(200, headers).end();
        return;
      }
      response.writeHead(200, headers);
      fs.createReadStream(filename).pipe(response);
    });
    server.once('error', reject);
    server.listen(options.port || 0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

module.exports = { auditWebBuild, contentSecurityPolicy, createStaticServer, resolveFile, resolveRequest };
