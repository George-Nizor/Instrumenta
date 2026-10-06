'use strict';

// What the apps use on disk, and the clean-ups that are safe to offer.
//
// Measured: each managed product's installed versions (the current one, and the previous one kept
// for rollback), unfinished release downloads, Luna's separate installation, and Fabula's engine
// inside WSL. Offered: deleting unfinished downloads, and forgetting a managed product's previous
// version, which costs the ability to roll back and says so. Nothing else is ever deleted from
// here: uninstalling is the tile's job, and Fabula's engine belongs to Fabula.

const fs = require('./plain-fs.cjs');
const path = require('node:path');

// Sums a directory without following links, so a junction can never make it count, or later
// delete, something outside the folder it was asked about.
async function directorySize(root, options = {}) {
  const lstat = options.lstat || ((target) => fs.promises.lstat(target));
  const readdir = options.readdir || ((target) => fs.promises.readdir(target));
  let total = 0;
  let pending = [root];
  // Breadth-first, a batch at a time: a 15 GB install has tens of thousands of files, and asking
  // for them one by one is what made the panel slow.
  while (pending.length) {
    const batch = pending.splice(0, 128);
    const found = await Promise.all(batch.map(async (current) => {
      let stat;
      try { stat = await lstat(current); } catch { return []; }
      if (stat.isSymbolicLink()) return [];
      if (stat.isFile()) { total += stat.size; return []; }
      if (!stat.isDirectory()) return [];
      try { return (await readdir(current)).map((name) => path.join(current, name)); } catch { return []; }
    }));
    for (const children of found) pending = pending.concat(children);
  }
  return total;
}

function exists(target) {
  try { return fs.existsSync(target); } catch { return false; }
}

async function managedProducts({ installRoot, products, readPointer, size }) {
  const items = [];
  for (const product of products) {
    const root = path.join(installRoot, product.id);
    if (!exists(path.join(root, 'versions'))) continue;
    let pointer = { current: '', previous: '', pending: false };
    try { pointer = readPointer(root); } catch { /* measured anyway */ }
    const bytes = await size(root);
    const previousBytes = pointer.previous ? await size(path.join(root, 'versions', pointer.previous)) : 0;
    const note = pointer.previous
      ? `Version ${pointer.current || 'unknown'}, and ${pointer.previous} kept for rolling back.`
      : `Version ${pointer.current || 'unknown'}.`;
    const item = { product: product.id, label: product.displayName || product.id, bytes, path: root, note };
    if (pointer.previous && !pointer.pending && previousBytes > 0) {
      item.clean = { key: `previous:${product.id}`, label: `Remove ${pointer.previous}`, detail: `Frees the space ${pointer.previous} takes. ${product.displayName || product.id} can no longer be rolled back.`, bytes: previousBytes };
    }
    items.push(item);
  }
  return items;
}

async function storageReport(options) {
  const size = options.size || ((target) => directorySize(target));
  const items = await managedProducts({ ...options, size });

  if (exists(options.downloadsRoot)) {
    const bytes = await size(options.downloadsRoot);
    if (bytes > 0) {
      const busy = Boolean(options.downloading);
      items.push({
        product: 'instrumenta', label: 'Unfinished downloads', bytes, path: options.downloadsRoot,
        note: busy ? 'A download is running; it can be cleaned once it finishes.' : 'Kept so an interrupted install resumes instead of starting again.',
        ...(busy ? {} : { clean: { key: 'downloads', label: 'Delete', detail: 'An interrupted install will download from the start next time.', bytes } }),
      });
    }
  }

  const extras = await Promise.all((options.extras || []).map(async (extra) => {
    try {
      const measured = await extra.measure();
      return measured && measured.bytes > 0 ? { product: extra.product, label: extra.label, note: extra.note, ...measured } : null;
    } catch { return null; /* a probe that fails leaves its row out */ }
  }));
  items.push(...extras.filter(Boolean));

  let free = null;
  try {
    const target = exists(options.installRoot) ? options.installRoot : path.dirname(options.installRoot);
    const stats = await (options.statfs || ((p) => fs.promises.statfs(p)))(target);
    free = Number(stats.bavail) * Number(stats.bsize);
  } catch { /* unknown */ }

  items.sort((a, b) => (b.bytes || 0) - (a.bytes || 0));
  return { items, total: items.reduce((sum, item) => sum + (item.bytes || 0), 0), free };
}

// Carries out one offered clean-up. Each key is checked against what the report would offer now,
// not trusted from the caller.
async function cleanStorage(key, options) {
  const remove = options.remove || ((target) => fs.promises.rm(target, { recursive: true, force: true }));
  const text = String(key || '');
  if (text === 'downloads') {
    if (options.downloading) throw new Error('A download is running. Clean up once it finishes.');
    if (!exists(options.downloadsRoot)) return;
    for (const name of await fs.promises.readdir(options.downloadsRoot)) await remove(path.join(options.downloadsRoot, name));
    return;
  }
  const previous = text.match(/^previous:([a-z][a-z0-9-]*)$/);
  if (previous) {
    const id = previous[1];
    if (!options.products.some((product) => product.id === id)) throw new Error(`Unknown product: ${id}`);
    await options.forgetPrevious(path.join(options.installRoot, id));
    return;
  }
  throw new Error('Unknown clean-up.');
}

module.exports = { cleanStorage, directorySize, storageReport };
