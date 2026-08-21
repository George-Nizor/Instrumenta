const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  assertContained,
  cleanKnownOutputs,
  iconPaths,
  validateIconSources,
  validatePng,
  validateSvg,
} = require('../scripts/workspace-maintenance.cjs');

function temporaryWorkspace(callback) {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-maintenance-'));
  const workspace = path.join(area, 'workspace');
  for (const directory of ['Instrumenta', 'Imago', 'Motus', 'Ludere']) {
    fs.mkdirSync(path.join(workspace, directory), { recursive: true });
  }
  fs.writeFileSync(path.join(workspace, 'Instrumenta', 'package.json'), '{}\n');
  try {
    callback({ area, workspace });
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
}

function pngStub(size, colorType = 6) {
  const png = Buffer.alloc(26);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(png, 0);
  png.writeUInt32BE(size, 16);
  png.writeUInt32BE(size, 20);
  png[25] = colorType;
  return png;
}

test('canonical mark and package icon are validated as RGBA PNGs', () => {
  temporaryWorkspace(({ workspace }) => {
    const launcher = path.join(workspace, 'Instrumenta');
    fs.mkdirSync(path.join(launcher, 'brand'), { recursive: true });
    fs.mkdirSync(path.join(launcher, 'packaging'), { recursive: true });
    const markPath = path.join(launcher, 'brand', 'instrumenta-mark.png');
    const iconPath = path.join(launcher, 'packaging', 'icon.png');
    fs.writeFileSync(markPath, pngStub(512));
    fs.writeFileSync(iconPath, pngStub(1024));
    assert.deepEqual(validateIconSources(launcher), { markPath, iconPath });
  });
});

test('PNG validation rejects the wrong size or a non-RGBA colour type', () => {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-png-'));
  const file = path.join(area, 'icon.png');
  try {
    fs.writeFileSync(file, pngStub(256));
    assert.throws(() => validatePng(file, 512), /512 x 512 RGBA PNG/);
    fs.writeFileSync(file, pngStub(512, 2));
    assert.throws(() => validatePng(file, 512), /512 x 512 RGBA PNG/);
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});

test('SVG validation rejects executable or external content', () => {
  const area = fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-svg-'));
  const file = path.join(area, 'unsafe.svg');
  try {
    fs.writeFileSync(file, '<svg viewBox="0 0 64 64"><script>alert(1)</script></svg>');
    assert.throws(() => validateSvg(file, '0 0 64 64'), /not allowed/);
  } finally {
    fs.rmSync(area, { recursive: true, force: true });
  }
});

test('clean removes only enumerated generated outputs and launcher caches', () => {
  temporaryWorkspace(({ area, workspace }) => {
    const generated = [
      ['Instrumenta', 'release'],
      ['Instrumenta', 'packaging', 'staging'],
      ['Imago', 'dist'],
      ['Ludere', 'dist'],
      ['Motus', 'build'],
      ['Motus', 'dist', 'windows.next'],
    ];
    for (const parts of generated) {
      const directory = path.join(workspace, ...parts);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'generated.txt'), 'generated');
    }

    const protectedPaths = [
      path.join(workspace, 'Instrumenta', 'node_modules', 'keep.txt'),
      path.join(workspace, 'Motus', 'dist', 'windows', 'motus.exe'),
      path.join(workspace, 'Motus', 'project.veproj'),
    ];
    for (const file of protectedPaths) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, 'keep');
    }

    const local = path.join(area, 'local');
    const roaming = path.join(area, 'roaming');
    const packageCache = path.join(local, 'Instrumenta', 'package-workspace');
    const launchCache = path.join(roaming, 'instrumenta-launcher', 'apps');
    const diagnostics = path.join(roaming, 'instrumenta-launcher', 'logs');
    const crashReports = path.join(roaming, 'instrumenta-launcher', 'Crashpad');
    const imagoCache = path.join(roaming, 'instrumenta-launcher', 'Cache');
    const imagoShelf = path.join(roaming, 'instrumenta-launcher', 'IndexedDB', 'shelf.db');
    const settings = path.join(roaming, 'instrumenta-launcher', 'settings.json');
    for (const directory of [packageCache, launchCache, diagnostics, crashReports, imagoCache]) {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'generated.txt'), 'generated');
    }
    fs.mkdirSync(path.dirname(imagoShelf), { recursive: true });
    fs.writeFileSync(imagoShelf, 'keep');
    fs.writeFileSync(settings, '{"workspace":"keep"}');

    cleanKnownOutputs({
      workspaceRoot: workspace,
      environment: { LOCALAPPDATA: local, APPDATA: roaming },
      log: () => {},
    });

    for (const parts of generated) assert.equal(fs.existsSync(path.join(workspace, ...parts)), false);
    assert.equal(fs.existsSync(packageCache), false);
    assert.equal(fs.existsSync(launchCache), false);
    assert.equal(fs.existsSync(diagnostics), false);
    assert.equal(fs.existsSync(crashReports), false);
    assert.equal(fs.existsSync(imagoCache), false);
    assert.equal(fs.readFileSync(imagoShelf, 'utf8'), 'keep');
    for (const file of protectedPaths) assert.equal(fs.readFileSync(file, 'utf8'), 'keep');
    assert.equal(fs.readFileSync(settings, 'utf8'), '{"workspace":"keep"}');
  });
});

test('cleanup containment rejects a boundary or an escaped target', () => {
  assert.throws(
    () => assertContained({ boundary: '/tmp/example', path: '/tmp/example' }),
    /unsafe cleanup target/,
  );
  assert.throws(
    () => assertContained({ boundary: '/tmp/example', path: '/tmp/outside' }),
    /unsafe cleanup target/,
  );
});
