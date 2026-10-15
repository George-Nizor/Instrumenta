'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { linkFor } = require('../electron/launcher-links.cjs');
const { cleanStorage, directorySize, storageReport } = require('../electron/storage-report.cjs');
const { checkAll, productReadiness } = require('../electron/readiness.cjs');
const { forgetPreviousVersion, readPointer, releaseNotesText, validateReleaseManifest } = require('../electron/release-lifecycle.cjs');

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'products', 'catalog.json'), 'utf8'));

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'instrumenta-panels-'));
}

function writeFile(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.alloc(bytes));
}

test('the window can open only the links the launcher knows', () => {
  assert.equal(linkFor('site', catalog), 'https://boneheadlabs.org/');
  assert.equal(linkFor('github', catalog), 'https://github.com/Bonehead-Labs');
  assert.equal(linkFor('source', catalog), 'https://github.com/George-Nizor/Instrumenta');
  assert.equal(linkFor('issues:instrumenta', catalog), 'https://github.com/George-Nizor/Instrumenta/issues/new');
  for (const product of catalog.products) {
    assert.match(linkFor(`issues:${product.id}`, catalog), /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/new$/, product.id);
  }
  for (const bad of ['https://example.com', 'issues:../x', 'issues:nope', '', null, 'javascript:alert(1)']) {
    assert.throws(() => linkFor(bad, catalog), undefined, String(bad));
  }
  const hostile = { launcher: { repository: { provider: 'github', owner: 'a/../b', name: 'x' } }, products: [] };
  assert.throws(() => linkFor('source', hostile));
});

test('storage measures managed versions and offers to forget the previous one', async () => {
  const root = scratch();
  const installRoot = path.join(root, 'products');
  const downloadsRoot = path.join(root, 'downloads');
  writeFile(path.join(installRoot, 'dimensio', 'versions', '0.2.2', 'a.bin'), 3000);
  writeFile(path.join(installRoot, 'dimensio', 'versions', '0.2.3', 'b.bin'), 5000);
  fs.writeFileSync(path.join(installRoot, 'dimensio', 'current.json'), JSON.stringify({ current: '0.2.3', previous: '0.2.2', pending: false }));
  writeFile(path.join(downloadsRoot, 'luna', '0.4.1', 'part.partial'), 700);
  const products = [{ id: 'dimensio', displayName: 'Dimensio' }, { id: 'imago', displayName: 'Imago' }];
  let forgotten = '';
  const options = { installRoot, downloadsRoot, products, readPointer, forgetPrevious: async (productRoot) => { forgotten = productRoot; } };

  const report = await storageReport(options);
  const dimensio = report.items.find((item) => item.product === 'dimensio');
  assert.equal(dimensio.bytes, 8000 + fs.statSync(path.join(installRoot, 'dimensio', 'current.json')).size);
  assert.deepEqual({ key: dimensio.clean.key, bytes: dimensio.clean.bytes }, { key: 'previous:dimensio', bytes: 3000 });
  const downloads = report.items.find((item) => item.label === 'Unfinished downloads');
  assert.equal(downloads.bytes, 700);
  assert.equal(downloads.clean.key, 'downloads');
  assert.equal(report.total, report.items.reduce((sum, item) => sum + item.bytes, 0));

  const busy = await storageReport({ ...options, downloading: true });
  assert.equal(busy.items.find((item) => item.label === 'Unfinished downloads').clean, undefined, 'never offered mid-download');
  await assert.rejects(cleanStorage('downloads', { ...options, downloading: true }), /download is running/);

  await cleanStorage('downloads', options);
  assert.deepEqual(fs.readdirSync(downloadsRoot), []);
  await cleanStorage('previous:dimensio', options);
  assert.equal(forgotten, path.join(installRoot, 'dimensio'));
  await assert.rejects(cleanStorage('previous:nope', options), /Unknown product/);
  await assert.rejects(cleanStorage('rm -rf /', options), /Unknown clean-up/);
});

test('measuring a folder never follows a link out of it', async (t) => {
  const root = scratch();
  writeFile(path.join(root, 'inside', 'file.bin'), 100);
  writeFile(path.join(root, 'outside', 'big.bin'), 10_000);
  try {
    fs.symlinkSync(path.join(root, 'outside'), path.join(root, 'inside', 'link'), 'junction');
  } catch {
    t.skip('this filesystem cannot make links');
    return;
  }
  assert.equal(await directorySize(path.join(root, 'inside')), 100);
});

