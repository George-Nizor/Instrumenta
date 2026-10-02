const fs = require('node:fs');
const path = require('node:path');

function files(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(item => {
    const file = path.join(root, item.name);
    return item.isDirectory() && item.name !== 'node_modules' ? files(file) : item.isFile() ? [file] : [];
  });
}
function writeProductNotices(product, staged, launcherVersion) {
  const out = path.join(staged, 'licenses');
  fs.mkdirSync(out, { recursive: true });
  const lockPath = path.join(product.sourceRoot, 'package-lock.json');
  const sections = [];
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    for (const [relative, entry] of Object.entries(lock.packages || {})) {
      if (!relative || entry.dev) continue;
      const root = path.join(product.sourceRoot, relative);
      const names = files(root).filter(file => /^(licen[sc]e|copying|notice|ofl)([.-]|$)/i.test(path.basename(file)));
      const supplements = {
        'node_modules/guid-typescript@1.0.9': 'guid-typescript-1.0.9.txt',
        'node_modules/onnxruntime-common@1.21.0': 'onnxruntime-1.21.0.txt',
        'node_modules/onnxruntime-web@1.21.0': 'onnxruntime-1.21.0.txt',
      };
      const supplement = supplements[`${relative}@${entry.version}`];
      if (supplement) names.push(path.resolve(__dirname, '../packaging/supplemental-notices', supplement));
      if (!names.length && !relative.endsWith('@sqlite.org/sqlite-wasm')) throw new Error(`Missing bundled licence: ${relative}`);
      sections.push(`=== ${relative} ${entry.version} (${entry.license || 'see licence text'}) ===`);
      if (relative.endsWith('@sqlite.org/sqlite-wasm')) sections.push('SQLite is public domain: https://sqlite.org/copyright.html');
      for (const file of names) sections.push(`${path.relative(root, file)}\n${fs.readFileSync(file, 'utf8')}`);
    }
  }
  fs.writeFileSync(path.join(out, 'bundled-dependencies.txt'), sections.join('\n\n') + '\n');
  for (const name of ['LICENSE', 'LICENSES.md', 'THIRD_PARTY_NOTICES.md']) {
    const input = path.join(product.sourceRoot, name);
    if (fs.existsSync(input)) fs.copyFileSync(input, path.join(out, name));
  }
  const source = `https://github.com/George-Nizor/Instrumenta/releases/download/v${launcherVersion}/Instrumenta-${launcherVersion}-sources.zip`;
  const note = product.id === 'imago' ? 'Imago includes IMG.LY background-removal under AGPL-3.0. Its combined web build is distributed subject to those terms; the application source retains its MIT notice. Full corresponding source and build inputs accompany this release.\n' : '';
  fs.writeFileSync(path.join(out, 'SOURCE.txt'), `${note}Source, dependency sources and build inputs for this distribution:\n${source}\n`);
}
module.exports = { writeProductNotices };
