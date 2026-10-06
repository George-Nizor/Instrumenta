'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_WORKSPACE = path.resolve(__dirname, '..', '..');

function iconPaths(svg) {
  return [...String(svg).matchAll(/<path\b(?=[^>]*\bfill=["']([^"']+)["'])(?=[^>]*\bd=["']([^"']+)["'])[^>]*\/?>/gi)]
    .map((match) => [match[1].toUpperCase(), match[2]]);
}

function validateSvg(file, expectedViewBox) {
  if (!fs.existsSync(file)) throw new Error(`Missing canonical icon source: ${file}`);
  const svg = fs.readFileSync(file, 'utf8');
  if (!/^\s*<svg\b/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) {
    throw new Error(`Invalid SVG document: ${file}`);
  }
  if (expectedViewBox && !new RegExp(`viewBox=["']${expectedViewBox}["']`, 'i').test(svg)) {
    throw new Error(`${file} must use viewBox="${expectedViewBox}".`);
  }
  if (/<script\b|\bon\w+\s*=|\b(?:href|xlink:href)\s*=\s*["'](?:https?:|data:)/i.test(svg)) {
    throw new Error(`External or executable SVG content is not allowed in ${file}.`);
  }
  return svg;
}

function validatePng(file, expectedSize) {
  if (!fs.existsSync(file)) throw new Error(`Missing canonical PNG asset: ${file}`);
  const png = fs.readFileSync(file);
  const signature = '89504e470d0a1a0a';
  if (png.length < 26 || png.subarray(0, 8).toString('hex') !== signature ||
      png.readUInt32BE(16) !== expectedSize || png.readUInt32BE(20) !== expectedSize ||
      png[25] !== 6) {
    throw new Error(`${file} must be an ${expectedSize} x ${expectedSize} RGBA PNG.`);
  }
  return png;
}

function validateIconSources(launcherRoot = path.join(DEFAULT_WORKSPACE, 'Instrumenta')) {
  const markPath = path.join(launcherRoot, 'brand', 'instrumenta-mark.png');
  const iconPath = path.join(launcherRoot, 'packaging', 'icon.png');
  validatePng(markPath, 512);
  validatePng(iconPath, 1024);
  return { markPath, iconPath };
}

function target(label, boundary, relative) {
  return { label, boundary: path.resolve(boundary), path: path.resolve(boundary, relative) };
}

function cleanTargets(workspaceRoot = DEFAULT_WORKSPACE, environment = process.env) {
  const root = path.resolve(workspaceRoot);
  const launcher = path.join(root, 'Instrumenta');
  const imago = path.join(root, 'Imago');
  const ludere = path.join(root, 'Ludere');
  const targets = [
    target('launcher build output', launcher, 'build'),
    target('packaged applications', launcher, 'release'),
    target('unfinished package publication', launcher, 'release.next'),
    target('superseded package publication', launcher, 'release.previous'),
    target('package staging', launcher, path.join('packaging', 'staging')),
    target('launcher scratch data', launcher, '.instrumenta'),
    target('launcher dependency cache', path.join(launcher, 'node_modules'), '.cache'),
    target('Imago production build', imago, path.join('web', 'dist')),
    target('Imago dependency build cache', path.join(imago, 'node_modules'), '.vite'),
    target('Ludere production build', ludere, 'dist'),
  ];

  if (environment.LOCALAPPDATA) {
    const localInstrumenta = path.join(environment.LOCALAPPDATA, 'Instrumenta');
    targets.push(target('temporary package workspace', localInstrumenta, 'package-workspace'));
  }
  if (environment.APPDATA) {
    const launcherData = path.join(environment.APPDATA, 'instrumenta-launcher');
    // Local copies of native bundles that live on a share. Each is rebuilt on its next launch.
    targets.push(target('local native launch mirrors', launcherData, 'apps'));
    // Where release downloads went before they moved to local application data. Nothing reads
    // it any more; the launcher also removes it on its first start after the move.
    targets.push(target('release downloads left in roaming data', launcherData, 'downloads'));
    targets.push(target('launcher diagnostics', launcherData, 'logs'));
    targets.push(target('local crash reports', launcherData, 'Crashpad'));
    const browserCaches = ['Cache', 'Code Cache', 'GPUCache', 'DawnCache', 'GrShaderCache', 'GraphiteDawnCache', 'blob_storage'];
    for (const name of browserCaches) {
      targets.push(target(`launcher ${name}`, launcherData, name));
    }
    // Keep IndexedDB, Local Storage, and service-worker data. Existing Imago
    // cutouts and Ludere autosaves both live in this historical default session.
  }
  return targets;
}

// The launcher checkout and its catalog are what make a folder an Instrumenta workspace; which
// product checkouts sit beside them is the owner's choice.
function assertWorkspace(workspaceRoot) {
  const required = [
    path.join(workspaceRoot, 'Instrumenta', 'package.json'),
    path.join(workspaceRoot, 'Instrumenta', 'products', 'catalog.json'),
  ];
  if (required.some((candidate) => !fs.existsSync(candidate))) {
    throw new Error(`Refusing maintenance outside an Instrumenta workspace: ${workspaceRoot}`);
  }
}

function assertContained(candidate) {
  const relative = path.relative(candidate.boundary, candidate.path);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing unsafe cleanup target: ${candidate.path}`);
  }
}

function cleanKnownOutputs(options = {}) {
  const workspaceRoot = path.resolve(options.workspaceRoot || DEFAULT_WORKSPACE);
  const environment = options.environment || process.env;
  const log = options.log || console.log;
  assertWorkspace(workspaceRoot);
  const removed = [];
  for (const candidate of cleanTargets(workspaceRoot, environment)) {
    assertContained(candidate);
    if (!fs.existsSync(candidate.path)) continue;
    fs.rmSync(candidate.path, { recursive: true, force: true });
    removed.push(candidate);
    log(`  removed ${candidate.label}: ${candidate.path}`);
  }
  return removed;
}

function main(argv) {
  const command = argv[0] || 'help';
  if (command === 'check-icon') {
    validateIconSources();
    console.log('canonical launcher PNG mark and Windows package icon are valid');
    return;
  }
  if (command === 'clean') {
    const removed = cleanKnownOutputs();
    if (!removed.length) console.log('  generated outputs and launcher caches are already clean.');
    console.log('  kept source, projects, media, dependencies, settings, and deployed native bundles.');
    return;
  }
  console.log('Usage: node scripts/workspace-maintenance.cjs <check-icon|clean>');
  if (command !== 'help') process.exitCode = 2;
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`\nInstrumenta maintenance failed:\n${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  assertContained,
  cleanKnownOutputs,
  cleanTargets,
  iconPaths,
  validateIconSources,
  validatePng,
  validateSvg,
};