test('forgetting a previous version keeps the current one and refuses while a first launch is pending', () => {
  const installRoot = path.join(scratch(), 'products');
  const productRoot = path.join(installRoot, 'dimensio');
  writeFile(path.join(productRoot, 'versions', '0.2.2', 'a.bin'), 10);
  writeFile(path.join(productRoot, 'versions', '0.2.3', 'b.bin'), 10);
  fs.writeFileSync(path.join(productRoot, 'current.json'), JSON.stringify({ current: '0.2.3', previous: '0.2.2', pending: true }));
  assert.throws(() => forgetPreviousVersion(installRoot, 'dimensio'), /first launch/);
  assert.ok(fs.existsSync(path.join(productRoot, 'versions', '0.2.2')));

  fs.writeFileSync(path.join(productRoot, 'current.json'), JSON.stringify({ current: '0.2.3', previous: '0.2.2', pending: false }));
  forgetPreviousVersion(installRoot, 'dimensio');
  assert.deepEqual(readPointer(productRoot), { current: '0.2.3', previous: '', pending: false });
  assert.deepEqual(fs.readdirSync(path.join(productRoot, 'versions')), ['0.2.3']);
  assert.throws(() => forgetPreviousVersion(installRoot, '../escape'), /Invalid product/);
});

test('readiness reads the computer and says what each app needs', async () => {
  const answers = {
    'nvidia-smi': () => ({ code: 0, stdout: 'NVIDIA GeForce RTX 4070, 566.36\n' }),
    'where.exe': ({ args }) => (args[0] === 'claude' ? { code: 0, stdout: 'C:\\Users\\me\\.local\\bin\\claude.exe\r\n' } : { code: 1, stdout: '' }),
  };
  const run = async (command, args) => (answers[command] ? answers[command]({ args }) : { code: 1, stdout: '' });
  const checks = await checkAll({ run, platform: 'win32', freeBytes: 182 * 1024 ** 3, exists: () => false });
  const state = Object.fromEntries(checks.map((check) => [check.id, check.state]));
  assert.deepEqual(state, { gpu: 'ok', 'claude-windows': 'ok', 'codex-windows': 'missing', disk: 'ok' });
  assert.match(checks.find((check) => check.id === 'gpu').detail, /RTX 4070, driver 566\.36/);

  const products = ['fabula', 'discere', 'luna', 'dimensio', 'imago', 'ludere'].map((id) => ({ id, displayName: id }));
  const verdict = Object.fromEntries(productReadiness(products, checks).map((entry) => [entry.id, entry.state]));
  assert.deepEqual(verdict, { fabula: 'ok', discere: 'ok', luna: 'ok', dimensio: 'ok', imago: 'ok', ludere: 'ok' });

  // Claude Code installed but not yet on the launcher's PATH is still found.
  const fresh = await checkAll({ run: async () => ({ code: 1, stdout: '' }), platform: 'win32', freeBytes: 2 * 1024 ** 3, home: 'C:\\Users\\me', exists: (file) => file === 'C:\\Users\\me\\.local\\bin\\claude.exe' });
  assert.equal(fresh.find((check) => check.id === 'claude-windows').state, 'ok');

  const bare = await checkAll({ run: async () => ({ code: 1, stdout: '' }), platform: 'win32', freeBytes: 2 * 1024 ** 3, exists: () => false });
  const without = Object.fromEntries(bare.map((check) => [check.id, check.state]));
  assert.equal(without['claude-windows'], 'missing');
  assert.equal(without.disk, 'missing');
  const bareVerdict = Object.fromEntries(productReadiness(products, bare).map((entry) => [entry.id, entry.state]));
  assert.deepEqual(bareVerdict, { fabula: 'missing', discere: 'warn', luna: 'missing', dimensio: 'missing', imago: 'missing', ludere: 'ok' });
  const throwing = await checkAll({ run: async () => { throw new Error('spawn failed'); }, platform: 'win32', freeBytes: null, exists: () => false });
  assert.ok(throwing.every((check) => ['missing', 'unknown'].includes(check.state)));
});

test('release notes are plain, bounded text and never sink a release', () => {
  const base = { schemaVersion: 1, product: 'imago', version: '0.2.0', platform: 'windows-x64', minimumInstrumentaVersion: '0.10.0', installStrategy: 'managed-web',
    bundle: { asset: 'imago.zip', size: 10, sha256: 'a'.repeat(64), entry: 'index.html' } };
  assert.equal(validateReleaseManifest({ ...base, notes: 'Line one\r\n- a\u0000 change‮' }).notes, 'Line one\n- a change');
  assert.equal(validateReleaseManifest({ ...base, notes: { html: '<b>' } }).notes, undefined);
  assert.equal(validateReleaseManifest(base).notes, undefined);
  assert.equal(releaseNotesText('x'.repeat(5000)).length, 4000);
});
